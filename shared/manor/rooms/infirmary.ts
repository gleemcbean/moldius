import { rotate2 } from "../../math.js";
import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import {
	ceilingBetween,
	ghostFurniture,
	windowsFor,
} from "./kit/placements.js";

const INFIRMARY_DECOR = [
	["potions", 3],
	["bellJar", 1],
	["jar", 2],
	["mortar", 1],
	["oilLamp", 1],
	["candle", 1],
] as const;

function furnishInfirmary(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1]);

	const beds = furnisher.wallItemsBetween("bed", 2, 4, { variant: 0 });

	for (const bed of beds) {
		const side = furnisher.rng.chance(0.5) ? 1 : -1;

		const head = rotate2(
			{ x: side * (bed.width / 2 + 0.33), z: -bed.depth / 2 + 0.23 },
			bed.rotation,
		);

		const stand = furnisher.floorItem("nightstand", {
			at: { x: bed.x + head.x, z: bed.z + head.z },
			rotation: bed.rotation,
			variant: 0,
		});

		if (stand) {
			furnisher.decorateSurface(stand, INFIRMARY_DECOR, 1, 1);
		}

		if (furnisher.rng.chance(0.45)) {
			const flank = rotate2(
				{ x: -side * (bed.width / 2 + 0.3), z: 0.2 },
				bed.rotation,
			);

			furnisher.floorItem("screen", {
				variant: 1,
				at: { x: bed.x + flank.x, z: bed.z + flank.z },
				rotation: bed.rotation + Math.PI / 2,
			});
		}
	}

	furnisher.floorItem("wheelchair", { wallMargin: 0.4 });
	furnisher.wallItemsBetween("curtainAlcove", 0, 1);

	furnisher
		.wallItemsBetween("cabinet", 1, 1)
		.forEach(
			(cabinet) =>
				void furnisher.decorateSurface(cabinet, INFIRMARY_DECOR, 2, 3),
		);

	furnisher.wallItemsBetween("displayCase", 0, 1);
	furnisher.wallItemsBetween("sink", 0, 1);
	furnisher.wallItemsBetween("washstand", 0, 1);
	furnisher.wallItemsBetween("lockers", 0, 1);

	for (const table of furnisher.floorItemsBetween("sideTable", 0, 1, {
		wallMargin: 0.5,
	})) {
		furnisher.decorateSurface(table, INFIRMARY_DECOR, 1, 1);
	}

	furnisher.floorItemsBetween("bucket", 0, 2, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("laundryBasket", 0, 1, { wallMargin: 0.3 });
	ghostFurniture(furnisher, 0, 1);
	furnisher.wallDecorBetween("crucifix", 0, 1);
	furnisher.wallDecorBetween("wallClock", 0, 1);
	furnisher.wallDecorBetween("specimenFrame", 0, 1);
	furnisher.wallDecorBetween("pipeRun", 0, 1);
	furnisher.wallDecorBetween("sconce", 1, 2);
	ceilingBetween(furnisher, "hangingLantern", 1, 2);
	furnisher.cobwebs(2, 3);
}

function addInfirmaryExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("rockingChair", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("mirror", 0, 1);
}

export const infirmaryRoom: RoomBlueprint = {
	catalog: {
		names: ["Infirmerie", "Salle de soins", "Dispensaire"],
		width: [6, 9],
		depth: [5, 7.5],
		heightGround: [3.1, 3.6],
		heightUpper: [2.8, 3.2],
		shapes: [
			["rect", 2.5],
			["lshape", 0.8],
			["heptagon", 0.5],
		],
		floors: ["checkerTiles", "oakPlanks", "mosaic"],
		walls: ["tiles", "plaster", "wallpaperBlue", "wallpaperStripes"],
		ceilings: ["plaster", "beams"],
		wainscotChance: 0.4,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Infirmary", "Sickroom", "Dispensary"],
	mapTint: "private",
	spawnWeight: { ground: 0.8, upper: 1 },
	furnish: furnishInfirmary,
	extras: addInfirmaryExtras,
	fillers: [
		["screen", "floor"],
		["wheelchair", "floor"],
		["sheetedFurniture", "floor"],
		["lockers", "wall"],
		["cabinet", "wall"],
		["washstand", "wall"],
	],
	hidingSpots: ["lockers", "wardrobe", "curtainAlcove"],
};
