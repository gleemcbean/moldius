import { rotate2, type Vec2 } from "../../../math.js";
import type { RoomFurnisher } from "../../furnish/RoomFurnisher.js";
import { boxesOverlap2D } from "../../polygon.js";
import type { FurnitureItem } from "../../types.js";
import { SIDE_TABLE_DECOR } from "./decorSets.js";

export function rugUnder(
	furnisher: RoomFurnisher,
	target: FurnitureItem,
	extra = 1.1,
): void {
	const variants = [0, 1, 2];

	for (const variant of variants) {
		const width = [3.0, 2.4, 2.2][variant];
		const depth = [2.0, 1.6, 2.2][variant];

		if (
			width < target.width + extra * 0.6 ||
			depth < target.depth + extra * 0.6
		) {
			continue;
		}

		if (
			placeRug(
				furnisher,
				{ x: target.x, z: target.z },
				target.rotation,
				variant,
			)
		) {
			return;
		}
	}
}

export function placeRug(
	furnisher: RoomFurnisher,
	at: Vec2 | null,
	rotation: number | null,
	variant: number,
): boolean {
	const options = {
		variant,
		...(at ? { at } : {}),
		...(rotation !== null ? { rotation } : {}),
		wallMargin: 1.2,
	};

	const rug = furnisher.floorItem("rug", options);

	if (!rug) {
		return false;
	}

	const others = furnisher.items.filter(
		(item) => item.kind === "rug" && item.id !== rug.id,
	);

	const rugBox = boxOf(rug);

	if (others.some((other) => boxesOverlap2D(boxOf(other), rugBox, 0.05))) {
		furnisher.removeItem(rug);

		return false;
	}

	return true;
}

export function boxOf(item: FurnitureItem) {
	return {
		cx: item.x,
		cz: item.z,
		hx: item.width / 2,
		hz: item.depth / 2,
		rotation: item.rotation,
	};
}

export function randomRugs(
	furnisher: RoomFurnisher,
	min: number,
	max: number,
): void {
	const count = furnisher.rng.int(min, max);

	for (let index = 0; index < count; index += 1) {
		placeRug(furnisher, null, null, furnisher.rng.int(0, 3));
	}
}

export function tableSet(
	furnisher: RoomFurnisher,
	options: {
		variants: number[];
		chairs: [number, number];
		decor: readonly (readonly [string, number])[];
		at?: Vec2;
		rotation?: number;
		rug?: boolean;
	},
): FurnitureItem | null {
	const table = furnisher.floorItem("table", {
		variant: furnisher.rng.pick(options.variants),
		wallMargin: 1.15,
		...(options.at ? { at: options.at } : {}),
		...(options.rotation !== undefined ? { rotation: options.rotation } : {}),
	});

	if (!table) {
		return null;
	}

	placeChairs(
		furnisher,
		table,
		furnisher.rng.int(options.chairs[0], options.chairs[1]),
	);

	if (options.rug) {
		rugUnder(furnisher, table);
	}

	furnisher.decorateSurface(
		table,
		options.decor,
		1,
		Math.max(1, Math.round(table.width * 1.5)),
	);

	return table;
}

export function placeChairs(
	furnisher: RoomFurnisher,
	table: FurnitureItem,
	wanted: number,
): void {
	const spots = chairSpots(table);
	const variant = furnisher.rng.int(0, 2);
	let placed = 0;

	for (const spot of furnisher.rng.shuffle(spots)) {
		if (placed >= wanted) {
			break;
		}

		const world = rotate2(spot.local, table.rotation);

		const chair = furnisher.floorItem("chair", {
			variant,
			at: { x: table.x + world.x, z: table.z + world.z },
			rotation:
				table.rotation + spot.rotation + (furnisher.rng.next() - 0.5) * 0.25,
		});

		if (chair) {
			placed += 1;
		}
	}
}

export function chairSpots(
	table: FurnitureItem,
): { local: Vec2; rotation: number }[] {
	if (table.width === table.depth) {
		const radius = table.width / 2 + 0.34;

		return [0, 1, 2, 3].map((index) => {
			const angle = (index * Math.PI) / 2;

			return {
				local: { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius },
				rotation: angle + Math.PI,
			};
		});
	}

	const spots: { local: Vec2; rotation: number }[] = [];
	const perSide = Math.max(1, Math.floor(table.width / 0.72));
	const spacing = table.width / perSide;

	for (let index = 0; index < perSide; index += 1) {
		const x = -table.width / 2 + spacing * (index + 0.5);

		spots.push({ local: { x, z: table.depth / 2 + 0.32 }, rotation: Math.PI });
		spots.push({ local: { x, z: -table.depth / 2 - 0.32 }, rotation: 0 });
	}

	if (table.width > 2.4) {
		spots.push({
			local: { x: table.width / 2 + 0.34, z: 0 },
			rotation: -Math.PI / 2,
		});

		spots.push({
			local: { x: -table.width / 2 - 0.34, z: 0 },
			rotation: Math.PI / 2,
		});
	}

	return spots;
}

