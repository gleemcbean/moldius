import {
	type Formula,
	formulaKeyWord,
	generateFormulas,
} from "../../shared/anomalies/formulas.js";
import { ENABLED_SPECIES_IDS } from "../../shared/config/monsters.js";
import { OCCULT_IDS, type OccultId } from "../../shared/config/occult.js";
import { SPECIES_IDS, type SpeciesId } from "../../shared/config/species.js";
import type { SeededRandom } from "../../shared/random.js";

export interface RosterPlan {
	pool: SpeciesId[];
	instances: {
		species: SpeciesId;
		exemplar: number;
		exemplarCount: number;
		formula: Formula;
		occult: OccultId;
	}[];
}

const SPECIES_CAPS: Partial<Record<SpeciesId, number>> = {
	archiviste: 2,
	hurleur: 2,
	boursoufle: 3,
	double: 3,
	colosse: 2,
	fulgurant: 2,
	gorgone: 2,
};

export function planRoster(
	rng: SeededRandom,
	count: number,
	previousWords: ReadonlySet<string>,
	allowed: readonly SpeciesId[] = ENABLED_SPECIES_IDS,
): RosterPlan {
	const poolSize = Math.min(count, rng.int(6, 8));
	const pool = rng
		.shuffle(SPECIES_IDS.filter((id) => allowed.includes(id)))
		.slice(0, poolSize);
	if (pool.length === 0) {
		return { pool: [], instances: [] };
	}
	const assigned: SpeciesId[] = [...pool];
	const capped = (species: SpeciesId) =>
		assigned.filter((entry) => entry === species).length >=
		(SPECIES_CAPS[species] ?? 6);
	while (assigned.length < count) {
		const candidates = pool.filter((species) => !capped(species));
		const choice =
			candidates.length > 0 ? rng.pick(candidates) : rng.pick(pool);
		assigned.push(choice);
	}
	if (pool.length > count) {
		assigned.length = count;
	}
	const species = [...new Set(assigned)];
	const generated = generateFormulas(rng, species.length, previousWords);
	const formulaOf = new Map(
		species.map((entry, index) => [entry, generated[index]]),
	);
	const occultRng = rng.fork("occult");
	const occultOf = new Map(
		species.map((entry) => [entry, occultRng.pick(OCCULT_IDS)]),
	);
	const counts = new Map<SpeciesId, number>();
	for (const species of assigned) {
		counts.set(species, (counts.get(species) ?? 0) + 1);
	}
	const seen = new Map<SpeciesId, number>();
	const instances = assigned.map((entry) => {
		const exemplar = (seen.get(entry) ?? 0) + 1;
		seen.set(entry, exemplar);
		return {
			species: entry,
			exemplar,
			exemplarCount: counts.get(entry) ?? 0,
			formula: formulaOf.get(entry) as Formula,
			occult: occultOf.get(entry) as OccultId,
		};
	});
	return { pool: species, instances };
}

export function formulaWords(plan: RosterPlan): Set<string> {
	return new Set(
		plan.instances.flatMap((instance) => instance.formula.map(formulaKeyWord)),
	);
}
