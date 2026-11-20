import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { ceilingBetween, moonlight } from "./kit/placements.js";

function placeCentralRing(furnisher: RoomFurnisher): void {
	const room = furnisher.room;

	const ring =
		furnisher.floorItem("mushroomRing", {
			at: room.labelPoint,
			rotation: room.axisAngle,
			variant: 1,
			wallMargin: 1.0,
		}) ?? furnisher.floorItem("mushroomRing", { variant: 0, wallMargin: 1.0 });

	if (!ring) {
		return;
	}

	furnisher.floorItem("floatingCrystal", {
		at: { x: ring.x, z: ring.z },
		rotation: ring.rotation,
		allowOverlapWith: [ring.id],
	});
}

function furnishFairyRing(furnisher: RoomFurnisher): void {
	placeCentralRing(furnisher);
	furnisher.floorItemsBetween("runeStone", 2, 4, { wallMargin: 0.7 });
	furnisher.wallItemsBetween("fairyPortal", 1, 1);
	furnisher.floorItemsBetween("giantMushroom", 1, 2, { wallMargin: 0.8 });
	furnisher.floorItemsBetween("mushroomPatch", 2, 4, { wallMargin: 0.3 });
	furnisher.floorItemsBetween("mossCarpet", 2, 3, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("floorCandles", 1, 2, { wallMargin: 0.4 });
	furnisher.wallDecorBetween("wallMushrooms", 1, 2);
	ceilingBetween(furnisher, "sporeSac", 0, 1);
	ceilingBetween(furnisher, "hangingMycelium", 1, 2);

	if (furnisher.room.style.ceiling === "glass") {
		moonlight(furnisher, 0.9);
	}

	furnisher.cobwebs(0, 2);
}

function addFairyRingExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("crystalCluster", 0, 2, { wallMargin: 0.5 });
	furnisher.floorItemsBetween("statue", 0, 1, { wallMargin: 0.8 });
	furnisher.wallDecorBetween("bracketFungus", 0, 2);
	furnisher.wallDecorBetween("myceliumVeins", 0, 1);
}

export const fairyRingRoom: RoomBlueprint = {
	catalog: {
		names: ["Rond de sorcières", "Clairière enchantée", "Cercle des fées"],
		width: [7, 10],
		depth: [7, 9.5],
		heightGround: [3.5, 4.0],
		heightUpper: [3.0, 3.4],
		tall: { chance: 0.25, height: [5.0, 5.6] },
		shapes: [
			["octagon", 2],
			["heptagon", 1],
			["rect", 1],
		],
		floors: ["soil", "mosaic"],
		walls: ["mossyBrick", "rubbleStone", "wallpaperStars"],
		ceilings: ["vault", "glass"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Fairy Ring", "Enchanted Glade", "Circle of the Fae"],
	mapTint: "arcane",
	atmosphere: { kind: "fae", density: 1 },
	spawnWeight: { ground: 0.8, upper: 0.6 },
	furnish: furnishFairyRing,
	extras: addFairyRingExtras,
	fillers: [
		["runeStone", "floor"],
		["giantMushroom", "floor"],
		["crystalCluster", "floor"],
	],
	hidingSpots: ["curtainAlcove", "trunk"],
};
