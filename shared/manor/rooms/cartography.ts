import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import {
	chandeliers,
	sideTables,
	tableSet,
	windowsFor,
} from "./kit/placements.js";

const MAP_DECOR = [
	["scrolls", 4],
	["openBook", 2],
	["inkwell", 2],
	["hourglass", 1],
	["candle", 2],
	["oilLamp", 1],
] as const;

function furnishCartography(furnisher: RoomFurnisher): void {
	const room = furnisher.room;

	windowsFor(furnisher, [0, 1]);

	tableSet(furnisher, {
		variants: [1, 3],
		chairs: [1, 3],
		decor: MAP_DECOR,
		at: room.labelPoint,
		rotation: room.axisAngle,
		rug: true,
	}) ??
		tableSet(furnisher, {
			variants: [0, 1],
			chairs: [1, 2],
			decor: MAP_DECOR,
			rug: true,
		});

	furnisher.floorItemsBetween("globe", 1, 2, { wallMargin: 0.6 });
	furnisher.wallItemsBetween("bookcase", 1, 2);
	furnisher.wallItemsBetween("trunk", 1, 2);
	furnisher.wallItemsBetween("displayCase", 0, 1);
	furnisher.wallItemsBetween("fileCabinet", 0, 1);
	furnisher.floorItemsBetween("lectern", 0, 1, { wallMargin: 0.7 });
	furnisher.floorItemsBetween("coatRack", 0, 1, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("bookPile", 0, 2, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("oldMap", 3, 5);
	furnisher.wallDecorBetween("starChart", 0, 1);
	furnisher.wallDecorBetween("barometer", 0, 1);
	furnisher.wallDecorBetween("sconce", 1, 2);
	chandeliers(furnisher, 1);
	furnisher.cobwebs(1, 3);
}

function addCartographyExtras(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("secretary", 0, 1);
	furnisher.wallDecorBetween("trophyHead", 0, 1);
	furnisher.wallDecorBetween("wallClock", 0, 1);
	sideTables(furnisher, 0, 1);
}

export const cartographyRoom: RoomBlueprint = {
	catalog: {
		names: ["Salle des cartes", "Cabinet du cartographe", "Salle des voyages"],
		width: [6, 8.5],
		depth: [5.5, 7.5],
		heightGround: [3.3, 3.8],
		heightUpper: [2.9, 3.3],
		shapes: [
			["rect", 2],
			["heptagon", 1],
			["octagon", 0.8],
		],
		floors: ["parquet", "darkPlanks", "oakPlanks"],
		walls: [
			"woodPanels",
			"wallpaperGreen",
			"wallpaperOchre",
			"wallpaperTrellis",
		],
		ceilings: ["coffered", "beams"],
		wainscotChance: 0.8,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Map Room", "Cartographer's Study", "Travellers' Room"],
	mapTint: "occult",
	spawnWeight: { ground: 0.8, upper: 0.8 },
	furnish: furnishCartography,
	extras: addCartographyExtras,
	fillers: [
		["globe", "floor"],
		["lectern", "floor"],
		["armchair", "floor"],
		["bookcase", "wall"],
		["trunk", "wall"],
		["displayCase", "wall"],
	],
	hidingSpots: ["trunk", "wardrobe", "curtainAlcove"],
};
