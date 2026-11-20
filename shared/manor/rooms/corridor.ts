import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { placeRug, windowsFor } from "./kit/placements.js";

function furnishCorridor(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 2], 3.4);
	furnisher.wallDecorBetween("painting", 1, 3);
	furnisher.wallDecorBetween("sconce", 1, 2);

	if (furnisher.rng.chance(0.25)) {
		furnisher.wallDecor("pipeRun");
	}

	if (furnisher.rng.chance(0.25)) {
		furnisher.wallDecor("electricMeter");
	}

	if (furnisher.rng.chance(0.4)) {
		furnisher.wallItem("nightstand");
	}

	if (furnisher.rng.chance(0.35)) {
		furnisher.floorItem("pottedPlant", { variant: 2, wallMargin: 0.3 });
	}

	if (furnisher.rng.chance(0.2)) {
		furnisher.wallItem("armor");
	}

	if (furnisher.rng.chance(0.15)) {
		furnisher.floorItem("coatRack", { wallMargin: 0.3 });
	}

	if (furnisher.rng.chance(0.55)) {
		placeRug(
			furnisher,
			furnisher.room.labelPoint,
			furnisher.room.axisAngle + (furnisher.rng.chance(0.5) ? 0 : Math.PI / 2),
			3,
		);
	}

	furnisher.cobwebs(1, 3);
	furnisher.hangingCobwebs(furnisher.rng.int(0, 1));
}

function addCorridorExtras(furnisher: RoomFurnisher): void {
	if (furnisher.rng.chance(0.2)) {
		furnisher.floorItem("umbrellaStand", { wallMargin: 0.2 });
	}

	if (furnisher.rng.chance(0.12)) {
		furnisher.floorItem("wheelchair", { wallMargin: 0.3 });
	}

	if (furnisher.rng.chance(0.2)) {
		furnisher.wallDecor("barometer");
	}

	if (furnisher.rng.chance(0.25)) {
		furnisher.wallDecor("ovalPortrait");
	}
}

export const corridorRoom: RoomBlueprint = {
	catalog: {
		names: ["Couloir", "Passage", "Corridor", "Couloir étroit"],
		width: [1.8, 2.5],
		depth: [5, 12],
		heightGround: [2.8, 3.3],
		heightUpper: [2.6, 3.0],
		low: { chance: 0.22, height: [2.4, 2.55] },
		shapes: [
			["corridor", 3],
			["corridorL", 1.4],
			["corridorBend", 1.2],
			["corridor45", 1.2],
		],
		floors: ["oakPlanks", "darkPlanks", "stoneFlags", "redCarpet"],
		walls: [
			"wallpaperGreen",
			"wallpaperRed",
			"plaster",
			"woodPanels",
			"wallpaperOchre",
			"wallpaperTrellis",
			"wallpaperFloral",
		],
		ceilings: ["plaster", "beams", "planks"],
		wainscotChance: 0.5,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: false,
	},
	englishNames: ["Hallway", "Passage", "Corridor", "Narrow Hallway"],
	mapTint: "passage",
	furnish: furnishCorridor,
	extras: addCorridorExtras,
	fillers: [],
};
