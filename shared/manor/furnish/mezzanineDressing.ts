import { DAIS_STEP_RISE, DAIS_STEP_RUN } from "../../config/index.js";
import { distance2, type Vec2 } from "../../math.js";
import { furnitureDefinition } from "../furnitureCatalog.js";
import { edgeDirection, edgeLength, pointInPolygon } from "../polygon.js";
import type { FurnitureItem, MezzanineSpec } from "../types.js";
import type { RoomFurnisher } from "./RoomFurnisher.js";

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

export function dressMezzanine(furnisher: RoomFurnisher): void {
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

const VINE_KINDS = ["ivyWall", "railVine", "climbingVine"];
const MIN_GRAND_VINES = 2;

function vineCount(furnisher: RoomFurnisher): number {
	return furnisher.items.filter((item) => VINE_KINDS.includes(item.kind))
		.length;
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

	const barePosts: Vec2[] = [];

	for (const post of spec.posts) {
		if (rng.chance(0.5)) {
			furnisher.wrapPost(
				"climbingVine",
				post,
				level - 0.35 + (rng.chance(0.35) ? 1 : 0),
			);
		} else {
			barePosts.push(post);
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

	for (const post of barePosts) {
		if (vineCount(furnisher) >= MIN_GRAND_VINES) {
			break;
		}

		furnisher.wrapPost("climbingVine", post, level - 0.35);
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

export function grandRoomReliefs(furnisher: RoomFurnisher): void {
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
