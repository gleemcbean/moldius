import {
	ENERGY_MAX,
	EYE_HEIGHT_STANDING,
	HEALTH_MAX,
	SERVER_TICK_MS,
} from "../../../shared/config/index.js";
import { DEFAULT_HAT_PATTERN } from "../../../shared/hatPatterns.js";
import type { Room } from "../../../shared/manor/types.js";
import {
	directionToYaw,
	type Vec2,
	type Vec3,
	yawToDirection,
} from "../../../shared/math.js";
import { lineOfSight } from "../../../shared/physics/lineOfSight.js";
import type { MatchPlayerInit } from "../../../shared/protocol/game.js";
import { DEFAULT_LANTERN_TINT } from "../../../shared/rewards.js";
import {
	TUTORIAL_DUMMY_CAST_MS,
	TUTORIAL_DUMMY_COLOR,
	TUTORIAL_DUMMY_ID,
	TUTORIAL_DUMMY_REST_MS,
	TUTORIAL_HEARD_INTERVAL_MS,
	TUTORIAL_WOUNDED_HEALTH,
	type TutorialStage,
} from "../../../shared/tutorial.js";
import type { AnomalyEntity } from "../ai/AnomalyEntity.js";
import { clearPath, faceTowards, hoverHeight } from "../ai/locomotion.js";
import { lureAnomalies } from "../ai/lure.js";
import { soundMargin } from "../ai/perception.js";
import type { Match } from "../Match.js";
import { MatchPlayer } from "../MatchPlayer.js";

interface Placement {
	position: Vec3;
	yaw: number;
}

interface StealthPlan {
	roomId: number;
	player: Placement;
	monster: Placement;
}

type StakeStage = "pact" | "sanctuary" | "reliquary";

const MONSTER_STAGES: ReadonlySet<TutorialStage> = new Set([
	"stealth",
	"shout",
	"capture",
]);
const DUMMY_STAGES: ReadonlySet<TutorialStage> = new Set(["push", "shout"]);
const STEALTH_EXCLUDED: ReadonlySet<Room["type"]> = new Set([
	"corridor",
	"stairwell",
	"closet",
	"toilets",
	"sanctuary",
	"reliquary",
	"pact",
]);
const STEALTH_SPAN = { min: 6.5, ideal: 8, max: 9.5 };
const STEALTH_SAMPLE_STRIDE = 3;
const LEASH = 3.8;
const FOLLOW_INTERVAL_MS = 1500;
const CALM_STATES = new Set(["idle", "patrol", "travel", "search"]);
const HIDDEN_SPAWN = { min: 8, ideal: 11, max: 15 };
const DUMMY_DISTANCES = [1.5, 1.3, 1.8];
const DUMMY_WALL_CLEARANCE = 0.3;
const DUMMY_MIN_GAP = 1.4;
const DUMMY_OPEN_RADIUS = 1.6;
const FIRST_CAST_DELAY_MS = 600;
const HEARD_TURN_MS = 1600;
const PARKED: Vec3 = { x: 0, y: -40, z: 0 };

function yawTowards(from: Vec2, to: Vec2): number {
	return directionToYaw({ x: to.x - from.x, z: to.z - from.z });
}

function flatDistance(a: Vec2, b: Vec2): number {
	return Math.hypot(a.x - b.x, a.z - b.z);
}

function eyeOf(point: Vec3): Vec3 {
	return { x: point.x, y: point.y + EYE_HEIGHT_STANDING, z: point.z };
}

export class TutorialDirector {
	stage: TutorialStage = "free";
	readonly dummy: MatchPlayer;
	private frozen = false;
	private lured = false;
	private followAt = 0;
	private heardAt = -Infinity;
	private dummyRestUntil = 0;
	private readonly closedDoors = new Set<number>();
	private stealth: StealthPlan | null | undefined;

	constructor(private readonly match: Match) {
		this.dummy = new MatchPlayer(
			TUTORIAL_DUMMY_ID,
			"",
			TUTORIAL_DUMMY_COLOR,
			{ ...PARKED, yaw: 0 },
			match.now,
		);
		this.dummy.loaded = true;
	}

