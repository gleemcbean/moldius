import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { ceilingBetween, windowsFor } from "./kit/placements.js";

const LARDER_DECOR = [
	["jar", 4],
	["plateSet", 1],
	["candle", 1],
] as const;

function furnishLarder(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [3], 3.2);

	const counter =
		furnisher.wallItem("kitchenCounter") ??
		furnisher.floorItem("table", {
			variant: furnisher.rng.int(0, 1),
			wallMargin: 0.8,
		});

	if (counter) {
		furnisher.decorateSurface(counter, LARDER_DECOR, 2, 3);
	}

	furnisher.wallItemsBetween("shelf", 1, 2);

	furnisher
		.wallItemsBetween("cabinet", 0, 1)
		.forEach(
			(cabinet) => void furnisher.decorateSurface(cabinet, LARDER_DECOR, 1, 3),
		);

	furnisher.wallItemsBetween("cask", 0, 1);
	furnisher.floorItemsBetween("grainSacks", 0, 1, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("barrel", 0, 1, { wallMargin: 0.35 });
	furnisher.floorItemsBetween("crate", 0, 1, { wallMargin: 0.35 });

	furnisher.floorItemsBetween(
		furnisher.rng.pick(["milkChurns", "butterChurn"]),
		0,
		1,
		{ wallMargin: 0.25 },
	);

	furnisher.wallDecorBetween("hangingHerbs", 1, 2);
	furnisher.wallDecorBetween("spiceRack", 0, 1);
	furnisher.wallDecorBetween("wallShelf", 1, 2);
	furnisher.wallDecorBetween("sconce", 0, 1);
	ceilingBetween(furnisher, "meatHooks", 1, 2);
	ceilingBetween(furnisher, "hangingLantern", 0, 1);
	furnisher.cobwebs(2, 4);
	furnisher.hangingCobwebs(1);
}

function addLarderExtras(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("woodpile", 0, 1);
	furnisher.wallDecorBetween("hangingPots", 0, 1);
	furnisher.floorItemsBetween("logBasket", 0, 1, { wallMargin: 0.25 });
}

export const larderRoom: RoomBlueprint = {
	catalog: {
		names: ["Garde-manger", "Dépense", "Fruitier"],
		width: [4, 6.5],
		depth: [3.5, 5.5],
		heightGround: [2.8, 3.2],
		heightUpper: [2.7, 3.0],
		low: { chance: 0.2, height: [2.45, 2.6] },
		shapes: [
			["rect", 2],
			["lshape", 0.6],
		],
		floors: ["stoneFlags", "cobble", "checkerTiles"],
		walls: ["plaster", "brick", "tiles", "stoneBlocks"],
		ceilings: ["beams", "vault", "planks"],
		wainscotChance: 0,
		singleDoor: true,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Larder", "Buttery", "Fruit Store"],
	mapTint: "service",
	spawnWeight: { ground: 1 },
	furnish: furnishLarder,
	extras: addLarderExtras,
	hidingSpots: ["cask", "lockers"],
};
