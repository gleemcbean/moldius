import {
	HAZE_CLING_MS,
	HAZE_CLOSE_DISTANCE,
	HAZE_FOLLOW_DISTANCE,
	HAZE_LOST_DISTANCE,
	HAZE_LOST_MS,
	HAZE_REST_MS,
	HAZE_TRAIL_DELAY_MS,
	HAZE_WATCHED_CONE_COS,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import { lookDirection, type Vec3 } from "../../../../shared/math.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
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
import { choosePatrolDestination, releaseClaim } from "../patrol.js";
import { playerVisibleFrom } from "../perception.js";

const DEFINITION = SPECIES.brume;
const SIDE_STEPS = [
	0,
	Math.PI / 2,
	-Math.PI / 2,
	Math.PI * 0.75,
	-Math.PI * 0.75,
];

export function updateBrume(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	const target = currentTarget(match, entity) ?? acquireTarget(match, entity);
	if (!target) {
		wander(match, entity, dt);
		return;
	}
	follow(match, entity, target, dt);
}

export function hazeStrength(entity: AnomalyEntity, now: number): number {
	return entity.state === "special" && entity.targetId !== null
		? Math.min(1, entity.stateAge(now) / 1200)
		: 0;
}

function currentTarget(
	match: Match,
	entity: AnomalyEntity,
): MatchPlayer | null {
	if (entity.targetId === null) {
		return null;
	}
	const player = match.players.get(entity.targetId);
	const reason = !player?.active
		? 8000
		: match.now >= entity.pursuitUntil
			? HAZE_REST_MS
			: lostFor(match, entity, player) >= HAZE_LOST_MS
				? 8000
				: 0;
	if (player && reason === 0) {
		return player;
	}
	release(match, entity, reason);
	return null;
}

function lostFor(
	match: Match,
	entity: AnomalyEntity,
	player: MatchPlayer,
): number {
	const feet = feetOf(entity);
	const near =
		Math.hypot(player.position.x - feet.x, player.position.z - feet.z) <
			HAZE_LOST_DISTANCE && Math.abs(player.position.y - feet.y) < 2.5;
	if (near) {
		entity.lostTargetAt = 0;
		return 0;
	}
	if (entity.lostTargetAt === 0) {
		entity.lostTargetAt = match.now;
	}
	return match.now - entity.lostTargetAt;
}

function release(match: Match, entity: AnomalyEntity, restMs: number): void {
	if (entity.targetId !== null) {
		entity.ignoredUntil.set(entity.targetId, match.now + restMs);
	}
	entity.targetId = null;
	entity.lostTargetAt = 0;
	clearPath(entity);
	entity.setState("patrol", match.now);
}

function acquireTarget(
	match: Match,
	entity: AnomalyEntity,
): MatchPlayer | null {
	const eye = entity.eye();
	let best: MatchPlayer | null = null;
	let bestDistance = DEFINITION.viewRange;
	for (const player of match.players.values()) {
		if (
			!player.active ||
			player.protectedUntil > match.now ||
			(entity.ignoredUntil.get(player.id) ?? 0) > match.now ||
			Math.abs(player.position.y - feetOf(entity).y) > 2.5
		) {
			continue;
		}
		const distance = Math.hypot(
			player.position.x - eye.x,
			player.position.z - eye.z,
		);
		if (distance < bestDistance && playerVisibleFrom(match, eye, player)) {
			best = player;
			bestDistance = distance;
		}
	}
	if (best) {
		releaseClaim(match, entity);
		clearPath(entity);
		entity.targetId = best.id;
		entity.pursuitUntil = match.now + HAZE_CLING_MS;
		entity.lostTargetAt = 0;
		entity.setState("special", match.now);
	}
	return best;
}

function follow(
	match: Match,
	entity: AnomalyEntity,
	target: MatchPlayer,
	dt: number,
): void {
	entity.setState("special", match.now);
	const feet = feetOf(entity);
	const goal = watchedBy(entity, target)
		? keepBearing(match, target, feet)
		: trail(match, target, feet);
	const gap = Math.hypot(goal.x - feet.x, goal.z - feet.z);
	if (gap > 0.2) {
		const speed = Math.min(DEFINITION.hostileSpeed, 0.8 + gap * 3);
		if (moveDirect(match, entity, goal, speed, dt)) {
			clearPath(entity);
		} else {
			travel(match, entity, target.position, dt);
		}
	} else {
		entity.velocity = { x: 0, y: 0, z: 0 };
	}
	faceTowards(entity, target.position, 4, dt);
}

function watchedBy(entity: AnomalyEntity, player: MatchPlayer): boolean {
	const eye = player.eyePosition();
	const toward = {
		x: entity.position.x - eye.x,
		y: entity.center().y - eye.y,
		z: entity.position.z - eye.z,
	};
	const length = Math.hypot(toward.x, toward.y, toward.z) || 1;
	const look = lookDirection(player.yaw, player.pitch);
	return (
		(look.x * toward.x + look.y * toward.y + look.z * toward.z) / length >
		HAZE_WATCHED_CONE_COS
	);
}

function trail(match: Match, player: MatchPlayer, feet: Vec3): Vec3 {
	const step = player.history.sampleAt(match.now - HAZE_TRAIL_DELAY_MS);
	if (
		step &&
		Math.hypot(step.x - player.position.x, step.z - player.position.z) >=
			HAZE_CLOSE_DISTANCE
	) {
		return { x: step.x, y: step.y, z: step.z };
	}
	return behind(match, player, feet);
}

function behind(match: Match, player: MatchPlayer, feet: Vec3): Vec3 {
	const back = player.yaw + Math.PI;
	for (const turn of SIDE_STEPS) {
		const angle = back + turn;
		const point = around(player, -Math.sin(angle), -Math.cos(angle));
		if (
			match.finder.walkableLine(
				player.position,
				point,
				match.gridLevelOf(player.position),
			)
		) {
			return point;
		}
	}
	return keepBearing(match, player, feet);
}

function keepBearing(match: Match, player: MatchPlayer, feet: Vec3): Vec3 {
	const dx = feet.x - player.position.x;
	const dz = feet.z - player.position.z;
	const distance = Math.hypot(dx, dz);
	if (distance < 1e-3) {
		return { ...feet };
	}
	const wanted = Math.max(
		HAZE_CLOSE_DISTANCE,
		Math.min(distance, HAZE_FOLLOW_DISTANCE + 0.4),
	);
	const point = around(player, dx / distance, dz / distance, wanted);
	return match.finder.walkableLine(
		player.position,
		point,
		match.gridLevelOf(player.position),
	)
		? point
		: { ...feet };
}

function around(
	player: MatchPlayer,
	x: number,
	z: number,
	distance = HAZE_FOLLOW_DISTANCE,
): Vec3 {
	return {
		x: player.position.x + x * distance,
		y: player.position.y,
		z: player.position.z + z * distance,
	};
}

function travel(
	match: Match,
	entity: AnomalyEntity,
	goal: Vec3,
	dt: number,
): void {
	const goalMoved =
		!entity.pathGoal ||
		Math.hypot(entity.pathGoal.x - goal.x, entity.pathGoal.z - goal.z) > 1.5;
	if (
		entity.path.length === 0 ||
		(goalMoved && match.now >= entity.nextRepathAt)
	) {
		if (!requestPath(match, entity, goal)) {
			return;
		}
	}
	const status = followPath(match, entity, DEFINITION.hostileSpeed, dt);
	if (
		status === "blocked" ||
		trackProgress(match, entity, status === "moving")
	) {
		clearPath(entity);
	}
}

function wander(match: Match, entity: AnomalyEntity, dt: number): void {
	if (entity.path.length === 0 || entity.pathIndex >= entity.path.length) {
		choosePatrolDestination(match, entity);
	}
	entity.setState("patrol", match.now);
	followPath(match, entity, DEFINITION.calmSpeed, dt);
}

function feetOf(entity: AnomalyEntity): Vec3 {
	return {
		x: entity.position.x,
		y: entity.position.y - hoverHeight(entity),
		z: entity.position.z,
	};
}
