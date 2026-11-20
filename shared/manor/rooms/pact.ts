import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";

function furnishPact(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("candelabra", 1, 2, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("pillar", 0, 2, { wallMargin: 1.2 });
	furnisher.wallItemsBetween("trunk", 0, 1);
	furnisher.wallDecorBetween("sconce", 1, 1);
	furnisher.cobwebs(3, 4);
	furnisher.hangingCobwebs(1);
}

export const pactRoom: RoomBlueprint = {
	catalog: {
		names: ["Salle du pacte"],
		width: [5.5, 8],
		depth: [5.5, 8],
		heightGround: [3.2, 3.7],
		heightUpper: [2.9, 3.2],
		shapes: [
			["rect", 1.5],
			["octagon", 1.5],
		],
		floors: ["stoneFlags", "darkPlanks"],
		walls: ["rubbleStone", "stoneBlocks"],
		ceilings: ["vault", "beams"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Pact Chamber"],
	mapTint: "neutral",
	furnish: furnishPact,
	fillers: [
		["candelabra", "floor"],
		["pillar", "floor"],
		["trunk", "wall"],
	],
	hidingSpots: ["standingCoffin", "trunk"],
};
