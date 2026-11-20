import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";

function furnishCrystalGrotto(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("crystalCluster", 3, 6, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("floatingCrystal", 1, 2, { wallMargin: 1.0 });
	furnisher.floorItemsBetween("runeStone", 0, 2, { wallMargin: 0.7 });
	furnisher.floorItemsBetween("pond", 0, 1, { variant: 1, wallMargin: 1.0 });
	furnisher.floorItemsBetween("rubblePile", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("floorDebris", 1, 2, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("mushroomPatch", 1, 3, { wallMargin: 0.3 });
	furnisher.cobwebs(1, 2);
}

function addCrystalGrottoExtras(furnisher: RoomFurnisher): void {
	furnisher.wallDecorBetween("bracketFungus", 0, 2);
	furnisher.wallDecorBetween("wallRoots", 0, 1);
}

export const crystalGrottoRoom: RoomBlueprint = {
	catalog: {
		names: ["Grotte de cristal", "Salle des cristaux", "Géode"],
		width: [6, 9],
		depth: [6, 9],
		heightGround: [3.2, 3.8],
		heightUpper: [3.0, 3.2],
		tall: { chance: 0.3, height: [4.8, 5.5] },
		shapes: [
			["octagon", 1.5],
			["heptagon", 1.5],
			["lshape", 1],
		],
		floors: ["basalt", "soil"],
		walls: ["basalt", "rubbleStone"],
		ceilings: ["vault"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Crystal Grotto", "Crystal Chamber", "Geode"],
	mapTint: "arcane",
	spawnWeight: { ground: 0.8 },
	furnish: furnishCrystalGrotto,
	extras: addCrystalGrottoExtras,
	fillers: [
		["crystalCluster", "floor"],
		["runeStone", "floor"],
		["rubblePile", "floor"],
	],
	hidingSpots: ["cask", "trunk"],
};
