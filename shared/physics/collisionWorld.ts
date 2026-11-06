import {
	MEZZANINE_POST_RADIUS,
	MEZZANINE_RAIL_COLLIDER,
} from "../config/index.js";
import { doorGeometry, doorPanelBox } from "../manor/doors.js";
import { openingPassage, stairHeightAt } from "../manor/layoutBuilder.js";
import {
	distanceToPolygonBoundary,
	edgeLength,
	pointInPolygon,
	polygonBounds,
} from "../manor/polygon.js";
import type {
	Bounds,
	Level,
	ManorLayout,
	OrientedBox,
	Room,
	StairSpec,
} from "../manor/types.js";
import { closestPointOnSegment, type Vec2 } from "../math.js";

export interface WallCollider {
	id: number;
	a: Vec2;
	b: Vec2;
	yMin: number;
	yMax: number;
	roomId: number;
	glass: boolean;
}

export interface BoxCollider extends OrientedBox {
	id: number;
	walkable: boolean;
	occludes: boolean;
	kind: "furniture" | "door";
	ownerId: number;
	enabled: boolean;
	soft: boolean;
}

export interface FloorRegion {
	id: number;
	polygon: Vec2[];
	bounds: Bounds;
	floorY: number;
	ceilingY: number;
	level: Level;
	roomId: number | null;
	openingId: number | null;
	stair: StairSpec | null;
}

const CELL = 2;

class SpatialHash {
	private readonly cells = new Map<number, number[]>();

	insert(id: number, bounds: Bounds): void {
		for (const key of this.keys(bounds)) {
			const list = this.cells.get(key);
			if (list) {
				list.push(id);
			} else {
				this.cells.set(key, [id]);
			}
		}
	}

	query(
		bounds: Bounds,
		stamp: Uint32Array,
		stampValue: number,
		output: number[],
	): number[] {
		output.length = 0;
		for (const key of this.keys(bounds)) {
			const list = this.cells.get(key);
			if (!list) {
				continue;
			}
			for (const id of list) {
				if (stamp[id] !== stampValue) {
					stamp[id] = stampValue;
					output.push(id);
				}
			}
		}
		return output;
	}

	private *keys(bounds: Bounds): Generator<number> {
		const minX = Math.floor(bounds.minX / CELL);
		const maxX = Math.floor(bounds.maxX / CELL);
		const minZ = Math.floor(bounds.minZ / CELL);
		const maxZ = Math.floor(bounds.maxZ / CELL);
		for (let x = minX; x <= maxX; x += 1) {
			for (let z = minZ; z <= maxZ; z += 1) {
				yield (x + 2048) * 4096 + (z + 2048);
			}
		}
	}
}

export class CollisionWorld {
	readonly walls: WallCollider[] = [];
	readonly boxes: BoxCollider[] = [];
	readonly regions: FloorRegion[] = [];
	readonly decks: FloorRegion[] = [];
	readonly doorBoxIds = new Map<number, number>();
	private readonly wallHash = new SpatialHash();
	private readonly boxHash = new SpatialHash();
	private readonly regionHash = new SpatialHash();
	private wallStamp = new Uint32Array(1);
	private boxStamp = new Uint32Array(1);
	private regionStamp = new Uint32Array(1);
	private stampCounter = 1;
	private readonly scratchWalls: number[] = [];
	private readonly scratchBoxes: number[] = [];
	private readonly scratchRegions: number[] = [];

	constructor(readonly layout: ManorLayout) {
		for (const room of layout.rooms) {
			this.addRoomWalls(room);
			this.addRegion({
				polygon: room.polygon,
				floorY: room.floorY,
				ceilingY: room.ceilingY,
				level: room.level,
				roomId: room.id,
				openingId: null,
				stair: room.stair,
			});
			this.addMezzanine(room);
		}
		for (const opening of layout.openings) {
			this.addOpeningGeometry(opening.id);
		}
		for (const item of layout.furniture) {
			for (const collider of item.colliders) {
				this.addBox({
					...collider,
					kind: "furniture",
					ownerId: item.id,
					enabled: true,
					soft: false,
				});
			}
		}
		this.wallStamp = new Uint32Array(this.walls.length + 1);
		this.boxStamp = new Uint32Array(this.boxes.length + 1);
		this.regionStamp = new Uint32Array(this.regions.length + 1);
	}

	setDoorClosed(doorId: number, closed: boolean): void {
		const boxId = this.doorBoxIds.get(doorId);
		if (boxId !== undefined) {
			this.boxes[boxId].enabled = closed;
		}
	}

	isDoorClosed(doorId: number): boolean {
		const boxId = this.doorBoxIds.get(doorId);
		return boxId !== undefined && this.boxes[boxId].enabled;
	}

	queryWalls(bounds: Bounds): number[] {
		return this.wallHash.query(
			bounds,
			this.wallStamp,
			this.nextStamp(),
			this.scratchWalls,
		);
	}

	queryBoxes(bounds: Bounds): number[] {
		return this.boxHash.query(
			bounds,
			this.boxStamp,
			this.nextStamp(),
			this.scratchBoxes,
		);
	}

