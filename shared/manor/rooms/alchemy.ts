import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { ceilingBetween, windowsFor } from "./kit/placements.js";

const ALCHEMY_DECOR = [
	["potions", 4],
	["bellJar", 1],
	["alembic", 2],
	["jar", 2],
	["candle", 2],
	["skull", 1],
	["openBook", 1],
	["mortar", 2],
	["crystalBall", 1],
	["scrolls", 1],
	["fungusJar", 2],
] as const;

function furnishAlchemy(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [3, 2], 3);
	furnisher.floorItemsBetween("cauldron", 1, 2, { wallMargin: 1.0 });

	const tables = furnisher.floorItemsBetween("alchemyTable", 1, 2, {
		wallMargin: 0.9,
	});

	tables.forEach(
		(table) => void furnisher.decorateSurface(table, ALCHEMY_DECOR, 2, 4),
	);

	furnisher.wallItemsBetween("potionShelf", 2, 3);
	furnisher.wallItemsBetween("bookcase", 0, 1);
	furnisher.wallItemsBetween("wardrobe", 0, 1);
	furnisher.floorItemsBetween("crate", 0, 2, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("barrel", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("vialCluster", 1, 3, { wallMargin: 0.3 });
	furnisher.wallItemsBetween("displayCase", 0, 1);
	furnisher.wallDecorBetween("hangingHerbs", 0, 2);
	furnisher.wallDecorBetween("pipeRun", 0, 1);
	furnisher.wallDecorBetween("wallShelf", 0, 1);
	furnisher.wallDecorBetween("sconce", 0, 1);
	furnisher.cobwebs(2, 4);
	furnisher.hangingCobwebs(1);
}

function addAlchemyExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("stool", 0, 1, { wallMargin: 0.4 });
	ceilingBetween(furnisher, "hangingCage", 0, 1);
	furnisher.wallDecorBetween("spiceRack", 0, 1);
	furnisher.floorItemsBetween("crystalCluster", 0, 1, { wallMargin: 0.5 });
	furnisher.wallDecorBetween("bracketFungus", 0, 1);
}

export const alchemyRoom: RoomBlueprint = {
	catalog: {
		names: ["Laboratoire d'alchimie", "Officine", "Distillerie"],
		width: [5.5, 8],
		depth: [5.5, 8],
		heightGround: [3.2, 3.8],
		heightUpper: [2.9, 3.3],
		shapes: [
			["octagon", 2],
			["rect", 1],
			["heptagon", 1],
		],
		floors: ["stoneFlags", "darkPlanks"],
		walls: ["stoneBlocks", "brick", "plaster", "rubbleStone"],
		ceilings: ["beams", "vault"],
		wainscotChance: 0.1,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Alchemy Lab", "Apothecary", "Distillery"],
	mapTint: "occult",
	spawnWeight: { ground: 1.2, upper: 0.8 },
	furnish: furnishAlchemy,
	extras: addAlchemyExtras,
};
