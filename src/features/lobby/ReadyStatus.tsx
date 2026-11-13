import type { LobbyPlayerInfo, LobbyState } from "@shared/protocol/lobby";
import type { ReactNode } from "react";
import { useT } from "../../i18n";
import { Countdown } from "./Countdown";
import styles from "./LobbyScreen.module.scss";

export function ReadyStatus({
	lobby,
	me,
	isHost,
	micReady,
}: {
	lobby: LobbyState;
	me: LobbyPlayerInfo | undefined;
	isHost: boolean;
	micReady: boolean;
}) {
	const t = useT();
	const status = t.lobby.status;
	const connected = lobby.players.filter((player) => player.connected);
	const readyCount = connected.filter(
		(player) => player.ready && player.micReady,
	).length;
	const enoughPlayers = connected.length >= lobby.minPlayers;
	const everyoneReady = readyCount === connected.length;
	const inMatch = lobby.phase === "loading" || lobby.phase === "playing";

	let message: ReactNode;
	let urgent = false;
	if (inMatch) {
		message = t.lobby.inMatch;
	} else if (lobby.phase === "countdown" && lobby.countdownEndsAt) {
		message = <Countdown endsAt={lobby.countdownEndsAt} />;
		urgent = true;
	} else if (!micReady) {
		message = status.micFirst;
		urgent = true;
	} else if (!me?.ready) {
		message = status.yourTurn;
		urgent = true;
	} else if (!enoughPlayers) {
		message = t.lobby.needPlayers(lobby.minPlayers, connected.length);
	} else if (!everyoneReady) {
		message = status.waitingOthers(readyCount, connected.length);
	} else if (lobby.visibility === "private") {
		message = isHost ? status.hostStart : status.guestStart;
		urgent = isHost;
	} else {
		message = status.publicStart;
	}

	return (
		<div
			className={[styles.status, urgent ? styles.statusUrgent : ""].join(" ")}
			aria-live="polite"
		>
			<span
				className={styles.pips}
				role="img"
				aria-label={t.lobby.readyCount(readyCount, connected.length)}
			>
				{connected.map((player) => (
					<span
						key={player.id}
						className={[
							styles.pip,
							player.ready && player.micReady ? styles.pipOn : "",
						].join(" ")}
					/>
				))}
			</span>
			<p className={styles.statusText}>{message}</p>
		</div>
	);
}
