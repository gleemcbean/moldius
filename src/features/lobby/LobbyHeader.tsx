import { inviteUrl } from "@shared/inviteLink";
import type { LobbyState } from "@shared/protocol/lobby";
import { useState } from "react";
import { Icon } from "../../components/Icon";
import { useT } from "../../i18n";
import styles from "./LobbyScreen.module.scss";

export function LobbyHeader({ lobby }: { lobby: LobbyState }) {
	const t = useT();
	const [copied, setCopied] = useState(false);
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
					{lobby.visibility === "private"
						? t.lobby.kickerPrivate
						: t.lobby.kickerPublic}
				</p>
				<h1 className={styles.title}>{t.lobby.title}</h1>
			</div>
			{lobby.code ? (
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
			) : (
				<p className={styles.publicNote}>
					{t.lobby.publicNote(lobby.minPlayers)}
				</p>
			)}
		</header>
	);
}
