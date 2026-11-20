import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { RITUAL_DECOR } from "./kit/decorSets.js";
import { estradeWith, windowsFor } from "./kit/placements.js";

function furnishRuinedChapel(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [1, 2], 2.6);

	const altar = estradeWith(furnisher, "altar");

	if (altar) {
		furnisher.decorateSurface(altar, RITUAL_DECOR, 1, 2);
	}

	furnisher.floorItemsBetween("pew", 2, 4, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("brokenColumn", 1, 3, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("rubblePile", 1, 2, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("floorDebris", 2, 4, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("statue", 0, 1, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("candelabra", 1, 2, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("floorCandles", 1, 2, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("wallRoots", 0, 1);
	furnisher.floorItemsBetween("giantMushroom", 0, 1, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("mushroomPatch", 1, 2, { wallMargin: 0.3 });
	furnisher.cobwebs(3, 5);
	furnisher.hangingCobwebs(furnisher.rng.int(0, 2));
}

function addRuinedChapelExtras(furnisher: RoomFurnisher): void {
	furnisher.wallDecorBetween("crucifix", 0, 1);
	furnisher.floorItemsBetween("urn", 0, 1, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("tapestry", 0, 1);
}

export const ruinedChapelRoom: RoomBlueprint = {
	catalog: {
		names: ["Chapelle en ruine", "Nef effondrée", "Oratoire abandonné"],
		width: [6, 8.5],
		depth: [8, 11],
		heightGround: [3.8, 4.4],
		heightUpper: [3.0, 3.4],
		tall: { chance: 0.35, height: [5.2, 5.9] },
		shapes: [
			["apse", 2],
			["rect", 1],
		],
		floors: ["stoneFlags", "cobble", "mosaic"],
		walls: ["stoneBlocks", "rubbleStone", "mossyBrick"],
		ceilings: ["vault", "beams"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Ruined Chapel", "Collapsed Nave", "Forsaken Oratory"],
	mapTint: "ruins",
	spawnWeight: { ground: 0.9 },
	furnish: furnishRuinedChapel,
	extras: addRuinedChapelExtras,
	fillers: [
		["brokenColumn", "floor"],
		["rubblePile", "floor"],
		["pew", "floor"],
	],
	hidingSpots: ["confessional", "curtainAlcove"],
};
