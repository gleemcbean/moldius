import {
	LEVEL_HEIGHT,
	MANOR_OPENING_EDGE_MARGIN,
	MANOR_OPENING_SPACING,
	MAX_UPPER_FLOORS,
	WALL_GAP,
} from "../config/index.js";
import { distance2, dot2, rotate2, type Vec2 } from "../math.js";
import type { SeededRandom } from "../random.js";
import {
	boundsOverlap,
	cleanPoint,
	edgeDirection,
	edgeLength,
	pointInPolygon,
	poleOfInaccessibility,
	polygonBounds,
	polygonsOverlap,
	signedArea,
	snapAngle,
	tessellateOutline,
} from "./polygon.js";
import {
	createRoomShape,
	pickRoomHeight,
	pickRoomStyle,
	ROOM_TYPES,
	type RoomShape,
	spansLevelAbove,
} from "./roomCatalog.js";
import {
	corridorPathVertices,
	outlineFromVertices,
	rectangleVertices,
	SQUARE,
	transformEdges,
} from "./shapes.js";
import type {
	Bounds,
	Level,
	LineEdge,
	Opening,
	OpeningKind,
	OutlineEdge,
	Room,
	RoomType,
	StairSpec,
} from "./types.js";

export const STAIR_WIDTH = 2.6;
export const STAIR_STEP_COUNT = 22;
export const STAIR_RISE = LEVEL_HEIGHT / STAIR_STEP_COUNT;
export const STAIR_TREAD = 0.245;
export const STAIR_BOTTOM_LANDING = 1.0;
export const STAIR_RUN = STAIR_STEP_COUNT * STAIR_TREAD;
export const STAIR_LENGTH =
	Math.round((STAIR_BOTTOM_LANDING * 2 + STAIR_RUN) * 4) / 4;

interface Occupant {
	polygon: Vec2[];
	bounds: Bounds;
	levels: number[];
	roomId: number | null;
	openingId: number | null;
}

interface OpeningRequest {
	roomA: Room;
	edgeA: number;
	center: Vec2;
	roomB: Room;
	edgeB: number;
	width: number;
	height: number;
	kind: OpeningKind;
	depth?: number;
	sill?: number;
}

const CORRIDOR_EXIT_LENGTH = 1.7 + MANOR_OPENING_EDGE_MARGIN * 2;

export class ManorLayoutBuilder {
	readonly rooms: Room[] = [];
	readonly openings: Opening[] = [];
	private readonly occupants: Occupant[] = [];
	private readonly halfExtent: number;
	private doorCounter = 0;

	constructor(
		private readonly rng: SeededRandom,
		halfExtent: number,
	) {
		this.halfExtent = halfExtent;
	}

	createFirstRoom(type: RoomType): Room {
		const definition = ROOM_TYPES[type];
		const shape = createRoomShape(definition, this.rng, 1.05);
		const local = tessellateOutline(shape.edges);
		const bounds = polygonBounds(local);
		const offset = {
			x: -(bounds.minX + bounds.maxX) / 2,
			z: -(bounds.minZ + bounds.maxZ) / 2,
		};
		const edges = transformEdges(shape.edges, 0, offset);
		return this.registerRoom(type, 0, edges, 0, null);
	}

	tryAttachRoom(
		parent: Room,
		type: RoomType,
		level: Level,
		attempts = 14,
	): Room | null {
		const definition = ROOM_TYPES[type];
		for (let attempt = 0; attempt < attempts; attempt += 1) {
			const sizeFactor = attempt < attempts / 2 ? 1 : 0.85;
			const shape = createRoomShape(definition, this.rng, sizeFactor);
			if (type === "corridor" && level > 0 && !leadsOn(shape)) {
				continue;
			}
			const room = this.tryAttachShape(parent, type, level, shape, null);
			if (room) {
				return room;
			}
		}
		return null;
	}

	tryAttachStairwell(parent: Room): Room | null {
		if (parent.level >= MAX_UPPER_FLOORS) {
			return null;
		}
		const edges = outlineFromVertices(
			rectangleVertices(STAIR_WIDTH, STAIR_LENGTH),
			[SQUARE, SQUARE, SQUARE, SQUARE],
		);
		const shape: RoomShape = { edges, family: "rect" };
		for (let attempt = 0; attempt < 10; attempt += 1) {
			const room = this.tryAttachShape(
				parent,
				"stairwell",
				parent.level,
				shape,
				0,
			);
			if (room) {
				return room;
			}
		}
		return null;
	}

	removeRoom(room: Room): void {
		for (const openingId of [...room.openingIds]) {
			const opening = this.openings[openingId];
			if (!opening) {
				continue;
			}
			const other =
				this.rooms[opening.roomA === room.id ? opening.roomB : opening.roomA];
			if (other) {
				other.openingIds = other.openingIds.filter((id) => id !== openingId);
				other.edgeOpenings = other.edgeOpenings.map((slots) =>
					slots.filter((slot) => slot.openingId !== openingId),
				);
			}
			this.openings[openingId] = { ...opening, width: 0 };
		}
		const removedOpenings = new Set(room.openingIds);
		const occupantIndexes = this.occupants
			.map((occupant, index) => ({ occupant, index }))
			.filter(
				({ occupant }) =>
					occupant.roomId === room.id ||
					(occupant.openingId !== null &&
						removedOpenings.has(occupant.openingId)),
			)
			.map(({ index }) => index)
			.reverse();
		for (const index of occupantIndexes) {
			this.occupants.splice(index, 1);
		}
		room.openingIds = [];
		room.type = "corridor";
		room.area = -1;
	}

