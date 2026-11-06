import { randomBytes } from "node:crypto";
import type { Server } from "socket.io";
import { LOBBY_CAPACITY } from "../../shared/config/index.js";
import type { HatPattern } from "../../shared/hatPatterns.js";
import {
	TUTORIAL_MATCH_CONFIG,
	TUTORIAL_SEED,
} from "../../shared/matchConfig.js";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "../../shared/protocol/events.js";
import type { PublicLobbyPreview } from "../../shared/protocol/friends.js";
import type { MatchResults } from "../../shared/protocol/game.js";
import type { LobbyError, LobbyState } from "../../shared/protocol/lobby.js";
import type { MatchRecord } from "../accounts/AccountStore.js";
import { buildMatchRecords } from "../accounts/matchRecords.js";
import { Match, type MatchTransport } from "../game/Match.js";
import type { Session, SessionRegistry } from "../sessions/SessionRegistry.js";
import { generateLobbyCode, randomLobbyId, randomMatchSeed } from "./codes.js";
import { Lobby } from "./Lobby.js";

type GameServer = Server<ClientToServerEvents, ServerToClientEvents>;

export type LobbyResult =
	| { ok: true; value: LobbyState }
	| { ok: false; error: LobbyError };

const WAITING_DISCONNECT_GRACE_MS = 8000;
const ALREADY_PLAYING: LobbyError = {
	code: "already-playing",
	message: "Ce compte est déjà dans une partie, dans un autre onglet.",
};

export interface LobbyManagerOptions {
	minPlayers: number;
	dev?: boolean;
	onMatchRecords?: (records: MatchRecord[]) => void;
}

export class LobbyManager {
	private readonly lobbies = new Map<string, Lobby>();
	private readonly codes = new Map<string, string>();
	private readonly matches = new Map<string, Match>();
	private readonly removalTimers = new Map<string, NodeJS.Timeout>();
	private readonly countdownTimer: NodeJS.Timeout;

	constructor(
		private readonly io: GameServer,
		private readonly sessions: SessionRegistry,
		private readonly clock: () => number,
		private readonly options: LobbyManagerOptions = { minPlayers: 2 },
	) {
		this.countdownTimer = setInterval(() => this.checkCountdowns(), 250);
	}

	dispose(): void {
		clearInterval(this.countdownTimer);
		for (const match of this.matches.values()) {
			match.stop();
		}
		for (const timer of this.removalTimers.values()) {
			clearTimeout(timer);
		}
	}

	lobbyOf(session: Session): Lobby | null {
		return session.lobbyId ? (this.lobbies.get(session.lobbyId) ?? null) : null;
	}

	matchOf(session: Session): Match | null {
		const lobby = this.lobbyOf(session);
		if (!lobby?.matchId) return null;
		return this.matches.get(lobby.matchId) ?? null;
	}

	quickJoin(
		session: Session,
		name: string,
		color: number | null = null,
		pattern: HatPattern | null = null,
	): LobbyResult {
		if (this.accountBusy(session)) {
			return { ok: false, error: ALREADY_PLAYING };
		}
		this.leave(session);
		const lobby =
			[...this.lobbies.values()].find(
				(candidate) =>
					candidate.visibility === "public" && candidate.acceptsPlayers,
			) ?? this.createLobby("public");
		return this.join(session, lobby, name, color, pattern);
	}

	createPrivate(
		session: Session,
		name: string,
		color: number | null = null,
		pattern: HatPattern | null = null,
	): LobbyResult {
		if (this.accountBusy(session)) {
			return { ok: false, error: ALREADY_PLAYING };
		}
		this.leave(session);
		return this.join(
			session,
			this.createLobby("private"),
			name,
			color,
			pattern,
		);
	}

	joinPrivate(
		session: Session,
		name: string,
		code: string,
		color: number | null = null,
		pattern: HatPattern | null = null,
	): LobbyResult {
		if (this.accountBusy(session)) {
			return { ok: false, error: ALREADY_PLAYING };
		}
		const lobbyId = this.codes.get(code);
		const lobby = lobbyId ? this.lobbies.get(lobbyId) : undefined;
		if (!lobby) {
			return {
				ok: false,
				error: {
					code: "not-found",
					message: "Aucun lobby privé ne correspond à ce code.",
				},
			};
		}
		if (session.lobbyId !== lobby.id) {
			this.leave(session);
		}
		return this.join(session, lobby, name, color, pattern);
	}

