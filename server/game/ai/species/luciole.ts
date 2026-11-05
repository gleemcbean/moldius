import {
	WISP_FLEE_DISTANCE,
	WISP_HOME_RADIUS,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import type { Vec3 } from "../../../../shared/math.js";
import type { Match } from "../../Match.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { faceTowards, hoverHeight, moveDirect } from "../locomotion.js";
import { randomPointNear } from "../patrol.js";

export function updateLuciole(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	if (!entity.homePoint) {
		entity.homePoint = {
			...entity.position,
			y: entity.position.y - hoverHeight(entity),
		};
	}
	const threat = nearestThreat(match, entity);
	if (threat) {
		flee(match, entity, threat, dt);
		return;
	}
	if (entity.state === "flee") {
		entity.setState("idle", match.now);
		entity.idleUntil = match.now + 900;
	}
	if (entity.state === "idle") {
		entity.velocity = { x: 0, y: 0, z: 0 };
		if (match.now >= entity.idleUntil) {
			const goal = randomPointNear(match, entity.homePoint, WISP_HOME_RADIUS);
			if (goal) {
				entity.pathGoal = goal;
				entity.setState("patrol", match.now);
			} else {
				entity.idleUntil = match.now + 1200;
			}
		}
		return;
	}
	const goal = entity.pathGoal;
	if (
		!goal ||
		!moveDirect(match, entity, goal, SPECIES.luciole.calmSpeed, dt) ||
		reached(entity, goal)
	) {
		entity.setState("idle", match.now);
		entity.idleUntil = match.now + match.rng.range(1500, 3500);
	}
}

function reached(
	entity: AnomalyEntity,
	goal: { x: number; z: number },
): boolean {
	return (
		Math.hypot(goal.x - entity.position.x, goal.z - entity.position.z) < 0.15
	);
}

function nearestThreat(match: Match, entity: AnomalyEntity) {
	for (const player of match.players.values()) {
		if (!player.active) {
			continue;
		}
		const distance = Math.hypot(
			player.position.x - entity.position.x,
			player.position.z - entity.position.z,
		);
		const sprinting =
			player.sprintIntent && player.moveInput && !player.sprintLocked;
		if (
			Math.abs(player.position.y - entity.position.y + 1.3) < 2.5 &&
			((distance < WISP_FLEE_DISTANCE && !player.crouching) ||
				(sprinting && distance < 4))
		) {
			return player;
		}
	}
	return null;
}

function flee(
	match: Match,
	entity: AnomalyEntity,
	threat: { position: { x: number; y: number; z: number } },
	dt: number,
): void {
	entity.setState("flee", match.now);
	const away = {
		x: entity.position.x - threat.position.x,
		z: entity.position.z - threat.position.z,
	};
	const length = Math.hypot(away.x, away.z) || 1;
	const goal = {
		x: entity.position.x + (away.x / length) * 1.5,
		y: entity.position.y,
		z: entity.position.z + (away.z / length) * 1.5,
	};
	const home = entity.homePoint as Vec3;
	if (
		Math.hypot(goal.x - home.x, goal.z - home.z) > WISP_HOME_RADIUS + 1.5 ||
		!moveDirect(match, entity, goal, SPECIES.luciole.hostileSpeed, dt)
	) {
		const alternative = randomPointNear(match, home, WISP_HOME_RADIUS);
		if (alternative) {
			moveDirect(match, entity, alternative, SPECIES.luciole.hostileSpeed, dt);
		}
	}
	faceTowards(entity, goal, 4, dt);
}
