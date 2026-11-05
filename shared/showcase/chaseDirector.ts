import { generateManor } from "../manor/generateManor.js";
import type { ManorLayout } from "../manor/types.js";
import { PUBLIC_MATCH_CONFIG } from "../matchConfig.js";
import type { Vec3 } from "../math.js";
import { NavGrid } from "../navigation/navGrid.js";
import { PathFinder } from "../navigation/pathfinding.js";
import {
	ClosedPath,
	findRoomLoop,
	type RoomLoop,
	smoothClosedPath,
} from "../navigation/roomLoop.js";
import { circleBoxPenetration } from "../physics/character.js";
import { CollisionWorld } from "../physics/collisionWorld.js";
import { lineOfSight } from "../physics/lineOfSight.js";

export const SHOWCASE_SEED = 21;
export const RUN_SPEED = 3.4;
const BASE_GAP = 2.7;
const LUNGE_GAP = 1.9;
const CAMERA_HEIGHT = 1.85;
const CAMERA_LEADS = [2.6, 3.3, 4, 4.7, 5.4, 6.1];
const CAMERA_OFFSETS = [-2.1, -1.4, -0.7, 0, 0.7, 1.4, 2.1];
const SWITCH_MARGIN = 2;
const CUT_COOLDOWN_SECONDS = 2.5;
const IDEAL_DISTANCE = 3.8;
const MIN_DISTANCE = 2.6;
const RUNNER_HEIGHTS = [0.35, 0.9, 1.55];
const HUNTER_HEIGHTS = [0.6, 1.4, 2.0];
const BLOCKED_CUT_SECONDS = 0.25;
const STUCK_CUT_SECONDS = 0.8;
const MIN_SHOT_SECONDS = 1.5;
const CHOOSE_SHARE = 0.79;
const KEEP_SHARE = 0.79;
const LOOKAHEAD_METERS = 1.6;
const HEADING_LEAD = 0.8;
const HUNTER_LEADS = [1.3, 1.1, 0.9, 0.7, 0.5];
const LUNGE_ROOM = 1.1;
const LUNGE_DOOR_DISTANCE = 1.8;
const TANGENT_SPAN = 0.6;
const OFFSET_SCALES = [1, 0.8, 0.6, 0.4, 0.2, 0];
const OFFSET_EASE = 5;
const AIM_LIMIT_COS = Math.cos((32 * Math.PI) / 180);
const BODY_RADIUS = 0.32;
const BODY_TOP = 1.6;
const CLEARANCE_STEP = 0.05;

export interface ChaseCourse {
	layout: ManorLayout;
	world: CollisionWorld;
	grid: NavGrid;
	loop: RoomLoop;
	path: ClosedPath;
	visibleRooms: number[];
}

export interface ChaseFrame {
	runner: Vec3;
	runnerYaw: number;
	hunter: Vec3;
	hunterYaw: number;
	lunge: number;
	camera: Vec3;
	target: Vec3;
}

interface Framing {
	lead: number;
	offset: number;
}

function fallbackLoop(layout: ManorLayout, finder: PathFinder): RoomLoop {
	const rooms = layout.rooms.filter(
		(room) => room.level === 0 && room.type !== "stairwell",
	);
	const start = rooms[0];
	const distanceFrom = (room: (typeof rooms)[number]) =>
		Math.hypot(
			room.labelPoint.x - start.labelPoint.x,
			room.labelPoint.z - start.labelPoint.z,
		);
	const far = rooms.reduce((best, room) =>
		distanceFrom(room) > distanceFrom(best) ? room : best,
	);
	const from = {
		x: start.labelPoint.x,
		y: start.floorY,
		z: start.labelPoint.z,
	};
	const to = { x: far.labelPoint.x, y: far.floorY, z: far.labelPoint.z };
	const path =
		finder.findPath(from, to, {
			canOpenDoors: true,
			isDoorClosed: () => false,
		}) ?? [];
	const outward: Vec3[] = [
		from,
		...path.map((point) => ({ x: point.x, y: point.y, z: point.z })),
	];
	const points = [...outward, ...outward.slice(1, -1).reverse()];
	return { rooms: [start.id, far.id], openings: [], points, length: 0 };
}

