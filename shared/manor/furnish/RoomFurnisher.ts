import {
	MEZZANINE_RAIL_COLLIDER,
	MIN_PILLAR_SPACING,
} from "../../config/index.js";
import {
	closestPointOnSegment,
	directionToYaw,
	distance2,
	rotate2,
	type Vec2,
} from "../../math.js";
import type { SeededRandom } from "../../random.js";
import { cauldronBrew } from "../brews.js";
import {
	type FurnitureDefinition,
	type FurnitureLightSpec,
	furnitureDefinition,
} from "../furnitureCatalog.js";
import { hideProfile } from "../hideProfiles.js";
import { stairHeightAt } from "../layoutBuilder.js";
import { deckIsConnected, postBoxes } from "../mezzanineShapes.js";
import {
	boxCorners,
	boxesOverlap2D,
	boxInsidePolygon,
	edgeDirection,
	edgeLength,
	pointInBox,
	pointInPolygon,
} from "../polygon.js";
import type {
	FurnitureItem,
	HideSpot,
	Level,
	LightSource,
	LineEdge,
	Opening,
	OrientedBox,
	Room,
	ValveStation,
} from "../types.js";
import { buildFurnitureColliders } from "./colliders.js";

export interface IdAllocator {
	furniture: number;
	hide: number;
	light: number;
	valve: number;
}

interface Footprint {
	box: OrientedBox;
	itemId: number;
	blocksWalking: boolean;
	isPlatform: boolean;
}

interface WallUse {
	from: number;
	to: number;
	bottom: number;
	top: number;
	kind: string;
}

interface Segment {
	a: Vec2;
	b: Vec2;
}

const GRID_STEP = 0.5;
const AGENT_CLEARANCE = 0.4;
const OPENING_ANCHOR_DEPTH = 0.65;
const PLATFORM_KINDS = new Set(["estrade", "dais"]);
const GRAND_CHANDELIER_DROP = 0.35;
const CEILING_ITEM_CLEARANCE = 0.25;
const DECK_DOOR_CLEARANCE = 0.9;
const DECK_STAIR_CLEARANCE = 1.3;
const DECK_ITEM_MAX_DEPTH = 0.9;

export interface WallItemOptions {
	variant?: number;
	edges?: number[];
	exteriorOnly?: boolean;
	avoidExterior?: boolean;
}

export interface FloorItemOptions {
	variant?: number;
	at?: Vec2;
	rotation?: number;
	wallMargin?: number;
	platform?: FurnitureItem;
	size?: { width: number; depth: number; height: number };
	allowOverlapWith?: number[];
	ignoreKeepClear?: boolean;
}

export class RoomFurnisher {
	readonly items: FurnitureItem[] = [];
	readonly hideSpots: HideSpot[] = [];
	readonly lights: LightSource[] = [];
	readonly valves: ValveStation[] = [];

	private readonly footprints: Footprint[] = [];
	private readonly keepClear: OrientedBox[] = [];
	private readonly wallUses: WallUse[][];
	private readonly wallSegments: Segment[];
	private readonly anchors: Vec2[] = [];
	private readonly groundOpenings: Opening[];
	private readonly reservedZones: OrientedBox[] = [];
	private readonly deckBoxes: OrientedBox[] = [];
	private readonly deckBlockers: OrientedBox[] = [];
	private minReachShare = 0.38;
	private readonly grid: {
		originX: number;
		originZ: number;
		columns: number;
		rows: number;
		base: Uint8Array;
		blocked: Uint16Array;
	};

	constructor(
		readonly room: Room,
		readonly roomOpenings: Opening[],
		readonly rng: SeededRandom,
		private readonly ids: IdAllocator,
	) {
		this.groundOpenings = room.mezzanine
			? roomOpenings.filter((opening) => opening.floorY < room.floorY + 1)
			: roomOpenings;
		this.wallUses = room.edges.map(() => []);
		this.wallSegments = this.computeWallSegments();
		this.grid = this.createGrid();
		for (const opening of this.groundOpenings) {
			if (opening.kind !== "window") {
				this.reserveOpeningClearance(opening);
			}
		}
		this.reserveMezzanine();
		if (this.room.mezzanine) {
			this.relaxAnchors();
		}
	}

	/**
	 * Poteaux et escalier peuvent déjà couper la grille, trop grossière pour voir
	 * qu'on passe entre eux : on ne garde que les ancrages de la plus grande zone,
	 * sinon plus aucun meuble ne pourrait jamais être posé au sol.
	 */
	private relaxAnchors(): void {
		if (this.isNavigable()) {
			return;
		}
		const groups = new Map<number, Vec2[]>();
		const label = new Int32Array(this.grid.base.length).fill(-1);
		const sizes = new Map<number, number>();
		for (const anchor of this.anchors) {
			const cell = this.nearestFreeCell(anchor);
			if (cell === null) {
				continue;
			}
			if (label[cell] < 0) {
				sizes.set(cell, this.floodFrom(cell, label, cell));
			}
			groups.set(label[cell], [...(groups.get(label[cell]) ?? []), anchor]);
		}
		let best = -1;
		for (const [id, size] of sizes) {
			if (best < 0 || size > (sizes.get(best) ?? 0)) {
				best = id;
			}
		}
		this.anchors.length = 0;
		this.anchors.push(...(groups.get(best) ?? []));
		let freeTotal = 0;
		for (const value of this.grid.base) {
			freeTotal += value === 1 ? 1 : 0;
		}
		this.minReachShare = Math.min(
			this.minReachShare,
			((sizes.get(best) ?? 0) / Math.max(1, freeTotal)) * 0.8,
		);
	}

	private floodFrom(start: number, label: Int32Array, id: number): number {
		const queue = [start];
		label[start] = id;
		let reached = 0;
		while (queue.length > 0) {
			const index = queue.pop() as number;
			reached += 1;
			const column = index % this.grid.columns;
			const row = (index - column) / this.grid.columns;
			for (const neighbor of [
				column > 0 ? index - 1 : -1,
				column < this.grid.columns - 1 ? index + 1 : -1,
				row > 0 ? index - this.grid.columns : -1,
				row < this.grid.rows - 1 ? index + this.grid.columns : -1,
			]) {
				if (neighbor >= 0 && label[neighbor] < 0 && this.isFreeCell(neighbor)) {
					label[neighbor] = id;
					queue.push(neighbor);
				}
			}
		}
		return reached;
	}