	compact(): { rooms: Room[]; openings: Opening[] } {
		const liveRooms = this.rooms.filter((room) => room.area > 0);
		const roomIdMap = new Map(liveRooms.map((room, index) => [room.id, index]));
		const liveOpenings = this.openings.filter(
			(opening) =>
				opening.width > 0 &&
				roomIdMap.has(opening.roomA) &&
				roomIdMap.has(opening.roomB),
		);
		const openingIdMap = new Map(
			liveOpenings.map((opening, index) => [opening.id, index]),
		);
		let doorId = 0;
		const openings = liveOpenings.map((opening, index) => ({
			...opening,
			id: index,
			roomA: roomIdMap.get(opening.roomA) as number,
			roomB: roomIdMap.get(opening.roomB) as number,
			door: opening.door ? { ...opening.door, id: doorId++ } : null,
		}));
		const rooms = liveRooms.map((room, index) => ({
			...room,
			id: index,
			openingIds: room.openingIds
				.filter((id) => openingIdMap.has(id))
				.map((id) => openingIdMap.get(id) as number),
			edgeOpenings: room.edgeOpenings.map((slots) =>
				slots
					.filter((slot) => openingIdMap.has(slot.openingId))
					.map((slot) => ({
						...slot,
						openingId: openingIdMap.get(slot.openingId) as number,
					})),
			),
		}));
		return { rooms, openings };
	}

	graphDistance(from: number, to: number): number {
		const visited = new Map<number, number>([[from, 0]]);
		const queue = [from];
		while (queue.length > 0) {
			const current = queue.shift() as number;
			const depth = visited.get(current) as number;
			if (current === to) {
				return depth;
			}
			for (const openingId of this.rooms[current].openingIds) {
				const opening = this.openings[openingId];
				if (opening.kind === "window") {
					continue;
				}
				const next = opening.roomA === current ? opening.roomB : opening.roomA;
				if (!visited.has(next)) {
					visited.set(next, depth + 1);
					queue.push(next);
				}
			}
		}
		return Infinity;
	}

	addLoops(level: Level, maxLoops: number): number {
		let created = 0;
		const candidates = this.rooms.filter((room) =>
			this.canHostLoop(room, level),
		);
		const pairs: [Room, Room][] = [];
		for (let i = 0; i < candidates.length; i += 1) {
			for (let j = i + 1; j < candidates.length; j += 1) {
				const a = candidates[i];
				const b = candidates[j];
				if (boundsOverlap(a.bounds, b.bounds, 14)) {
					pairs.push([a, b]);
				}
			}
		}
		for (const [a, b] of this.rng.shuffle(pairs)) {
			if (created >= maxLoops) {
				break;
			}
			if (this.graphDistance(a.id, b.id) < 3) {
				continue;
			}
			if (this.tryBridge(a, b) || this.tryElbowBridge(a, b)) {
				created += 1;
			}
		}
		return created;
	}

	computeExteriorEdges(): void {
		for (const room of this.rooms) {
			room.exteriorEdges = room.edges.map((edge) =>
				this.isExteriorEdge(room, edge),
			);
		}
	}

	private canHostLoop(room: Room, level: Level): boolean {
		return (
			room.level === level &&
			room.area > 0 &&
			room.type !== "stairwell" &&
			!ROOM_TYPES[room.type].singleDoor
		);
	}

	private tryAttachShape(
		parent: Room,
		type: RoomType,
		level: Level,
		shape: RoomShape,
		forcedChildEdge: number | null,
	): Room | null {
		const parentEdges = this.attachableEdges(parent, level);
		if (parentEdges.length === 0) {
			return null;
		}
		const childEdgeIndexes =
			forcedChildEdge !== null
				? [forcedChildEdge]
				: shape.edges
						.map((edge, index) => ({ edge, index }))
						.filter(
							({ edge }) => edge.kind === "line" && edgeLength(edge) >= 1.8,
						)
						.map(({ index }) => index);
		if (childEdgeIndexes.length === 0) {
			return null;
		}

		const parentEdgeIndex = this.rng.weighted(
			parentEdges.map((index) => {
				const edge = parent.edges[index];
				const direction = edgeDirection(edge);
				const diagonal =
					Math.abs(direction.x) > 0.1 && Math.abs(direction.z) > 0.1;
				return [index, diagonal ? 2.6 : 1] as const;
			}),
		);
		const childEdgeIndex = this.rng.pick(childEdgeIndexes);
		const parentEdge = parent.edges[parentEdgeIndex] as LineEdge;
		const childEdge = shape.edges[childEdgeIndex] as LineEdge;

		const childHeight = pickRoomHeight(ROOM_TYPES[type], level, this.rng);
		const opening = this.chooseOpeningDimensions(
			parent,
			type,
			childHeight,
			parentEdge,
			childEdge,
		);
		if (!opening) {
			return null;
		}
		const parentInterval = this.pickOpeningCenter(
			parent,
			parentEdgeIndex,
			opening.width,
		);
		if (parentInterval === null) {
			return null;
		}

		const parentDirection = edgeDirection(parentEdge);
		const parentOutward = { x: parentDirection.z, z: -parentDirection.x };
		const childLength = edgeLength(childEdge);
		const childOffsetAlong =
			forcedChildEdge !== null
				? childLength / 2
				: snapWithin(
						this.rng,
						MANOR_OPENING_EDGE_MARGIN + opening.width / 2,
						childLength - MANOR_OPENING_EDGE_MARGIN - opening.width / 2,
					);
		const childDirection = edgeDirection(childEdge);
		const rotation = snapAngle(
			Math.atan2(-parentDirection.z, -parentDirection.x) -
				Math.atan2(childDirection.z, childDirection.x),
		);
		const childCenterLocal = {
			x: childEdge.a.x + childDirection.x * childOffsetAlong,
			z: childEdge.a.z + childDirection.z * childOffsetAlong,
		};
		const parentCenter = {
			x: parentEdge.a.x + parentDirection.x * parentInterval,
			z: parentEdge.a.z + parentDirection.z * parentInterval,
		};
		const rotatedChildCenter = rotate2(childCenterLocal, rotation);
		const offset = {
			x: parentCenter.x + parentOutward.x * WALL_GAP - rotatedChildCenter.x,
			z: parentCenter.z + parentOutward.z * WALL_GAP - rotatedChildCenter.z,
		};
		const edges = transformEdges(shape.edges, rotation, offset);
		const polygon = tessellateOutline(edges);
		if (!this.fitsInManor(polygon, level, type, childHeight)) {
			return null;
		}
		const passage = passagePolygon(
			parentCenter,
			parentDirection,
			parentOutward,
			opening.width,
		);
		if (
			!this.isFree(passage, type === "stairwell" ? [level, level + 1] : [level])
		) {
			return null;
		}

		const room = this.registerRoom(
			type,
			level,
			edges,
			rotation,
			polygon,
			childHeight,
		);
		const openingLevel =
			parent.type === "stairwell" ? ((parent.level + 1) as Level) : level;
		this.addOpening(
			{
				roomA: parent,
				edgeA: parentEdgeIndex,
				center: parentCenter,
				roomB: room,
				edgeB: childEdgeIndex,
				width: opening.width,
				height: opening.height,
				kind: opening.kind,
			},
			openingLevel,
		);
		return room;
	}

