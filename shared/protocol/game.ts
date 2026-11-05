import type { MaterialId, OccultId } from "../config/occult.js";
import type { SpeciesId } from "../config/species.js";
import type { HatPattern } from "../hatPatterns.js";
import type { MatchConfig } from "../matchConfig.js";
import type { Vec3 } from "../math.js";
import type { TeamStanding } from "../teams.js";

export interface SpawnPoint {
	x: number;
	y: number;
	z: number;
	yaw: number;
}

export interface MatchPlayerInit {
	id: string;
	name: string;
	color: number;
	pattern: HatPattern;
	team: number | null;
	spawn: SpawnPoint;
}

export interface AnomalyRosterEntry {
	id: number;
	species: SpeciesId;
	exemplar: number;
	exemplarCount: number;
	formula: string[];
	occult: OccultId | null;
}

export interface PlayerInventory {
	materials: Record<MaterialId, number>;
	objects: Record<OccultId, number>;
}

export interface MatchInit {
	matchId: string;
	seed: number;
	config: MatchConfig;
	layoutChecksum: number;
	players: MatchPlayerInit[];
	pool: SpeciesId[];
	roster: AnomalyRosterEntry[];
	durationMs: number;
	anomalySpawnDelayMs: number;
	serverTime: number;
	dev: boolean;
	tutorial: boolean;
}

export interface MatchBegin {
	matchId: string;
	serverTime: number;
	startedAt: number;
	endsAt: number;
}

export const PLAYER_FLAG = {
	sprint: 1,
	lantern: 2,
	grimoire: 4,
	hidden: 8,
	dead: 16,
	carried: 32,
	casting: 64,
	protected: 128,
	slimed: 256,
	sprintLocked: 512,
	speaking: 1024,
	shouting: 2048,
	airborne: 4096,
	petrified: 8192,
} as const;

export interface PlayerSnapshot {
	id: string;
	x: number;
	y: number;
	z: number;
	yaw: number;
	pitch: number;
	crouch: number;
	speed: number;
	flags: number;
	hp: number;
	en: number;
	score: number;
	hideSpot: number;
	moveId: number;
}

export type AnomalyState =
	| "dormant"
	| "patrol"
	| "travel"
	| "idle"
	| "investigate"
	| "chase"
	| "windup"
	| "recover"
	| "search"
	| "extract"
	| "special"
	| "flee"
	| "gone";

export const ANOMALY_STATES: readonly AnomalyState[] = [
	"dormant",
	"patrol",
	"travel",
	"idle",
	"investigate",
	"chase",
	"windup",
	"recover",
	"search",
	"extract",
	"special",
	"flee",
	"gone",
];

export interface AnomalySnapshot {
	id: number;
	gen: number;
	x: number;
	y: number;
	z: number;
	yaw: number;
	state: number;
	stateMs: number;
	target: string | null;
	aware: boolean;
	extra: number;
	host: number;
	mimic: string | null;
}

export interface WorldSnapshot {
	tick: number;
	t: number;
	remainingMs: number;
	players: PlayerSnapshot[];
	anomalies: AnomalySnapshot[];
}

export interface ClientStateMessage {
	seq: number;
	x: number;
	y: number;
	z: number;
	yaw: number;
	pitch: number;
	vx: number;
	vy: number;
	vz: number;
	grounded: boolean;
	crouch: number;
	sprint: boolean;
	moveInput: boolean;
	grimoire: boolean;
	voiceLevel: number;
	voicePeakMs: number;
	held: number;
	moveAck: number;
}

export type InteractionKind = "door" | "hide" | "unhide" | "valve" | "pickup";

export interface InteractRequest {
	kind: InteractionKind;
	id: number;
}

export type CastMethod = "speech";

export interface CastRequest {
	transcripts: string[];
	method: CastMethod;
}

export type CastFailureReason =
	| "wrong-words"
	| "out-of-range"
	| "blocked"
	| "lantern-open-required"
	| "lantern-closed-required"
	| "missing-occult"
	| "howler-scream"
	| "interrupted"
	| "no-voice"
	| "dead"
	| "hidden"
	| "cooldown"
	| "scattered";

