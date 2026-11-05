import { useEffect } from "react";
import { loadKeyboardLayout } from "../config/controls";
import { AccountModal } from "../features/account/AccountModal";
import { initAccount } from "../features/account/accountStore";
import { audioEngine } from "../features/audio/audioEngine";
import { music } from "../features/audio/music";
import { BestiaryModal } from "../features/bestiary/BestiaryModal";
import { GameScreen } from "../features/game/GameScreen";
import { initMatchController } from "../features/game/matchController";
import { HomeScreen } from "../features/home/HomeScreen";
import { LegalPage } from "../features/legal/LegalPage";
import { LoadingScreen } from "../features/loading/LoadingScreen";
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

function useGlobalSetup(): void {
	useEffect(() => {
		initConnection();
		initAccount();
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
	if (!hasDesktopInput()) {
		return <DesktopOnly />;
	}
	return <GameApp />;
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
			<Toasts />
		</>
	);
}
