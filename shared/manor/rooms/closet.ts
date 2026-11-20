import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";

function furnishCloset(furnisher: RoomFurnisher): void {
	furnisher.wallItem("shelf", { variant: 2 });
	furnisher.floorItemsBetween("broom", 1, 2, { wallMargin: 0.15 });
	furnisher.floorItemsBetween("bucket", 1, 1, { wallMargin: 0.2 });
	furnisher.floorItemsBetween("vialCluster", 1, 2, { wallMargin: 0.15 });
	furnisher.floorItemsBetween("smallBox", 0, 1, { wallMargin: 0.15 });
	furnisher.wallDecorBetween("wallShelf", 0, 1);
	furnisher.cobwebs(3, 4);
	furnisher.hangingCobwebs(1);
}

function addClosetExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("umbrellaStand", 0, 1, { wallMargin: 0.15 });
	furnisher.wallDecorBetween("keyRack", 0, 1);
}

export const closetRoom: RoomBlueprint = {
	catalog: {
		names: ["Débarras", "Placard à balais"],
		width: [1.5, 2.0],
		depth: [1.5, 2.25],
		heightGround: [2.7, 2.95],
		heightUpper: [2.6, 2.8],
		low: { chance: 0.35, height: [2.4, 2.5] },
		shapes: [["rect", 1]],
		floors: ["darkPlanks"],
		walls: ["plaster", "woodPanels"],
		ceilings: ["planks"],
		wainscotChance: 0,
		singleDoor: true,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Storage Room", "Broom Cupboard"],
	mapTint: "service",
	spawnWeight: { upper: 1 },
	furnish: furnishCloset,
	extras: addClosetExtras,
};
