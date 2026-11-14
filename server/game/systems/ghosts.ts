import {
	GHOST_DOOR_COOLDOWN_MS,
	GHOST_DOOR_RANGE,
	GHOST_FAST_SPEED,
	GHOST_KNOCK_COOLDOWN_MS,
	GHOST_KNOCK_LOUDNESS,
	GHOST_MOVEMENT_BUDGET_CAP,
} from "../../../shared/config/index.js";
import {
	clampToGhostBounds,
	insideGhostBounds,
} from "../../../shared/ghost.js";
import type {
	ClientStateMessage,
	GhostActionKind,
} from "../../../shared/protocol/game.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";
import { stopEmote } from "./social.js";

export function isGhost(match: Match, player: MatchPlayer): boolean {
	return match.ghostsAllowed && !player.alive && player.connected;
}

export function moveGhost(
	match: Match,
	player: MatchPlayer,
	message: ClientStateMessage,
	elapsedMs: number,
): "accepted" | "rejected" {
	const dt = elapsedMs / 1000;
	player.moveInput = false;
	player.sprintIntent = false;
	player.crouch = 0;
	player.grounded = false;
	player.movementBudget = Math.min(
		GHOST_MOVEMENT_BUDGET_CAP,
		player.movementBudget + GHOST_FAST_SPEED * dt * 1.2 + 0.08,
	);
	const next = { x: message.x, y: message.y, z: message.z };
	const distance = Math.hypot(
		next.x - player.position.x,
		next.y - player.position.y,
		next.z - player.position.z,
	);
	if (
		distance > player.movementBudget ||
		!insideGhostBounds(next, match.ghostBounds)
	) {
		match.forcedMove(
			player,
			"correction",
			clampToGhostBounds(player.position, match.ghostBounds),
			null,
			140,
		);
		return "rejected";
	}
	player.movementBudget -= distance;
	if (distance > 0.04) {
		stopEmote(match, player);
	}
	player.position = next;
	player.velocity = { x: message.vx, y: message.vy, z: message.vz };
	player.history.push({ t: match.now, ...next, yaw: message.yaw });
	return "accepted";
}

export function ghostAction(
	match: Match,
	player: MatchPlayer,
	kind: GhostActionKind,
	id: number,
): boolean {
	if (!isGhost(match, player)) {
		return false;
	}
	if (kind === "door") {
		return slamDoor(match, player, id);
	}
	return knock(match, player);
}

function slamDoor(match: Match, player: MatchPlayer, doorId: number): boolean {
	const door = match.doors.get(doorId);
	if (!door || player.ghostDoorReadyAt > match.now || match.doorsLocked()) {
		return false;
	}
	const eye = player.eyePosition();
	const distance = Math.hypot(
		door.center.x - eye.x,
		door.center.y - eye.y,
		door.center.z - eye.z,
	);
	if (distance > GHOST_DOOR_RANGE) {
		return false;
	}
	if (!match.setDoor(doorId, !door.open, player.id)) {
		return false;
	}
	player.ghostDoorReadyAt = match.now + GHOST_DOOR_COOLDOWN_MS;
	return true;
}

function knock(match: Match, player: MatchPlayer): boolean {
	if (player.ghostKnockReadyAt > match.now) {
		return false;
	}
	player.ghostKnockReadyAt = match.now + GHOST_KNOCK_COOLDOWN_MS;
	match.emit({ type: "poltergeist", playerId: player.id, ...player.position });
	match.sounds.push({
		position: { ...player.position },
		loudness: GHOST_KNOCK_LOUDNESS,
		playerId: player.id,
		kind: "door",
	});
	return true;
}
