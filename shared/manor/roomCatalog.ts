import { LEVEL_HEIGHT, SLAB_THICKNESS } from "../config/index.js";
import type { SeededRandom } from "../random.js";
import { ROOM_BLUEPRINTS, ROOM_TYPE_IDS } from "./rooms/index.js";
import {
	type CornerTreatment,
	corridorPathVertices,
	lShapeVertices,
	outlineFromVertices,
	rectangleVertices,
	SQUARE,
} from "./shapes.js";
import type {
	CeilingStyle,
	FloorStyle,
	Level,
	OutlineEdge,
	RoomStyle,
	RoomType,
	WallStyle,
} from "./types.js";

export type ShapeFamily =
	| "rect"
	| "lshape"
	| "octagon"
	| "heptagon"
	| "apse"
	| "corridor"
	| "corridorL"
	| "corridorBend"
	| "corridor45";

export interface CeilingVariant {
	chance: number;
	height: readonly [number, number];
}

export interface RoomTypeDefinition {
	type: RoomType;
	names: readonly string[];
	width: readonly [number, number];
	depth: readonly [number, number];
	heightGround: readonly [number, number];
	heightUpper: readonly [number, number];
	tall?: CeilingVariant;
	low?: CeilingVariant;
	shapes: readonly (readonly [ShapeFamily, number])[];
	floors: readonly FloorStyle[];
	walls: readonly WallStyle[];
	ceilings: readonly CeilingStyle[];
	wainscotChance: number;
	singleDoor: boolean;
	allowUpper: boolean;
	allowGround: boolean;
	optional: boolean;
}

export const ROOM_TYPES = Object.fromEntries(
	ROOM_TYPE_IDS.map((type) => [
		type,
		{ type, ...ROOM_BLUEPRINTS[type].catalog },
	]),
) as Record<RoomType, RoomTypeDefinition>;

export const OPTIONAL_ROOM_TYPES: RoomType[] = ROOM_TYPE_IDS.filter(
	(type) => ROOM_TYPES[type].optional,
);

export const MAX_CEILING = LEVEL_HEIGHT - SLAB_THICKNESS;

export interface RoomShape {
	edges: OutlineEdge[];
	family: ShapeFamily;
}

function snap(value: number, step = 0.25): number {
	return Math.round(value / step) * step;
}

function randomCorner(
	rng: SeededRandom,
	maxSize: number,
	weights = [0.5, 0.28, 0.22],
): CornerTreatment {
	if (maxSize < 0.75) {
		return SQUARE;
	}

	const kind = rng.weighted([
		["square", weights[0]],
		["chamfer", weights[1]],
		["round", weights[2]],
	] as const);

	if (kind === "square") {
		return SQUARE;
	}

	const size = snap(rng.range(0.75, Math.min(maxSize, 2.25)));

	return { kind, size: Math.max(0.75, size) };
}

