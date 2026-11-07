import {
	DEFAULT_ITEMS_PER_PLAYER,
	MANOR_GRAND_ROOMS,
	MANOR_GROUND_ROOM_COUNT,
	MANOR_HALF_EXTENT,
	MANOR_LAYOUT_RETRIES,
	MANOR_LOOPS,
	MANOR_MIN_UPPER_ROOMS,
	MANOR_UPPER_LEVEL_SHARE,
	MANOR_UPPER_ROOM_COUNT,
	MANOR_WINDOWS,
	MAX_UPPER_FLOORS,
	STAKE_FURNITURE,
	STAKE_KINDS,
	stakeRoomCount,
} from "../config/index.js";
import type { MatchConfig } from "../matchConfig.js";
import { NavGrid } from "../navigation/navGrid.js";
import { CollisionWorld } from "../physics/collisionWorld.js";
import { hashNumbers, hashString, SeededRandom } from "../random.js";
import { furnishManor } from "./furnish/furnishManor.js";
import { placePickups, placeWalkies } from "./furnish/pickups.js";
import { isHanging, ManorLayoutBuilder } from "./layoutBuilder.js";
import { mergeBounds } from "./polygon.js";
import { ROOM_TYPES } from "./roomCatalog.js";
import type {
	FurnitureItem,
	Level,
	ManorLayout,
	Room,
	RoomType,
	StakeRoom,
} from "./types.js";

export type ManorOptions = Pick<
	MatchConfig,
	"manorSize" | "roomTypes" | "floors" | "upperFloorSize" | "stairCount"
> & {
	pickupTotal?: number;
	walkies?: boolean;
};

const TOP_UP_TYPES: RoomType[] = [
	"corridor",
	"bedroom",
	"corridor",
	"salon",
	"closet",
	"toilets",
];

const GROUND_CORE: RoomType[] = [
	"library",
	"kitchen",
	"cellar",
	"dining",
	"toilets",
	"closet",
];

const GROUND_EXTRA: readonly (readonly [RoomType, number])[] = [
	["greenhouse", 1.5],
	["chapel", 1.2],
	["alchemy", 1.2],
	["curiosities", 1.2],
	["crypt", 1.1],
	["laundry", 1],
	["workshop", 0.9],
	["bathroom", 0.9],
	["bedroom", 0.9],
	["music", 0.9],
	["ritual", 0.9],
	["study", 0.9],
	["nursery", 0.6],
	["ballroom", 1],
	["billiard", 1],
	["armory", 0.9],
	["undercroft", 0.9],
	["theater", 0.8],
	["dungeon", 1.4],
	["pond", 1.4],
];

const UPPER_CORE: RoomType[] = ["bedroom", "toilets"];

const UPPER_EXTRA: readonly (readonly [RoomType, number])[] = [
	["bedroom", 1.2],
	["nursery", 1.2],
	["observatory", 1.2],
	["study", 1],
	["bathroom", 1],
	["closet", 1],
	["ritual", 0.9],
	["music", 0.9],
	["alchemy", 0.8],
	["library", 0.8],
	["curiosities", 0.8],
	["laundry", 0.7],
	["greenhouse", 0.7],
	["billiard", 0.8],
	["armory", 0.7],
	["ballroom", 0.6],
	["theater", 0.5],
];

const GRAND_ROOM_TYPES: RoomType[] = [
	"library",
	"ballroom",
	"hall",
	"dining",
	"salon",
	"gallery",
];

const MEZZANINE_ROOM_TYPES: RoomType[] = [
	"study",
	"closet",
	"bathroom",
	"toilets",
	"nursery",
	"bedroom",
];

const GENERIC_GROUND: RoomType[] = ["hall", "salon", "gallery", "bedroom"];
const GENERIC_UPPER: RoomType[] = ["salon", "gallery", "bedroom", "hall"];

