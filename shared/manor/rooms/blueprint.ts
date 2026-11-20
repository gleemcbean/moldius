import type { RoomFurnisher } from "../furnish/RoomFurnisher.js";
import type { RoomTypeDefinition } from "../roomCatalog.js";

export type RoomRecipe = (furnisher: RoomFurnisher) => void;

export type RoomCatalogEntry = Omit<RoomTypeDefinition, "type">;

export type MapTint =
	| "reception"
	| "service"
	| "private"
	| "occult"
	| "garden"
	| "water"
	| "fungal"
	| "ruins"
	| "arcane"
	| "passage"
	| "stairs"
	| "neutral";

export type FillerPlacement = "wall" | "floor";

export type RoomFiller = readonly [kind: string, placement: FillerPlacement];

export type AtmosphereKind = "spores" | "fae";

export interface RoomAtmosphere {
	kind: AtmosphereKind;
	density: number;
}

export interface SpawnWeight {
	ground?: number;
	upper?: number;
}

export interface RoomBlueprint {
	catalog: RoomCatalogEntry;
	englishNames: readonly string[];
	mapTint: MapTint;
	atmosphere?: RoomAtmosphere;
	spawnWeight?: SpawnWeight;
	furnish: RoomRecipe;
	extras?: RoomRecipe;
	fillers?: readonly RoomFiller[];
	hidingSpots?: readonly string[];
}
