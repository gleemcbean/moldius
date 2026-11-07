import { useEffect, useState } from "react";
import { openOverlay } from "../../app/appStore";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { SelectorGroup } from "../../components/SelectorGroup";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { accountStore, termsAccepted } from "../account/accountStore";
import { sessionStore } from "../network/sessionStore";
import { settingsStore } from "../settings/settingsStore";
import { micIsUsable, micStore } from "../voice/micManager";
import { voiceChat } from "../voice/voiceChat";
import {
	ensureMicrophone,
	initVoiceController,
	leaveVoice,
} from "../voice/voiceController";
import { Countdown } from "./Countdown";
import { LobbyHeader } from "./LobbyHeader";
import styles from "./LobbyScreen.module.scss";
import { leaveLobby, setReady, startMatch } from "./lobbyClient";
import { lobbyStore } from "./lobbyStore";
import { MicPanel } from "./MicPanel";
import { PlayerSlots } from "./PlayerSlots";
import { RulesModal, RulesSummary } from "./RulesPanel";
import { TermsNotice } from "./TermsNotice";

export function LobbyScreen() {
	const t = useT();
	const [rulesOpen, setRulesOpen] = useState(false);
	const lobby = useStore(lobbyStore, (state) => state.lobby);
	const playerId = useStore(sessionStore, (state) => state.playerId);
	const micStatus = useStore(micStore, (state) => state.status);
	const accountStatus = useStore(accountStore, (state) => state.status);
	const account = useStore(accountStore, (state) => state.account);
	const localTermsChoice = useStore(
		settingsStore,
		(state) => state.termsAccepted,
	);
	const accepted = termsAccepted(
		{ status: accountStatus, account },
		localTermsChoice,
	);

	useEffect(() => {
		initVoiceController();
		voiceChat.setMode("lobby");
		void ensureMicrophone();
	}, []);

	if (!lobby) {
		return (
			<main className={styles.lobby}>
				<p className={styles.waiting}>{t.lobby.connecting}</p>
			</main>
		);
	}

	const me = lobby.players.find((player) => player.id === playerId);
	const isHost = lobby.hostId === playerId;
	const micReady = micIsUsable(micStatus);
	const connected = lobby.players.filter((player) => player.connected);
	const everyoneReady = connected.every(
		(player) => player.ready && player.micReady,
	);
	const enoughPlayers = connected.length >= lobby.minPlayers;
	const inMatch = lobby.phase === "loading" || lobby.phase === "playing";
	const isPrivate = lobby.visibility === "private";
	const rulesEditable =
		isHost && lobby.configEditable && lobby.phase === "waiting";
	const quit = () => {
		leaveVoice();
		leaveLobby();
	};

	return (
		<main className={styles.lobby}>
			<SelectorGroup className={styles.layout}>
				<LobbyHeader lobby={lobby} />
				<div
					className={[styles.columns, isPrivate ? "" : styles.single].join(" ")}
				>
					<section className={styles.main}>
						<PlayerSlots lobby={lobby} selfId={playerId} />
						{isPrivate ? null : <MicPanel />}
					</section>
					{isPrivate ? (
						<aside className={styles.side}>
							<RulesSummary
								lobby={lobby}
								editable={rulesEditable}
								onOpen={() => setRulesOpen(true)}
							/>
							<MicPanel />
						</aside>
					) : null}
				</div>
				<footer className={styles.footer}>
					<Button variant="ghost" icon={<Icon name="door" />} onClick={quit}>
						{t.lobby.leave}
					</Button>
					<Button
						variant="ghost"
						icon={<Icon name="gear" />}
						onClick={() => openOverlay("settings")}
					>
						{t.lobby.settings}
					</Button>
					<Button
						variant="ghost"
						icon={<Icon name="check" />}
						onClick={() => openOverlay("challenges")}
					>
						{t.challenges.button}
					</Button>
					{accountStatus === "loading" ||
					accountStatus === "disabled" ? null : (
						<Button
							variant="ghost"
							icon={<Icon name="users" />}
							onClick={() => openOverlay("friends")}
						>
							{t.friends.lobbyButton}
						</Button>
					)}
					<div className={styles.status}>
						{!inMatch && !enoughPlayers ? (
							<p className={styles.needPlayers}>
								{t.lobby.needPlayers(lobby.minPlayers, connected.length)}
							</p>
						) : null}
					</div>
					{lobby.phase === "countdown" && lobby.countdownEndsAt ? (
						<Countdown endsAt={lobby.countdownEndsAt} />
					) : null}
					{inMatch ? (
						<span className={styles.inMatch}>{t.lobby.inMatch}</span>
					) : null}

					<Button
						variant={me?.ready ? "secondary" : "primary"}
						size="large"
						disabled={!micReady || inMatch || !accepted}
						title={micReady ? undefined : t.lobby.micRequiredTitle}
						onClick={() => setReady(!me?.ready)}
					>
						{me?.ready ? t.lobby.notReadyButton : t.lobby.readyButton}
					</Button>
					{isPrivate ? (
						<Button
							size="large"
							icon={<Icon name="play" />}
							disabled={!isHost || !everyoneReady || !enoughPlayers || inMatch}
							onClick={startMatch}
						>
							{t.lobby.start}
						</Button>
					) : null}
				</footer>
			</SelectorGroup>
			{isPrivate && rulesOpen ? (
				<RulesModal
					lobby={lobby}
					editable={rulesEditable}
					onClose={() => setRulesOpen(false)}
				/>
			) : null}
			{accepted || accountStatus === "loading" ? null : (
				<TermsNotice onLeave={quit} />
			)}
		</main>
	);
}