export function randomChaseCourse(
	random: () => number = Math.random,
	attempts = 6,
): ChaseCourse {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		const course = buildChaseCourse(Math.floor(random() * 2 ** 31));
		if (course.loop.rooms.length >= 4) {
			return course;
		}
	}
	return buildChaseCourse(SHOWCASE_SEED);
}

export function buildChaseCourse(seed: number): ChaseCourse {
	const layout = generateManor(seed, {
		...PUBLIC_MATCH_CONFIG,
		manorSize: "small",
		floors: 0,
	});
	const world = new CollisionWorld(layout);
	const grid = new NavGrid(world);
	const finder = new PathFinder(grid);
	const loop =
		findRoomLoop(layout, finder, {
			level: 0,
			minRooms: 4,
			maxRooms: 8,
			minLength: 28,
			maxLength: 75,
		}) ?? fallbackLoop(layout, finder);
	for (const openingId of loop.openings) {
		const door = layout.openings[openingId].door;
		if (door) {
			world.setDoorClosed(door.id, false);
		}
	}
	const visible = new Set<number>(loop.rooms);
	for (const id of loop.rooms) {
		for (const openingId of layout.rooms[id].openingIds) {
			const opening = layout.openings[openingId];
			visible.add(opening.roomA);
			visible.add(opening.roomB);
		}
	}
	return {
		layout,
		world,
		grid,
		loop,
		path: new ClosedPath(
			smoothClosedPath(loop.points, 2, (from, to) =>
				clearSegment(world, from, to),
			),
		),
		visibleRooms: [...visible],
	};
}

export function bodyFits(world: CollisionWorld, point: Vec3): boolean {
	const bottom = point.y + 0.1;
	const top = point.y + BODY_TOP;
	if (
		world.distanceToWalls(point, bottom, top, BODY_RADIUS + 0.1) < BODY_RADIUS
	) {
		return false;
	}
	const bounds = {
		minX: point.x - BODY_RADIUS,
		maxX: point.x + BODY_RADIUS,
		minZ: point.z - BODY_RADIUS,
		maxZ: point.z + BODY_RADIUS,
	};
	return world.queryBoxes(bounds).every((id) => {
		const box = world.boxes[id];
		return (
			!box.enabled ||
			box.walkable ||
			box.soft ||
			box.yMax <= bottom ||
			box.yMin >= top ||
			circleBoxPenetration(point.x, point.z, BODY_RADIUS, box) === null
		);
	});
}

function clearSegment(world: CollisionWorld, from: Vec3, to: Vec3): boolean {
	const steps = Math.max(
		1,
		Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / CLEARANCE_STEP),
	);
	for (let step = 0; step <= steps; step += 1) {
		if (!bodyFits(world, lerp(from, to, step / steps))) {
			return false;
		}
	}
	return true;
}

function yawOf(direction: { x: number; z: number }): number {
	return Math.atan2(-direction.x, -direction.z);
}

function approachAngle(
	current: number,
	target: number,
	amount: number,
): number {
	const delta = Math.atan2(
		Math.sin(target - current),
		Math.cos(target - current),
	);
	return current + delta * Math.min(1, amount);
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
	return {
		x: a.x + (b.x - a.x) * t,
		y: a.y + (b.y - a.y) * t,
		z: a.z + (b.z - a.z) * t,
	};
}

export class ChaseDirector {
	private time = 0;
	private runnerYaw = 0;
	private hunterYaw = 0;
	private framing: Framing = { lead: CAMERA_LEADS[1], offset: 0 };
	private target: Vec3 = { x: 0, y: 0, z: 0 };
	private blockedFor = 0;
	private placed = false;
	private lastCut = -Infinity;
	private lungeRoom = 1;
	private offsetScale = 1;

