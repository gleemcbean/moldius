import {
	ALTAR_MAX_PER_LEVEL,
	ALTAR_ROOMS_PER_ALTAR,
} from "../../config/index.js";
import type { SeededRandom } from "../../random.js";
import { furnitureDefinition } from "../furnitureCatalog.js";
import type {
	FurnitureItem,
	HideSpot,
	LightSource,
	Opening,
	Room,
	RoomType,
	ValveStation,
} from "../types.js";
import { type IdAllocator, RoomFurnisher } from "./RoomFurnisher.js";
import { balanceRoom, furnishRoomByType, topUpHidingSpots } from "./themes.js";

export interface FurnishResult {
	furniture: FurnitureItem[];
	hideSpots: HideSpot[];
	lights: LightSource[];
	valves: ValveStation[];
}

const ALTAR_AVOID_TYPES: RoomType[] = ["corridor", "closet", "toilets"];

const VALVE_PREFERENCE: RoomType[][] = [
	["cellar", "workshop"],
	["bathroom", "kitchen", "alchemy"],
	["hall", "gallery", "salon", "corridor"],
];

const HIDE_FALLBACK_TYPES: RoomType[] = [
	"alchemy",
	"ritual",
	"music",
	"cellar",
	"bathroom",
	"corridor",
	"chapel",
];

const HIDE_TOP_UP_TYPES: RoomType[] = [
	"hall",
	"salon",
	"bedroom",
	"library",
	"study",
	"kitchen",
	"gallery",
	"workshop",
	"dining",
];

export function furnishManor(
	rooms: Room[],
	openings: Opening[],
	rng: SeededRandom,
): FurnishResult {
	const ids: IdAllocator = { furniture: 0, hide: 0, light: 0, valve: 0 };
	const valveTarget = Math.max(3, Math.round(rooms.length / 7));
	const valveRooms = chooseValveRooms(rooms, rng, valveTarget);
	const furnishers = rooms.map((room) => {
		const furnisher = new RoomFurnisher(
			room,
			room.openingIds.map((id) => openings[id]),
			rng.fork(`room-${room.id}`),
			ids,
		);
		furnishRoomByType(furnisher, { valve: valveRooms.has(room.id) });
		return furnisher;
	});

	ensureValveCount(furnishers, valveTarget, rng);
	ensureHidingSpots(furnishers, Math.ceil(rooms.length * 0.55), rng);
	placeAltars(furnishers, rng.fork("altars"));
	for (const furnisher of furnishers) {
		balanceRoom(furnisher);
	}
	return collect(furnishers);
}

function altarTarget(roomCount: number): number {
	return Math.max(
		1,
		Math.min(ALTAR_MAX_PER_LEVEL, Math.ceil(roomCount / ALTAR_ROOMS_PER_ALTAR)),
	);
}

function placeAltars(furnishers: RoomFurnisher[], rng: SeededRandom): void {
	const levels = [...new Set(furnishers.map(({ room }) => room.level))];
	for (const level of levels) {
		const onLevel = furnishers.filter(
			({ room }) => room.level === level && room.type !== "stairwell",
		);
		const target = altarTarget(onLevel.length);
		const candidates = [
			...rng.shuffle(
				onLevel.filter(({ room }) => !ALTAR_AVOID_TYPES.includes(room.type)),
			),
			...rng.shuffle(
				onLevel.filter(({ room }) => ALTAR_AVOID_TYPES.includes(room.type)),
			),
		];
		const placed: RoomFurnisher[] = [];
		const distance = (a: RoomFurnisher, b: RoomFurnisher) =>
			Math.hypot(
				a.room.labelPoint.x - b.room.labelPoint.x,
				a.room.labelPoint.z - b.room.labelPoint.z,
			);
		for (const minimum of [12, 0]) {
			for (const furnisher of candidates) {
				if (
					placed.length < target &&
					!placed.includes(furnisher) &&
					placed.every((other) => distance(other, furnisher) >= minimum) &&
					furnisher.floorItem("occultAltar", {
						variant: 0,
						wallMargin: 0.7,
					})
				) {
					placed.push(furnisher);
				}
			}
		}
		if (placed.length === 0) {
			forceAltar(candidates);
		}
	}
}

function forceAltar(candidates: RoomFurnisher[]): void {
	const byArea = [...candidates].sort(
		(first, second) => second.room.area - first.room.area,
	);
	for (const furnisher of byArea) {
		const movable = () =>
			furnisher.items.filter(
				(item) =>
					item.hideSpotId === null &&
					item.valveId === null &&
					furnishMovable(item.kind),
			);
		const attempt = () =>
			furnisher.floorItem("occultAltar", { variant: 1, wallMargin: 0.3 });
		if (attempt()) {
			return;
		}
		for (const item of movable()) {
			furnisher.removeItem(item);
			if (attempt()) {
				return;
			}
		}
	}
}

