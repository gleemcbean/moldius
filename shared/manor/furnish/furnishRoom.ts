import { roomBlueprint } from "../rooms/index.js";
import { fillLargeRoom } from "./largeRoomFill.js";
import { dressMezzanine, grandRoomReliefs } from "./mezzanineDressing.js";
import type { RoomFurnisher } from "./RoomFurnisher.js";

export function furnishRoomByType(
	furnisher: RoomFurnisher,
	options: { valve: boolean },
): void {
	if (options.valve) {
		furnisher.wallItem("valveStation", { avoidExterior: false });
	}

	const blueprint = roomBlueprint(furnisher.room.type);

	grandRoomReliefs(furnisher);
	blueprint.furnish(furnisher);
	blueprint.extras?.(furnisher);
	fillLargeRoom(furnisher);
	dressMezzanine(furnisher);
}