	joinPublic(
		session: Session,
		name: string,
		lobbyId: string,
		color: number | null = null,
		pattern: HatPattern | null = null,
	): LobbyResult {
		if (this.accountBusy(session)) {
			return { ok: false, error: ALREADY_PLAYING };
		}
		const lobby = this.lobbies.get(lobbyId);
		if (!lobby || lobby.visibility !== "public") {
			return {
				ok: false,
				error: { code: "not-found", message: "Ce lobby n'existe plus." },
			};
		}
		if (session.lobbyId !== lobby.id) {
			this.leave(session);
		}
		return this.join(session, lobby, name, color, pattern);
	}

	publicPreview(): PublicLobbyPreview {
		const lobbies = [...this.lobbies.values()].filter(
			(lobby) => lobby.visibility === "public",
		);
		const open = lobbies.find((lobby) => lobby.acceptsPlayers);
		return {
			players: (open?.toState().players ?? [])
				.filter((player) => player.connected)
				.map(({ name, color, pattern }) => ({ name, color, pattern })),
			capacity: LOBBY_CAPACITY,
			playing: lobbies
				.filter((lobby) => !lobby.acceptsPlayers)
				.reduce((sum, lobby) => sum + lobby.connectedCount, 0),
		};
	}

	startTutorial(session: Session, name: string): LobbyResult {
		if (this.accountBusy(session)) {
			return { ok: false, error: ALREADY_PLAYING };
		}
		this.leave(session);
		const lobby = this.createLobby("private");
		lobby.config = TUTORIAL_MATCH_CONFIG;
		const joined = this.join(session, lobby, name, null, null);
		if (joined.ok) {
			this.startMatch(lobby, true);
		}
		return joined;
	}

	private createLobby(visibility: "public" | "private"): Lobby {
		const id = randomLobbyId();
		const code =
			visibility === "private"
				? generateLobbyCode((candidate) => this.codes.has(candidate))
				: null;
		const lobby = new Lobby(id, visibility, code, this.options.minPlayers);
		this.lobbies.set(id, lobby);
		if (code) {
			this.codes.set(code, id);
		}
		return lobby;
	}

	private accountBusy(session: Session): boolean {
		const accountId = session.account?.accountId;
		if (!accountId || this.options.dev) {
			return false;
		}
		let busy = false;
		for (const other of this.sessions.withAccount(accountId)) {
			if (other === session || !other.lobbyId) {
				continue;
			}
			if (other.socketId) {
				busy = true;
			} else {
				this.leave(other);
			}
		}
		return busy;
	}

	private join(
		session: Session,
		lobby: Lobby,
		name: string,
		color: number | null,
		pattern: HatPattern | null,
	): LobbyResult {
		const result = lobby.add(
			session.playerId,
			name,
			this.clock(),
			color,
			pattern,
		);
		if (!result.ok) {
			if (lobby.isEmpty) {
				this.deleteLobby(lobby);
			}
			return {
				ok: false,
				error: { code: result.code, message: result.message },
			};
		}
		session.lobbyId = lobby.id;
		session.name = name;
		this.cancelRemoval(session.playerId);
		const socket = session.socketId
			? this.io.sockets.sockets.get(session.socketId)
			: undefined;
		void socket?.join(this.room(lobby));
		this.broadcastState(lobby);
		return { ok: true, value: lobby.toState() };
	}

	leave(session: Session): void {
		const lobby = this.lobbyOf(session);
		if (!lobby) {
			return;
		}
		const match = lobby.matchId ? this.matches.get(lobby.matchId) : undefined;
		match?.playerDisconnected(session.playerId);
		lobby.remove(session.playerId);
		session.lobbyId = null;
		const socket = session.socketId
			? this.io.sockets.sockets.get(session.socketId)
			: undefined;
		void socket?.leave(this.room(lobby));
		this.cancelRemoval(session.playerId);
		if (lobby.isEmpty) {
			this.deleteLobby(lobby);
			return;
		}
		this.broadcastState(lobby);
	}

