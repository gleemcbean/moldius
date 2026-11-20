import { roomBlueprint } from "../rooms/index.js";
import type { RoomFurnisher } from "./RoomFurnisher.js";

const DEFAULT_HIDING_SPOTS = ["wardrobe", "lockers", "trunk"];

export function topUpHidingSpots(furnisher: RoomFurnisher): void {
	const preferred = roomBlueprint(furnisher.room.type).hidingSpots;
	const options = furnisher.rng.shuffle(preferred ?? DEFAULT_HIDING_SPOTS);

	for (const kind of options) {
		if (furnisher.wallItem(kind)) {
			return;
		}
	}
}