	constructor(private readonly course: ChaseCourse) {}

	update(dt: number): ChaseFrame {
		this.time += dt;
		const path = this.course.path;
		const gap =
			BASE_GAP +
			Math.sin(this.time * 0.85) * 0.9 +
			Math.sin(this.time * 2.3) * 0.3;
		const runnerDistance = this.time * RUN_SPEED;
		const runnerSample = path.sample(runnerDistance);
		const hunterSample = path.sample(runnerDistance - gap);
		const runnerHeading = this.headingAt(runnerDistance);
		const hunterReach = this.clearReach(runnerDistance - gap);
		if (!this.placed) {
			this.runnerYaw = runnerHeading;
			this.hunterYaw = hunterReach.yaw;
		}
		this.runnerYaw = approachAngle(this.runnerYaw, runnerHeading, dt * 8);
		this.hunterYaw = approachAngle(this.hunterYaw, hunterReach.yaw, dt * 6);
		const roomy =
			hunterReach.lead >= LUNGE_ROOM &&
			!this.nearDoorway(hunterSample.position);
		this.lungeRoom += ((roomy ? 1 : 0) - this.lungeRoom) * Math.min(1, dt * 6);
		const runner = runnerSample.position;
		const hunter = hunterSample.position;
		const camera = this.placeCamera(runnerDistance, runner, hunter, dt);
		return {
			runner,
			runnerYaw: this.runnerYaw,
			hunter,
			hunterYaw: this.hunterYaw,
			lunge: Math.max(0, Math.min(1, (LUNGE_GAP - gap) / 0.6)) * this.lungeRoom,
			camera,
			target: { ...this.target },
		};
	}

	private nearDoorway(point: Vec3): boolean {
		return this.course.loop.openings.some((id) => {
			const opening = this.course.layout.openings[id];
			return (
				Math.hypot(
					(opening.start.x + opening.end.x) / 2 - point.x,
					(opening.start.z + opening.end.z) / 2 - point.z,
				) < LUNGE_DOOR_DISTANCE
			);
		});
	}

	private clearReach(distance: number): { yaw: number; lead: number } {
		const path = this.course.path;
		const here = path.sample(distance).position;
		for (const lead of HUNTER_LEADS) {
			const ahead = path.sample(distance + lead).position;
			if (
				lead === HUNTER_LEADS[HUNTER_LEADS.length - 1] ||
				clearSegment(this.course.world, here, ahead)
			) {
				return {
					yaw: yawOf({ x: ahead.x - here.x, z: ahead.z - here.z }),
					lead,
				};
			}
		}
		return { yaw: this.hunterYaw, lead: 0 };
	}

	private headingAt(distance: number): number {
		const here = this.course.path.sample(distance).position;
		const ahead = this.course.path.sample(distance + HEADING_LEAD).position;
		return yawOf({ x: ahead.x - here.x, z: ahead.z - here.z });
	}

	visibleShare(
		eye: Vec3,
		base: Vec3,
		heights: number[],
		radius: number,
	): number {
		const toward = { x: base.x - eye.x, z: base.z - eye.z };
		const length = Math.hypot(toward.x, toward.z) || 1;
		const side = { x: -toward.z / length, z: toward.x / length };
		const targets: Vec3[] = heights.map((height) => ({
			x: base.x,
			y: base.y + height,
			z: base.z,
		}));
		const middle = heights[Math.floor(heights.length / 2)];
		for (const sign of [-1, 1]) {
			targets.push({
				x: base.x + side.x * radius * sign,
				y: base.y + middle,
				z: base.z + side.z * radius * sign,
			});
		}
		const world = this.course.world;
		return (
			targets.filter((target) => lineOfSight(world, eye, target)).length /
			targets.length
		);
	}

	runnerShare(eye: Vec3, runner: Vec3): number {
		return this.visibleShare(eye, runner, RUNNER_HEIGHTS, 0.32);
	}

