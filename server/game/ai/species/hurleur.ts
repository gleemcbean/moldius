import {
	HOWLER_ORBIT_ANGULAR_SPEED,
	HOWLER_ORBIT_MAX_MS,
	HOWLER_ORBIT_MIN_MS,
	HOWLER_ORBIT_RADIUS,
	HOWLER_ORBIT_SPEED,
	HOWLER_SCREAM_MS,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import type { Match } from "../../Match.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import {
	clearPath,
	faceTowards,
	followPath,
	hoverHeight,
	moveDirect,
	requestPath,
	trackProgress,
} from "../locomotion.js";
import { choosePatrolDestination } from "../patrol.js";

const TRAVEL_SPEED = SPECIES.hurleur.hostileSpeed;

export function updateHurleur(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	const host = entity.hostId >= 0 ? match.anomalies[entity.hostId] : undefined;
	if (!host?.active || host === entity || match.now >= entity.orbitUntil) {
		if (!chooseHost(match, entity)) {
			wander(match, entity, dt);
			return;
		}
	}
	const current = match.anomalies[entity.hostId];
	const hostFeet = feetOf(current);
	const verticalGap = Math.abs(
		hostFeet.y + hoverHeight(entity) - entity.position.y,
	);
	const distance =
		Math.hypot(hostFeet.x - entity.position.x, hostFeet.z - entity.position.z) +
		verticalGap * 2;
	if (distance > HOWLER_ORBIT_RADIUS + 2.5) {
		travelTo(match, entity, hostFeet, dt);
		return;
	}
	orbit(match, entity, current, dt);
	updateScream(match, entity);
}

function chooseHost(match: Match, entity: AnomalyEntity): boolean {
	const claimed = new Set(
		match.anomalies
			.filter(
				(other) =>
					other !== entity && other.active && other.species === "hurleur",
			)
			.map((other) => other.hostId),
	);
	const candidates = match.anomalies.filter(
		(other) =>
			other !== entity &&
			other.active &&
			other.species !== "hurleur" &&
			!claimed.has(other.id),
	);
	const fallback = match.anomalies.filter(
		(other) => other !== entity && other.active && other.species !== "hurleur",
	);
	const pool = candidates.length > 0 ? candidates : fallback;
	if (pool.length === 0) {
		entity.hostId = -1;
		return false;
	}
	const previous = entity.hostId;
	const options =
		pool.length > 1 ? pool.filter((other) => other.id !== previous) : pool;
	const host = match.rng.pick(options);
	entity.hostId = host.id;
	entity.orbitUntil =
		match.now + match.rng.range(HOWLER_ORBIT_MIN_MS, HOWLER_ORBIT_MAX_MS);
	entity.orbitAngle = match.rng.range(0, Math.PI * 2);
	clearPath(entity);
	entity.setState("travel", match.now);
	return true;
}

function travelTo(
	match: Match,
	entity: AnomalyEntity,
	goal: { x: number; y: number; z: number },
	dt: number,
): void {
	entity.setState("travel", match.now);
	const goalMoved =
		!entity.pathGoal ||
		Math.hypot(entity.pathGoal.x - goal.x, entity.pathGoal.z - goal.z) > 1.5;
	if (
		entity.path.length === 0 ||
		(goalMoved && match.now >= entity.nextRepathAt)
	) {
		if (!requestPath(match, entity, goal)) {
			entity.orbitUntil = 0;
			return;
		}
	}
	const status = followPath(match, entity, TRAVEL_SPEED, dt);
	if (
		status === "blocked" ||
		trackProgress(match, entity, status === "moving")
	) {
		entity.orbitUntil = 0;
	}
}

function feetOf(entity: AnomalyEntity): { x: number; y: number; z: number } {
	return {
		x: entity.position.x,
		y: entity.position.y - hoverHeight(entity),
		z: entity.position.z,
	};
}

function orbit(
	match: Match,
	entity: AnomalyEntity,
	host: AnomalyEntity,
	dt: number,
): void {
	entity.setState("special", match.now);
	entity.orbitAngle += HOWLER_ORBIT_ANGULAR_SPEED * dt;
	const hostFeet = feetOf(host);
	const point = {
		x: hostFeet.x + Math.cos(entity.orbitAngle) * HOWLER_ORBIT_RADIUS,
		y: hostFeet.y,
		z: hostFeet.z + Math.sin(entity.orbitAngle) * HOWLER_ORBIT_RADIUS,
	};
	const ground = match.groundHeightAt(point, hostFeet.y);
	const target = { ...point, y: ground ?? hostFeet.y };
	if (!moveDirect(match, entity, target, HOWLER_ORBIT_SPEED, dt)) {
		entity.orbitAngle += 0.6;
		if (!moveDirect(match, entity, hostFeet, HOWLER_ORBIT_SPEED, dt)) {
			travelTo(match, entity, hostFeet, dt);
		}
	}
	faceTowards(entity, host.position, 3, dt);
}

function updateScream(match: Match, entity: AnomalyEntity): void {
	if (match.now < entity.nextScreamAt) {
		return;
	}
	entity.screamUntil = match.now + HOWLER_SCREAM_MS;
	entity.nextScreamAt = entity.screamUntil + match.rng.range(3200, 5200);
	match.emit({
		type: "scream",
		anomalyId: entity.id,
		until: entity.screamUntil,
	});
	match.sounds.push({
		position: { ...entity.position },
		loudness: 14,
		playerId: null,
		kind: "shout",
	});
}

function wander(match: Match, entity: AnomalyEntity, dt: number): void {
	if (entity.path.length === 0 || entity.pathIndex >= entity.path.length) {
		choosePatrolDestination(match, entity);
	}
	entity.setState("patrol", match.now);
	followPath(match, entity, SPECIES.hurleur.calmSpeed, dt);
}

export function isScreaming(entity: AnomalyEntity, now: number): boolean {
	return entity.screamUntil > now;
}
