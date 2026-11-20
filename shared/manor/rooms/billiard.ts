import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import {
	chandeliers,
	sideBySideCandles,
	sideTables,
	windowsFor,
} from "./kit/placements.js";

function furnishBilliard(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1]);

	furnisher.floorItem("billiardTable", { wallMargin: 1.2 }) ??
		furnisher.floorItem("billiardTable", { variant: 1, wallMargin: 1.0 });

	sideBySideCandles(furnisher, furnisher.wallItem("cabinet"), 1, 2);
	furnisher.wallItemsBetween("bookcase", 0, 1);
	furnisher.wallItemsBetween("curtainAlcove", 0, 1);
	furnisher.floorItemsBetween("armchair", 1, 3, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("chessTable", 0, 1, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("gramophone", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("floorLamp", 1, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("coatRack", 0, 1, { wallMargin: 0.3 });
	furnisher.wallDecorBetween("painting", 1, 3);
	furnisher.wallDecorBetween("trophyHead", 0, 2);
	furnisher.wallDecorBetween("sconce", 1, 2);
	chandeliers(furnisher, 1);
	furnisher.cobwebs(1, 2);
}

function addBilliardExtras(furnisher: RoomFurnisher): void {
	furnisher.wallDecorBetween("antlers", 0, 1);
	furnisher.wallDecorBetween("wallClock", 0, 1);
	furnisher.floorItemsBetween("stool", 0, 2, { wallMargin: 0.4 });
	sideTables(furnisher, 0, 1);
}

export const billiardRoom: RoomBlueprint = {
	catalog: {
		names: ["Salle de billard", "Salon de jeu", "Cercle de jeu"],
		width: [6, 8.5],
		depth: [5.5, 7.5],
		heightGround: [3.2, 3.7],
		heightUpper: [2.9, 3.3],
		shapes: [
			["rect", 2],
			["heptagon", 0.6],
			["lshape", 0.6],
		],
		floors: ["parquet", "redCarpet", "darkPlanks"],
		walls: [
			"wallpaperGreen",
			"woodPanels",
			"wallpaperBlue",
			"wallpaperStripes",
			"wallpaperTrellis",
		],
		ceilings: ["coffered", "beams", "plaster"],
		wainscotChance: 0.8,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Billiard Room", "Games Room", "Gentlemen's Club"],
	mapTint: "reception",
	spawnWeight: { ground: 1, upper: 0.8 },
	furnish: furnishBilliard,
	extras: addBilliardExtras,
	hidingSpots: ["curtainAlcove", "wardrobe"],
};
