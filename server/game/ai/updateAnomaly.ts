import type { SpeciesId } from "../../../shared/config/species.js";
import type { Match } from "../Match.js";
import type { AnomalyEntity } from "./AnomalyEntity.js";
import { pulseProgress, updateArchiviste } from "./species/archiviste.js";
import { updateBoursoufle } from "./species/boursoufle.js";
import { hazeStrength, updateBrume } from "./species/brume.js";
import { updateColosse } from "./species/colosse.js";
import { updateCollecteur } from "./species/collecteur.js";
import { updateDouble } from "./species/double.js";
import { updateFulgurant } from "./species/fulgurant.js";
import { gazeFraction, updateGorgone } from "./species/gorgone.js";
import { isScreaming, updateHurleur } from "./species/hurleur.js";
import { updateLuciole } from "./species/luciole.js";
import { updateMurmure } from "./species/murmure.js";
import { updateCracheCendre, updateSuinteur } from "./species/ranged.js";
import { updateRatRoi } from "./species/ratRoi.js";
import { updateVeilleur } from "./species/veilleur.js";

type Updater = (match: Match, entity: AnomalyEntity, dt: number) => void;

const UPDATERS: Record<SpeciesId, Updater> = {
	murmure: updateMurmure,
	veilleur: updateVeilleur,
	"crache-cendre": updateCracheCendre,
	collecteur: updateCollecteur,
	archiviste: updateArchiviste,
	luciole: updateLuciole,
	double: updateDouble,
	hurleur: updateHurleur,
	suinteur: updateSuinteur,
	boursoufle: updateBoursoufle,
	colosse: updateColosse,
	fulgurant: updateFulgurant,
	gorgone: updateGorgone,
	brume: updateBrume,
	"rat-roi": updateRatRoi,
};

export function updateAnomaly(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	UPDATERS[entity.species](match, entity, dt);
}

export function anomalyExtra(entity: AnomalyEntity, now: number): number {
	switch (entity.species) {
		case "murmure":
			return entity.hostile
				? 1
				: entity.state === "special"
					? Math.min(0.99, entity.stateAge(now) / 1200)
					: 0;
		case "double":
			return entity.revealed
				? 1
				: entity.state === "special"
					? Math.min(0.99, entity.stateAge(now) / 900)
					: 0;
		case "boursoufle":
			return entity.swell;
		case "hurleur":
			return isScreaming(entity, now) ? 1 : 0;
		case "archiviste":
			return pulseProgress(entity, now);
		case "collecteur":
			return entity.carryingPlayerId ? 1 : 0;
		case "fulgurant":
			if (entity.state === "windup") {
				return Math.min(1, entity.stateAge(now) / entity.definition.windupMs);
			}
			return entity.state === "special"
				? Math.max(0, 1 - entity.stateAge(now) / entity.definition.recoveryMs)
				: 0;
		case "gorgone":
			return entity.state === "special" ||
				entity.state === "chase" ||
				entity.state === "windup"
				? 1
				: Math.min(0.99, gazeFraction(entity));
		case "brume":
			return hazeStrength(entity, now);
		case "rat-roi":
			return entity.scatter;
		default:
			return 0;
	}
}
