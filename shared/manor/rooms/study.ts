import { rotate2 } from "../../math.js";
import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import {
	chandeliers,
	rugUnder,
	sideBySideCandles,
	windowsFor,
} from "./kit/placements.js";

const STUDY_DECOR = [
	["inkwell", 2],
	["books", 3],
	["openBook", 2],
	["candle", 3],
	["scrolls", 1],
	["hourglass", 1],
	["mantelClock", 1],
] as const;

function furnishStudy(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1, 2]);

	const desk = furnisher.floorItem("desk", { wallMargin: 1.1 });

	if (desk) {
		const local = rotate2({ x: 0, z: -desk.depth / 2 - 0.35 }, desk.rotation);

		furnisher.floorItem("chair", {
			variant: 1,
			at: { x: desk.x + local.x, z: desk.z + local.z },
			rotation: desk.rotation,
		});

		furnisher.decorateSurface(desk, STUDY_DECOR, 2, 3);
		rugUnder(furnisher, desk, 0.9);
	}

	furnisher.wallItemsBetween("bookcase", 1, 3);
	furnisher.wallItemsBetween("fileCabinet", 1, 2);
	furnisher.wallItemsBetween("lockers", 0, 1);
	furnisher.wallItemsBetween("grandfatherClock", 0, 1);
	sideBySideCandles(furnisher, furnisher.wallItem("cabinet"), 1, 2);
	furnisher.floorItemsBetween("globe", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("armchair", 0, 1, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("specimenFrame", 0, 2);
	furnisher.wallDecorBetween("trophyHead", 0, 1);
	furnisher.wallDecorBetween("painting", 1, 2);
	furnisher.wallDecorBetween("sconce", 0, 1);
	chandeliers(furnisher, 1);
	furnisher.cobwebs(1, 2);
}

function addStudyExtras(furnisher: RoomFurnisher): void {
	furnisher.wallItemsBetween("secretary", 0, 1);
	furnisher.wallDecorBetween("oldMap", 0, 1);
	furnisher.wallDecorBetween("barometer", 0, 1);
	furnisher.wallDecorBetween("wallClock", 0, 1);
}

export const studyRoom: RoomBlueprint = {
	catalog: {
		names: ["Bureau", "Cabinet de travail", "Bureau du maître"],
		width: [4.5, 6.5],
		depth: [4.5, 6],
		heightGround: [3.1, 3.6],
		heightUpper: [2.8, 3.2],
		shapes: [
			["rect", 2],
			["heptagon", 1],
		],
		floors: ["darkPlanks", "parquet"],
		walls: ["woodPanels", "wallpaperGreen", "wallpaperOchre", "wallpaperFleur"],
		ceilings: ["coffered", "plaster"],
		wainscotChance: 0.8,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Study", "Workroom", "Master's Study"],
	mapTint: "private",
	spawnWeight: { ground: 0.9, upper: 1 },
	furnish: furnishStudy,
	extras: addStudyExtras,
	hidingSpots: ["lockers", "curtainAlcove", "wardrobe"],
};