export function generateManor(
	seed: number,
	options: ManorOptions,
): ManorLayout {
	let rng = new SeededRandom(seed);
	let builder = buildRooms(rng, options);
	for (
		let attempt = 1;
		attempt <= MANOR_LAYOUT_RETRIES &&
		(hasSparseFloor(builder) || isMissingStakeRoom(builder, options));
		attempt += 1
	) {
		rng = new SeededRandom(hashNumbers(seed, attempt));
		builder = buildRooms(rng, options);
	}

	const placedLevels = [
		...new Set(builder.rooms.map((room) => room.level)),
	].sort((first, second) => first - second);
	for (const level of placedLevels) {
		builder.addWindows(
			level,
			level === 0
				? MANOR_WINDOWS[options.manorSize]
				: Math.ceil(MANOR_WINDOWS[options.upperFloorSize] / 2),
			rng.fork(`windows-${level}`),
		);
	}
	builder.computeExteriorEdges();
	const { rooms, openings } = builder.compact();
	const furnished = furnishManor(rooms, openings, rng.fork("furniture"));
	const bounds = rooms
		.map((room) => room.bounds)
		.reduce((all, current) => mergeBounds(all, current));
	const levels = [
		...new Set(
			rooms.flatMap((room) =>
				room.type === "stairwell" || room.mezzanine
					? [room.level, room.level + 1]
					: [room.level],
			),
		),
	].sort((first, second) => first - second) as Level[];
	return withoutCutOffHideSpots({
		seed,
		rooms,
		openings,
		furniture: furnished.furniture,
		hideSpots: furnished.hideSpots,
		lights: furnished.lights,
		valves: furnished.valves,
		pickups: placePickups(
			rooms,
			furnished.furniture,
			rng.fork("pickups"),
			options.pickupTotal ?? DEFAULT_ITEMS_PER_PLAYER * 2,
		),
		altars: furnished.furniture
			.filter((item) => item.kind === "occultAltar")
			.map((item, id) => ({
				id,
				furnitureId: item.id,
				roomId: item.roomId,
				level: item.level,
				x: item.x,
				y: item.y,
				z: item.z,
			})),
		walkies:
			(options.walkies ?? true)
				? placeWalkies(rooms, furnished.furniture, rng.fork("walkies"))
				: [],
		stakes: stakeRoomsOf(furnished.furniture),
		bounds,
		levels,
	});
}

function stakeRoomsOf(furniture: FurnitureItem[]): StakeRoom[] {
	return furniture
		.flatMap((item) => {
			const kind = STAKE_KINDS.find(
				(candidate) => STAKE_FURNITURE[candidate] === item.kind,
			);
			return kind
				? [
						{
							kind,
							furnitureId: item.id,
							roomId: item.roomId,
							level: item.level,
							x: item.x,
							y: item.y,
							z: item.z,
						},
					]
				: [];
		})
		.map((stake, id) => ({ id, ...stake }));
}

function withoutCutOffHideSpots(layout: ManorLayout): ManorLayout {
	const grid = new NavGrid(new CollisionWorld(layout));
	const reachable = new Set(
		layout.hideSpots
			.filter((spot) => {
				const node = grid.nearestNode(
					{
						x: spot.entry.x,
						y: layout.furniture[spot.furnitureId].y,
						z: spot.entry.z,
					},
					2,
				);
				return node !== null;
			})
			.map((spot) => spot.id),
	);
	if (reachable.size === layout.hideSpots.length) {
		return layout;
	}
	const hideSpots = layout.hideSpots.filter((spot) => reachable.has(spot.id));
	const ids = new Map(hideSpots.map((spot, index) => [spot.id, index]));
	return {
		...layout,
		hideSpots: hideSpots.map((spot, index) => ({ ...spot, id: index })),
		furniture: layout.furniture.map((item) => ({
			...item,
			hideSpotId:
				item.hideSpotId === null ? null : (ids.get(item.hideSpotId) ?? null),
		})),
	};
}

function buildRooms(
	rng: SeededRandom,
	options: ManorOptions,
): ManorLayoutBuilder {
	const builder = new ManorLayoutBuilder(
		rng.fork("layout"),
		MANOR_HALF_EXTENT[options.manorSize],
	);
	const plan = planRooms(rng.fork("plan"), options);

	builder.createFirstRoom("hall");
	if (options.floors > 0) {
		placeGrandRooms(builder, rng.fork("grand"), options);
	}
	placeLevel(builder, rng.fork("ground"), plan.ground, 0);
	builder.addLoops(0, MANOR_LOOPS[options.manorSize]);

	for (const [index, upperPlan] of plan.upper.entries()) {
		const level = (index + 1) as Level;
		const suffix = index === 0 ? "" : `-${level}`;
		const stairwells = placeStairwells(
			builder,
			rng.fork(`stairs${suffix}`),
			options.stairCount,
			(level - 1) as Level,
		);
		if (stairwells.length === 0) {
			break;
		}
		placeLevel(builder, rng.fork(`upper${suffix}`), upperPlan, level);
		topUpLevel(builder, rng.fork(`topup${suffix}`), level, options);
		builder.addLoops(
			level,
			Math.max(1, Math.floor(MANOR_LOOPS[options.manorSize] / 2)),
		);
	}
	return builder;
}

