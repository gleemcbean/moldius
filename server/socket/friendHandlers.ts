import type { Socket } from "socket.io";
import type {
	Ack,
	ClientToServerEvents,
	ServerToClientEvents,
} from "../../shared/protocol/events.js";
import {
	DISCORD_FRIEND_LIMIT,
	type FriendStatus,
	type FriendsOverview,
	isDiscordId,
	normalizeFriendCode,
} from "../../shared/protocol/friends.js";
import type {
	LobbyError,
	LobbyErrorCode,
} from "../../shared/protocol/lobby.js";
import type { FriendStore } from "../accounts/FriendStore.js";
import { isRecord } from "../net/validation.js";
import type { Session } from "../sessions/SessionRegistry.js";
import type { HandlerDependencies } from "./registerHandlers.js";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type Result<T> = { ok: true; value: T } | { ok: false; error: LobbyError };

const MESSAGES: Partial<Record<LobbyErrorCode, string>> = {
	"sign-in-required": "Connectez-vous à un compte pour utiliser les amis.",
	"friend-not-found": "Aucun joueur ne correspond à ce code ami.",
	"friend-self": "C'est votre propre code ami.",
	"friend-exists": "Ce joueur est déjà ami ou a déjà reçu votre demande.",
	"friend-limit": "Votre liste d'amis est pleine.",
	"friend-offline": "Cet ami n'est pas en ligne.",
	"friend-busy": "Cet ami est déjà en partie ou dans ce lobby.",
	"lobby-not-invitable": "Rejoignez un lobby en attente pour inviter un ami.",
	"discord-not-linked":
		"Liez votre compte Discord à votre compte de jeu pour synchroniser vos amis.",
	"discord-mismatch":
		"Ce compte Discord n'est pas celui lié à votre compte de jeu.",
	"invalid-request": "Requête invalide : rechargez la page.",
	"rate-limited": "Trop de requêtes, patientez un instant.",
};

function failure(code: LobbyErrorCode): { ok: false; error: LobbyError } {
	return { ok: false, error: { code, message: MESSAGES[code] ?? code } };
}

export function friendStatus(
	deps: HandlerDependencies,
	accountId: string,
): FriendStatus {
	const sessions = deps.sessions
		.withAccount(accountId)
		.filter((session) => session.socketId !== null);
	if (sessions.length === 0) {
		return "offline";
	}
	if (sessions.some((session) => deps.lobbies.matchOf(session))) {
		return "match";
	}
	return sessions.some((session) => deps.lobbies.lobbyOf(session))
		? "lobby"
		: "online";
}

function emitChanged(deps: HandlerDependencies, accountId: string): void {
	for (const session of deps.sessions.withAccount(accountId)) {
		if (session.socketId) {
			deps.io.to(session.socketId).emit("friends:changed");
		}
	}
}

async function notifyFriends(
	deps: HandlerDependencies,
	store: FriendStore,
	accountId: string,
): Promise<void> {
	for (const friend of await store.friendIds(accountId)) {
		emitChanged(deps, friend);
	}
}

async function overviewOf(
	deps: HandlerDependencies,
	store: FriendStore,
	accountId: string,
): Promise<FriendsOverview | null> {
	const identity = await store.identity(accountId);
	if (!identity) {
		return null;
	}
	const links = await store.links(accountId);
	const accepted = new Set(
		links.filter((link) => link.accepted).map((link) => link.accountId),
	);
	const person = ({
		accountId: id,
		name,
		color,
		pattern,
		tagline,
	}: (typeof links)[number]) => ({
		accountId: id,
		name,
		color,
		pattern,
		tagline,
	});
	return {
		friendCode: identity.friendCode,
		appearOffline: identity.appearOffline,
		discordId: identity.discordId,
		discordSynced: identity.discordSynced,
		friends: links
			.filter((link) => link.accepted)
			.map((link) => ({
				...person(link),
				status: link.appearOffline
					? ("offline" as const)
					: friendStatus(deps, link.accountId),
				codeFriend: link.codeFriend,
				discord: link.discord,
				discordId: link.discordId,
				lobbyId: link.appearOffline
					? null
					: deps.lobbies.friendJoinTarget(link.accountId, accountId, accepted),
			})),
		incoming: links
			.filter((link) => !link.accepted && !link.requestedByMe)
			.map(person),
		outgoing: links
			.filter((link) => !link.accepted && link.requestedByMe)
			.map(person),
	};
}

export function notifyFriendsOf(
	deps: HandlerDependencies,
	accountId: string,
): void {
	const store = deps.friends?.();
	if (!store) {
		return;
	}
	void notifyFriends(deps, store, accountId).catch((error: unknown) =>
		console.error("Amis : notification impossible", error),
	);
}

export function accountPresenceChanged(
	deps: HandlerDependencies,
	accountId: string,
): void {
	const store = deps.friends?.();
	if (!store) {
		return;
	}
	void store
		.touchLastSeen(accountId)
		.then(() => notifyFriends(deps, store, accountId))
		.catch((error: unknown) =>
			console.error("Amis : présence non mise à jour", error),
		);
}

