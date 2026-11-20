import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { chandeliers, tableSet } from "./kit/placements.js";

function furnishArmory(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("weaponRack", 2, 4);
	furnisher.wallItemsBetween("armor", 1, 3);
	furnisher.wallItemsBetween("chest", 0, 2);
	furnisher.wallItemsBetween("lockers", 0, 1);
	furnisher.wallItemsBetween("displayCase", 0, 1);
	furnisher.floorItemsBetween("anvil", 0, 1, { wallMargin: 0.8 });

	tableSet(furnisher, {
		variants: [0, 1],
		chairs: [0, 2],
		decor: [
			["candle", 2],
			["openBook", 1],
			["skull", 1],
		],
	});

	furnisher.floorItemsBetween("crate", 0, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("barrel", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("statue", 0, 1, { wallMargin: 0.6 });
	furnisher.wallDecorBetween("shieldDisplay", 2, 4);
	furnisher.wallDecorBetween("trophyHead", 0, 1);
	furnisher.wallDecorBetween("sconce", 1, 3);
	chandeliers(furnisher, 1);
	furnisher.cobwebs(1, 3);
}

function addArmoryExtras(furnisher: RoomFurnisher): void {
	furnisher.wallDecorBetween("antlers", 0, 1);
	furnisher.floorItemsBetween("torchere", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });
}

export const armoryRoom: RoomBlueprint = {
	catalog: {
		names: ["Armurerie", "Salle d'armes", "Arsenal"],
		width: [5.5, 8],
		depth: [5, 7.5],
		heightGround: [3.2, 3.8],
		heightUpper: [2.9, 3.3],
		shapes: [
			["rect", 2],
			["lshape", 0.8],
			["octagon", 0.6],
		],
		floors: ["stoneFlags", "cobble", "darkPlanks"],
		walls: ["stoneBlocks", "woodPanels", "brick", "rubbleStone"],
		ceilings: ["beams", "vault"],
		wainscotChance: 0.2,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Armoury", "Weapons Room", "Arsenal"],
	mapTint: "occult",
	spawnWeight: { ground: 0.9, upper: 0.7 },
	furnish: furnishArmory,
	extras: addArmoryExtras,
	hidingSpots: ["lockers", "trunk"],
};
