import { inviteUrl } from "@shared/inviteLink";
import type { LobbyState } from "@shared/protocol/lobby";
import { useState } from "react";
import { openOverlay } from "../../app/appStore";
import { Button } from "../../components/Button";
import { Checkbox } from "../../components/Checkbox";
import { Icon } from "../../components/Icon";
import { useT } from "../../i18n";
import styles from "./LobbyScreen.module.scss";
import { setOpenToFriends } from "./lobbyClient";

export function InvitePanel({
	lobby,
	isHost,
	friendsAvailable,
}: {
	lobby: LobbyState;
	isHost: boolean;
	friendsAvailable: boolean;
}) {
	const t = useT();
	const [copied, setCopied] = useState(false);
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
		<section className={[styles.card, styles.invite].join(" ")}>
			<h2 className={styles.cardTitle}>{t.lobby.inviteTitle}</h2>
			<div className={styles.codeRow}>
				<span className={styles.codeBlock}>
					<span className={styles.codeLabel}>{t.lobby.codeLabel}</span>
					<span className={styles.codeValue}>{lobby.code}</span>
				</span>
				<Button
					variant="secondary"
					size="small"
					icon={<Icon name={copied ? "check" : "copy"} />}
					title={t.lobby.copyCode}
					onClick={copy}
				>
					{copied ? t.lobby.linkCopied : t.lobby.copyLink}
				</Button>
			</div>
			{isHost ? (
				<Checkbox
					checked={lobby.openToFriends}
					disabled={!waiting}
					onChange={setOpenToFriends}
					label={t.lobby.openToFriends}
					hint={t.lobby.openToFriendsHint}
				/>
			) : lobby.openToFriends ? (
				<p className={styles.friendsNote}>
					<Icon name="users" />
					{t.lobby.openToFriendsGuest}
				</p>
			) : null}
			{friendsAvailable ? (
				<Button
					variant="ghost"
					size="small"
					wide
					icon={<Icon name="users" />}
					className={styles.inviteFriends}
					onClick={() => openOverlay("friends")}
				>
					{t.friends.lobbyButton}
				</Button>
			) : null}
		</section>
	);
}
