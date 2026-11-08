import { SPECIES, type SpeciesId } from "@shared/config/species";
import { DEFAULT_HAT_PATTERN, type HatPattern } from "@shared/hatPatterns";
import type { ManorLayout } from "@shared/manor/types";
import type { Vec3 } from "@shared/math";
import type { CollisionWorld } from "@shared/physics/collisionWorld";
import {
	ANOMALY_STATES,
	type AnomalyRosterEntry,
	type AnomalySnapshot,
	type AnomalyState,
	type GameEvent,
	type MatchInit,
	type PlayerSnapshot,
	type ProjectileKind,
	type WorldSnapshot,
} from "@shared/protocol/game";
import { DEFAULT_LANTERN_TINT, type LanternTint } from "@shared/rewards";
import { SnapshotBuffer } from "../net/SnapshotBuffer";

export interface RemotePlayerState {
	id: string;
	name: string;
	color: number;
	pattern: HatPattern;
	lantern: LanternTint;
	team: number | null;
	buffer: SnapshotBuffer<PlayerSnapshot>;
	latest: PlayerSnapshot | null;
}

export interface AnomalyClientState {
	id: number;
	roster: AnomalyRosterEntry;
	gen: number;
	active: boolean;
	buffer: SnapshotBuffer<AnomalySnapshot & { yaw: number }>;
	latest: AnomalySnapshot | null;
	screamUntil: number;
	lastSeenAt: number;
}

export interface DoorClientState {
	open: boolean;
	changedAt: number;
}

export interface PuddleClientState {
	id: number;
	x: number;
	y: number;
	z: number;
	radius: number;
	expiresAt: number;
	createdAt: number;
}

export interface ProjectileClientState {
	id: number;
	kind: ProjectileKind;
	origin: Vec3;
	velocity: Vec3;
	gravity: number;
	launchedAt: number;
}

export type EventListener = (event: GameEvent, serverTime: number) => void;

export class ClientWorldState {
	readonly players = new Map<string, RemotePlayerState>();
	readonly anomalies = new Map<number, AnomalyClientState>();
	readonly doors = new Map<number, DoorClientState>();
	readonly valves = new Map<
		number,
		{ activeUntil: number; cooldownUntil: number }
	>();
	readonly stakes = new Map<
		number,
		{ activeUntil: number; cooldownUntil: number }
	>();
	readonly walkies = new Map<
		number,
		{ holder: string | null; available: boolean }
	>();
	readonly cameras = new Map<
		number,
		{ holder: string | null; available: boolean }
	>();
	readonly puddles = new Map<number, PuddleClientState>();
	readonly projectiles = new Map<number, ProjectileClientState>();
	readonly listeners = new Set<EventListener>();
	remainingMs = 0;
	latestSnapshotTime = -Infinity;
	lastTick = -1;

	constructor(
		readonly init: MatchInit,
		readonly layout: ManorLayout,
		readonly world: CollisionWorld,
		readonly selfId: string,
	) {
		for (const player of init.players) {
			this.players.set(player.id, {
				id: player.id,
				name: player.name,
				color: player.color,
				pattern: player.pattern ?? DEFAULT_HAT_PATTERN,
				lantern: player.lantern ?? DEFAULT_LANTERN_TINT,
				team: player.team ?? null,
				buffer: new SnapshotBuffer(),
				latest: null,
			});
		}
		for (const entry of init.roster) {
			this.anomalies.set(entry.id, {
				id: entry.id,
				roster: entry,
				gen: 0,
				active: false,
				buffer: new SnapshotBuffer(),
				latest: null,
				screamUntil: 0,
				lastSeenAt: -Infinity,
			});
		}
		for (const opening of layout.openings) {
			if (opening.door) {
				this.doors.set(opening.door.id, {
					open: opening.door.initiallyOpen,
					changedAt: -Infinity,
				});
				world.setDoorClosed(opening.door.id, !opening.door.initiallyOpen);
			}
		}
	}

	get self(): RemotePlayerState | undefined {
		return this.players.get(this.selfId);
	}

	get selfHasWalkie(): boolean {
		return [...this.walkies.values()].some(
			(walkie) => walkie.holder === this.selfId,
		);
	}

	get selfHasCamera(): boolean {
		return [...this.cameras.values()].some(
			(camera) => camera.holder === this.selfId,
		);
	}

	/** Repart de zéro pour rejouer un extrait, avec les portes telles qu'elles étaient. */
	resetForReplay(doorsOpen: readonly number[]): void {
		this.lastTick = -1;
		this.latestSnapshotTime = -Infinity;
		this.puddles.clear();
		this.projectiles.clear();
		for (const player of this.players.values()) {
			player.buffer.reset();
			player.latest = null;
		}
		for (const anomaly of this.anomalies.values()) {
			anomaly.active = false;
			anomaly.buffer.reset();
			anomaly.latest = null;
			anomaly.screamUntil = 0;
		}
		const open = new Set(doorsOpen);
		for (const [doorId, door] of this.doors) {
			door.open = open.has(doorId);
			this.world.setDoorClosed(doorId, !door.open);
		}
	}

