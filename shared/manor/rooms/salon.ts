import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { TABLE_DECOR } from "./kit/decorSets.js";
import {
	chandeliers,
	ghostFurniture,
	randomRugs,
	sideBySideCandles,
	sideTables,
	tableSet,
	windowsFor,
} from "./kit/placements.js";

function furnishSalon(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1, 2]);
	furnisher.wallItemsBetween("fireplace", 0, 1);
	furnisher.wallItemsBetween("wardrobe", 0, 1);
	furnisher.wallItemsBetween("curtainAlcove", 0, 1);
	furnisher.wallItemsBetween("bookcase", 0, 1);
	sideBySideCandles(furnisher, furnisher.wallItem("cabinet"), 1, 2);
	furnisher.wallItemsBetween("uprightPiano", 0, 1);
	furnisher.floorItemsBetween("sofa", 1, 1, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("armchair", 1, 3, { wallMargin: 0.6 });

	tableSet(furnisher, {
		variants: [2],
		chairs: [0, 1],
		decor: TABLE_DECOR,
		rug: true,
	});

	furnisher.floorItemsBetween("floorLamp", 1, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("pottedPlant", 0, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("birdcage", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("gramophone", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("chessTable", 0, 1, { wallMargin: 0.7 });
	ghostFurniture(furnisher, 0, 2);
	furnisher.wallDecorBetween("painting", 1, 3);
	furnisher.wallDecorBetween("mirror", 0, 1);
	furnisher.wallDecorBetween("trophyHead", 0, 1);
	randomRugs(furnisher, 0, 1);
	chandeliers(furnisher, 1);
	furnisher.cobwebs(1, 2);
}

function addSalonExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("chaiseLongue", 0, 1, { wallMargin: 0.7 });
	furnisher.floorItemsBetween("ottoman", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("screen", 0, 1, { wallMargin: 0.4 });
	sideTables(furnisher, 0, 1);
	furnisher.wallItemsBetween("secretary", 0, 1);
	furnisher.wallDecorBetween("ovalPortrait", 0, 2);
	furnisher.wallDecorBetween("wallClock", 0, 1);
}

export const salonRoom: RoomBlueprint = {
	catalog: {
		names: ["Salon", "Petit salon", "Fumoir", "Boudoir"],
		width: [5.5, 8.5],
		depth: [5, 7.5],
		heightGround: [3.1, 3.7],
		heightUpper: [2.8, 3.2],
		shapes: [
			["rect", 2],
			["heptagon", 0.8],
			["lshape", 0.8],
		],
		floors: ["parquet", "oakPlanks", "redCarpet"],
		walls: [
			"wallpaperRed",
			"wallpaperBlue",
			"wallpaperOchre",
			"wallpaperPurple",
			"wallpaperFloral",
			"wallpaperStripes",
		],
		ceilings: ["plaster", "coffered"],
		wainscotChance: 0.7,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: false,
	},
	englishNames: ["Drawing Room", "Parlour", "Smoking Room", "Boudoir"],
	mapTint: "reception",
	furnish: furnishSalon,
	extras: addSalonExtras,
	hidingSpots: ["curtainAlcove", "wardrobe"],
};
