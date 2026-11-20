import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { ceilingBetween, windowsFor } from "./kit/placements.js";

function furnishCellar(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [3], 4);
	furnisher.wallItemsBetween("wineRack", 1, 3);
	furnisher.wallItemsBetween("cask", 1, 2);
	furnisher.wallItemsBetween("barrelStack", 0, 1);
	furnisher.wallItemsBetween("lockers", 0, 1);
	furnisher.wallItemsBetween("shelf", 1, 2);
	furnisher.floorItemsBetween("barrel", 2, 5, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("crate", 2, 4, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("pipeRun", 1, 2);
	furnisher.wallDecorBetween("electricMeter", 0, 1);
	furnisher.wallDecorBetween("sconce", 0, 1);
	furnisher.floorItemsBetween("smallBox", 0, 2, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("bucket", 0, 1, { wallMargin: 0.3 });
	furnisher.cobwebs(3, 5);
	furnisher.hangingCobwebs(furnisher.rng.int(1, 3));
}

function addCellarExtras(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("woodpile", 0, 1);
	furnisher.floorItemsBetween("grainSacks", 0, 2, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("milkChurns", 0, 1, { wallMargin: 0.25 });
	ceilingBetween(furnisher, "meatHooks", 0, 1);
	furnisher.floorItemsBetween("mushroomPatch", 0, 2, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("bracketFungus", 0, 1);
}

export const cellarRoom: RoomBlueprint = {
	catalog: {
		names: ["Cave", "Cave à vin", "Cellier"],
		width: [5.5, 8.5],
		depth: [5, 8],
		heightGround: [2.9, 3.4],
		heightUpper: [2.7, 3.0],
		shapes: [
			["rect", 2],
			["lshape", 1],
			["heptagon", 0.6],
		],
		floors: ["stoneFlags", "cobble"],
		walls: ["stoneBlocks", "brick", "rubbleStone", "mossyBrick"],
		ceilings: ["vault"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Cellar", "Wine Cellar", "Storeroom"],
	mapTint: "service",
	furnish: furnishCellar,
	extras: addCellarExtras,
	fillers: [
		["barrel", "floor"],
		["grainSacks", "floor"],
		["crate", "floor"],
		["barrelStack", "wall"],
	],
	hidingSpots: ["cask", "lockers"],
};