	private reserveMezzanine(): void {
		const spec = this.room.mezzanine;
		if (!spec) {
			return;
		}
		const { stair } = spec;
		const rotation = Math.atan2(stair.right.z, stair.right.x);
		const front = 1.4;
		const body: OrientedBox = {
			cx: stair.origin.x + (stair.forward.x * stair.length) / 2,
			cz: stair.origin.z + (stair.forward.z * stair.length) / 2,
			hx: stair.width / 2 + 0.1,
			hz: stair.length / 2 + 0.1,
			rotation,
			yMin: 0,
			yMax: 3,
		};
		const approach: OrientedBox = {
			...body,
			cx: stair.origin.x + (stair.forward.x * (stair.length - front)) / 2,
			cz: stair.origin.z + (stair.forward.z * (stair.length - front)) / 2,
			hx: stair.width / 2 + 0.3,
			hz: (stair.length + front) / 2,
		};
		this.reservedZones.push(approach);
		this.keepClear.push(approach);
		const posts = spec.posts.map((post) => ({
			cx: post.x,
			cz: post.z,
			hx: 0.6,
			hz: 0.6,
			rotation: 0,
			yMin: 0,
			yMax: 3,
		}));
		this.reservedZones.push(...posts);
		this.keepClear.push(...posts);
		const { grid } = this;
		for (let row = 0; row < grid.rows; row += 1) {
			for (let column = 0; column < grid.columns; column += 1) {
				const point = {
					x: grid.originX + (column + 0.5) * GRID_STEP,
					z: grid.originZ + (row + 0.5) * GRID_STEP,
				};
				if (
					[body, ...posts].some((zone) =>
						pointInBox(point, zone, AGENT_CLEARANCE),
					)
				) {
					grid.base[row * grid.columns + column] = 0;
				}
			}
		}
		this.anchors.push({
			x: stair.origin.x - stair.forward.x * 0.9,
			z: stair.origin.z - stair.forward.z * 0.9,
		});
		this.wallUses[spec.stairEdge]?.push({
			from: spec.stairEdgeFrom,
			to: spec.stairEdgeTo,
			bottom: 0,
			top: this.room.height,
			kind: "stair",
		});
	}

	placeOnDeck(
		kind: string,
		center: Vec2,
		rotation: number,
		variant?: number,
		options: {
			size?: { width: number; depth: number; height: number };
			platform?: FurnitureItem;
		} = {},
	): FurnitureItem | null {
		const spec = this.room.mezzanine;
		if (!spec) {
			return null;
		}
		const definition = furnitureDefinition(kind);
		const chosen = variant ?? this.rng.int(0, definition.variants.length - 1);
		const size = options.size ?? definition.variants[chosen];
		const box: OrientedBox = {
			cx: center.x,
			cz: center.z,
			hx: size.width / 2,
			hz: size.depth / 2,
			rotation,
			yMin: 0,
			yMax: size.height,
		};
		const reach = Math.hypot(box.hx, box.hz);
		const stairTop = closestPointOnSegment(
			center,
			spec.stairEnd.a,
			spec.stairEnd.b,
		);
		const nearDoor = this.roomOpenings.some((opening) => {
			if (opening.floorY < spec.floorY - 0.5) {
				return false;
			}
			const side = this.openingSide(opening);
			return (
				distance2(center, {
					x: (side.start.x + side.end.x) / 2,
					z: (side.start.z + side.end.z) / 2,
				}) <
				reach + opening.width / 2 + DECK_DOOR_CLEARANCE
			);
		});
		if (
			!boxCorners(box).every((corner) => pointInPolygon(corner, spec.deck)) ||
			distance2(center, stairTop) < reach + DECK_STAIR_CLEARANCE ||
			nearDoor ||
			(spec.deckKeepClear !== null &&
				[center, ...boxCorners(box)].some((corner) =>
					pointInPolygon(corner, spec.deckKeepClear as Vec2[]),
				)) ||
			(!options.platform &&
				this.deckBoxes.some((other) => boxesOverlap2D(other, box, 0.2))) ||
			(definition.collides &&
				!definition.walkableTop &&
				!deckIsConnected(spec.deck, spec.stairEnd, [
					...postBoxes(spec.posts),
					...this.deckBlockers,
					box,
				]))
		) {
			return null;
		}
		const item = this.createItem(definition, chosen, {
			x: center.x,
			y: spec.floorY + (options.platform?.height ?? 0),
			z: center.z,
			rotation,
			size,
			parentId: options.platform?.id ?? null,
		});
		if (definition.collides && !options.platform) {
			this.deckBoxes.push(box);
		}
		if (definition.collides && !definition.walkableTop) {
			this.deckBlockers.push(box);
		}
		this.finalizeItem(item, definition);
		return item;
	}

	/** Plante qui retombe d'un garde-corps, sans collision, côté vide. */
	hangOnRail(kind: string, rail: { a: Vec2; b: Vec2 }, t: number): void {
		const spec = this.room.mezzanine;
		if (!spec) {
			return;
		}
		const length = distance2(rail.a, rail.b);
		const definition = furnitureDefinition(kind);
		const size = definition.variants[0];
		if (length < size.width + 0.2) {
			return;
		}
		const unit = {
			x: (rail.b.x - rail.a.x) / length,
			z: (rail.b.z - rail.a.z) / length,
		};
		const point = {
			x: rail.a.x + (rail.b.x - rail.a.x) * t,
			z: rail.a.z + (rail.b.z - rail.a.z) * t,
		};
		const voidSide = pointInPolygon(
			{ x: point.x - unit.z * 0.4, z: point.z + unit.x * 0.4 },
			spec.deck,
		)
			? { x: unit.z, z: -unit.x }
			: { x: -unit.z, z: unit.x };
		const item = this.createItem(definition, 0, {
			x: point.x,
			y: spec.floorY,
			z: point.z,
			rotation: Math.atan2(-voidSide.x, voidSide.z),
			size,
			parentId: null,
		});
		this.finalizeItem(item, definition);
	}

	/** Liane enroulée autour d'un poteau de la mezzanine. */
	wrapPost(kind: string, post: Vec2, height: number): void {
		const definition = furnitureDefinition(kind);
		const item = this.createItem(definition, 0, {
			x: post.x,
			y: this.room.floorY,
			z: post.z,
			rotation: 0,
			size: { ...definition.variants[0], height },
			parentId: null,
		});
		this.finalizeItem(item, definition);
	}

	dressDeckWall(
		edgeIndex: number,
		kinds: readonly (readonly [string, number])[],
	): void {
		const spec = this.room.mezzanine;
		const edge = this.room.edges[edgeIndex];
		if (!spec || edge.kind !== "line") {
			return;
		}
		const direction = edgeDirection(edge);
		const inward = { x: -direction.z, z: direction.x };
		const length = edgeLength(edge);
		const level = spec.floorY - this.room.floorY;
		let along = this.rng.range(0.4, 1.2);
		while (along < length - 0.4) {
			const kind = this.rng.weighted(kinds);
			const definition = furnitureDefinition(kind);
			const variant = this.rng.int(0, definition.variants.length - 1);
			const size = definition.variants[variant];
			const offset = size.depth / 2 + definition.wallOffset;
			const item =
				size.depth <= DECK_ITEM_MAX_DEPTH
					? this.placeOnDeck(
							kind,
							{
								x:
									edge.a.x +
									direction.x * (along + size.width / 2) +
									inward.x * offset,
								z:
									edge.a.z +
									direction.z * (along + size.width / 2) +
									inward.z * offset,
							},
							Math.atan2(-inward.x, inward.z),
							variant,
						)
					: null;
			if (!item) {
				along += 0.5;
				continue;
			}
			this.wallUses[edgeIndex].push({
				from: along,
				to: along + size.width,
				bottom: level,
				top: level + size.height,
				kind,
			});
			along += size.width + this.rng.range(0.3, 1.1);
		}
	}

