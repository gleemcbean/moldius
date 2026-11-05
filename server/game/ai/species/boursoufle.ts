import { BLOAT_ARM_MS, BLOAT_RADIUS } from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import { lineOfSight } from "../../../../shared/physics/lineOfSight.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { sameFloor } from "../combat.js";
import { type HunterProfile, updateHunter } from "../hunter.js";
import { clearPath } from "../locomotion.js";
import { releaseClaim } from "../patrol.js";
import { perceive } from "../perception.js";
import { meleeProfile } from "./profiles.js";

const SEEKER: HunterProfile = meleeProfile(SPECIES.boursoufle, {
	canExtract: false,
	preferredRange: [1.6, 2.6],
	readyToAttack: () => false,
	strike: () => undefined,
});

export function exposedPlayers(
	match: Match,
	entity: AnomalyEntity,
): MatchPlayer[] {
	const center = entity.center();
	return [...match.players.values()].filter((player) => {
		if (!player.alive || !player.connected || player.hidden || player.carried) {
			return false;
		}
		const chest = {
			x: player.position.x,
			y: player.position.y + player.bodyHeight() * 0.55,
			z: player.position.z,
		};
		const distance = Math.hypot(
			chest.x - center.x,
			chest.y - center.y,
			chest.z - center.z,
		);
		return (
			distance <= BLOAT_RADIUS &&
			sameFloor(entity, player) &&
			lineOfSight(match.world, center, chest, {
				ignoreFurniture: true,
				blockGlass: true,
			})
		);
	});
}

export function updateBoursoufle(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	const exposed = exposedPlayers(match, entity);
	if (entity.state === "windup") {
		runArming(match, entity, exposed, dt);
		return;
	}
	if (exposed.length >= 2) {
		clearPath(entity);
		releaseClaim(match, entity);
		entity.velocity = { x: 0, y: 0, z: 0 };
		entity.setState("windup", match.now);
		match.emit({
			type: "attack",
			anomalyId: entity.id,
			phase: "windup",
			targetId: exposed[0].id,
			hit: false,
		});
		return;
	}
	const targetSwell = exposed.length === 1 ? 0.3 : 0;
	entity.swell += (targetSwell - entity.swell) * Math.min(1, dt * 2);
	if (entity.state === "recover" && entity.stateAge(match.now) > 900) {
		entity.setState("chase", match.now);
	}
	updateHunter(match, entity, dt, SEEKER, perceive(match, entity, dt));
}

function runArming(
	match: Match,
	entity: AnomalyEntity,
	exposed: MatchPlayer[],
	dt: number,
): void {
	const progress = Math.min(1, entity.stateAge(match.now) / BLOAT_ARM_MS);
	entity.swell = Math.max(entity.swell, 0.35 + progress * 0.65);
	if (exposed.length < 2) {
		entity.swell = Math.max(0.3, entity.swell - dt * 1.5);
		entity.setState("recover", match.now);
		match.emit({
			type: "attack",
			anomalyId: entity.id,
			phase: "strike",
			targetId: null,
			hit: false,
		});
		return;
	}
	if (progress >= 1) {
		match.explode(entity, exposed);
	}
}