	setReady(session: Session, ready: boolean): LobbyError | null {
		const lobby = this.lobbyOf(session);
		if (!lobby) {
			return { code: "not-found", message: "Vous n'êtes dans aucun lobby." };
		}
		const result = lobby.setReady(session.playerId, ready);
		this.broadcastState(lobby);
		return result.ok ? null : { code: result.code, message: result.message };
	}

	setMicrophone(session: Session, ready: boolean): void {
		const lobby = this.lobbyOf(session);
		if (!lobby) {
			return;
		}
		lobby.setMicrophone(session.playerId, ready);
		this.broadcastState(lobby);
	}

	updateConfig(session: Session, config: unknown): LobbyResult {
		const lobby = this.lobbyOf(session);
		if (!lobby) {
			return {
				ok: false,
				error: { code: "not-found", message: "Vous n'êtes dans aucun lobby." },
			};
		}
		const result = lobby.updateConfig(session.playerId, config);
		if (!result.ok) {
			return {
				ok: false,
				error: { code: result.code, message: result.message },
			};
		}
		this.broadcastState(lobby);
		return { ok: true, value: lobby.toState() };
	}

	setTeam(session: Session, team: number): void {
		const lobby = this.lobbyOf(session);
		if (lobby?.setTeam(session.playerId, team).ok) {
			this.broadcastState(lobby);
		}
	}

	start(session: Session): LobbyError | null {
		const lobby = this.lobbyOf(session);
		if (!lobby) {
			return { code: "not-found", message: "Vous n'êtes dans aucun lobby." };
		}
		const check = lobby.canStart(session.playerId);
		if (!check.ok) {
			return { code: check.code, message: check.message };
		}
		if (lobby.visibility === "public") {
			lobby.startCountdown(this.clock());
			this.broadcastState(lobby);
			return null;
		}
		this.startMatch(lobby);
		return null;
	}

	private checkCountdowns(): void {
		const now = this.clock();
		for (const lobby of this.lobbies.values()) {
			if (lobby.visibility !== "public") {
				continue;
			}
			if (lobby.phase === "waiting" && lobby.everyoneReady()) {
				lobby.startCountdown(now);
				this.broadcastState(lobby);
			} else if (lobby.phase === "countdown") {
				if (!lobby.everyoneReady()) {
					lobby.cancelCountdown();
					this.broadcastState(lobby);
				} else if (
					lobby.countdownEndsAt !== null &&
					now >= lobby.countdownEndsAt
				) {
					this.startMatch(lobby);
				}
			}
		}
	}

	private startMatch(lobby: Lobby, tutorial = false): void {
		const participants = lobby.members.filter((member) => member.connected);
		if (participants.length === 0) {
			return;
		}
		lobby.phase = "loading";
		lobby.countdownEndsAt = null;
		const matchId = `m_${randomBytes(6).toString("base64url")}`;
		lobby.matchId = matchId;
		const accounts = new Map(
			participants.map((member) => [
				member.id,
				this.sessions.fromPlayer(member.id)?.account?.accountId ?? null,
			]),
		);
		const match = new Match({
			id: matchId,
			seed: tutorial ? TUTORIAL_SEED : randomMatchSeed(),
			config: lobby.config,
			participants: participants.map((member) => ({
				id: member.id,
				name: member.name,
				color: member.color,
				pattern: member.pattern,
				team: member.team,
			})),
			transport: this.transportFor(lobby),
			previousWords: lobby.previousFormulaWords,
			clock: this.clock,
			dev: this.options.dev ?? false,
			tutorial,
			onFinished: (results) => {
				if (results && !tutorial) {
					this.recordResults(results, lobby.visibility, accounts);
				}
				this.onMatchFinished(lobby, matchId);
			},
		});
		this.matches.set(matchId, match);
		lobby.previousFormulaWords = match.usedFormulaWords;
		this.broadcastState(lobby);
		this.io.to(this.room(lobby)).emit("game:init", match.initPayload());
		lobby.phase = "playing";
		this.broadcastState(lobby);
	}

