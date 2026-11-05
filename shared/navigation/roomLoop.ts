import type { Level, ManorLayout, Opening } from "../manor/types.js";
import type { Vec3 } from "../math.js";
import type { PathFinder } from "./pathfinding.js";

export interface RoomLoop {
	rooms: number[];
	openings: number[];
	points: Vec3[];
	length: number;
}

export interface RoomLoopOptions {
	level: Level;
	minRooms: number;
	maxRooms: number;
	minLength: number;
	maxLength: number;
}

const BACKTRACK_COSINE = -0.2;

interface Link {
	room: number;
	opening: number;
}

function openingMiddle(opening: Opening): Vec3 {
	return {
		x:
			(opening.start.x + opening.end.x) / 2 +
			(opening.normal.x * opening.depth) / 2,
		y: opening.floorY,
		z:
			(opening.start.z + opening.end.z) / 2 +
			(opening.normal.z * opening.depth) / 2,
	};
}

function adjacency(layout: ManorLayout, level: Level): Map<number, Link[]> {
	const links = new Map<number, Link[]>();
	for (const opening of layout.openings) {
		const a = layout.rooms[opening.roomA];
		const b = layout.rooms[opening.roomB];
		if (opening.level !== level || a.level !== level || b.level !== level) {
			continue;
		}
		if (
			opening.kind === "window" ||
			a.type === "stairwell" ||
			b.type === "stairwell"
		) {
			continue;
		}
		links.set(a.id, [
			...(links.get(a.id) ?? []),
			{ room: b.id, opening: opening.id },
		]);
		links.set(b.id, [
			...(links.get(b.id) ?? []),
			{ room: a.id, opening: opening.id },
		]);
	}
	return links;
}

function shortestCycleThrough(
	links: Map<number, Link[]>,
	from: number,
	to: number,
	excluded: number,
): Link[] | null {
	const previous = new Map<number, Link & { parent: number }>();
	const queue = [from];
	const visited = new Set([from]);
	while (queue.length > 0) {
		const current = queue.shift() as number;
		if (current === to) {
			const path: Link[] = [];
			let cursor = to;
			while (cursor !== from) {
				const step = previous.get(cursor) as Link & { parent: number };
				path.unshift({ room: cursor, opening: step.opening });
				cursor = step.parent;
			}
			return path;
		}
		for (const link of links.get(current) ?? []) {
			if (link.opening === excluded || visited.has(link.room)) {
				continue;
			}
			visited.add(link.room);
			previous.set(link.room, { ...link, parent: current });
			queue.push(link.room);
		}
	}
	return null;
}

function candidateLoops(
	layout: ManorLayout,
	level: Level,
): { rooms: number[]; openings: number[] }[] {
	const links = adjacency(layout, level);
	const seen = new Set<string>();
	const loops: { rooms: number[]; openings: number[] }[] = [];
	for (const opening of layout.openings) {
		const a = opening.roomA;
		const b = opening.roomB;
		if (!links.get(a)?.some((link) => link.opening === opening.id)) {
			continue;
		}
		const back = shortestCycleThrough(links, b, a, opening.id);
		if (!back) {
			continue;
		}
		const rooms = [a, b, ...back.map((link) => link.room).slice(0, -1)];
		const openings = [opening.id, ...back.map((link) => link.opening)];
		const key = [...openings].sort((x, y) => x - y).join(",");
		if (!seen.has(key)) {
			seen.add(key);
			loops.push({ rooms, openings });
		}
	}
	return loops;
}

function pointLength(points: Vec3[], closed: boolean): number {
	let length = 0;
	const count = closed ? points.length : points.length - 1;
	for (let index = 0; index < count; index += 1) {
		const a = points[index];
		const b = points[(index + 1) % points.length];
		length += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
	}
	return length;
}

function traceLoop(
	layout: ManorLayout,
	finder: PathFinder,
	level: Level,
	loop: { rooms: number[]; openings: number[] },
): Vec3[] | null {
	const points: Vec3[] = [];
	const count = loop.openings.length;
	for (let index = 0; index < count; index += 1) {
		const entry = openingMiddle(layout.openings[loop.openings[index]]);
		const exit = openingMiddle(
			layout.openings[loop.openings[(index + 1) % count]],
		);
		const path = finder.findPath(entry, exit, {
			canOpenDoors: true,
			isDoorClosed: () => false,
		});
		if (!path || path.length === 0) {
			return null;
		}
		const segment: Vec3[] = [
			entry,
			...path.map((point) => ({ x: point.x, y: point.y, z: point.z })),
		];
		const direct = Math.hypot(exit.x - entry.x, exit.z - entry.z);
		if (pointLength(segment, false) > direct * 2.2 + 3) {
			return null;
		}
		for (const point of segment) {
			const last = points[points.length - 1];
			if (!last || Math.hypot(point.x - last.x, point.z - last.z) > 0.05) {
				points.push(point);
			}
		}
	}
	return removeBacktracks(points, finder, level);
}