	queryRegions(bounds: Bounds): number[] {
		return this.regionHash.query(
			bounds,
			this.regionStamp,
			this.nextStamp(),
			this.scratchRegions,
		);
	}

	regionsAt(point: Vec2): FloorRegion[] {
		const result: FloorRegion[] = [];
		for (const id of this.queryRegions({
			minX: point.x,
			maxX: point.x,
			minZ: point.z,
			maxZ: point.z,
		})) {
			const region = this.regions[id];
			if (pointInPolygon(point, region.polygon)) {
				result.push(region);
			}
		}
		return result;
	}

	regionFloorY(region: FloorRegion, point: Vec2): number {
		return region.stair
			? region.floorY + stairHeightAt(region.stair, point)
			: region.floorY;
	}

	regionAt(point: Vec2, feetY: number, tolerance = 0.6): FloorRegion | null {
		let best: FloorRegion | null = null;
		let bestFloor = -Infinity;
		for (const region of this.regionsAt(point)) {
			const floor = this.regionFloorY(region, point);
			if (
				floor <= feetY + tolerance &&
				feetY < region.ceilingY &&
				floor > bestFloor
			) {
				best = region;
				bestFloor = floor;
			}
		}
		return best;
	}

	roomAt(point: Vec2, feetY: number): Room | null {
		const region = this.regionAt(point, feetY);
		if (!region) {
			return null;
		}
		if (region.roomId !== null) {
			return this.layout.rooms[region.roomId];
		}
		const opening = this.layout.openings[region.openingId as number];
		return this.layout.rooms[opening.roomA];
	}

	ceilingAt(point: Vec2, radius: number, feetY: number): number {
		let ceiling = Infinity;
		const bounds = {
			minX: point.x - radius,
			maxX: point.x + radius,
			minZ: point.z - radius,
			maxZ: point.z + radius,
		};
		for (const id of this.queryRegions(bounds)) {
			const region = this.regions[id];
			const floor = this.regionFloorY(region, point);
			if (floor > feetY + 0.6 || region.ceilingY <= feetY) {
				continue;
			}
			const inside = pointInPolygon(point, region.polygon);
			if (
				inside ||
				distanceToPolygonBoundary(point, region.polygon) < radius * 0.9
			) {
				ceiling = Math.min(ceiling, region.ceilingY);
			}
		}
		return ceiling;
	}

	private nextStamp(): number {
		this.stampCounter += 1;
		if (this.stampCounter > 4_000_000_000) {
			this.stampCounter = 1;
			this.wallStamp.fill(0);
			this.boxStamp.fill(0);
			this.regionStamp.fill(0);
		}
		return this.stampCounter;
	}

	private addRoomWalls(room: Room): void {
		room.edges.forEach((edge, edgeIndex) => {
			if (edge.kind === "arc") {
				const points = arcPoints(
					edge.center,
					edge.radius,
					edge.startAngle,
					edge.sweep,
				);
				for (let index = 0; index < points.length - 1; index += 1) {
					this.addWall(
						points[index],
						points[index + 1],
						room.floorY,
						room.ceilingY,
						room.id,
					);
				}
				return;
			}
			const length = edgeLength(edge);
			const direction = {
				x: (edge.b.x - edge.a.x) / length,
				z: (edge.b.z - edge.a.z) / length,
			};
			const pointAt = (distance: number) => ({
				x: edge.a.x + direction.x * distance,
				z: edge.a.z + direction.z * distance,
			});
			const slots = [...room.edgeOpenings[edgeIndex]].sort(
				(first, second) => first.from - second.from,
			);
			let cursor = 0;
			for (const slot of slots) {
				if (slot.from > cursor) {
					this.addWall(
						pointAt(cursor),
						pointAt(slot.from),
						room.floorY,
						room.ceilingY,
						room.id,
					);
				}
				const opening = this.layout.openings[slot.openingId];
				const bottom = opening.floorY + opening.sill;
				if (bottom > room.floorY + 0.01) {
					this.addWall(
						pointAt(slot.from),
						pointAt(slot.to),
						room.floorY,
						bottom,
						room.id,
					);
				}
				const lintel = opening.floorY + opening.height;
				if (lintel < room.ceilingY - 0.01) {
					this.addWall(
						pointAt(slot.from),
						pointAt(slot.to),
						lintel,
						room.ceilingY,
						room.id,
					);
				}
				cursor = slot.to;
			}
			if (cursor < length) {
				this.addWall(
					pointAt(cursor),
					pointAt(length),
					room.floorY,
					room.ceilingY,
					room.id,
				);
			}
		});
	}