function placeGrandRooms(
	builder: ManorLayoutBuilder,
	rng: SeededRandom,
	options: ManorOptions,
): void {
	const allowed = new Set(options.roomTypes);
	const usable = (type: RoomType) =>
		!ROOM_TYPES[type].optional || allowed.has(type);
	const types = rng.shuffle(GRAND_ROOM_TYPES.filter(usable));
	const smallRooms = MEZZANINE_ROOM_TYPES.filter(
		(type) => usable(type) && ROOM_TYPES[type].allowUpper,
	);
	for (
		let index = 0;
		index < MANOR_GRAND_ROOMS[options.manorSize];
		index += 1
	) {
		const type = types[index % types.length];
		if (!type) {
			return;
		}
		const parents = builder.rooms.filter(
			(room) =>
				room.area > 0 && room.level === 0 && !ROOM_TYPES[room.type].singleDoor,
		);
		for (let attempt = 0; attempt < 10; attempt += 1) {
			const room = builder.tryAttachGrandRoom(rng.pick(parents), type);
			if (room) {
				placeMezzanineRooms(
					builder,
					rng.fork(`rooms-${index}`),
					room,
					smallRooms,
				);
				break;
			}
		}
	}
}

function placeMezzanineRooms(
	builder: ManorLayoutBuilder,
	rng: SeededRandom,
	grandRoom: Room,
	types: RoomType[],
): void {
	const target = rng.int(2, 3);
	let placed = 0;
	for (const type of [...rng.shuffle(types), ...rng.shuffle(types)]) {
		if (placed >= target) {
			return;
		}
		if (builder.tryAttachRoom(grandRoom, type, 1, 10)) {
			placed += 1;
		}
	}
}

function enabledStakeRooms(options: ManorOptions): RoomType[] {
	return STAKE_KINDS.filter((kind) => options.roomTypes.includes(kind));
}

function isMissingStakeRoom(
	builder: ManorLayoutBuilder,
	options: ManorOptions,
): boolean {
	return enabledStakeRooms(options).some(
		(type) => !builder.rooms.some((room) => room.type === type),
	);
}

/** Chaque enjeu autorisé une fois, puis davantage dans les grands manoirs. */
function planStakeRooms(options: ManorOptions, rooms: number): RoomType[] {
	const enabled = enabledStakeRooms(options);
	const count = Math.min(enabled.length * 2, stakeRoomCount(rooms));
	return Array.from(
		{ length: enabled.length === 0 ? 0 : Math.max(count, enabled.length) },
		(_, index) => enabled[index % enabled.length],
	);
}

function hasSparseFloor(builder: ManorLayoutBuilder): boolean {
	const counts = new Map<number, number>();
	for (const room of builder.rooms) {
		if (room.level > 0 && room.type !== "stairwell") {
			counts.set(room.level, (counts.get(room.level) ?? 0) + 1);
		}
	}
	return [...counts.values()].some((count) => count < MANOR_MIN_UPPER_ROOMS);
}

interface RoomPlan {
	ground: RoomType[];
	upper: RoomType[][];
}

function planRooms(rng: SeededRandom, options: ManorOptions): RoomPlan {
	const allowed = new Set(options.roomTypes);
	const groundCount = MANOR_GROUND_ROOM_COUNT[options.manorSize] - 1;
	const floors = Math.max(0, Math.min(MAX_UPPER_FLOORS, options.floors));
	const permitted = (type: RoomType, level: Level) => {
		const definition = ROOM_TYPES[type];
		const levelAllowed =
			level === 0 ? definition.allowGround : definition.allowUpper;
		return levelAllowed && (!definition.optional || allowed.has(type));
	};

	const stakeRooms = planStakeRooms(
		options,
		groundCount + floors * MANOR_UPPER_ROOM_COUNT[options.upperFloorSize],
	);
	const upperStakes = floors > 0 ? stakeRooms.splice(STAKE_KINDS.length) : [];
	const ground = pickThemed(
		rng,
		GROUND_CORE.filter((type) => permitted(type, 0)),
		GROUND_EXTRA.filter(([type]) => permitted(type, 0)),
		Math.round(groundCount * 0.55) - stakeRooms.length,
		() => true,
	);
	ground.push(...stakeRooms);
	fillWithGeneric(rng, ground, groundCount, GENERIC_GROUND, allowed, 0.36);

	const upper: RoomType[][] = [];
	const used = new Set(ground);
	for (let level = 1; level <= floors; level += 1) {
		const count = Math.max(
			3,
			Math.round(
				MANOR_UPPER_ROOM_COUNT[options.upperFloorSize] *
					MANOR_UPPER_LEVEL_SHARE[level - 1],
			),
		);
		const top = level === floors;
		const extras = UPPER_EXTRA.filter(([type]) =>
			permitted(type, level as Level),
		).map(([type, weight]) =>
			type === "attic"
				? ([type, top ? 2.2 : 0.3] as const)
				: ([type, weight] as const),
		);
		if (
			permitted("attic", level as Level) &&
			!extras.some(([type]) => type === "attic")
		) {
			extras.push(["attic", top ? 2.2 : 0.3]);
		}
		const plan = pickThemed(
			rng,
			UPPER_CORE.filter((type) => permitted(type, level as Level)),
			extras,
			Math.ceil(count * 0.6),
			(type) =>
				["bedroom", "toilets", "closet", "bathroom", "attic"].includes(type) ||
				!used.has(type) ||
				rng.chance(0.4),
		);
		if (level === 1) {
			plan.push(...upperStakes);
		}
		fillWithGeneric(rng, plan, count, GENERIC_UPPER, allowed, 0.32);
		for (const type of plan) {
			used.add(type);
		}
		upper.push(interleave(rng, plan));
	}
	return { ground: interleave(rng, ground), upper };
}

