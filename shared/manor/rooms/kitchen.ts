import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import {
	ceilingBetween,
	sideBySideCandles,
	tableSet,
	windowsFor,
} from "./kit/placements.js";

const KITCHEN_DECOR = [
	["jar", 3],
	["plateSet", 2],
	["candle", 1],
] as const;

function furnishKitchen(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 2]);
	sideBySideCandles(furnisher, furnisher.wallItem("stove"), 0, 0);

	const counters = furnisher.wallItemsBetween("kitchenCounter", 2, 3);

	counters.forEach(
		(counter) => void furnisher.decorateSurface(counter, KITCHEN_DECOR, 1, 3),
	);

	furnisher.wallItemsBetween("sink", 1, 1);
	furnisher.wallItemsBetween("wardrobe", 0, 1);
	furnisher.wallItemsBetween("shelf", 1, 2);
	sideBySideCandles(furnisher, furnisher.wallItem("cabinet"), 1, 2);

	tableSet(furnisher, {
		variants: [0, 1],
		chairs: [2, 4],
		decor: KITCHEN_DECOR,
	});

	furnisher.floorItemsBetween("barrel", 0, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("crate", 0, 2, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("hangingHerbs", 1, 2);
	furnisher.wallDecorBetween("wallShelf", 0, 2);
	furnisher.wallDecorBetween("pipeRun", 0, 1);
	furnisher.wallDecorBetween("electricMeter", 0, 1);
	furnisher.cobwebs(1, 3);
}

function addKitchenExtras(furnisher: RoomFurnisher): void {
	furnisher.wallDecorBetween("hangingPots", 1, 1);
	furnisher.wallDecorBetween("spiceRack", 0, 1);
	furnisher.floorItemsBetween("butterChurn", 0, 1, { wallMargin: 0.25 });
	furnisher.floorItemsBetween("milkChurns", 0, 1, { wallMargin: 0.25 });
	furnisher.floorItemsBetween("logBasket", 0, 1, { wallMargin: 0.25 });
	furnisher.floorItemsBetween("stool", 0, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("grainSacks", 0, 1, { wallMargin: 0.3 });
	ceilingBetween(furnisher, "meatHooks", 0, 1);
}

export const kitchenRoom: RoomBlueprint = {
	catalog: {
		names: ["Cuisine", "Office", "Grande cuisine"],
		width: [5.5, 8],
		depth: [5, 7],
		heightGround: [3.0, 3.6],
		heightUpper: [2.8, 3.1],
		shapes: [
			["rect", 2],
			["lshape", 1],
		],
		floors: ["checkerTiles", "stoneFlags"],
		walls: ["tiles", "brick", "plaster", "wallpaperTrellis"],
		ceilings: ["beams", "planks"],
		wainscotChance: 0.2,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Kitchen", "Pantry", "Great Kitchen"],
	mapTint: "service",
	furnish: furnishKitchen,
	extras: addKitchenExtras,
	hidingSpots: ["cask", "wardrobe", "lockers"],
};
