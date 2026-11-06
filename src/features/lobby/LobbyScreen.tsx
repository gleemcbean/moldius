import { useEffect } from "react";
import { openOverlay } from "../../app/appStore";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { SelectorGroup } from "../../components/SelectorGroup";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { accountStore } from "../account/accountStore";
import { sessionStore } from "../network/sessionStore";
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
import { RulesPanel } from "./RulesPanel";

export function LobbyScreen() {
	const t = useT();
	const lobby = useStore(lobbyStore, (state) => state.lobby);
	const playerId = useStore(sessionStore, (state) => state.playerId);
	const micStatus = useStore(micStore, (state) => state.status);
	const accountStatus = useStore(accountStore, (state) => state.status);

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

	return (
		<main className={styles.lobby}>
			<SelectorGroup className={styles.layout}>
				<LobbyHeader lobby={lobby} />
				<div
					className={[
						styles.columns,
						lobby.visibility === "public" ? styles.single : "",
					].join(" ")}
				>
					<section className={styles.main}>
						<PlayerSlots lobby={lobby} selfId={playerId} />
						<MicPanel />
					</section>
					{lobby.visibility === "private" ? (
						<RulesPanel
							lobby={lobby}
							editable={isHost && lobby.phase === "waiting"}
						/>
					) : null}
				</div>
				<footer className={styles.footer}>
					<Button
						variant="ghost"
						icon={<Icon name="door" />}
						onClick={() => {
							leaveVoice();
							leaveLobby();
						}}
					>
						{t.lobby.leave}
					</Button>
					<Button
						variant="ghost"
						icon={<Icon name="gear" />}
						onClick={() => openOverlay("settings")}
					>
						{t.lobby.settings}
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
					<div className={styles.spacer} />
					{lobby.phase === "countdown" && lobby.countdownEndsAt ? (
						<Countdown endsAt={lobby.countdownEndsAt} />
					) : null}
					{inMatch ? (
						<span className={styles.inMatch}>{t.lobby.inMatch}</span>
					) : null}

					<Button
						variant={me?.ready ? "secondary" : "primary"}
						size="large"
						disabled={!micReady || inMatch}
						title={micReady ? undefined : t.lobby.micRequiredTitle}
						onClick={() => setReady(!me?.ready)}
					>
						{me?.ready ? t.lobby.notReadyButton : t.lobby.readyButton}
					</Button>
					{lobby.visibility === "private" ? (
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
				{!inMatch && !enoughPlayers ? (
					<p className={styles.needPlayers}>
						{t.lobby.needPlayers(lobby.minPlayers, connected.length)}
					</p>
				) : null}
				{!micReady ? (
					<p className={styles.micWarning}>{t.lobby.micWarning}</p>
				) : null}
			</SelectorGroup>
		</main>
	);
}