	dressDeckRails(kinds: readonly string[], count: number): void {
		const spec = this.room.mezzanine;
		if (!spec) {
			return;
		}
		for (let attempt = 0; attempt < count * 4; attempt += 1) {
			const rail = this.rng.pick(spec.rails);
			const t = this.rng.range(0.1, 0.9);
			const length = distance2(rail.a, rail.b);
			const unit = {
				x: (rail.b.x - rail.a.x) / length,
				z: (rail.b.z - rail.a.z) / length,
			};
			const point = {
				x: rail.a.x + (rail.b.x - rail.a.x) * t,
				z: rail.a.z + (rail.b.z - rail.a.z) * t,
			};
			const normal = pointInPolygon(
				{ x: point.x - unit.z * 0.6, z: point.z + unit.x * 0.6 },
				spec.deck,
			)
				? { x: -unit.z, z: unit.x }
				: { x: unit.z, z: -unit.x };
			const placed = this.placeOnDeck(
				this.rng.pick(kinds),
				{ x: point.x + normal.x * 0.45, z: point.z + normal.z * 0.45 },
				Math.atan2(-normal.x, normal.z),
			);
			if (placed) {
				count -= 1;
				if (count <= 0) {
					return;
				}
			}
		}
	}

	layDeckRunner(): void {
		const spec = this.room.mezzanine;
		if (!spec) {
			return;
		}
		const rail = spec.rails[0];
		const length = distance2(rail.a, rail.b);
		if (length < 3) {
			return;
		}
		const unit = {
			x: (rail.b.x - rail.a.x) / length,
			z: (rail.b.z - rail.a.z) / length,
		};
		const middle = {
			x: (rail.a.x + rail.b.x) / 2,
			z: (rail.a.z + rail.b.z) / 2,
		};
		const normal = pointInPolygon(
			{ x: middle.x - unit.z * 0.6, z: middle.z + unit.x * 0.6 },
			spec.deck,
		)
			? { x: -unit.z, z: unit.x }
			: { x: unit.z, z: -unit.x };
		const definition = furnitureDefinition("rug");
		const item = this.createItem(definition, 0, {
			x: middle.x + normal.x * 1.2,
			y: spec.floorY,
			z: middle.z + normal.z * 1.2,
			rotation: Math.atan2(-normal.x, normal.z),
			size: { width: length - 1, depth: 1.5, height: 0.02 },
			parentId: null,
		});
		this.finalizeItem(item, definition);
	}

	floorStandingItems(): FurnitureItem[] {
		return this.items.filter(
			(item) =>
				item.parentId === null &&
				item.colliders.length > 0 &&
				Math.abs(item.y - this.room.floorY) < 0.01,
		);
	}

	coverage(): number {
		const area = this.footprints.reduce(
			(sum, footprint) => sum + footprint.box.hx * footprint.box.hz * 4,
			0,
		);
		return area / Math.max(1, this.room.area);
	}

	get definitionOfRoom(): Room {
		return this.room;
	}

	openingSide(opening: Opening): { start: Vec2; end: Vec2; inward: Vec2 } {
		if (opening.roomA === this.room.id) {
			return {
				start: opening.start,
				end: opening.end,
				inward: { x: -opening.normal.x, z: -opening.normal.z },
			};
		}
		return {
			start: {
				x: opening.start.x + opening.normal.x * opening.depth,
				z: opening.start.z + opening.normal.z * opening.depth,
			},
			end: {
				x: opening.end.x + opening.normal.x * opening.depth,
				z: opening.end.z + opening.normal.z * opening.depth,
			},
			inward: opening.normal,
		};
	}

	wallItem(kind: string, options: WallItemOptions = {}): FurnitureItem | null {
		const definition = furnitureDefinition(kind);
		for (let attempt = 0; attempt < 16; attempt += 1) {
			const variant =
				options.variant ?? this.rng.int(0, definition.variants.length - 1);
			const size = definition.variants[variant];
			const placement = this.pickWallSpot(size.width, size.height, options);
			if (!placement) {
				continue;
			}
			const { edgeIndex, along } = placement;
			const edge = this.room.edges[edgeIndex] as LineEdge;
			const direction = edgeDirection(edge);
			const inward = { x: -direction.z, z: direction.x };
			const offset = size.depth / 2 + definition.wallOffset;
			const center = {
				x: edge.a.x + direction.x * along + inward.x * offset,
				z: edge.a.z + direction.z * along + inward.z * offset,
			};
			const rotation = Math.atan2(-inward.x, inward.z);
			const item = this.tryCommit(
				definition,
				variant,
				center,
				rotation,
				size,
				{},
			);
			if (item) {
				this.wallUses[edgeIndex].push({
					from: along - size.width / 2,
					to: along + size.width / 2,
					bottom: 0,
					top: size.height,
					kind,
				});
				return item;
			}
		}
		return null;
	}

	wallItemsBetween(
		kind: string,
		min: number,
		max: number,
		options: WallItemOptions = {},
	): FurnitureItem[] {
		const count = this.rng.int(min, max);
		const placed: FurnitureItem[] = [];
		for (let index = 0; index < count; index += 1) {
			const item = this.wallItem(kind, options);
			if (item) {
				placed.push(item);
			}
		}
		return placed;
	}

	floorItem(
		kind: string,
		options: FloorItemOptions = {},
	): FurnitureItem | null {
		const definition = furnitureDefinition(kind);
		const attempts = options.at ? 1 : 28;
		for (let attempt = 0; attempt < attempts; attempt += 1) {
			const variant =
				options.variant ?? this.rng.int(0, definition.variants.length - 1);
			const size = options.size ?? definition.variants[variant];
			const rotation =
				options.rotation ??
				this.room.axisAngle + (this.rng.int(0, 3) * Math.PI) / 2;
			const center =
				options.at ??
				this.randomInteriorPoint(
					Math.max(size.width, size.depth) / 2 + (options.wallMargin ?? 0.7),
				);
			if (!center) {
				continue;
			}
			const item = this.tryCommit(
				definition,
				variant,
				center,
				rotation,
				size,
				options,
			);
			if (item) {
				return item;
			}
		}
		return null;
	}

	floorItemsBetween(
		kind: string,
		min: number,
		max: number,
		options: FloorItemOptions = {},
	): FurnitureItem[] {
		const count = this.rng.int(min, max);
		const placed: FurnitureItem[] = [];
		for (let index = 0; index < count; index += 1) {
			const item = this.floorItem(kind, options);
			if (item) {
				placed.push(item);
			}
		}
		return placed;
	}

