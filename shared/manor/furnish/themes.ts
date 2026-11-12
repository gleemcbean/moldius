import { DAIS_STEP_RISE, DAIS_STEP_RUN } from "../../config/index.js";
import { distance2, normalize2, rotate2, type Vec2 } from "../../math.js";
import { furnitureDefinition } from "../furnitureCatalog.js";
import {
	boxesOverlap2D,
	edgeDirection,
	edgeLength,
	pointInPolygon,
} from "../polygon.js";
import type { FurnitureItem, MezzanineSpec, RoomType } from "../types.js";
import type { RoomFurnisher } from "./RoomFurnisher.js";

type Recipe = (furnisher: RoomFurnisher) => void;

const TABLE_DECOR = [
	["candle", 4],
	["books", 2],
	["openBook", 1],
	["vase", 1],
	["leatherTomes", 1],
	["oilLamp", 1],
	["hourglass", 1],
] as const;

const DINING_DECOR = [
	["candle", 4],
	["plateSet", 5],
	["vase", 1],
	["teaSet", 1],
] as const;

const ALCHEMY_DECOR = [
	["potions", 4],
	["bellJar", 1],
	["alembic", 2],
	["jar", 2],
	["candle", 2],
	["skull", 1],
	["openBook", 1],
	["mortar", 2],
	["crystalBall", 1],
	["scrolls", 1],
] as const;

const STUDY_DECOR = [
	["inkwell", 2],
	["books", 3],
	["openBook", 2],
	["candle", 3],
	["scrolls", 1],
	["hourglass", 1],
	["mantelClock", 1],
] as const;

const KITCHEN_DECOR = [
	["jar", 3],
	["plateSet", 2],
	["candle", 1],
] as const;

const CURIO_DECOR = [
	["bellJar", 4],
	["skull", 2],
	["jar", 2],
	["candle", 2],
	["stuffedRaven", 2],
	["crystalBall", 1],
	["hourglass", 1],
] as const;

const OBSERVATORY_DECOR = [
	["openBook", 3],
	["inkwell", 2],
	["candle", 2],
	["bellJar", 1],
] as const;

const NURSERY_DECOR = [
	["doll", 4],
	["candle", 2],
	["books", 1],
] as const;

const RITUAL_DECOR = [
	["candle", 4],
	["skull", 2],
	["openBook", 1],
	["potions", 1],
	["crystalBall", 1],
	["leatherTomes", 1],
] as const;

const SIDE_TABLE_DECOR = [
	["teaSet", 2],
	["oilLamp", 2],
	["mantelClock", 1],
	["vase", 1],
	["candle", 2],
] as const;

