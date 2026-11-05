import {
	ANOMALY_DOOR_FORCE_DELAY_MS,
	ANOMALY_DOOR_OPEN_DELAY_MS,
	NAV_PORTAL_RADIUS,
	NAV_WAYPOINT_RADIUS,
	SHOUT_LURE_DOOR_DELAY_MS,
} from "../../../shared/config/index.js";
import { approachAngle, type Vec3 } from "../../../shared/math.js";
import type { Match } from "../Match.js";
import type { AnomalyEntity } from "./AnomalyEntity.js";

export type MoveStatus = "moving" | "arrived" | "blocked" | "waiting";

export function requestPath(
	match: Match,
	entity: AnomalyEntity,
	goal: Vec3,
): boolean {
	const path = match.finder.findPath(entity.position, goal, {
		canOpenDoors: true,
		isDoorClosed: (doorId) => match.doors.isClosed(doorId),
		maxExpansions: 45_000,
	});
	entity.pathGoal = { ...goal };
	entity.nextRepathAt = match.now + 450;
	if (!path || path.length === 0) {
		entity.path = [];
		entity.pathIndex = 0;
		entity.pathFailures += 1;
		return false;
	}
	entity.path = path;
	entity.pathIndex = 0;
	entity.pathFailures = 0;
	return true;
}

export function clearPath(entity: AnomalyEntity): void {
	entity.path = [];
	entity.pathIndex = 0;
	entity.pathGoal = null;
}

export function followPath(
	match: Match,
	entity: AnomalyEntity,
	speed: number,
	dt: number,
): MoveStatus {
	if (entity.pathIndex >= entity.path.length) {
		entity.velocity = { x: 0, y: 0, z: 0 };
		return "arrived";
	}
	const waypoint = entity.path[entity.pathIndex];
	if (waypoint.doorId !== null && match.doors.isClosed(waypoint.doorId)) {
		const distance = Math.hypot(
			waypoint.x - entity.position.x,
			waypoint.z - entity.position.z,
		);
		if (distance < 1.25) {
			entity.velocity = { x: 0, y: 0, z: 0 };
			faceTowards(entity, waypoint, 8, dt);
			if (
				entity.doorWaitId !== waypoint.doorId ||
				match.now > entity.doorWaitUntil + 500
			) {
				entity.doorWaitId = waypoint.doorId;
				entity.doorWaitUntil =
					match.now +
					(match.now < entity.luredUntil
						? SHOUT_LURE_DOOR_DELAY_MS
						: entity.definition.canOpenDoors
							? ANOMALY_DOOR_OPEN_DELAY_MS
							: ANOMALY_DOOR_FORCE_DELAY_MS);
			} else if (match.now >= entity.doorWaitUntil) {
				match.openDoorByAnomaly(entity, waypoint.doorId);
				entity.doorWaitId = null;
			}
			return "waiting";
		}
	}
	return stepTowards(
		match,
		entity,
		waypoint,
		speed,
		dt,
		waypoint.portal ? NAV_PORTAL_RADIUS : NAV_WAYPOINT_RADIUS,
	);
}

function stepTowards(
	match: Match,
	entity: AnomalyEntity,
	waypoint: Vec3,
	speed: number,
	dt: number,
	radius: number,
): MoveStatus {
	const dx = waypoint.x - entity.position.x;
	const dz = waypoint.z - entity.position.z;
	const distance = Math.hypot(dx, dz);
	if (distance <= radius) {
		entity.pathIndex += 1;
		return entity.pathIndex >= entity.path.length ? "arrived" : "moving";
	}
	const step = Math.min(distance, speed * dt);
	const nx = dx / distance;
	const nz = dz / distance;
	const hover = entity.definition.flying ? hoverHeight(entity) : 0;
	const linearY =
		entity.position.y +
		(waypoint.y + hover - entity.position.y) * (step / distance);
	entity.position.x += nx * step;
	entity.position.z += nz * step;
	const ground = match.groundHeightAt(entity.position, linearY - hover);
	entity.position.y = ground === null ? linearY : ground + hover;
	entity.velocity = { x: nx * speed, y: 0, z: nz * speed };
	faceTowards(
		entity,
		{ x: entity.position.x + nx, z: entity.position.z + nz },
		entity.state === "chase" ? 8 : 5,
		dt,
	);
	return "moving";
}

export function hoverHeight(entity: AnomalyEntity): number {
	if (entity.species === "luciole") {
		return 1.35;
	}
	if (entity.species === "hurleur") {
		return 1.05;
	}
	if (entity.species === "brume") {
		return 0.45;
	}
	return 0;
}

export function faceTowards(
	entity: AnomalyEntity,
	point: { x: number; z: number },
	rate: number,
	dt: number,
): void {
	const dx = point.x - entity.position.x;
	const dz = point.z - entity.position.z;
	if (Math.hypot(dx, dz) < 1e-3) {
		return;
	}
	entity.yaw = approachAngle(entity.yaw, Math.atan2(-dx, -dz), rate * dt);
}

export function moveDirect(
	match: Match,
	entity: AnomalyEntity,
	goal: Vec3,
	speed: number,
	dt: number,
): boolean {
	const hover = entity.definition.flying ? hoverHeight(entity) : 0;
	const feet = {
		x: entity.position.x,
		y: entity.position.y - hover,
		z: entity.position.z,
	};
	if (!match.finder.walkableLine(feet, goal, match.gridLevelOf(feet))) {
		return false;
	}
	const dx = goal.x - entity.position.x;
	const dz = goal.z - entity.position.z;
	const distance = Math.hypot(dx, dz);
	if (distance < 0.05) {
		entity.velocity = { x: 0, y: 0, z: 0 };
		return true;
	}
	const step = Math.min(distance, speed * dt);
	entity.position.x += (dx / distance) * step;
	entity.position.z += (dz / distance) * step;
	const ground = match.groundHeightAt(entity.position, feet.y);
	if (ground !== null) {
		entity.position.y = ground + hover;
	}
	entity.velocity = {
		x: (dx / distance) * speed,
		y: 0,
		z: (dz / distance) * speed,
	};
	faceTowards(entity, goal, 9, dt);
	return true;
}

export function trackProgress(
	match: Match,
	entity: AnomalyEntity,
	moving: boolean,
): boolean {
	if (!moving) {
		entity.progressCheckAt = match.now + 2000;
		entity.progressAnchor = { ...entity.position };
		return false;
	}
	if (match.now < entity.progressCheckAt) {
		return false;
	}
	const moved = Math.hypot(
		entity.position.x - entity.progressAnchor.x,
		entity.position.z - entity.progressAnchor.z,
	);
	entity.progressCheckAt = match.now + 2000;
	entity.progressAnchor = { ...entity.position };
	return moved < 0.35;
}
