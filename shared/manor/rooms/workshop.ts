import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { windowsFor } from "./kit/placements.js";

function furnishWorkshop(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 2]);

	furnisher.wallItemsBetween("workbench", 2, 3).forEach(
		(bench) =>
			void furnisher.decorateSurface(
				bench,
				[
					["jar", 2],
					["candle", 2],
					["books", 1],
				],
				1,
				2,
			),
	);

	furnisher.wallItemsBetween("toolRack", 1, 2);
	furnisher.wallItemsBetween("lockers", 1, 1);
	furnisher.wallItemsBetween("cask", 0, 1);
	furnisher.wallItemsBetween("shelf", 1, 1);
	furnisher.floorItemsBetween("crate", 2, 4, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("barrel", 0, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("anvil", 0, 1, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("smallBox", 1, 3, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("pipeRun", 1, 2);
	furnisher.wallDecorBetween("electricMeter", 1, 1);
	furnisher.wallDecorBetween("sconce", 0, 1);
	furnisher.cobwebs(2, 3);
}

function addWorkshopExtras(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("woodpile", 0, 1);
	furnisher.floorItemsBetween("stool", 1, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("easel", 0, 1, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("keyRack", 0, 1);
}

export const workshopRoom: RoomBlueprint = {
	catalog: {
		names: ["Atelier", "Atelier de l'artificier", "Forge"],
		width: [5.5, 8],
		depth: [5, 7],
		heightGround: [3.1, 3.7],
		heightUpper: [2.8, 3.1],
		shapes: [
			["rect", 2],
			["lshape", 1],
		],
		floors: ["darkPlanks", "stoneFlags"],
		walls: ["brick", "plaster"],
		ceilings: ["beams", "planks"],
		wainscotChance: 0.1,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Workshop", "Artificer's Workshop", "Forge"],
	mapTint: "service",
	spawnWeight: { ground: 0.9 },
	furnish: furnishWorkshop,
	extras: addWorkshopExtras,
	hidingSpots: ["cask", "lockers"],
};
