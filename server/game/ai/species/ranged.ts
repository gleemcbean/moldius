import {
	EMBER_SHOT_GRAVITY,
	EMBER_SHOT_SPEED,
	SLIME_FIRE_INTERVAL_MS,
	SLIME_SHOT_GRAVITY,
	SLIME_SHOT_SPEED,
	SLIME_WINDUP_MS,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import { lineOfSight } from "../../../../shared/physics/lineOfSight.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import { ballisticVelocity } from "../../systems/hazards.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { sameFloor } from "../combat.js";
import { updateHunter } from "../hunter.js";
import { perceive } from "../perception.js";
import { meleeProfile } from "./profiles.js";

function mouth(match: Match, entity: AnomalyEntity) {
	const forward = { x: -Math.sin(entity.yaw), z: -Math.cos(entity.yaw) };
	const y = entity.position.y + entity.definition.bodyHeight * 0.72;
	const tip = {
		x: entity.position.x + forward.x * 0.45,
		y,
		z: entity.position.z + forward.z * 0.45,
	};
	const body = { x: entity.position.x, y, z: entity.position.z };
	return lineOfSight(match.world, body, tip, { blockGlass: true }) ? tip : body;
}

function hasClearShot(
	match: Match,
	entity: AnomalyEntity,
	target: MatchPlayer,
	minRange: number,
	maxRange: number,
	cooldownMs: number,
): boolean {
	if (
		match.now - entity.lastStrikeAt < cooldownMs ||
		!sameFloor(entity, target)
	) {
		return false;
	}
	const distance = Math.hypot(
		target.position.x - entity.position.x,
		target.position.z - entity.position.z,
	);
	if (distance < minRange || distance > maxRange) {
		return false;
	}
	const chest = {
		x: target.position.x,
		y: target.position.y + target.bodyHeight() * 0.55,
		z: target.position.z,
	};
	return lineOfSight(match.world, mouth(match, entity), chest, {
		blockGlass: true,
	});
}

const EMBER_PROFILE = meleeProfile(SPECIES["crache-cendre"], {
	canExtract: false,
	preferredRange: [4.5, 8.5],
	readyToAttack: (match, entity, target) =>
		hasClearShot(
			match,
			entity,
			target,
			2.5,
			SPECIES["crache-cendre"].attackRange,
			SPECIES["crache-cendre"].recoveryMs,
		),
	strike: (match, entity, target) => {
		const origin = mouth(match, entity);
		const aim = {
			x: target.position.x,
			y: target.position.y + target.bodyHeight() * 0.55,
			z: target.position.z,
		};
		const velocity = ballisticVelocity(
			origin,
			aim,
			EMBER_SHOT_SPEED,
			EMBER_SHOT_GRAVITY,
		);
		match.launchProjectile(
			"ember",
			origin,
			velocity,
			EMBER_SHOT_GRAVITY,
			entity,
		);
		match.emit({
			type: "attack",
			anomalyId: entity.id,
			phase: "strike",
			targetId: target.id,
			hit: false,
		});
	},
});

const SLIME_PROFILE = meleeProfile(SPECIES.suinteur, {
	canExtract: false,
	preferredRange: [4, 7.5],
	windupMs: SLIME_WINDUP_MS,
	recoveryMs: SLIME_FIRE_INTERVAL_MS - SLIME_WINDUP_MS,
	readyToAttack: (match, entity, target) =>
		hasClearShot(
			match,
			entity,
			target,
			2,
			SPECIES.suinteur.attackRange,
			SLIME_FIRE_INTERVAL_MS - SLIME_WINDUP_MS,
		),
	strike: (match, entity, target) => {
		const origin = mouth(match, entity);
		const aim = {
			x: target.position.x,
			y: target.position.y + 0.05,
			z: target.position.z,
		};
		const velocity = ballisticVelocity(
			origin,
			aim,
			SLIME_SHOT_SPEED,
			SLIME_SHOT_GRAVITY,
		);
		match.launchProjectile(
			"slime",
			origin,
			velocity,
			SLIME_SHOT_GRAVITY,
			entity,
		);
		match.emit({
			type: "attack",
			anomalyId: entity.id,
			phase: "strike",
			targetId: target.id,
			hit: false,
		});
	},
});

export function updateCracheCendre(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	updateHunter(match, entity, dt, EMBER_PROFILE, perceive(match, entity, dt));
}

export function updateSuinteur(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	updateHunter(match, entity, dt, SLIME_PROFILE, perceive(match, entity, dt));
}