	private addMezzanine(room: Room): void {
		const spec = room.mezzanine;
		if (!spec) {
			return;
		}
		this.decks.push(
			this.addRegion({
				polygon: spec.deck,
				floorY: spec.floorY,
				ceilingY: room.ceilingY,
				level: (room.level + 1) as Level,
				roomId: room.id,
				openingId: null,
				stair: null,
			}),
		);
		this.addRegion({
			polygon: spec.stairPolygon,
			floorY: room.floorY,
			ceilingY: room.ceilingY,
			level: room.level,
			roomId: room.id,
			openingId: null,
			stair: spec.stair,
		});
		const railTop = spec.floorY + MEZZANINE_RAIL_COLLIDER;
		for (const rail of spec.rails) {
			this.addWall(rail.a, rail.b, spec.floorY, railTop, room.id, true);
		}
		this.addWall(
			spec.stairSide.a,
			spec.stairSide.b,
			room.floorY,
			railTop,
			room.id,
			true,
		);
		if (spec.stairSideOuter) {
			this.addWall(
				spec.stairSideOuter.a,
				spec.stairSideOuter.b,
				room.floorY,
				railTop,
				room.id,
				true,
			);
		}
		this.addWall(
			spec.stairEnd.a,
			spec.stairEnd.b,
			room.floorY,
			spec.floorY - 0.02,
			room.id,
		);
		for (const post of spec.posts) {
			this.addBox({
				cx: post.x,
				cz: post.z,
				hx: MEZZANINE_POST_RADIUS,
				hz: MEZZANINE_POST_RADIUS,
				rotation: 0,
				yMin: room.floorY,
				yMax: room.ceilingY,
				walkable: false,
				occludes: true,
				kind: "furniture",
				ownerId: -1,
				enabled: true,
				soft: false,
			});
		}
	}

	private addOpeningGeometry(openingId: number): void {
		const opening = this.layout.openings[openingId];
		const passage = openingPassage(opening);
		const top = opening.floorY + 4;
		this.addWall(passage[0], passage[1], opening.floorY, top, opening.roomA);
		this.addWall(passage[3], passage[2], opening.floorY, top, opening.roomA);
		if (opening.kind === "window") {
			const middle = (index: number, other: number) => ({
				x: (passage[index].x + passage[other].x) / 2,
				z: (passage[index].z + passage[other].z) / 2,
			});
			this.addWall(
				middle(0, 1),
				middle(3, 2),
				opening.floorY + opening.sill,
				opening.floorY + opening.height,
				opening.roomA,
				true,
			);
			return;
		}
		this.addRegion({
			polygon: passage,
			floorY: opening.floorY,
			ceilingY: opening.floorY + opening.height,
			level: opening.level,
			roomId: null,
			openingId,
			stair: null,
		});
		if (opening.door) {
			const geometry = doorGeometry(opening);
			const box = doorPanelBox(geometry, geometry.closedAngle);
			const id = this.addBox({
				...box,
				hz: Math.max(box.hz, 0.06),
				walkable: false,
				occludes: true,
				kind: "door",
				ownerId: opening.door.id,
				enabled: !opening.door.initiallyOpen,
				soft: true,
			});
			this.doorBoxIds.set(opening.door.id, id);
		}
	}

	private addWall(
		a: Vec2,
		b: Vec2,
		yMin: number,
		yMax: number,
		roomId: number,
		glass = false,
	): void {
		if (Math.hypot(b.x - a.x, b.z - a.z) < 1e-4) {
			return;
		}
		const id = this.walls.length;
		this.walls.push({ id, a, b, yMin, yMax, roomId, glass });
		this.wallHash.insert(id, {
			minX: Math.min(a.x, b.x),
			maxX: Math.max(a.x, b.x),
			minZ: Math.min(a.z, b.z),
			maxZ: Math.max(a.z, b.z),
		});
	}

	private addBox(box: Omit<BoxCollider, "id">): number {
		const id = this.boxes.length;
		this.boxes.push({ ...box, id });
		const reach = Math.hypot(box.hx, box.hz);
		this.boxHash.insert(id, {
			minX: box.cx - reach,
			maxX: box.cx + reach,
			minZ: box.cz - reach,
			maxZ: box.cz + reach,
		});
		return id;
	}

	private addRegion(region: Omit<FloorRegion, "id" | "bounds">): FloorRegion {
		const id = this.regions.length;
		const bounds = polygonBounds(region.polygon);
		const added: FloorRegion = { ...region, id, bounds };
		this.regions.push(added);
		this.regionHash.insert(id, bounds);
		return added;
	}

	distanceToWalls(
		point: Vec2,
		yMin: number,
		yMax: number,
		radius: number,
	): number {
		let best = Infinity;
		const bounds = {
			minX: point.x - radius,
			maxX: point.x + radius,
			minZ: point.z - radius,
			maxZ: point.z + radius,
		};

		for (const id of this.queryWalls(bounds)) {
			const wall = this.walls[id];
			if (wall.yMax <= yMin || wall.yMin >= yMax) {
				continue;
			}
			const closest = closestPointOnSegment(point, wall.a, wall.b);
			best = Math.min(
				best,
				Math.hypot(point.x - closest.x, point.z - closest.z),
			);
		}

		return best;
	}
}

function arcPoints(
	center: Vec2,
	radius: number,
	startAngle: number,
	sweep: number,
): Vec2[] {
	const points: Vec2[] = [];
	const segments = 8;
	for (let index = 0; index <= segments; index += 1) {
		const angle = startAngle + (sweep * index) / segments;
		points.push({
			x: center.x + Math.cos(angle) * radius,
			z: center.z + Math.sin(angle) * radius,
		});
	}
	return points;
}