function removeBacktracks(
	points: Vec3[],
	finder: PathFinder,
	level: Level,
): Vec3[] {
	const result = [...points];
	let changed = true;
	while (changed && result.length > 3) {
		changed = false;
		for (let index = 0; index < result.length && result.length > 3; ) {
			const before = result[(index - 1 + result.length) % result.length];
			const point = result[index];
			const after = result[(index + 1) % result.length];
			if (
				turnCosine(before, point, after) < BACKTRACK_COSINE &&
				finder.walkableLine(before, after, level)
			) {
				result.splice(index, 1);
				const next = index % result.length;
				if (
					Math.hypot(result[next].x - before.x, result[next].z - before.z) <
					0.05
				) {
					result.splice(next, 1);
				}
				changed = true;
			} else {
				index += 1;
			}
		}
	}
	return result;
}

function turnCosine(before: Vec3, point: Vec3, after: Vec3): number {
	const inX = point.x - before.x;
	const inZ = point.z - before.z;
	const outX = after.x - point.x;
	const outZ = after.z - point.z;
	const lengths = Math.hypot(inX, inZ) * Math.hypot(outX, outZ);
	return lengths > 0 ? (inX * outX + inZ * outZ) / lengths : 1;
}

export function findRoomLoop(
	layout: ManorLayout,
	finder: PathFinder,
	options: RoomLoopOptions,
): RoomLoop | null {
	let best: { loop: RoomLoop; score: number } | null = null;
	for (const loop of candidateLoops(layout, options.level)) {
		if (
			loop.rooms.length < options.minRooms ||
			loop.rooms.length > options.maxRooms
		) {
			continue;
		}
		const points = traceLoop(layout, finder, options.level, loop);
		if (!points) {
			continue;
		}
		const length = pointLength(points, true);
		if (length < options.minLength || length > options.maxLength) {
			continue;
		}
		const themed = loop.rooms.filter(
			(id) => layout.rooms[id].type !== "corridor",
		).length;
		const lit = loop.rooms.filter((id) =>
			layout.lights.some((light) => light.roomId === id),
		).length;
		const score =
			themed * 2 + lit + loop.rooms.length * 0.5 - Math.abs(length - 45) * 0.05;
		if (!best || score > best.score) {
			best = { loop: { ...loop, points, length }, score };
		}
	}
	return best?.loop ?? null;
}

export function smoothClosedPath(
	points: Vec3[],
	iterations: number,
	canCut: (from: Vec3, to: Vec3) => boolean = () => true,
): Vec3[] {
	let current = points;
	for (let round = 0; round < iterations; round += 1) {
		const next: Vec3[] = [];
		for (let index = 0; index < current.length; index += 1) {
			const before = current[(index - 1 + current.length) % current.length];
			const corner = current[index];
			const after = current[(index + 1) % current.length];
			const entry = mix(before, corner, 0.75);
			const exit = mix(corner, after, 0.25);
			next.push(entry);
			if (!canCut(entry, exit)) {
				next.push(corner);
			}
			next.push(exit);
		}
		current = next;
	}
	return current;
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
	return {
		x: a.x + (b.x - a.x) * t,
		y: a.y + (b.y - a.y) * t,
		z: a.z + (b.z - a.z) * t,
	};
}

export class ClosedPath {
	private readonly cumulative: number[] = [0];
	readonly length: number;

	constructor(readonly points: Vec3[]) {
		for (let index = 0; index < points.length; index += 1) {
			const a = points[index];
			const b = points[(index + 1) % points.length];
			this.cumulative.push(
				this.cumulative[index] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z),
			);
		}
		this.length = this.cumulative[this.cumulative.length - 1];
	}

	sample(distance: number): { position: Vec3; direction: Vec3 } {
		const wrapped = ((distance % this.length) + this.length) % this.length;
		let low = 0;
		let high = this.points.length - 1;
		while (low < high) {
			const middle = (low + high + 1) >> 1;
			if (this.cumulative[middle] <= wrapped) {
				low = middle;
			} else {
				high = middle - 1;
			}
		}
		const a = this.points[low];
		const b = this.points[(low + 1) % this.points.length];
		const span = this.cumulative[low + 1] - this.cumulative[low];
		const t = span > 0 ? (wrapped - this.cumulative[low]) / span : 0;
		const direction = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
		const norm = Math.hypot(direction.x, direction.y, direction.z) || 1;
		return {
			position: {
				x: a.x + direction.x * t,
				y: a.y + direction.y * t,
				z: a.z + direction.z * t,
			},
			direction: {
				x: direction.x / norm,
				y: direction.y / norm,
				z: direction.z / norm,
			},
		};
	}
}
