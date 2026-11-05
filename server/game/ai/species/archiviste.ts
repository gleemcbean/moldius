import {
	ARCHIVIST_CIRCLE_RADIUS,
	ARCHIVIST_PULSE_INTERVAL_MS,
	ARCHIVIST_PULSE_TELEGRAPH_MS,
} from "../../../../shared/config/index.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";

export function updateArchiviste(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	const roomId = entity.homeRoom;
	if (roomId === null) {
		return;
	}
	const room = match.layout.rooms[roomId];
	entity.position = {
		x: room.labelPoint.x,
		y: room.floorY,
		z: room.labelPoint.z,
	};
	entity.yaw += dt * 0.25;
	entity.velocity = { x: 0, y: 0, z: 0 };
	const occupants = playersInRoom(match, roomId);
	entity.targetId = occupants[0]?.id ?? null;
	if (occupants.length > 0) {
		for (const player of occupants) {
			const memory = entity.memoryFor(player.id);
			memory.visibleNow = true;
			memory.awareness = 1.5;
			memory.lastSeenAt = match.now;
			memory.lastSeenPosition = { ...player.position };
		}
	}

	if (entity.pulseCharging) {
		if (entity.stateAge(match.now) >= ARCHIVIST_PULSE_TELEGRAPH_MS) {
			releasePulse(match, entity);
		}
		return;
	}
	if (occupants.length === 0) {
		entity.setState("idle", match.now);
		entity.nextPulseAt = Math.max(entity.nextPulseAt, match.now + 900);
		return;
	}
	if (entity.state !== "recover") {
		entity.setState("recover", match.now);
	}
	if (match.now >= entity.nextPulseAt) {
		entity.pulseCharging = true;
		entity.setState("windup", match.now);
		match.emit({
			type: "pulse",
			anomalyId: entity.id,
			phase: "charge",
			...entity.position,
			radius: ARCHIVIST_CIRCLE_RADIUS,
		});
	}
}

function releasePulse(match: Match, entity: AnomalyEntity): void {
	entity.pulseCharging = false;
	entity.nextPulseAt =
		match.now + ARCHIVIST_PULSE_INTERVAL_MS - ARCHIVIST_PULSE_TELEGRAPH_MS;
	entity.setState("recover", match.now);
	match.emit({
		type: "pulse",
		anomalyId: entity.id,
		phase: "release",
		...entity.position,
		radius: ARCHIVIST_CIRCLE_RADIUS,
	});
	for (const player of insideCircle(match, entity)) {
		match.applyDamage(
			player,
			entity.definition.damage,
			entity.species,
			entity.center(),
		);
	}
}

export function playersInRoom(match: Match, roomId: number): MatchPlayer[] {
	return [...match.players.values()].filter(
		(player) => player.active && player.roomId === roomId,
	);
}

export function insideCircle(
	match: Match,
	entity: AnomalyEntity,
): MatchPlayer[] {
	return [...match.players.values()].filter(
		(player) =>
			player.active &&
			player.roomId === entity.homeRoom &&
			Math.abs(player.position.y - entity.position.y) < 1.6 &&
			Math.hypot(
				player.position.x - entity.position.x,
				player.position.z - entity.position.z,
			) <= ARCHIVIST_CIRCLE_RADIUS,
	);
}

export function pulseProgress(entity: AnomalyEntity, now: number): number {
	if (!entity.pulseCharging) {
		return 0;
	}
	return Math.min(1, entity.stateAge(now) / ARCHIVIST_PULSE_TELEGRAPH_MS);
}
