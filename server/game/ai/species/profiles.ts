import type { SpeciesDefinition } from "../../../../shared/config/species.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { inMeleeReach, meleeStrike } from "../combat.js";
import type { HunterProfile } from "../hunter.js";

export function meleeProfile(
	definition: SpeciesDefinition,
	overrides: Partial<HunterProfile> = {},
): HunterProfile {
	return {
		patrolSpeed: definition.calmSpeed,
		chaseSpeed: definition.hostileSpeed,
		canHunt: true,
		canInvestigate: true,
		canExtract: true,
		preferredRange: null,
		windupMs: definition.windupMs,
		recoveryMs: definition.recoveryMs,
		readyToAttack: (match: Match, entity: AnomalyEntity, target: MatchPlayer) =>
			inMeleeReach(match, entity, target, -0.05),
		strike: (match: Match, entity: AnomalyEntity, target: MatchPlayer) => {
			const hit = meleeStrike(match, entity, target);
			match.emit({
				type: "attack",
				anomalyId: entity.id,
				phase: "strike",
				targetId: target.id,
				hit,
			});
		},
		...overrides,
	};
}
