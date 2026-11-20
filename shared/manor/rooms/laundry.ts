import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { windowsFor } from "./kit/placements.js";

function furnishLaundry(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [2, 3], 2.4);

	const lines = furnisher.floorItemsBetween("dryingLine", 1, 2, {
		wallMargin: 0.6,
	});

	const tubs = furnisher.floorItemsBetween("washtub", 1, 2, {
		wallMargin: 0.5,
	});

	if (lines.length + tubs.length === 0) {
		furnisher.floorItem("washtub", { wallMargin: 0.15, ignoreKeepClear: true });
	}

	furnisher.floorItemsBetween("laundryBasket", 1, 3, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("dressForm", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("spinningWheel", 0, 1, { wallMargin: 0.5 });
	furnisher.wallItemsBetween("sink", 1, 2);
	furnisher.wallItemsBetween("lockers", 0, 1);
	furnisher.wallItemsBetween("trunk", 0, 1);
	furnisher.wallItemsBetween("shelf", 1, 1);

	furnisher.wallItemsBetween("workbench", 0, 1).forEach(
		(bench) =>
			void furnisher.decorateSurface(
				bench,
				[
					["jar", 2],
					["candle", 1],
				],
				1,
				2,
			),
	);

	furnisher.floorItemsBetween("bucket", 1, 2, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("pipeRun", 1, 2);
	furnisher.wallDecorBetween("wallShelf", 0, 1);
	furnisher.wallDecorBetween("sconce", 0, 1);
	furnisher.cobwebs(2, 3);
	furnisher.hangingCobwebs(1);
}

function addLaundryExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("ironingBoard", 0, 1, { wallMargin: 0.5 });
	furnisher.wallItemsBetween("washstand", 0, 1);
}

export const laundryRoom: RoomBlueprint = {
	catalog: {
		names: ["Buanderie", "Lingerie"],
		width: [4.5, 6.5],
		depth: [4, 6],
		heightGround: [2.9, 3.3],
		heightUpper: [2.7, 3.0],
		shapes: [
			["rect", 2],
			["lshape", 0.6],
		],
		floors: ["stoneFlags", "checkerTiles"],
		walls: ["tiles", "plaster", "brick"],
		ceilings: ["beams", "planks"],
		wainscotChance: 0.2,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Laundry", "Linen Room"],
	mapTint: "service",
	spawnWeight: { ground: 1, upper: 0.7 },
	furnish: furnishLaundry,
	extras: addLaundryExtras,
	hidingSpots: ["trunk", "lockers"],
};