	private attachableEdges(room: Room, level: Level): number[] {
		if (room.type === "stairwell") {
			if (level !== room.level + 1 || room.edgeOpenings[2].length > 0) {
				return [];
			}
			return [2];
		}
		if (ROOM_TYPES[room.type].singleDoor || room.level !== level) {
			return [];
		}
		return room.edges
			.map((edge, index) => ({ edge, index }))
			.filter(
				({ edge, index }) =>
					edge.kind === "line" && this.longestFreeInterval(room, index) >= 1.7,
			)
			.map(({ index }) => index);
	}

	private chooseOpeningDimensions(
		parent: Room,
		childType: RoomType,
		childHeight: number,
		parentEdge: LineEdge,
		childEdge: LineEdge,
	): { width: number; height: number; kind: OpeningKind } | null {
		const childDefinition = ROOM_TYPES[childType];
		const parentDefinition = ROOM_TYPES[parent.type];
		const mustBeDoor =
			childDefinition.singleDoor || parentDefinition.singleDoor;
		const stairOpening =
			childType === "stairwell" || parent.type === "stairwell";
		const kind: OpeningKind = mustBeDoor
			? "door"
			: stairOpening
				? this.rng.chance(0.3)
					? "door"
					: "free"
				: this.rng.chance(0.42)
					? "door"
					: "free";
		const available =
			Math.min(edgeLength(parentEdge), edgeLength(childEdge)) -
			MANOR_OPENING_EDGE_MARGIN * 2;
		const minHeight = Math.min(
			parent.type === "stairwell" ? 3.0 : parent.height,
			childType === "stairwell" ? 3.0 : childHeight,
		);
		let width: number;
		let height: number;
		if (kind === "door") {
			width =
				Math.round(
					this.rng.range(mustBeDoor ? 0.9 : 1.0, mustBeDoor ? 1.0 : 1.3) * 20,
				) / 20;
			height = Math.round(this.rng.range(2.1, 2.35) * 20) / 20;
		} else {
			const maxWidth = Math.min(stairOpening ? 1.8 : 2.8, available);
			width =
				Math.round(this.rng.range(1.1, Math.max(1.1, maxWidth)) * 20) / 20;
			height =
				Math.round(
					this.rng.range(2.3, Math.max(2.3, Math.min(3.2, minHeight - 0.3))) *
						20,
				) / 20;
		}
		if (width > available) {
			return null;
		}
		return { width, height: Math.min(height, minHeight - 0.25), kind };
	}

	private freeIntervals(room: Room, edgeIndex: number): [number, number][] {
		const edge = room.edges[edgeIndex];
		const length = edgeLength(edge);
		let intervals: [number, number][] = [
			[MANOR_OPENING_EDGE_MARGIN, length - MANOR_OPENING_EDGE_MARGIN],
		];
		for (const slot of room.edgeOpenings[edgeIndex]) {
			const blockFrom = slot.from - MANOR_OPENING_SPACING;
			const blockTo = slot.to + MANOR_OPENING_SPACING;
			intervals = intervals.flatMap(([from, to]) => {
				const pieces: [number, number][] = [];
				if (blockFrom > from) {
					pieces.push([from, Math.min(to, blockFrom)]);
				}
				if (blockTo < to) {
					pieces.push([Math.max(from, blockTo), to]);
				}
				return pieces.filter(([a, b]) => b - a > 0.05);
			});
		}
		return intervals;
	}

	private longestFreeInterval(room: Room, edgeIndex: number): number {
		return this.freeIntervals(room, edgeIndex).reduce(
			(best, [from, to]) => Math.max(best, to - from),
			0,
		);
	}

