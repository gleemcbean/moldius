import {
	PRIVATE_LOBBY_CAPACITY,
	PUBLIC_LOBBY_CAPACITY,
	PUBLIC_START_COUNTDOWN_MS,
} from "../../shared/config/index.js";
import {
	DEFAULT_HAT_PATTERN,
	type HatPattern,
} from "../../shared/hatPatterns.js";
import {
	defaultPrivateConfig,
	type MatchConfig,
	PUBLIC_MATCH_CONFIG,
	sanitizeMatchConfig,
} from "../../shared/matchConfig.js";
import { PLAYER_COLOR_CHOICES } from "../../shared/playerColors.js";
import type {
	LobbyPhase,
	LobbyPlayerInfo,
	LobbyState,
	LobbyVisibility,
	LookPreference,
} from "../../shared/protocol/lobby.js";
import {
	DEFAULT_LANTERN_TINT,
	type LanternTint,
	type Tagline,
} from "../../shared/rewards.js";
import { smallestTeam } from "../../shared/teams.js";

export interface LobbyMember {
	id: string;
	name: string;
	ready: boolean;
	micReady: boolean;
	connected: boolean;
	color: number;
	pattern: HatPattern;
	lantern: LanternTint;
	tagline: Tagline | null;
	team: number | null;
	joinedAt: number;
}

export type LobbyActionResult =
	| { ok: true }
	| {
			ok: false;
			code:
				| "full"
				| "in-progress"
				| "not-host"
				| "not-private"
				| "not-ready"
				| "not-enough-players"
				| "microphone-required";
			message: string;
	  };

export class Lobby {
	readonly members: LobbyMember[] = [];
	hostId = "";
	phase: LobbyPhase = "waiting";
	countdownEndsAt: number | null = null;
	matchId: string | null = null;
	config: MatchConfig;
	previousFormulaWords = new Set<string>();
	daily: string | null = null;

	constructor(
		readonly id: string,
		readonly visibility: LobbyVisibility,
		readonly code: string | null,
		readonly minPlayers: number,
	) {
		this.config =
			visibility === "private"
				? defaultPrivateConfig()
				: {
						...PUBLIC_MATCH_CONFIG,
						roomTypes: [...PUBLIC_MATCH_CONFIG.roomTypes],
						species: [...PUBLIC_MATCH_CONFIG.species],
					};
	}

	get capacity(): number {
		return this.visibility === "private"
			? PRIVATE_LOBBY_CAPACITY
			: PUBLIC_LOBBY_CAPACITY;
	}

	get isFull(): boolean {
		return this.members.length >= this.capacity;
	}

	get isEmpty(): boolean {
		return this.members.length === 0;
	}

	get acceptsPlayers(): boolean {
		return (
			(this.phase === "waiting" || this.phase === "countdown") && !this.isFull
		);
	}

	member(playerId: string): LobbyMember | null {
		return this.members.find((member) => member.id === playerId) ?? null;
	}

	add(
		playerId: string,
		name: string,
		now: number,
		look: LookPreference = {},
	): LobbyActionResult {
		const preferredColor = look.color ?? null;
		const existing = this.member(playerId);
		if (existing) {
			existing.name = name;
			existing.connected = true;
			existing.pattern = look.pattern ?? existing.pattern;
			existing.lantern = look.lantern ?? existing.lantern;
			existing.tagline = look.tagline ?? null;
			return { ok: true };
		}
		if (this.phase !== "waiting" && this.phase !== "countdown") {
			return {
				ok: false,
				code: "in-progress",
				message: "Une partie est déjà en cours dans ce lobby.",
			};
		}
		if (this.isFull) {
			return { ok: false, code: "full", message: "Ce lobby est complet." };
		}
		const usedColors = new Set(this.members.map((member) => member.color));
		const color =
			preferredColor !== null && !usedColors.has(preferredColor)
				? preferredColor
				: (PLAYER_COLOR_CHOICES.find(
						(candidate) => !usedColors.has(candidate),
					) ?? PLAYER_COLOR_CHOICES[0]);
		this.members.push({
			id: playerId,
			name,
			ready: false,
			micReady: false,
			connected: true,
			color,
			pattern: look.pattern ?? DEFAULT_HAT_PATTERN,
			lantern: look.lantern ?? DEFAULT_LANTERN_TINT,
			tagline: look.tagline ?? null,
			team: null,
			joinedAt: now,
		});
		if (!this.hostId) {
			this.hostId = playerId;
		}
		this.assignTeams();
		this.cancelCountdown();
		return { ok: true };
	}

	remove(playerId: string): void {
		const index = this.members.findIndex((member) => member.id === playerId);
		if (index < 0) {
			return;
		}
		this.members.splice(index, 1);
		if (this.hostId === playerId) {
			this.hostId = this.members[0]?.id ?? "";
		}
		if (this.phase === "countdown") {
			this.cancelCountdown();
		}
	}

