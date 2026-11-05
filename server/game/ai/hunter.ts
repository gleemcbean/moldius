import {
	ANOMALY_DISINTEREST_MS,
	HIDE_EXTRACTION_MEMORY_MS,
	HIDE_EXTRACTION_RANGE,
	HIDE_EXTRACTION_TELEGRAPH_MS,
	SEARCH_DURATION_MS,
	SHOUT_LURE_SPEED,
} from "../../../shared/config/index.js";
import { type Vec3, wrapAngle } from "../../../shared/math.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";
import type { AnomalyEntity } from "./AnomalyEntity.js";
import { clearShot, targetIsStrikeable } from "./combat.js";
import {
	canEngage,
	interestToDrop,
	observedByPlayers,
	shouldDisperse,
} from "./dispersal.js";
import {
	clearPath,
	followPath,
	moveDirect,
	requestPath,
	trackProgress,
} from "./locomotion.js";
import {
	choosePatrolDestination,
	chooseSpreadDestination,
	randomPointNear,
	releaseClaim,
} from "./patrol.js";
import {
	type PerceptionResult,
	targetIsVisible,
	VISUAL_MEMORY_MS,
} from "./perception.js";

export interface HunterProfile {
	patrolSpeed: number;
	chaseSpeed: number;
	canHunt: boolean;
	canInvestigate: boolean;
	canExtract: boolean;
	preferredRange: [number, number] | null;
	windupMs: number;
	recoveryMs: number;
	readyToAttack(
		match: Match,
		entity: AnomalyEntity,
		target: MatchPlayer,
	): boolean;
	strike(match: Match, entity: AnomalyEntity, target: MatchPlayer): void;
}

export function updateHunter(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
	profile: HunterProfile,
	perception: PerceptionResult,
): void {
	markVisited(match, entity);
	reactToPerception(match, entity, profile, perception);
	loseInterest(match, entity);
	disperse(match, entity);
	switch (entity.state) {
		case "idle":
			runIdle(match, entity, dt);
			break;
		case "patrol":
		case "travel":
			runPatrol(match, entity, dt, profile);
			break;
		case "investigate":
			runInvestigate(match, entity, dt, profile);
			break;
		case "chase":
			runChase(match, entity, dt, profile);
			break;
		case "windup":
			runWindup(match, entity, dt, profile);
			break;
		case "recover":
			runRecover(match, entity, profile);
			break;
		case "search":
			runSearch(match, entity, dt);
			break;
		case "extract":
			runExtract(match, entity, dt, profile);
			break;
		default:
			entity.setState("idle", match.now);
	}
}

function reactToPerception(
	match: Match,
	entity: AnomalyEntity,
	profile: HunterProfile,
	perception: PerceptionResult,
): void {
	const now = match.now;
	if (profile.canExtract) {
		noticeHiddenNoise(match, entity, perception);
	}
	if (
		profile.canExtract &&
		entity.witnessed &&
		entity.state !== "extract" &&
		entity.state !== "windup"
	) {
		if (now - entity.witnessed.at < 12_000) {
			entity.setState("extract", now);
			clearPath(entity);
			releaseClaim(match, entity);
			return;
		}
		entity.witnessed = null;
	}
	const passive =
		entity.state === "idle" ||
		entity.state === "patrol" ||
		entity.state === "travel" ||
		entity.state === "investigate" ||
		entity.state === "search";
	if (!passive) {
		return;
	}
	if (profile.canHunt && perception.target) {
		entity.targetId = perception.target.id;
		entity.setState("chase", now);
		clearPath(entity);
		releaseClaim(match, entity);
		return;
	}
	const source = perception.heard?.playerId
		? match.players.get(perception.heard.playerId)
		: undefined;
	if (
		profile.canInvestigate &&
		perception.heard &&
		source &&
		entity.state !== "investigate" &&
		canEngage(match, entity, source)
	) {
		const goal = perception.heard.position;
		if (requestPath(match, entity, goal)) {
			releaseClaim(match, entity);
			entity.interestPlayerId = source.id;
			entity.setState("investigate", now);
		}
	}
}

function markVisited(match: Match, entity: AnomalyEntity): void {
	const room = match.roomIdAt(entity.position);
	if (room !== null) {
		match.roomVisits.set(room, match.now);
	}
}

