import {
	PERCEPTION_AWARENESS_DECAY_PER_SECOND,
	PERCEPTION_CLOSE_SENSE_DISTANCE,
} from "../../../shared/config/index.js";
import { angleDifference, clamp, type Vec3 } from "../../../shared/math.js";
import {
	countWallsBetween,
	lineOfSight,
} from "../../../shared/physics/lineOfSight.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";
import type { AnomalyEntity } from "./AnomalyEntity.js";
import { canEngage, engagedPlayer } from "./dispersal.js";

export const VISUAL_MEMORY_MS = 4_500;

export interface SoundEvent {
	position: Vec3;
	loudness: number;
	playerId: string | null;
	kind: "footsteps" | "voice" | "shout" | "door" | "water" | "landing";
}

export interface PerceptionResult {
	target: MatchPlayer | null;
	heard: SoundEvent | null;
	hiddenNoise: SoundEvent | null;
}

export function playerVisibleFrom(
	match: Match,
	eye: Vec3,
	player: MatchPlayer,
): boolean {
	const head = {
		x: player.position.x,
		y: player.position.y + player.bodyHeight() - 0.15,
		z: player.position.z,
	};
	const chest = {
		x: player.position.x,
		y: player.position.y + player.bodyHeight() * 0.55,
		z: player.position.z,
	};
	return (
		lineOfSight(match.world, eye, head) || lineOfSight(match.world, eye, chest)
	);
}

export function perceive(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): PerceptionResult {
	const now = match.now;
	const definition = entity.definition;
	const eye = entity.eye();
	for (const player of match.players.values()) {
		const memory = entity.memoryFor(player.id);
		memory.visibleNow = false;
		if (
			!player.alive ||
			!player.connected ||
			player.carried ||
			player.hidden ||
			player.protectedUntil > now
		) {
			memory.awareness = Math.max(
				0,
				memory.awareness - PERCEPTION_AWARENESS_DECAY_PER_SECOND * 2 * dt,
			);
			continue;
		}
		const dx = player.position.x - entity.position.x;
		const dz = player.position.z - entity.position.z;
		const dy = player.position.y - entity.position.y;
		const distance = Math.hypot(dx, dz, dy);
		const lit = match.illuminationOf(player);
		const lanternFactor = player.lanternOpen ? 1.6 : 1;
		const range =
			definition.viewRange * lanternFactor * (0.55 + 0.45 * clamp(lit, 0, 1));
		const angle = Math.abs(angleDifference(entity.yaw, Math.atan2(-dx, -dz)));
		const inCone =
			distance < PERCEPTION_CLOSE_SENSE_DISTANCE ||
			angle <= definition.fieldOfView / 2;
		const visible =
			distance <= range && inCone && playerVisibleFrom(match, eye, player);
		if (visible) {
			memory.visibleNow = true;
			const proximity = 1 - distance / range;
			const lightFactor = player.lanternOpen
				? 2.1
				: 0.3 + 0.7 * clamp(lit, 0, 1);
			const postureFactor = player.crouching ? 0.55 : 1;
			const sprinting =
				player.sprintIntent && player.moveInput && !player.sprintLocked;
			const motionFactor = sprinting ? 1.45 : player.moveInput ? 1 : 0.7;
			const rate =
				distance < PERCEPTION_CLOSE_SENSE_DISTANCE
					? 8
					: 0.95 *
						(0.35 + 1.75 * proximity) *
						lightFactor *
						postureFactor *
						motionFactor;
			memory.awareness = Math.min(1.5, memory.awareness + rate * dt);
			if (memory.awareness >= 1) {
				memory.lastSeenAt = now;
				memory.lastSeenPosition = { ...player.position };
			}
		} else {
			memory.awareness = Math.max(
				0,
				memory.awareness - PERCEPTION_AWARENESS_DECAY_PER_SECOND * dt,
			);
		}
	}

	const hearing = listen(match, entity);
	return { target: chooseTarget(match, entity), ...hearing };
}

function listen(
	match: Match,
	entity: AnomalyEntity,
): Pick<PerceptionResult, "heard" | "hiddenNoise"> {
	let loudest: SoundEvent | null = null;
	let loudestMargin = 0;
	let hiddenNoise: SoundEvent | null = null;
	let hiddenMargin = 0;
	const ear = entity.eye();
	for (const sound of match.sounds) {
		const source = sound.playerId ? match.players.get(sound.playerId) : null;
		if (!source || source.protectedUntil > match.now) {
			continue;
		}
		const distance = Math.hypot(
			sound.position.x - ear.x,
			sound.position.y + 1.2 - ear.y,
			sound.position.z - ear.z,
		);
		if (distance > sound.loudness * entity.definition.hearing * 1.05) {
			continue;
		}
		const walls = countWallsBetween(
			match.world,
			ear,
			{ ...sound.position, y: sound.position.y + 1.2 },
			3,
		);
		const effective =
			(sound.loudness * entity.definition.hearing) / (1 + walls * 0.9);
		const margin = effective - distance;
		if (margin <= 0) {
			continue;
		}
		if (sound.playerId) {
			const memory = entity.memoryFor(sound.playerId);
			memory.lastHeardAt = match.now;
			memory.lastHeardPosition = { ...sound.position };
			const boost =
				sound.kind === "shout" ? 0.6 : sound.kind === "voice" ? 0.25 : 0.18;
			memory.awareness = Math.min(
				memory.awareness >= 1 ? 1.5 : 0.95,
				memory.awareness + boost,
			);
		}
		if (margin > loudestMargin) {
			loudestMargin = margin;
			loudest = sound;
		}
		if (
			sound.playerId &&
			match.players.get(sound.playerId)?.hidden &&
			margin > hiddenMargin
		) {
			hiddenMargin = margin;
			hiddenNoise = sound;
		}
	}
	return { heard: loudest, hiddenNoise };
}

function chooseTarget(match: Match, entity: AnomalyEntity): MatchPlayer | null {
	const now = match.now;
	if (entity.targetId) {
		const current = match.players.get(entity.targetId);
		const memory = entity.memory.get(entity.targetId);
		if (
			current?.alive &&
			!current.carried &&
			memory &&
			now - memory.lastSeenAt < VISUAL_MEMORY_MS &&
			(engagedPlayer(entity) === current.id ||
				canEngage(match, entity, current))
		) {
			return current;
		}
	}
	let best: MatchPlayer | null = null;
	let bestScore = 0;
	for (const player of match.players.values()) {
		const memory = entity.memory.get(player.id);
		if (
			!memory?.visibleNow ||
			memory.awareness < 1 ||
			!player.alive ||
			!canEngage(match, entity, player)
		) {
			continue;
		}
		const distance = Math.hypot(
			player.position.x - entity.position.x,
			player.position.z - entity.position.z,
		);
		const score = 2 + 30 / (distance + 1);
		if (score > bestScore) {
			bestScore = score;
			best = player;
		}
	}
	return best;
}

export function targetIsVisible(
	entity: AnomalyEntity,
	playerId: string,
): boolean {
	return entity.memory.get(playerId)?.visibleNow ?? false;
}

export function lastKnownPosition(
	entity: AnomalyEntity,
	playerId: string,
): Vec3 | null {
	return entity.memory.get(playerId)?.lastSeenPosition ?? null;
}
