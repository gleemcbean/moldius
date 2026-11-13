import {
	FRIEND_CODE_LENGTH,
	type FriendEntry,
	type FriendPerson,
	normalizeFriendCode,
} from "@shared/protocol/friends";
import { type FormEvent, useEffect, useState } from "react";
import { openOverlay, showToast } from "../../app/appStore";
import { Button } from "../../components/Button";
import { Checkbox } from "../../components/Checkbox";
import { HatPreview } from "../../components/HatPreview";
import { Icon } from "../../components/Icon";
import { Modal } from "../../components/Modal";
import { TaglineBadge } from "../../components/TaglineBadge";
import { useStore } from "../../hooks/useStore";
import { useT } from "../../i18n";
import { accountStore } from "../account/accountStore";
import { lobbyStore } from "../lobby/lobbyStore";
import { ProfileLink } from "../profile/ProfileLink";
import { DiscordFriendsSection, DiscordPanel } from "./DiscordSection";
import styles from "./FriendsModal.module.scss";
import {
	addFriend,
	friendsStore,
	inviteFriend,
	joinFriend,
	refreshFriends,
	removeFriend,
	respondToFriend,
	setAppearOffline,
} from "./friendsStore";

const REFRESH_MS = 15_000;
const INVITED_MS = 6000;

function Person({
	person,
	detail,
	dot,
	discord = false,
	children,
}: {
	person: FriendPerson;
	detail?: string;
	dot?: string;
	discord?: boolean;
	children?: React.ReactNode;
}) {
	const t = useT();
	return (
		<li className={styles.person} data-selector-row="">
			<HatPreview
				color={person.color}
				pattern={person.pattern}
				className={styles.hat}
			/>
			<span className={styles.identity}>
				<span className={styles.name}>
					<ProfileLink profileId={person.accountId} name={person.name}>
						{person.name}
					</ProfileLink>
					<TaglineBadge tagline={person.tagline} />
					{discord ? (
						<span
							className={styles.discordBadge}
							title={t.friends.discordBadge}
						>
							<Icon name="discord" />
						</span>
					) : null}
				</span>
				{detail ? (
					<span className={styles.detail}>
						{dot ? <i className={dot} aria-hidden="true" /> : null}
						{detail}
					</span>
				) : null}
			</span>
			<span className={styles.actions}>{children}</span>
		</li>
	);
}

function Friend({
	friend,
	canInvite,
	canJoin,
}: {
	friend: FriendEntry;
	canInvite: boolean;
	canJoin: boolean;
}) {
	const t = useT();
	const [invited, setInvited] = useState(false);
	const [confirming, setConfirming] = useState(false);
	useEffect(() => {
		if (!invited) {
			return;
		}
		const timer = window.setTimeout(() => setInvited(false), INVITED_MS);
		return () => window.clearTimeout(timer);
	}, [invited]);
	return (
		<Person
			person={friend}
			detail={t.friends.status[friend.status]}
			dot={styles[friend.status]}
			discord={friend.discord}
		>
			{canJoin && friend.lobbyId ? (
				<Button onClick={() => friend.lobbyId && joinFriend(friend.lobbyId)}>
					{t.friends.join}
				</Button>
			) : null}
			{canInvite ? (
				<Button
					variant="secondary"
					disabled={
						invited || friend.status === "offline" || friend.status === "match"
					}
					onClick={() => inviteFriend(friend.accountId, setInvited)}
				>
					{invited ? t.friends.invited : t.friends.invite}
				</Button>
			) : null}
			{friend.codeFriend ? (
				<Button
					variant="ghost"
					onClick={() => {
						if (confirming) {
							removeFriend(friend.accountId);
						}
						setConfirming(!confirming);
					}}
					onBlur={() => setConfirming(false)}
				>
					{confirming ? t.friends.removeConfirm : t.friends.remove}
				</Button>
			) : null}
		</Person>
	);
}