function loseInterest(match: Match, entity: AnomalyEntity): void {
	const playerId = interestToDrop(match, entity);
	if (!playerId) {
		return;
	}
	entity.ignoredUntil.set(playerId, match.now + ANOMALY_DISINTEREST_MS);
	entity.targetId = null;
	entity.interestPlayerId = null;
	entity.lostTargetAt = match.now;
	clearPath(entity);
	if (chooseSpreadDestination(match, entity)) {
		entity.hurrying = !observedByPlayers(match, entity);
		entity.setState("travel", match.now);
	} else {
		entity.setState("idle", match.now);
		entity.idleUntil = match.now + 600;
	}
}

const RESTLESS_STATES = new Set(["idle", "patrol", "search", "travel"]);

function disperse(match: Match, entity: AnomalyEntity): void {
	if (
		entity.targetId !== null ||
		!RESTLESS_STATES.has(entity.state) ||
		!shouldDisperse(match, entity) ||
		!chooseSpreadDestination(match, entity)
	) {
		return;
	}
	entity.hurrying = !observedByPlayers(match, entity);
	entity.setState("travel", match.now);
}

function noticeHiddenNoise(
	match: Match,
	entity: AnomalyEntity,
	perception: PerceptionResult,
): void {
	const sound = perception.hiddenNoise;
	const player = sound?.playerId
		? match.players.get(sound.playerId)
		: undefined;
	if (!player?.hidden) {
		return;
	}
	const busy =
		entity.state === "extract" ||
		entity.state === "windup" ||
		entity.state === "recover" ||
		(entity.state === "chase" &&
			entity.targetId !== null &&
			targetIsVisible(entity, entity.targetId));
	if (!busy) {
		entity.witnessed = {
			playerId: player.id,
			spotId: player.hiddenSpot,
			at: match.now,
		};
	}
}

function runIdle(match: Match, entity: AnomalyEntity, dt: number): void {
	entity.velocity = { x: 0, y: 0, z: 0 };
	entity.yaw = wrapAngle(
		entity.yaw + Math.sin(match.now / 900 + entity.id) * 0.5 * dt,
	);
	if (match.now < entity.idleUntil) {
		return;
	}
	if (choosePatrolDestination(match, entity)) {
		entity.setState("patrol", match.now);
	} else {
		entity.idleUntil = match.now + 1000;
	}
}

function runPatrol(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
	profile: HunterProfile,
): void {
	const speed =
		entity.state === "travel" && entity.hurrying
			? profile.patrolSpeed * 1.7
			: profile.patrolSpeed;
	const status = followPath(match, entity, speed, dt);
	const stuck = trackProgress(match, entity, status === "moving");
	if (status === "arrived") {
		entity.hurrying = false;
		entity.setState("idle", match.now);
		entity.idleUntil = match.now + match.rng.range(900, 2600);
		return;
	}
	if (status === "blocked" || stuck) {
		if (!choosePatrolDestination(match, entity)) {
			entity.setState("idle", match.now);
			entity.idleUntil = match.now + 800;
		}
	}
}

function runInvestigate(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
	profile: HunterProfile,
): void {
	const speed =
		match.now < entity.luredUntil
			? Math.max(entity.definition.hostileSpeed, SHOUT_LURE_SPEED)
			: profile.patrolSpeed * 1.4;
	const status = followPath(match, entity, speed, dt);
	const stuck = trackProgress(match, entity, status === "moving");
	if (
		status === "arrived" ||
		status === "blocked" ||
		stuck ||
		entity.stateAge(match.now) > 14_000
	) {
		entity.luredUntil = 0;
		entity.setState("search", match.now);
	}
}

