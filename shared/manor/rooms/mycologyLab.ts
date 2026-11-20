import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { MYCOLOGY_DECOR } from "./kit/decorSets.js";
import { ceilingBetween, randomRugs, windowsFor } from "./kit/placements.js";

function furnishMycologyLab(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1]);

	for (const table of furnisher.floorItemsBetween("alchemyTable", 1, 1, {
		wallMargin: 0.9,
	})) {
		furnisher.decorateSurface(table, MYCOLOGY_DECOR, 3, 5);
	}

	for (const desk of furnisher.floorItemsBetween("desk", 0, 1, {
		wallMargin: 0.7,
	})) {
		furnisher.decorateSurface(desk, MYCOLOGY_DECOR, 2, 3);
	}

	furnisher.wallItemsBetween("displayCase", 1, 2);
	furnisher.wallItemsBetween("potionShelf", 0, 1);
	furnisher.wallItemsBetween("bookcase", 0, 1);
	furnisher.wallDecorBetween("specimenFrame", 2, 4);
	furnisher.wallDecorBetween("bracketFungus", 0, 2);
	furnisher.wallDecorBetween("wallMushrooms", 0, 1);
	furnisher.wallDecorBetween("myceliumVeins", 0, 1);
	furnisher.floorItemsBetween("giantMushroom", 0, 1, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("mushroomPatch", 1, 2, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("candelabra", 0, 1, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("sconce", 1, 2);
	randomRugs(furnisher, 0, 1);
	furnisher.cobwebs(1, 3);
}

function addMycologyLabExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("hangingHerbs", 0, 1);
	ceilingBetween(furnisher, "hangingMycelium", 0, 1);
}

export const mycologyLabRoom: RoomBlueprint = {
	catalog: {
		names: [
			"Cabinet de mycologie",
			"Laboratoire des spores",
			"Herbier des moisissures",
		],
		width: [5.5, 8],
		depth: [5, 7.5],
		heightGround: [3.1, 3.6],
		heightUpper: [2.8, 3.2],
		shapes: [
			["rect", 2],
			["heptagon", 0.8],
			["lshape", 0.8],
		],
		floors: ["parquet", "darkPlanks", "checkerTiles"],
		walls: ["woodPanels", "wallpaperGreen", "plaster"],
		ceilings: ["plaster", "beams"],
		wainscotChance: 0.6,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Mycology Cabinet", "Spore Laboratory", "Mould Herbarium"],
	mapTint: "fungal",
	atmosphere: { kind: "spores", density: 0.45 },
	spawnWeight: { ground: 0.9, upper: 0.9 },
	furnish: furnishMycologyLab,
	extras: addMycologyLabExtras,
	fillers: [
		["displayCase", "wall"],
		["giantMushroom", "floor"],
	],
	hidingSpots: ["lockers", "wardrobe", "curtainAlcove"],
};
