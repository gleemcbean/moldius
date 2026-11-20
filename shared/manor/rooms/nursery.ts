import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { ghostFurniture, randomRugs, windowsFor } from "./kit/placements.js";

const NURSERY_DECOR = [
	["doll", 4],
	["candle", 2],
	["books", 1],
] as const;

function furnishNursery(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [0, 1]);

	const crib = furnisher.floorItem("crib", { wallMargin: 0.5 });
	const horse = furnisher.floorItem("rockingHorse", { wallMargin: 0.6 });

	if (!crib && !horse) {
		furnisher.floorItem("rockingHorse", {
			wallMargin: 0.15,
			ignoreKeepClear: true,
		});
	}

	furnisher.wallItemsBetween("wardrobe", 1, 1);
	furnisher.wallItemsBetween("trunk", 0, 1);

	furnisher
		.wallItemsBetween("dresser", 1, 1)
		.forEach(
			(dresser) => void furnisher.decorateSurface(dresser, NURSERY_DECOR, 2, 3),
		);

	furnisher
		.wallItemsBetween("chest", 1, 1)
		.forEach(
			(chest) => void furnisher.decorateSurface(chest, [["doll", 1]], 1, 2),
		);

	furnisher.wallItemsBetween("shelf", 0, 1);
	ghostFurniture(furnisher, 0, 1);
	furnisher.floorItemsBetween("floorBall", 1, 2, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("smallBox", 0, 2, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("floorLamp", 0, 1, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("painting", 0, 1);
	furnisher.wallDecorBetween("mirror", 0, 1);
	furnisher.wallDecorBetween("sconce", 0, 1);
	randomRugs(furnisher, 1, 1);
	furnisher.cobwebs(2, 3);
}

function addNurseryExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("dollhouse", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("rockingChair", 0, 1, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("wallClock", 0, 1);
}

export const nurseryRoom: RoomBlueprint = {
	catalog: {
		names: ["Nursery", "Chambre d'enfant", "Salle de jeux"],
		width: [4.5, 6.5],
		depth: [4.5, 6],
		heightGround: [3.0, 3.4],
		heightUpper: [2.8, 3.1],
		shapes: [
			["rect", 2],
			["heptagon", 0.6],
		],
		floors: ["oakPlanks", "parquet"],
		walls: ["wallpaperNursery"],
		ceilings: ["plaster", "beams"],
		wainscotChance: 0.6,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Nursery", "Children's Room", "Playroom"],
	mapTint: "private",
	spawnWeight: { ground: 0.6, upper: 1.2 },
	furnish: furnishNursery,
	extras: addNurseryExtras,
	hidingSpots: ["trunk", "wardrobe"],
};
