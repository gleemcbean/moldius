import {
	COLLECTOR_CARRY_MAX_MS,
	COLLECTOR_CARRY_MIN_DISTANCE,
	COLLECTOR_CARRY_SPEED,
	COLLECTOR_FLEE_IGNORE_MS,
	COLLECTOR_FLEE_MAX_MS,
	COLLECTOR_FLEE_MIN_DISTANCE,
	COLLECTOR_FLEE_SPEED,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import type { Room } from "../../../../shared/manor/types.js";
import type { Vec3 } from "../../../../shared/math.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { meleeStrike } from "../combat.js";
import { roomHasSpace } from "../dispersal.js";
import { updateHunter } from "../hunter.js";
import {
	clearPath,
	followPath,
	requestPath,
	trackProgress,
} from "../locomotion.js";
import { randomPointInRoom, releaseClaim } from "../patrol.js";
import { perceive } from "../perception.js";
import { meleeProfile } from "./profiles.js";

const PROFILE = meleeProfile(SPECIES.collecteur, {
	strike: (match: Match, entity: AnomalyEntity, target: MatchPlayer) => {
		const hit = meleeStrike(match, entity, target);
		match.emit({
			type: "attack",
			anomalyId: entity.id,
			phase: "strike",
			targetId: target.id,
			hit,
		});
		if (hit && target.alive) {
			startCarry(match, entity, target);
		}
	},
});

export function updateCollecteur(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	if (entity.carryingPlayerId) {
		runCarry(match, entity, dt);
		return;
	}
	if (entity.state === "flee") {
		runFlee(match, entity, dt);
		return;
	}
	updateHunter(match, entity, dt, PROFILE, perceive(match, entity, dt));
}

function startCarry(
	match: Match,
	entity: AnomalyEntity,
	target: MatchPlayer,
): void {
	const destination = pickDropRoom(match, entity);
	if (!destination || !requestPath(match, entity, destination)) {
		return;
	}
	releaseClaim(match, entity);
	entity.carryingPlayerId = target.id;
	entity.carryUntil = match.now + COLLECTOR_CARRY_MAX_MS;
	match.beginCarry(target, entity);
	entity.setState("special", match.now);
}

function pickDropRoom(match: Match, entity: AnomalyEntity) {
	const currentRoom = match.roomIdAt(entity.position);
	const candidates = match.rng.shuffle(
		match.layout.rooms.filter(
			(room) =>
				room.id !== currentRoom &&
				room.type !== "stairwell" &&
				roomHasSpace(match, room.id, entity) &&
				travelDistance(room, entity.position) >= COLLECTOR_CARRY_MIN_DISTANCE,
		),
	);
	return firstPointIn(match, candidates.slice(0, 6));
}

function pickFleeRoom(match: Match, entity: AnomalyEntity, from: Vec3) {
	const currentRoom = match.roomIdAt(entity.position);
	const candidates = match.layout.rooms
		.filter(
			(room) =>
				room.id !== currentRoom &&
				room.type !== "stairwell" &&
				roomHasSpace(match, room.id, entity) &&
				travelDistance(room, from) >= COLLECTOR_FLEE_MIN_DISTANCE,
		)
		.sort((a, b) => travelDistance(b, from) - travelDistance(a, from));
	return firstPointIn(match, match.rng.shuffle(candidates.slice(0, 3)));
}

function travelDistance(room: Room, from: Vec3): number {
	return (
		Math.hypot(room.labelPoint.x - from.x, room.labelPoint.z - from.z) +
		Math.abs(room.floorY - from.y) * 4
	);
}

function firstPointIn(match: Match, rooms: Room[]): Vec3 | null {
	for (const room of rooms) {
		const point = randomPointInRoom(match, room);
		if (point) {
			return point;
		}
	}
	return null;
}

function runCarry(match: Match, entity: AnomalyEntity, dt: number): void {
	const player = match.players.get(entity.carryingPlayerId as string);
	if (!player?.alive || player.carriedBy !== entity.id) {
		finishCarry(match, entity);
		return;
	}
	const status = followPath(match, entity, COLLECTOR_CARRY_SPEED, dt);
	const stuck = trackProgress(match, entity, status === "moving");
	match.attachCarried(player, entity);
	if (
		status === "arrived" ||
		status === "blocked" ||
		stuck ||
		match.now >= entity.carryUntil
	) {
		finishCarry(match, entity);
	}
}

function finishCarry(match: Match, entity: AnomalyEntity): void {
	const player = entity.carryingPlayerId
		? match.players.get(entity.carryingPlayerId)
		: undefined;
	entity.carryingPlayerId = null;
	clearPath(entity);
	entity.targetId = null;
	if (player && player.carriedBy === entity.id) {
		match.dropCarried(player, entity);
		entity.memory.delete(player.id);
		entity.ignoredUntil.set(player.id, match.now + COLLECTOR_FLEE_IGNORE_MS);
	}
	const goal = pickFleeRoom(match, entity, player?.position ?? entity.position);
	if (!goal || !requestPath(match, entity, goal)) {
		entity.setState("recover", match.now);
		return;
	}
	entity.carryUntil = match.now + COLLECTOR_FLEE_MAX_MS;
	entity.setState("flee", match.now);
}

function runFlee(match: Match, entity: AnomalyEntity, dt: number): void {
	const status = followPath(match, entity, COLLECTOR_FLEE_SPEED, dt);
	const stuck = trackProgress(match, entity, status === "moving");
	if (
		status === "arrived" ||
		status === "blocked" ||
		stuck ||
		match.now >= entity.carryUntil
	) {
		clearPath(entity);
		entity.memory.clear();
		entity.setState("idle", match.now);
		entity.idleUntil = match.now + 1500;
	}
}
