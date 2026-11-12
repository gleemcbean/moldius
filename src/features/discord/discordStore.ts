import { lobbyFromJoinSecret, lobbyJoinSecret } from "@shared/protocol/friends";
import type { LobbyErrorCode, LobbyState } from "@shared/protocol/lobby";
import {
	type DiscordActivity,
	type DiscordBridgeState,
	desktopApp,
} from "../../app/desktopApp";
import { appStore, showToast } from "../../app/appStore";
import { currentMessages } from "../../i18n";
import { createStore } from "../../utils/store";
import { accountStore } from "../account/accountStore";
import { joinFriend, syncDiscordFriends } from "../friends/friendsStore";
import { lobbyStore } from "../lobby/lobbyStore";
import { sessionStore } from "../network/sessionStore";

const SYNC_DELAY_MS = 2000;
const PRESENCE_INTERVAL_MS = 4000;
const JOIN_WAIT_MS = 30_000;
const SYNC_WAIT_MS = 8000;
const SYNC_POLL_MS = 250;

export interface DiscordStoreState extends DiscordBridgeState {
	syncError: LobbyErrorCode | null;
}

const bridge = desktopApp?.discord ?? null;

export const discordSupported = bridge !== null;

export const discordStore = createStore<DiscordStoreState>({
	available: false,
	status: "unavailable",
	error: null,
	user: null,
	friends: [],
	syncError: null,
});

export function connectDiscord(): void {
	bridge?.connect();
}

export function disconnectDiscord(): void {
	bridge?.disconnect();
	discordStore.set({ syncError: null });
}

export async function inviteOnDiscord(userId: string): Promise<boolean> {
	if (!bridge) {
		return false;
	}
	const reply = await bridge.invite(
		userId,
		currentMessages().discord.inviteMessage,
	);
	return reply.ok;
}

function applyBridgeState(state: DiscordBridgeState | null): void {
	if (state) {
		discordStore.set({ ...state });
	}
}

let lastSync = "";
let syncTimer: number | null = null;
let syncInFlight = false;

function scheduleSync(): void {
	if (syncTimer === null) {
		syncTimer = window.setTimeout(runSync, SYNC_DELAY_MS);
	}
}

function runSync(): void {
	syncTimer = null;
	const { status, user, friends } = discordStore.get();
	if (
		status !== "ready" ||
		!user ||
		accountStore.get().status !== "signed-in" ||
		sessionStore.get().status !== "connected"
	) {
		return;
	}
	const ids = friends.map((friend) => friend.id).sort();
	const key = `${accountStore.get().account?.displayName ?? ""}|${sessionStore.get().playerId}|${user.id}|${ids.join(",")}`;
	if (key === lastSync) {
		return;
	}
	lastSync = key;
	syncInFlight = true;
	syncDiscordFriends(user.id, ids, (error) => {
		syncInFlight = false;
		discordStore.set({ syncError: error });
		if (error === "rate-limited") {
			lastSync = "";
			scheduleSync();
		}
	});
}

let lastPresence = "";
let lastPresenceAt = 0;
let presenceTimer: number | null = null;
let matchKey: string | null = null;
let matchStartedAt = 0;

function inMatch(lobby: LobbyState): boolean {
	return lobby.phase === "loading" || lobby.phase === "playing";
}

function joinable(lobby: LobbyState): boolean {
	return (
		(lobby.phase === "waiting" || lobby.phase === "countdown") &&
		lobby.players.length < lobby.capacity &&
		(lobby.visibility === "public" || lobby.openToFriends)
	);
}

function activityNow(): DiscordActivity {
	const t = currentMessages().discord.presence;
	const lobby = lobbyStore.get().lobby;
	if (!lobby || appStore.get().screen === "home") {
		return { details: t.menu, largeImage: "logo", largeText: "Moldius" };
	}
	const kind = lobby.daily
		? t.daily
		: lobby.visibility === "public"
			? t.public
			: lobby.openToFriends
				? t.friends
				: t.private;
	const party = {
		id: lobby.id,
		size: Math.max(1, lobby.players.length),
		max: lobby.capacity,
		public: lobby.visibility === "public",
	};
	if (inMatch(lobby)) {
		const key = lobby.matchId ?? lobby.id;
		if (key !== matchKey) {
			matchKey = key;
			matchStartedAt = Date.now();
		}
		return {
			details: kind,
			state: t.match,
			startedAt: matchStartedAt,
			largeImage: "logo",
			largeText: "Moldius",
			party,
		};
	}
	matchKey = null;
	return {
		details: kind,
		state: t.lobby,
		largeImage: "logo",
		largeText: "Moldius",
		party,
		...(joinable(lobby) ? { joinSecret: lobbyJoinSecret(lobby.id) } : {}),
	};
}

function pushPresence(): void {
	presenceTimer = null;
	const activity = activityNow();
	const key = JSON.stringify(activity);
	if (key === lastPresence) {
		return;
	}
	const wait = lastPresenceAt + PRESENCE_INTERVAL_MS - Date.now();
	if (wait > 0) {
		presenceTimer = window.setTimeout(pushPresence, wait);
		return;
	}
	lastPresence = key;
	lastPresenceAt = Date.now();
	bridge?.setPresence(activity);
}

function schedulePresence(): void {
	if (presenceTimer === null) {
		presenceTimer = window.setTimeout(pushPresence, 0);
	}
}

function whenReady(action: () => void): void {
	const ready = () =>
		accountStore.get().status !== "loading" &&
		sessionStore.get().status === "connected";
	if (ready()) {
		action();
		return;
	}
	const stop = () => {
		window.clearTimeout(timer);
		stopAccount();
		stopSession();
	};
	const check = () => {
		if (ready()) {
			stop();
			action();
		}
	};
	const timer = window.setTimeout(stop, JOIN_WAIT_MS);
	const stopAccount = accountStore.subscribe(check);
	const stopSession = sessionStore.subscribe(check);
}

function afterDiscordSync(action: () => void): void {
	const deadline = Date.now() + SYNC_WAIT_MS;
	const poll = () => {
		const { status } = discordStore.get();
		const waiting =
			status === "connecting" ||
			(status === "ready" && (syncTimer !== null || syncInFlight));
		if (waiting && Date.now() < deadline) {
			window.setTimeout(poll, SYNC_POLL_MS);
		} else {
			action();
		}
	};
	poll();
}

function handleJoin(secret: string): void {
	const lobbyId = lobbyFromJoinSecret(secret);
	if (!lobbyId) {
		return;
	}
	whenReady(() =>
		afterDiscordSync(() => {
			const current = lobbyStore.get().lobby;
			if (current?.id === lobbyId) {
				return;
			}
			if (current && inMatch(current)) {
				showToast(currentMessages().discord.joinBusy, "error");
				return;
			}
			joinFriend(lobbyId);
		}),
	);
}

let initialized = false;

export function initDiscord(): void {
	if (initialized || !bridge) {
		return;
	}
	initialized = true;
	void bridge.getState().then(applyBridgeState);
	bridge.onState(applyBridgeState);
	bridge.onJoin(handleJoin);

	let previousStatus = discordStore.get().status;
	discordStore.subscribe(() => {
		const { status } = discordStore.get();
		if (status !== previousStatus) {
			previousStatus = status;
			lastSync = "";
		}
		scheduleSync();
	});
	accountStore.subscribe(scheduleSync);
	sessionStore.subscribe(scheduleSync);

	lobbyStore.subscribe(schedulePresence);
	appStore.subscribe(schedulePresence);
	schedulePresence();
}
