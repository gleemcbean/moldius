import { SPECIES } from "../../../../shared/config/species.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import { throwPlayer } from "../../systems/throwing.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { inMeleeReach, targetIsStrikeable } from "../combat.js";
import { updateHunter } from "../hunter.js";
import { perceive } from "../perception.js";
import { meleeProfile } from "./profiles.js";

const PROFILE = meleeProfile(SPECIES.colosse, {
	strike: (match: Match, entity: AnomalyEntity, target: MatchPlayer) => {
		const hit =
			targetIsStrikeable(match, target) &&
			inMeleeReach(match, entity, target, 0.45) &&
			throwPlayer(match, entity, target);
		match.emit({
			type: "attack",
			anomalyId: entity.id,
			phase: "strike",
			targetId: target.id,
			hit,
		});
	},
});

export function updateColosse(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	updateHunter(match, entity, dt, PROFILE, perceive(match, entity, dt));
}
