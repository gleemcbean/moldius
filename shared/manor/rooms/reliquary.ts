import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";

function furnishReliquary(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("cabinet", 1, 2);
	furnisher.wallItemsBetween("chest", 1, 2);
	furnisher.floorItemsBetween("urn", 1, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("bust", 0, 1, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("sconce", 1, 2);
	furnisher.cobwebs(2, 3);
}

export const reliquaryRoom: RoomBlueprint = {
	catalog: {
		names: ["Reliquaire"],
		width: [5.5, 8],
		depth: [5.5, 8],
		heightGround: [3.2, 3.7],
		heightUpper: [2.9, 3.2],
		shapes: [
			["rect", 2],
			["heptagon", 1],
		],
		floors: ["darkPlanks", "stoneFlags"],
		walls: ["woodPanels", "stoneBlocks"],
		ceilings: ["beams", "coffered"],
		wainscotChance: 0.4,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Reliquary"],
	mapTint: "neutral",
	furnish: furnishReliquary,
	fillers: [
		["chest", "wall"],
		["urn", "floor"],
		["cabinet", "wall"],
	],
	hidingSpots: ["trunk", "wardrobe"],
};
