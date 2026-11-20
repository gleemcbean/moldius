import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { ghostFurniture, windowsFor } from "./kit/placements.js";

function furnishCollapsedWing(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 2], 3.2);
	furnisher.floorItemsBetween("fallenBeam", 1, 2, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("rubblePile", 2, 4, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("brokenColumn", 0, 2, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("floorDebris", 3, 6, { wallMargin: 0.3 });
	ghostFurniture(furnisher, 1, 2);
	furnisher.wallDecorBetween("wallRoots", 1, 2);
	furnisher.wallDecorBetween("painting", 0, 2);
	furnisher.floorItemsBetween("mushroomPatch", 1, 3, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("bracketFungus", 0, 2);
	furnisher.cobwebs(3, 6);
	furnisher.hangingCobwebs(furnisher.rng.int(1, 3));
}

function addCollapsedWingExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("crate", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("barrel", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("chair", 0, 1, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("ovalPortrait", 0, 1);
}

export const collapsedWingRoom: RoomBlueprint = {
	catalog: {
		names: ["Aile effondrée", "Salle en ruine", "Vestiges"],
		width: [6, 9.5],
		depth: [5.5, 9],
		heightGround: [3.2, 3.8],
		heightUpper: [2.9, 3.3],
		shapes: [
			["rect", 1.5],
			["lshape", 1.2],
			["heptagon", 0.8],
		],
		floors: ["darkPlanks", "stoneFlags", "cobble"],
		walls: ["rubbleStone", "plaster", "wallpaperFloral", "mossyBrick"],
		ceilings: ["beams", "planks"],
		wainscotChance: 0.3,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Collapsed Wing", "Ruined Hall", "Remains"],
	mapTint: "ruins",
	spawnWeight: { ground: 1.0, upper: 0.8 },
	furnish: furnishCollapsedWing,
	extras: addCollapsedWingExtras,
	fillers: [
		["rubblePile", "floor"],
		["brokenColumn", "floor"],
		["sheetedFurniture", "floor"],
	],
	hidingSpots: ["trunk", "wardrobe"],
};