export function registerFriendHandlers(
	socket: GameSocket,
	deps: HandlerDependencies,
	session: () => Session | null,
	allow: (event: string) => boolean,
): void {
	const run = async <T>(
		ack: Ack<T>,
		rule: string,
		handler: (
			store: FriendStore,
			accountId: string,
			current: Session,
		) => Promise<Result<T>>,
	): Promise<void> => {
		if (typeof ack !== "function") {
			return;
		}
		if (!allow(rule)) {
			ack(failure("rate-limited"));
			return;
		}
		const current = session();
		const store = deps.friends?.() ?? null;
		const accountId = current?.account?.accountId;
		if (!current || !store || !accountId) {
			ack(failure("sign-in-required"));
			return;
		}
		try {
			ack(await handler(store, accountId, current));
		} catch (error) {
			console.error("Amis : requête impossible", error);
			ack(failure("invalid-request"));
		}
	};
	const overview = async (
		store: FriendStore,
		accountId: string,
	): Promise<Result<FriendsOverview>> => {
		const value = await overviewOf(deps, store, accountId);
		return value ? { ok: true, value } : failure("sign-in-required");
	};
	const otherAccount = (payload: unknown): string | null =>
		isRecord(payload) &&
		typeof payload.accountId === "string" &&
		payload.accountId.length <= 64
			? payload.accountId
			: null;

	socket.on("friends:list", (ack) => {
		void run(ack, "friends:list", (store, accountId) =>
			overview(store, accountId),
		);
	});

	socket.on("friends:add", (payload, ack) => {
		void run(ack, "friends:write", async (store, accountId) => {
			const code = isRecord(payload) ? normalizeFriendCode(payload.code) : null;
			if (!code) {
				return failure("friend-not-found");
			}
			const added = await store.add(accountId, code);
			if (!added.ok) {
				const codes = {
					unknown: "friend-not-found",
					self: "friend-self",
					exists: "friend-exists",
					limit: "friend-limit",
				} as const;
				return failure(codes[added.reason]);
			}
			emitChanged(deps, added.accountId);
			return overview(store, accountId);
		});
	});

	socket.on("friends:respond", (payload, ack) => {
		void run(ack, "friends:write", async (store, accountId) => {
			const other = otherAccount(payload);
			if (!other || !isRecord(payload)) {
				return failure("invalid-request");
			}
			if (payload.accept === true) {
				await store.accept(accountId, other);
			} else {
				const links = await store.links(accountId);
				const link = links.find((entry) => entry.accountId === other);
				if (link && !link.accepted && !link.requestedByMe) {
					await store.remove(accountId, other);
				}
			}
			emitChanged(deps, other);
			return overview(store, accountId);
		});
	});

	socket.on("friends:remove", (payload, ack) => {
		void run(ack, "friends:write", async (store, accountId) => {
			const other = otherAccount(payload);
			if (!other) {
				return failure("invalid-request");
			}
			await store.remove(accountId, other);
			emitChanged(deps, other);
			return overview(store, accountId);
		});
	});

	socket.on("friends:setOffline", (payload, ack) => {
		void run(ack, "friends:write", async (store, accountId) => {
			if (!isRecord(payload) || typeof payload.offline !== "boolean") {
				return failure("invalid-request");
			}
			await store.setAppearOffline(accountId, payload.offline);
			await notifyFriends(deps, store, accountId);
			return overview(store, accountId);
		});
	});

	socket.on("friends:discordSync", (payload, ack) => {
		void run(ack, "friends:sync", async (store, accountId) => {
			if (
				!isRecord(payload) ||
				!isDiscordId(payload.discordId) ||
				!Array.isArray(payload.friendIds) ||
				payload.friendIds.length > DISCORD_FRIEND_LIMIT * 2
			) {
				return failure("invalid-request");
			}
			const friendIds = payload.friendIds.filter(isDiscordId);
			const synced = await store.syncDiscord(
				accountId,
				payload.discordId,
				friendIds,
			);
			if (!synced.ok) {
				return failure(
					synced.reason === "mismatch"
						? "discord-mismatch"
						: "discord-not-linked",
				);
			}
			for (const other of synced.touched) {
				emitChanged(deps, other);
			}
			return overview(store, accountId);
		});
	});

	socket.on("friends:invite", (payload, ack) => {
		void run(ack, "friends:invite", async (store, accountId, current) => {
			const other = otherAccount(payload);
			if (!other) {
				return failure("invalid-request");
			}
			const lobby = deps.lobbies.lobbyOf(current);
			if (!lobby?.acceptsPlayers) {
				return failure("lobby-not-invitable");
			}
			const links = await store.links(accountId);
			const friend = links.find(
				(link) => link.accountId === other && link.accepted,
			);
			if (!friend) {
				return failure("friend-not-found");
			}
			const status = friend.appearOffline
				? "offline"
				: friendStatus(deps, other);
			if (status === "offline") {
				return failure("friend-offline");
			}
			const targets = deps.sessions
				.withAccount(other)
				.filter((target) => target.socketId !== null);
			if (
				status === "match" ||
				targets.some((target) => target.lobbyId === lobby.id)
			) {
				return failure("friend-busy");
			}
			const identity = await store.identity(accountId);
			for (const target of targets) {
				if (target.socketId) {
					deps.io.to(target.socketId).emit("friends:invited", {
						fromAccountId: accountId,
						fromName: identity?.name ?? current.name ?? "?",
						lobbyId: lobby.id,
						code: lobby.code,
					});
				}
			}
			return { ok: true, value: null };
		});
	});
}