	private pickOpeningCenter(
		room: Room,
		edgeIndex: number,
		width: number,
	): number | null {
		const intervals = this.freeIntervals(room, edgeIndex).filter(
			([from, to]) => to - from >= width,
		);
		if (intervals.length === 0) {
			return null;
		}
		if (room.type === "stairwell") {
			return edgeLength(room.edges[edgeIndex]) / 2;
		}
		const [from, to] = this.rng.pick(intervals);
		const low = Math.ceil((from + width / 2) * 4) / 4;
		const high = Math.floor((to - width / 2) * 4) / 4;
		if (high < low) {
			return this.rng.range(from + width / 2, to - width / 2);
		}
		return low + this.rng.int(0, Math.round((high - low) * 4)) / 4;
	}

	private fitsInManor(
		polygon: Vec2[],
		level: Level,
		type: RoomType,
		height: number,
	): boolean {
		const bounds = polygonBounds(polygon);
		const limit = level === 0 ? this.halfExtent : this.halfExtent + 12;
		if (
			bounds.minX < -limit ||
			bounds.maxX > limit ||
			bounds.minZ < -limit ||
			bounds.maxZ > limit
		) {
			return false;
		}
		return this.isFree(polygon, occupiedLevels(type, level, height));
	}

	private isFree(polygon: Vec2[], levels: readonly number[]): boolean {
		const bounds = polygonBounds(polygon);
		for (const occupant of this.occupants) {
			if (
				!occupant.levels.some((level) => levels.includes(level)) ||
				!boundsOverlap(bounds, occupant.bounds, -0.01)
			) {
				continue;
			}
			if (polygonsOverlap(polygon, occupant.polygon, 0.01)) {
				return false;
			}
		}
		return true;
	}

	private registerRoom(
		type: RoomType,
		level: Level,
		edges: OutlineEdge[],
		rotation: number,
		tessellated: Vec2[] | null,
		chosenHeight?: number,
	): Room {
		const definition = ROOM_TYPES[type];
		const polygon = tessellated ?? tessellateOutline(edges);
		if (signedArea(polygon) <= 0) {
			throw new Error("Room polygon must have a positive orientation");
		}
		const floorY = level * LEVEL_HEIGHT;
		const height = chosenHeight ?? pickRoomHeight(definition, level, this.rng);
		const id = this.rooms.length;
		const nameIndex = Math.floor(this.rng.next() * definition.names.length);
		const style = pickRoomStyle(definition, this.rng);
		if (
			style.ceiling === "glass" &&
			!this.isFree(polygon, levelsAbove(level))
		) {
			style.ceiling =
				definition.ceilings.find((ceiling) => ceiling !== "glass") ?? "plaster";
		}
		const room: Room = {
			id,
			type,
			name: definition.names[nameIndex],
			nameIndex,
			level,
			floorY,
			height,
			ceilingY: floorY + height,
			edges,
			polygon,
			bounds: polygonBounds(polygon),
			labelPoint: cleanPoint(poleOfInaccessibility(polygon, 0.25)),
			area: signedArea(polygon),
			axisAngle: rotation,
			openingIds: [],
			edgeOpenings: edges.map(() => []),
			exteriorEdges: edges.map(() => false),
			style,
			stair: type === "stairwell" ? buildStairSpec(edges) : null,
			seed: Math.floor(this.rng.next() * 2 ** 31),
		};
		this.rooms.push(room);
		this.occupants.push({
			polygon,
			bounds: room.bounds,
			levels:
				style.ceiling === "glass"
					? [level, ...levelsAbove(level)]
					: occupiedLevels(type, level, height),
			roomId: id,
			openingId: null,
		});
		return room;
	}

	private addOpening(request: OpeningRequest, level: Level): Opening {
		const edgeA = request.roomA.edges[request.edgeA] as LineEdge;
		const edgeB = request.roomB.edges[request.edgeB] as LineEdge;
		const directionA = edgeDirection(edgeA);
		const outward = { x: directionA.z, z: -directionA.x };
		const half = request.width / 2;
		const start = cleanPoint({
			x: request.center.x - directionA.x * half,
			z: request.center.z - directionA.z * half,
		});
		const end = cleanPoint({
			x: request.center.x + directionA.x * half,
			z: request.center.z + directionA.z * half,
		});
		const alongA = dot2(
			{ x: request.center.x - edgeA.a.x, z: request.center.z - edgeA.a.z },
			directionA,
		);
		const directionB = edgeDirection(edgeB);
		const depth = request.depth ?? WALL_GAP;
		const centerB = {
			x: request.center.x + outward.x * depth,
			z: request.center.z + outward.z * depth,
		};
		const alongB = dot2(
			{ x: centerB.x - edgeB.a.x, z: centerB.z - edgeB.a.z },
			directionB,
		);
		const id = this.openings.length;
		const isDoor = request.kind === "door";
		const opening: Opening = {
			id,
			kind: request.kind,
			roomA: request.roomA.id,
			roomB: request.roomB.id,
			edgeA: request.edgeA,
			edgeB: request.edgeB,
			start,
			end,
			normal: cleanPoint(outward),
			width: request.width,
			height: request.height,
			depth,
			floorY: level * LEVEL_HEIGHT,
			level,
			sill: request.sill ?? 0,
			door: isDoor
				? {
						id: this.doorCounter++,
						hingeAtStart: this.rng.chance(0.5),
						swingIntoA: this.rng.chance(0.5),
						style: this.rng.int(0, 3),
						initiallyOpen: this.rng.chance(0.45),
					}
				: null,
		};
		this.openings.push(opening);
		request.roomA.openingIds.push(id);
		request.roomB.openingIds.push(id);
		request.roomA.edgeOpenings[request.edgeA].push({
			openingId: id,
			from: alongA - half,
			to: alongA + half,
		});
		request.roomB.edgeOpenings[request.edgeB].push({
			openingId: id,
			from: alongB - half,
			to: alongB + half,
		});
		const passage = passagePolygon(
			request.center,
			directionA,
			outward,
			request.width,
			depth,
		);
		this.occupants.push({
			polygon: passage,
			bounds: polygonBounds(passage),
			levels: [level],
			roomId: null,
			openingId: id,
		});
		return opening;
	}

