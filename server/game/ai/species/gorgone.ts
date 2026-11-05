import { isGazingAt } from "../../../../shared/anomalies/gaze.js";
import {
	ANOMALY_DISINTEREST_MS,
	GORGON_DIRECT_RANGE,
	GORGON_GAZE_DECAY,
	GORGON_GAZE_LIMIT_MS,
	GORGON_PETRIFY_MS,
	GORGON_PURSUIT_MS,
	GORGON_SHRIEK_MS,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { inMeleeReach, meleeStrike, targetIsStrikeable } from "../combat.js";
import { canEngage, interestToDrop } from "../dispersal.js";
import { type HunterProfile, updateHunter } from "../hunter.js";
import {
	clearPath,
	faceTowards,
	followPath,
	moveDirect,
	requestPath,
} from "../locomotion.js";
import { releaseClaim } from "../patrol.js";
import { meleeProfile } from "./profiles.js";

const DEFINITION = SPECIES.gorgone;

const CALM: HunterProfile = meleeProfile(DEFINITION, {
	canHunt: false,
	canInvestigate: false,
	canExtract: false,
});

export function updateGorgone(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	updateGaze(match, entity, dt);
	switch (entity.state) {
		case "special":
			runShriek(match, entity, dt);
			return;
		case "chase":
			runPursuit(match, entity, dt);
			return;
		case "windup":
			runStrike(match, entity, dt);
			return;
		case "recover":
			runCalmDown(match, entity);
			return;
		default:
			break;
	}
	const gazer = gazerOverLimit(match, entity);
	if (gazer) {
		enrage(match, entity, gazer);
		return;
	}
	updateHunter(match, entity, dt, CALM, {
		target: null,
		heard: null,
		hiddenNoise: null,
	});
}

export function gazeFraction(entity: AnomalyEntity): number {
	let highest = 0;
	for (const value of entity.gaze.values()) {
		highest = Math.max(highest, value);
	}
	return Math.min(1, highest / GORGON_GAZE_LIMIT_MS);
}

function updateGaze(match: Match, entity: AnomalyEntity, dt: number): void {
	const center = entity.center();
	for (const player of match.players.values()) {
		const looking =
			player.active &&
			isGazingAt(
				match.world,
				player.eyePosition(),
				player.yaw,
				player.pitch,
				center,
			);
		const current = entity.gaze.get(player.id) ?? 0;
		entity.gaze.set(
			player.id,
			looking
				? current + dt * 1000
				: Math.max(0, current - dt * 1000 * GORGON_GAZE_DECAY),
		);
	}
}

function gazerOverLimit(
	match: Match,
	entity: AnomalyEntity,
): MatchPlayer | null {
	let best: MatchPlayer | null = null;
	let bestGaze = GORGON_GAZE_LIMIT_MS;
	for (const [playerId, gaze] of entity.gaze) {
		const player = match.players.get(playerId);
		if (
			player?.active &&
			gaze >= bestGaze &&
			canEngage(match, entity, player)
		) {
			best = player;
			bestGaze = gaze;
		}
	}
	return best;
}

function enrage(match: Match, entity: AnomalyEntity, gazer: MatchPlayer): void {
	entity.targetId = gazer.id;
	entity.pursuitUntil = match.now + GORGON_SHRIEK_MS + GORGON_PURSUIT_MS;
	clearPath(entity);
	releaseClaim(match, entity);
	entity.velocity = { x: 0, y: 0, z: 0 };
	entity.setState("special", match.now);
	match.emit({
		type: "scream",
		anomalyId: entity.id,
		until: match.now + GORGON_SHRIEK_MS,
	});
}

function pursued(match: Match, entity: AnomalyEntity): MatchPlayer | null {
	const target = entity.targetId
		? match.players.get(entity.targetId)
		: undefined;
	if (
		!target?.alive ||
		!target.connected ||
		target.hidden ||
		target.carried ||
		match.now > entity.pursuitUntil
	) {
		return null;
	}
	return target;
}

function runShriek(match: Match, entity: AnomalyEntity, dt: number): void {
	entity.velocity = { x: 0, y: 0, z: 0 };
	const target = pursued(match, entity);
	if (!target) {
		calm(match, entity);
		return;
	}
	faceTowards(entity, target.position, 6, dt);
	if (entity.stateAge(match.now) >= GORGON_SHRIEK_MS) {
		entity.setState("chase", match.now);
	}
}

function runPursuit(match: Match, entity: AnomalyEntity, dt: number): void {
	const target = pursued(match, entity);
	const crowded = interestToDrop(match, entity);
	if (crowded) {
		entity.ignoredUntil.set(crowded, match.now + ANOMALY_DISINTEREST_MS);
	}
	if (!target || crowded) {
		calm(match, entity);
		return;
	}
	if (
		targetIsStrikeable(match, target) &&
		inMeleeReach(match, entity, target, -0.05)
	) {
		entity.velocity = { x: 0, y: 0, z: 0 };
		entity.attackTargetId = target.id;
		entity.strikeDone = false;
		entity.setState("windup", match.now);
		match.emit({
			type: "attack",
			anomalyId: entity.id,
			phase: "windup",
			targetId: target.id,
			hit: false,
		});
		return;
	}
	const goal = target.position;
	const distance = Math.hypot(
		goal.x - entity.position.x,
		goal.z - entity.position.z,
	);
	if (
		distance < GORGON_DIRECT_RANGE &&
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

function runStrike(match: Match, entity: AnomalyEntity, dt: number): void {
	entity.velocity = { x: 0, y: 0, z: 0 };
	const target = entity.attackTargetId
		? match.players.get(entity.attackTargetId)
		: undefined;
	if (target) {
		faceTowards(entity, target.position, 8, dt);
	}
	if (entity.stateAge(match.now) < DEFINITION.windupMs) {
		return;
	}
	if (target && !entity.strikeDone) {
		entity.strikeDone = true;
		entity.lastStrikeAt = match.now;
		const hit = meleeStrike(match, entity, target);
		if (hit && target.alive) {
			target.petrifiedUntil = match.now + GORGON_PETRIFY_MS;
		}
		match.emit({
			type: "attack",
			anomalyId: entity.id,
			phase: "strike",
			targetId: target.id,
			hit,
		});
	}
	entity.setState("recover", match.now);
}

function runCalmDown(match: Match, entity: AnomalyEntity): void {
	entity.velocity = { x: 0, y: 0, z: 0 };
	if (entity.stateAge(match.now) >= DEFINITION.recoveryMs) {
		calm(match, entity);
	}
}

function calm(match: Match, entity: AnomalyEntity): void {
	entity.gaze.clear();
	entity.targetId = null;
	entity.attackTargetId = null;
	clearPath(entity);
	entity.setState("idle", match.now);
	entity.idleUntil = match.now + 1500;
}
