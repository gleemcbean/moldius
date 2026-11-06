import {
	LEVEL_HEIGHT,
	MAX_UPPER_FLOORS,
	SLAB_THICKNESS,
} from "../config/index.js";
import { levelForHeight } from "../manor/levels.js";
import {
	pointInPolygon,
	segmentIntersectionParameter,
} from "../manor/polygon.js";
import type { OrientedBox } from "../manor/types.js";
import { rotate2, type Vec2, type Vec3 } from "../math.js";
import type { CollisionWorld } from "./collisionWorld.js";

export interface SightOptions {
	ignoreFurniture?: boolean;
	ignoreDoors?: boolean;
	ignoreBoxOwner?: number;
	blockGlass?: boolean;
}

export function lineOfSight(
	world: CollisionWorld,
	from: Vec3,
	to: Vec3,
	options: SightOptions = {},
): boolean {
	if (!crossesLevelsLegally(world, from, to)) {
		return false;
	}
	const bounds = {
		minX: Math.min(from.x, to.x),
		maxX: Math.max(from.x, to.x),
		minZ: Math.min(from.z, to.z),
		maxZ: Math.max(from.z, to.z),
	};
	const a2 = { x: from.x, z: from.z };
	const b2 = { x: to.x, z: to.z };
	for (const id of world.queryWalls(bounds)) {
		const wall = world.walls[id];
		if (wall.glass && !options.blockGlass) {
			continue;
		}
		const t = segmentIntersectionParameter(a2, b2, wall.a, wall.b);
		if (t === null) {
			continue;
		}
		const y = from.y + (to.y - from.y) * t;
		if (y >= wall.yMin && y <= wall.yMax) {
			return false;
		}
	}
	for (const id of world.queryBoxes(bounds)) {
		const box = world.boxes[id];
		if (!box.enabled || !box.occludes) {
			continue;
		}
		if (box.kind === "door" ? options.ignoreDoors : options.ignoreFurniture) {
			continue;
		}
		if (
			options.ignoreBoxOwner !== undefined &&
			box.kind === "furniture" &&
			box.ownerId === options.ignoreBoxOwner
		) {
			continue;
		}
		if (segmentHitsBox(from, to, box)) {
			return false;
		}
	}
	return true;
}

export function countWallsBetween(
	world: CollisionWorld,
	from: Vec3,
	to: Vec3,
	cap = 4,
): number {
	const bounds = {
		minX: Math.min(from.x, to.x),
		maxX: Math.max(from.x, to.x),
		minZ: Math.min(from.z, to.z),
		maxZ: Math.max(from.z, to.z),
	};
	const a2 = { x: from.x, z: from.z };
	const b2 = { x: to.x, z: to.z };
	let count = 0;
	const seenRooms = new Set<number>();
	for (const id of world.queryWalls(bounds)) {
		const wall = world.walls[id];
		const t = segmentIntersectionParameter(a2, b2, wall.a, wall.b);
		if (t === null) {
			continue;
		}
		const y = from.y + (to.y - from.y) * t;
		if (y >= wall.yMin && y <= wall.yMax && !seenRooms.has(wall.roomId)) {
			seenRooms.add(wall.roomId);
			count += 1;
			if (count >= cap) {
				return count;
			}
		}
	}
	for (const id of world.queryBoxes(bounds)) {
		const box = world.boxes[id];
		if (box.kind === "door" && box.enabled && segmentHitsBox(from, to, box)) {
			count += 1;
		}
	}
	const levelGap = Math.abs(levelOf(from.y) - levelOf(to.y));
	return Math.min(cap, count + levelGap * 2);
}

function levelOf(y: number): number {
	return levelForHeight(y, MAX_UPPER_FLOORS, 1.2);
}

function crossesLevelsLegally(
	world: CollisionWorld,
	from: Vec3,
	to: Vec3,
): boolean {
	const low = Math.min(from.y, to.y);
	const high = Math.max(from.y, to.y);
	if (Math.abs(to.y - from.y) < 1e-6) {
		return true;
	}
	for (let level = 1; level <= MAX_UPPER_FLOORS; level += 1) {
		const top = level * LEVEL_HEIGHT;
		const slabBottom = top - SLAB_THICKNESS;
		if (high < slabBottom || low > top) {
			continue;
		}
		for (const y of [slabBottom, top - SLAB_THICKNESS / 2, top]) {
			if (y < low || y > high) {
				continue;
			}
			const t = (y - from.y) / (to.y - from.y);
			const point = {
				x: from.x + (to.x - from.x) * t,
				z: from.z + (to.z - from.z) * t,
			};
			const open = world
				.regionsAt(point)
				.some(
					(region) =>
						region.floorY < slabBottom - 0.01 && region.ceilingY > top + 0.01,
				);
			if (!open) {
				return false;
			}
		}
	}
	for (const deck of world.decks) {
		for (const y of [deck.floorY - SLAB_THICKNESS, deck.floorY]) {
			if (y <= low || y >= high) {
				continue;
			}
			const t = (y - from.y) / (to.y - from.y);
			const point = {
				x: from.x + (to.x - from.x) * t,
				z: from.z + (to.z - from.z) * t,
			};
			if (pointInPolygon(point, deck.polygon)) {
				return false;
			}
		}
	}
	return true;
}

