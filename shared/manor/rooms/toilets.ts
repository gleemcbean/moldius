import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { windowsFor } from "./kit/placements.js";

function furnishToilets(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [3], 1.6);
	furnisher.wallItem("toilet");
	furnisher.wallItem("sink", { variant: 1 });
	furnisher.wallDecor("mirror", { variant: 1 });
	furnisher.wallDecorBetween("pipeRun", 0, 1, { variant: 1 });
	furnisher.wallDecorBetween("sconce", 0, 1);
	furnisher.cobwebs(1, 2);
}

export const toiletsRoom: RoomBlueprint = {
	catalog: {
		names: ["Toilettes", "Cabinet d'aisance"],
		width: [1.75, 2.25],
		depth: [2.0, 2.5],
		heightGround: [2.7, 3.0],
		heightUpper: [2.6, 2.9],
		low: { chance: 0.25, height: [2.4, 2.5] },
		shapes: [["rect", 1]],
		floors: ["checkerTiles", "mosaic"],
		walls: ["tiles", "plaster"],
		ceilings: ["plaster"],
		wainscotChance: 0,
		singleDoor: true,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Toilets", "Water Closet"],
	mapTint: "service",
	furnish: furnishToilets,
};
