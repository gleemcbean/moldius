import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { ceilingBetween } from "./kit/placements.js";

function furnishDungeon(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("cellBars", 1, 3);
	furnisher.wallItemsBetween("standingCoffin", 0, 1);
	furnisher.floorItemsBetween("pillar", 0, 1, { wallMargin: 1.4 });
	furnisher.floorItemsBetween("crate", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("bucket", 1, 2, { wallMargin: 0.3 });

	for (let index = furnisher.rng.int(2, 4); index > 0; index -= 1) {
		const point = furnisher.randomInteriorPoint(0.8);

		if (point) {
			furnisher.ceilingItem("hangingChains", point);
		}
	}

	furnisher.floorItemsBetween("bloodStain", 2, 4, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("wallLantern", 2, 4);
	furnisher.cobwebs(2, 4);
	furnisher.hangingCobwebs(1);
}

function addDungeonExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("pillory", 0, 1, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("torchere", 0, 1, { wallMargin: 0.5 });
	ceilingBetween(furnisher, "hangingCage", 0, 2);
	ceilingBetween(furnisher, "meatHooks", 0, 1);
	furnisher.wallDecorBetween("wallRoots", 0, 1);
	furnisher.floorItemsBetween("floorDebris", 0, 1, { wallMargin: 0.3 });
}

export const dungeonRoom: RoomBlueprint = {
	catalog: {
		names: ["Cachot", "Oubliettes", "Geôle"],
		width: [6, 9],
		depth: [6, 8.5],
		heightGround: [3.4, 3.9],
		heightUpper: [3.2, 3.5],
		shapes: [
			["rect", 2],
			["lshape", 0.8],
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
	englishNames: ["Dungeon", "Oubliette", "Gaol"],
	mapTint: "occult",
	spawnWeight: { ground: 1.4 },
	furnish: furnishDungeon,
	extras: addDungeonExtras,
	fillers: [
		["crate", "floor"],
		["barrel", "floor"],
		["pillar", "floor"],
		["cellBars", "wall"],
		["standingCoffin", "wall"],
	],
	hidingSpots: ["standingCoffin", "cask"],
};
