import { lazy, Suspense, useEffect, useState } from "react";
import { loadKeyboardLayout } from "../config/controls";
import { AccountModal } from "../features/account/AccountModal";
import { initAccount } from "../features/account/accountStore";
import { audioEngine } from "../features/audio/audioEngine";
import { music } from "../features/audio/music";
import { BestiaryModal } from "../features/bestiary/BestiaryModal";
import { ChallengesModal } from "../features/challenges/ChallengesModal";
import { DailyModal } from "../features/daily/DailyModal";
import { FriendInvites } from "../features/friends/FriendInvites";
import { FriendsModal } from "../features/friends/FriendsModal";
import { initFriends } from "../features/friends/friendsStore";
import { GameScreen } from "../features/game/GameScreen";
import { initMatchController } from "../features/game/matchController";
import { HomeScreen } from "../features/home/HomeScreen";
import { LegalPage } from "../features/legal/LegalPage";
import { LoadingScreen } from "../features/loading/LoadingScreen";
import { treatPathAsInvite } from "../features/lobby/inviteStore";
import { LobbyScreen } from "../features/lobby/LobbyScreen";
import { listenLobbyUpdates } from "../features/lobby/lobbyClient";
import { initConnection } from "../features/network/connection";
import { ResultsScreen } from "../features/results/ResultsScreen";
import { SettingsModal } from "../features/settings/SettingsModal";
import { settingsStore } from "../features/settings/settingsStore";
import { micManager } from "../features/voice/micManager";
import { initVoiceController } from "../features/voice/voiceController";
import { useStore } from "../hooks/useStore";
import { initLanguage } from "../i18n";
import { appStore, closeOverlay } from "./appStore";
import { DesktopOnly } from "./DesktopOnly";
import { hasDesktopInput } from "./desktopOnly";
import { Toasts } from "./Toasts";

const ADMIN_CHECK_TIMEOUT_MS = 3000;

const AdminPage = lazy(() =>
	import("../features/admin/AdminPage").then((module) => ({
		default: module.AdminPage,
	})),
);

function useGlobalSetup(): void {
	useEffect(() => {
		initConnection();
		initAccount();
		initFriends();
		listenLobbyUpdates();
		initMatchController();
		initVoiceController();
		void loadKeyboardLayout();
		const applySettings = () => {
			const settings = settingsStore.get();
			audioEngine.setVolumes(settings.volumes);
			micManager.setVoiceGate(settings.voiceGate);
		};
		applySettings();
		const unsubscribe = settingsStore.subscribe(applySettings);
		const stopLanguage = initLanguage();
		const applyScreen = () =>
			music.setMode(appStore.get().screen === "game" ? "game" : "menu");
		applyScreen();
		const stopScreen = appStore.subscribe(applyScreen);
		const unlockAudio = () =>
			void audioEngine.resume().then(() => music.start());
		window.addEventListener("pointerdown", unlockAudio);
		window.addEventListener("keydown", unlockAudio);
		return () => {
			unsubscribe();
			stopLanguage();
			stopScreen();
			window.removeEventListener("pointerdown", unlockAudio);
			window.removeEventListener("keydown", unlockAudio);
		};
	}, []);
}

export function App() {
	const pathname = window.location.pathname.replace(/\/$/, "");
	if (pathname === "/terms" || pathname === "/privacy") {
		return <LegalPage document={pathname === "/terms" ? "terms" : "privacy"} />;
	}
	if (pathname === "/admin") {
		return <AdminGate />;
	}
	return <PublicApp />;
}

function PublicApp() {
	return hasDesktopInput() ? <GameApp /> : <DesktopOnly />;
}

/** Rien n'est affiché ni chargé tant que le serveur n'a pas reconnu un admin. */
function AdminGate() {
	const [allowed, setAllowed] = useState<boolean | null>(null);
	useEffect(() => {
		let cancelled = false;
		fetch("/api/admin/overview", {
			credentials: "same-origin",
			signal: AbortSignal.timeout(ADMIN_CHECK_TIMEOUT_MS),
		})
			.then((response) => response.ok)
			.catch(() => false)
			.then((ok) => {
				if (cancelled) {
					return;
				}
				if (!ok) {
					treatPathAsInvite();
				}
				setAllowed(ok);
			});
		return () => {
			cancelled = true;
		};
	}, []);
	if (allowed === null) {
		return null;
	}
	return allowed ? (
		<Suspense fallback={null}>
			<AdminPage />
		</Suspense>
	) : (
		<PublicApp />
	);
}

function GameApp() {
	useGlobalSetup();
	const screen = useStore(appStore, (state) => state.screen);
	const overlay = useStore(appStore, (state) => state.overlay);
	return (
		<>
			{screen === "home" ? <HomeScreen /> : null}
			{screen === "lobby" ? <LobbyScreen /> : null}
			{screen === "loading" ? <LoadingScreen /> : null}
			{screen === "game" ? <GameScreen /> : null}
			{screen === "results" ? <ResultsScreen /> : null}
			{overlay === "settings" ? <SettingsModal onClose={closeOverlay} /> : null}
			{overlay === "account" ? <AccountModal onClose={closeOverlay} /> : null}
			{overlay === "bestiary" ? <BestiaryModal onClose={closeOverlay} /> : null}
			{overlay === "friends" ? <FriendsModal onClose={closeOverlay} /> : null}
			{overlay === "daily" ? <DailyModal onClose={closeOverlay} /> : null}
			{overlay === "challenges" ? (
				<ChallengesModal onClose={closeOverlay} />
			) : null}
			{screen === "home" || screen === "lobby" ? <FriendInvites /> : null}
			<Toasts />
		</>
	);
}
