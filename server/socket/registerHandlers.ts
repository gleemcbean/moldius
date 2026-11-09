import type { Server, Socket } from "socket.io";
import { OCCULT_IDS, type OccultId } from "../../shared/config/index.js";
import { sanitizeDevModes } from "../../shared/devModes.js";
import { type HatPattern, isHatPattern } from "../../shared/hatPatterns.js";
import { layoutChecksum } from "../../shared/manor/generateManor.js";
import { isPlayerColor } from "../../shared/playerColors.js";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "../../shared/protocol/events.js";
import type {
	IceServerConfig,
	LobbyError,
	LookPreference,
} from "../../shared/protocol/lobby.js";
import {
	allowedTagline,
	hatUnlocked,
	isLanternTint,
	type LanternTint,
	lanternUnlocked,
} from "../../shared/rewards.js";
import type { FriendStore } from "../accounts/FriendStore.js";
import { normalizeLobbyCode } from "../lobby/codes.js";
import type { LobbyManager } from "../lobby/LobbyManager.js";
import {
	DEFAULT_RATE_RULE,
	RateLimiter,
	SOCKET_RATE_RULES,
} from "../net/rateLimiter.js";
import {
	finiteNumber,
	isRecord,
	parseCast,
	parseClientState,
	parseInteract,
	parseVoiceRelay,
	parseVoiceSignal,
	sanitizeName,
	sanitizeToken,
} from "../net/validation.js";
import type {
	Session,
	SessionAccount,
	SessionRegistry,
} from "../sessions/SessionRegistry.js";
import type { SpeechService } from "../speech/SpeechService.js";
import {
	accountPresenceChanged,
	registerFriendHandlers,
} from "./friendHandlers.js";
import { registerSpeechHandlers } from "./speechHandlers.js";

type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface HandlerDependencies {
	io: GameServer;
	sessions: SessionRegistry;
	lobbies: LobbyManager;
	iceServers: IceServerConfig[];
	clock: () => number;
	dev?: boolean;
	identify?: (
		cookieHeader: string | undefined,
	) => Promise<SessionAccount | null>;
	friends?: () => FriendStore | null;
	speech?: SpeechService | null;
}

const INVALID: LobbyError = {
	code: "invalid-request",
	message: "Requête invalide.",
};
const RATE_LIMITED: LobbyError = {
	code: "rate-limited",
	message: "Trop de requêtes, patientez un instant.",
};
const NO_SESSION: LobbyError = {
	code: "invalid-request",
	message: "Session absente : rechargez la page.",
};

function preferredColor(payload: unknown): number | null {
	return isRecord(payload) && isPlayerColor(payload.color)
		? payload.color
		: null;
}

/** Un motif verrouillé est ignoré : la récompense se gagne, elle ne se réclame pas. */
function preferredPattern(
	payload: unknown,
	session: Session,
): HatPattern | null {
	return isRecord(payload) &&
		isHatPattern(payload.pattern) &&
		hatUnlocked(payload.pattern, session.account?.progress ?? null)
		? payload.pattern
		: null;
}

function preferredLantern(
	payload: unknown,
	session: Session,
): LanternTint | null {
	return isRecord(payload) &&
		isLanternTint(payload.lantern) &&
		lanternUnlocked(payload.lantern, session.account?.progress ?? null)
		? payload.lantern
		: null;
}

function preferredLook(payload: unknown, session: Session): LookPreference {
	return {
		color: preferredColor(payload),
		pattern: preferredPattern(payload, session),
		lantern: preferredLantern(payload, session),
		tagline: allowedTagline(
			isRecord(payload) ? payload.tagline : null,
			session.account?.progress ?? null,
		),
	};
}

export function registerSocketHandlers(
	dependencies: HandlerDependencies,
): void {
	dependencies.io.on("connection", (socket) =>
		handleConnection(socket, dependencies),
	);
}

