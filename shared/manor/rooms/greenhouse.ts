import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { moonlight, windowsFor } from "./kit/placements.js";

function greenhouseLayout(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("planterBed", 2, 5, { wallMargin: 1.0 });
	furnisher.floorItemsBetween("pottedPlant", 3, 6, { wallMargin: 0.45 });
	furnisher.floorItemsBetween("flowerPot", 1, 3, { wallMargin: 0.35 });
	furnisher.wallItemsBetween("pottingTable", 0, 1);
	furnisher.floorItemsBetween("bench", 0, 2, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("crate", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("bucket", 1, 2, { wallMargin: 0.3 });
	moonlight(furnisher, 0.9);
}

function furnishGreenhouse(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1], 2.0);
	greenhouseLayout(furnisher);
}

function addGreenhouseExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("birdbath", 0, 1, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("gardenLantern", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("giantMushroom", 0, 1, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("mushroomPatch", 0, 2, { wallMargin: 0.35 });
}

export const greenhouseRoom: RoomBlueprint = {
	catalog: {
		names: ["Serre", "Jardin d'hiver", "Orangerie"],
		width: [7, 10],
		depth: [6.5, 9.5],
		heightGround: [3.6, 4.0],
		heightUpper: [3.1, 3.4],
		tall: { chance: 0.35, height: [5.1, 5.8] },
		shapes: [
			["rect", 1],
			["octagon", 1.5],
			["apse", 1],
		],
		floors: ["greenhouseTiles"],
		walls: ["greenhouseBrick", "mossyBrick"],
		ceilings: ["glass"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Greenhouse", "Winter Garden", "Orangery"],
	mapTint: "garden",
	spawnWeight: { ground: 1.5, upper: 0.7 },
	furnish: furnishGreenhouse,
	extras: addGreenhouseExtras,
	fillers: [
		["pottedPlant", "floor"],
		["planterBed", "floor"],
		["flowerPot", "floor"],
		["bench", "floor"],
	],
};