export interface CastResult {
	ok: boolean;
	anomalyId: number;
	reason: CastFailureReason | null;
	message: string;
	points: number;
}

export type ForcedMoveKind =
	| "hide"
	| "unhide"
	| "push"
	| "carry"
	| "drop"
	| "respawn"
	| "extract"
	| "correction"
	| "spawn"
	| "throw";

export interface ForcedMove {
	playerId: string;
	moveId: number;
	kind: ForcedMoveKind;
	x: number;
	y: number;
	z: number;
	yaw: number | null;
	durationMs: number;
	hideSpot: number;
}

export type ProjectileKind = "ember" | "slime";

export type GameEvent =
	| { type: "pickup"; id: number; playerId: string; material: MaterialId }
	| { type: "pickupBack"; id: number }
	| { type: "craft"; playerId: string; object: OccultId; altarId: number }
	| { type: "door"; doorId: number; open: boolean; by: string | null }
	| {
			type: "valve";
			valveId: number;
			activeUntil: number;
			cooldownUntil: number;
	  }
	| {
			type: "puddle";
			id: number;
			x: number;
			y: number;
			z: number;
			radius: number;
			expiresAt: number;
	  }
	| { type: "puddleRemoved"; id: number }
	| {
			type: "projectile";
			id: number;
			kind: ProjectileKind;
			origin: Vec3;
			velocity: Vec3;
			gravity: number;
			launchedAt: number;
	  }
	| { type: "projectileEnd"; id: number; at: Vec3; hitPlayer: string | null }
	| {
			type: "damage";
			playerId: string;
			amount: number;
			source: SpeciesId | "explosion";
			hp: number;
			from: Vec3 | null;
			periodic: boolean;
	  }
	| {
			type: "death";
			playerId: string;
			respawnAt: number;
			cause: SpeciesId | "explosion";
	  }
	| { type: "respawn"; playerId: string; protectedUntil: number }
	| {
			type: "capture";
			playerId: string;
			anomalyId: number;
			gen: number;
			species: SpeciesId;
			points: number;
			score: number;
	  }
	| { type: "anomalySpawn"; anomalyId: number; gen: number; species: SpeciesId }
	| {
			type: "anomalyRemoved";
			anomalyId: number;
			gen: number;
			reason: "captured" | "exploded";
			returnsAt: number;
	  }
	| {
			type: "explosion";
			anomalyId: number;
			x: number;
			y: number;
			z: number;
			radius: number;
			killed: string[];
	  }
	| {
			type: "attack";
			anomalyId: number;
			phase: "windup" | "strike";
			targetId: string | null;
			hit: boolean;
	  }
	| {
			type: "pulse";
			anomalyId: number;
			phase: "charge" | "release";
			x: number;
			y: number;
			z: number;
			radius: number;
	  }
	| { type: "scream"; anomalyId: number; until: number }
	| { type: "shout"; playerId: string; x: number; y: number; z: number }
	| { type: "push"; fromId: string; targetId: string }
	| {
			type: "castInterrupted";
			playerId: string;
			byId: string | null;
			cause: "push" | "shout" | "voice";
	  }
	| { type: "reveal"; anomalyId: number }
	| { type: "extractWarning"; anomalyId: number; playerId: string }
	| { type: "carry"; anomalyId: number; playerId: string; active: boolean }
	| {
			type: "thrown";
			anomalyId: number;
			playerId: string;
			from: Vec3;
			to: Vec3;
	  }
	| {
			type: "laserCharge";
			anomalyId: number;
			from: Vec3;
			target: Vec3;
			until: number;
	  }
	| {
			type: "laser";
			anomalyId: number;
			from: Vec3;
			to: Vec3;
			hits: string[];
	  }
	| { type: "notice"; text: string };

export interface MatchResultEntry {
	playerId: string;
	name: string;
	score: number;
	captures: number;
	deaths: number;
	color: number;
	team: number | null;
}

export interface MatchResults {
	matchId: string;
	entries: MatchResultEntry[];
	teams: TeamStanding[];
	winnerId: string | null;
	winnerTeam: number | null;
	durationMs: number;
}

export interface TimeSyncPing {
	clientTime: number;
}

export interface TimeSyncPong {
	clientTime: number;
	serverTime: number;
}