function runChase(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
	profile: HunterProfile,
): void {
	const now = match.now;
	const target = entity.targetId
		? match.players.get(entity.targetId)
		: undefined;
	const memory = entity.targetId
		? entity.memory.get(entity.targetId)
		: undefined;
	if (!target || !memory || !target.alive || target.carried) {
		startSearch(match, entity);
		return;
	}
	if (now - memory.lastSeenAt > VISUAL_MEMORY_MS) {
		goToLastSighting(match, entity, target.id, memory.lastSeenPosition);
		return;
	}
	const visible = memory.visibleNow;
	if (
		visible &&
		targetIsStrikeable(match, target) &&
		profile.readyToAttack(match, entity, target)
	) {
		entity.attackTargetId = target.id;
		entity.strikeDone = false;
		entity.velocity = { x: 0, y: 0, z: 0 };
		entity.setState("windup", now);
		match.emit({
			type: "attack",
			anomalyId: entity.id,
			phase: "windup",
			targetId: target.id,
			hit: false,
		});
		return;
	}
	const goal: Vec3 = visible
		? target.position
		: (memory.lastSeenPosition ?? target.position);
	const distance = Math.hypot(
		goal.x - entity.position.x,
		goal.z - entity.position.z,
	);
	if (profile.preferredRange && visible && clearShot(match, entity, target)) {
		const [near, far] = profile.preferredRange;
		if (distance < near) {
			retreat(match, entity, target.position, dt, profile.chaseSpeed * 0.8);
			return;
		}
		if (distance <= far) {
			entity.velocity = { x: 0, y: 0, z: 0 };
			entity.yaw = turnToward(entity, target.position, 7, dt);
			return;
		}
	}
	if (
		visible &&
		distance < 9 &&
		Math.abs(goal.y - entity.position.y) < 0.6 &&
		moveDirect(match, entity, goal, profile.chaseSpeed, dt)
	) {
		clearPath(entity);
	} else {
		const goalMoved =
			!entity.pathGoal ||
			Math.hypot(entity.pathGoal.x - goal.x, entity.pathGoal.z - goal.z) > 1;
		if (entity.path.length === 0 || (goalMoved && now >= entity.nextRepathAt)) {
			if (!requestPath(match, entity, goal) && entity.pathFailures > 3) {
				startSearch(match, entity);
				return;
			}
		}
		const status = followPath(match, entity, profile.chaseSpeed, dt);
		if (status === "blocked") {
			entity.pathFailures += 1;
			if (entity.pathFailures > 3) {
				startSearch(match, entity);
				return;
			}
			requestPath(match, entity, goal);
		}
	}
	if (!visible && distance < 0.9) {
		startSearch(match, entity);
	}
}

function retreat(
	match: Match,
	entity: AnomalyEntity,
	threat: Vec3,
	dt: number,
	speed: number,
): void {
	const away = {
		x: entity.position.x - threat.x,
		z: entity.position.z - threat.z,
	};
	const length = Math.hypot(away.x, away.z) || 1;
	const goal = {
		x: entity.position.x + (away.x / length) * 2.5,
		y: entity.position.y,
		z: entity.position.z + (away.z / length) * 2.5,
	};
	if (!moveDirect(match, entity, goal, speed, dt)) {
		const alternative = randomPointNear(match, entity.position, 3);
		if (alternative) {
			moveDirect(match, entity, alternative, speed, dt);
		}
	}
	entity.yaw = turnToward(entity, threat, 9, dt);
}

function turnToward(
	entity: AnomalyEntity,
	point: Vec3,
	rate: number,
	dt: number,
): number {
	const desired = Math.atan2(
		-(point.x - entity.position.x),
		-(point.z - entity.position.z),
	);
	const delta = wrapAngle(desired - entity.yaw);
	const step = Math.sign(delta) * Math.min(Math.abs(delta), rate * dt);
	return wrapAngle(entity.yaw + step);
}

function runWindup(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
	profile: HunterProfile,
): void {
	const target = entity.attackTargetId
		? match.players.get(entity.attackTargetId)
		: undefined;
	if (target) {
		entity.yaw = turnToward(entity, target.position, 6, dt);
	}
	entity.velocity = { x: 0, y: 0, z: 0 };
	if (entity.stateAge(match.now) < profile.windupMs) {
		return;
	}
	if (target && !entity.strikeDone) {
		entity.strikeDone = true;
		entity.lastStrikeAt = match.now;
		profile.strike(match, entity, target);
	}
	if (entity.state === "windup") {
		entity.setState("recover", match.now);
	}
}

function runRecover(
	match: Match,
	entity: AnomalyEntity,
	profile: HunterProfile,
): void {
	entity.velocity = { x: 0, y: 0, z: 0 };
	if (entity.stateAge(match.now) < profile.recoveryMs) {
		return;
	}
	const memory = entity.targetId
		? entity.memory.get(entity.targetId)
		: undefined;
	if (memory && match.now - memory.lastSeenAt < VISUAL_MEMORY_MS) {
		entity.setState("chase", match.now);
	} else {
		startSearch(match, entity);
	}
}

