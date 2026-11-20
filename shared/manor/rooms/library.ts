import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { TABLE_DECOR } from "./kit/decorSets.js";
import {
	chandeliers,
	randomRugs,
	sideTables,
	tableSet,
	windowsFor,
} from "./kit/placements.js";

function furnishLibrary(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1], 3.4);
	furnisher.wallItemsBetween("bookcase", 4, 9);
	furnisher.wallItemsBetween("wardrobe", 0, 1);
	furnisher.wallItemsBetween("curtainAlcove", 0, 1);
	furnisher.wallItemsBetween("grandfatherClock", 0, 1);

	tableSet(furnisher, {
		variants: [0, 1],
		chairs: [2, 4],
		decor: TABLE_DECOR,
		rug: true,
	});

	tableSet(furnisher, { variants: [2], chairs: [1, 2], decor: TABLE_DECOR });
	furnisher.floorItemsBetween("armchair", 1, 2, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("globe", 0, 1, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("chessTable", 0, 1, { wallMargin: 0.7 });
	furnisher.floorItemsBetween("lectern", 1, 1, { wallMargin: 0.7 });
	furnisher.floorItemsBetween("candelabra", 1, 2, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("bookPile", 1, 3, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("painting", 0, 2);
	furnisher.wallDecorBetween("starChart", 0, 1);
	furnisher.wallDecorBetween("sconce", 1, 2);
	randomRugs(furnisher, 0, 1);
	chandeliers(furnisher, 2);
	furnisher.cobwebs(2, 4);
}

function addLibraryExtras(furnisher: RoomFurnisher): void {
	sideTables(furnisher, 0, 1);
	furnisher.wallItemsBetween("secretary", 0, 1);
	furnisher.wallDecorBetween("oldMap", 0, 1);

	if (furnisher.rng.chance(0.35)) {
		furnisher.floorItem("floatingBooks", { wallMargin: 0.8 });
	}
}

export const libraryRoom: RoomBlueprint = {
	catalog: {
		names: ["Bibliothèque", "Bibliothèque interdite"],
		width: [7, 10.5],
		depth: [6.5, 9.5],
		heightGround: [3.5, 4.0],
		heightUpper: [3.0, 3.4],
		tall: { chance: 0.3, height: [5.2, 5.9] },
		shapes: [
			["rect", 1.5],
			["octagon", 1.5],
			["heptagon", 1],
			["lshape", 1],
		],
		floors: ["parquet", "darkPlanks"],
		walls: ["woodPanels", "wallpaperGreen", "wallpaperTrellis"],
		ceilings: ["coffered", "beams"],
		wainscotChance: 0.9,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Library", "Forbidden Library"],
	mapTint: "occult",
	spawnWeight: { upper: 0.8 },
	furnish: furnishLibrary,
	extras: addLibraryExtras,
	fillers: [
		["bookcase", "wall"],
		["armchair", "floor"],
		["globe", "floor"],
		["lectern", "floor"],
		["candelabra", "floor"],
	],
	hidingSpots: ["curtainAlcove", "wardrobe"],
};
