import { normalize2, rotate2 } from "../../math.js";
import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { FurnitureItem } from "../types.js";
import type { RoomBlueprint } from "./blueprint.js";
import {
	chandeliers,
	distanceSquared,
	midpoint,
	windowsFor,
} from "./kit/placements.js";

function chapelLayout(furnisher: RoomFurnisher): void {
	const room = furnisher.room;
	const entry = furnisher.roomOpenings[0];

	const entryPoint = entry
		? midpoint(furnisher.openingSide(entry))
		: room.labelPoint;

	let farthest = room.polygon[0];

	for (const point of room.polygon) {
		if (
			distanceSquared(point, entryPoint) > distanceSquared(farthest, entryPoint)
		) {
			farthest = point;
		}
	}

	const towardAltar = normalize2({
		x: farthest.x - entryPoint.x,
		z: farthest.z - entryPoint.z,
	});

	const altarRotation = Math.atan2(towardAltar.x, -towardAltar.z);
	const pewRotation = Math.atan2(-towardAltar.x, towardAltar.z);
	let estrade: FurnitureItem | null = null;

	for (let back = 2.0; back < 5 && !estrade; back += 0.5) {
		estrade = furnisher.floorItem("estrade", {
			variant: 0,
			at: {
				x: farthest.x - towardAltar.x * back,
				z: farthest.z - towardAltar.z * back,
			},
			rotation: altarRotation,
			wallMargin: 0.2,
		});
	}

	if (estrade) {
		const altar = furnisher.floorItem("altar", {
			at: { x: estrade.x, z: estrade.z },
			rotation: estrade.rotation,
			platform: estrade,
		});

		if (altar) {
			furnisher.decorateSurface(
				altar,
				[
					["candle", 5],
					["openBook", 1],
					["skull", 1],
				],
				2,
				3,
			);
		}

		for (const side of [-1, 1]) {
			const local = rotate2({ x: side * 1.6, z: 0.4 }, altarRotation);

			furnisher.floorItem("candelabra", {
				at: { x: estrade.x + local.x, z: estrade.z + local.z },
			});
		}
	}

	const lateral = { x: -towardAltar.z, z: towardAltar.x };
	const start = estrade ? { x: estrade.x, z: estrade.z } : room.labelPoint;

	for (let row = 0; row < 7; row += 1) {
		const distance = 2.4 + row * 1.15;

		for (const side of [-1, 1]) {
			furnisher.floorItem("pew", {
				variant: 1,
				at: {
					x: start.x - towardAltar.x * distance + lateral.x * side * 1.75,
					z: start.z - towardAltar.z * distance + lateral.z * side * 1.75,
				},
				rotation: pewRotation,
				wallMargin: 0.2,
			});
		}
	}
}

function furnishChapel(furnisher: RoomFurnisher): void {
	windowsFor(furnisher, [4], 2.4);
	chapelLayout(furnisher);
	furnisher.wallItemsBetween("confessional", 0, 1);
	furnisher.floorItemsBetween("lectern", 0, 1, { wallMargin: 1.0 });
	furnisher.floorItemsBetween("pillar", 0, 2, { wallMargin: 1.4 });
	furnisher.wallDecorBetween("tapestry", 1, 2);
	furnisher.wallDecorBetween("sconce", 1, 2);
	chandeliers(furnisher, 2);
	furnisher.cobwebs(2, 4);
}

function addChapelExtras(furnisher: RoomFurnisher): void {
	furnisher.wallDecorBetween("crucifix", 1, 2);
	furnisher.floorItemsBetween("urn", 0, 1, { wallMargin: 0.4 });
	furnisher.floorItemsBetween("torchere", 0, 2, { wallMargin: 0.5 });
}

export const chapelRoom: RoomBlueprint = {
	catalog: {
		names: ["Chapelle", "Oratoire"],
		width: [6, 8],
		depth: [9, 12.5],
		heightGround: [3.7, 4.0],
		heightUpper: [3.2, 3.4],
		tall: { chance: 0.45, height: [5.4, 6.0] },
		shapes: [["apse", 1]],
		floors: ["stoneFlags", "mosaic"],
		walls: ["stoneBlocks", "plaster", "rubbleStone"],
		ceilings: ["vault"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	englishNames: ["Chapel", "Oratory"],
	mapTint: "occult",
	spawnWeight: { ground: 1.2 },
	furnish: furnishChapel,
	extras: addChapelExtras,
	fillers: [
		["pew", "floor"],
		["statue", "floor"],
		["candelabra", "floor"],
		["pillar", "floor"],
	],
	hidingSpots: ["curtainAlcove", "confessional"],
};