	surfaceItem(
		parent: FurnitureItem,
		kind: string,
		localX: number,
		localZ: number,
		rotationOffset = 0,
	): FurnitureItem | null {
		const definition = furnitureDefinition(kind);
		const variant = this.rng.int(0, definition.variants.length - 1);
		const size = definition.variants[variant];
		const world = rotate2({ x: localX, z: localZ }, parent.rotation);
		const item = this.createItem(definition, variant, {
			x: parent.x + world.x,
			y: parent.y + parent.height,
			z: parent.z + world.z,
			rotation: parent.rotation + rotationOffset,
			size,
			parentId: parent.id,
		});
		this.finalizeItem(item, definition);
		return item;
	}

	decorateSurface(
		parent: FurnitureItem,
		kinds: readonly (readonly [string, number])[],
		min: number,
		max: number,
	): void {
		const count = this.rng.int(min, max);
		const usable = Math.max(0, parent.width - 0.35);
		const used: number[] = [];
		for (let index = 0; index < count; index += 1) {
			const kind = this.rng.weighted(kinds);
			const definition = furnitureDefinition(kind);
			const size = definition.variants[0];
			const localX = (this.rng.next() - 0.5) * Math.max(0, usable - size.width);
			if (used.some((value) => Math.abs(value - localX) < 0.3)) {
				continue;
			}
			used.push(localX);
			const localZ =
				(this.rng.next() - 0.5) * Math.max(0, parent.depth - size.depth - 0.2);
			this.surfaceItem(
				parent,
				kind,
				localX,
				localZ,
				(this.rng.next() - 0.5) * 0.6,
			);
		}
	}

	wallDecor(
		kind: string,
		options: WallItemOptions & { mountY?: number } = {},
	): FurnitureItem | null {
		const definition = furnitureDefinition(kind);
		for (let attempt = 0; attempt < 12; attempt += 1) {
			const variant =
				options.variant ?? this.rng.int(0, definition.variants.length - 1);
			const size = definition.variants[variant];
			const [mountMin, mountMax] = definition.mountHeight ?? [1.2, 1.6];
			const flame = definition.light
				? Math.max(0, definition.light.offsetY) + 0.1
				: 0;
			const highest = this.room.height - 0.12 - size.height - flame;
			const bottom = Math.min(
				options.mountY ??
					Math.round(this.rng.range(mountMin, mountMax) * 20) / 20,
				Math.floor(highest * 20) / 20,
			);
			const top = bottom + size.height;
			if (bottom < mountMin - 0.6 || top > this.room.height - 0.12) {
				continue;
			}
			const spot = this.pickDecorSpot(size.width, bottom, top, options);
			if (!spot) {
				continue;
			}
			const edge = this.room.edges[spot.edgeIndex] as LineEdge;
			const direction = edgeDirection(edge);
			const inward = { x: -direction.z, z: direction.x };
			const point = {
				x: edge.a.x + direction.x * spot.along,
				z: edge.a.z + direction.z * spot.along,
			};
			const lift = this.stairLift(point, direction, size.width);
			const lifted = { bottom: bottom + lift, top: top + lift };
			if (
				lifted.top > this.room.height - 0.12 ||
				this.decorClashes(point, size.width, lifted.bottom, lifted.top)
			) {
				continue;
			}
			const item = this.createItem(definition, variant, {
				x: point.x + inward.x * 0.001,
				y: this.room.floorY + lifted.bottom,
				z: point.z + inward.z * 0.001,
				rotation: Math.atan2(-inward.x, inward.z),
				size,
				parentId: null,
			});
			this.wallUses[spot.edgeIndex].push({
				from: spot.along - size.width / 2,
				to: spot.along + size.width / 2,
				bottom: lifted.bottom,
				top: lifted.top,
				kind,
			});
			this.finalizeItem(item, definition);
			return item;
		}
		return null;
	}

	private stairLift(point: Vec2, direction: Vec2, width: number): number {
		const stair = this.room.stair;
		if (!stair) {
			return 0;
		}
		const ends = [-0.5, 0.5].map((side) => ({
			x: point.x + direction.x * width * side,
			z: point.z + direction.z * width * side,
		}));
		const beside = ends.some((end) => {
			const offsetX = end.x - stair.origin.x;
			const offsetZ = end.z - stair.origin.z;
			const along = offsetX * stair.forward.x + offsetZ * stair.forward.z;
			const across = offsetX * stair.right.x + offsetZ * stair.right.z;
			return (
				along > -0.3 &&
				along < stair.length + 0.3 &&
				Math.abs(across) < stair.width / 2 + 0.3
			);
		});
		return beside
			? Math.max(...ends.map((end) => stairHeightAt(stair, end)))
			: 0;
	}

	private decorClashes(
		point: Vec2,
		width: number,
		bottom: number,
		top: number,
	): boolean {
		return this.items.some((other) => {
			if (furnitureDefinition(other.kind).placement !== "wallDecor") {
				return false;
			}
			const otherBottom = other.y - this.room.floorY;
			const vertical = otherBottom < top && otherBottom + other.height > bottom;
			return (
				vertical &&
				Math.hypot(other.x - point.x, other.z - point.z) <
					(other.width + width) / 2
			);
		});
	}

	wallDecorBetween(
		kind: string,
		min: number,
		max: number,
		options: WallItemOptions & { mountY?: number } = {},
	): void {
		const count = this.rng.int(min, max);
		for (let index = 0; index < count; index += 1) {
			this.wallDecor(kind, options);
		}
	}

	windows(variants: number[], spacing: number): void {
		if (variants.length === 0) {
			return;
		}
		this.room.edges.forEach((edge, edgeIndex) => {
			if (edge.kind !== "line" || !this.room.exteriorEdges[edgeIndex]) {
				return;
			}
			const count = Math.floor((edgeLength(edge) - 0.6) / spacing);
			for (let index = 0; index < Math.max(0, Math.min(count, 4)); index += 1) {
				const variant = this.rng.pick(variants);
				this.wallDecor("window", {
					variant,
					edges: [edgeIndex],
					mountY: windowSill(variant),
				});
			}
		});
	}

	ceilingItem(kind: string, at: Vec2, variant?: number): FurnitureItem | null {
		const definition = furnitureDefinition(kind);
		const chosen = variant ?? this.rng.int(0, definition.variants.length - 1);
		const nominal = definition.variants[chosen];
		const spec = this.room.mezzanine;
		const spots = [at, ...(kind === "chandelier" ? spotsAround(at) : [])];
		for (const spot of spots) {
			const size =
				spec && kind === "chandelier" && !pointInPolygon(spot, spec.deck)
					? {
							...nominal,
							height: this.room.ceilingY - spec.floorY - GRAND_CHANDELIER_DROP,
						}
					: nominal;
			if (
				!pointInPolygon(spot, this.room.polygon) ||
				this.distanceToWalls(spot) < size.width / 2 + 0.3 ||
				this.room.height - size.height < 2.35 ||
				!this.ceilingSpotFree(spot, size)
			) {
				continue;
			}
			const item = this.createItem(definition, chosen, {
				x: spot.x,
				y: this.room.ceilingY - size.height,
				z: spot.z,
				rotation: this.room.axisAngle,
				size,
				parentId: null,
			});
			this.finalizeItem(item, definition);
			return item;
		}
		return null;
	}