function handleConnection(socket: GameSocket, deps: HandlerDependencies): void {
	const limiter = new RateLimiter(SOCKET_RATE_RULES, DEFAULT_RATE_RULE);
	const allow = (event: string) => limiter.allow(event, deps.clock());
	const session = (): Session | null => deps.sessions.fromSocket(socket.id);
	const identity = deps.identify
		? deps.identify(socket.handshake.headers.cookie).catch(() => null)
		: Promise.resolve(null);

	socket.on("session:hello", async (payload, ack) => {
		if (typeof ack !== "function" || !allow("session:hello")) {
			return;
		}
		const token = isRecord(payload)
			? sanitizeToken(payload.sessionToken)
			: null;
		const account = await identity;
		if (!socket.connected) {
			return;
		}
		const current = deps.sessions.hello(socket.id, token);
		current.account = account
			? {
					accountId: account.accountId,
					tokenHash: account.tokenHash,
					progress: account.progress,
				}
			: null;
		ack({
			ok: true,
			value: {
				playerId: current.playerId,
				sessionToken: current.token,
				iceServers: deps.iceServers,
				dev: deps.dev ?? false,
			},
		});
		deps.lobbies.handleReconnect(current);
		if (current.account) {
			accountPresenceChanged(deps, current.account.accountId);
		}
	});

	socket.on("lobby:peekPublic", (ack) => {
		if (typeof ack !== "function") {
			return;
		}
		ack(
			allow("lobby:peek")
				? { ok: true, value: deps.lobbies.publicPreview() }
				: { ok: false, error: RATE_LIMITED },
		);
	});

	socket.on("lobby:joinPublic", (payload, ack) => {
		respond(ack, allow("lobby:join"), session(), (current) => {
			const name = isRecord(payload) ? sanitizeName(payload.name) : null;
			if (!name) {
				return {
					ok: false,
					error: {
						code: "invalid-name",
						message: "Choisissez un pseudonyme de 2 à 18 caractères.",
					},
				};
			}
			const lobbyId =
				isRecord(payload) && typeof payload.lobbyId === "string"
					? payload.lobbyId
					: "";
			return deps.lobbies.joinPublic(
				current,
				name,
				lobbyId,
				preferredLook(payload, current),
			);
		});
	});

	socket.on("lobby:quickJoin", (payload, ack) => {
		respond(ack, allow("lobby:join"), session(), (current) => {
			const name = isRecord(payload) ? sanitizeName(payload.name) : null;
			if (!name) {
				return {
					ok: false,
					error: {
						code: "invalid-name",
						message: "Choisissez un pseudonyme de 2 à 18 caractères.",
					},
				};
			}
			return deps.lobbies.quickJoin(
				current,
				name,
				preferredLook(payload, current),
			);
		});
	});

	socket.on("lobby:createPrivate", (payload, ack) => {
		respond(ack, allow("lobby:join"), session(), (current) => {
			const name = isRecord(payload) ? sanitizeName(payload.name) : null;
			if (!name) {
				return {
					ok: false,
					error: {
						code: "invalid-name",
						message: "Choisissez un pseudonyme de 2 à 18 caractères.",
					},
				};
			}
			return deps.lobbies.createPrivate(
				current,
				name,
				preferredLook(payload, current),
			);
		});
	});

	socket.on("lobby:createDaily", (payload, ack) => {
		respond(ack, allow("lobby:join"), session(), (current) => {
			const name = isRecord(payload) ? sanitizeName(payload.name) : null;
			if (!name) {
				return {
					ok: false,
					error: {
						code: "invalid-name",
						message: "Choisissez un pseudonyme de 2 à 18 caractères.",
					},
				};
			}
			return deps.lobbies.createDaily(
				current,
				name,
				preferredLook(payload, current),
			);
		});
	});

	socket.on("lobby:joinPrivate", (payload, ack) => {
		respond(ack, allow("lobby:join"), session(), (current) => {
			const name = isRecord(payload) ? sanitizeName(payload.name) : null;
			const code = isRecord(payload) ? normalizeLobbyCode(payload.code) : null;
			if (!name) {
				return {
					ok: false,
					error: {
						code: "invalid-name",
						message: "Choisissez un pseudonyme de 2 à 18 caractères.",
					},
				};
			}
			if (!code) {
				return {
					ok: false,
					error: {
						code: "not-found",
						message: "Le code doit contenir 5 caractères.",
					},
				};
			}
			return deps.lobbies.joinPrivate(
				current,
				name,
				code,
				preferredLook(payload, current),
			);
		});
	});

	socket.on("lobby:startTutorial", (payload, ack) => {
		respond(ack, allow("lobby:join"), session(), (current) => {
			const name = isRecord(payload) ? sanitizeName(payload.name) : null;
			if (!name) {
				return {
					ok: false,
					error: {
						code: "invalid-name",
						message: "Choisissez un pseudonyme de 2 à 18 caractères.",
					},
				};
			}
			return deps.lobbies.startTutorial(
				current,
				name,
				preferredLook(payload, current),
			);
		});
	});

	socket.on("lobby:leave", () => {
		const current = session();
		if (current && allow("lobby:leave")) {
			deps.lobbies.leave(current);
		}
	});

	socket.on("lobby:ready", (payload) => {
		const current = session();
		if (
			current &&
			allow("lobby:ready") &&
			isRecord(payload) &&
			typeof payload.ready === "boolean"
		) {
			deps.lobbies.setReady(current, payload.ready);
		}
	});

	socket.on("lobby:microphone", (payload) => {
		const current = session();
		if (
			current &&
			allow("lobby:microphone") &&
			isRecord(payload) &&
			typeof payload.ready === "boolean"
		) {
			deps.lobbies.setMicrophone(current, payload.ready);
		}
	});

	socket.on("lobby:config", (payload, ack) => {
		respond(ack, allow("lobby:config"), session(), (current) => {
			if (!isRecord(payload)) {
				return { ok: false, error: INVALID };
			}
			return deps.lobbies.updateConfig(current, payload.config);
		});
	});

	socket.on("lobby:team", (payload) => {
		const current = session();
		if (
			current &&
			allow("lobby:team") &&
			isRecord(payload) &&
			typeof payload.team === "number"
		) {
			deps.lobbies.setTeam(current, payload.team);
		}
	});

	socket.on("lobby:start", (ack) => {
		respond(ack, allow("lobby:start"), session(), (current) => {
			const error = deps.lobbies.start(current);
			return error ? { ok: false, error } : { ok: true, value: null };
		});
	});

	socket.on("game:radio", (payload) => {
		const current = session();
		if (
			current &&
			allow("game:radio") &&
			isRecord(payload) &&
			typeof payload.on === "boolean"
		) {
			deps.lobbies.matchOf(current)?.handleRadio(current.playerId, payload.on);
		}
	});

	socket.on("voice:signal", (payload) => {
		const current = session();
		const envelope = parseVoiceSignal(payload);
		if (!current || !envelope || !allow("voice:signal")) {
			return;
		}
		const target = deps.lobbies.relayVoice(current, envelope.peerId);
		if (target) {
			deps.io.to(target).emit("voice:signal", {
				peerId: current.playerId,
				signal: envelope.signal,
			});
		}
	});

	socket.on("voice:relay", (payload) => {
		const current = session();
		const relay = parseVoiceRelay(payload);
		if (!current || !relay || !allow("voice:relay")) {
			return;
		}
		for (const peerId of new Set(relay.peerIds)) {
			const target = deps.lobbies.relayVoice(current, peerId);
			if (target) {
				deps.io.to(target).volatile.emit("voice:relay", {
					peerId: current.playerId,
					data: relay.data as unknown as ArrayBuffer,
				});
			}
		}
	});

	socket.on("time:ping", (payload) => {
		const clientTime = isRecord(payload)
			? finiteNumber(payload.clientTime, 0, 1e13)
			: null;
		if (clientTime !== null && allow("time:ping")) {
			socket.emit("time:pong", { clientTime, serverTime: deps.clock() });
		}
	});

	registerGameHandlers(socket, deps, session, allow);
	registerFriendHandlers(socket, deps, session, allow);
	if (deps.speech) {
		registerSpeechHandlers(socket, deps.speech, session, allow);
	}

	socket.on("disconnect", () => {
		const current = deps.sessions.detach(socket.id, deps.clock());
		if (current && !current.socketId) {
			deps.lobbies.handleDisconnect(current);
			if (current.account) {
				accountPresenceChanged(deps, current.account.accountId);
			}
		}
	});
}

