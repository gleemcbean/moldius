import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { GRIMOIRE_DECOR } from "./kit/decorSets.js";
import { chandeliers, randomRugs, windowsFor } from "./kit/placements.js";

function furnishEnchantedLibrary(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1]);
	furnisher.wallItemsBetween("bookcase", 2, 4);
	furnisher.floorItemsBetween("floatingBooks", 1, 2, { wallMargin: 0.8 });

	for (const desk of furnisher.floorItemsBetween("desk", 1, 1, {
		wallMargin: 0.8,
	})) {
		furnisher.decorateSurface(desk, GRIMOIRE_DECOR, 2, 4);
	}

	for (const lectern of furnisher.floorItemsBetween("lectern", 0, 1, {
		wallMargin: 0.6,
	})) {
		furnisher.decorateSurface(lectern, GRIMOIRE_DECOR, 1, 1);
	}

	furnisher.floorItemsBetween("floatingCrystal", 0, 1, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("bookPile", 1, 3, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("globe", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("candelabra", 1, 2, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("starChart", 0, 1);
	randomRugs(furnisher, 0, 1);
	chandeliers(furnisher, 1);
	furnisher.cobwebs(1, 3);
}

function addEnchantedLibraryExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("armchair", 0, 1, { wallMargin: 0.6 });
	furnisher.wallDecorBetween("ovalPortrait", 0, 1);
	furnisher.wallDecorBetween("sconce", 1, 2);
}

export const enchantedLibraryRoom: RoomBlueprint = {
	catalog: {
		names: [
			"Bibliothèque enchantée",
			"Scriptorium volant",
			"Salle des grimoires",
		],
		width: [7, 10],
		depth: [6.5, 9.5],
		heightGround: [3.5, 4.0],
		heightUpper: [3.0, 3.4],
		tall: { chance: 0.3, height: [5.2, 5.9] },
		shapes: [
			["rect", 1.5],
			["octagon", 1.5],
			["heptagon", 1],
		],
		floors: ["parquet", "darkPlanks", "redCarpet"],
		walls: ["woodPanels", "wallpaperStars", "wallpaperPurple"],
		ceilings: ["coffered", "vault"],
		wainscotChance: 0.8,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Enchanted Library", "Flying Scriptorium", "Grimoire Hall"],
	mapTint: "arcane",
	spawnWeight: { ground: 0.7, upper: 0.8 },
	furnish: furnishEnchantedLibrary,
	extras: addEnchantedLibraryExtras,
	fillers: [
		["bookPile", "floor"],
		["bookcase", "wall"],
	],
	hidingSpots: ["curtainAlcove", "wardrobe"],
};
