import type { RoomFiller } from "../rooms/blueprint.js";
import type { RoomFurnisher } from "./RoomFurnisher.js";

export const SMALL_ROOM_AREA = 26;
const TINY_ROOM_AREA = 8;

const SMALL_ROOM_ESSENTIALS = new Set([
	"toilet",
	"sink",
	"bathtub",
	"valveStation",
	"occultAltar",
	"stakeSanctuary",
	"stakeReliquary",
	"stakePact",
	"fireplace",
	"stove",
	"kitchenCounter",
	"pond",
	"estrade",
	"workbench",
]);

const SMALL_ROOM_FILLERS: readonly RoomFiller[] = [
	["chest", "wall"],
	["cabinet", "wall"],
	["shelf", "wall"],
	["trunk", "wall"],
	["crate", "floor"],
	["stool", "floor"],
	["sideTable", "floor"],
	["pottedPlant", "floor"],
	["logBasket", "floor"],
	["laundryBasket", "floor"],
	["umbrellaStand", "floor"],
	["bookPile", "floor"],
];

const TINY_ROOM_FILLERS: readonly RoomFiller[] = [
	["umbrellaStand", "floor"],
	["bookPile", "floor"],
	["broom", "floor"],
	["crate", "floor"],
	["stool", "floor"],
];

export function balanceRoom(furnisher: RoomFurnisher): void {
	const { room, rng } = furnisher;

	if (
		room.area >= SMALL_ROOM_AREA ||
		room.type === "stairwell" ||
		room.type === "corridor"
	) {
		return;
	}

	if (
		room.type === "toilets" &&
		!furnisher.items.some((i) => i.kind === "toilet")
	) {
		for (const item of furnisher.floorStandingItems()) {
			if (
				item.kind !== "valveStation" &&
				item.kind !== "occultAltar" &&
				!item.kind.startsWith("stake")
			) {
				furnisher.removeItem(item);
			}
		}

		furnisher.wallItem("toilet");
	}

	const tiny = room.area < TINY_ROOM_AREA;
	const maxCoverage = tiny ? 0.3 : 0.27;
	const minCoverage = tiny ? 0.07 : 0.15;
	const maxCount = tiny ? 3 : Math.max(4, Math.round(room.area / 3.4));

	const removable = () =>
		furnisher.floorStandingItems().filter((item) => {
			const beds = furnisher.items.filter((other) => other.kind === "bed");

			const duplicate =
				item.kind !== "valveStation" &&
				item.kind !== "occultAltar" &&
				!item.kind.startsWith("stake") &&
				furnisher.items.filter((other) => other.kind === item.kind).length > 1;

			return (
				item.hideSpotId === null &&
				(!SMALL_ROOM_ESSENTIALS.has(item.kind) || duplicate) &&
				!(item.kind === "bed" && beds.length === 1)
			);
		});

	while (
		furnisher.coverage() > maxCoverage ||
		furnisher.floorStandingItems().length > maxCount
	) {
		const candidates = removable();

		if (candidates.length === 0) {
			break;
		}

		furnisher.removeItem(rng.pick(candidates));
	}

	const fillers = tiny ? TINY_ROOM_FILLERS : SMALL_ROOM_FILLERS;

	for (
		let attempt = 0;
		attempt < 24 &&
		furnisher.coverage() < minCoverage &&
		furnisher.floorStandingItems().length < maxCount;
		attempt += 1
	) {
		const [kind, placement] = rng.pick(fillers);

		if (placement === "wall") {
			furnisher.wallItem(kind);
		} else {
			furnisher.floorItem(kind, { wallMargin: tiny ? 0.2 : 0.4 });
		}
	}
}