	initEntry(): MatchPlayerInit {
		return {
			id: this.dummy.id,
			name: this.dummy.name,
			color: this.dummy.color,
			pattern: DEFAULT_HAT_PATTERN,
			lantern: DEFAULT_LANTERN_TINT,
			tagline: null,
			team: null,
			spawn: { ...PARKED, yaw: 0 },
		};
	}

	private get monster(): AnomalyEntity | null {
		return this.match.anomalies[0] ?? null;
	}

	holds(entity: AnomalyEntity): boolean {
		return this.frozen && entity === this.monster;
	}

	isDummy(player: MatchPlayer): boolean {
		return player === this.dummy;
	}

	setStage(player: MatchPlayer, stage: TutorialStage): void {
		if (stage === this.stage || !player.alive) {
			return;
		}
		this.reopenDoors();
		this.stage = stage;
		if (!MONSTER_STAGES.has(stage)) {
			this.dismissMonster();
		}
		if (!DUMMY_STAGES.has(stage)) {
			this.removeDummy();
		}
		switch (stage) {
			case "stealth":
				this.setupStealth(player);
				break;
			case "wound":
				this.woundTo(player, TUTORIAL_WOUNDED_HEALTH);
				break;
			case "push":
				this.placeDummy(player);
				break;
			case "shout":
				if (!this.match.players.has(this.dummy.id)) {
					this.placeDummy(player);
				}
				this.startDummyCast();
				this.summon(player, true);
				break;
			case "capture":
				this.summon(player, false);
				this.wake(player);
				this.giveObject(player);
				break;
			case "pact":
			case "sanctuary":
			case "reliquary":
				this.visitStake(player, stage);
				break;
			case "walkie":
				this.visitGadget(
					player,
					this.match.walkies
						.availableIds()
						.map((id) => this.match.layout.walkies[id]),
				);
				break;
			case "camera":
				this.visitGadget(
					player,
					this.match.cameras
						.availableIds()
						.map((id) => this.match.layout.cameras[id]),
				);
				break;
			default:
				break;
		}
	}

	onInterrupted(
		target: MatchPlayer,
		byId: string | null,
		cause: "push" | "shout" | "voice",
	): void {
		const player = byId ? this.match.players.get(byId) : null;
		if (
			target === this.dummy &&
			cause !== "push" &&
			this.stage === "shout" &&
			player &&
			player !== this.dummy
		) {
			this.wake(player);
		}
	}

	update(): void {
		const player = this.subject();
		if (!player) {
			return;
		}
		const dt = SERVER_TICK_MS / 1000;
		this.listen(player, dt);
		this.runDummy(player);
		this.leash(player, dt);
	}

	removeDummy(): void {
		const dummy = this.dummy;
		if (!this.match.players.has(dummy.id)) {
			return;
		}
		this.match.players.delete(dummy.id);
		dummy.casting = null;
		dummy.grimoireOpen = false;
		dummy.position = { ...PARKED };
	}

	private subject(): MatchPlayer | null {
		for (const player of this.match.players.values()) {
			if (player !== this.dummy) {
				return player;
			}
		}
		return null;
	}

	private listen(player: MatchPlayer, dt: number): void {
		const entity = this.monster;
		if (this.stage !== "stealth" || !this.frozen || !entity?.active) {
			return;
		}
		const match = this.match;
		const heard = match.sounds.some(
			(sound) =>
				sound.playerId === player.id &&
				soundMargin(match, entity, sound, player) > 0,
		);
		if (heard && match.now - this.heardAt >= TUTORIAL_HEARD_INTERVAL_MS) {
			this.heardAt = match.now;
			match.emit({ type: "heard", anomalyId: entity.id, playerId: player.id });
		}
		if (match.now - this.heardAt < HEARD_TURN_MS) {
			faceTowards(entity, player.position, 2.5, dt);
		}
	}

	private runDummy(player: MatchPlayer): void {
		const dummy = this.dummy;
		if (!this.match.players.has(dummy.id)) {
			return;
		}
		const now = this.match.now;
		dummy.yaw = yawTowards(dummy.position, player.position);
		if (this.stage === "shout") {
			if (
				dummy.casting &&
				now - dummy.casting.since >= TUTORIAL_DUMMY_CAST_MS
			) {
				dummy.casting = null;
				this.dummyRestUntil = now + TUTORIAL_DUMMY_REST_MS;
			}
			if (
				!dummy.casting &&
				now >= this.dummyRestUntil &&
				now >= dummy.castBlockedUntil
			) {
				dummy.casting = { since: now };
			}
		} else {
			dummy.casting = null;
		}
		dummy.grimoireOpen = dummy.casting !== null;
	}

