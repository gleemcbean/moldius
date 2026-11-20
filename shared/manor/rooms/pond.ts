import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { moonlight, windowsFor } from "./kit/placements.js";

function pondLayout(furnisher: RoomFurnisher): void {
	const room = furnisher.room;

	furnisher.floorItem("pond", {
		at: room.labelPoint,
		rotation: room.axisAngle,
		wallMargin: 1.2,
	}) ??
		furnisher.floorItem("pond", { wallMargin: 1.2 }) ??
		furnisher.floorItem("pond", { variant: 1, wallMargin: 1.0 });

	furnisher.floorItemsBetween("bench", 1, 2, { wallMargin: 0.9 });
	furnisher.floorItemsBetween("statue", 0, 1, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("planterBed", 0, 1, { wallMargin: 1.0 });
	furnisher.floorItemsBetween("pottedPlant", 1, 3, { wallMargin: 0.45 });
	furnisher.floorItemsBetween("flowerPot", 5, 9, { wallMargin: 0.35 });
	furnisher.floorItemsBetween("floorLamp", 1, 2, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("sconce", 0, 2);

	if (room.style.ceiling === "glass") {
		moonlight(furnisher, 0.8);
	}

	furnisher.cobwebs(0, 1);
}

function furnishPond(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1], 2.6);
	pondLayout(furnisher);
}

function addPondExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("birdbath", 0, 1, { wallMargin: 0.7 });
	furnisher.floorItemsBetween("gardenLantern", 1, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("urn", 0, 2, { wallMargin: 0.4 });
}

export const pondRoom: RoomBlueprint = {
	catalog: {
		names: ["Salle du lac", "Bassin d'agrément", "Jardin du bassin"],
		width: [8, 11],
		depth: [7.5, 10],
		heightGround: [3.6, 4.0],
		heightUpper: [3.2, 3.6],
		tall: { chance: 0.3, height: [5.0, 5.6] },
		shapes: [
			["rect", 2],
			["octagon", 1.2],
			["apse", 0.8],
		],
		floors: ["mosaic", "stoneFlags", "greenhouseTiles"],
		walls: [
			"greenhouseBrick",
			"plaster",
			"wallpaperGreen",
			"tiles",
			"mossyBrick",
			"wallpaperTrellis",
		],
		ceilings: ["glass", "vault", "beams"],
		wainscotChance: 0.3,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Lake Room", "Ornamental Pool", "Pool Garden"],
	mapTint: "water",
	spawnWeight: { ground: 1.4 },
	furnish: furnishPond,
	extras: addPondExtras,
	fillers: [
		["flowerPot", "floor"],
		["pottedPlant", "floor"],
		["bench", "floor"],
		["statue", "floor"],
	],
	hidingSpots: ["curtainAlcove", "wardrobe"],
};
