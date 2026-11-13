import { dailyChallenge } from "@shared/dailyChallenge";
import type { LobbyState } from "@shared/protocol/lobby";
import type { ReactNode } from "react";
import { useT } from "../../i18n";
import styles from "./LobbyScreen.module.scss";

export function LobbyHeader({
	lobby,
	actions,
}: {
	lobby: LobbyState;
	actions: ReactNode;
}) {
	const t = useT();
	return (
		<header className={styles.header}>
			<div className={styles.heading}>
				<p className={styles.kicker}>
					{lobby.daily
						? t.home.daily(
								t.daily.themes[dailyChallenge(lobby.daily).theme].name,
							)
						: lobby.visibility === "private"
							? t.lobby.kickerPrivate
							: t.lobby.kickerPublic}
				</p>
				<h1 className={styles.title}>{t.lobby.title}</h1>
				{lobby.code ? null : (
					<p className={styles.publicNote}>
						{t.lobby.publicNote(lobby.minPlayers)}
					</p>
				)}
			</div>
			<nav className={styles.headerActions}>{actions}</nav>
		</header>
	);
}