	private ceilingSpotFree(
		spot: Vec2,
		size: { width: number; height: number },
	): boolean {
		const bottom = this.room.ceilingY - size.height;
		const reach = size.width / 2 + CEILING_ITEM_CLEARANCE;
		const spec = this.room.mezzanine;
		if (spec) {
			if (spec.posts.some((post) => distance2(post, spot) < reach + 0.25)) {
				return false;
			}
			if (
				bottom < spec.floorY + MEZZANINE_RAIL_COLLIDER + 0.2 &&
				spec.rails.some(
					(rail) =>
						distance2(spot, closestPointOnSegment(spot, rail.a, rail.b)) <
						reach,
				)
			) {
				return false;
			}
		}
		return !this.items.some(
			(item) =>
				item.colliders.some((collider) => collider.yMax > bottom - 0.1) &&
				distance2(item, spot) < reach + Math.max(item.width, item.depth) / 2,
		);
	}

	cobwebs(min: number, max: number): void {
		const corners = this.cornerPoints();
		const count = this.rng.int(min, max);
		const definition = furnitureDefinition("cobweb");
		for (const corner of this.rng.shuffle(corners).slice(0, count)) {
			const variant = this.rng.int(0, 1);
			const size = definition.variants[variant];
			const item = this.createItem(definition, variant, {
				x: corner.point.x,
				y: this.room.ceilingY - size.height,
				z: corner.point.z,
				rotation: corner.rotation,
				size,
				parentId: null,
			});
			this.finalizeItem(item, definition);
		}
	}

	hangingCobwebs(count: number): void {
		const definition = furnitureDefinition("cobweb");
		const size = definition.variants[2];
		for (let index = 0; index < count; index += 1) {
			const point = this.randomInteriorPoint(0.35);
			if (!point) {
				continue;
			}
			const item = this.createItem(definition, 2, {
				x: point.x,
				y: this.room.ceilingY - size.height,
				z: point.z,
				rotation: this.rng.range(0, Math.PI * 2),
				size,
				parentId: null,
			});
			this.finalizeItem(item, definition);
		}
	}

	randomInteriorPoint(wallMargin: number): Vec2 | null {
		const { bounds } = this.room;
		for (let attempt = 0; attempt < 24; attempt += 1) {
			const point = {
				x: Math.round(this.rng.range(bounds.minX, bounds.maxX) * 4) / 4,
				z: Math.round(this.rng.range(bounds.minZ, bounds.maxZ) * 4) / 4,
			};
			if (
				pointInPolygon(point, this.room.polygon) &&
				this.distanceToWalls(point) >= wallMargin
			) {
				return point;
			}
		}
		return null;
	}

	distanceToWalls(point: Vec2): number {
		let best = Infinity;
		for (const segment of this.wallSegments) {
			best = Math.min(
				best,
				distance2(point, closestPointOnSegment(point, segment.a, segment.b)),
			);
		}
		return best;
	}

