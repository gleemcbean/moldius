import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { RITUAL_DECOR } from "./kit/decorSets.js";
import { estradeWith } from "./kit/placements.js";

function furnishCrypt(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("sarcophagus", 2, 4, { wallMargin: 0.8 });
	furnisher.wallItemsBetween("boneShelf", 2, 3);
	furnisher.wallItemsBetween("confessional", 0, 1);
	furnisher.wallItemsBetween("standingCoffin", 1, 2);
	furnisher.floorItemsBetween("pillar", 0, 2, { wallMargin: 1.2 });
	furnisher.floorItemsBetween("candelabra", 1, 2, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("floorCandles", 1, 3, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("vialCluster", 0, 1, { wallMargin: 0.3 });

	const altar = estradeWith(furnisher, "altar");

	if (altar) {
		furnisher.decorateSurface(altar, RITUAL_DECOR, 1, 3);
	}

	furnisher.wallDecorBetween("tapestry", 0, 1);
	furnisher.wallDecorBetween("sconce", 1, 2);
	furnisher.cobwebs(3, 5);
	furnisher.hangingCobwebs(furnisher.rng.int(1, 3));
}

function addCryptExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("urn", 1, 3, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("torchere", 0, 2, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("crucifix", 0, 1);
	furnisher.floorItemsBetween("mushroomPatch", 0, 1, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("wallRoots", 0, 1);
}

export const cryptRoom: RoomBlueprint = {
	catalog: {
		names: ["Crypte", "Caveau familial"],
		width: [5.5, 8],
		depth: [7, 10],
		heightGround: [3.0, 3.5],
		heightUpper: [3.0, 3.2],
		shapes: [
			["apse", 1],
			["rect", 1],
		],
		floors: ["stoneFlags", "cobble"],
		walls: ["stoneBlocks", "rubbleStone", "mossyBrick"],
		ceilings: ["vault"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Crypt", "Family Vault"],
	mapTint: "occult",
	spawnWeight: { ground: 1.1 },
	furnish: furnishCrypt,
	extras: addCryptExtras,
	fillers: [
		["sarcophagus", "floor"],
		["urn", "floor"],
		["candelabra", "floor"],
		["pillar", "floor"],
		["standingCoffin", "wall"],
	],
	hidingSpots: ["standingCoffin", "trunk"],
};
