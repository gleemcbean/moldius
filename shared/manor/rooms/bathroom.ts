import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { randomRugs, sideBySideCandles, windowsFor } from "./kit/placements.js";

function furnishBathroom(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [2, 3], 2.2);
	furnisher.wallItem("bathtub");
	furnisher.wallItemsBetween("sink", 1, 2);
	furnisher.wallItemsBetween("wardrobe", 0, 1);
	sideBySideCandles(furnisher, furnisher.wallItem("dresser"), 1, 2);
	furnisher.wallDecorBetween("mirror", 1, 2);
	furnisher.wallDecorBetween("pipeRun", 1, 1);
	furnisher.wallDecorBetween("sconce", 1, 1);
	randomRugs(furnisher, 0, 1);
	furnisher.cobwebs(1, 2);
}

function addBathroomExtras(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("washstand", 0, 1);
	furnisher.floorItemsBetween("screen", 0, 1, { wallMargin: 0.3 });
}

export const bathroomRoom: RoomBlueprint = {
	catalog: {
		names: ["Salle de bain", "Salle d'eau"],
		width: [3.5, 5],
		depth: [3.5, 5],
		heightGround: [2.9, 3.3],
		heightUpper: [2.7, 3.0],
		shapes: [
			["rect", 2],
			["heptagon", 0.6],
		],
		floors: ["mosaic", "checkerTiles"],
		walls: ["tiles", "wallpaperBlue"],
		ceilings: ["plaster"],
		wainscotChance: 0.3,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Bathroom", "Washroom"],
	mapTint: "service",
	spawnWeight: { ground: 0.9, upper: 1 },
	furnish: furnishBathroom,
	extras: addBathroomExtras,
};