export function createRoomShape(
	definition: RoomTypeDefinition,
	rng: SeededRandom,
	sizeFactor: number,
): RoomShape {
	const family = rng.weighted(definition.shapes);

	const width = snap(
		rng.range(definition.width[0], definition.width[1]) * sizeFactor,
	);

	const depth = snap(
		rng.range(definition.depth[0], definition.depth[1]) * sizeFactor,
	);

	const minSide = Math.min(width, depth);

	switch (family) {
		case "rect": {
			const maxCorner = minSide / 2 - 1.1;

			const corners = [0, 1, 2, 3].map(() =>
				randomCorner(rng, maxCorner, [0.62, 0.2, 0.18]),
			);

			return {
				family,
				edges: outlineFromVertices(rectangleVertices(width, depth), corners),
			};
		}

		case "octagon": {
			const size = snap(Math.max(1.25, Math.min(minSide * 0.28, 2.5)));
			const chamfer: CornerTreatment = { kind: "chamfer", size };

			return {
				family,
				edges: outlineFromVertices(rectangleVertices(width, depth), [
					chamfer,
					chamfer,
					chamfer,
					chamfer,
				]),
			};
		}

		case "heptagon": {
			const size = snap(Math.max(1.25, Math.min(minSide * 0.26, 2.25)));
			const chamfer: CornerTreatment = { kind: "chamfer", size };
			const squareIndex = rng.int(0, 3);

			const corners = [0, 1, 2, 3].map((index) =>
				index === squareIndex ? SQUARE : chamfer,
			);

			return {
				family,
				edges: outlineFromVertices(rectangleVertices(width, depth), corners),
			};
		}

		case "lshape": {
			const notchWidth = snap(width * rng.range(0.32, 0.45));
			const notchDepth = snap(depth * rng.range(0.32, 0.45));
			const vertices = lShapeVertices(width, depth, notchWidth, notchDepth);

			const maxConvex =
				Math.min(width - notchWidth, depth - notchDepth) / 2 - 0.9;

			const inner: CornerTreatment = rng.chance(0.35)
				? { kind: "round", size: snap(rng.range(0.75, 1.25)) }
				: SQUARE;

			const corners = [
				randomCorner(rng, maxConvex),
				randomCorner(rng, maxConvex),
				randomCorner(rng, Math.min(notchDepth, maxConvex)),
				inner,
				randomCorner(rng, Math.min(notchWidth, maxConvex)),
				randomCorner(rng, maxConvex),
			];

			return { family, edges: outlineFromVertices(vertices, corners) };
		}

		case "apse": {
			const apseRadius = width / 2;
			const round: CornerTreatment = { kind: "round", size: apseRadius };

			const entryCorners = [0, 1].map(() =>
				randomCorner(rng, Math.min(1.25, width / 2 - 1.2), [0.7, 0.3, 0]),
			);

			return {
				family,
				edges: outlineFromVertices(
					rectangleVertices(width, Math.max(depth, width * 1.1)),
					[entryCorners[0], entryCorners[1], round, round],
				),
			};
		}

		case "corridor": {
			return {
				family,
				edges: outlineFromVertices(rectangleVertices(width, depth), [
					SQUARE,
					SQUARE,
					SQUARE,
					SQUARE,
				]),
			};
		}

		case "corridorL": {
			const armA = snap(Math.max(depth * 0.6, width + 2.5));
			const armB = snap(Math.max(depth * 0.55, width + 2.5));
			const vertices = lShapeVertices(armA, armB, armA - width, armB - width);

			return {
				family,
				edges: outlineFromVertices(vertices, [
					SQUARE,
					SQUARE,
					SQUARE,
					SQUARE,
					SQUARE,
					SQUARE,
				]),
			};
		}

		case "corridorBend": {
			const innerRadius = snap(rng.range(0.75, 1.5));
			const outerRadius = innerRadius + width;
			const armA = snap(Math.max(depth * 0.55, outerRadius + 2));
			const armB = snap(Math.max(depth * 0.5, outerRadius + 2));
			const vertices = lShapeVertices(armA, armB, armA - width, armB - width);

			return {
				family,
				edges: outlineFromVertices(vertices, [
					{ kind: "round", size: outerRadius },
					SQUARE,
					SQUARE,
					{ kind: "round", size: innerRadius },
					SQUARE,
					SQUARE,
				]),
			};
		}

		case "corridor45": {
			const first = snap(rng.range(3, Math.max(3.5, depth * 0.55)));
			const second = snap(rng.range(3, Math.max(3.5, depth * 0.55)));
			const turn = rng.chance(0.5) ? 1 : -1;
			const diagonal = Math.SQRT1_2 * second;

			const path = [
				{ x: 0, z: 0 },
				{ x: first, z: 0 },
				{ x: first + diagonal, z: diagonal * turn },
			];

			const polygon = corridorPathVertices(path, width);

			return {
				family,
				edges: outlineFromVertices(
					polygon,
					polygon.map(() => SQUARE),
				),
			};
		}
	}
}

