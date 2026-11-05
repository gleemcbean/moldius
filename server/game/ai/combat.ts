import {
	LEVEL_HEIGHT,
	MAX_STATE_AGE_MS,
	MAX_UPPER_FLOORS,
} from "../../../shared/config/index.js";
import { levelForHeight } from "../../../shared/manor/levels.js";
import { lineOfSight } from "../../../shared/physics/lineOfSight.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";
import type { AnomalyEntity } from "./AnomalyEntity.js";
import { hoverHeight } from "./locomotion.js";

function floorOf(feetY: number): number {
	return levelForHeight(feetY, MAX_UPPER_FLOORS, LEVEL_HEIGHT / 2);
}

export function sameFloor(entity: AnomalyEntity, target: MatchPlayer): boolean {
	const hover = entity.definition.flying ? hoverHeight(entity) : 0;
	return floorOf(entity.position.y - hover) === floorOf(target.position.y);
}

export function targetIsStrikeable(match: Match, target: MatchPlayer): boolean {
	return (
		target.alive &&
		target.connected &&
		!target.hidden &&
		!target.carried &&
		target.protectedUntil <= match.now &&
		match.now - target.lastStateAt <= MAX_STATE_AGE_MS
	);
}

export function inMeleeReach(
	match: Match,
	entity: AnomalyEntity,
	target: MatchPlayer,
	slack: number,
): boolean {
	const horizontal = Math.hypot(
		target.position.x - entity.position.x,
		target.position.z - entity.position.z,
	);
	const vertical = Math.abs(target.position.y - entity.position.y);
	if (
		horizontal > entity.definition.attackRange + slack ||
		vertical > 1.6 ||
		!sameFloor(entity, target)
	) {
		return false;
	}
	const from = entity.center();
	const to = {
		x: target.position.x,
		y: target.position.y + target.bodyHeight() * 0.55,
		z: target.position.z,
	};
	return lineOfSight(match.world, from, to, {
		ignoreFurniture: true,
		blockGlass: true,
	});
}

export function clearShot(
	match: Match,
	entity: AnomalyEntity,
	target: MatchPlayer,
): boolean {
	return (
		sameFloor(entity, target) &&
		lineOfSight(
			match.world,
			entity.eye(),
			{
				x: target.position.x,
				y: target.position.y + target.bodyHeight() * 0.55,
				z: target.position.z,
			},
			{ ignoreFurniture: true, blockGlass: true },
		)
	);
}

export function meleeStrike(
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
	return match.applyDamage(
		target,
		entity.definition.damage,
		entity.species,
		entity.center(),
	);
}