function rugUnder(
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

function placeRug(
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

function boxOf(item: FurnitureItem) {
	return {
		cx: item.x,
		cz: item.z,
		hx: item.width / 2,
		hz: item.depth / 2,
		rotation: item.rotation,
	};
}

function randomRugs(furnisher: RoomFurnisher, min: number, max: number): void {
	const count = furnisher.rng.int(min, max);
	for (let index = 0; index < count; index += 1) {
		placeRug(furnisher, null, null, furnisher.rng.int(0, 3));
	}
}

function tableSet(
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

function placeChairs(
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

function chairSpots(table: FurnitureItem): { local: Vec2; rotation: number }[] {
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

function estradeWith(
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

function bedSet(furnisher: RoomFurnisher): void {
	const bed = furnisher.wallItem("bed");
	if (!bed) {
		return;
	}
	for (const side of [-1, 1]) {
		if (!furnisher.rng.chance(0.75)) {
			continue;
		}
		const local = rotate2(
			{ x: side * (bed.width / 2 + 0.33), z: -bed.depth / 2 + 0.23 },
			bed.rotation,
		);
		const stand = furnisher.floorItem("nightstand", {
			at: { x: bed.x + local.x, z: bed.z + local.z },
			rotation: bed.rotation,
			variant: 0,
		});
		if (stand) {
			furnisher.decorateSurface(
				stand,
				[
					["candle", 3],
					["books", 1],
					["vase", 1],
				],
				1,
				1,
			);
		}
	}
	if (furnisher.rng.chance(0.5)) {
		const local = rotate2({ x: 0, z: bed.depth / 2 + 0.38 }, bed.rotation);
		furnisher.floorItem("chest", {
			at: { x: bed.x + local.x, z: bed.z + local.z },
			rotation: bed.rotation,
			ignoreKeepClear: true,
		});
	}
}

function sideBySideCandles(
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

function chandeliers(furnisher: RoomFurnisher, max: number): void {
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

function windowsFor(
	furnisher: RoomFurnisher,
	variants: number[],
	spacing = 2.8,
): void {
	furnisher.windows(variants, spacing);
}

function chapelLayout(furnisher: RoomFurnisher): void {
	const room = furnisher.room;
	const entry = furnisher.roomOpenings[0];
	const entryPoint = entry
		? midpoint(furnisher.openingSide(entry))
		: room.labelPoint;
	let farthest = room.polygon[0];
	for (const point of room.polygon) {
		if (
			distanceSquared(point, entryPoint) > distanceSquared(farthest, entryPoint)
		) {
			farthest = point;
		}
	}
	const towardAltar = normalize2({
		x: farthest.x - entryPoint.x,
		z: farthest.z - entryPoint.z,
	});
	const altarRotation = Math.atan2(towardAltar.x, -towardAltar.z);
	const pewRotation = Math.atan2(-towardAltar.x, towardAltar.z);
	let estrade: FurnitureItem | null = null;
	for (let back = 2.0; back < 5 && !estrade; back += 0.5) {
		estrade = furnisher.floorItem("estrade", {
			variant: 0,
			at: {
				x: farthest.x - towardAltar.x * back,
				z: farthest.z - towardAltar.z * back,
			},
			rotation: altarRotation,
			wallMargin: 0.2,
		});
	}
	if (estrade) {
		const altar = furnisher.floorItem("altar", {
			at: { x: estrade.x, z: estrade.z },
			rotation: estrade.rotation,
			platform: estrade,
		});
		if (altar) {
			furnisher.decorateSurface(
				altar,
				[
					["candle", 5],
					["openBook", 1],
					["skull", 1],
				],
				2,
				3,
			);
		}
		for (const side of [-1, 1]) {
			const local = rotate2({ x: side * 1.6, z: 0.4 }, altarRotation);
			furnisher.floorItem("candelabra", {
				at: { x: estrade.x + local.x, z: estrade.z + local.z },
			});
		}
	}
	const lateral = { x: -towardAltar.z, z: towardAltar.x };
	const start = estrade ? { x: estrade.x, z: estrade.z } : room.labelPoint;
	for (let row = 0; row < 7; row += 1) {
		const distance = 2.4 + row * 1.15;
		for (const side of [-1, 1]) {
			furnisher.floorItem("pew", {
				variant: 1,
				at: {
					x: start.x - towardAltar.x * distance + lateral.x * side * 1.75,
					z: start.z - towardAltar.z * distance + lateral.z * side * 1.75,
				},
				rotation: pewRotation,
				wallMargin: 0.2,
			});
		}
	}
}

function midpoint(side: { start: Vec2; end: Vec2 }): Vec2 {
	return {
		x: (side.start.x + side.end.x) / 2,
		z: (side.start.z + side.end.z) / 2,
	};
}

function distanceSquared(a: Vec2, b: Vec2): number {
	return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}

function ritualCircleLayout(furnisher: RoomFurnisher): void {
	const room = furnisher.room;
	const circle =
		furnisher.floorItem("ritualCircle", {
			at: room.labelPoint,
			rotation: 0,
			variant: 0,
		}) ??
		furnisher.floorItem("ritualCircle", {
			at: room.labelPoint,
			rotation: 0,
			variant: 1,
		});
	if (!circle) {
		return;
	}
	const radius = circle.width / 2 + 0.25;
	for (let index = 0; index < 5; index += 1) {
		const angle = (index / 5) * Math.PI * 2 + 0.3;
		furnisher.floorItem("floorCandles", {
			at: {
				x: circle.x + Math.cos(angle) * radius,
				z: circle.z + Math.sin(angle) * radius,
			},
			rotation: angle,
		});
	}
}

function moonlight(furnisher: RoomFurnisher, intensity: number): void {
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

function ghostFurniture(
	furnisher: RoomFurnisher,
	min: number,
	max: number,
): void {
	furnisher.floorItemsBetween("sheetedFurniture", min, max, {
		wallMargin: 0.5,
	});
}

function observatoryLayout(furnisher: RoomFurnisher): void {
	const room = furnisher.room;
	furnisher.floorItem("telescope", {
		at: room.labelPoint,
		rotation: room.axisAngle,
	}) ?? furnisher.floorItem("telescope", { wallMargin: 0.9 });
	furnisher.floorItemsBetween("orrery", 1, 1, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("globe", 0, 1, { wallMargin: 0.6 });
	tableSet(furnisher, {
		variants: [0, 2],
		chairs: [1, 2],
		decor: OBSERVATORY_DECOR,
	});
	furnisher.wallItemsBetween("bookcase", 1, 2);
	furnisher.wallItemsBetween("wardrobe", 0, 1);
	furnisher.floorItemsBetween("armchair", 0, 1, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("birdcage", 0, 1, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("starChart", 2, 4);
	furnisher.wallDecorBetween("sconce", 0, 1);
	randomRugs(furnisher, 0, 1);
	moonlight(furnisher, 1.1);
	furnisher.cobwebs(1, 2);
}

function curiositiesLayout(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1]);
	furnisher.wallItemsBetween("displayCase", 2, 4);
	furnisher.wallItemsBetween("armor", 1, 2);
	furnisher.wallItemsBetween("wardrobe", 0, 1);
	furnisher
		.wallItemsBetween("cabinet", 1, 1)
		.forEach(
			(cabinet) => void furnisher.decorateSurface(cabinet, CURIO_DECOR, 2, 3),
		);
	tableSet(furnisher, {
		variants: [2],
		chairs: [0, 1],
		decor: CURIO_DECOR,
		rug: true,
	});
	furnisher.floorItemsBetween("birdcage", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("globe", 0, 1, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("dressForm", 0, 1, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("trophyHead", 1, 3);
	furnisher.wallDecorBetween("specimenFrame", 2, 4);
	furnisher.wallDecorBetween("painting", 0, 1);
	furnisher.wallDecorBetween("sconce", 1, 2);
	chandeliers(furnisher, 1);
	furnisher.cobwebs(2, 3);
}

function nurseryLayout(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1]);
	const crib = furnisher.floorItem("crib", { wallMargin: 0.5 });
	const horse = furnisher.floorItem("rockingHorse", { wallMargin: 0.6 });
	if (!crib && !horse) {
		furnisher.floorItem("rockingHorse", {
			wallMargin: 0.15,
			ignoreKeepClear: true,
		});
	}
	furnisher.wallItemsBetween("wardrobe", 1, 1);
	furnisher.wallItemsBetween("trunk", 0, 1);
	furnisher
		.wallItemsBetween("dresser", 1, 1)
		.forEach(
			(dresser) => void furnisher.decorateSurface(dresser, NURSERY_DECOR, 2, 3),
		);
	furnisher
		.wallItemsBetween("chest", 1, 1)
		.forEach(
			(chest) => void furnisher.decorateSurface(chest, [["doll", 1]], 1, 2),
		);
	furnisher.wallItemsBetween("shelf", 0, 1);
	ghostFurniture(furnisher, 0, 1);
	furnisher.floorItemsBetween("floorBall", 1, 2, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("smallBox", 0, 2, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("floorLamp", 0, 1, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("painting", 0, 1);
	furnisher.wallDecorBetween("mirror", 0, 1);
	furnisher.wallDecorBetween("sconce", 0, 1);
	randomRugs(furnisher, 1, 1);
	furnisher.cobwebs(2, 3);
}

function laundryLayout(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [2, 3], 2.4);
	const lines = furnisher.floorItemsBetween("dryingLine", 1, 2, {
		wallMargin: 0.6,
	});
	const tubs = furnisher.floorItemsBetween("washtub", 1, 2, {
		wallMargin: 0.5,
	});
	if (lines.length + tubs.length === 0) {
		furnisher.floorItem("washtub", { wallMargin: 0.15, ignoreKeepClear: true });
	}
	furnisher.floorItemsBetween("laundryBasket", 1, 3, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("dressForm", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("spinningWheel", 0, 1, { wallMargin: 0.5 });
	furnisher.wallItemsBetween("sink", 1, 2);
	furnisher.wallItemsBetween("lockers", 0, 1);
	furnisher.wallItemsBetween("trunk", 0, 1);
	furnisher.wallItemsBetween("shelf", 1, 1);
	furnisher.wallItemsBetween("workbench", 0, 1).forEach(
		(bench) =>
			void furnisher.decorateSurface(
				bench,
				[
					["jar", 2],
					["candle", 1],
				],
				1,
				2,
			),
	);
	furnisher.floorItemsBetween("bucket", 1, 2, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("pipeRun", 1, 2);
	furnisher.wallDecorBetween("wallShelf", 0, 1);
	furnisher.wallDecorBetween("sconce", 0, 1);
	furnisher.cobwebs(2, 3);
	furnisher.hangingCobwebs(1);
}

function cryptLayout(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("sarcophagus", 2, 4, { wallMargin: 0.8 });
	furnisher.wallItemsBetween("boneShelf", 2, 3);
	furnisher.wallItemsBetween("confessional", 0, 1);
	furnisher.wallItemsBetween("standingCoffin", 1, 2);
	furnisher.floorItemsBetween("pillar", 0, 2, { wallMargin: 1.2 });
	furnisher.floorItemsBetween("candelabra", 1, 2, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("floorCandles", 1, 3, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("vialCluster", 0, 1, { wallMargin: 0.3 });
	const altar = estradeWith(furnisher, "altar");
	if (altar) {
		furnisher.decorateSurface(altar, RITUAL_DECOR, 1, 3);
	}
	furnisher.wallDecorBetween("tapestry", 0, 1);
	furnisher.wallDecorBetween("sconce", 1, 2);
	furnisher.cobwebs(3, 5);
	furnisher.hangingCobwebs(furnisher.rng.int(1, 3));
}

function dungeonLayout(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("cellBars", 1, 3);
	furnisher.wallItemsBetween("standingCoffin", 0, 1);
	furnisher.floorItemsBetween("pillar", 0, 1, { wallMargin: 1.4 });
	furnisher.floorItemsBetween("crate", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("bucket", 1, 2, { wallMargin: 0.3 });
	for (let index = furnisher.rng.int(2, 4); index > 0; index -= 1) {
		const point = furnisher.randomInteriorPoint(0.8);
		if (point) {
			furnisher.ceilingItem("hangingChains", point);
		}
	}
	furnisher.floorItemsBetween("bloodStain", 2, 4, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("wallLantern", 2, 4);
	furnisher.cobwebs(2, 4);
	furnisher.hangingCobwebs(1);
}

function pondLayout(furnisher: RoomFurnisher): void {
	const room = furnisher.room;
	furnisher.floorItem("pond", {
		at: room.labelPoint,
		rotation: room.axisAngle,
		wallMargin: 1.2,
	}) ??
		furnisher.floorItem("pond", { wallMargin: 1.2 }) ??
		furnisher.floorItem("pond", { variant: 1, wallMargin: 1.0 });
	furnisher.floorItemsBetween("bench", 1, 2, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("statue", 0, 1, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("planterBed", 0, 1, { wallMargin: 1.0 });
	furnisher.floorItemsBetween("pottedPlant", 1, 3, { wallMargin: 0.45 });
	furnisher.floorItemsBetween("flowerPot", 5, 9, { wallMargin: 0.35 });
	furnisher.floorItemsBetween("floorLamp", 1, 2, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("sconce", 0, 2);
	if (room.style.ceiling === "glass") {
		moonlight(furnisher, 0.8);
	}
	furnisher.cobwebs(0, 1);
}

function greenhouseLayout(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("planterBed", 2, 5, { wallMargin: 1.0 });
	furnisher.floorItemsBetween("pottedPlant", 3, 6, { wallMargin: 0.45 });
	furnisher.floorItemsBetween("flowerPot", 1, 3, { wallMargin: 0.35 });
	furnisher.wallItemsBetween("pottingTable", 0, 1);
	furnisher.floorItemsBetween("bench", 0, 2, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("crate", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("bucket", 1, 2, { wallMargin: 0.3 });
	moonlight(furnisher, 0.9);
}

function theaterLayout(furnisher: RoomFurnisher): void {
	const room = furnisher.room;
	const entry = furnisher.roomOpenings[0];
	const entryPoint = entry
		? midpoint(furnisher.openingSide(entry))
		: room.labelPoint;
	const edges = room.edges
		.map((edge, index) => ({ edge, index }))
		.filter(({ edge }) => edge.kind === "line")
		.sort(
			(first, second) =>
				distanceSquared(
					midpoint({ start: second.edge.a, end: second.edge.b }),
					entryPoint,
				) -
				distanceSquared(
					midpoint({ start: first.edge.a, end: first.edge.b }),
					entryPoint,
				),
		)
		.map(({ index }) => index);
	let curtain: FurnitureItem | null = null;
	for (const edge of edges.slice(0, 3)) {
		curtain =
			furnisher.wallItem("stageCurtain", { edges: [edge] }) ??
			furnisher.wallItem("stageCurtain", { edges: [edge], variant: 1 });
		if (curtain) {
			break;
		}
	}
	const front = curtain
		? rotate2({ x: 0, z: 1 }, curtain.rotation)
		: normalize2({
				x: entryPoint.x - room.labelPoint.x,
				z: entryPoint.z - room.labelPoint.z,
			});
	const anchor = curtain
		? { x: curtain.x, z: curtain.z }
		: {
				x: room.labelPoint.x - front.x * 3,
				z: room.labelPoint.z - front.z * 3,
			};
	const stageRotation = curtain?.rotation ?? Math.atan2(-front.x, front.z);
	let stage: FurnitureItem | null = null;
	for (let forward = 1.4; forward < 3 && !stage; forward += 0.4) {
		stage = furnisher.floorItem("estrade", {
			variant: 1,
			at: { x: anchor.x + front.x * forward, z: anchor.z + front.z * forward },
			rotation: stageRotation,
			wallMargin: 0.2,
		});
	}
	const lateral = { x: -front.z, z: front.x };
	if (stage) {
		for (const side of [-1, 1]) {
			furnisher.floorItem("floorLamp", {
				at: {
					x: stage.x + lateral.x * side * 1.9 + front.x * 1.4,
					z: stage.z + lateral.z * side * 1.9 + front.z * 1.4,
				},
				wallMargin: 0.2,
			});
		}
		if (furnisher.rng.chance(0.5)) {
			furnisher.floorItem(furnisher.rng.pick(["harp", "dressForm", "statue"]), {
				at: { x: stage.x + lateral.x * 0.6, z: stage.z + lateral.z * 0.6 },
				rotation: stageRotation,
				platform: stage,
			});
		}
	}
	const seatRotation = Math.atan2(front.x, -front.z);
	const start = stage ? { x: stage.x, z: stage.z } : anchor;
	for (let row = 0; row < 7; row += 1) {
		const distance = 2.8 + row * 1.2;
		for (const side of [-1, 1]) {
			furnisher.floorItem("theaterSeats", {
				variant: furnisher.rng.chance(0.6) ? 0 : 1,
				at: {
					x: start.x + front.x * distance + lateral.x * side * 1.6,
					z: start.z + front.z * distance + lateral.z * side * 1.6,
				},
				rotation: seatRotation,
				wallMargin: 0.2,
			});
		}
	}
	furnisher.wallItemsBetween("curtainAlcove", 0, 1);
	furnisher.floorItemsBetween("candelabra", 1, 3, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("sconce", 2, 4);
	furnisher.wallDecorBetween("painting", 0, 2);
	chandeliers(furnisher, 2);
	furnisher.cobwebs(2, 4);
}

function atticLayout(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [3], 2.2);
	furnisher.wallItemsBetween("trunk", 1, 3);
	furnisher.wallItemsBetween("chest", 0, 2);
	furnisher.wallItemsBetween("standingCoffin", 0, 1);
	furnisher.wallItemsBetween("wardrobe", 0, 1);
	ghostFurniture(furnisher, 2, 4);
	furnisher.floorItemsBetween("crate", 2, 4, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("dressForm", 0, 2, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("rockingHorse", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("spinningWheel", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("coatRack", 0, 1, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("birdcage", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("smallBox", 1, 3, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("bookPile", 0, 2, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("floorCandles", 1, 2, { wallMargin: 0.4 });
	moonlight(furnisher, 0.5);
	furnisher.cobwebs(3, 6);
	furnisher.hangingCobwebs(furnisher.rng.int(1, 3));
}

function undercroftLayout(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("barrelStack", 1, 3);
	furnisher.wallItemsBetween("wineRack", 1, 2);
	furnisher.wallItemsBetween("cask", 0, 2);
	furnisher.wallItemsBetween("standingCoffin", 0, 1);
	furnisher.floorItemsBetween("barrel", 1, 3, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("crate", 0, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("floorCandles", 1, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("bucket", 0, 1, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("sconce", 1, 2);
	furnisher.wallDecorBetween("pipeRun", 0, 1);
	furnisher.cobwebs(3, 5);
	furnisher.hangingCobwebs(furnisher.rng.int(1, 3));
}

const RECIPES: Record<RoomType, Recipe> = {
	hall: (f) => {
		windowsFor(f, [0, 1]);
		f.wallItemsBetween("fireplace", 0, 1);
		f.wallItemsBetween("wardrobe", 0, 1);
		f.wallItemsBetween("curtainAlcove", 0, 1);
		sideBySideCandles(f, f.wallItem("cabinet"), 1, 3);
		f.wallItemsBetween("grandfatherClock", 0, 1);
		f.wallItemsBetween("armor", 0, 2);
		f.floorItemsBetween("pillar", 0, 2, { wallMargin: 1.6 });
		f.floorItemsBetween("statue", 0, 1, { wallMargin: 1.0 });
		f.floorItemsBetween("coatRack", 0, 1, { wallMargin: 0.3 });
		f.wallDecorBetween("shieldDisplay", 0, 1);
		tableSet(f, {
			variants: [2],
			chairs: [0, 2],
			decor: TABLE_DECOR,
			rug: true,
		});
		f.floorItemsBetween("pottedPlant", 1, 3, { wallMargin: 0.45 });
		f.floorItemsBetween("bench", 0, 1, { wallMargin: 0.8 });
		f.floorItemsBetween("candelabra", 0, 2, { wallMargin: 0.6 });
		f.wallDecorBetween("painting", 2, 4);
		f.wallDecorBetween("sconce", 1, 3);
		f.wallDecorBetween("mirror", 0, 1);
		randomRugs(f, 0, 1);
		chandeliers(f, 2);
		f.cobwebs(1, 3);
	},
	salon: (f) => {
		windowsFor(f, [0, 1, 2]);
		f.wallItemsBetween("fireplace", 0, 1);
		f.wallItemsBetween("wardrobe", 0, 1);
		f.wallItemsBetween("curtainAlcove", 0, 1);
		f.wallItemsBetween("bookcase", 0, 1);
		sideBySideCandles(f, f.wallItem("cabinet"), 1, 2);
		f.wallItemsBetween("uprightPiano", 0, 1);
		f.floorItemsBetween("sofa", 1, 1, { wallMargin: 0.9 });
		f.floorItemsBetween("armchair", 1, 3, { wallMargin: 0.6 });
		tableSet(f, {
			variants: [2],
			chairs: [0, 1],
			decor: TABLE_DECOR,
			rug: true,
		});
		f.floorItemsBetween("floorLamp", 1, 2, { wallMargin: 0.4 });
		f.floorItemsBetween("pottedPlant", 0, 2, { wallMargin: 0.4 });
		f.floorItemsBetween("birdcage", 0, 1, { wallMargin: 0.5 });
		f.floorItemsBetween("gramophone", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("chessTable", 0, 1, { wallMargin: 0.7 });
		ghostFurniture(f, 0, 2);
		f.wallDecorBetween("painting", 1, 3);
		f.wallDecorBetween("mirror", 0, 1);
		f.wallDecorBetween("trophyHead", 0, 1);
		randomRugs(f, 0, 1);
		chandeliers(f, 1);
		f.cobwebs(1, 2);
	},
	gallery: (f) => {
		windowsFor(f, [0, 1], 3.2);
		f.wallDecorBetween("painting", 5, 9);
		f.wallDecorBetween("sconce", 2, 4);
		f.floorItemsBetween("bench", 1, 3, { wallMargin: 1.0 });
		f.floorItemsBetween("pottedPlant", 1, 2, { wallMargin: 0.4 });
		sideBySideCandles(f, f.wallItem("cabinet"), 1, 2);
		f.wallItemsBetween("wardrobe", 0, 1);
		f.wallItemsBetween("curtainAlcove", 0, 1);
		f.wallItemsBetween("armor", 1, 2);
		f.wallItemsBetween("displayCase", 0, 1);
		f.floorItemsBetween("statue", 0, 2, { wallMargin: 0.6 });
		f.floorItemsBetween("candelabra", 1, 2, { wallMargin: 0.5 });
		placeRug(
			f,
			f.room.labelPoint,
			f.room.axisAngle + (f.rng.chance(0.5) ? 0 : Math.PI / 2),
			3,
		);
		chandeliers(f, 2);
		f.cobwebs(1, 3);
	},
	corridor: (f) => {
		windowsFor(f, [0, 2], 3.4);
		f.wallDecorBetween("painting", 1, 3);
		f.wallDecorBetween("sconce", 1, 2);
		if (f.rng.chance(0.25)) {
			f.wallDecor("pipeRun");
		}
		if (f.rng.chance(0.25)) {
			f.wallDecor("electricMeter");
		}
		if (f.rng.chance(0.4)) {
			f.wallItem("nightstand");
		}
		if (f.rng.chance(0.35)) {
			f.floorItem("pottedPlant", { variant: 2, wallMargin: 0.3 });
		}
		if (f.rng.chance(0.2)) {
			f.wallItem("armor");
		}
		if (f.rng.chance(0.15)) {
			f.floorItem("coatRack", { wallMargin: 0.3 });
		}
		if (f.rng.chance(0.55)) {
			placeRug(
				f,
				f.room.labelPoint,
				f.room.axisAngle + (f.rng.chance(0.5) ? 0 : Math.PI / 2),
				3,
			);
		}
		f.cobwebs(1, 3);
		f.hangingCobwebs(f.rng.int(0, 1));
	},
	library: (f) => {
		windowsFor(f, [0, 1], 3.4);
		f.wallItemsBetween("bookcase", 4, 9);
		f.wallItemsBetween("wardrobe", 0, 1);
		f.wallItemsBetween("curtainAlcove", 0, 1);
		f.wallItemsBetween("grandfatherClock", 0, 1);
		tableSet(f, {
			variants: [0, 1],
			chairs: [2, 4],
			decor: TABLE_DECOR,
			rug: true,
		});
		tableSet(f, { variants: [2], chairs: [1, 2], decor: TABLE_DECOR });
		f.floorItemsBetween("armchair", 1, 2, { wallMargin: 0.6 });
		f.floorItemsBetween("globe", 0, 1, { wallMargin: 0.6 });
		f.floorItemsBetween("chessTable", 0, 1, { wallMargin: 0.7 });
		f.floorItemsBetween("lectern", 1, 1, { wallMargin: 0.7 });
		f.floorItemsBetween("candelabra", 1, 2, { wallMargin: 0.6 });
		f.floorItemsBetween("bookPile", 1, 3, { wallMargin: 0.3 });
		f.wallDecorBetween("painting", 0, 2);
		f.wallDecorBetween("starChart", 0, 1);
		f.wallDecorBetween("sconce", 1, 2);
		randomRugs(f, 0, 1);
		chandeliers(f, 2);
		f.cobwebs(2, 4);
	},
	cellar: (f) => {
		windowsFor(f, [3], 4);
		f.wallItemsBetween("wineRack", 1, 3);
		f.wallItemsBetween("cask", 1, 2);
		f.wallItemsBetween("barrelStack", 0, 1);
		f.wallItemsBetween("lockers", 0, 1);
		f.wallItemsBetween("shelf", 1, 2);
		f.floorItemsBetween("barrel", 2, 5, { wallMargin: 0.4 });
		f.floorItemsBetween("crate", 2, 4, { wallMargin: 0.4 });
		f.wallDecorBetween("pipeRun", 1, 2);
		f.wallDecorBetween("electricMeter", 0, 1);
		f.wallDecorBetween("sconce", 0, 1);
		f.floorItemsBetween("smallBox", 0, 2, { wallMargin: 0.3 });
		f.floorItemsBetween("bucket", 0, 1, { wallMargin: 0.3 });
		f.cobwebs(3, 5);
		f.hangingCobwebs(f.rng.int(1, 3));
	},
	kitchen: (f) => {
		windowsFor(f, [0, 2]);
		sideBySideCandles(f, f.wallItem("stove"), 0, 0);
		const counters = f.wallItemsBetween("kitchenCounter", 2, 3);
		counters.forEach(
			(counter) => void f.decorateSurface(counter, KITCHEN_DECOR, 1, 3),
		);
		f.wallItemsBetween("sink", 1, 1);
		f.wallItemsBetween("wardrobe", 0, 1);
		f.wallItemsBetween("shelf", 1, 2);
		sideBySideCandles(f, f.wallItem("cabinet"), 1, 2);
		tableSet(f, { variants: [0, 1], chairs: [2, 4], decor: KITCHEN_DECOR });
		f.floorItemsBetween("barrel", 0, 2, { wallMargin: 0.4 });
		f.floorItemsBetween("crate", 0, 2, { wallMargin: 0.4 });
		f.wallDecorBetween("hangingHerbs", 1, 2);
		f.wallDecorBetween("wallShelf", 0, 2);
		f.wallDecorBetween("pipeRun", 0, 1);
		f.wallDecorBetween("electricMeter", 0, 1);
		f.cobwebs(1, 3);
	},
	toilets: (f) => {
		windowsFor(f, [3], 1.6);
		f.wallItem("toilet");
		f.wallItem("sink", { variant: 1 });
		f.wallDecor("mirror", { variant: 1 });
		f.wallDecorBetween("pipeRun", 0, 1, { variant: 1 });
		f.wallDecorBetween("sconce", 0, 1);
		f.cobwebs(1, 2);
	},
	bedroom: (f) => {
		windowsFor(f, [0, 1, 2]);
		bedSet(f);
		if (f.rng.chance(0.3)) {
			bedSet(f);
		}
		f.wallItemsBetween("wardrobe", 1, 1);
		sideBySideCandles(f, f.wallItem("dresser"), 1, 2);
		f.wallItemsBetween("fireplace", 0, 1);
		f.wallItemsBetween("trunk", 0, 1);
		f.wallItemsBetween("chest", 0, 1);
		f.floorItemsBetween("armchair", 0, 1, { wallMargin: 0.5 });
		f.floorItemsBetween("floorLamp", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("dressForm", 0, 1, { wallMargin: 0.5 });
		ghostFurniture(f, 0, 1);
		f.wallDecorBetween("mirror", 0, 1);
		f.wallDecorBetween("painting", 1, 2);
		f.wallDecorBetween("sconce", 0, 2);
		randomRugs(f, 1, 1);
		chandeliers(f, 1);
		f.floorItemsBetween("floorBall", 0, 1, { wallMargin: 0.3 });
		f.cobwebs(1, 3);
	},
	bathroom: (f) => {
		windowsFor(f, [2, 3], 2.2);
		f.wallItem("bathtub");
		f.wallItemsBetween("sink", 1, 2);
		f.wallItemsBetween("wardrobe", 0, 1);
		sideBySideCandles(f, f.wallItem("dresser"), 1, 2);
		f.wallDecorBetween("mirror", 1, 2);
		f.wallDecorBetween("pipeRun", 1, 1);
		f.wallDecorBetween("sconce", 1, 1);
		randomRugs(f, 0, 1);
		f.cobwebs(1, 2);
	},
	study: (f) => {
		windowsFor(f, [0, 1, 2]);
		const desk = f.floorItem("desk", { wallMargin: 1.1 });
		if (desk) {
			const local = rotate2({ x: 0, z: -desk.depth / 2 - 0.35 }, desk.rotation);
			f.floorItem("chair", {
				variant: 1,
				at: { x: desk.x + local.x, z: desk.z + local.z },
				rotation: desk.rotation,
			});
			f.decorateSurface(desk, STUDY_DECOR, 2, 3);
			rugUnder(f, desk, 0.9);
		}
		f.wallItemsBetween("bookcase", 1, 3);
		f.wallItemsBetween("fileCabinet", 1, 2);
		f.wallItemsBetween("lockers", 0, 1);
		f.wallItemsBetween("grandfatherClock", 0, 1);
		sideBySideCandles(f, f.wallItem("cabinet"), 1, 2);
		f.floorItemsBetween("globe", 0, 1, { wallMargin: 0.5 });
		f.floorItemsBetween("armchair", 0, 1, { wallMargin: 0.5 });
		f.wallDecorBetween("specimenFrame", 0, 2);
		f.wallDecorBetween("trophyHead", 0, 1);
		f.wallDecorBetween("painting", 1, 2);
		f.wallDecorBetween("sconce", 0, 1);
		chandeliers(f, 1);
		f.cobwebs(1, 2);
	},
	greenhouse: (f) => {
		windowsFor(f, [0, 1], 2.0);
		greenhouseLayout(f);
	},
	alchemy: (f) => {
		windowsFor(f, [3, 2], 3);
		f.floorItemsBetween("cauldron", 1, 2, { wallMargin: 1.0 });
		const tables = f.floorItemsBetween("alchemyTable", 1, 2, {
			wallMargin: 0.9,
		});
		tables.forEach(
			(table) => void f.decorateSurface(table, ALCHEMY_DECOR, 2, 4),
		);
		f.wallItemsBetween("potionShelf", 2, 3);
		f.wallItemsBetween("bookcase", 0, 1);
		f.wallItemsBetween("wardrobe", 0, 1);
		f.floorItemsBetween("crate", 0, 2, { wallMargin: 0.4 });
		f.floorItemsBetween("barrel", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("vialCluster", 1, 3, { wallMargin: 0.3 });
		f.wallItemsBetween("displayCase", 0, 1);
		f.wallDecorBetween("hangingHerbs", 0, 2);
		f.wallDecorBetween("pipeRun", 0, 1);
		f.wallDecorBetween("wallShelf", 0, 1);
		f.wallDecorBetween("sconce", 0, 1);
		f.cobwebs(2, 4);
		f.hangingCobwebs(1);
	},
	ritual: (f) => {
		ritualCircleLayout(f);
		const altar = estradeWith(f, "altar");
		if (altar) {
			f.decorateSurface(altar, RITUAL_DECOR, 2, 3);
		}
		f.floorItemsBetween("candelabra", 2, 4, { wallMargin: 0.6 });
		f.floorItemsBetween("pillar", 0, 2, { wallMargin: 1.2 });
		f.wallItemsBetween("potionShelf", 0, 1);
		f.wallItemsBetween("trunk", 0, 1);
		f.wallItemsBetween("chest", 0, 1);
		f.wallItemsBetween("lockers", 0, 1);
		f.wallDecorBetween("tapestry", 1, 2);
		f.floorItemsBetween("vialCluster", 0, 2, { wallMargin: 0.3 });
		f.cobwebs(2, 4);
	},
	music: (f) => {
		windowsFor(f, [0, 1]);
		const grand = f.rng.chance(0.6) ? estradeWith(f, "grandPiano", 0, 1) : null;
		if (!grand) {
			f.wallItemsBetween("uprightPiano", 1, 1);
		}
		f.floorItemsBetween("harp", 0, 1, { wallMargin: 0.6 });
		f.floorItemsBetween("cello", 1, 2, { wallMargin: 0.4 });
		const stands = f.floorItemsBetween("musicStand", 1, 3, { wallMargin: 1.0 });
		stands.forEach((stand) => {
			const local = rotate2({ x: 0, z: -0.65 }, stand.rotation);
			f.floorItem("chair", {
				variant: 0,
				at: { x: stand.x + local.x, z: stand.z + local.z },
				rotation: stand.rotation + Math.PI,
			});
		});
		f.floorItemsBetween("sofa", 0, 1, { wallMargin: 0.7 });
		f.wallItemsBetween("curtainAlcove", 0, 1);
		sideBySideCandles(f, f.wallItem("cabinet"), 1, 2);
		f.wallDecorBetween("painting", 1, 3);
		f.wallDecorBetween("sconce", 1, 2);
		randomRugs(f, 0, 1);
		chandeliers(f, 1);
		f.cobwebs(1, 2);
	},
	dining: (f) => {
		windowsFor(f, [0, 1]);
		const room = f.room;
		const extentAlong = rotate2({ x: 1, z: 0 }, room.axisAngle);
		const widthX = room.bounds.maxX - room.bounds.minX;
		const widthZ = room.bounds.maxZ - room.bounds.minZ;
		const longIsAxis = Math.abs(extentAlong.x) > 0.5 === widthX >= widthZ;
		const rotation = room.axisAngle + (longIsAxis ? 0 : Math.PI / 2);
		tableSet(f, {
			variants: [3],
			chairs: [6, 10],
			decor: DINING_DECOR,
			at: room.labelPoint,
			rotation,
			rug: false,
		}) ??
			tableSet(f, {
				variants: [1],
				chairs: [4, 6],
				decor: DINING_DECOR,
				rug: true,
			});
		void f
			.wallItemsBetween("cabinet", 1, 2)
			.forEach(
				(cabinet) => void f.decorateSurface(cabinet, DINING_DECOR, 1, 3),
			);
		f.wallItemsBetween("fireplace", 0, 1);
		f.wallItemsBetween("curtainAlcove", 0, 1);
		f.floorItemsBetween("candelabra", 1, 2, { wallMargin: 0.5 });
		f.wallDecorBetween("painting", 1, 3);
		f.wallDecorBetween("sconce", 0, 2);
		chandeliers(f, 2);
		f.cobwebs(1, 3);
	},
	workshop: (f) => {
		windowsFor(f, [0, 2]);
		f.wallItemsBetween("workbench", 2, 3).forEach(
			(bench) =>
				void f.decorateSurface(
					bench,
					[
						["jar", 2],
						["candle", 2],
						["books", 1],
					],
					1,
					2,
				),
		);
		f.wallItemsBetween("toolRack", 1, 2);
		f.wallItemsBetween("lockers", 1, 1);
		f.wallItemsBetween("cask", 0, 1);
		f.wallItemsBetween("shelf", 1, 1);
		f.floorItemsBetween("crate", 2, 4, { wallMargin: 0.4 });
		f.floorItemsBetween("barrel", 0, 2, { wallMargin: 0.4 });
		f.floorItemsBetween("anvil", 0, 1, { wallMargin: 0.8 });
		f.floorItemsBetween("smallBox", 1, 3, { wallMargin: 0.3 });
		f.wallDecorBetween("pipeRun", 1, 2);
		f.wallDecorBetween("electricMeter", 1, 1);
		f.wallDecorBetween("sconce", 0, 1);
		f.cobwebs(2, 3);
	},
	chapel: (f) => {
		windowsFor(f, [4], 2.4);
		chapelLayout(f);
		f.wallItemsBetween("confessional", 0, 1);
		f.floorItemsBetween("lectern", 0, 1, { wallMargin: 1.0 });
		f.floorItemsBetween("pillar", 0, 2, { wallMargin: 1.4 });
		f.wallDecorBetween("tapestry", 1, 2);
		f.wallDecorBetween("sconce", 1, 2);
		chandeliers(f, 2);
		f.cobwebs(2, 4);
	},
	sanctuary: (f) => {
		f.floorItemsBetween("candelabra", 2, 3, { wallMargin: 0.5 });
		f.floorItemsBetween("pew", 1, 2, { wallMargin: 0.8 });
		f.wallDecorBetween("tapestry", 1, 2);
		f.wallDecorBetween("sconce", 1, 2);
		f.cobwebs(1, 2);
	},
	reliquary: (f) => {
		f.wallItemsBetween("cabinet", 1, 2);
		f.wallItemsBetween("chest", 1, 2);
		f.floorItemsBetween("urn", 1, 2, { wallMargin: 0.4 });
		f.floorItemsBetween("bust", 0, 1, { wallMargin: 0.5 });
		f.wallDecorBetween("sconce", 1, 2);
		f.cobwebs(2, 3);
	},
	pact: (f) => {
		f.floorItemsBetween("candelabra", 1, 2, { wallMargin: 0.5 });
		f.floorItemsBetween("pillar", 0, 2, { wallMargin: 1.2 });
		f.wallItemsBetween("trunk", 0, 1);
		f.wallDecorBetween("sconce", 1, 1);
		f.cobwebs(3, 4);
		f.hangingCobwebs(1);
	},
	closet: (f) => {
		f.wallItem("shelf", { variant: 2 });
		f.floorItemsBetween("broom", 1, 2, { wallMargin: 0.15 });
		f.floorItemsBetween("bucket", 1, 1, { wallMargin: 0.2 });
		f.floorItemsBetween("vialCluster", 1, 2, { wallMargin: 0.15 });
		f.floorItemsBetween("smallBox", 0, 1, { wallMargin: 0.15 });
		f.wallDecorBetween("wallShelf", 0, 1);
		f.cobwebs(3, 4);
		f.hangingCobwebs(1);
	},
	observatory: observatoryLayout,
	curiosities: curiositiesLayout,
	nursery: nurseryLayout,
	laundry: laundryLayout,
	crypt: cryptLayout,
	dungeon: dungeonLayout,
	pond: (f) => {
		windowsFor(f, [0, 1], 2.6);
		pondLayout(f);
	},
	ballroom: (f) => {
		windowsFor(f, [0, 1, 2], 3.2);
		f.floorItemsBetween("pillar", 2, 4, { wallMargin: 1.4 });
		f.floorItemsBetween("statue", 1, 3, { wallMargin: 0.9 });
		f.floorItemsBetween("grandPiano", 0, 1, { wallMargin: 1.0 });
		f.wallItemsBetween("curtainAlcove", 1, 2);
		f.wallItemsBetween("stageCurtain", 0, 1);
		f.floorItemsBetween("sofa", 0, 2, { wallMargin: 0.7 });
		f.floorItemsBetween("armchair", 1, 3, { wallMargin: 0.5 });
		f.floorItemsBetween("candelabra", 2, 4, { wallMargin: 0.6 });
		f.floorItemsBetween("gramophone", 0, 1, { wallMargin: 0.5 });
		f.floorItemsBetween("pottedPlant", 1, 3, { wallMargin: 0.4 });
		f.wallDecorBetween("painting", 2, 4);
		f.wallDecorBetween("mirror", 1, 3);
		f.wallDecorBetween("tapestry", 0, 2);
		f.wallDecorBetween("sconce", 2, 4);
		chandeliers(f, 3);
		f.cobwebs(1, 3);
	},
	theater: theaterLayout,
	armory: (f) => {
		f.wallItemsBetween("weaponRack", 2, 4);
		f.wallItemsBetween("armor", 1, 3);
		f.wallItemsBetween("chest", 0, 2);
		f.wallItemsBetween("lockers", 0, 1);
		f.wallItemsBetween("displayCase", 0, 1);
		f.floorItemsBetween("anvil", 0, 1, { wallMargin: 0.8 });
		tableSet(f, {
			variants: [0, 1],
			chairs: [0, 2],
			decor: [
				["candle", 2],
				["openBook", 1],
				["skull", 1],
			],
		});
		f.floorItemsBetween("crate", 0, 2, { wallMargin: 0.4 });
		f.floorItemsBetween("barrel", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("statue", 0, 1, { wallMargin: 0.6 });
		f.wallDecorBetween("shieldDisplay", 2, 4);
		f.wallDecorBetween("trophyHead", 0, 1);
		f.wallDecorBetween("sconce", 1, 3);
		chandeliers(f, 1);
		f.cobwebs(1, 3);
	},
	billiard: (f) => {
		windowsFor(f, [0, 1]);
		f.floorItem("billiardTable", { wallMargin: 1.2 }) ??
			f.floorItem("billiardTable", { variant: 1, wallMargin: 1.0 });
		sideBySideCandles(f, f.wallItem("cabinet"), 1, 2);
		f.wallItemsBetween("bookcase", 0, 1);
		f.wallItemsBetween("curtainAlcove", 0, 1);
		f.floorItemsBetween("armchair", 1, 3, { wallMargin: 0.5 });
		f.floorItemsBetween("chessTable", 0, 1, { wallMargin: 0.8 });
		f.floorItemsBetween("gramophone", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("floorLamp", 1, 2, { wallMargin: 0.4 });
		f.floorItemsBetween("coatRack", 0, 1, { wallMargin: 0.3 });
		f.wallDecorBetween("painting", 1, 3);
		f.wallDecorBetween("trophyHead", 0, 2);
		f.wallDecorBetween("sconce", 1, 2);
		chandeliers(f, 1);
		f.cobwebs(1, 2);
	},
	attic: atticLayout,
	undercroft: undercroftLayout,
	stairwell: (f) => {
		f.wallDecorBetween("painting", 1, 2);
		f.wallDecorBetween("ovalPortrait", 0, 1);
		f.wallDecorBetween("sconce", 1, 2);
		f.wallDecorBetween("wallClock", 0, 1);
		f.wallDecorBetween("trophyHead", 0, 1);
		f.cobwebs(2, 4);
	},
};

function ceilingBetween(
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

function sideTables(furnisher: RoomFurnisher, min: number, max: number): void {
	for (const table of furnisher.floorItemsBetween("sideTable", min, max, {
		wallMargin: 0.5,
	})) {
		furnisher.decorateSurface(table, SIDE_TABLE_DECOR, 1, 1);
	}
}

const EXTRAS: Partial<Record<RoomType, Recipe>> = {
	hall: (f) => {
		f.floorItemsBetween("umbrellaStand", 0, 1, { wallMargin: 0.25 });
		f.floorItemsBetween("bust", 0, 1, { wallMargin: 0.6 });
		f.wallItemsBetween("throne", 0, 1);
		f.wallDecorBetween("wallClock", 0, 1);
		f.wallDecorBetween("ovalPortrait", 0, 1);
	},
	salon: (f) => {
		f.floorItemsBetween("chaiseLongue", 0, 1, { wallMargin: 0.7 });
		f.floorItemsBetween("ottoman", 0, 1, { wallMargin: 0.5 });
		f.floorItemsBetween("screen", 0, 1, { wallMargin: 0.4 });
		sideTables(f, 0, 1);
		f.wallItemsBetween("secretary", 0, 1);
		f.wallDecorBetween("ovalPortrait", 0, 2);
		f.wallDecorBetween("wallClock", 0, 1);
	},
	gallery: (f) => {
		f.floorItemsBetween("bust", 1, 2, { wallMargin: 0.5 });
		f.floorItemsBetween("easel", 0, 1, { wallMargin: 0.5 });
		f.floorItemsBetween("urn", 0, 1, { wallMargin: 0.4 });
		f.wallDecorBetween("ovalPortrait", 1, 2);
	},
	corridor: (f) => {
		if (f.rng.chance(0.2)) {
			f.floorItem("umbrellaStand", { wallMargin: 0.2 });
		}
		if (f.rng.chance(0.12)) {
			f.floorItem("wheelchair", { wallMargin: 0.3 });
		}
		if (f.rng.chance(0.2)) {
			f.wallDecor("barometer");
		}
		if (f.rng.chance(0.25)) {
			f.wallDecor("ovalPortrait");
		}
	},
	library: (f) => {
		sideTables(f, 0, 1);
		f.wallItemsBetween("secretary", 0, 1);
		f.wallDecorBetween("oldMap", 0, 1);
	},
	cellar: (f) => {
		f.wallItemsBetween("woodpile", 0, 1);
		f.floorItemsBetween("grainSacks", 0, 2, { wallMargin: 0.3 });
		f.floorItemsBetween("milkChurns", 0, 1, { wallMargin: 0.25 });
		ceilingBetween(f, "meatHooks", 0, 1);
	},
	kitchen: (f) => {
		f.wallDecorBetween("hangingPots", 1, 1);
		f.wallDecorBetween("spiceRack", 0, 1);
		f.floorItemsBetween("butterChurn", 0, 1, { wallMargin: 0.25 });
		f.floorItemsBetween("milkChurns", 0, 1, { wallMargin: 0.25 });
		f.floorItemsBetween("logBasket", 0, 1, { wallMargin: 0.25 });
		f.floorItemsBetween("stool", 0, 2, { wallMargin: 0.4 });
		f.floorItemsBetween("grainSacks", 0, 1, { wallMargin: 0.3 });
		ceilingBetween(f, "meatHooks", 0, 1);
	},
	bedroom: (f) => {
		f.wallItemsBetween("vanity", 0, 1);
		f.wallItemsBetween("washstand", 0, 1);
		f.floorItemsBetween("screen", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("rockingChair", 0, 1, { wallMargin: 0.5 });
		f.wallDecorBetween("crucifix", 0, 1);
		f.wallDecorBetween("wallClock", 0, 1);
	},
	bathroom: (f) => {
		f.wallItemsBetween("washstand", 0, 1);
		f.floorItemsBetween("screen", 0, 1, { wallMargin: 0.3 });
	},
	study: (f) => {
		f.wallItemsBetween("secretary", 0, 1);
		f.wallDecorBetween("oldMap", 0, 1);
		f.wallDecorBetween("barometer", 0, 1);
		f.wallDecorBetween("wallClock", 0, 1);
	},
	greenhouse: (f) => {
		f.floorItemsBetween("birdbath", 0, 1, { wallMargin: 0.8 });
		f.floorItemsBetween("gardenLantern", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });
	},
	alchemy: (f) => {
		f.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });
		ceilingBetween(f, "hangingCage", 0, 1);
		f.wallDecorBetween("spiceRack", 0, 1);
	},
	ritual: (f) => {
		f.floorItemsBetween("urn", 0, 2, { wallMargin: 0.4 });
		f.wallItemsBetween("throne", 0, 1);
		ceilingBetween(f, "hangingCage", 0, 1);
	},
	music: (f) => {
		f.floorItemsBetween("harpsichord", 0, 1, { wallMargin: 0.8 });
		f.floorItemsBetween("timpani", 0, 1, { wallMargin: 0.5 });
		f.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });
		f.wallDecorBetween("ovalPortrait", 0, 1);
	},
	dining: (f) => {
		f.wallDecorBetween("wallClock", 0, 1);
		f.wallDecorBetween("antlers", 0, 1);
		f.floorItemsBetween("torchere", 0, 2, { wallMargin: 0.4 });
	},
	workshop: (f) => {
		f.wallItemsBetween("woodpile", 0, 1);
		f.floorItemsBetween("stool", 1, 2, { wallMargin: 0.4 });
		f.floorItemsBetween("easel", 0, 1, { wallMargin: 0.5 });
		f.wallDecorBetween("keyRack", 0, 1);
	},
	chapel: (f) => {
		f.wallDecorBetween("crucifix", 1, 2);
		f.floorItemsBetween("urn", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("torchere", 0, 2, { wallMargin: 0.5 });
	},
	closet: (f) => {
		f.floorItemsBetween("umbrellaStand", 0, 1, { wallMargin: 0.15 });
		f.wallDecorBetween("keyRack", 0, 1);
	},
	observatory: (f) => {
		f.wallDecorBetween("oldMap", 0, 1);
		f.wallDecorBetween("barometer", 0, 1);
		f.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });
	},
	curiosities: (f) => {
		f.floorItemsBetween("bust", 0, 1, { wallMargin: 0.5 });
		f.floorItemsBetween("urn", 0, 1, { wallMargin: 0.4 });
		ceilingBetween(f, "hangingCage", 0, 1);
		f.wallDecorBetween("antlers", 0, 1);
	},
	nursery: (f) => {
		f.floorItemsBetween("dollhouse", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("rockingChair", 0, 1, { wallMargin: 0.5 });
		f.wallDecorBetween("wallClock", 0, 1);
	},
	laundry: (f) => {
		f.floorItemsBetween("ironingBoard", 0, 1, { wallMargin: 0.5 });
		f.wallItemsBetween("washstand", 0, 1);
	},
	crypt: (f) => {
		f.floorItemsBetween("urn", 1, 3, { wallMargin: 0.4 });
		f.floorItemsBetween("torchere", 0, 2, { wallMargin: 0.5 });
		f.wallDecorBetween("crucifix", 0, 1);
	},
	dungeon: (f) => {
		f.floorItemsBetween("pillory", 0, 1, { wallMargin: 0.8 });
		f.floorItemsBetween("torchere", 0, 1, { wallMargin: 0.5 });
		ceilingBetween(f, "hangingCage", 0, 2);
		ceilingBetween(f, "meatHooks", 0, 1);
	},
	pond: (f) => {
		f.floorItemsBetween("birdbath", 0, 1, { wallMargin: 0.7 });
		f.floorItemsBetween("gardenLantern", 1, 2, { wallMargin: 0.4 });
		f.floorItemsBetween("urn", 0, 2, { wallMargin: 0.4 });
	},
	ballroom: (f) => {
		f.floorItemsBetween("chaiseLongue", 0, 1, { wallMargin: 0.7 });
		f.floorItemsBetween("ottoman", 0, 2, { wallMargin: 0.5 });
		f.floorItemsBetween("bust", 0, 2, { wallMargin: 0.6 });
		f.floorItemsBetween("torchere", 0, 2, { wallMargin: 0.5 });
		f.floorItemsBetween("harpsichord", 0, 1, { wallMargin: 0.9 });
	},
	theater: (f) => {
		f.floorItemsBetween("screen", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("chaiseLongue", 0, 1, { wallMargin: 0.6 });
	},
	armory: (f) => {
		f.wallDecorBetween("antlers", 0, 1);
		f.floorItemsBetween("torchere", 0, 1, { wallMargin: 0.5 });
		f.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });
	},
	billiard: (f) => {
		f.wallDecorBetween("antlers", 0, 1);
		f.wallDecorBetween("wallClock", 0, 1);
		f.floorItemsBetween("stool", 0, 2, { wallMargin: 0.4 });
		sideTables(f, 0, 1);
	},
	attic: (f) => {
		f.floorItemsBetween("wheelchair", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("dollhouse", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("screen", 0, 1, { wallMargin: 0.4 });
		f.floorItemsBetween("rockingChair", 0, 1, { wallMargin: 0.5 });
		f.floorItemsBetween("umbrellaStand", 0, 1, { wallMargin: 0.25 });
		f.floorItemsBetween("logBasket", 0, 1, { wallMargin: 0.25 });
	},
	undercroft: (f) => {
		f.wallItemsBetween("woodpile", 0, 1);
		f.floorItemsBetween("grainSacks", 0, 2, { wallMargin: 0.3 });
		ceilingBetween(f, "meatHooks", 0, 1);
	},
};

type Filler = readonly [kind: string, placement: "wall" | "floor"];

const LARGE_ROOM_AREA = 45;
const LARGE_ROOM_COVERAGE = 0.16;
const LARGE_ROOM_BORDER = 2;
const GRAND_ROOM_COVERAGE = 0.2;
const GRAND_ROOM_BORDER = 7;

const DEFAULT_FILLERS: readonly Filler[] = [
	["sheetedFurniture", "floor"],
	["bust", "floor"],
	["urn", "floor"],
	["screen", "floor"],
	["statue", "floor"],
	["pottedPlant", "floor"],
	["candelabra", "floor"],
	["crate", "floor"],
	["chest", "wall"],
	["armor", "wall"],
];

const FILLERS: Partial<Record<RoomType, readonly Filler[]>> = {
	hall: [
		["statue", "floor"],
		["bust", "floor"],
		["torchere", "floor"],
		["pillar", "floor"],
		["sheetedFurniture", "floor"],
		["armchair", "floor"],
		["bench", "floor"],
		["pottedPlant", "floor"],
		["candelabra", "floor"],
		["armor", "wall"],
		["grandfatherClock", "wall"],
		["chest", "wall"],
		["cabinet", "wall"],
	],
	ballroom: [
		["pillar", "floor"],
		["chaiseLongue", "floor"],
		["ottoman", "floor"],
		["statue", "floor"],
		["sofa", "floor"],
		["armchair", "floor"],
		["sheetedFurniture", "floor"],
		["pottedPlant", "floor"],
		["candelabra", "floor"],
		["harp", "floor"],
		["armor", "wall"],
		["cabinet", "wall"],
	],
	music: [
		["harp", "floor"],
		["cello", "floor"],
		["musicStand", "floor"],
		["armchair", "floor"],
		["sofa", "floor"],
		["pottedPlant", "floor"],
		["candelabra", "floor"],
		["uprightPiano", "wall"],
		["cabinet", "wall"],
	],
	gallery: [
		["statue", "floor"],
		["bench", "floor"],
		["pillar", "floor"],
		["pottedPlant", "floor"],
		["armor", "wall"],
		["displayCase", "wall"],
	],
	observatory: [
		["globe", "floor"],
		["crate", "floor"],
		["statue", "floor"],
		["displayCase", "wall"],
		["bookcase", "wall"],
	],
	curiosities: [
		["statue", "floor"],
		["globe", "floor"],
		["sheetedFurniture", "floor"],
		["displayCase", "wall"],
		["armor", "wall"],
	],
	dungeon: [
		["crate", "floor"],
		["barrel", "floor"],
		["pillar", "floor"],
		["cellBars", "wall"],
		["standingCoffin", "wall"],
	],
	greenhouse: [
		["pottedPlant", "floor"],
		["planterBed", "floor"],
		["flowerPot", "floor"],
		["bench", "floor"],
	],
	pond: [
		["flowerPot", "floor"],
		["pottedPlant", "floor"],
		["bench", "floor"],
		["statue", "floor"],
	],
	sanctuary: [
		["candelabra", "floor"],
		["statue", "floor"],
		["pew", "floor"],
	],
	reliquary: [
		["chest", "wall"],
		["urn", "floor"],
		["cabinet", "wall"],
	],
	pact: [
		["candelabra", "floor"],
		["pillar", "floor"],
		["trunk", "wall"],
	],
	chapel: [
		["pew", "floor"],
		["statue", "floor"],
		["candelabra", "floor"],
		["pillar", "floor"],
	],
	library: [
		["bookcase", "wall"],
		["armchair", "floor"],
		["globe", "floor"],
		["lectern", "floor"],
		["candelabra", "floor"],
	],
	crypt: [
		["sarcophagus", "floor"],
		["urn", "floor"],
		["candelabra", "floor"],
		["pillar", "floor"],
		["standingCoffin", "wall"],
	],
	cellar: [
		["barrel", "floor"],
		["grainSacks", "floor"],
		["crate", "floor"],
		["barrelStack", "wall"],
	],
	corridor: [],
	stairwell: [],
};

function fillLargeRoom(furnisher: RoomFurnisher): void {
	const room = furnisher.room;
	const fillers = FILLERS[room.type] ?? DEFAULT_FILLERS;
	if (room.area < LARGE_ROOM_AREA || fillers.length === 0) {
		return;
	}
	const coverage = room.mezzanine ? GRAND_ROOM_COVERAGE : LARGE_ROOM_COVERAGE;
	const border = room.mezzanine ? GRAND_ROOM_BORDER : LARGE_ROOM_BORDER;
	for (
		let attempt = 0;
		attempt < 40 && furnisher.coverage() < coverage;
		attempt += 1
	) {
		const [kind, placement] = furnisher.rng.pick(fillers);
		if (placement === "wall") {
			furnisher.wallItem(kind);
			continue;
		}
		for (let tries = 0; tries < 8; tries += 1) {
			const at = furnisher.randomInteriorPoint(0.8);
			if (
				at &&
				furnisher.distanceToWalls(at) <= border &&
				furnisher.floorItem(kind, {
					at,
					wallMargin: 0.8,
				})
			) {
				break;
			}
		}
	}
}

export function furnishRoomByType(
	furnisher: RoomFurnisher,
	options: { valve: boolean },
): void {
	if (options.valve) {
		furnisher.wallItem("valveStation", { avoidExterior: false });
	}
	grandRoomReliefs(furnisher);
	RECIPES[furnisher.room.type](furnisher);
	EXTRAS[furnisher.room.type]?.(furnisher);
	fillLargeRoom(furnisher);
	dressMezzanine(furnisher);
}

const DECK_WALL_KINDS: readonly (readonly [string, number])[] = [
	["bookcase", 3],
	["cabinet", 2],
	["shelf", 1.5],
	["chest", 1.5],
	["armor", 1.5],
	["dresser", 1],
	["trunk", 1],
	["grandfatherClock", 0.8],
	["secretary", 0.6],
	["coatRack", 0.5],
];
const DECK_RAIL_KINDS = [
	"candelabra",
	"pottedPlant",
	"bust",
	"urn",
	"torchere",
	"globe",
	"sideTable",
] as const;
const DECK_CORNER_KINDS = [
	"statue",
	"grandfatherClock",
	"armor",
	"urn",
] as const;
const DECK_DECOR_KINDS = [
	"painting",
	"tapestry",
	"mirror",
	"shieldDisplay",
	"trophyHead",
	"oldMap",
	"ovalPortrait",
	"antlers",
] as const;
const DAIS_TOP_KINDS = [
	"statue",
	"altar",
	"harp",
	"globe",
	"armor",
	"throne",
] as const;

function dressMezzanine(furnisher: RoomFurnisher): void {
	const spec = furnisher.room.mezzanine;
	if (!spec) {
		return;
	}
	const { rng } = furnisher;
	const level = spec.floorY - furnisher.room.floorY;
	const edges = spec.deckEdges;
	const hasCentralLight = furnisher.items.some(
		(item) => item.kind === "chandelier" && !pointInPolygon(item, spec.deck),
	);
	if (!hasCentralLight) {
		furnisher.ceilingItem("chandelier", spec.clearCenter);
	}
	furnisher.wallDecorBetween("sconce", 4, 6, { mountY: 1.85 });
	deckPodium(furnisher, spec);
	furnisher.placeOnDeck(
		rng.pick(DECK_CORNER_KINDS),
		spec.corner,
		furnisher.facingAwayFromWall(spec.corner),
	);
	for (const edge of edges) {
		furnisher.dressDeckWall(edge, DECK_WALL_KINDS);
	}
	furnisher.dressDeckRails(DECK_RAIL_KINDS, rng.int(3, 5));
	furnisher.layDeckRunner();
	furnisher.wallDecorBetween("sconce", 3, 4, { edges, mountY: level + 1.8 });
	for (let index = rng.int(3, 5); index > 0; index -= 1) {
		furnisher.wallDecor(rng.pick(DECK_DECOR_KINDS), {
			edges,
			mountY: level + 1.3,
		});
	}
	furnisher.floorItemsBetween("candelabra", 3, 4, { wallMargin: 0.8 });
	dressGrandGreenery(furnisher, spec);
	dressGrandBidules(furnisher);
}

const GRAND_BIDULES: readonly (readonly [string, number])[] = [
	["sideTable", 3],
	["globe", 1],
	["birdcage", 1.5],
	["gramophone", 1],
	["orrery", 1],
	["spinningWheel", 1],
	["rockingChair", 1.5],
	["telescope", 1],
	["easel", 1],
	["umbrellaStand", 1.5],
	["bookPile", 2],
	["floorCandles", 1.5],
	["dressForm", 1],
	["birdbath", 1],
	["musicStand", 1],
	["coatRack", 1],
];

const BIDULE_SURFACE: readonly (readonly [string, number])[] = [
	["vase", 2],
	["books", 2],
	["candle", 2],
	["skull", 1],
	["hourglass", 1],
	["bellJar", 1],
	["oilLamp", 1],
	["stuffedRaven", 1],
];

const SPACED_ITEM_GAP = 1.1;

function placeSpaced(
	furnisher: RoomFurnisher,
	kind: string,
	maxWallDistance: number,
	gap = SPACED_ITEM_GAP,
): FurnitureItem | null {
	const radius = Math.max(
		...furnitureDefinition(kind).variants.map((size) =>
			Math.max(size.width, size.depth),
		),
	);
	for (let tries = 0; tries < 10; tries += 1) {
		const at = furnisher.randomInteriorPoint(0.6);
		if (
			!at ||
			furnisher.distanceToWalls(at) > maxWallDistance ||
			furnisher
				.floorStandingItems()
				.some(
					(item) =>
						Math.hypot(item.x - at.x, item.z - at.z) <
						Math.max(item.width, item.depth) / 2 + radius / 2 + gap,
				)
		) {
			continue;
		}
		const item = furnisher.floorItem(kind, {
			at,
			wallMargin: 0.5,
		});
		if (item) {
			return item;
		}
	}
	return null;
}

function dressGrandBidules(furnisher: RoomFurnisher): void {
	const { rng } = furnisher;
	for (let index = rng.int(9, 13); index > 0; index -= 1) {
		const kind = rng.weighted(GRAND_BIDULES);
		const item = placeSpaced(furnisher, kind, 4);
		if (item && kind === "sideTable") {
			furnisher.decorateSurface(item, BIDULE_SURFACE, 1, 3);
		}
	}
}

function dressGrandGreenery(
	furnisher: RoomFurnisher,
	spec: MezzanineSpec,
): void {
	const { rng, room } = furnisher;
	const level = spec.floorY - room.floorY;
	const rails = spec.rails.filter((rail) => distance2(rail.a, rail.b) >= 1.8);
	for (const rail of rails) {
		const length = distance2(rail.a, rail.b);
		for (let at = rng.range(1, 2); at < length - 1; at += rng.range(2.5, 4.5)) {
			if (rng.chance(0.7)) {
				furnisher.hangOnRail("railVine", rail, at / length);
			}
		}
	}
	for (const post of spec.posts) {
		if (rng.chance(0.5)) {
			furnisher.wrapPost(
				"climbingVine",
				post,
				level - 0.35 + (rng.chance(0.35) ? 1 : 0),
			);
		}
	}
	for (let index = rng.int(2, 4); index > 0; index -= 1) {
		furnisher.wallDecor("ivyWall");
	}
	for (let index = rng.int(1, 2); index > 0; index -= 1) {
		furnisher.wallDecor("ivyWall", {
			edges: spec.deckEdges,
			mountY: level + 0.5,
		});
	}
	for (let index = rng.int(2, 4); index > 0; index -= 1) {
		const at = furnisher.randomInteriorPoint(2.5);
		if (at && !pointInPolygon(at, spec.deck)) {
			furnisher.ceilingItem("hangingFern", at);
		}
	}
	for (let index = rng.int(1, 2); index > 0; index -= 1) {
		placeSpaced(furnisher, "palmTree", 6);
	}
	for (let index = rng.int(1, 2); index > 0; index -= 1) {
		placeSpaced(furnisher, "planterBed", 3);
	}
	for (let index = rng.int(5, 8); index > 0; index -= 1) {
		placeSpaced(furnisher, "pottedPlant", 2.5);
	}
	for (
		let attempt = 0;
		attempt < 8 &&
		furnisher.items.filter((item) =>
			["pottedPlant", "palmTree", "planterBed"].includes(item.kind),
		).length < 4;
		attempt += 1
	) {
		placeSpaced(furnisher, "pottedPlant", 6, 0.6);
	}
	furnisher.dressDeckRails(["pottedPlant"], rng.int(2, 4));
}

const RELIEF_TOP_KINDS = ["bust", "urn", "candelabra"] as const;

function snapQuarter(value: number): number {
	return Math.round(value * 4) / 4;
}

function maxTiers(width: number, depth: number): number {
	return Math.floor((Math.min(width, depth) - 0.5) / (DAIS_STEP_RUN * 2));
}

function centralDais(furnisher: RoomFurnisher, spec: MezzanineSpec): boolean {
	const { rng } = furnisher;
	for (const scale of [1, 0.82, 0.66]) {
		const width = Math.min(7, (spec.clearWidth - 2.2) * scale);
		const depth = Math.min(5.5, (spec.clearDepth - 2.2) * scale);
		if (width < 2.6 || depth < 2.2) {
			return false;
		}
		const tiers = rng.int(
			2,
			Math.min(4, Math.floor(Math.min(width, depth) / 1.1)),
		);
		const dais = furnisher.floorItem("dais", {
			variant: 0,
			at: spec.clearCenter,
			rotation: spec.clearRotation,
			size: {
				width: snapQuarter(width),
				depth: snapQuarter(depth),
				height: tiers * DAIS_STEP_RISE,
			},
		});
		if (dais) {
			furnisher.floorItem(rng.pick(DAIS_TOP_KINDS), {
				at: spec.clearCenter,
				rotation: spec.clearRotation,
				platform: dais,
			});
			return true;
		}
	}
	return false;
}

function wallTerrace(furnisher: RoomFurnisher, spec: MezzanineSpec): boolean {
	const { room, rng } = furnisher;
	const walls = rng.shuffle(
		room.edges
			.map((edge, index) => ({ edge, index }))
			.filter(({ edge }) => edge.kind === "line" && edgeLength(edge) >= 4.5),
	);
	for (const { edge } of walls) {
		const direction = edgeDirection(edge);
		const middle = {
			x: (edge.a.x + edge.b.x) / 2,
			z: (edge.a.z + edge.b.z) / 2,
		};
		let inward = { x: -direction.z, z: direction.x };
		if (
			!pointInPolygon(
				{ x: middle.x + inward.x * 0.2, z: middle.z + inward.z * 0.2 },
				room.polygon,
			)
		) {
			inward = { x: -inward.x, z: -inward.z };
		}
		const probe = { x: middle.x + inward.x * 2, z: middle.z + inward.z * 2 };
		if (pointInPolygon(probe, spec.deck)) {
			continue;
		}
		const depth = rng.pick([2.25, 2.75, 3.25]);
		for (const length of [Math.min(9, edgeLength(edge) - 1), 4]) {
			const item = furnisher.floorItem("dais", {
				variant: 0,
				at: {
					x: middle.x + inward.x * (depth / 2 + 0.3),
					z: middle.z + inward.z * (depth / 2 + 0.3),
				},
				rotation: Math.atan2(-inward.x, inward.z),
				size: {
					width: snapQuarter(length),
					depth,
					height:
						DAIS_STEP_RISE * rng.int(2, Math.min(3, maxTiers(length, depth))),
				},
			});
			if (item) {
				return true;
			}
		}
	}
	return false;
}

function lowPodium(furnisher: RoomFurnisher): boolean {
	const { rng } = furnisher;
	const width = rng.pick([2.5, 3, 3.5]);
	const depth = rng.pick([2, 2.5]);
	const low = furnisher.floorItem("dais", {
		variant: 0,
		wallMargin: 0.4,
		size: {
			width,
			depth,
			height: DAIS_STEP_RISE * rng.int(1, Math.min(3, maxTiers(width, depth))),
		},
	});
	if (low && rng.chance(0.6)) {
		furnisher.floorItem(rng.pick(RELIEF_TOP_KINDS), {
			at: { x: low.x, z: low.z },
			rotation: low.rotation,
			platform: low,
		});
	}
	return low !== null;
}

function grandRoomReliefs(furnisher: RoomFurnisher): void {
	const spec = furnisher.room.mezzanine;
	if (!spec) {
		return;
	}
	const { rng } = furnisher;
	const placed = rng.chance(0.55)
		? centralDais(furnisher, spec)
		: wallTerrace(furnisher, spec);
	if (!placed || rng.chance(0.25)) {
		lowPodium(furnisher);
	}
}

function deckPodium(furnisher: RoomFurnisher, spec: MezzanineSpec): void {
	const { podium } = spec;
	if (!podium || !furnisher.rng.chance(0.35)) {
		return;
	}
	const tiers = furnisher.rng.int(
		1,
		Math.min(2, maxTiers(podium.width, podium.depth)),
	);
	const dais = furnisher.placeOnDeck(
		"dais",
		podium.center,
		podium.rotation,
		0,
		{
			size: {
				width: podium.width,
				depth: podium.depth,
				height: Math.max(1, tiers) * DAIS_STEP_RISE,
			},
		},
	);
	if (dais && furnisher.rng.chance(0.7)) {
		furnisher.placeOnDeck(
			furnisher.rng.pick(RELIEF_TOP_KINDS),
			podium.center,
			podium.rotation,
			undefined,
			{ platform: dais },
		);
	}
}

const SMALL_ROOM_AREA = 26;
const TINY_ROOM_AREA = 8;
const SMALL_ROOM_ESSENTIALS = new Set([
	"toilet",
	"sink",
	"bathtub",
	"valveStation",
	"occultAltar",
	"stakeSanctuary",
	"stakeReliquary",
	"stakePact",
	"fireplace",
	"stove",
	"kitchenCounter",
	"pond",
	"estrade",
	"workbench",
]);
const SMALL_ROOM_FILLERS: readonly (readonly [string, "wall" | "floor"])[] = [
	["chest", "wall"],
	["cabinet", "wall"],
	["shelf", "wall"],
	["trunk", "wall"],
	["crate", "floor"],
	["stool", "floor"],
	["sideTable", "floor"],
	["pottedPlant", "floor"],
	["logBasket", "floor"],
	["laundryBasket", "floor"],
	["umbrellaStand", "floor"],
	["bookPile", "floor"],
];
const TINY_ROOM_FILLERS: readonly (readonly [string, "wall" | "floor"])[] = [
	["umbrellaStand", "floor"],
	["bookPile", "floor"],
	["broom", "floor"],
	["crate", "floor"],
	["stool", "floor"],
];

export function balanceRoom(furnisher: RoomFurnisher): void {
	const { room, rng } = furnisher;
	if (
		room.area >= SMALL_ROOM_AREA ||
		room.type === "stairwell" ||
		room.type === "corridor"
	) {
		return;
	}
	if (
		room.type === "toilets" &&
		!furnisher.items.some((i) => i.kind === "toilet")
	) {
		for (const item of furnisher.floorStandingItems()) {
			if (
				item.kind !== "valveStation" &&
				item.kind !== "occultAltar" &&
				!item.kind.startsWith("stake")
			) {
				furnisher.removeItem(item);
			}
		}
		furnisher.wallItem("toilet");
	}
	const tiny = room.area < TINY_ROOM_AREA;
	const maxCoverage = tiny ? 0.3 : 0.27;
	const minCoverage = tiny ? 0.07 : 0.15;
	const maxCount = tiny ? 3 : Math.max(4, Math.round(room.area / 3.4));
	const removable = () =>
		furnisher.floorStandingItems().filter((item) => {
			const beds = furnisher.items.filter((other) => other.kind === "bed");
			const duplicate =
				item.kind !== "valveStation" &&
				item.kind !== "occultAltar" &&
				!item.kind.startsWith("stake") &&
				furnisher.items.filter((other) => other.kind === item.kind).length > 1;
			return (
				item.hideSpotId === null &&
				(!SMALL_ROOM_ESSENTIALS.has(item.kind) || duplicate) &&
				!(item.kind === "bed" && beds.length === 1)
			);
		});
	while (
		furnisher.coverage() > maxCoverage ||
		furnisher.floorStandingItems().length > maxCount
	) {
		const candidates = removable();
		if (candidates.length === 0) {
			break;
		}
		furnisher.removeItem(rng.pick(candidates));
	}
	const fillers = tiny ? TINY_ROOM_FILLERS : SMALL_ROOM_FILLERS;
	for (
		let attempt = 0;
		attempt < 24 &&
		furnisher.coverage() < minCoverage &&
		furnisher.floorStandingItems().length < maxCount;
		attempt += 1
	) {
		const [kind, placement] = rng.pick(fillers);
		if (placement === "wall") {
			furnisher.wallItem(kind);
		} else {
			furnisher.floorItem(kind, { wallMargin: tiny ? 0.2 : 0.4 });
		}
	}
}

const TOP_UP_HIDES: Partial<Record<RoomType, string[]>> = {
	sanctuary: ["curtainAlcove", "confessional"],
	reliquary: ["trunk", "wardrobe"],
	pact: ["standingCoffin", "trunk"],
	hall: ["curtainAlcove", "wardrobe"],
	salon: ["curtainAlcove", "wardrobe"],
	gallery: ["curtainAlcove", "wardrobe"],
	dining: ["curtainAlcove", "wardrobe"],
	music: ["curtainAlcove", "wardrobe"],
	library: ["curtainAlcove", "wardrobe"],
	chapel: ["curtainAlcove", "confessional"],
	bedroom: ["trunk", "wardrobe"],
	nursery: ["trunk", "wardrobe"],
	laundry: ["trunk", "lockers"],
	ritual: ["trunk", "lockers"],
	cellar: ["cask", "lockers"],
	workshop: ["cask", "lockers"],
	kitchen: ["cask", "wardrobe", "lockers"],
	study: ["lockers", "curtainAlcove", "wardrobe"],
	ballroom: ["curtainAlcove", "wardrobe"],
	theater: ["curtainAlcove", "wardrobe"],
	armory: ["lockers", "trunk"],
	billiard: ["curtainAlcove", "wardrobe"],
	attic: ["trunk", "standingCoffin"],
	undercroft: ["cask", "standingCoffin"],
	crypt: ["standingCoffin", "trunk"],
	dungeon: ["standingCoffin", "cask"],
	pond: ["curtainAlcove", "wardrobe"],
};

export function topUpHidingSpots(furnisher: RoomFurnisher): void {
	const options = furnisher.rng.shuffle(
		TOP_UP_HIDES[furnisher.room.type] ?? ["wardrobe", "lockers", "trunk"],
	);
	for (const kind of options) {
		if (furnisher.wallItem(kind)) {
			return;
		}
	}
}
