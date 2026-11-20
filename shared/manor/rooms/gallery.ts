import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import {
	chandeliers,
	placeRug,
	sideBySideCandles,
	windowsFor,
} from "./kit/placements.js";

function furnishGallery(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1], 3.2);
	furnisher.wallDecorBetween("painting", 5, 9);
	furnisher.wallDecorBetween("sconce", 2, 4);
	furnisher.floorItemsBetween("bench", 1, 3, { wallMargin: 1.0 });
	furnisher.floorItemsBetween("pottedPlant", 1, 2, { wallMargin: 0.4 });
	sideBySideCandles(furnisher, furnisher.wallItem("cabinet"), 1, 2);
	furnisher.wallItemsBetween("wardrobe", 0, 1);
	furnisher.wallItemsBetween("curtainAlcove", 0, 1);
	furnisher.wallItemsBetween("armor", 1, 2);
	furnisher.wallItemsBetween("displayCase", 0, 1);
	furnisher.floorItemsBetween("statue", 0, 2, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("candelabra", 1, 2, { wallMargin: 0.5 });

	placeRug(
		furnisher,
		furnisher.room.labelPoint,
		furnisher.room.axisAngle + (furnisher.rng.chance(0.5) ? 0 : Math.PI / 2),
		3,
	);

	chandeliers(furnisher, 2);
	furnisher.cobwebs(1, 3);
}

function addGalleryExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("bust", 1, 2, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("easel", 0, 1, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("urn", 0, 1, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("ovalPortrait", 1, 2);
}

export const galleryRoom: RoomBlueprint = {
	catalog: {
		names: ["Galerie des portraits", "Galerie", "Galerie des ancêtres"],
		width: [4, 5],
		depth: [9, 13],
		heightGround: [3.3, 3.8],
		heightUpper: [2.9, 3.3],
		shapes: [
			["rect", 2],
			["heptagon", 1],
			["octagon", 1],
		],
		floors: ["parquet", "redCarpet", "darkPlanks"],
		walls: [
			"wallpaperRed",
			"wallpaperGreen",
			"woodPanels",
			"wallpaperFleur",
			"wallpaperStripes",
		],
		ceilings: ["coffered", "vault"],
		wainscotChance: 0.8,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: false,
	},
	englishNames: ["Portrait Gallery", "Gallery", "Ancestors' Gallery"],
	mapTint: "reception",
	furnish: furnishGallery,
	extras: addGalleryExtras,
	fillers: [
		["statue", "floor"],
		["bench", "floor"],
		["pillar", "floor"],
		["pottedPlant", "floor"],
		["armor", "wall"],
		["displayCase", "wall"],
	],
	hidingSpots: ["curtainAlcove", "wardrobe"],
};
