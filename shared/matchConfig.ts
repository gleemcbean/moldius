import {
	DEFAULT_ITEMS_PER_PLAYER,
	MANOR_GROUND_ROOM_COUNT,
	MANOR_UPPER_LEVEL_SHARE,
	MANOR_UPPER_ROOM_COUNT,
	MATCH_DURATION_MS,
	MAX_ITEMS_PER_PLAYER,
	MAX_MATCH_MINUTES,
	MAX_SIMULTANEOUS_ANOMALIES,
	MAX_UPPER_FLOORS,
	MIN_ITEMS_PER_PLAYER,
	MIN_MATCH_MINUTES,
	MIN_SIMULTANEOUS_ANOMALIES,
	PUBLIC_SIMULTANEOUS_ANOMALIES,
} from "./config/index.js";
import { STAKE_KINDS } from "./config/items.js";
import { ENABLED_SPECIES_IDS } from "./config/monsters.js";
import type { SpeciesId } from "./config/species.js";
import { OPTIONAL_ROOM_TYPES } from "./manor/roomCatalog.js";
import type { RoomType } from "./manor/types.js";
import { isTeamCount } from "./teams.js";

export type ManorSize = "small" | "medium" | "large";

export interface MatchConfig {
	simultaneousAnomalies: number;
	manorSize: ManorSize;
	roomTypes: RoomType[];
	floors: number;
	upperFloorSize: ManorSize;
	stairCount: 1 | 2;
	species: SpeciesId[];
	durationMinutes: number;
	teamCount: number;
	itemsPerPlayer: number;
	walkies: boolean;
}

export const MANOR_SIZES: readonly ManorSize[] = ["small", "medium", "large"];

export const PUBLIC_MATCH_CONFIG: MatchConfig = Object.freeze({
	simultaneousAnomalies: PUBLIC_SIMULTANEOUS_ANOMALIES,
	manorSize: "medium",
	roomTypes: [...OPTIONAL_ROOM_TYPES],
	floors: 1,
	upperFloorSize: "medium",
	stairCount: 1,
	species: [...ENABLED_SPECIES_IDS],
	durationMinutes: MATCH_DURATION_MS / 60_000,
	teamCount: 0,
	itemsPerPlayer: DEFAULT_ITEMS_PER_PLAYER,
	walkies: true,
}) as MatchConfig;

export const TUTORIAL_SEED = 2024;
export const TUTORIAL_WOUNDED_HEALTH = 50;

const TUTORIAL_MATCH_MINUTES = 15;

export const TUTORIAL_MATCH_CONFIG: MatchConfig = Object.freeze({
	simultaneousAnomalies: 1,
	manorSize: "small",
	roomTypes: OPTIONAL_ROOM_TYPES.filter(
		(type) => !(STAKE_KINDS as readonly string[]).includes(type),
	),
	floors: 1,
	upperFloorSize: "small",
	stairCount: 1,
	species: ["murmure"],
	durationMinutes: TUTORIAL_MATCH_MINUTES,
	teamCount: 0,
	itemsPerPlayer: 10,
	walkies: false,
}) as MatchConfig;

export function defaultPrivateConfig(): MatchConfig {
	return {
		...PUBLIC_MATCH_CONFIG,
		roomTypes: [...OPTIONAL_ROOM_TYPES],
		species: [...ENABLED_SPECIES_IDS],
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isManorSize(value: unknown): value is ManorSize {
	return (
		typeof value === "string" &&
		(MANOR_SIZES as readonly string[]).includes(value)
	);
}

function plannedRooms(
	config: Pick<MatchConfig, "manorSize" | "floors" | "upperFloorSize">,
): number {
	let rooms = MANOR_GROUND_ROOM_COUNT[config.manorSize];
	const floors = Math.max(0, Math.min(MAX_UPPER_FLOORS, config.floors));
	for (let level = 0; level < floors; level += 1) {
		rooms +=
			MANOR_UPPER_ROOM_COUNT[config.upperFloorSize] *
			MANOR_UPPER_LEVEL_SHARE[level];
	}
	return rooms;
}

/**
 * Le réglage par joueur vaut pour le manoir des parties publiques : la quantité
 * suit ensuite le nombre de salles prévues, pour garder la même densité.
 */
export function pickupTotal(config: MatchConfig, players: number): number {
	const scale = plannedRooms(config) / plannedRooms(PUBLIC_MATCH_CONFIG);
	return Math.max(
		1,
		Math.round(config.itemsPerPlayer * Math.max(1, players) * scale),
	);
}

export function sanitizeMatchConfig(
	input: unknown,
	fallback: MatchConfig,
): MatchConfig {
	if (!isRecord(input)) {
		return fallback;
	}
	const simultaneous =
		typeof input.simultaneousAnomalies === "number" &&
		Number.isFinite(input.simultaneousAnomalies)
			? Math.round(input.simultaneousAnomalies)
			: fallback.simultaneousAnomalies;
	const roomTypes = Array.isArray(input.roomTypes)
		? input.roomTypes.filter(
				(type): type is RoomType =>
					typeof type === "string" &&
					(OPTIONAL_ROOM_TYPES as string[]).includes(type),
			)
		: fallback.roomTypes;
	const species = Array.isArray(input.species)
		? ENABLED_SPECIES_IDS.filter((id) =>
				(input.species as unknown[]).includes(id),
			)
		: [];
	return {
		simultaneousAnomalies: Math.min(
			MAX_SIMULTANEOUS_ANOMALIES,
			Math.max(MIN_SIMULTANEOUS_ANOMALIES, simultaneous),
		),
		manorSize: isManorSize(input.manorSize)
			? input.manorSize
			: fallback.manorSize,
		roomTypes: [...new Set(roomTypes)],
		floors: sanitizeFloors(input, fallback.floors),
		upperFloorSize: isManorSize(input.upperFloorSize)
			? input.upperFloorSize
			: fallback.upperFloorSize,
		stairCount:
			input.stairCount === 2
				? 2
				: input.stairCount === 1
					? 1
					: fallback.stairCount,
		species: species.length > 0 ? species : [...fallback.species],
		itemsPerPlayer:
			typeof input.itemsPerPlayer === "number" &&
			Number.isFinite(input.itemsPerPlayer)
				? Math.min(
						MAX_ITEMS_PER_PLAYER,
						Math.max(MIN_ITEMS_PER_PLAYER, Math.round(input.itemsPerPlayer)),
					)
				: fallback.itemsPerPlayer,
		durationMinutes:
			typeof input.durationMinutes === "number" &&
			Number.isFinite(input.durationMinutes)
				? Math.min(
						MAX_MATCH_MINUTES,
						Math.max(MIN_MATCH_MINUTES, Math.round(input.durationMinutes)),
					)
				: fallback.durationMinutes,
		teamCount: isTeamCount(input.teamCount)
			? input.teamCount
			: fallback.teamCount,
		walkies:
			typeof input.walkies === "boolean" ? input.walkies : fallback.walkies,
	};
}

export function matchDurationMs(config: MatchConfig): number {
	return config.durationMinutes * 60_000;
}

function sanitizeFloors(
	input: Record<string, unknown>,
	fallback: number,
): number {
	if (typeof input.floors === "number" && Number.isFinite(input.floors)) {
		return Math.min(MAX_UPPER_FLOORS, Math.max(0, Math.round(input.floors)));
	}
	if (typeof input.upperFloor === "boolean") {
		return input.upperFloor ? 1 : 0;
	}
	return fallback;
}