	private scaledViewpoint(runnerDistance: number, scale: number): Vec3 {
		return this.viewpoint(runnerDistance, {
			lead: this.framing.lead,
			offset: this.framing.offset * scale,
		});
	}

	private offsetFit(runnerDistance: number): number {
		for (const scale of OFFSET_SCALES) {
			if (this.roomAround(this.scaledViewpoint(runnerDistance, scale), 0.3)) {
				return scale;
			}
		}
		return 0;
	}

	private tangentAt(distance: number): Vec3 {
		const path = this.course.path;
		const behind = path.sample(distance - TANGENT_SPAN).position;
		const ahead = path.sample(distance + TANGENT_SPAN).position;
		const length = Math.hypot(ahead.x - behind.x, ahead.z - behind.z);
		if (length < 1e-3) {
			return path.sample(distance).direction;
		}
		return {
			x: (ahead.x - behind.x) / length,
			y: 0,
			z: (ahead.z - behind.z) / length,
		};
	}

	private viewpoint(runnerDistance: number, framing: Framing): Vec3 {
		const distance = runnerDistance + framing.lead;
		const position = this.course.path.sample(distance).position;
		const direction = this.tangentAt(distance);
		return {
			x: position.x - direction.z * framing.offset,
			y: position.y + CAMERA_HEIGHT,
			z: position.z + direction.x * framing.offset,
		};
	}

	private usable(eye: Vec3, runner: Vec3, share: number): boolean {
		return this.roomAround(eye, 0.4) && this.runnerShare(eye, runner) >= share;
	}

	private roomAround(eye: Vec3, clearance: number): boolean {
		const ground = { x: eye.x, y: eye.y - CAMERA_HEIGHT, z: eye.z };
		return (
			this.course.grid.nearestNode(ground, 0) !== null &&
			this.course.world.distanceToWalls(
				ground,
				ground.y + 0.2,
				ground.y + 2.4,
				1,
			) >= clearance
		);
	}

	private holds(
		runnerDistance: number,
		framing: Framing,
		share: number,
	): boolean {
		const future = runnerDistance + LOOKAHEAD_METERS;
		return this.usable(
			this.viewpoint(future, framing),
			this.course.path.sample(future).position,
			share,
		);
	}

	private score(
		runnerDistance: number,
		framing: Framing,
		runner: Vec3,
		hunter: Vec3,
		heading: Vec3,
	): number {
		const eye = this.viewpoint(runnerDistance, framing);
		const distance = Math.hypot(eye.x - runner.x, eye.z - runner.z);
		const facing =
			((eye.x - runner.x) * heading.x + (eye.z - runner.z) * heading.z) /
			Math.max(distance, 0.01);
		return (
			this.visibleShare(eye, hunter, HUNTER_HEIGHTS, 0.3) * 4 +
			this.visibleShare(eye, runner, [1.0], 0.9) * 2 +
			facing * 1.5 +
			(this.holds(runnerDistance, framing, CHOOSE_SHARE) ? 6 : 0) -
			Math.abs(distance - IDEAL_DISTANCE) * 0.8 -
			Math.max(0, MIN_DISTANCE - distance) * 4 -
			Math.abs(framing.offset) * 0.2
		);
	}

	private bestFraming(
		runnerDistance: number,
		runner: Vec3,
		hunter: Vec3,
	): Framing | null {
		const heading = this.tangentAt(runnerDistance);
		let best: (Framing & { score: number }) | null = null;
		for (const lead of CAMERA_LEADS) {
			for (const offset of CAMERA_OFFSETS) {
				const framing = { lead, offset };
				if (
					!this.usable(
						this.viewpoint(runnerDistance, framing),
						runner,
						CHOOSE_SHARE,
					)
				) {
					continue;
				}
				const continuity = this.placed
					? Math.abs(lead - this.framing.lead) * 0.35 +
						Math.abs(offset - this.framing.offset) * 0.6
					: 0;
				const value =
					this.score(runnerDistance, framing, runner, hunter, heading) -
					continuity;
				if (!best || value > best.score) {
					best = { lead, offset, score: value };
				}
			}
		}
		if (!best || !this.placed) {
			return best;
		}
		const currentEye = this.viewpoint(runnerDistance, this.framing);
		const keeps =
			this.usable(currentEye, runner, KEEP_SHARE) &&
			this.holds(runnerDistance, this.framing, KEEP_SHARE);
		if (keeps) {
			const current = this.score(
				runnerDistance,
				this.framing,
				runner,
				hunter,
				heading,
			);
			if (current + SWITCH_MARGIN >= best.score) {
				return { ...this.framing };
			}
		}
		return best;
	}

