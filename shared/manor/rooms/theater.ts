import { normalize2, rotate2 } from "../../math.js";
import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { FurnitureItem } from "../types.js";
import type { RoomBlueprint } from "./blueprint.js";
import { chandeliers, distanceSquared, midpoint } from "./kit/placements.js";

function furnishTheater(furnisher: RoomFurnisher): void {
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

function addTheaterExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("screen", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("chaiseLongue", 0, 1, { wallMargin: 0.6 });
}

export const theaterRoom: RoomBlueprint = {
	catalog: {
		names: ["Petit théâtre", "Salle de spectacle", "Théâtre de marionnettes"],
		width: [8, 11],
		depth: [10, 13],
		heightGround: [5.3, 6.0],
		heightUpper: [5.1, 5.6],
		shapes: [
			["rect", 2],
			["apse", 1.4],
		],
		floors: ["redCarpet", "darkPlanks", "parquet"],
		walls: [
			"wallpaperRed",
			"wallpaperPurple",
			"woodPanels",
			"wallpaperStripes",
		],
		ceilings: ["coffered", "vault"],
		wainscotChance: 0.6,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Little Theatre", "Playhouse", "Puppet Theatre"],
	mapTint: "reception",
	spawnWeight: { ground: 0.8, upper: 0.5 },
	furnish: furnishTheater,
	extras: addTheaterExtras,
	hidingSpots: ["curtainAlcove", "wardrobe"],
};