export function FriendsModal({ onClose }: { onClose: () => void }) {
	const t = useT();
	const status = useStore(accountStore, (state) => state.status);
	const overview = useStore(friendsStore, (state) => state.overview);
	const lobby = useStore(lobbyStore, (state) => state.lobby);
	const [code, setCode] = useState("");

	useEffect(() => {
		refreshFriends();
		const timer = window.setInterval(refreshFriends, REFRESH_MS);
		return () => window.clearInterval(timer);
	}, []);

	if (status !== "signed-in") {
		return (
			<Modal title={t.friends.title} onClose={onClose}>
				<p className={styles.prompt}>{t.friends.signInPrompt}</p>
				<Button wide onClick={() => openOverlay("account")}>
					{t.friends.signIn}
				</Button>
			</Modal>
		);
	}

	const canInvite =
		lobby !== null &&
		(lobby.phase === "waiting" || lobby.phase === "countdown");
	const canInviteOnDiscord =
		canInvite &&
		lobby.players.length < lobby.capacity &&
		(lobby.visibility === "public" || lobby.openToFriends);
	const canJoin =
		lobby === null || (lobby.phase !== "loading" && lobby.phase !== "playing");
	const knownOnDiscord = new Set(
		(overview?.friends ?? []).flatMap((friend) =>
			friend.discordId ? [friend.discordId] : [],
		),
	);
	const submit = (event: FormEvent) => {
		event.preventDefault();
		const normalized = normalizeFriendCode(code);
		if (!normalized) {
			return;
		}
		addFriend(normalized, (ok) => {
			if (ok) {
				setCode("");
				showToast(t.friends.requestSent, "info");
			}
		});
	};
	const copy = async () => {
		if (!overview) {
			return;
		}
		try {
			await navigator.clipboard.writeText(overview.friendCode);
			showToast(t.friends.copied, "info");
		} catch {}
	};

	return (
		<Modal title={t.friends.title} onClose={onClose}>
			<div className={styles.panel}>
				<div className={styles.own}>
					<button
						type="button"
						className={styles.code}
						onClick={copy}
						title={t.friends.copyCode}
						data-selectable=""
					>
						<span className={styles.codeLabel}>{t.friends.myCode}</span>
						<span className={styles.codeValue}>
							{overview?.friendCode ?? "········"}
						</span>
						<Icon name="copy" />
					</button>
					<Checkbox
						checked={overview?.appearOffline ?? false}
						disabled={!overview}
						onChange={setAppearOffline}
						label={t.friends.appearOffline}
						hint={t.friends.appearOfflineHint}
					/>
				</div>

				<DiscordPanel synced={knownOnDiscord.size} />

				<form className={styles.add} onSubmit={submit}>
					<input
						className={styles.addInput}
						value={code}
						placeholder={t.friends.addPlaceholder}
						aria-label={t.friends.addLabel}
						maxLength={FRIEND_CODE_LENGTH}
						onChange={(event) =>
							setCode(
								event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
							)
						}
						spellCheck={false}
						autoComplete="off"
						data-selectable=""
					/>
					<Button
						variant="secondary"
						type="submit"
						disabled={!normalizeFriendCode(code)}
					>
						{t.friends.add}
					</Button>
				</form>

				{overview && overview.incoming.length > 0 ? (
					<section>
						<h3 className={styles.heading}>{t.friends.requests}</h3>
						<ul className={styles.list}>
							{overview.incoming.map((person) => (
								<Person key={person.accountId} person={person}>
									<Button
										onClick={() => respondToFriend(person.accountId, true)}
									>
										{t.friends.accept}
									</Button>
									<Button
										variant="ghost"
										onClick={() => respondToFriend(person.accountId, false)}
									>
										{t.friends.decline}
									</Button>
								</Person>
							))}
						</ul>
					</section>
				) : null}

				<section>
					<h3 className={styles.heading}>
						{t.friends.list(overview?.friends.length ?? 0)}
					</h3>
					{overview && overview.friends.length > 0 ? (
						<ul className={styles.list}>
							{overview.friends.map((friend) => (
								<Friend
									key={friend.accountId}
									friend={friend}
									canInvite={canInvite}
									canJoin={canJoin}
								/>
							))}
						</ul>
					) : (
						<p className={styles.empty}>{t.friends.empty}</p>
					)}
				</section>

				<DiscordFriendsSection
					known={knownOnDiscord}
					canInvite={canInviteOnDiscord}
				/>

				{overview && overview.outgoing.length > 0 ? (
					<section>
						<h3 className={styles.heading}>{t.friends.sent}</h3>
						<ul className={styles.list}>
							{overview.outgoing.map((person) => (
								<Person key={person.accountId} person={person}>
									<Button
										variant="ghost"
										onClick={() => removeFriend(person.accountId)}
									>
										{t.friends.cancel}
									</Button>
								</Person>
							))}
						</ul>
					</section>
				) : null}
			</div>
		</Modal>
	);
}
