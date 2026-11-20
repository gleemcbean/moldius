import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { chandeliers, windowsFor } from "./kit/placements.js";

function furnishBallroom(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1, 2], 3.2);
	furnisher.floorItemsBetween("pillar", 2, 4, { wallMargin: 1.4 });
	furnisher.floorItemsBetween("statue", 1, 3, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("grandPiano", 0, 1, { wallMargin: 1.0 });
	furnisher.wallItemsBetween("curtainAlcove", 1, 2);
	furnisher.wallItemsBetween("stageCurtain", 0, 1);
	furnisher.floorItemsBetween("sofa", 0, 2, { wallMargin: 0.7 });
	furnisher.floorItemsBetween("armchair", 1, 3, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("candelabra", 2, 4, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("gramophone", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("pottedPlant", 1, 3, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("painting", 2, 4);
	furnisher.wallDecorBetween("mirror", 1, 3);
	furnisher.wallDecorBetween("tapestry", 0, 2);
	furnisher.wallDecorBetween("sconce", 2, 4);
	chandeliers(furnisher, 3);
	furnisher.cobwebs(1, 3);
}

function addBallroomExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("chaiseLongue", 0, 1, { wallMargin: 0.7 });
	furnisher.floorItemsBetween("ottoman", 0, 2, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("bust", 0, 2, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("torchere", 0, 2, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("harpsichord", 0, 1, { wallMargin: 0.9 });
}

export const ballroomRoom: RoomBlueprint = {
	catalog: {
		names: ["Salle de bal", "Grand salon de bal", "Salle des fêtes"],
		width: [10, 14],
		depth: [9, 12.5],
		heightGround: [5.5, 6.0],
		heightUpper: [5.2, 5.8],
		shapes: [
			["rect", 2],
			["octagon", 2],
			["apse", 1],
		],
		floors: ["parquet", "checkerTiles", "mosaic"],
		walls: [
			"wallpaperRed",
			"wallpaperOchre",
			"wallpaperPurple",
			"woodPanels",
			"wallpaperFleur",
			"wallpaperStripes",
		],
		ceilings: ["coffered", "vault", "beams"],
		wainscotChance: 0.7,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Ballroom", "Grand Ballroom", "Banqueting Hall"],
	mapTint: "reception",
	spawnWeight: { ground: 1, upper: 0.6 },
	furnish: furnishBallroom,
	extras: addBallroomExtras,
	fillers: [
		["pillar", "floor"],
		["chaiseLongue", "floor"],
		["ottoman", "floor"],
		["statue", "floor"],
		["sofa", "floor"],
		["armchair", "floor"],
		["sheetedFurniture", "floor"],
		["pottedPlant", "floor"],
		["candelabra", "floor"],
		["harp", "floor"],
		["armor", "wall"],
		["cabinet", "wall"],
	],
	hidingSpots: ["curtainAlcove", "wardrobe"],
};
