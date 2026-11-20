import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { ceilingBetween, moonlight, windowsFor } from "./kit/placements.js";

function furnishFungalGreenhouse(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1], 2.2);
	furnisher.floorItemsBetween("giantMushroom", 2, 4, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("mushroomRing", 0, 1, { wallMargin: 1.0 });
	furnisher.floorItemsBetween("mushroomPatch", 4, 7, { wallMargin: 0.35 });
	furnisher.floorItemsBetween("planterBed", 1, 2, { wallMargin: 1.0 });
	furnisher.floorItemsBetween("pottedPlant", 1, 3, { wallMargin: 0.45 });
	furnisher.floorItemsBetween("bench", 0, 1, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("mossCarpet", 1, 3, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("bracketFungus", 1, 3);
	furnisher.wallDecorBetween("wallMushrooms", 1, 2);
	furnisher.wallDecorBetween("myceliumVeins", 1, 2);
	ceilingBetween(furnisher, "sporeSac", 1, 2);
	ceilingBetween(furnisher, "hangingMycelium", 0, 2);
	moonlight(furnisher, 0.7);
}

function addFungalGreenhouseExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("gardenLantern", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("birdbath", 0, 1, { wallMargin: 0.8 });
	furnisher.wallItemsBetween("pottingTable", 0, 1);
}

export const fungalGreenhouseRoom: RoomBlueprint = {
	catalog: {
		names: ["Serre fongique", "Jardin des spores", "Jardin de lune"],
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
		floors: ["soil", "greenhouseTiles"],
		walls: ["greenhouseBrick", "mossyBrick"],
		ceilings: ["glass"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Fungal Greenhouse", "Spore Garden", "Moon Garden"],
	mapTint: "fungal",
	atmosphere: { kind: "spores", density: 0.8 },
	spawnWeight: { ground: 1.1, upper: 0.6 },
	furnish: furnishFungalGreenhouse,
	extras: addFungalGreenhouseExtras,
	fillers: [
		["giantMushroom", "floor"],
		["pottedPlant", "floor"],
	],
	hidingSpots: ["curtainAlcove", "trunk"],
};
