import { dailyChallenge } from "@shared/dailyChallenge";
import { inviteUrl } from "@shared/inviteLink";
import type { LobbyState } from "@shared/protocol/lobby";
import { useState } from "react";
import { Icon } from "../../components/Icon";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { sessionStore } from "../network/sessionStore";
import styles from "./LobbyScreen.module.scss";
import { setOpenToFriends } from "./lobbyClient";

export function LobbyHeader({ lobby }: { lobby: LobbyState }) {
	const t = useT();
	const playerId = useStore(sessionStore, (state) => state.playerId);
	const [copied, setCopied] = useState(false);
	const isHost = lobby.hostId === playerId;
	const waiting = lobby.phase === "waiting" || lobby.phase === "countdown";
	const copy = async () => {
		if (!lobby.code) {
			return;
		}
		try {
			await navigator.clipboard.writeText(
				inviteUrl(window.location.origin, lobby.code),
			);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			setCopied(false);
		}
	};
	return (
		<header className={styles.header}>
			<div>
				<p className={styles.kicker}>
					<span>
						{lobby.daily
							? t.home.daily(
									t.daily.themes[dailyChallenge(lobby.daily).theme].name,
								)
							: lobby.visibility === "private"
								? t.lobby.kickerPrivate
								: t.lobby.kickerPublic}
					</span>
					<span className={styles.playerCount}>
						{t.lobby.playerCount(lobby.players.length, lobby.capacity)}
					</span>
				</p>
				<h1 className={styles.title}>{t.lobby.title}</h1>
			</div>
			{lobby.code ? (
				<div className={styles.share}>
					<button
						type="button"
						className={styles.code}
						onClick={copy}
						data-selectable=""
						title={t.lobby.copyCode}
					>
						<span className={styles.codeLabel}>{t.lobby.codeLabel}</span>
						<span className={styles.codeValue}>{lobby.code}</span>
						<span className={styles.codeIcon}>
							{copied ? <Icon name="check" /> : <Icon name="copy" />}
						</span>
					</button>
					{isHost ? (
						<label className={styles.friendsToggle}>
							<input
								type="checkbox"
								checked={lobby.openToFriends}
								disabled={!waiting}
								onChange={(event) => setOpenToFriends(event.target.checked)}
								data-selectable=""
							/>
							<span>
								<strong>{t.lobby.openToFriends}</strong>
								<small>{t.lobby.openToFriendsHint}</small>
							</span>
						</label>
					) : lobby.openToFriends ? (
						<p className={styles.friendsNote}>
							<Icon name="users" />
							{t.lobby.openToFriendsGuest}
						</p>
					) : null}
				</div>
			) : (
				<p className={styles.publicNote}>
					{t.lobby.publicNote(lobby.minPlayers)}
				</p>
			)}
		</header>
	);
}
