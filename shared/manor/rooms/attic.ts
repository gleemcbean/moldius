import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { ghostFurniture, moonlight, windowsFor } from "./kit/placements.js";

function furnishAttic(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [3], 2.2);
	furnisher.wallItemsBetween("trunk", 1, 3);
	furnisher.wallItemsBetween("chest", 0, 2);
	furnisher.wallItemsBetween("standingCoffin", 0, 1);
	furnisher.wallItemsBetween("wardrobe", 0, 1);
	ghostFurniture(furnisher, 2, 4);
	furnisher.floorItemsBetween("crate", 2, 4, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("dressForm", 0, 2, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("rockingHorse", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("spinningWheel", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("coatRack", 0, 1, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("birdcage", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("smallBox", 1, 3, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("bookPile", 0, 2, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("floorCandles", 1, 2, { wallMargin: 0.4 });
	moonlight(furnisher, 0.5);
	furnisher.cobwebs(3, 6);
	furnisher.hangingCobwebs(furnisher.rng.int(1, 3));
}

function addAtticExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("wheelchair", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("dollhouse", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("screen", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("rockingChair", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("umbrellaStand", 0, 1, { wallMargin: 0.25 });
	furnisher.floorItemsBetween("logBasket", 0, 1, { wallMargin: 0.25 });
	furnisher.floorItemsBetween("floorDebris", 0, 1, { wallMargin: 0.3 });
}

export const atticRoom: RoomBlueprint = {
	catalog: {
		names: ["Grenier", "Combles", "Mansarde"],
		width: [6, 10],
		depth: [5, 8],
		heightGround: [2.4, 2.6],
		heightUpper: [2.4, 2.6],
		shapes: [
			["rect", 2],
			["lshape", 1],
		],
		floors: ["oakPlanks", "darkPlanks"],
		walls: ["woodPanels", "plaster", "brick"],
		ceilings: ["beams", "planks"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: true,
		allowGround: false,
		optional: true,
	},
	englishNames: ["Attic", "Loft", "Garret"],
	mapTint: "service",
	furnish: furnishAttic,
	extras: addAtticExtras,
	hidingSpots: ["trunk", "standingCoffin"],
};