export function estradeWith(
	furnisher: RoomFurnisher,
	kind: string,
	variant?: number,
	estradeVariant?: number,
): FurnitureItem | null {
	const estrade = furnisher.wallItem(
		"estrade",
		estradeVariant !== undefined ? { variant: estradeVariant } : {},
	);

	if (!estrade) {
		return null;
	}

	const local = rotate2({ x: 0, z: -0.15 }, estrade.rotation);

	const item = furnisher.floorItem(kind, {
		...(variant !== undefined ? { variant } : {}),
		at: { x: estrade.x + local.x, z: estrade.z + local.z },
		rotation: estrade.rotation,
		platform: estrade,
	});

	if (!item) {
		furnisher.removeItem(estrade);

		return null;
	}

	return item;
}

export function sideBySideCandles(
	furnisher: RoomFurnisher,
	item: FurnitureItem | null,
	min = 1,
	max = 2,
): void {
	if (item) {
		furnisher.decorateSurface(
			item,
			[
				["candle", 3],
				["books", 1],
				["vase", 1],
				["jar", 1],
			],
			min,
			max,
		);
	}
}

export function chandeliers(furnisher: RoomFurnisher, max: number): void {
	const room = furnisher.room;

	if (room.height < 3.2) {
		return;
	}

	const along = rotate2({ x: 1, z: 0 }, room.axisAngle);
	const extentX = room.bounds.maxX - room.bounds.minX;
	const extentZ = room.bounds.maxZ - room.bounds.minZ;

	const longAxis =
		Math.abs(along.x) > 0.5 === extentX > extentZ
			? along
			: { x: -along.z, z: along.x };

	const spread = Math.max(extentX, extentZ) / 4;

	if (max >= 2 && Math.max(extentX, extentZ) > 8) {
		for (const sign of [-1, 1]) {
			furnisher.ceilingItem("chandelier", {
				x: room.labelPoint.x + longAxis.x * spread * sign,
				z: room.labelPoint.z + longAxis.z * spread * sign,
			});
		}

		return;
	}

	furnisher.ceilingItem("chandelier", room.labelPoint);
}

export function windowsFor(
	furnisher: RoomFurnisher,
	variants: number[],
	spacing = 2.8,
): void {
	furnisher.windows(variants, spacing);
}

export function midpoint(side: { start: Vec2; end: Vec2 }): Vec2 {
	return {
		x: (side.start.x + side.end.x) / 2,
		z: (side.start.z + side.end.z) / 2,
	};
}

export function distanceSquared(a: Vec2, b: Vec2): number {
	return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}

export function moonlight(furnisher: RoomFurnisher, intensity: number): void {
	const room = furnisher.room;

	furnisher.lights.push({
		id: -1,
		furnitureId: null,
		roomId: room.id,
		level: room.level,
		position: {
			x: room.labelPoint.x,
			y: room.ceilingY - 0.4,
			z: room.labelPoint.z,
		},
		color: 0x7fa6ff,
		intensity,
		radius: 10,
		kind: "moon",
	});
}

export function ghostFurniture(
	furnisher: RoomFurnisher,
	min: number,
	max: number,
): void {
	furnisher.floorItemsBetween("sheetedFurniture", min, max, {
		wallMargin: 0.5,
	});
}

export function ceilingBetween(
	furnisher: RoomFurnisher,
	kind: string,
	min: number,
	max: number,
): void {
	for (let index = furnisher.rng.int(min, max); index > 0; index -= 1) {
		const point = furnisher.randomInteriorPoint(0.9);

		if (point) {
			furnisher.ceilingItem(kind, point);
		}
	}
}

export function sideTables(
	furnisher: RoomFurnisher,
	min: number,
	max: number,
): void {
	for (const table of furnisher.floorItemsBetween("sideTable", min, max, {
		wallMargin: 0.5,
	})) {
		furnisher.decorateSurface(table, SIDE_TABLE_DECOR, 1, 1);
	}
}
