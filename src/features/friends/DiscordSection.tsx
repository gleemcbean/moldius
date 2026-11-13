import { useEffect, useState } from "react";
import type { DiscordUser } from "../../app/desktopApp";
import { showToast } from "../../app/appStore";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { discordStore, inviteOnDiscord } from "../discord/discordStore";
import styles from "./FriendsModal.module.scss";

const INVITED_MS = 6000;
const SHOWN_FRIENDS = 30;

export function DiscordPanel({ synced }: { synced: number }) {
	const t = useT();
	const discord = useStore(discordStore, (state) => state);
	if (!discord.available) {
		return null;
	}
	const line =
		discord.status === "ready" && discord.user
			? t.discord.connectedAs(discord.user.displayName)
			: discord.status === "authorizing"
				? t.discord.authorizing
				: discord.status === "connecting"
					? t.discord.connecting
					: discord.status === "error"
						? t.discord.error
						: t.discord.connectFromAccount;
	const sync =
		discord.status !== "ready"
			? null
			: discord.syncError === "discord-not-linked"
				? t.discord.syncNotLinked
				: discord.syncError === "discord-mismatch"
					? t.discord.syncMismatch
					: t.discord.syncPending(synced);
	return (
		<div className={styles.discord}>
			<Icon name="discord" />
			<span className={styles.discordText}>
				<strong>{line}</strong>
				{sync ? (
					<small className={discord.syncError ? styles.warning : undefined}>
						{sync}
					</small>
				) : null}
			</span>
		</div>
	);
}

function DiscordFriend({
	friend,
	canInvite,
}: {
	friend: DiscordUser;
	canInvite: boolean;
}) {
	const t = useT();
	const [invited, setInvited] = useState(false);
	useEffect(() => {
		if (!invited) {
			return;
		}
		const timer = window.setTimeout(() => setInvited(false), INVITED_MS);
		return () => window.clearTimeout(timer);
	}, [invited]);
	const invite = async () => {
		setInvited(true);
		if (!(await inviteOnDiscord(friend.id))) {
			setInvited(false);
			showToast(t.discord.inviteFailed, "error");
		}
	};
	return (
		<li className={styles.person} data-selector-row="">
			{friend.avatarUrl ? (
				<img className={styles.avatar} src={friend.avatarUrl} alt="" />
			) : (
				<span className={styles.avatar} aria-hidden="true">
					<Icon name="discord" />
				</span>
			)}
			<span className={styles.identity}>
				<span className={styles.name}>{friend.displayName}</span>
				<span className={styles.detail}>
					<i
						className={friend.playing ? styles.lobby : styles[friend.status]}
						aria-hidden="true"
					/>
					{friend.playing
						? t.discord.playing
						: t.discord.statuses[friend.status]}
				</span>
			</span>
			<span className={styles.actions}>
				{canInvite ? (
					<Button variant="secondary" disabled={invited} onClick={invite}>
						{invited ? t.discord.invited : t.discord.invite}
					</Button>
				) : null}
			</span>
		</li>
	);
}

export function DiscordFriendsSection({
	known,
	canInvite,
}: {
	known: ReadonlySet<string>;
	canInvite: boolean;
}) {
	const t = useT();
	const status = useStore(discordStore, (state) => state.status);
	const friends = useStore(discordStore, (state) => state.friends);
	if (status !== "ready") {
		return null;
	}
	const shown = friends
		.filter((friend) => friend.status !== "offline" && !known.has(friend.id))
		.sort(
			(a, b) =>
				Number(b.playing) - Number(a.playing) ||
				a.displayName.localeCompare(b.displayName),
		)
		.slice(0, SHOWN_FRIENDS);
	if (shown.length === 0) {
		return null;
	}
	return (
		<section>
			<h3 className={styles.heading} title={t.discord.sectionHint}>
				{t.discord.section}
			</h3>
			<ul className={styles.list}>
				{shown.map((friend) => (
					<DiscordFriend
						key={friend.id}
						friend={friend}
						canInvite={canInvite}
					/>
				))}
			</ul>
		</section>
	);
}
