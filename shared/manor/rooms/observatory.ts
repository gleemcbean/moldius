import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { moonlight, randomRugs, tableSet } from "./kit/placements.js";

const OBSERVATORY_DECOR = [
	["openBook", 3],
	["inkwell", 2],
	["candle", 2],
	["bellJar", 1],
] as const;

function furnishObservatory(furnisher: RoomFurnisher): void {
	const room = furnisher.room;

	furnisher.floorItem("telescope", {
		at: room.labelPoint,
		rotation: room.axisAngle,
	}) ?? furnisher.floorItem("telescope", { wallMargin: 0.9 });

	furnisher.floorItemsBetween("orrery", 1, 1, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("globe", 0, 1, { wallMargin: 0.6 });

	tableSet(furnisher, {
		variants: [0, 2],
		chairs: [1, 2],
		decor: OBSERVATORY_DECOR,
	});

	furnisher.wallItemsBetween("bookcase", 1, 2);
	furnisher.wallItemsBetween("wardrobe", 0, 1);
	furnisher.floorItemsBetween("armchair", 0, 1, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("birdcage", 0, 1, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("starChart", 2, 4);
	furnisher.wallDecorBetween("sconce", 0, 1);
	randomRugs(furnisher, 0, 1);
	moonlight(furnisher, 1.1);
	furnisher.cobwebs(1, 2);
}

function addObservatoryExtras(furnisher: RoomFurnisher): void {
	furnisher.wallDecorBetween("oldMap", 0, 1);
	furnisher.wallDecorBetween("barometer", 0, 1);
	furnisher.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });

	if (furnisher.rng.chance(0.4)) {
		furnisher.floorItem("floatingCrystal", { wallMargin: 0.9 });
	}
}

export const observatoryRoom: RoomBlueprint = {
	catalog: {
		names: ["Observatoire", "Salle des astres"],
		width: [6, 8],
		depth: [6, 8],
		heightGround: [3.4, 3.8],
		heightUpper: [3.1, 3.4],
		shapes: [
			["octagon", 2],
			["rect", 1],
		],
		floors: ["parquet", "mosaic"],
		walls: ["wallpaperStars", "woodPanels"],
		ceilings: ["glass"],
		wainscotChance: 0.6,
		singleDoor: false,
		allowUpper: true,
		allowGround: false,
		optional: true,
	},
	englishNames: ["Observatory", "Star Chamber"],
	mapTint: "occult",
	spawnWeight: { upper: 1.2 },
	furnish: furnishObservatory,
	extras: addObservatoryExtras,
	fillers: [
		["globe", "floor"],
		["crate", "floor"],
		["statue", "floor"],
		["displayCase", "wall"],
		["bookcase", "wall"],
	],
};