function pickThemed(
	rng: SeededRandom,
	core: RoomType[],
	extras: readonly (readonly [RoomType, number])[],
	budget: number,
	accept: (type: RoomType) => boolean,
): RoomType[] {
	const chosen = core.slice(0, budget);
	const pool = [...extras];
	while (chosen.length < budget && pool.length > 0) {
		const type = rng.weighted(pool);
		pool.splice(
			pool.findIndex(([candidate]) => candidate === type),
			1,
		);
		if (accept(type)) {
			chosen.push(type);
		}
	}
	return chosen;
}

function fillWithGeneric(
	rng: SeededRandom,
	list: RoomType[],
	target: number,
	generic: RoomType[],
	allowed: Set<RoomType>,
	corridorShare: number,
): void {
	const corridorTarget = Math.round(target * corridorShare);
	let corridors = 0;
	while (list.length < target) {
		if (corridors < corridorTarget) {
			list.push("corridor");
			corridors += 1;
			continue;
		}
		const options = generic.filter(
			(type) => !ROOM_TYPES[type].optional || allowed.has(type),
		);
		list.push(rng.pick(options));
	}
}

function interleave(rng: SeededRandom, types: RoomType[]): RoomType[] {
	const corridors = types.filter((type) => type === "corridor");
	const others = rng.shuffle(types.filter((type) => type !== "corridor"));
	const leaves = others.filter((type) => ROOM_TYPES[type].singleDoor);
	const regular = others.filter((type) => !ROOM_TYPES[type].singleDoor);
	const result: RoomType[] = [];
	while (corridors.length > 0 || regular.length > 0) {
		if (
			corridors.length > 0 &&
			(result.length % 2 === 0 || regular.length === 0)
		) {
			result.push(corridors.shift() as RoomType);
		} else if (regular.length > 0) {
			result.push(regular.shift() as RoomType);
		}
	}
	const insertAt = Math.max(2, Math.floor(result.length / 3));
	result.splice(insertAt, 0, ...leaves);
	return result;
}

function placeLevel(
	builder: ManorLayoutBuilder,
	rng: SeededRandom,
	plan: RoomType[],
	level: Level,
): void {
	const pending = [...plan];
	const deferred: RoomType[] = [];
	for (const type of pending) {
		if (!attachSomewhere(builder, rng, type, level)) {
			deferred.push(type);
		}
	}
	for (const type of deferred) {
		attachSomewhere(builder, rng, type, level) ||
			attachSomewhere(builder, rng, "corridor", level);
	}
}

function topUpLevel(
	builder: ManorLayoutBuilder,
	rng: SeededRandom,
	level: Level,
	options: ManorOptions,
): void {
	const allowed = new Set(options.roomTypes);
	const types = TOP_UP_TYPES.filter((type) => {
		const definition = ROOM_TYPES[type];
		return definition.allowUpper && (!definition.optional || allowed.has(type));
	});
	const count = () =>
		builder.rooms.filter(
			(room) => room.level === level && room.type !== "stairwell",
		).length;
	for (
		let attempt = 0;
		attempt < 30 && count() < MANOR_MIN_UPPER_ROOMS;
		attempt += 1
	) {
		attachSomewhere(builder, rng, rng.pick(types), level);
	}
}

