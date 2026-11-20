import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { ceilingBetween } from "./kit/placements.js";

function furnishUndercroft(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("barrelStack", 1, 3);
	furnisher.wallItemsBetween("wineRack", 1, 2);
	furnisher.wallItemsBetween("cask", 0, 2);
	furnisher.wallItemsBetween("standingCoffin", 0, 1);
	furnisher.floorItemsBetween("barrel", 1, 3, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("crate", 0, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("floorCandles", 1, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("bucket", 0, 1, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("sconce", 1, 2);
	furnisher.wallDecorBetween("pipeRun", 0, 1);
	furnisher.cobwebs(3, 5);
	furnisher.hangingCobwebs(furnisher.rng.int(1, 3));
}

function addUndercroftExtras(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("woodpile", 0, 1);
	furnisher.floorItemsBetween("grainSacks", 0, 2, { wallMargin: 0.3 });
	ceilingBetween(furnisher, "meatHooks", 0, 1);
	furnisher.wallDecorBetween("wallRoots", 0, 1);
	furnisher.floorItemsBetween("mushroomPatch", 0, 2, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("crystalCluster", 0, 1, { wallMargin: 0.5 });
}

export const undercroftRoom: RoomBlueprint = {
	catalog: {
		names: ["Souterrain", "Cave voûtée", "Galerie basse"],
		width: [5, 8],
		depth: [6, 10],
		heightGround: [2.4, 2.65],
		heightUpper: [2.4, 2.6],
		shapes: [
			["rect", 2],
			["apse", 0.8],
			["lshape", 0.8],
		],
		floors: ["cobble", "stoneFlags"],
		walls: ["stoneBlocks", "brick", "rubbleStone", "mossyBrick"],
		ceilings: ["vault", "beams"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Undercroft", "Vaulted Cellar", "Low Gallery"],
	mapTint: "service",
	spawnWeight: { ground: 0.9 },
	furnish: furnishUndercroft,
	extras: addUndercroftExtras,
	hidingSpots: ["cask", "standingCoffin"],
};
