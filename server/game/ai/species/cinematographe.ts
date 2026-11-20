import {
	CINEMA_BREAK_DISTANCE,
	CINEMA_MIN_STAY_MS,
	CINEMA_REARM_MS,
	CINEMA_RESULT_GRACE_MS,
	CINEMA_STALL_MS,
	CINEMA_UNWATCHED_MS,
	HEALTH_MAX,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import {
	angleDifference,
	type Vec3,
	yawToDirection,
} from "../../../../shared/math.js";
import {
	FILM_TOTAL_MS,
	nextFilmLevel,
	replayFilm,
	sanitizeFilmInputs,
} from "../../../../shared/minigames/filmRunner.js";
import { lineOfSight } from "../../../../shared/physics/lineOfSight.js";
import type {
	FilmReport,
	SeancePhase,
} from "../../../../shared/protocol/game.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import type { AnomalyEntity, Seance } from "../AnomalyEntity.js";
import { sameFloor, targetIsStrikeable } from "../combat.js";
import { canEngage, observedByPlayers } from "../dispersal.js";
import {
	clearPath,
	faceTowards,
	followPath,
	moveDirect,
	requestPath,
} from "../locomotion.js";
import { releaseClaim } from "../patrol.js";
import { type PerceptionResult, perceive } from "../perception.js";

const DEFINITION = SPECIES.cinematographe;
const LENS_HEIGHT = 1.47;
const LENS_REACH = 0.7;
const LURK_TURN_RATE = 2;
const AIM_TURN_RATE = 5;
const LOST_SIGHT_MS = 350;
const ABORT_COOLDOWN_MS = 1_800;
const EARLY_REPORT_TOLERANCE_MS = 1_500;
const STAND_OFF = 3;

export function lensOf(entity: AnomalyEntity): Vec3 {
	const forward = yawToDirection(entity.yaw);

	return {
		x: entity.position.x + forward.x * LENS_REACH,
		y: entity.position.y + LENS_HEIGHT,
		z: entity.position.z + forward.z * LENS_REACH,
	};
}

function flatDistance(a: Vec3, b: Vec3): number {
	return Math.hypot(a.x - b.x, a.z - b.z);
}

export function inBeam(
	match: Match,
	entity: AnomalyEntity,
	player: MatchPlayer,
	slack = 0,
): boolean {
	const lens = lensOf(entity);
	const eye = player.eyePosition();
	const distance = Math.hypot(eye.x - lens.x, eye.y - lens.y, eye.z - lens.z);

	if (distance > DEFINITION.attackRange + slack || !sameFloor(entity, player)) {
		return false;
	}

	const bearing = Math.atan2(
		-(player.position.x - entity.position.x),
		-(player.position.z - entity.position.z),
	);

	if (
		Math.abs(angleDifference(entity.yaw, bearing)) >
		DEFINITION.fieldOfView / 2 + slack * 0.2
	) {
		return false;
	}

	const chest = {
		x: player.position.x,
		y: player.position.y + player.bodyHeight() * 0.6,
		z: player.position.z,
	};

	return [eye, chest].some((point) =>
		lineOfSight(match.world, lens, point, { blockGlass: true }),
	);
}

function emitSeance(
	match: Match,
	entity: AnomalyEntity,
	seance: Seance,
	phase: SeancePhase,
): void {
	match.emit({
		type: "seance",
		phase,
		anomalyId: entity.id,
		playerId: seance.playerId,
		seed: seance.seed,
		level: seance.level,
		startsAt: seance.startsAt,
		endsAt: seance.endsAt,
	});
}

function pickSpectator(
	match: Match,
	entity: AnomalyEntity,
	perception: PerceptionResult,
): MatchPlayer | null {
	const seen = perception.target;

	if (
		!seen ||
		seen.entranced ||
		!targetIsStrikeable(match, seen) ||
		!canEngage(match, entity, seen)
	) {
		return null;
	}

	return seen;
}

function lurk(
	match: Match,
	entity: AnomalyEntity,
	perception: PerceptionResult,
	dt: number,
): void {
	entity.velocity = { x: 0, y: 0, z: 0 };

	if (entity.state !== "idle") {
		clearPath(entity);
		releaseClaim(match, entity);

		entity.targetId = null;

		entity.setState("idle", match.now);
	}

	if (perception.heard?.playerId) {
		faceTowards(entity, perception.heard.position, LURK_TURN_RATE, dt);
	}

	if (observedByPlayers(match, entity)) {
		entity.watchedAt = match.now;

		return;
	}

	if (
		match.now - entity.watchedAt >= CINEMA_UNWATCHED_MS &&
		match.now - entity.spawnedAt >= CINEMA_MIN_STAY_MS &&
		!match.placeAnomaly(entity)
	) {
		entity.watchedAt = match.now - CINEMA_UNWATCHED_MS + 1_000;
	}
}

function approach(
	match: Match,
	entity: AnomalyEntity,
	target: MatchPlayer,
	dt: number,
): void {
	if (entity.state !== "chase") {
		clearPath(entity);
		entity.setState("chase", match.now);
	}

	entity.targetId = target.id;

	const goal = target.position;
	const distance = flatDistance(goal, entity.position);

	if (distance <= STAND_OFF) {
		entity.velocity = { x: 0, y: 0, z: 0 };

		faceTowards(entity, goal, AIM_TURN_RATE, dt);

		return;
	}

	if (
		distance < 9 &&
		Math.abs(goal.y - entity.position.y) < 0.6 &&
		moveDirect(match, entity, goal, DEFINITION.hostileSpeed, dt)
	) {
		clearPath(entity);

		return;
	}

	const goalMoved =
		!entity.pathGoal ||
		Math.hypot(entity.pathGoal.x - goal.x, entity.pathGoal.z - goal.z) > 1;

	if (
		entity.path.length === 0 ||
		(goalMoved && match.now >= entity.nextRepathAt)
	) {
		requestPath(match, entity, goal);
	}

	followPath(match, entity, DEFINITION.hostileSpeed, dt);
}

function abortAim(match: Match, entity: AnomalyEntity): void {
	entity.attackTargetId = null;
	entity.lastStrikeAt = match.now - CINEMA_REARM_MS + ABORT_COOLDOWN_MS;

	entity.setState("idle", match.now);
}

function startAim(
	match: Match,
	entity: AnomalyEntity,
	target: MatchPlayer,
): void {
	clearPath(entity);
	releaseClaim(match, entity);

	entity.attackTargetId = target.id;
	entity.targetId = target.id;
	entity.lostTargetAt = match.now;
	entity.velocity = { x: 0, y: 0, z: 0 };

	entity.setState("windup", match.now);

	match.emit({
		type: "attack",
		anomalyId: entity.id,
		phase: "windup",
		targetId: target.id,
		hit: false,
	});
}

function startSeance(
	match: Match,
	entity: AnomalyEntity,
	target: MatchPlayer,
): void {
	const seance: Seance = {
		playerId: target.id,
		seed: match.rng.int(1, 0x7fffffff),
		level: target.filmLevel,
		startsAt: match.now,
		endsAt: match.now + FILM_TOTAL_MS,
	};

	entity.seance = seance;
	entity.attackTargetId = null;

	target.entrancedBy = entity.id;
	target.casting = null;
	target.compulsion = null;
	target.velocity = { x: 0, y: 0, z: 0 };

	entity.setState("special", match.now);

	emitSeance(match, entity, seance, "start");
}

function runAim(match: Match, entity: AnomalyEntity, dt: number): void {
	const target = entity.attackTargetId
		? match.players.get(entity.attackTargetId)
		: undefined;

	entity.velocity = { x: 0, y: 0, z: 0 };

	if (!target || target.entranced || !targetIsStrikeable(match, target)) {
		abortAim(match, entity);

		return;
	}

	faceTowards(entity, target.position, AIM_TURN_RATE, dt);

	if (inBeam(match, entity, target, CINEMA_BREAK_DISTANCE)) {
		entity.lostTargetAt = match.now;
	} else if (match.now - entity.lostTargetAt > LOST_SIGHT_MS) {
		abortAim(match, entity);

		return;
	}

	if (entity.stateAge(match.now) >= DEFINITION.windupMs) {
		startSeance(match, entity, target);
	}
}

function release(match: Match, entity: AnomalyEntity): MatchPlayer | null {
	const seance = entity.seance;

	entity.seance = null;

	if (!seance) {
		return null;
	}

	const target = match.players.get(seance.playerId) ?? null;

	if (target && target.entrancedBy === entity.id) {
		target.entrancedBy = -1;
	}

	return target;
}

export function abortSeance(match: Match, entity: AnomalyEntity): void {
	const seance = entity.seance;

	if (!seance) {
		return;
	}

	release(match, entity);
	emitSeance(match, entity, seance, "cancel");

	entity.lastStrikeAt = match.now;

	if (entity.active) {
		entity.setState("idle", match.now);
	}
}

function resolveSeance(
	match: Match,
	entity: AnomalyEntity,
	won: boolean,
): void {
	const seance = entity.seance;

	if (!seance) {
		return;
	}

	const target = release(match, entity);

	emitSeance(match, entity, seance, won ? "won" : "lost");

	entity.lastStrikeAt = match.now;
	entity.targetId = null;

	if (target) {
		target.filmLevel = nextFilmLevel(target.filmLevel, won, target.filmsPlayed);
		target.filmsPlayed += 1;
	}

	if (won) {
		entity.setState("stalled", match.now);

		return;
	}

	if (target) {
		match.applyDamage(target, HEALTH_MAX, "cinematographe", lensOf(entity));
	}

	entity.setState("recover", match.now);
}

function runSeance(match: Match, entity: AnomalyEntity, dt: number): void {
	const seance = entity.seance;

	entity.velocity = { x: 0, y: 0, z: 0 };

	if (!seance) {
		entity.setState("idle", match.now);

		return;
	}

	const target = match.players.get(seance.playerId);

	if (!target?.alive || !target.connected || target.entrancedBy !== entity.id) {
		abortSeance(match, entity);

		return;
	}

	faceTowards(entity, target.position, AIM_TURN_RATE, dt);

	if (match.now > seance.endsAt + CINEMA_RESULT_GRACE_MS) {
		resolveSeance(match, entity, false);
	}
}

function runRewind(match: Match, entity: AnomalyEntity): void {
	entity.velocity = { x: 0, y: 0, z: 0 };

	if (entity.stateAge(match.now) >= DEFINITION.recoveryMs) {
		entity.setState("idle", match.now);
	}
}

function runStall(match: Match, entity: AnomalyEntity): void {
	entity.velocity = { x: 0, y: 0, z: 0 };

	if (entity.stateAge(match.now) >= CINEMA_STALL_MS) {
		entity.watchedAt = match.now;
		entity.lastStrikeAt = match.now;

		entity.setState("idle", match.now);
	}
}

export function reportFilm(
	match: Match,
	player: MatchPlayer,
	report: FilmReport,
): void {
	const entity = match.anomalies[report.anomalyId];
	const seance = entity?.seance;

	if (
		!entity ||
		!seance ||
		entity.state !== "special" ||
		seance.playerId !== player.id
	) {
		return;
	}

	const inputs = sanitizeFilmInputs(report.inputs);

	if (!inputs) {
		resolveSeance(match, entity, false);

		return;
	}

	const result = replayFilm(seance.seed, seance.level, inputs);

	if (
		result.outcome === "won" &&
		match.now < seance.startsAt + FILM_TOTAL_MS - EARLY_REPORT_TOLERANCE_MS
	) {
		return;
	}

	resolveSeance(match, entity, result.outcome === "won");
}

export function seanceProgress(entity: AnomalyEntity, now: number): number {
	const seance = entity.seance;

	if (!seance) {
		return 0;
	}

	return Math.min(1, Math.max(0, (now - seance.startsAt) / FILM_TOTAL_MS));
}

export function updateCinematographe(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	const perception = perceive(match, entity, dt);

	switch (entity.state) {
		case "special":
			runSeance(match, entity, dt);

			return;

		case "stalled":
			runStall(match, entity);

			return;

		case "recover":
			runRewind(match, entity);

			return;

		case "windup":
			runAim(match, entity, dt);

			return;

		default:
			break;
	}

	const spectator = pickSpectator(match, entity, perception);

	if (
		spectator &&
		match.now - entity.lastStrikeAt >= CINEMA_REARM_MS &&
		inBeam(match, entity, spectator)
	) {
		startAim(match, entity, spectator);

		return;
	}

	if (spectator) {
		approach(match, entity, spectator, dt);

		return;
	}

	lurk(match, entity, perception, dt);
}
