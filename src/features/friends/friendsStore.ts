import type { FriendInvite, FriendsOverview } from "@shared/protocol/friends";
import type { LobbyError, LobbyErrorCode } from "@shared/protocol/lobby";
import { appStore, closeOverlay, showToast } from "../../app/appStore";
import { currentMessages } from "../../i18n";
import { createStore } from "../../utils/store";
import { accountStore } from "../account/accountStore";
import {
	joinFriendLobby,
	joinPrivateLobby,
	joinPublicLobby,
} from "../lobby/lobbyClient";
import { sessionStore } from "../network/sessionStore";
import { getSocket } from "../network/socket";
import { settingsStore } from "../settings/settingsStore";

const INVITE_LIFETIME_MS = 60_000;

export const friendsStore = createStore<{
	overview: FriendsOverview | null;
	invites: FriendInvite[];
}>({ overview: null, invites: [] });

type Reply<T> = { ok: true; value: T } | { ok: false; error: LobbyError };

function reportError(error: LobbyError): void {
	showToast(
		currentMessages().lobby.errors[error.code] ?? error.message,
		"error",
	);
}

function applyOverview(reply: Reply<FriendsOverview>, silent = false): boolean {
	if (reply.ok) {
		friendsStore.set({ overview: reply.value });
		return true;
	}
	if (reply.error.code === "sign-in-required") {
		friendsStore.set({ overview: null });
	}
	if (!silent) {
		reportError(reply.error);
	}
	return false;
}

export function refreshFriends(): void {
	if (
		accountStore.get().status !== "signed-in" ||
		sessionStore.get().status !== "connected"
	) {
		if (accountStore.get().status !== "signed-in") {
			friendsStore.set({ overview: null, invites: [] });
		}
		return;
	}
	getSocket().emit("friends:list", (reply) => applyOverview(reply, true));
}

export function addFriend(code: string, done: (ok: boolean) => void): void {
	getSocket().emit("friends:add", { code }, (reply) =>
		done(applyOverview(reply)),
	);
}

export function respondToFriend(accountId: string, accept: boolean): void {
	getSocket().emit("friends:respond", { accountId, accept }, (reply) =>
		applyOverview(reply),
	);
}

export function removeFriend(accountId: string): void {
	getSocket().emit("friends:remove", { accountId }, (reply) =>
		applyOverview(reply),
	);
}

export function setAppearOffline(offline: boolean): void {
	getSocket().emit("friends:setOffline", { offline }, (reply) =>
		applyOverview(reply),
	);
}

export function inviteFriend(
	accountId: string,
	done: (ok: boolean) => void,
): void {
	getSocket().emit("friends:invite", { accountId }, (reply) => {
		if (!reply.ok) {
			reportError(reply.error);
		}
		refreshFriends();
		done(reply.ok);
	});
}

export function syncDiscordFriends(
	discordId: string,
	friendIds: string[],
	done: (error: LobbyErrorCode | null) => void,
): void {
	getSocket().emit("friends:discordSync", { discordId, friendIds }, (reply) => {
		applyOverview(reply, true);
		done(reply.ok ? null : reply.error.code);
	});
}

export function joinFriend(lobbyId: string): void {
	if (appStore.get().overlay === "friends") {
		closeOverlay();
	}
	joinFriendLobby(settingsStore.get().playerName.trim(), lobbyId);
}

export function dismissInvite(invite: FriendInvite): void {
	friendsStore.set({
		invites: friendsStore.get().invites.filter((entry) => entry !== invite),
	});
}

export function acceptInvite(invite: FriendInvite): void {
	const name = settingsStore.get().playerName.trim();
	friendsStore.set({ invites: [] });
	if (appStore.get().overlay === "friends") {
		closeOverlay();
	}
	if (invite.code) {
		joinPrivateLobby(name, invite.code);
	} else {
		joinPublicLobby(name, invite.lobbyId);
	}
}

let initialized = false;

export function initFriends(): void {
	if (initialized) {
		return;
	}
	initialized = true;
	const socket = getSocket();
	socket.on("friends:changed", refreshFriends);
	socket.on("friends:invited", (invite) => {
		const others = friendsStore
			.get()
			.invites.filter((entry) => entry.fromAccountId !== invite.fromAccountId);
		friendsStore.set({ invites: [...others, invite] });
		window.setTimeout(() => dismissInvite(invite), INVITE_LIFETIME_MS);
	});
	let previous = "";
	const onChange = () => {
		const key = `${accountStore.get().status}|${sessionStore.get().status}|${sessionStore.get().playerId}`;
		if (key !== previous) {
			previous = key;
			refreshFriends();
		}
	};
	accountStore.subscribe(onChange);
	sessionStore.subscribe(onChange);
	onChange();
}
