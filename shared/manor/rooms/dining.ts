import { rotate2 } from "../../math.js";
import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { chandeliers, tableSet, windowsFor } from "./kit/placements.js";

const DINING_DECOR = [
	["candle", 4],
	["plateSet", 5],
	["vase", 1],
	["teaSet", 1],
] as const;

function furnishDining(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1]);

	const room = furnisher.room;
	const extentAlong = rotate2({ x: 1, z: 0 }, room.axisAngle);
	const widthX = room.bounds.maxX - room.bounds.minX;
	const widthZ = room.bounds.maxZ - room.bounds.minZ;
	const longIsAxis = Math.abs(extentAlong.x) > 0.5 === widthX >= widthZ;
	const rotation = room.axisAngle + (longIsAxis ? 0 : Math.PI / 2);

	tableSet(furnisher, {
		variants: [3],
		chairs: [6, 10],
		decor: DINING_DECOR,
		at: room.labelPoint,
		rotation,
		rug: false,
	}) ??
		tableSet(furnisher, {
			variants: [1],
			chairs: [4, 6],
			decor: DINING_DECOR,
			rug: true,
		});

	void furnisher
		.wallItemsBetween("cabinet", 1, 2)
		.forEach(
			(cabinet) => void furnisher.decorateSurface(cabinet, DINING_DECOR, 1, 3),
		);

	furnisher.wallItemsBetween("fireplace", 0, 1);
	furnisher.wallItemsBetween("curtainAlcove", 0, 1);
	furnisher.floorItemsBetween("candelabra", 1, 2, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("painting", 1, 3);
	furnisher.wallDecorBetween("sconce", 0, 2);
	chandeliers(furnisher, 2);
	furnisher.cobwebs(1, 3);
}

function addDiningExtras(furnisher: RoomFurnisher): void {
	furnisher.wallDecorBetween("wallClock", 0, 1);
	furnisher.wallDecorBetween("antlers", 0, 1);
	furnisher.floorItemsBetween("torchere", 0, 2, { wallMargin: 0.4 });
}

export const diningRoom: RoomBlueprint = {
	catalog: {
		names: ["Salle à manger", "Salle des banquets"],
		width: [6.5, 10],
		depth: [5.5, 7.5],
		heightGround: [3.3, 3.9],
		heightUpper: [2.9, 3.3],
		shapes: [
			["rect", 2],
			["octagon", 1],
		],
		floors: ["parquet", "oakPlanks"],
		walls: [
			"wallpaperRed",
			"woodPanels",
			"wallpaperGreen",
			"wallpaperFleur",
			"wallpaperFloral",
		],
		ceilings: ["coffered", "beams"],
		wainscotChance: 0.8,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Dining Room", "Banquet Hall"],
	mapTint: "reception",
	furnish: furnishDining,
	extras: addDiningExtras,
	hidingSpots: ["curtainAlcove", "wardrobe"],
};