function goToLastSighting(
	match: Match,
	entity: AnomalyEntity,
	playerId: string,
	position: Vec3 | null,
): void {
	if (
		position &&
		Math.hypot(position.x - entity.position.x, position.z - entity.position.z) >
			2 &&
		requestPath(match, entity, position)
	) {
		entity.targetId = null;
		entity.interestPlayerId = playerId;
		entity.setState("investigate", match.now);
		return;
	}
	startSearch(match, entity);
}

export function startSearch(match: Match, entity: AnomalyEntity): void {
	clearPath(entity);
	entity.velocity = { x: 0, y: 0, z: 0 };
	entity.setState("search", match.now);
}

function runSearch(match: Match, entity: AnomalyEntity, dt: number): void {
	entity.velocity = { x: 0, y: 0, z: 0 };
	entity.yaw = wrapAngle(
		entity.yaw + Math.sin(entity.stateAge(match.now) / 300) * 2.2 * dt,
	);
	if (entity.stateAge(match.now) < SEARCH_DURATION_MS) {
		return;
	}
	entity.targetId = null;
	entity.lostTargetAt = match.now;
	if (choosePatrolDestination(match, entity)) {
		entity.setState("patrol", match.now);
	} else {
		entity.setState("idle", match.now);
		entity.idleUntil = match.now + 800;
	}
}

function runExtract(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
	profile: HunterProfile,
): void {
	const witnessed = entity.witnessed;
	const spot = witnessed ? match.layout.hideSpots[witnessed.spotId] : undefined;
	const player = witnessed ? match.players.get(witnessed.playerId) : undefined;
	if (!witnessed || !spot || !player) {
		entity.witnessed = null;
		startSearch(match, entity);
		return;
	}
	if (player.hiddenSpot !== witnessed.spotId) {
		entity.witnessed = null;
		entity.targetId = player.alive ? player.id : null;
		entity.setState(player.alive ? "chase" : "search", match.now);
		return;
	}
	const entry = { x: spot.entry.x, y: player.position.y, z: spot.entry.z };
	const distance = Math.hypot(
		entry.x - entity.position.x,
		entry.z - entity.position.z,
	);
	if (distance > 1.15) {
		if (entity.path.length === 0 || match.now >= entity.nextRepathAt + 1500) {
			if (!requestPath(match, entity, entry) && entity.pathFailures > 2) {
				entity.witnessed = null;
				startSearch(match, entity);
				return;
			}
		}
		followPath(match, entity, profile.chaseSpeed, dt);
		entity.telegraphUntil = 0;
		return;
	}
	entity.velocity = { x: 0, y: 0, z: 0 };
	entity.yaw = turnToward(
		entity,
		{ x: spot.interior.x, y: 0, z: spot.interior.z },
		7,
		dt,
	);
	if (entity.telegraphUntil === 0) {
		entity.telegraphUntil = match.now + HIDE_EXTRACTION_TELEGRAPH_MS;
		match.emit({
			type: "extractWarning",
			anomalyId: entity.id,
			playerId: player.id,
		});
		return;
	}
	if (match.now < entity.telegraphUntil) {
		return;
	}
	entity.telegraphUntil = 0;
	entity.witnessed = null;
	match.extractPlayer(player);
	entity.targetId = player.id;
	const memory = entity.memoryFor(player.id);
	memory.awareness = 1.5;
	memory.lastSeenAt = match.now;
	memory.lastSeenPosition = { ...player.position };
	memory.visibleNow = true;
	entity.attackTargetId = player.id;
	entity.strikeDone = false;
	entity.setState("windup", match.now);
	match.emit({
		type: "attack",
		anomalyId: entity.id,
		phase: "windup",
		targetId: player.id,
		hit: false,
	});
}

export function witnessHide(
	match: Match,
	entity: AnomalyEntity,
	player: MatchPlayer,
	spotId: number,
): void {
	const memory = entity.memory.get(player.id);
	if (!memory) {
		return;
	}
	const recentlySeen =
		memory.visibleNow ||
		match.now - memory.lastSeenAt <= HIDE_EXTRACTION_MEMORY_MS;
	const distance = Math.hypot(
		player.position.x - entity.position.x,
		player.position.z - entity.position.z,
	);
	if (
		recentlySeen &&
		memory.awareness >= 0.6 &&
		distance <= HIDE_EXTRACTION_RANGE + 0.25
	) {
		entity.witnessed = { playerId: player.id, spotId, at: match.now };
	}
}