	applySnapshot(snapshot: WorldSnapshot): void {
		if (snapshot.tick <= this.lastTick) {
			return;
		}
		this.lastTick = snapshot.tick;
		this.latestSnapshotTime = snapshot.t;
		this.remainingMs = snapshot.remainingMs;
		for (const playerSnapshot of snapshot.players) {
			const player = this.players.get(playerSnapshot.id);
			if (!player) {
				continue;
			}
			player.latest = playerSnapshot;
			player.buffer.push(snapshot.t, playerSnapshot);
		}
		const seen = new Set<number>();
		for (const anomalySnapshot of snapshot.anomalies) {
			const anomaly = this.anomalies.get(anomalySnapshot.id);
			if (!anomaly) {
				continue;
			}
			seen.add(anomalySnapshot.id);
			if (anomalySnapshot.gen !== anomaly.gen) {
				anomaly.gen = anomalySnapshot.gen;
				anomaly.buffer.reset();
			}
			anomaly.active = true;
			anomaly.latest = anomalySnapshot;
			anomaly.buffer.push(snapshot.t, anomalySnapshot);
		}
		for (const anomaly of this.anomalies.values()) {
			if (!seen.has(anomaly.id) && anomaly.active) {
				anomaly.active = false;
				anomaly.buffer.reset();
				anomaly.latest = null;
			}
		}
	}

	applyEvents(events: GameEvent[], serverTime: number): void {
		for (const event of events) {
			this.applyEvent(event, serverTime);
			for (const listener of this.listeners) {
				listener(event, serverTime);
			}
		}
	}

	private applyEvent(event: GameEvent, serverTime: number): void {
		switch (event.type) {
			case "door":
				this.doors.set(event.doorId, {
					open: event.open,
					changedAt: serverTime,
				});
				this.world.setDoorClosed(event.doorId, !event.open);
				break;
			case "valve":
				this.valves.set(event.valveId, {
					activeUntil: event.activeUntil,
					cooldownUntil: event.cooldownUntil,
				});
				break;
			case "stake":
				this.stakes.set(event.id, {
					activeUntil: event.activeUntil,
					cooldownUntil: event.cooldownUntil,
				});
				break;
			case "walkie":
				this.walkies.set(event.id, {
					holder: event.holder,
					available: event.available,
				});
				break;
			case "camera":
				this.cameras.set(event.id, {
					holder: event.holder,
					available: event.available,
				});
				break;
			case "puddle":
				this.puddles.set(event.id, {
					id: event.id,
					x: event.x,
					y: event.y,
					z: event.z,
					radius: event.radius,
					expiresAt: event.expiresAt,
					createdAt: serverTime,
				});
				break;
			case "puddleRemoved":
				this.puddles.delete(event.id);
				break;
			case "projectile":
				this.projectiles.set(event.id, {
					id: event.id,
					kind: event.kind,
					origin: event.origin,
					velocity: event.velocity,
					gravity: event.gravity,
					launchedAt: event.launchedAt,
				});
				break;
			case "projectileEnd":
				this.projectiles.delete(event.id);
				break;
			case "scream": {
				const anomaly = this.anomalies.get(event.anomalyId);
				if (anomaly) {
					anomaly.screamUntil = event.until;
				}
				break;
			}
			case "anomalyRemoved": {
				const anomaly = this.anomalies.get(event.anomalyId);
				if (anomaly && anomaly.gen === event.gen) {
					anomaly.active = false;
					anomaly.buffer.reset();
					anomaly.latest = null;
				}
				break;
			}
			default:
				break;
		}
	}

	anomalyState(snapshot: AnomalySnapshot): AnomalyState {
		return ANOMALY_STATES[snapshot.state] ?? "idle";
	}

	speciesOf(anomalyId: number): SpeciesId | null {
		return this.anomalies.get(anomalyId)?.roster.species ?? null;
	}

	isPuddleUnder(x: number, y: number, z: number, grounded: boolean): boolean {
		if (!grounded) {
			return false;
		}
		for (const puddle of this.puddles.values()) {
			if (
				Math.abs(y - puddle.y) <= 0.14 &&
				Math.hypot(x - puddle.x, z - puddle.z) <= puddle.radius
			) {
				return true;
			}
		}
		return false;
	}

	speciesName(species: SpeciesId): string {
		return SPECIES[species].name;
	}
}