	private leash(player: MatchPlayer, dt: number): void {
		const entity = this.monster;
		if (
			!this.lured ||
			this.frozen ||
			!entity?.active ||
			!player.active ||
			!CALM_STATES.has(entity.state)
		) {
			return;
		}
		const match = this.match;
		const distance = Math.hypot(
			entity.position.x - player.position.x,
			entity.position.y - player.position.y,
			entity.position.z - player.position.z,
		);
		if (distance > LEASH) {
			if (match.now >= this.followAt) {
				this.followAt = match.now + FOLLOW_INTERVAL_MS;
				lureAnomalies(match, player.position, player.id);
			}
			return;
		}
		if (entity.state === "search") {
			return;
		}
		clearPath(entity);
		entity.velocity = { x: 0, y: 0, z: 0 };
		faceTowards(entity, player.position, 4, dt);
		if (entity.state !== "idle") {
			entity.setState("idle", match.now);
		}
		entity.idleUntil = match.now + 1000;
	}

	private wake(player: MatchPlayer): void {
		const entity = this.monster;
		this.frozen = false;
		this.lured = true;
		this.followAt = this.match.now + FOLLOW_INTERVAL_MS;
		if (entity?.active) {
			lureAnomalies(this.match, player.position, player.id);
		}
	}

	private spawnMonster(placement: Placement): void {
		const entity = this.monster;
		if (!entity) {
			return;
		}
		const match = this.match;
		entity.resetForSpawn(
			{
				...placement.position,
				y: placement.position.y + hoverHeight(entity),
			},
			placement.yaw,
			match.now,
		);
		entity.spawnDueAt = Infinity;
		match.emit({
			type: "anomalySpawn",
			anomalyId: entity.id,
			gen: entity.gen,
			species: entity.species,
		});
	}

	private summon(player: MatchPlayer, frozen: boolean): void {
		const entity = this.monster;
		if (!entity) {
			return;
		}
		if (entity.active) {
			this.frozen = this.frozen && frozen;
			return;
		}
		this.frozen = frozen;
		this.lured = false;
		const position = this.hiddenSpot(player);
		this.spawnMonster({
			position,
			yaw: yawTowards(position, player.position),
		});
	}

	private dismissMonster(): void {
		const entity = this.monster;
		this.frozen = false;
		this.lured = false;
		if (entity?.active) {
			this.match.removeAnomaly(entity, "dismissed");
			entity.spawnDueAt = Infinity;
		}
	}

	private giveObject(player: MatchPlayer): void {
		const object = this.monster?.occult;
		if (object && player.objects[object] < 1) {
			player.objects[object] = 1;
			this.match.sendInventory(player);
		}
	}

	private woundTo(player: MatchPlayer, health: number): void {
		if (player.health > health) {
			this.match.hurtSoftly(
				player,
				player.health - health,
				this.monster?.species ?? "murmure",
			);
		}
	}

	private setupStealth(player: MatchPlayer): void {
		this.stealth ??= this.planStealth();
		const plan = this.stealth;
		if (!plan) {
			this.summon(player, true);
			return;
		}
		this.teleport(player, plan.player);
		this.spawnMonster(plan.monster);
		this.frozen = true;
		this.lured = false;
		this.heardAt = -Infinity;
		this.closeRoom(plan.roomId);
	}

	private visitStake(player: MatchPlayer, stage: StakeStage): void {
		const stake = this.match.layout.stakes.find(
			(entry) => entry.kind === stage,
		);
		if (!stake) {
			return;
		}
		const target = { x: stake.x, y: stake.y + 0.9, z: stake.z };
		const placement = this.standNear(target, stake.roomId, 1.4, 2.4);
		if (placement) {
			this.teleport(player, placement);
		}
		this.closeRoom(stake.roomId);
		if (stage === "sanctuary") {
			this.woundTo(player, TUTORIAL_WOUNDED_HEALTH);
		}
	}

	private visitGadget(
		player: MatchPlayer,
		spots: readonly { roomId: number; x: number; y: number; z: number }[],
	): void {
		for (const spot of spots) {
			const placement = this.standNear(spot, spot.roomId, 0.8, 1.6);
			if (placement) {
				this.teleport(player, placement);
				this.closeRoom(spot.roomId);
				return;
			}
		}
	}

