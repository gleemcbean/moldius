import { rotate2 } from "../../math.js";
import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import {
	chandeliers,
	ghostFurniture,
	randomRugs,
	sideBySideCandles,
	windowsFor,
} from "./kit/placements.js";

function bedSet(furnisher: RoomFurnisher): void {
	const bed = furnisher.wallItem("bed");

	if (!bed) {
		return;
	}

	for (const side of [-1, 1]) {
		if (!furnisher.rng.chance(0.75)) {
			continue;
		}

		const local = rotate2(
			{ x: side * (bed.width / 2 + 0.33), z: -bed.depth / 2 + 0.23 },
			bed.rotation,
		);

		const stand = furnisher.floorItem("nightstand", {
			at: { x: bed.x + local.x, z: bed.z + local.z },
			rotation: bed.rotation,
			variant: 0,
		});

		if (stand) {
			furnisher.decorateSurface(
				stand,
				[
					["candle", 3],
					["books", 1],
					["vase", 1],
				],
				1,
				1,
			);
		}
	}

	if (furnisher.rng.chance(0.5)) {
		const local = rotate2({ x: 0, z: bed.depth / 2 + 0.38 }, bed.rotation);

		furnisher.floorItem("chest", {
			at: { x: bed.x + local.x, z: bed.z + local.z },
			rotation: bed.rotation,
			ignoreKeepClear: true,
		});
	}
}

function furnishBedroom(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1, 2]);
	bedSet(furnisher);

	if (furnisher.rng.chance(0.3)) {
		bedSet(furnisher);
	}

	furnisher.wallItemsBetween("wardrobe", 1, 1);
	sideBySideCandles(furnisher, furnisher.wallItem("dresser"), 1, 2);
	furnisher.wallItemsBetween("fireplace", 0, 1);
	furnisher.wallItemsBetween("trunk", 0, 1);
	furnisher.wallItemsBetween("chest", 0, 1);
	furnisher.floorItemsBetween("armchair", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("floorLamp", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("dressForm", 0, 1, { wallMargin: 0.5 });
	ghostFurniture(furnisher, 0, 1);
	furnisher.wallDecorBetween("mirror", 0, 1);
	furnisher.wallDecorBetween("painting", 1, 2);
	furnisher.wallDecorBetween("sconce", 0, 2);
	randomRugs(furnisher, 1, 1);
	chandeliers(furnisher, 1);
	furnisher.floorItemsBetween("floorBall", 0, 1, { wallMargin: 0.3 });
	furnisher.cobwebs(1, 3);
}

function addBedroomExtras(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("vanity", 0, 1);
	furnisher.wallItemsBetween("washstand", 0, 1);
	furnisher.floorItemsBetween("screen", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("rockingChair", 0, 1, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("crucifix", 0, 1);
	furnisher.wallDecorBetween("wallClock", 0, 1);
}

export const bedroomRoom: RoomBlueprint = {
	catalog: {
		names: ["Chambre", "Chambre d'amis", "Chambre du mage", "Chambre bleue"],
		width: [4.5, 7],
		depth: [4.5, 6.5],
		heightGround: [3.0, 3.5],
		heightUpper: [2.7, 3.2],
		shapes: [
			["rect", 2.5],
			["heptagon", 0.6],
			["lshape", 0.8],
		],
		floors: ["oakPlanks", "parquet"],
		walls: [
			"wallpaperRed",
			"wallpaperBlue",
			"wallpaperPurple",
			"wallpaperOchre",
			"wallpaperFloral",
			"wallpaperStripes",
		],
		ceilings: ["plaster", "coffered", "beams"],
		wainscotChance: 0.6,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Bedroom", "Guest Room", "Mage's Bedroom", "Blue Room"],
	mapTint: "private",
	spawnWeight: { ground: 0.9, upper: 1.2 },
	furnish: furnishBedroom,
	extras: addBedroomExtras,
	hidingSpots: ["trunk", "wardrobe"],
};
