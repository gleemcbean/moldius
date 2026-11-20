import { rotate2 } from "../../math.js";
import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import {
	chandeliers,
	randomRugs,
	tableSet,
	windowsFor,
} from "./kit/placements.js";

const CLOCK_DECOR = [
	["mantelClock", 4],
	["hourglass", 2],
	["oilLamp", 1],
	["candle", 1],
	["books", 1],
] as const;

function furnishHorology(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1]);
	furnisher.wallItem(furnisher.rng.pick(["wardrobe", "lockers"]));
	furnisher.wallItemsBetween("grandfatherClock", 3, 6);

	for (const bench of furnisher.wallItemsBetween("workbench", 1, 2)) {
		furnisher.decorateSurface(bench, CLOCK_DECOR, 2, 3);

		const front = rotate2({ x: 0, z: bench.depth / 2 + 0.4 }, bench.rotation);

		furnisher.floorItem("stool", {
			at: { x: bench.x + front.x, z: bench.z + front.z },
			rotation: bench.rotation,
		});
	}

	furnisher
		.wallItemsBetween("cabinet", 1, 2)
		.forEach(
			(cabinet) => void furnisher.decorateSurface(cabinet, CLOCK_DECOR, 1, 3),
		);

	furnisher.wallItemsBetween("displayCase", 0, 1);
	tableSet(furnisher, { variants: [2], chairs: [0, 1], decor: CLOCK_DECOR });
	furnisher.floorItemsBetween("armchair", 0, 1, { wallMargin: 0.6 });
	furnisher.wallDecorBetween("wallClock", 3, 6);
	furnisher.wallDecorBetween("barometer", 0, 1);
	furnisher.wallDecorBetween("keyRack", 0, 1);
	furnisher.wallDecorBetween("sconce", 1, 2);
	randomRugs(furnisher, 0, 1);
	chandeliers(furnisher, 1);
	furnisher.cobwebs(2, 3);
}

function addHorologyExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("ovalPortrait", 0, 1);
	furnisher.wallDecorBetween("mirror", 0, 1);
}

export const horologyRoom: RoomBlueprint = {
	catalog: {
		names: ["Salle des horloges", "Horlogerie", "Cabinet des pendules"],
		width: [5.5, 8],
		depth: [5, 7],
		heightGround: [3.2, 3.7],
		heightUpper: [2.9, 3.3],
		shapes: [
			["rect", 2],
			["octagon", 1.2],
			["heptagon", 0.8],
		],
		floors: ["parquet", "darkPlanks", "checkerTiles"],
		walls: [
			"woodPanels",
			"wallpaperOchre",
			"wallpaperStripes",
			"wallpaperGreen",
		],
		ceilings: ["coffered", "beams", "plaster"],
		wainscotChance: 0.7,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Clock Room", "Clockmaker's Workshop", "Hall of Pendulums"],
	mapTint: "private",
	spawnWeight: { ground: 0.8, upper: 0.8 },
	furnish: furnishHorology,
	extras: addHorologyExtras,
	fillers: [
		["armchair", "floor"],
		["sheetedFurniture", "floor"],
		["candelabra", "floor"],
		["grandfatherClock", "wall"],
		["cabinet", "wall"],
	],
	hidingSpots: ["wardrobe", "curtainAlcove", "lockers"],
};
