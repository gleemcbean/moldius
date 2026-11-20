import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { TABLE_DECOR } from "./kit/decorSets.js";
import {
	chandeliers,
	randomRugs,
	sideBySideCandles,
	tableSet,
	windowsFor,
} from "./kit/placements.js";

function furnishHall(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1]);
	furnisher.wallItemsBetween("fireplace", 0, 1);
	furnisher.wallItemsBetween("wardrobe", 0, 1);
	furnisher.wallItemsBetween("curtainAlcove", 0, 1);
	sideBySideCandles(furnisher, furnisher.wallItem("cabinet"), 1, 3);
	furnisher.wallItemsBetween("grandfatherClock", 0, 1);
	furnisher.wallItemsBetween("armor", 0, 2);
	furnisher.floorItemsBetween("pillar", 0, 2, { wallMargin: 1.6 });
	furnisher.floorItemsBetween("statue", 0, 1, { wallMargin: 1.0 });
	furnisher.floorItemsBetween("coatRack", 0, 1, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("shieldDisplay", 0, 1);

	tableSet(furnisher, {
		variants: [2],
		chairs: [0, 2],
		decor: TABLE_DECOR,
		rug: true,
	});

	furnisher.floorItemsBetween("pottedPlant", 1, 3, { wallMargin: 0.45 });
	furnisher.floorItemsBetween("bench", 0, 1, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("candelabra", 0, 2, { wallMargin: 0.6 });
	furnisher.wallDecorBetween("painting", 2, 4);
	furnisher.wallDecorBetween("sconce", 1, 3);
	furnisher.wallDecorBetween("mirror", 0, 1);
	randomRugs(furnisher, 0, 1);
	chandeliers(furnisher, 2);
	furnisher.cobwebs(1, 3);
}

function addHallExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("umbrellaStand", 0, 1, { wallMargin: 0.25 });
	furnisher.floorItemsBetween("bust", 0, 1, { wallMargin: 0.6 });
	furnisher.wallItemsBetween("throne", 0, 1);
	furnisher.wallDecorBetween("wallClock", 0, 1);
	furnisher.wallDecorBetween("ovalPortrait", 0, 1);
}

export const hallRoom: RoomBlueprint = {
	catalog: {
		names: ["Grand hall", "Vestibule", "Hall des échos", "Rotonde"],
		width: [8, 12],
		depth: [7, 10.5],
		heightGround: [3.6, 4.0],
		heightUpper: [3.0, 3.4],
		tall: { chance: 0.3, height: [5.3, 6.0] },
		shapes: [
			["rect", 2],
			["octagon", 2],
			["heptagon", 1],
			["lshape", 1.2],
		],
		floors: ["stoneFlags", "checkerTiles", "parquet"],
		walls: [
			"wallpaperGreen",
			"wallpaperRed",
			"woodPanels",
			"stoneBlocks",
			"wallpaperFleur",
			"wallpaperTrellis",
		],
		ceilings: ["coffered", "beams", "vault"],
		wainscotChance: 0.6,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: false,
	},
	englishNames: ["Great Hall", "Vestibule", "Hall of Echoes", "Rotunda"],
	mapTint: "reception",
	furnish: furnishHall,
	extras: addHallExtras,
	fillers: [
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
	hidingSpots: ["curtainAlcove", "wardrobe"],
};