	private tryBridge(a: Room, b: Room): boolean {
		for (const edgeIndexA of this.rng.shuffle(
			a.edges.map((_, index) => index),
		)) {
			const edgeA = a.edges[edgeIndexA];
			if (edgeA.kind !== "line") {
				continue;
			}
			for (const edgeIndexB of this.rng.shuffle(
				b.edges.map((_, index) => index),
			)) {
				const edgeB = b.edges[edgeIndexB];
				if (edgeB.kind !== "line") {
					continue;
				}
				if (this.tryBridgeEdges(a, edgeIndexA, b, edgeIndexB)) {
					return true;
				}
			}
		}
		return false;
	}

	addWindows(level: Level, maxWindows: number, rng: SeededRandom): number {
		const candidates = this.rooms.filter(
			(room) =>
				room.level === level &&
				room.area > 0 &&
				room.type !== "stairwell" &&
				!ROOM_TYPES[room.type].singleDoor,
		);
		const pairs: [Room, Room][] = [];
		for (let i = 0; i < candidates.length; i += 1) {
			for (let j = i + 1; j < candidates.length; j += 1) {
				const a = candidates[i];
				const b = candidates[j];
				if (boundsOverlap(a.bounds, b.bounds, 1) && !this.linked(a, b)) {
					pairs.push([a, b]);
				}
			}
		}
		let created = 0;
		for (const [a, b] of rng.shuffle(pairs)) {
			if (created >= maxWindows) {
				break;
			}
			if (this.tryWindow(a, b, rng)) {
				created += 1;
			}
		}
		return created;
	}

	private linked(a: Room, b: Room): boolean {
		return a.openingIds.some((id) => {
			const opening = this.openings[id];
			return opening.roomA === b.id || opening.roomB === b.id;
		});
	}

	private tryWindow(a: Room, b: Room, rng: SeededRandom): boolean {
		for (const [edgeIndexA, edgeA] of a.edges.entries()) {
			for (const [edgeIndexB, edgeB] of b.edges.entries()) {
				if (edgeA.kind !== "line" || edgeB.kind !== "line") {
					continue;
				}
				const wall = this.facingWall(a, edgeIndexA, b, edgeIndexB);
				if (!wall || wall.gap > 0.75) {
					continue;
				}
				const best = wall.usable
					.filter(([from, to]) => to - from >= 1.6)
					.sort((x, y) => y[1] - y[0] - (x[1] - x[0]))[0];
				if (!best) {
					continue;
				}
				const width = Math.min(best[1] - best[0] - 0.2, rng.range(1.2, 2.4));
				const center = rng.range(
					best[0] + width / 2 + 0.1,
					best[1] - width / 2 - 0.1,
				);
				const centerPoint = {
					x: edgeA.a.x + wall.direction.x * center,
					z: edgeA.a.z + wall.direction.z * center,
				};
				const passage = passagePolygon(
					centerPoint,
					wall.direction,
					wall.outward,
					width,
					wall.gap,
				);
				if (!this.isFree(passage, [a.level])) {
					continue;
				}
				this.addOpening(
					{
						roomA: a,
						edgeA: edgeIndexA,
						center: centerPoint,
						roomB: b,
						edgeB: edgeIndexB,
						width,
						height: Math.min(a.height, b.height, 2.6) - 0.25,
						kind: "window",
						depth: wall.gap,
						sill: 0.85,
					},
					a.level,
				);
				return true;
			}
		}
		return false;
	}

	private facingWall(
		a: Room,
		edgeIndexA: number,
		b: Room,
		edgeIndexB: number,
	): {
		direction: Vec2;
		outward: Vec2;
		gap: number;
		usable: [number, number][];
	} | null {
		const edgeA = a.edges[edgeIndexA] as LineEdge;
		const edgeB = b.edges[edgeIndexB] as LineEdge;
		const directionA = edgeDirection(edgeA);
		const directionB = edgeDirection(edgeB);
		if (dot2(directionA, directionB) > -0.999) {
			return null;
		}
		const outward = { x: directionA.z, z: -directionA.x };
		const gap = dot2(
			{ x: edgeB.a.x - edgeA.a.x, z: edgeB.a.z - edgeA.a.z },
			outward,
		);
		if (gap < 0.2) {
			return null;
		}
		const lengthA = edgeLength(edgeA);
		const projectionStart = dot2(
			{ x: edgeB.b.x - edgeA.a.x, z: edgeB.b.z - edgeA.a.z },
			directionA,
		);
		const projectionEnd = dot2(
			{ x: edgeB.a.x - edgeA.a.x, z: edgeB.a.z - edgeA.a.z },
			directionA,
		);
		const overlapFrom = Math.max(0, projectionStart);
		const overlapTo = Math.min(lengthA, projectionEnd);
		const usable = intersectIntervals(
			this.freeIntervals(a, edgeIndexA),
			this.freeIntervals(b, edgeIndexB).map(
				([from, to]) =>
					[projectionEnd - to, projectionEnd - from] as [number, number],
			),
		).map(
			([from, to]) =>
				[Math.max(from, overlapFrom), Math.min(to, overlapTo)] as [
					number,
					number,
				],
		);
		return { direction: directionA, outward, gap, usable };
	}

