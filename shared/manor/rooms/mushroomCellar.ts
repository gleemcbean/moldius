import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { MYCOLOGY_DECOR } from "./kit/decorSets.js";
import { ceilingBetween } from "./kit/placements.js";

function furnishMushroomCellar(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("mushroomBed", 2, 3, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("giantMushroom", 1, 2, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("mossCarpet", 1, 3, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("mushroomPatch", 3, 6, { wallMargin: 0.3 });

	for (const bench of furnisher.wallItemsBetween("workbench", 0, 1)) {
		furnisher.decorateSurface(bench, MYCOLOGY_DECOR, 2, 4);
	}

	furnisher.floorItemsBetween("barrel", 0, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("bucket", 0, 1, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("myceliumVeins", 2, 3);
	furnisher.wallDecorBetween("wallMushrooms", 1, 3);
	furnisher.wallDecorBetween("bracketFungus", 1, 3);
	furnisher.wallDecorBetween("wallLantern", 0, 1);
	ceilingBetween(furnisher, "sporeSac", 1, 2);
	ceilingBetween(furnisher, "hangingMycelium", 1, 3);
	furnisher.cobwebs(1, 3);
}

function addMushroomCellarExtras(furnisher: RoomFurnisher): void {
	furnisher.wallDecorBetween("wallRoots", 0, 1);
	furnisher.floorItemsBetween("floorDebris", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("crate", 0, 1, { wallMargin: 0.5 });
}

export const mushroomCellarRoom: RoomBlueprint = {
	catalog: {
		names: ["Champignonnière", "Cave aux champignons", "Grotte du mycélium"],
		width: [6, 9],
		depth: [5.5, 8.5],
		heightGround: [3.0, 3.5],
		heightUpper: [2.8, 3.1],
		shapes: [
			["rect", 1.5],
			["lshape", 1],
			["heptagon", 0.8],
		],
		floors: ["soil", "cobble"],
		walls: ["rubbleStone", "mossyBrick", "stoneBlocks"],
		ceilings: ["vault", "beams"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Mushroom Cellar", "Fungus Cave", "Mycelium Grotto"],
	mapTint: "fungal",
	atmosphere: { kind: "spores", density: 1 },
	spawnWeight: { ground: 1.2 },
	furnish: furnishMushroomCellar,
	extras: addMushroomCellarExtras,
	fillers: [
		["giantMushroom", "floor"],
		["mushroomBed", "floor"],
		["barrel", "floor"],
		["crate", "floor"],
	],
	hidingSpots: ["cask", "lockers"],
};
