import type { RoomFiller } from "../rooms/blueprint.js";
import { roomBlueprint } from "../rooms/index.js";
import type { RoomFurnisher } from "./RoomFurnisher.js";

const LARGE_ROOM_AREA = 45;
const LARGE_ROOM_COVERAGE = 0.16;
const LARGE_ROOM_BORDER = 2;
const GRAND_ROOM_COVERAGE = 0.2;
const GRAND_ROOM_BORDER = 7;

const DEFAULT_FILLERS: readonly RoomFiller[] = [
	["sheetedFurniture", "floor"],
	["bust", "floor"],
	["urn", "floor"],
	["screen", "floor"],
	["statue", "floor"],
	["pottedPlant", "floor"],
	["candelabra", "floor"],
	["crate", "floor"],
	["chest", "wall"],
	["armor", "wall"],
];

export function fillLargeRoom(furnisher: RoomFurnisher): void {
	const room = furnisher.room;
	const fillers = roomBlueprint(room.type).fillers ?? DEFAULT_FILLERS;

	if (room.area < LARGE_ROOM_AREA || fillers.length === 0) {
		return;
	}

	const coverage = room.mezzanine ? GRAND_ROOM_COVERAGE : LARGE_ROOM_COVERAGE;
	const border = room.mezzanine ? GRAND_ROOM_BORDER : LARGE_ROOM_BORDER;

	for (
		let attempt = 0;
		attempt < 40 && furnisher.coverage() < coverage;
		attempt += 1
	) {
		const [kind, placement] = furnisher.rng.pick(fillers);

		if (placement === "wall") {
			furnisher.wallItem(kind);
			continue;
		}

		for (let tries = 0; tries < 8; tries += 1) {
			const at = furnisher.randomInteriorPoint(0.8);

			if (
				at &&
				furnisher.distanceToWalls(at) <= border &&
				furnisher.floorItem(kind, {
					at,
					wallMargin: 0.8,
				})
			) {
				break;
			}
		}
	}
}