	private teleport(player: MatchPlayer, placement: Placement): void {
		const match = this.match;
		player.hiddenSpot = -1;
		player.casting = null;
		match.forcedMove(player, "spawn", placement.position, placement.yaw, 0);
		player.roomId = match.roomIdAt(placement.position);
	}

	private placeDummy(player: MatchPlayer): void {
		const match = this.match;
		const dummy = this.dummy;
		const position = this.roomMiddle(player) ?? this.frontOf(player);
		dummy.position = { ...position };
		dummy.velocity = { x: 0, y: 0, z: 0 };
		dummy.yaw = yawTowards(position, player.position);
		dummy.alive = true;
		dummy.connected = true;
		dummy.loaded = true;
		dummy.health = HEALTH_MAX;
		dummy.energy = ENERGY_MAX;
		dummy.crouch = 0;
		dummy.grounded = true;
		dummy.moveInput = false;
		dummy.casting = null;
		dummy.grimoireOpen = false;
		dummy.castBlockedUntil = 0;
		dummy.sabotageProtectedUntil = 0;
		dummy.lastStateAt = match.now;
		dummy.roomId = match.roomIdAt(position);
		dummy.history.push({ t: match.now, ...position, yaw: dummy.yaw });
		match.players.set(dummy.id, dummy);
	}

	private startDummyCast(): void {
		this.dummyRestUntil = this.match.now + FIRST_CAST_DELAY_MS;
		this.dummy.casting = null;
	}

	private frontOf(player: MatchPlayer): Vec3 {
		const match = this.match;
		const forward = yawToDirection(player.yaw);
		const eye = player.eyePosition();
		for (const turn of [0, 0.35, -0.35, 0.7, -0.7, 1.2, -1.2]) {
			for (const distance of DUMMY_DISTANCES) {
				const direction = {
					x: forward.x * Math.cos(turn) - forward.z * Math.sin(turn),
					z: forward.x * Math.sin(turn) + forward.z * Math.cos(turn),
				};
				const point = {
					x: player.position.x + direction.x * distance,
					y: player.position.y,
					z: player.position.z + direction.z * distance,
				};
				const node = match.grid.nearestNode(point, 0);
				if (node === null) {
					continue;
				}
				const position = {
					x: point.x,
					y: match.grid.nodePosition(node).y,
					z: point.z,
				};
				if (
					Math.abs(position.y - player.position.y) < 0.6 &&
					match.world.distanceToWalls(
						position,
						position.y + 0.3,
						position.y + 1.6,
						DUMMY_WALL_CLEARANCE + 0.05,
					) >= DUMMY_WALL_CLEARANCE &&
					lineOfSight(match.world, eye, eyeOf(position), { blockGlass: true })
				) {
					return position;
				}
			}
		}
		const node = match.grid.nearestNode(player.position, 3);
		return node === null
			? { ...player.position }
			: match.grid.nodePosition(node);
	}

	private hiddenSpot(player: MatchPlayer): Vec3 {
		const match = this.match;
		const grid = match.grid;
		const level = match.gridLevelOf(player.position);
		const eye = player.eyePosition();
		let best: Vec3 = { ...player.position };
		let bestScore = -Infinity;
		for (let node = 0; node < grid.cellsPerLevel; node += 1) {
			const cell = level * grid.cellsPerLevel + node;
			if (!grid.walkable[cell] || !grid.isInMainComponent(cell)) {
				continue;
			}
			const point = grid.nodePosition(cell);
			const distance = Math.hypot(
				point.x - player.position.x,
				point.z - player.position.z,
			);
			if (distance < HIDDEN_SPAWN.min || distance > HIDDEN_SPAWN.max) {
				continue;
			}
			const hidden = !lineOfSight(match.world, eye, eyeOf(point));
			const score = (hidden ? 10 : 0) - Math.abs(distance - HIDDEN_SPAWN.ideal);
			if (score > bestScore) {
				bestScore = score;
				best = point;
			}
		}
		return best;
	}

