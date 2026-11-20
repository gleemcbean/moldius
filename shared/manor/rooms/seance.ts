import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import { SMALL_ROOM_AREA } from "../furnish/smallRoomBalance.js";
import type { RoomBlueprint } from "./blueprint.js";
import { placeChairs, placeRug, sideTables } from "./kit/placements.js";

const SEANCE_DECOR = [
	["candle", 3],
	["crystalBall", 1],
	["skull", 1],
	["stuffedRaven", 1],
	["hourglass", 1],
] as const;

function furnishSeance(furnisher: RoomFurnisher): void {
	const room = furnisher.room;

	const table =
		furnisher.floorItem("table", {
			variant: 2,
			at: room.labelPoint,
			rotation: room.axisAngle,
			wallMargin: 1.15,
		}) ?? furnisher.floorItem("table", { variant: 2, wallMargin: 1.15 });

	if (table) {
		placeChairs(furnisher, table, 4);
		placeRug(furnisher, { x: table.x, z: table.z }, table.rotation, 2);
		furnisher.surfaceItem(table, "crystalBall", 0, 0);

		for (const side of [-1, 1]) {
			furnisher.surfaceItem(table, "candle", side * 0.27, side * 0.2);
		}
	} else {
		const cabinet = furnisher.wallItem("cabinet");

		if (cabinet) {
			furnisher.surfaceItem(cabinet, "crystalBall", 0, 0);
		}
	}

	const roomy = room.area >= SMALL_ROOM_AREA;

	furnisher.wallItemsBetween("curtainAlcove", 1, roomy ? 2 : 1);

	furnisher
		.wallItemsBetween("cabinet", 0, 1)
		.forEach(
			(cabinet) => void furnisher.decorateSurface(cabinet, SEANCE_DECOR, 2, 3),
		);

	furnisher.floorItemsBetween("candelabra", 1, roomy ? 2 : 1, {
		wallMargin: 0.5,
	});

	furnisher.floorItemsBetween("floorCandles", 1, 3, { wallMargin: 0.4 });

	if (roomy) {
		furnisher.wallItemsBetween("bookcase", 0, 1);
		furnisher.floorItemsBetween("screen", 0, 1, { wallMargin: 0.4 });
		furnisher.floorItemsBetween("armchair", 0, 1, { wallMargin: 0.6 });
		furnisher.floorItemsBetween("gramophone", 0, 1, { wallMargin: 0.4 });
	}

	furnisher.wallDecorBetween("ovalPortrait", 1, 3);
	furnisher.wallDecorBetween("mirror", 0, 1);
	furnisher.wallDecorBetween("tapestry", 0, 1);
	furnisher.wallDecorBetween("sconce", 0, 1);
	furnisher.cobwebs(2, 3);
	furnisher.hangingCobwebs(1);
}

function addSeanceExtras(furnisher: RoomFurnisher): void {
	if (furnisher.room.area < SMALL_ROOM_AREA) {
		return;
	}

	furnisher.wallItemsBetween("throne", 0, 1);
	furnisher.floorItemsBetween("chaiseLongue", 0, 1, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("urn", 0, 1, { wallMargin: 0.4 });
	sideTables(furnisher, 0, 1);

	if (furnisher.rng.chance(0.3)) {
		furnisher.floorItem("floatingCrystal", { wallMargin: 0.9 });
	}
}

export const seanceRoom: RoomBlueprint = {
	catalog: {
		names: ["Salon de spiritisme", "Salle des séances", "Cabinet du médium"],
		width: [5, 7.5],
		depth: [5, 7.5],
		heightGround: [3.1, 3.6],
		heightUpper: [2.8, 3.2],
		shapes: [
			["octagon", 2],
			["heptagon", 1.2],
			["rect", 1],
		],
		floors: ["redCarpet", "parquet", "darkPlanks"],
		walls: ["wallpaperPurple", "wallpaperRed", "woodPanels", "wallpaperFleur"],
		ceilings: ["plaster", "coffered"],
		wainscotChance: 0.7,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Séance Parlour", "Séance Room", "Medium's Cabinet"],
	mapTint: "occult",
	spawnWeight: { ground: 0.9, upper: 0.9 },
	furnish: furnishSeance,
	extras: addSeanceExtras,
	fillers: [
		["candelabra", "floor"],
		["armchair", "floor"],
		["screen", "floor"],
		["urn", "floor"],
		["curtainAlcove", "wall"],
	],
	hidingSpots: ["curtainAlcove", "wardrobe"],
};
