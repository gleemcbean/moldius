import type { Formula } from "../../../shared/anomalies/formulas.js";
import type { OccultId } from "../../../shared/config/occult.js";
import {
	SPECIES,
	type SpeciesDefinition,
	type SpeciesId,
} from "../../../shared/config/species.js";
import type { Vec3 } from "../../../shared/math.js";
import type { PathPoint } from "../../../shared/navigation/pathfinding.js";
import {
	ANOMALY_STATES,
	type AnomalySnapshot,
	type AnomalyState,
} from "../../../shared/protocol/game.js";
import { PoseHistory } from "../history.js";

export interface PlayerMemory {
	awareness: number;
	visibleNow: boolean;
	lastSeenAt: number;
	lastSeenPosition: Vec3 | null;
	lastHeardAt: number;
	lastHeardPosition: Vec3 | null;
}

export interface WitnessedHide {
	playerId: string;
	spotId: number;
	at: number;
}

export class AnomalyEntity {
	readonly definition: SpeciesDefinition;
	gen = 0;
	active = false;
	spawnDueAt = 0;
	spawnedAt = 0;
	position: Vec3 = { x: 0, y: 0, z: 0 };
	yaw = 0;
	velocity: Vec3 = { x: 0, y: 0, z: 0 };
	state: AnomalyState = "dormant";
	stateSince = 0;
	targetId: string | null = null;
	interestPlayerId: string | null = null;
	readonly ignoredUntil = new Map<string, number>();
	readonly memory = new Map<string, PlayerMemory>();
	path: PathPoint[] = [];
	pathIndex = 0;
	pathGoal: Vec3 | null = null;
	nextRepathAt = 0;
	pathFailures = 0;
	destinationRoom: number | null = null;
	idleUntil = 0;
	attackTargetId: string | null = null;
	strikeDone = false;
	lastStrikeAt = -Infinity;
	homeRoom: number | null = null;
	homePoint: Vec3 | null = null;
	hostile = true;
	revealed = false;
	mimicPlayerId: string | null = null;
	swell = 0;
	screamUntil = 0;
	nextScreamAt = 0;
	hostId = -1;
	orbitUntil = 0;
	orbitAngle = 0;
	carryingPlayerId: string | null = null;
	carryUntil = 0;
	nextPulseAt = 0;
	pulseCharging = false;
	witnessed: WitnessedHide | null = null;
	doorWaitId: number | null = null;
	watchedAt = 0;
	doorWaitUntil = 0;
	telegraphUntil = 0;
	progressCheckAt = 0;
	progressAnchor: Vec3 = { x: 0, y: 0, z: 0 };
	lostTargetAt = 0;
	aimPoint: Vec3 | null = null;
	aimAnnouncedAt = 0;
	pursuitUntil = 0;
	nextSpreadCheckAt = 0;
	hurrying = false;
	scatter = 0;
	luredUntil = 0;
	litAt = -Infinity;
	nextBiteAt = 0;
	readonly gaze = new Map<string, number>();
	readonly doorCooldowns = new Map<number, number>();
	readonly history = new PoseHistory();

	constructor(
		readonly id: number,
		readonly species: SpeciesId,
		readonly exemplar: number,
		readonly exemplarCount: number,
		readonly formula: Formula,
		public occult: OccultId | null = null,
	) {
		this.definition = SPECIES[species];
		this.hostile = this.definition.hostile && species !== "murmure";
	}

	memoryFor(playerId: string): PlayerMemory {
		let memory = this.memory.get(playerId);
		if (!memory) {
			memory = {
				awareness: 0,
				visibleNow: false,
				lastSeenAt: -Infinity,
				lastSeenPosition: null,
				lastHeardAt: -Infinity,
				lastHeardPosition: null,
			};
			this.memory.set(playerId, memory);
		}
		return memory;
	}

	resetForSpawn(position: Vec3, yaw: number, now: number): void {
		this.gen += 1;
		this.active = true;
		this.spawnedAt = now;
		this.watchedAt = now;
		this.position = { ...position };
		this.yaw = yaw;
		this.velocity = { x: 0, y: 0, z: 0 };
		this.state = "idle";
		this.stateSince = now;
		this.targetId = null;
		this.interestPlayerId = null;
		this.ignoredUntil.clear();
		this.memory.clear();
		this.path = [];
		this.pathIndex = 0;
		this.pathGoal = null;
		this.destinationRoom = null;
		this.idleUntil = now + 800;
		this.attackTargetId = null;
		this.hostile = this.definition.hostile && this.species !== "murmure";
		this.revealed = false;
		this.swell = 0;
		this.scatter = 0;
		this.luredUntil = 0;
		this.litAt = -Infinity;
		this.nextBiteAt = 0;
		this.screamUntil = 0;
		this.hostId = -1;
		this.carryingPlayerId = null;
		this.witnessed = null;
		this.pulseCharging = false;
		this.aimPoint = null;
		this.pursuitUntil = 0;
		this.nextSpreadCheckAt = now + 2000;
		this.hurrying = false;
		this.gaze.clear();
		this.progressCheckAt = now + 1500;
		this.progressAnchor = { ...position };
		this.history.clear();
		this.history.push({ t: now, ...position, yaw });
	}

	setState(state: AnomalyState, now: number): void {
		if (this.state !== state) {
			this.state = state;
			this.stateSince = now;
		}
	}

	stateAge(now: number): number {
		return now - this.stateSince;
	}

	center(): Vec3 {
		return {
			x: this.position.x,
			y: this.position.y + this.definition.bodyHeight * 0.55,
			z: this.position.z,
		};
	}

	eye(): Vec3 {
		return {
			x: this.position.x,
			y: this.position.y + this.definition.bodyHeight * 0.88,
			z: this.position.z,
		};
	}

	snapshot(now: number, extra: number): AnomalySnapshot {
		return {
			id: this.id,
			gen: this.gen,
			x: round(this.position.x),
			y: round(this.position.y),
			z: round(this.position.z),
			yaw: round(this.yaw),
			state: ANOMALY_STATES.indexOf(this.state),
			stateMs: Math.round(now - this.stateSince),
			target: this.targetId,
			aware:
				this.targetId !== null &&
				(this.memory.get(this.targetId)?.visibleNow ?? false),
			extra: round(extra),
			host: this.hostId,
			mimic:
				this.species === "double" && !this.revealed ? this.mimicPlayerId : null,
		};
	}
}

function round(value: number): number {
	return Math.round(value * 1000) / 1000;
}
