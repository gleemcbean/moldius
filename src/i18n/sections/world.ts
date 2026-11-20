import { ROOM_BLUEPRINTS, ROOM_TYPE_IDS } from "@shared/manor/rooms/index";
import type { RoomType } from "@shared/manor/types";
import type { ManorSize } from "@shared/matchConfig";

export const HIDEABLE_KINDS = [
	"wardrobe",
	"lockers",
	"confessional",
	"trunk",
	"curtainAlcove",
	"cask",
	"standingCoffin",
] as const;

export type HideableKind = (typeof HIDEABLE_KINDS)[number];

function roomNames(
	pick: (type: RoomType) => readonly string[],
): Record<RoomType, readonly string[]> {
	return Object.fromEntries(
		ROOM_TYPE_IDS.map((type) => [type, pick(type)]),
	) as Record<RoomType, readonly string[]>;
}

function firstNames(
	names: Record<RoomType, readonly string[]>,
): Record<RoomType, string> {
	return Object.fromEntries(
		ROOM_TYPE_IDS.map((type) => [type, names[type][0] ?? type]),
	) as Record<RoomType, string>;
}

const ROOM_NAMES_FR = roomNames((type) => ROOM_BLUEPRINTS[type].catalog.names);
const ROOM_NAMES_EN = roomNames((type) => ROOM_BLUEPRINTS[type].englishNames);

export const worldFr = {
	rooms: ROOM_NAMES_FR,
	roomChips: firstNames(ROOM_NAMES_FR),
	stairwellLabel: "Escalier",
	manorSizes: {
		small: "Petit",
		medium: "Moyen",
		large: "Grand",
	} satisfies Record<ManorSize, string>,
	furniture: {
		wardrobe: "armoire",
		lockers: "casiers",
		confessional: "confessionnal",
		trunk: "malle",
		curtainAlcove: "rideaux",
		cask: "grand tonneau",
		standingCoffin: "cercueil",
	} satisfies Record<HideableKind, string>,
	hidingPlace: "cachette",
};

export const worldEn: typeof worldFr = {
	rooms: ROOM_NAMES_EN,
	roomChips: firstNames(ROOM_NAMES_EN),
	stairwellLabel: "Stairs",
	manorSizes: { small: "Small", medium: "Medium", large: "Large" },
	furniture: {
		wardrobe: "wardrobe",
		lockers: "lockers",
		confessional: "confessional",
		trunk: "trunk",
		curtainAlcove: "curtains",
		cask: "large cask",
		standingCoffin: "coffin",
	},
	hidingPlace: "hiding place",
};