	private tryBridgeEdges(
		a: Room,
		edgeIndexA: number,
		b: Room,
		edgeIndexB: number,
	): boolean {
		const wall = this.facingWall(a, edgeIndexA, b, edgeIndexB);
		if (!wall) {
			return false;
		}
		const edgeA = a.edges[edgeIndexA] as LineEdge;
		const { direction: directionA, outward, gap, usable } = wall;
		const best = usable
			.filter(([from, to]) => to - from >= 1.9)
			.sort((x, y) => y[1] - y[0] - (x[1] - x[0]))[0];
		if (!best) {
			return false;
		}

		if (gap >= 0.2 && gap <= 0.75) {
			const width = Math.min(best[1] - best[0], this.rng.range(1.1, 2.2));
			const center = this.rng.range(best[0] + width / 2, best[1] - width / 2);
			const centerPoint = {
				x: edgeA.a.x + directionA.x * center,
				z: edgeA.a.z + directionA.z * center,
			};
			const passage = passagePolygon(
				centerPoint,
				directionA,
				outward,
				width,
				gap,
			);
			if (!this.isFree(passage, [a.level])) {
				return false;
			}
			const kind: OpeningKind = this.rng.chance(0.4) ? "door" : "free";
			this.addOpening(
				{
					roomA: a,
					edgeA: edgeIndexA,
					center: centerPoint,
					roomB: b,
					edgeB: edgeIndexB,
					width: kind === "door" ? Math.min(width, 1.2) : width,
					height:
						Math.min(a.height, b.height, kind === "door" ? 2.3 : 2.9) - 0.1,
					kind,
					depth: gap,
				},
				a.level,
			);
			return true;
		}

		const corridorLength = gap - WALL_GAP * 2;
		if (corridorLength < 1.5 || corridorLength > 13) {
			return false;
		}
		const corridorWidth = Math.min(
			best[1] - best[0],
			Math.round(this.rng.range(1.9, 2.5) * 4) / 4,
		);
		if (corridorWidth < 1.9) {
			return false;
		}
		const center = this.rng.range(
			best[0] + corridorWidth / 2,
			best[1] - corridorWidth / 2,
		);
		const base = {
			x: edgeA.a.x + directionA.x * center,
			z: edgeA.a.z + directionA.z * center,
		};
		const near = {
			x: base.x + outward.x * WALL_GAP,
			z: base.z + outward.z * WALL_GAP,
		};
		const halfWidth = corridorWidth / 2;
		const p0 = {
			x: near.x - directionA.x * halfWidth,
			z: near.z - directionA.z * halfWidth,
		};
		const p1 = {
			x: near.x + directionA.x * halfWidth,
			z: near.z + directionA.z * halfWidth,
		};
		const p2 = {
			x: p1.x + outward.x * corridorLength,
			z: p1.z + outward.z * corridorLength,
		};
		const p3 = {
			x: p0.x + outward.x * corridorLength,
			z: p0.z + outward.z * corridorLength,
		};
		const edges: OutlineEdge[] = [
			{ kind: "line", a: cleanPoint(p1), b: cleanPoint(p0) },
			{ kind: "line", a: cleanPoint(p0), b: cleanPoint(p3) },
			{ kind: "line", a: cleanPoint(p3), b: cleanPoint(p2) },
			{ kind: "line", a: cleanPoint(p2), b: cleanPoint(p1) },
		];
		const polygon = tessellateOutline(edges);
		const farCenter = {
			x: base.x + outward.x * (gap - WALL_GAP),
			z: base.z + outward.z * (gap - WALL_GAP),
		};
		const passageA = passagePolygon(
			base,
			directionA,
			outward,
			corridorWidth - 0.8,
		);
		const passageB = passagePolygon(
			farCenter,
			directionA,
			outward,
			corridorWidth - 0.8,
		);
		if (
			!this.isFree(polygon, [a.level]) ||
			!this.isFree(passageA, [a.level]) ||
			!this.isFree(passageB, [a.level])
		) {
			return false;
		}
		const corridor = this.registerRoom(
			"corridor",
			a.level,
			edges,
			snapAngle(Math.atan2(-directionA.z, -directionA.x)),
			polygon,
		);
		const openingWidth =
			Math.round(Math.min(corridorWidth - 0.8, this.rng.range(1.1, 1.7)) * 20) /
			20;
		const heightLimit = Math.min(a.height, b.height, corridor.height) - 0.3;
		const kindA: OpeningKind = this.rng.chance(0.35) ? "door" : "free";
		const kindB: OpeningKind = this.rng.chance(0.35) ? "door" : "free";
		this.addOpening(
			{
				roomA: a,
				edgeA: edgeIndexA,
				center: base,
				roomB: corridor,
				edgeB: 0,
				width: kindA === "door" ? Math.min(openingWidth, 1.2) : openingWidth,
				height: Math.min(heightLimit, kindA === "door" ? 2.3 : 2.8),
				kind: kindA,
			},
			a.level,
		);
		this.addOpening(
			{
				roomA: corridor,
				edgeA: 2,
				center: farCenter,
				roomB: b,
				edgeB: edgeIndexB,
				width: kindB === "door" ? Math.min(openingWidth, 1.2) : openingWidth,
				height: Math.min(heightLimit, kindB === "door" ? 2.3 : 2.8),
				kind: kindB,
			},
			a.level,
		);
		return true;
	}

	private tryElbowBridge(a: Room, b: Room): boolean {
		for (const edgeIndexA of this.rng.shuffle(
			a.edges.map((_, index) => index),
		)) {
			for (const edgeIndexB of this.rng.shuffle(
				b.edges.map((_, index) => index),
			)) {
				if (this.tryElbowBridgeEdges(a, edgeIndexA, b, edgeIndexB)) {
					return true;
				}
			}
		}
		return false;
	}

