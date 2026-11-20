import {
	CORDYCEPS_INFECT_DAMAGE,
	CORDYCEPS_RIPEN_MS,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import { clamp } from "../../../../shared/math.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import { canBeInfected, infectPlayer } from "../../systems/infection.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { inMeleeReach, meleeStrike, targetIsStrikeable } from "../combat.js";
import { updateHunter } from "../hunter.js";
import { perceive } from "../perception.js";
import { meleeProfile } from "./profiles.js";

export function cordycepsRipeness(entity: AnomalyEntity, now: number): number {
	return clamp((now - entity.ripenSince) / CORDYCEPS_RIPEN_MS, 0, 1);
}

function infectingBite(
	match: Match,
	entity: AnomalyEntity,
	target: MatchPlayer,
): boolean {
	if (
		!targetIsStrikeable(match, target) ||
		!inMeleeReach(match, entity, target, 0.25)
	) {
		return false;
	}

	const hit = match.applyDamage(
		target,
		CORDYCEPS_INFECT_DAMAGE,
		entity.species,
		entity.center(),
	);

	if (hit && target.alive) {
		infectPlayer(match, target, entity);

		entity.ripenSince = match.now;
	}

	return hit;
}

function bite(
	match: Match,
	entity: AnomalyEntity,
	target: MatchPlayer,
): boolean {
	const ripe = cordycepsRipeness(entity, match.now) >= 1;

	return ripe && canBeInfected(match, target)
		? infectingBite(match, entity, target)
		: meleeStrike(match, entity, target);
}

const PROFILE = meleeProfile(SPECIES.cordyceps, {
	strike: (match, entity, target) => {
		const hit = bite(match, entity, target);

		match.emit({
			type: "attack",
			anomalyId: entity.id,
			phase: "strike",
			targetId: target.id,
			hit,
		});
	},
});

export function updateCordyceps(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	updateHunter(match, entity, dt, PROFILE, perceive(match, entity, dt));
}
