import { SPECIES } from "../../../../shared/config/species.js";
import type { Match } from "../../Match.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { updateHunter } from "../hunter.js";
import { perceive } from "../perception.js";
import { meleeProfile } from "./profiles.js";

const PROFILE = meleeProfile(SPECIES.veilleur);

export function updateVeilleur(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	updateHunter(match, entity, dt, PROFILE, perceive(match, entity, dt));
}