	private tryElbowBridgeEdges(
		a: Room,
		edgeIndexA: number,
		b: Room,
		edgeIndexB: number,
	): boolean {
		const edgeA = a.edges[edgeIndexA];
		const edgeB = b.edges[edgeIndexB];
		if (edgeA.kind !== "line" || edgeB.kind !== "line") {
			return false;
		}
		const directionA = edgeDirection(edgeA);
		const directionB = edgeDirection(edgeB);
		const outwardA = { x: directionA.z, z: -directionA.x };
		const outwardB = { x: directionB.z, z: -directionB.x };
		const facing = dot2(outwardA, outwardB);
		const perpendicular = Math.abs(facing) < 0.01;
		const obtuse = Math.abs(facing + Math.SQRT1_2) < 0.01;
		if (!perpendicular && !obtuse) {
			return false;
		}
		const corridorWidth = Math.round(this.rng.range(1.9, 2.4) * 4) / 4;
		const openingWidth =
			Math.round(this.rng.range(1.1, corridorWidth - 0.7) * 20) / 20;
		const intervalA = this.freeIntervals(a, edgeIndexA).filter(
			([from, to]) => to - from >= corridorWidth + 0.1,
		);
		const intervalB = this.freeIntervals(b, edgeIndexB).filter(
			([from, to]) => to - from >= corridorWidth + 0.1,
		);
		if (intervalA.length === 0 || intervalB.length === 0) {
			return false;
		}
		const [fromA, toA] = this.rng.pick(intervalA);
		const [fromB, toB] = this.rng.pick(intervalB);
		const alongA = snapWithin(
			this.rng,
			fromA + corridorWidth / 2,
			toA - corridorWidth / 2,
		);
		const alongB = snapWithin(
			this.rng,
			fromB + corridorWidth / 2,
			toB - corridorWidth / 2,
		);
		const centerA = {
			x: edgeA.a.x + directionA.x * alongA,
			z: edgeA.a.z + directionA.z * alongA,
		};
		const centerB = {
			x: edgeB.a.x + directionB.x * alongB,
			z: edgeB.a.z + directionB.z * alongB,
		};
		const startPoint = {
			x: centerA.x + outwardA.x * WALL_GAP,
			z: centerA.z + outwardA.z * WALL_GAP,
		};
		const endPoint = {
			x: centerB.x + outwardB.x * WALL_GAP,
			z: centerB.z + outwardB.z * WALL_GAP,
		};
		const denominator = outwardA.x * outwardB.z - outwardA.z * outwardB.x;
		const delta = {
			x: endPoint.x - startPoint.x,
			z: endPoint.z - startPoint.z,
		};
		const t = (delta.x * outwardB.z - delta.z * outwardB.x) / denominator;
		const u = (delta.x * outwardA.z - delta.z * outwardA.x) / denominator;
		const minimumLeg = corridorWidth / 2 + 0.9;
		if (t < minimumLeg || u < minimumLeg || t > 12 || u > 12) {
			return false;
		}
		const corner = {
			x: startPoint.x + outwardA.x * t,
			z: startPoint.z + outwardA.z * t,
		};
		const vertices = corridorPathVertices(
			[startPoint, corner, endPoint],
			corridorWidth,
		).map(cleanPoint);
		const edges = outlineFromVertices(
			vertices,
			vertices.map(() => SQUARE),
		);
		const polygon = tessellateOutline(edges);
		const capA = edges.findIndex((edge) => isCapAt(edge, startPoint));
		const capB = edges.findIndex((edge) => isCapAt(edge, endPoint));
		if (capA < 0 || capB < 0) {
			return false;
		}
		const passageA = passagePolygon(
			centerA,
			directionA,
			outwardA,
			openingWidth,
		);
		const passageB = passagePolygon(
			centerB,
			directionB,
			outwardB,
			openingWidth,
		);
		const bounds = polygonBounds(polygon);
		const limit = this.halfExtent;
		if (
			bounds.minX < -limit ||
			bounds.maxX > limit ||
			bounds.minZ < -limit ||
			bounds.maxZ > limit
		) {
			return false;
		}
		if (
			!this.isFree(polygon, [a.level]) ||
			!this.isFree(passageA, [a.level]) ||
			!this.isFree(passageB, [a.level])
		) {
			return false;
		}
		const corridor = this.registerRoom(
			"corridor",
			a.level,
			edges,
			snapAngle(Math.atan2(outwardA.z, outwardA.x)),
			polygon,
		);
		const heightLimit = Math.min(a.height, b.height, corridor.height) - 0.3;
		for (const [room, edgeIndex, center, cap] of [
			[a, edgeIndexA, centerA, capA],
			[b, edgeIndexB, centerB, capB],
		] as const) {
			const kind: OpeningKind = this.rng.chance(0.35) ? "door" : "free";
			this.addOpening(
				{
					roomA: room,
					edgeA: edgeIndex,
					center,
					roomB: corridor,
					edgeB: cap,
					width: kind === "door" ? Math.min(openingWidth, 1.2) : openingWidth,
					height: Math.min(heightLimit, kind === "door" ? 2.3 : 2.8),
					kind,
				},
				a.level,
			);
		}
		return true;
	}