export function segmentHitsBox(
	from: Vec3,
	to: Vec3,
	box: OrientedBox,
): boolean {
	const start = rotate2(
		{ x: from.x - box.cx, z: from.z - box.cz },
		-box.rotation,
	);
	const end = rotate2({ x: to.x - box.cx, z: to.z - box.cz }, -box.rotation);
	const range = slabRange(start, end, box.hx, box.hz);
	if (!range) {
		return false;
	}
	const yEnter = from.y + (to.y - from.y) * range.enter;
	const yExit = from.y + (to.y - from.y) * range.exit;
	const low = Math.min(yEnter, yExit);
	const high = Math.max(yEnter, yExit);
	return high >= box.yMin && low <= box.yMax;
}

function slabRange(
	start: Vec2,
	end: Vec2,
	hx: number,
	hz: number,
): { enter: number; exit: number } | null {
	let enter = 0;
	let exit = 1;
	const delta = { x: end.x - start.x, z: end.z - start.z };
	for (const [origin, direction, half] of [
		[start.x, delta.x, hx],
		[start.z, delta.z, hz],
	] as const) {
		if (Math.abs(direction) < 1e-9) {
			if (origin < -half || origin > half) {
				return null;
			}
			continue;
		}
		let t0 = (-half - origin) / direction;
		let t1 = (half - origin) / direction;
		if (t0 > t1) {
			[t0, t1] = [t1, t0];
		}
		enter = Math.max(enter, t0);
		exit = Math.min(exit, t1);
		if (enter > exit) {
			return null;
		}
	}
	return { enter, exit };
}

export function movementCrossesWall(
	world: CollisionWorld,
	from: Vec3,
	to: Vec3,
	bodyHeight: number,
	ignoreRecentDoors: Set<number>,
): boolean {
	const bounds = {
		minX: Math.min(from.x, to.x),
		maxX: Math.max(from.x, to.x),
		minZ: Math.min(from.z, to.z),
		maxZ: Math.max(from.z, to.z),
	};
	const a2 = { x: from.x, z: from.z };
	const b2 = { x: to.x, z: to.z };
	const feet = Math.min(from.y, to.y);
	for (const id of world.queryWalls(bounds)) {
		const wall = world.walls[id];
		if (wall.yMax <= feet + 0.4 || wall.yMin >= feet + bodyHeight - 0.1) {
			continue;
		}
		if (segmentIntersectionParameter(a2, b2, wall.a, wall.b) !== null) {
			return true;
		}
	}
	for (const id of world.queryBoxes(bounds)) {
		const box = world.boxes[id];
		if (
			box.kind !== "door" ||
			!box.enabled ||
			ignoreRecentDoors.has(box.ownerId)
		) {
			continue;
		}
		const shrunk = { ...box, hx: Math.max(0.01, box.hx - 0.25), hz: 0.01 };
		if (
			segmentHitsBox(
				{ ...from, y: feet + 0.5 },
				{ ...to, y: feet + 0.5 },
				shrunk,
			)
		) {
			return true;
		}
	}
	return false;
}

export function pullBackToSight(
	world: CollisionWorld,
	from: Vec3,
	to: Vec3,
	margin: number,
): Vec3 {
	const options = { blockGlass: true };
	if (lineOfSight(world, from, to, options)) {
		return to;
	}
	const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
	const at = (t: number) => ({
		x: from.x + (to.x - from.x) * t,
		y: from.y + (to.y - from.y) * t,
		z: from.z + (to.z - from.z) * t,
	});
	let clear = 0;
	let blocked = 1;
	for (let step = 0; step < 10; step += 1) {
		const middle = (clear + blocked) / 2;
		if (lineOfSight(world, from, at(middle), options)) {
			clear = middle;
		} else {
			blocked = middle;
		}
	}
	return at(Math.max(0, clear - margin / Math.max(length, 1e-6)));
}