function furnishMovable(kind: string): boolean {
	const placement = furnitureDefinition(kind).placement;
	return placement === "floor" || placement === "wall";
}

function chooseValveRooms(
	rooms: Room[],
	rng: SeededRandom,
	target: number,
): Set<number> {
	const chosen = new Set<number>();
	for (const tier of VALVE_PREFERENCE) {
		const candidates = rng.shuffle(
			rooms.filter((room) => tier.includes(room.type)),
		);
		for (const room of candidates) {
			if (chosen.size >= target) {
				return chosen;
			}
			const tooClose = [...chosen].some((id) => {
				const other = rooms[id];
				return (
					other.level === room.level &&
					Math.hypot(
						other.labelPoint.x - room.labelPoint.x,
						other.labelPoint.z - room.labelPoint.z,
					) < 9
				);
			});
			if (!tooClose) {
				chosen.add(room.id);
			}
		}
	}
	return chosen;
}

function ensureValveCount(
	furnishers: RoomFurnisher[],
	target: number,
	rng: SeededRandom,
): void {
	let count = furnishers.reduce(
		(sum, furnisher) => sum + furnisher.valves.length,
		0,
	);
	const candidates = rng.shuffle(
		furnishers.filter(
			(furnisher) =>
				furnisher.valves.length === 0 &&
				furnisher.room.type !== "stairwell" &&
				furnisher.room.type !== "closet" &&
				furnisher.room.type !== "toilets" &&
				furnisher.room.type !== "greenhouse",
		),
	);
	for (const furnisher of candidates) {
		if (count >= target) {
			return;
		}
		if (furnisher.wallItem("valveStation")) {
			count += 1;
		}
	}
}

function ensureHidingSpots(
	furnishers: RoomFurnisher[],
	target: number,
	rng: SeededRandom,
): void {
	let count = furnishers.reduce(
		(sum, furnisher) => sum + furnisher.hideSpots.length,
		0,
	);
	const preferred = rng.shuffle(
		furnishers.filter((furnisher) =>
			HIDE_TOP_UP_TYPES.includes(furnisher.room.type),
		),
	);
	const fallback = rng.shuffle(
		furnishers.filter(
			(furnisher) =>
				!HIDE_TOP_UP_TYPES.includes(furnisher.room.type) &&
				HIDE_FALLBACK_TYPES.includes(furnisher.room.type),
		),
	);
	for (let pass = 0; pass < 4 && count < target; pass += 1) {
		for (const furnisher of pass < 2
			? preferred
			: [...preferred, ...fallback]) {
			if (count >= target) {
				return;
			}
			const before = furnisher.hideSpots.length;
			topUpHidingSpots(furnisher);
			count += furnisher.hideSpots.length - before;
		}
	}
}

function collect(furnishers: RoomFurnisher[]): FurnishResult {
	const furniture = furnishers.flatMap((furnisher) => furnisher.items);
	const hideSpots = furnishers.flatMap((furnisher) => furnisher.hideSpots);
	const valves = furnishers.flatMap((furnisher) => furnisher.valves);
	const lights = furnishers.flatMap((furnisher) => furnisher.lights);

	const furnitureIds = new Map(
		furniture.map((item, index) => [item.id, index]),
	);
	const hideIds = new Map(hideSpots.map((spot, index) => [spot.id, index]));
	const valveIds = new Map(valves.map((valve, index) => [valve.id, index]));

	return {
		furniture: furniture.map((item, index) => ({
			...item,
			id: index,
			parentId:
				item.parentId === null
					? null
					: (furnitureIds.get(item.parentId) ?? null),
			hideSpotId:
				item.hideSpotId === null
					? null
					: (hideIds.get(item.hideSpotId) ?? null),
			valveId:
				item.valveId === null ? null : (valveIds.get(item.valveId) ?? null),
		})),
		hideSpots: hideSpots.map((spot, index) => ({
			...spot,
			id: index,
			furnitureId: furnitureIds.get(spot.furnitureId) ?? spot.furnitureId,
		})),
		valves: valves.map((valve, index) => ({
			...valve,
			id: index,
			furnitureId: furnitureIds.get(valve.furnitureId) ?? valve.furnitureId,
		})),
		lights: lights.map((light, index) => ({
			...light,
			id: index,
			furnitureId:
				light.furnitureId === null
					? null
					: (furnitureIds.get(light.furnitureId) ?? null),
		})),
	};
}
