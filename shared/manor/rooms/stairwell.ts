import { LEVEL_HEIGHT } from "../../config/index.js";
import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";

function furnishStairwell(furnisher: RoomFurnisher): void {
	furnisher.wallDecorBetween("painting", 1, 2);
	furnisher.wallDecorBetween("ovalPortrait", 0, 1);
	furnisher.wallDecorBetween("sconce", 1, 2);
	furnisher.wallDecorBetween("wallClock", 0, 1);
	furnisher.wallDecorBetween("trophyHead", 0, 1);
	furnisher.cobwebs(2, 4);
}

export const stairwellRoom: RoomBlueprint = {
	catalog: {
		names: ["Escalier", "Cage d'escalier"],
		width: [2.6, 2.6],
		depth: [7.4, 7.4],
		heightGround: [LEVEL_HEIGHT + 3, LEVEL_HEIGHT + 3],
		heightUpper: [3, 3],
		shapes: [["rect", 1]],
		floors: ["darkPlanks"],
		walls: ["plaster", "woodPanels", "stoneBlocks"],
		ceilings: ["plaster"],
		wainscotChance: 0.5,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: false,
	},
	englishNames: ["Staircase", "Stairwell"],
	mapTint: "stairs",
	furnish: furnishStairwell,
	fillers: [],
};