function attachSomewhere(
	builder: ManorLayoutBuilder,
	rng: SeededRandom,
	type: RoomType,
	level: Level,
): Room | null {
	const candidates = builder.rooms.filter(
		(room) =>
			room.area > 0 &&
			!ROOM_TYPES[room.type].singleDoor &&
			!isHanging(room) &&
			(room.level === level ||
				(room.type === "stairwell" && room.level === level - 1)),
	);
	if (candidates.length === 0) {
		return null;
	}
	const recent = new Set(candidates.slice(-3).map((room) => room.id));
	const leaf = ROOM_TYPES[type].singleDoor;
	for (let attempt = 0; attempt < 12; attempt += 1) {
		const parent = rng.weighted(
			candidates.map((room) => {
				let weight = 1;
				if (recent.has(room.id)) {
					weight *= 2.6;
				}
				if (room.type === "corridor" || room.type === "hall") {
					weight *= leaf ? 2.5 : 1.6;
				}
				if (type === "corridor" && room.type === "corridor") {
					weight *= 0.8;
				}
				if (room.openingIds.length >= 4) {
					weight *= 0.35;
				}
				if (room.type === "stairwell") {
					weight *= 3;
				}
				return [room, weight] as const;
			}),
		);
		const room = builder.tryAttachRoom(parent, type, level, 8);
		if (room) {
			return room;
		}
	}
	return null;
}

function placeStairwells(
	builder: ManorLayoutBuilder,
	rng: SeededRandom,
	count: number,
	fromLevel: Level,
): Room[] {
	const placed: Room[] = [];
	const preferred: RoomType[] = [
		"hall",
		"corridor",
		"gallery",
		"salon",
		"library",
		"dining",
		"billiard",
		"armory",
	];
	const levelRooms = builder.rooms.filter(
		(room) =>
			room.level === fromLevel &&
			room.area > 0 &&
			room.type !== "stairwell" &&
			!isHanging(room),
	);
	if (levelRooms.length === 0) {
		return placed;
	}
	const centroid = {
		x:
			levelRooms.reduce((sum, room) => sum + room.labelPoint.x, 0) /
			levelRooms.length,
		z:
			levelRooms.reduce((sum, room) => sum + room.labelPoint.z, 0) /
			levelRooms.length,
	};
	const preferredRooms = levelRooms.filter((room) =>
		preferred.includes(room.type),
	);
	const candidates = rng
		.shuffle(preferredRooms.length > 0 ? preferredRooms : levelRooms)
		.map((room) => ({
			room,
			score:
				Math.hypot(
					room.labelPoint.x - centroid.x,
					room.labelPoint.z - centroid.z,
				) * rng.range(0.7, 1.3),
		}))
		.sort((first, second) => first.score - second.score)
		.map(({ room }) => room);
	const landingLevel = (fromLevel + 1) as Level;
	for (const parent of candidates) {
		if (placed.length >= count) {
			break;
		}
		if (
			placed.some(
				(stair) =>
					Math.hypot(
						stair.labelPoint.x - parent.labelPoint.x,
						stair.labelPoint.z - parent.labelPoint.z,
					) < 14,
			)
		) {
			continue;
		}
		const stairwell = builder.tryAttachStairwell(parent);
		if (!stairwell) {
			continue;
		}
		const landing =
			builder.tryAttachRoom(
				stairwell,
				rng.pick(["corridor", "hall", "gallery"] as const),
				landingLevel,
				16,
			) ?? builder.tryAttachRoom(stairwell, "corridor", landingLevel, 16);
		if (!landing) {
			builder.removeRoom(stairwell);
			continue;
		}
		placed.push(stairwell);
	}
	return placed;
}

export function layoutChecksum(layout: ManorLayout): number {
	const parts: string[] = [];
	for (const room of layout.rooms) {
		parts.push(
			`${room.type}:${room.polygon.length}:${room.bounds.minX.toFixed(2)}:${room.bounds.maxZ.toFixed(2)}`,
		);
	}
	for (const opening of layout.openings) {
		parts.push(
			`${opening.roomA}-${opening.roomB}:${opening.start.x.toFixed(2)}:${opening.door ? 1 : 0}`,
		);
	}
	for (const item of layout.furniture) {
		parts.push(`${item.kind}:${item.x.toFixed(2)}:${item.z.toFixed(2)}`);
	}
	for (const pickup of layout.pickups) {
		parts.push(
			`${pickup.material}:${pickup.x.toFixed(2)}:${pickup.z.toFixed(2)}`,
		);
	}
	for (const walkie of layout.walkies) {
		parts.push(`walkie:${walkie.x.toFixed(2)}:${walkie.z.toFixed(2)}`);
	}
	return hashString(parts.join("|"));
}