	setReady(playerId: string, ready: boolean): LobbyActionResult {
		const member = this.member(playerId);
		if (!member) {
			return { ok: false, code: "not-ready", message: "Joueur inconnu." };
		}
		if (ready && !member.micReady) {
			return {
				ok: false,
				code: "microphone-required",
				message: "Un microphone opérationnel est nécessaire pour jouer.",
			};
		}
		member.ready = ready;
		if (!ready) {
			this.cancelCountdown();
		}
		return { ok: true };
	}

	setMicrophone(playerId: string, ready: boolean): void {
		const member = this.member(playerId);
		if (!member) {
			return;
		}
		member.micReady = ready;
		if (!ready) {
			member.ready = false;
			this.cancelCountdown();
		}
	}

	updateConfig(playerId: string, input: unknown): LobbyActionResult {
		if (this.visibility !== "private") {
			return {
				ok: false,
				code: "not-private",
				message: "Les règles d'un lobby public sont imposées par le serveur.",
			};
		}
		if (playerId !== this.hostId) {
			return {
				ok: false,
				code: "not-host",
				message: "Seul l'hôte peut modifier les règles.",
			};
		}
		if (this.daily !== null) {
			return {
				ok: false,
				code: "not-private",
				message: "Le défi du jour a les mêmes règles pour tout le monde.",
			};
		}
		if (this.phase !== "waiting") {
			return {
				ok: false,
				code: "in-progress",
				message: "Les règles ne peuvent plus changer.",
			};
		}
		this.config = sanitizeMatchConfig(input, this.config);
		this.assignTeams();
		for (const member of this.members) {
			if (member.id !== this.hostId) {
				member.ready = false;
			}
		}
		return { ok: true };
	}

	setTeam(playerId: string, team: number): LobbyActionResult {
		const member = this.member(playerId);
		if (
			!member ||
			this.phase !== "waiting" ||
			!Number.isInteger(team) ||
			team < 0 ||
			team >= this.config.teamCount
		) {
			return {
				ok: false,
				code: "in-progress",
				message: "Impossible de changer d'équipe maintenant.",
			};
		}
		member.team = team;
		return { ok: true };
	}

	private assignTeams(): void {
		const count = this.config.teamCount;
		for (const member of [...this.members].sort(
			(a, b) => a.joinedAt - b.joinedAt,
		)) {
			if (count === 0) {
				member.team = null;
			} else if (member.team === null || member.team >= count) {
				member.team = smallestTeam(this.members, count);
			}
		}
	}

	get connectedCount(): number {
		return this.members.filter((member) => member.connected).length;
	}

	everyoneReady(): boolean {
		const connected = this.members.filter((member) => member.connected);
		return (
			connected.length >= Math.max(1, this.minPlayers) &&
			connected.every((member) => member.ready && member.micReady)
		);
	}

	canStart(playerId: string): LobbyActionResult {
		if (this.visibility === "private" && playerId !== this.hostId) {
			return {
				ok: false,
				code: "not-host",
				message: "Seul l'hôte peut lancer la partie.",
			};
		}
		if (this.phase !== "waiting" && this.phase !== "countdown") {
			return {
				ok: false,
				code: "in-progress",
				message: "La partie est déjà lancée.",
			};
		}
		if (this.connectedCount < this.minPlayers) {
			return {
				ok: false,
				code: "not-enough-players",
				message: `Il faut au moins ${this.minPlayers} joueurs pour lancer une partie.`,
			};
		}
		if (!this.everyoneReady()) {
			return {
				ok: false,
				code: "not-ready",
				message: "Tous les joueurs doivent être prêts avec un micro actif.",
			};
		}
		return { ok: true };
	}

	startCountdown(now: number): void {
		this.phase = "countdown";
		this.countdownEndsAt = now + PUBLIC_START_COUNTDOWN_MS;
	}

	cancelCountdown(): void {
		if (this.phase === "countdown") {
			this.phase = "waiting";
			this.countdownEndsAt = null;
		}
	}

	resetAfterMatch(): void {
		this.phase = "waiting";
		this.matchId = null;
		this.countdownEndsAt = null;
		for (const member of this.members) {
			member.ready = false;
		}
	}

	toState(): LobbyState {
		const players: LobbyPlayerInfo[] = this.members.map((member) => ({
			id: member.id,
			name: member.name,
			ready: member.ready,
			micReady: member.micReady,
			connected: member.connected,
			color: member.color,
			pattern: member.pattern,
			lantern: member.lantern,
			tagline: member.tagline,
			team: member.team,
		}));
		return {
			id: this.id,
			code: this.code,
			visibility: this.visibility,
			hostId: this.hostId,
			capacity: this.capacity,
			minPlayers: this.minPlayers,
			players,
			config: this.config,
			configEditable: this.visibility === "private" && this.daily === null,
			phase: this.phase,
			countdownEndsAt: this.countdownEndsAt,
			matchId: this.matchId,
			daily: this.daily,
		};
	}
}