export function createGrandRoomShape(
	rng: SeededRandom,
	width: number,
	depth: number,
	plain: boolean,
): RoomShape {
	const family = plain
		? "rect"
		: rng.weighted([
				["rect", 3],
				["octagon", 2],
				["heptagon", 2],
				["apse", 2],
				["lshape", 1.5],
			] as const);

	switch (family) {
		case "rect": {
			const corners = [0, 1, 2, 3].map(() =>
				plain ? SQUARE : randomCorner(rng, 3, [0.3, 0.35, 0.35]),
			);

			return {
				family,
				edges: outlineFromVertices(rectangleVertices(width, depth), corners),
			};
		}

		case "octagon":
		case "heptagon": {
			const chamfer: CornerTreatment = {
				kind: "chamfer",
				size: snap(rng.range(2, 3)),
			};

			const squareIndex = family === "heptagon" ? rng.int(0, 3) : -1;

			return {
				family,
				edges: outlineFromVertices(
					rectangleVertices(width, depth),
					[0, 1, 2, 3].map((index) =>
						index === squareIndex ? SQUARE : chamfer,
					),
				),
			};
		}

		case "apse": {
			const narrow = snap(Math.min(width, depth + 1));
			const long = snap(Math.max(depth + 4, narrow * 1.25));
			const round: CornerTreatment = { kind: "round", size: narrow / 2 };

			return {
				family,
				edges: outlineFromVertices(rectangleVertices(narrow, long), [
					randomCorner(rng, 1.25, [0.6, 0.4, 0]),
					randomCorner(rng, 1.25, [0.6, 0.4, 0]),
					round,
					round,
				]),
			};
		}

		case "lshape": {
			const wide = snap(width * 1.15);
			const deep = snap(depth * 1.15);
			const notchWidth = snap(wide * rng.range(0.25, 0.33));
			const notchDepth = snap(deep * rng.range(0.25, 0.33));

			const inner: CornerTreatment = rng.chance(0.5)
				? { kind: "round", size: snap(rng.range(1, 2)) }
				: SQUARE;

			return {
				family,
				edges: outlineFromVertices(
					lShapeVertices(wide, deep, notchWidth, notchDepth),
					[
						randomCorner(rng, 2.5, [0.4, 0.3, 0.3]),
						randomCorner(rng, 2.5, [0.4, 0.3, 0.3]),
						SQUARE,
						inner,
						SQUARE,
						randomCorner(rng, 2.5, [0.4, 0.3, 0.3]),
					],
				),
			};
		}
	}
}

export function pickRoomStyle(
	definition: RoomTypeDefinition,
	rng: SeededRandom,
): RoomStyle {
	const wall = rng.pick(definition.walls);

	const paneled =
		wall !== "stoneBlocks" &&
		wall !== "brick" &&
		wall !== "tiles" &&
		wall !== "greenhouseBrick" &&
		wall !== "basalt";

	return {
		floor: rng.pick(definition.floors),
		wall,
		wainscot:
			paneled && wall !== "woodPanels" && rng.chance(definition.wainscotChance),
		ceiling: rng.pick(definition.ceilings),
	};
}

export function pickRoomHeight(
	definition: RoomTypeDefinition,
	level: Level,
	rng: SeededRandom,
): number {
	if (definition.type === "stairwell") {
		return definition.heightGround[0];
	}

	const roll = rng.next();

	const variant =
		definition.tall && roll < definition.tall.chance
			? definition.tall.height
			: definition.low && roll > 1 - definition.low.chance
				? definition.low.height
				: level === 0
					? definition.heightGround
					: definition.heightUpper;

	return Math.round(rng.range(variant[0], variant[1]) * 20) / 20;
}

export function spansLevelAbove(type: RoomType, height: number): boolean {
	return type === "stairwell" || height > MAX_CEILING;
}
