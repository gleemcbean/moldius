import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomBlueprint } from "./blueprint.js";
import { RITUAL_DECOR } from "./kit/decorSets.js";
import { ceilingBetween, estradeWith } from "./kit/placements.js";

function ritualCircleLayout(furnisher: RoomFurnisher): void {
	const room = furnisher.room;

	const circle =
		furnisher.floorItem("ritualCircle", {
			at: room.labelPoint,
			rotation: 0,
			variant: 0,
		}) ??
		furnisher.floorItem("ritualCircle", {
			at: room.labelPoint,
			rotation: 0,
			variant: 1,
		});

	if (!circle) {
		return;
	}

	const radius = circle.width / 2 + 0.25;

	for (let index = 0; index < 5; index += 1) {
		const angle = (index / 5) * Math.PI * 2 + 0.3;

		furnisher.floorItem("floorCandles", {
			at: {
				x: circle.x + Math.cos(angle) * radius,
				z: circle.z + Math.sin(angle) * radius,
			},
			rotation: angle,
		});
	}
}

function furnishRitual(furnisher: RoomFurnisher): void {
	ritualCircleLayout(furnisher);

	const altar = estradeWith(furnisher, "altar");

	if (altar) {
		furnisher.decorateSurface(altar, RITUAL_DECOR, 2, 3);
	}

	furnisher.floorItemsBetween("candelabra", 2, 4, { wallMargin: 0.6 });
	furnisher.floorItemsBetween("pillar", 0, 2, { wallMargin: 1.2 });
	furnisher.wallItemsBetween("potionShelf", 0, 1);
	furnisher.wallItemsBetween("trunk", 0, 1);
	furnisher.wallItemsBetween("chest", 0, 1);
	furnisher.wallItemsBetween("lockers", 0, 1);
	furnisher.wallDecorBetween("tapestry", 1, 2);
	furnisher.floorItemsBetween("vialCluster", 0, 2, { wallMargin: 0.3 });
	furnisher.cobwebs(2, 4);
}

function addRitualExtras(furnisher: RoomFurnisher): void {
	furnisher.floorItemsBetween("urn", 0, 2, { wallMargin: 0.4 });
	furnisher.wallItemsBetween("throne", 0, 1);
	ceilingBetween(furnisher, "hangingCage", 0, 1);
	furnisher.floorItemsBetween("runeStone", 0, 1, { wallMargin: 0.6 });
}

export const ritualRoom: RoomBlueprint = {
	catalog: {
		names: ["Salle des rituels", "Antichambre noire", "Cercle intérieur"],
		width: [6.5, 9],
		depth: [6.5, 9],
		heightGround: [3.4, 3.95],
		heightUpper: [3.0, 3.4],
		shapes: [
			["octagon", 3],
			["heptagon", 1],
		],
		floors: ["stoneFlags", "mosaic"],
		walls: ["stoneBlocks", "wallpaperPurple", "rubbleStone"],
		ceilings: ["vault"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Ritual Chamber", "Black Antechamber", "Inner Circle"],
	mapTint: "occult",
	spawnWeight: { ground: 0.9, upper: 0.9 },
	furnish: furnishRitual,
	extras: addRitualExtras,
	hidingSpots: ["trunk", "lockers"],
};
