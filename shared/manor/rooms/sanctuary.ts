import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";

function furnishSanctuary(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("candelabra", 2, 3, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("pew", 1, 2, { wallMargin: 0.8 });
	furnisher.wallDecorBetween("tapestry", 1, 2);
	furnisher.wallDecorBetween("sconce", 1, 2);
	furnisher.cobwebs(1, 2);
}

export const sanctuaryRoom: RoomBlueprint = {
	catalog: {
		names: ["Sanctuaire"],
		width: [5.5, 8],
		depth: [5.5, 8],
		heightGround: [3.4, 3.9],
		heightUpper: [3.0, 3.3],
		shapes: [
			["rect", 2],
			["octagon", 1.5],
		],
		floors: ["stoneFlags", "mosaic"],
		walls: ["stoneBlocks", "plaster"],
		ceilings: ["vault", "plaster"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Sanctuary"],
	mapTint: "neutral",
	furnish: furnishSanctuary,
	fillers: [
		["candelabra", "floor"],
		["statue", "floor"],
		["pew", "floor"],
	],
	hidingSpots: ["curtainAlcove", "confessional"],
};