	private transportFor(lobby: Lobby): MatchTransport {
		const room = this.room(lobby);
		return {
			broadcast: (event, ...args) => {
				this.io.to(room).emit(event, ...args);
			},
			broadcastVolatile: (event, ...args) => {
				this.io.to(room).volatile.emit(event, ...args);
			},
			toPlayer: (playerId, event, ...args) => {
				const session = this.sessions.fromPlayer(playerId);
				if (session?.socketId) {
					this.io.to(session.socketId).emit(event, ...args);
				}
			},
		};
	}

	private recordResults(
		results: MatchResults,
		visibility: "public" | "private",
		accounts: Map<string, string | null>,
	): void {
		const records = buildMatchRecords(
			results,
			visibility,
			accounts,
			new Date(),
		);
		if (records.length > 0) {
			this.options.onMatchRecords?.(records);
		}
	}

	private onMatchFinished(lobby: Lobby, matchId: string): void {
		const match = this.matches.get(matchId);
		match?.stop();
		this.matches.delete(matchId);
		if (!this.lobbies.has(lobby.id)) {
			return;
		}
		for (const member of [...lobby.members]) {
			if (!member.connected) {
				lobby.remove(member.id);
				const session = this.sessions.fromPlayer(member.id);
				if (session) {
					session.lobbyId = null;
				}
			}
		}
		lobby.resetAfterMatch();
		if (lobby.isEmpty) {
			this.deleteLobby(lobby);
			return;
		}
		this.broadcastState(lobby);
	}

	handleDisconnect(session: Session): void {
		const lobby = this.lobbyOf(session);
		if (!lobby) {
			return;
		}
		const member = lobby.member(session.playerId);
		if (member) {
			member.connected = false;
			member.ready = false;
		}
		const match = lobby.matchId ? this.matches.get(lobby.matchId) : undefined;
		if (match) {
			match.playerDisconnected(session.playerId);
			this.broadcastState(lobby);
			return;
		}
		lobby.cancelCountdown();
		this.broadcastState(lobby);
		const timer = setTimeout(() => {
			this.removalTimers.delete(session.playerId);
			if (!session.socketId && session.lobbyId === lobby.id) {
				this.leave(session);
				this.sessions.forget(session);
			}
		}, WAITING_DISCONNECT_GRACE_MS);
		this.removalTimers.set(session.playerId, timer);
	}

	handleReconnect(session: Session): void {
		const lobby = this.lobbyOf(session);
		if (!lobby) {
			return;
		}
		this.cancelRemoval(session.playerId);
		const member = lobby.member(session.playerId);
		if (member) {
			member.connected = true;
		}
		const socket = session.socketId
			? this.io.sockets.sockets.get(session.socketId)
			: undefined;
		void socket?.join(this.room(lobby));
		this.broadcastState(lobby);
		const match = lobby.matchId ? this.matches.get(lobby.matchId) : undefined;
		if (match?.players.has(session.playerId)) {
			match.playerReconnected(session.playerId);
		}
	}

	relayVoice(from: Session, peerId: string): string | null {
		const lobby = this.lobbyOf(from);
		if (!lobby?.member(peerId) || peerId === from.playerId) {
			return null;
		}
		return this.sessions.fromPlayer(peerId)?.socketId ?? null;
	}

	private cancelRemoval(playerId: string): void {
		const timer = this.removalTimers.get(playerId);
		if (timer) {
			clearTimeout(timer);
			this.removalTimers.delete(playerId);
		}
	}

	private deleteLobby(lobby: Lobby): void {
		if (lobby.matchId) {
			const match = this.matches.get(lobby.matchId);
			match?.stop();
			this.matches.delete(lobby.matchId);
		}
		this.lobbies.delete(lobby.id);
		if (lobby.code) {
			this.codes.delete(lobby.code);
		}
	}

	broadcastState(lobby: Lobby): void {
		this.io.to(this.room(lobby)).emit("lobby:state", lobby.toState());
	}

	private room(lobby: Lobby): string {
		return `lobby:${lobby.id}`;
	}

	stats(): { lobbies: number; matches: number } {
		return { lobbies: this.lobbies.size, matches: this.matches.size };
	}
}
