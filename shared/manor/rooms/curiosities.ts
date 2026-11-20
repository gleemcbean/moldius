import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import {
	ceilingBetween,
	chandeliers,
	tableSet,
	windowsFor,
} from "./kit/placements.js";

const CURIO_DECOR = [
	["bellJar", 4],
	["skull", 2],
	["jar", 2],
	["candle", 2],
	["stuffedRaven", 2],
	["crystalBall", 1],
	["hourglass", 1],
	["fungusJar", 2],
] as const;

function furnishCuriosities(furnisher: RoomFurnisher): void {
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

function addCuriositiesExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("bust", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("urn", 0, 1, { wallMargin: 0.4 });
	ceilingBetween(furnisher, "hangingCage", 0, 1);
	furnisher.wallDecorBetween("antlers", 0, 1);
}

export const curiositiesRoom: RoomBlueprint = {
	catalog: {
		names: ["Cabinet de curiosités", "Salle des trophées"],
		width: [6, 8.5],
		depth: [5.5, 7.5],
		heightGround: [3.2, 3.7],
		heightUpper: [2.9, 3.2],
		shapes: [
			["rect", 2],
			["heptagon", 1],
			["lshape", 0.8],
		],
		floors: ["parquet", "checkerTiles", "darkPlanks"],
		walls: [
			"wallpaperGreen",
			"wallpaperOchre",
			"woodPanels",
			"wallpaperTrellis",
		],
		ceilings: ["coffered", "beams"],
		wainscotChance: 0.7,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Cabinet of Curiosities", "Trophy Room"],
	mapTint: "occult",
	spawnWeight: { ground: 1.2, upper: 0.8 },
	furnish: furnishCuriosities,
	extras: addCuriositiesExtras,
	fillers: [
		["statue", "floor"],
		["globe", "floor"],
		["sheetedFurniture", "floor"],
		["displayCase", "wall"],
		["armor", "wall"],
	],
};