	facingAwayFromWall(point: Vec2): number {
		let best: Segment | null = null;
		let bestDistance = Infinity;
		for (const segment of this.wallSegments) {
			const distance = distance2(
				point,
				closestPointOnSegment(point, segment.a, segment.b),
			);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = segment;
			}
		}
		if (!best) {
			return this.room.axisAngle;
		}
		const direction = { x: best.b.x - best.a.x, z: best.b.z - best.a.z };
		const inward = { x: -direction.z, z: direction.x };
		return Math.atan2(-inward.x, inward.z);
	}

	removeItem(item: FurnitureItem): void {
		const removedIds = new Set([
			item.id,
			...this.items
				.filter((other) => other.parentId === item.id)
				.map((other) => other.id),
		]);
		for (let index = this.items.length - 1; index >= 0; index -= 1) {
			if (removedIds.has(this.items[index].id)) {
				this.items.splice(index, 1);
			}
		}
		for (let index = this.footprints.length - 1; index >= 0; index -= 1) {
			const footprint = this.footprints[index];
			if (removedIds.has(footprint.itemId)) {
				this.markFootprint(footprint, -1);
				this.footprints.splice(index, 1);
			}
		}
		for (const list of [this.hideSpots, this.lights, this.valves] as {
			furnitureId: number | null;
		}[][]) {
			for (let index = list.length - 1; index >= 0; index -= 1) {
				const owner = list[index].furnitureId;
				if (owner !== null && removedIds.has(owner)) {
					list.splice(index, 1);
				}
			}
		}
	}

	private tryCommit(
		definition: FurnitureDefinition,
		variant: number,
		center: Vec2,
		rotation: number,
		size: { width: number; depth: number; height: number },
		options: FloorItemOptions,
	): FurnitureItem | null {
		const box: OrientedBox = {
			cx: center.x,
			cz: center.z,
			hx: size.width / 2,
			hz: size.depth / 2,
			rotation,
			yMin: 0,
			yMax: size.height,
		};
		if (this.reservedZones.some((zone) => boxesOverlap2D(zone, box, 0.01))) {
			return null;
		}
		if (
			definition.kind === "pillar" &&
			this.pillarTooClose(center, size.width)
		) {
			return null;
		}
		const platform = options.platform ?? null;
		if (platform) {
			if (!boxInsideBox(box, platform)) {
				return null;
			}
		} else if (!boxInsidePolygon(box, this.room.polygon, 0.004)) {
			return null;
		}
		const overlapAllowed = new Set([
			...(options.allowOverlapWith ?? []),
			...(platform ? [platform.id] : []),
		]);
		if (definition.collides && this.overlapsFootprints(box, overlapAllowed)) {
			return null;
		}
		if (
			!options.ignoreKeepClear &&
			definition.collides &&
			this.keepClear.some((zone) => boxesOverlap2D(zone, box, 0.01))
		) {
			return null;
		}
		const front =
			definition.placement === "wall"
				? this.frontZone(box, definition.frontClearance)
				: null;
		if (
			front &&
			(!boxInsidePolygon(front, this.room.polygon, 0) ||
				this.overlapsFootprints(front, new Set()))
		) {
			return null;
		}

		const item = this.createItem(definition, variant, {
			x: center.x,
			y: platform ? platform.y + platform.height : this.room.floorY,
			z: center.z,
			rotation,
			size,
			parentId: platform?.id ?? null,
		});
		if (this.cutsDeck(item)) {
			this.ids.furniture -= 1;
			this.items.pop();
			return null;
		}
		const footprint: Footprint | null = definition.collides
			? {
					box,
					itemId: item.id,
					blocksWalking: !PLATFORM_KINDS.has(item.kind),
					isPlatform: PLATFORM_KINDS.has(item.kind),
				}
			: null;
		if (footprint) {
			this.footprints.push(footprint);
			this.markFootprint(footprint, 1);
		}
		const extraAnchors = this.anchorsFor(item, definition, box);
		this.anchors.push(...extraAnchors);
		if (footprint && !this.isNavigable()) {
			this.anchors.splice(
				this.anchors.length - extraAnchors.length,
				extraAnchors.length,
			);
			this.markFootprint(footprint, -1);
			this.footprints.pop();
			this.ids.furniture -= 1;
			this.items.pop();
			return null;
		}
		if (front) {
			this.keepClear.push(front);
		}
		this.finalizeItem(item, definition);
		return item;
	}

	private pillarTooClose(center: Vec2, width: number): boolean {
		const spaced = [
			...this.items.filter((item) => item.kind === "pillar"),
			...(this.room.mezzanine?.posts ?? []),
		].some((other) => distance2(other, center) < MIN_PILLAR_SPACING);
		return (
			spaced ||
			this.items.some(
				(item) =>
					furnitureDefinition(item.kind).placement === "ceiling" &&
					distance2(item, center) <
						item.width / 2 + width / 2 + CEILING_ITEM_CLEARANCE,
			)
		);
	}

	private cutsDeck(item: FurnitureItem): boolean {
		const spec = this.room.mezzanine;
		return (
			spec !== null &&
			item.colliders.some(
				(collider) =>
					collider.yMax > spec.floorY &&
					[...boxCorners(collider), { x: collider.cx, z: collider.cz }].some(
						(point) => pointInPolygon(point, spec.deck),
					),
			)
		);
	}

	private createItem(
		definition: FurnitureDefinition,
		variant: number,
		placement: {
			x: number;
			y: number;
			z: number;
			rotation: number;
			size: { width: number; depth: number; height: number };
			parentId: number | null;
		},
	): FurnitureItem {
		const item: FurnitureItem = {
			id: this.ids.furniture++,
			kind: definition.kind,
			variant,
			roomId: this.room.id,
			level: this.room.level,
			x: round(placement.x),
			y: round(placement.y),
			z: round(placement.z),
			rotation: round(placement.rotation),
			width: placement.size.width,
			depth: placement.size.depth,
			height:
				definition.kind === "pillar" ? this.room.height : placement.size.height,
			colliders: [],
			hideSpotId: null,
			valveId: null,
			parentId: placement.parentId,
			seed: Math.floor(this.rng.next() * 2 ** 31),
		};
		item.colliders = buildFurnitureColliders(item, this.room.ceilingY);
		this.items.push(item);
		return item;
	}

	private finalizeItem(
		item: FurnitureItem,
		definition: FurnitureDefinition,
	): void {
		if (definition.light) {
			this.addLight(item, definition);
		}
		if (definition.hideable) {
			this.addHideSpot(item);
		}
		if (item.kind === "valveStation") {
			this.addValve(item);
		}
	}

	private addLight(item: FurnitureItem, definition: FurnitureDefinition): void {
		const light = definition.light as FurnitureLightSpec;
		const local = rotate2({ x: 0, z: light.offsetZ }, item.rotation);
		const baseY =
			item.y +
			(definition.placement === "ceiling"
				? definition.variants[item.variant].height
				: item.height);
		const y = round(baseY + light.offsetY);
		const spec = this.room.mezzanine;
		const grand = spec !== null && definition.placement === "ceiling";
		this.lights.push({
			id: this.ids.light++,
			roomId: this.room.id,
			level:
				spec && y >= spec.floorY
					? ((this.room.level + 1) as Level)
					: this.room.level,
			position: {
				x: round(item.x + local.x),
				y,
				z: round(item.z + local.z),
			},
			color:
				item.kind === "cauldron" ? cauldronBrew(item.seed).light : light.color,
			intensity: grand ? light.intensity * 2.2 : light.intensity,
			radius: grand ? light.radius * 1.8 : light.radius,
			kind: light.kind,
			furnitureId: item.id,
		});
	}

	private addHideSpot(item: FurnitureItem): void {
		const front = rotate2({ x: 0, z: 1 }, item.rotation);
		const profile = hideProfile(item.kind, item.width, item.depth, item.height);
		const interior = rotate2(profile.interior, item.rotation);
		const entryLocal = rotate2(
			{ x: profile.interior.x, z: item.depth / 2 + 0.62 },
			item.rotation,
		);
		const spot: HideSpot = {
			id: this.ids.hide++,
			furnitureId: item.id,
			interior: {
				x: round(item.x + interior.x),
				y: round(item.y + profile.eye),
				z: round(item.z + interior.z),
			},
			entry: {
				x: round(item.x + entryLocal.x),
				z: round(item.z + entryLocal.z),
			},
			facing: round(directionToYaw(front)),
			label: furnitureDefinition(item.kind).label,
		};
		item.hideSpotId = spot.id;
		this.hideSpots.push(spot);
	}

	private addValve(item: FurnitureItem): void {
		const toWorld = (x: number, z: number) => rotate2({ x, z }, item.rotation);
		const valve = toWorld(item.width / 2 - 0.3, -item.depth / 2 + 0.42);
		const spout = toWorld(0, item.depth / 2 + 0.25);
		const jet = toWorld(0, item.depth / 2 + 0.25);
		const station: ValveStation = {
			id: this.ids.valve++,
			furnitureId: item.id,
			roomId: this.room.id,
			level: this.room.level,
			valve: {
				x: round(item.x + valve.x),
				y: round(item.y + 1.15),
				z: round(item.z + valve.z),
			},
			spout: {
				x: round(item.x + spout.x),
				y: round(item.y + 2.25),
				z: round(item.z + spout.z),
			},
			jet: { x: round(item.x + jet.x), z: round(item.z + jet.z) },
			floorY: item.y,
		};
		item.valveId = station.id;
		this.valves.push(station);
	}

	private anchorsFor(
		item: FurnitureItem,
		definition: FurnitureDefinition,
		box: OrientedBox,
	): Vec2[] {
		if (
			definition.hideable ||
			item.kind === "valveStation" ||
			item.kind === "occultAltar" ||
			item.kind.startsWith("stake")
		) {
			const front = rotate2({ x: 0, z: box.hz + 0.6 }, box.rotation);
			return [{ x: box.cx + front.x, z: box.cz + front.z }];
		}
		return [];
	}

	private frontZone(box: OrientedBox, clearance: number): OrientedBox {
		const front = rotate2({ x: 0, z: box.hz + clearance / 2 }, box.rotation);
		return {
			cx: box.cx + front.x,
			cz: box.cz + front.z,
			hx: Math.max(0.3, box.hx - 0.05),
			hz: clearance / 2,
			rotation: box.rotation,
			yMin: 0,
			yMax: 2,
		};
	}

	private overlapsFootprints(box: OrientedBox, allowed: Set<number>): boolean {
		return this.footprints.some(
			(footprint) =>
				!allowed.has(footprint.itemId) &&
				boxesOverlap2D(footprint.box, box, 0.02),
		);
	}

	private pickWallSpot(
		width: number,
		height: number,
		options: WallItemOptions,
	): { edgeIndex: number; along: number } | null {
		const candidates: { edgeIndex: number; from: number; to: number }[] = [];
		this.room.edges.forEach((edge, edgeIndex) => {
			if (edge.kind !== "line") {
				return;
			}
			if (options.edges && !options.edges.includes(edgeIndex)) {
				return;
			}
			if (options.exteriorOnly && !this.room.exteriorEdges[edgeIndex]) {
				return;
			}
			if (options.avoidExterior && this.room.exteriorEdges[edgeIndex]) {
				return;
			}
			for (const [from, to] of this.freeWallIntervals(edgeIndex, 0, height)) {
				if (to - from >= width) {
					candidates.push({ edgeIndex, from, to });
				}
			}
		});
		if (candidates.length === 0) {
			return null;
		}
		const chosen = this.rng.weighted(
			candidates.map(
				(candidate) => [candidate, candidate.to - candidate.from] as const,
			),
		);
		const along = this.rng.range(
			chosen.from + width / 2,
			chosen.to - width / 2,
		);
		return { edgeIndex: chosen.edgeIndex, along: Math.round(along * 20) / 20 };
	}

	private pickDecorSpot(
		width: number,
		bottom: number,
		top: number,
		options: WallItemOptions,
	): { edgeIndex: number; along: number } | null {
		const candidates: { edgeIndex: number; from: number; to: number }[] = [];
		this.room.edges.forEach((edge, edgeIndex) => {
			if (
				edge.kind !== "line" ||
				(options.edges && !options.edges.includes(edgeIndex))
			) {
				return;
			}
			if (options.exteriorOnly && !this.room.exteriorEdges[edgeIndex]) {
				return;
			}
			for (const [from, to] of this.freeWallIntervals(edgeIndex, bottom, top)) {
				if (to - from >= width + 0.1) {
					candidates.push({ edgeIndex, from: from + 0.05, to: to - 0.05 });
				}
			}
		});
		if (candidates.length === 0) {
			return null;
		}
		const chosen = this.rng.pick(candidates);
		const along = this.rng.range(
			chosen.from + width / 2,
			chosen.to - width / 2,
		);
		return { edgeIndex: chosen.edgeIndex, along };
	}

	private freeWallIntervals(
		edgeIndex: number,
		bottom: number,
		top: number,
	): [number, number][] {
		const edge = this.room.edges[edgeIndex];
		const length = edgeLength(edge);
		let intervals: [number, number][] = [[0.03, length - 0.03]];
		const blocks: [number, number][] = [];
		for (const slot of this.room.edgeOpenings[edgeIndex]) {
			blocks.push([slot.from - 0.3, slot.to + 0.3]);
		}
		for (const use of this.wallUses[edgeIndex]) {
			if (use.bottom < top + 0.05 && use.top > bottom - 0.05) {
				blocks.push([use.from - 0.08, use.to + 0.08]);
			}
		}
		for (const [blockFrom, blockTo] of blocks) {
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

	private cornerPoints(): { point: Vec2; rotation: number }[] {
		const corners: { point: Vec2; rotation: number }[] = [];
		const edges = this.room.edges;
		for (let index = 0; index < edges.length; index += 1) {
			const previous = edges[(index - 1 + edges.length) % edges.length];
			const current = edges[index];
			if (previous.kind !== "line" || current.kind !== "line") {
				continue;
			}
			const incoming = edgeDirection(previous);
			const outgoing = edgeDirection(current);
			const turn = incoming.x * outgoing.z - incoming.z * outgoing.x;
			if (turn <= 0.1) {
				continue;
			}
			const bisector = {
				x: outgoing.x - incoming.x,
				z: outgoing.z - incoming.z,
			};
			const length = Math.hypot(bisector.x, bisector.z);
			const direction = { x: bisector.x / length, z: bisector.z / length };
			corners.push({
				point: current.a,
				rotation: Math.atan2(-direction.x, direction.z),
			});
		}
		return corners;
	}

	private computeWallSegments(): Segment[] {
		const segments: Segment[] = [];
		const polygon = this.room.polygon;
		const openingsByEdgePoint = this.groundOpenings.map((opening) =>
			this.openingSide(opening),
		);
		for (let index = 0; index < polygon.length; index += 1) {
			const a = polygon[index];
			const b = polygon[(index + 1) % polygon.length];
			let pieces: Segment[] = [{ a, b }];
			for (const side of openingsByEdgePoint) {
				pieces = pieces.flatMap((piece) =>
					subtractCollinear(piece, side.start, side.end),
				);
			}
			segments.push(...pieces);
		}
		return segments;
	}

	private reserveOpeningClearance(opening: Opening): void {
		const side = this.openingSide(opening);
		const direction = {
			x: (side.end.x - side.start.x) / opening.width,
			z: (side.end.z - side.start.z) / opening.width,
		};
		const middle = {
			x: (side.start.x + side.end.x) / 2,
			z: (side.start.z + side.end.z) / 2,
		};
		const depth = Math.max(1.35, opening.width + 0.2);
		this.keepClear.push({
			cx: middle.x + side.inward.x * (depth / 2),
			cz: middle.z + side.inward.z * (depth / 2),
			hx: opening.width / 2 + 0.4,
			hz: depth / 2,
			rotation: Math.atan2(direction.z, direction.x),
			yMin: 0,
			yMax: 3,
		});
		this.anchors.push({
			x: middle.x + side.inward.x * OPENING_ANCHOR_DEPTH,
			z: middle.z + side.inward.z * OPENING_ANCHOR_DEPTH,
		});
	}

	private createGrid(): RoomFurnisher["grid"] {
		const { bounds } = this.room;
		const originX = Math.floor(bounds.minX * 2) / 2 - GRID_STEP;
		const originZ = Math.floor(bounds.minZ * 2) / 2 - GRID_STEP;
		const columns = Math.max(
			1,
			Math.ceil((bounds.maxX - originX) / GRID_STEP) + 1,
		);
		const rows = Math.max(
			1,
			Math.ceil((bounds.maxZ - originZ) / GRID_STEP) + 1,
		);
		const base = new Uint8Array(columns * rows);
		for (let row = 0; row < rows; row += 1) {
			for (let column = 0; column < columns; column += 1) {
				const point = {
					x: originX + (column + 0.5) * GRID_STEP,
					z: originZ + (row + 0.5) * GRID_STEP,
				};
				if (
					pointInPolygon(point, this.room.polygon) &&
					this.distanceToWalls(point) >= AGENT_CLEARANCE
				) {
					base[row * columns + column] = 1;
				}
			}
		}
		return {
			originX,
			originZ,
			columns,
			rows,
			base,
			blocked: new Uint16Array(columns * rows),
		};
	}

	private markFootprint(footprint: Footprint, delta: 1 | -1): void {
		if (!footprint.blocksWalking) {
			return;
		}
		const { grid } = this;
		const box = footprint.box;
		const reach = Math.hypot(box.hx, box.hz) + AGENT_CLEARANCE;
		const minColumn = Math.max(
			0,
			Math.floor((box.cx - reach - grid.originX) / GRID_STEP),
		);
		const maxColumn = Math.min(
			grid.columns - 1,
			Math.ceil((box.cx + reach - grid.originX) / GRID_STEP),
		);
		const minRow = Math.max(
			0,
			Math.floor((box.cz - reach - grid.originZ) / GRID_STEP),
		);
		const maxRow = Math.min(
			grid.rows - 1,
			Math.ceil((box.cz + reach - grid.originZ) / GRID_STEP),
		);
		for (let row = minRow; row <= maxRow; row += 1) {
			for (let column = minColumn; column <= maxColumn; column += 1) {
				const point = {
					x: grid.originX + (column + 0.5) * GRID_STEP,
					z: grid.originZ + (row + 0.5) * GRID_STEP,
				};
				if (pointInBox(point, box, AGENT_CLEARANCE)) {
					const index = row * grid.columns + column;
					grid.blocked[index] = (grid.blocked[index] ?? 0) + delta;
				}
			}
		}
	}

	private cellIndex(point: Vec2): number | null {
		const column = Math.floor((point.x - this.grid.originX) / GRID_STEP);
		const row = Math.floor((point.z - this.grid.originZ) / GRID_STEP);
		if (
			column < 0 ||
			row < 0 ||
			column >= this.grid.columns ||
			row >= this.grid.rows
		) {
			return null;
		}
		return row * this.grid.columns + column;
	}

	private isFreeCell(index: number): boolean {
		return this.grid.base[index] === 1 && this.grid.blocked[index] === 0;
	}

	private nearestFreeCell(point: Vec2): number | null {
		const center = this.cellIndex(point);
		if (center !== null && this.isFreeCell(center)) {
			return center;
		}
		const column = Math.floor((point.x - this.grid.originX) / GRID_STEP);
		const row = Math.floor((point.z - this.grid.originZ) / GRID_STEP);
		for (let radius = 1; radius <= 2; radius += 1) {
			for (let dr = -radius; dr <= radius; dr += 1) {
				for (let dc = -radius; dc <= radius; dc += 1) {
					const r = row + dr;
					const c = column + dc;
					if (r < 0 || c < 0 || r >= this.grid.rows || c >= this.grid.columns) {
						continue;
					}
					const index = r * this.grid.columns + c;
					if (this.isFreeCell(index)) {
						return index;
					}
				}
			}
		}
		return null;
	}

	isNavigable(): boolean {
		if (this.anchors.length === 0) {
			return true;
		}
		const targets: number[] = [];
		for (const anchor of this.anchors) {
			const cell = this.nearestFreeCell(anchor);
			if (cell === null) {
				return false;
			}
			targets.push(cell);
		}
		const visited = new Uint8Array(this.grid.base.length);
		const queue = [targets[0]];
		visited[targets[0]] = 1;
		let reached = 0;
		while (queue.length > 0) {
			const index = queue.pop() as number;
			reached += 1;
			const column = index % this.grid.columns;
			const row = (index - column) / this.grid.columns;
			const neighbors = [
				column > 0 ? index - 1 : -1,
				column < this.grid.columns - 1 ? index + 1 : -1,
				row > 0 ? index - this.grid.columns : -1,
				row < this.grid.rows - 1 ? index + this.grid.columns : -1,
			];
			for (const neighbor of neighbors) {
				if (neighbor >= 0 && !visited[neighbor] && this.isFreeCell(neighbor)) {
					visited[neighbor] = 1;
					queue.push(neighbor);
				}
			}
		}
		if (!targets.every((target) => visited[target] === 1)) {
			return false;
		}
		let freeTotal = 0;
		for (let index = 0; index < this.grid.base.length; index += 1) {
			if (this.grid.base[index] === 1) {
				freeTotal += 1;
			}
		}
		return reached >= freeTotal * this.minReachShare;
	}
}

function subtractCollinear(
	segment: Segment,
	cutStart: Vec2,
	cutEnd: Vec2,
): Segment[] {
	const direction = {
		x: segment.b.x - segment.a.x,
		z: segment.b.z - segment.a.z,
	};
	const length = Math.hypot(direction.x, direction.z);
	if (length < 1e-6) {
		return [];
	}
	const unit = { x: direction.x / length, z: direction.z / length };
	const offsetStart =
		(cutStart.x - segment.a.x) * -unit.z + (cutStart.z - segment.a.z) * unit.x;
	const offsetEnd =
		(cutEnd.x - segment.a.x) * -unit.z + (cutEnd.z - segment.a.z) * unit.x;
	if (Math.abs(offsetStart) > 0.02 || Math.abs(offsetEnd) > 0.02) {
		return [segment];
	}
	const t0 =
		(cutStart.x - segment.a.x) * unit.x + (cutStart.z - segment.a.z) * unit.z;
	const t1 =
		(cutEnd.x - segment.a.x) * unit.x + (cutEnd.z - segment.a.z) * unit.z;
	const from = Math.min(t0, t1);
	const to = Math.max(t0, t1);
	if (to <= 0 || from >= length) {
		return [segment];
	}
	const pieces: Segment[] = [];
	if (from > 0.001) {
		pieces.push({
			a: segment.a,
			b: { x: segment.a.x + unit.x * from, z: segment.a.z + unit.z * from },
		});
	}
	if (to < length - 0.001) {
		pieces.push({
			a: { x: segment.a.x + unit.x * to, z: segment.a.z + unit.z * to },
			b: segment.b,
		});
	}
	return pieces;
}

function spotsAround(center: Vec2): Vec2[] {
	const spots: Vec2[] = [];
	for (const radius of [1, 2, 3]) {
		for (let index = 0; index < 8; index += 1) {
			const angle = (index / 8) * Math.PI * 2;
			spots.push({
				x: center.x + Math.cos(angle) * radius,
				z: center.z + Math.sin(angle) * radius,
			});
		}
	}
	return spots;
}

function boxInsideBox(inner: OrientedBox, outer: FurnitureItem): boolean {
	const outerBox: OrientedBox = {
		cx: outer.x,
		cz: outer.z,
		hx: outer.width / 2,
		hz: outer.depth / 2,
		rotation: outer.rotation,
		yMin: 0,
		yMax: 0,
	};
	const corners = [
		{ x: -inner.hx, z: -inner.hz },
		{ x: inner.hx, z: -inner.hz },
		{ x: inner.hx, z: inner.hz },
		{ x: -inner.hx, z: inner.hz },
	].map((corner) => {
		const world = rotate2(corner, inner.rotation);
		return { x: world.x + inner.cx, z: world.z + inner.cz };
	});
	return corners.every((corner) => pointInBox(corner, outerBox, -0.02));
}

export function windowSill(variant: number): number {
	return [0.85, 0.75, 1.2, 1.55, 0.7][variant] ?? 0.9;
}

function round(value: number): number {
	return Math.round(value * 1000) / 1000;
}