	private isExteriorEdge(room: Room, edge: OutlineEdge): boolean {
		const samples = [0.15, 0.5, 0.85];
		for (const t of samples) {
			const point = pointOnEdge(edge, t);
			const outward = outwardNormalAt(edge, t);
			const probe = {
				x: point.x + outward.x * 0.45,
				z: point.z + outward.z * 0.45,
			};
			for (const occupant of this.occupants) {
				if (occupant.roomId === room.id) {
					continue;
				}
				const sameLevel =
					occupant.levels.includes(room.level) ||
					(room.type === "stairwell" &&
						occupant.levels.includes(room.level + 1));
				if (sameLevel && pointInPolygon(probe, occupant.polygon)) {
					return false;
				}
			}
		}
		return true;
	}
}

function isCapAt(edge: OutlineEdge, point: Vec2): boolean {
	if (edge.kind !== "line") {
		return false;
	}
	const middle = { x: (edge.a.x + edge.b.x) / 2, z: (edge.a.z + edge.b.z) / 2 };
	return Math.hypot(middle.x - point.x, middle.z - point.z) < 0.02;
}

function snapWithin(rng: SeededRandom, from: number, to: number): number {
	const low = Math.ceil(from * 4) / 4;
	const high = Math.floor(to * 4) / 4;
	if (high < low) {
		return rng.range(from, to);
	}
	return low + rng.int(0, Math.round((high - low) * 4)) / 4;
}

function intersectIntervals(
	a: [number, number][],
	b: [number, number][],
): [number, number][] {
	const result: [number, number][] = [];
	for (const [aFrom, aTo] of a) {
		for (const [bFrom, bTo] of b) {
			const from = Math.max(aFrom, bFrom);
			const to = Math.min(aTo, bTo);
			if (to > from) {
				result.push([from, to]);
			}
		}
	}
	return result;
}

export function passagePolygon(
	center: Vec2,
	direction: Vec2,
	outward: Vec2,
	width: number,
	depth = WALL_GAP,
): Vec2[] {
	const half = width / 2;
	const start = {
		x: center.x - direction.x * half,
		z: center.z - direction.z * half,
	};
	const end = {
		x: center.x + direction.x * half,
		z: center.z + direction.z * half,
	};
	return [
		start,
		{ x: start.x + outward.x * depth, z: start.z + outward.z * depth },
		{ x: end.x + outward.x * depth, z: end.z + outward.z * depth },
		end,
	];
}

export function openingPassage(opening: Opening): Vec2[] {
	const direction = {
		x: (opening.end.x - opening.start.x) / opening.width,
		z: (opening.end.z - opening.start.z) / opening.width,
	};
	const center = {
		x: (opening.start.x + opening.end.x) / 2,
		z: (opening.start.z + opening.end.z) / 2,
	};
	return passagePolygon(
		center,
		direction,
		opening.normal,
		opening.width,
		opening.depth,
	);
}

export function pointOnEdge(edge: OutlineEdge, t: number): Vec2 {
	if (edge.kind === "line") {
		return {
			x: edge.a.x + (edge.b.x - edge.a.x) * t,
			z: edge.a.z + (edge.b.z - edge.a.z) * t,
		};
	}
	const angle = edge.startAngle + edge.sweep * t;
	return {
		x: edge.center.x + Math.cos(angle) * edge.radius,
		z: edge.center.z + Math.sin(angle) * edge.radius,
	};
}

export function outwardNormalAt(edge: OutlineEdge, t: number): Vec2 {
	if (edge.kind === "line") {
		const direction = edgeDirection(edge);
		return { x: direction.z, z: -direction.x };
	}
	const point = pointOnEdge(edge, t);
	const radial = {
		x: (point.x - edge.center.x) / edge.radius,
		z: (point.z - edge.center.z) / edge.radius,
	};
	return edge.sweep > 0 ? radial : { x: -radial.x, z: -radial.z };
}

function buildStairSpec(edges: OutlineEdge[]): StairSpec {
	const bottom = edges[0] as LineEdge;
	const direction = edgeDirection(bottom);
	const forward = { x: -direction.z, z: direction.x };
	const origin = {
		x: (bottom.a.x + bottom.b.x) / 2,
		z: (bottom.a.z + bottom.b.z) / 2,
	};
	return {
		origin: cleanPoint(origin),
		forward: cleanPoint(forward),
		right: cleanPoint(direction),
		width: distance2(bottom.a, bottom.b),
		length: STAIR_LENGTH,
		bottomLanding: STAIR_BOTTOM_LANDING,
		run: STAIR_RUN,
		stepCount: STAIR_STEP_COUNT,
		rise: STAIR_RISE,
		topY: LEVEL_HEIGHT,
	};
}

export function stairHeightAt(stair: StairSpec, point: Vec2): number {
	const along =
		(point.x - stair.origin.x) * stair.forward.x +
		(point.z - stair.origin.z) * stair.forward.z;
	const progress = (along - stair.bottomLanding) / STAIR_TREAD + 0.5;
	const height = progress * stair.rise;
	return Math.max(0, Math.min(stair.topY, height));
}

function leadsOn(shape: RoomShape): boolean {
	return (
		shape.edges.filter(
			(edge) =>
				edge.kind === "line" && edgeLength(edge) >= CORRIDOR_EXIT_LENGTH,
		).length >= 2
	);
}

function levelsAbove(level: Level): number[] {
	return Array.from(
		{ length: MAX_UPPER_FLOORS - level },
		(_, index) => level + 1 + index,
	);
}

function occupiedLevels(
	type: RoomType,
	level: Level,
	height: number,
): number[] {
	if (ROOM_TYPES[type].ceilings.every((ceiling) => ceiling === "glass")) {
		return Array.from(
			{ length: MAX_UPPER_FLOORS - level + 1 },
			(_, index) => level + index,
		);
	}
	return spansLevelAbove(type, height) ? [level, level + 1] : [level];
}