	private focus(eye: Vec3, runner: Vec3, hunter: Vec3): Vec3 {
		const weight =
			this.visibleShare(eye, hunter, HUNTER_HEIGHTS, 0.3) >= 0.6 ? 0.3 : 0;
		return {
			x: runner.x * (1 - weight) + hunter.x * weight,
			y: runner.y + 1.0 + weight * 0.3,
			z: runner.z * (1 - weight) + hunter.z * weight,
		};
	}

	private cut(
		runnerDistance: number,
		framing: Framing,
		runner: Vec3,
		hunter: Vec3,
	): Vec3 {
		this.framing = { ...framing };
		this.lastCut = this.time;
		const eye = this.viewpoint(runnerDistance, framing);
		this.target = this.focus(eye, runner, hunter);
		this.blockedFor = 0;
		this.placed = true;
		this.offsetScale = 1;
		return eye;
	}

	private placeCamera(
		runnerDistance: number,
		runner: Vec3,
		hunter: Vec3,
		dt: number,
	): Vec3 {
		const goal = this.bestFraming(runnerDistance, runner, hunter);
		if (goal && !this.placed) {
			return this.cut(runnerDistance, goal, runner, hunter);
		}
		if (goal) {
			const halfway = this.viewpoint(runnerDistance, {
				lead: (goal.lead + this.framing.lead) / 2,
				offset: (goal.offset + this.framing.offset) / 2,
			});
			const glide = this.usable(halfway, runner, KEEP_SHARE);
			if (!glide && this.time - this.lastCut > CUT_COOLDOWN_SECONDS) {
				return this.cut(runnerDistance, goal, runner, hunter);
			}
			if (glide) {
				const rate = Math.min(1, dt * 2.4);
				this.framing.lead += (goal.lead - this.framing.lead) * rate;
				this.framing.offset += (goal.offset - this.framing.offset) * rate;
			}
		}
		const fit = this.offsetFit(runnerDistance);
		this.offsetScale +=
			(fit - this.offsetScale) * Math.min(1, dt * OFFSET_EASE);
		let eye = this.scaledViewpoint(runnerDistance, this.offsetScale);
		if (!this.roomAround(eye, 0.15)) {
			this.offsetScale = fit;
			eye = this.scaledViewpoint(runnerDistance, fit);
		}
		this.blockedFor = this.usable(eye, runner, KEEP_SHARE)
			? 0
			: this.blockedFor + dt;
		const shotAge = this.time - this.lastCut;
		const forced =
			this.blockedFor > STUCK_CUT_SECONDS ||
			(this.blockedFor > BLOCKED_CUT_SECONDS && shotAge > MIN_SHOT_SECONDS);
		if (goal && forced) {
			return this.cut(runnerDistance, goal, runner, hunter);
		}
		const focus = this.focus(eye, runner, hunter);
		this.target = lerp(this.target, focus, Math.min(1, dt * 7));
		const look = { x: this.target.x - eye.x, z: this.target.z - eye.z };
		const toward = { x: runner.x - eye.x, z: runner.z - eye.z };
		const alignment =
			(look.x * toward.x + look.z * toward.z) /
			(Math.hypot(look.x, look.z) * Math.hypot(toward.x, toward.z) || 1);
		if (alignment < AIM_LIMIT_COS) {
			this.target = focus;
		}
		return eye;
	}
}