	private roomMiddle(player: MatchPlayer): Vec3 | null {
		const match = this.match;
		const roomId = match.roomIdAt(player.position);
		const room = roomId === null ? null : match.layout.rooms[roomId];
		if (roomId === null || !room) {
			return null;
		}
		const nodes = this.roomNodes(roomId).filter(
			(point) => Math.abs(point.y - player.position.y) < 0.6,
		);
		const eye = player.eyePosition();
		let best: Vec3 | null = null;
		let bestScore = -Infinity;
		for (const point of nodes) {
			if (flatDistance(point, player.position) < DUMMY_MIN_GAP) {
				continue;
			}
			const open = nodes.filter(
				(other) => flatDistance(other, point) <= DUMMY_OPEN_RADIUS,
			).length;
			const score =
				open * 0.2 -
				flatDistance(point, room.labelPoint) * 0.35 +
				(lineOfSight(match.world, eye, eyeOf(point), { blockGlass: true })
					? 3
					: 0);
			if (score > bestScore) {
				bestScore = score;
				best = point;
			}
		}
		return best;
	}

	private roomNodes(roomId: number): Vec3[] {
		const match = this.match;
		const grid = match.grid;
		const points: Vec3[] = [];
		for (let cell = 0; cell < grid.cellsPerLevel * grid.levelCount; cell += 1) {
			if (!grid.walkable[cell] || !grid.isInMainComponent(cell)) {
				continue;
			}
			const point = grid.nodePosition(cell);
			if (match.roomIdAt(point) === roomId) {
				points.push(point);
			}
		}
		return points;
	}

	private standNear(
		target: Vec3,
		roomId: number,
		min: number,
		max: number,
	): Placement | null {
		const match = this.match;
		const ideal = (min + max) / 2;
		let best: Placement | null = null;
		let bestScore = Infinity;
		for (const point of this.roomNodes(roomId)) {
			const distance = Math.hypot(point.x - target.x, point.z - target.z);
			if (
				distance < min ||
				distance > max ||
				!lineOfSight(match.world, eyeOf(point), target, {
					ignoreFurniture: true,
					blockGlass: true,
				})
			) {
				continue;
			}
			const clearance = match.world.distanceToWalls(
				point,
				point.y + 0.3,
				point.y + 1.6,
				1,
			);
			const score = Math.abs(distance - ideal) - Math.min(clearance, 1) * 0.6;
			if (score < bestScore) {
				bestScore = score;
				best = { position: point, yaw: yawTowards(point, target) };
			}
		}
		return best;
	}

	private planStealth(): StealthPlan | null {
		const match = this.match;
		let best: StealthPlan | null = null;
		let bestScore = Infinity;
		for (const room of match.layout.rooms) {
			if (STEALTH_EXCLUDED.has(room.type) || room.level !== 0) {
				continue;
			}
			const nodes = this.roomNodes(room.id).filter(
				(_, index) => index % STEALTH_SAMPLE_STRIDE === 0,
			);
			for (let first = 0; first < nodes.length; first += 1) {
				for (let second = first + 1; second < nodes.length; second += 1) {
					const a = nodes[first];
					const b = nodes[second];
					const span = Math.hypot(a.x - b.x, a.z - b.z);
					const score = Math.abs(span - STEALTH_SPAN.ideal) - room.area / 400;
					if (
						span < STEALTH_SPAN.min ||
						span > STEALTH_SPAN.max ||
						score >= bestScore ||
						!match.grid.clearStraight(a, b, a.y, 0.45) ||
						!lineOfSight(match.world, eyeOf(a), eyeOf(b))
					) {
						continue;
					}
					bestScore = score;
					best = {
						roomId: room.id,
						player: { position: a, yaw: yawTowards(a, b) },
						monster: { position: b, yaw: yawTowards(b, a) },
					};
				}
			}
		}
		return best;
	}

	private closeRoom(roomId: number): void {
		const match = this.match;
		for (const openingId of match.layout.rooms[roomId]?.openingIds ?? []) {
			const door = match.layout.openings[openingId]?.door;
			if (door && match.doors.get(door.id)?.open) {
				if (match.setDoor(door.id, false, null)) {
					this.closedDoors.add(door.id);
				}
			}
		}
	}

	private reopenDoors(): void {
		for (const doorId of this.closedDoors) {
			if (!this.match.doors.get(doorId)?.open) {
				this.match.setDoor(doorId, true, null);
			}
		}
		this.closedDoors.clear();
	}
}