function registerGameHandlers(
	socket: GameSocket,
	deps: HandlerDependencies,
	session: () => Session | null,
	allow: (event: string) => boolean,
): void {
	const withMatch = (
		event: string,
		handler: (
			current: Session,
			match: NonNullable<ReturnType<LobbyManager["matchOf"]>>,
		) => void,
	) => {
		if (!allow(event)) {
			return;
		}
		const current = session();
		const match = current ? deps.lobbies.matchOf(current) : null;
		if (current && match?.players.has(current.playerId)) {
			handler(current, match);
		}
	};

	socket.on("game:loaded", (payload) => {
		withMatch("game:loaded", (current, match) => {
			if (isRecord(payload) && payload.matchId === match.id) {
				match.playerLoaded(current.playerId);
			}
		});
	});

	socket.on("game:layoutRequest", (payload) => {
		withMatch("game:layoutRequest", (_current, match) => {
			if (isRecord(payload) && payload.matchId === match.id) {
				socket.emit("game:layout", {
					matchId: match.id,
					layoutJson: JSON.stringify(match.layout),
				});
				if (layoutChecksum(match.layout) !== match.checksum) {
					socket.emit("game:aborted", { reason: "layout-mismatch" });
				}
			}
		});
	});

	socket.on("game:state", (payload) => {
		withMatch("game:state", (current, match) => {
			const message = parseClientState(payload);
			if (message) {
				match.handleClientState(current.playerId, message);
			}
		});
	});

	socket.on("game:lantern", (payload) => {
		withMatch("game:lantern", (current, match) => {
			if (isRecord(payload) && typeof payload.open === "boolean") {
				match.handleLantern(current.playerId, payload.open);
			}
		});
	});

	socket.on("game:interact", (payload) => {
		withMatch("game:interact", (current, match) => {
			const request = parseInteract(payload);
			if (request) {
				match.handleInteract(current.playerId, request);
			}
		});
	});

	socket.on("game:castBegin", () => {
		withMatch("game:castBegin", (current, match) =>
			match.handleCastBegin(current.playerId),
		);
	});

	socket.on("game:castCancel", () => {
		withMatch("game:castCancel", (current, match) =>
			match.handleCastCancel(current.playerId),
		);
	});

	socket.on("game:cast", (payload) => {
		withMatch("game:cast", (current, match) => {
			const request = parseCast(payload);
			if (request) {
				match.handleCast(current.playerId, request);
			}
		});
	});

	socket.on("game:push", (payload) => {
		withMatch("game:push", (current, match) => {
			const yaw = isRecord(payload)
				? finiteNumber(payload.yaw, -100, 100)
				: null;
			if (yaw !== null) {
				match.handlePush(current.playerId, yaw);
			}
		});
	});

	socket.on("game:craft", (payload) => {
		withMatch("game:craft", (current, match) => {
			const altarId = isRecord(payload)
				? finiteNumber(payload.altarId, 0, 1000)
				: null;
			const object = isRecord(payload) ? payload.object : null;
			if (
				altarId !== null &&
				(OCCULT_IDS as readonly unknown[]).includes(object)
			) {
				match.handleCraft(current.playerId, altarId, object as OccultId);
			}
		});
	});

	socket.on("game:tutorialSummon", () => {
		withMatch("game:tutorialSummon", (current, match) =>
			match.handleTutorialSummon(current.playerId),
		);
	});

	socket.on("game:tutorialWound", () => {
		withMatch("game:tutorialWound", (current, match) =>
			match.handleTutorialWound(current.playerId),
		);
	});

	socket.on("game:shout", () => {
		withMatch("game:shout", (current, match) =>
			match.handleShout(current.playerId),
		);
	});

	socket.on("game:devModes", (payload) => {
		withMatch("game:devModes", (current, match) =>
			match.handleDevModes(current.playerId, sanitizeDevModes(payload)),
		);
	});

	socket.on("game:leave", () => {
		const current = session();
		if (current && allow("game:leave")) {
			deps.lobbies.leave(current);
		}
	});
}

type AckResult<T> = { ok: true; value: T } | { ok: false; error: LobbyError };

function respond<T>(
	ack: ((response: AckResult<T>) => void) | undefined,
	allowed: boolean,
	current: Session | null,
	action: (session: Session) => AckResult<T>,
): void {
	if (typeof ack !== "function") {
		return;
	}
	if (!allowed) {
		ack({ ok: false, error: RATE_LIMITED });
		return;
	}
	if (!current) {
		ack({ ok: false, error: NO_SESSION });
		return;
	}
	ack(action(current));
}
