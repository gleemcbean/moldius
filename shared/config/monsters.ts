import { SPECIES_IDS, type SpeciesId } from "./species.js";

export const DISABLED_SPECIES: readonly SpeciesId[] = [];

export const ENABLED_SPECIES_IDS: readonly SpeciesId[] = SPECIES_IDS.filter(
	(id) => !DISABLED_SPECIES.includes(id),
);
