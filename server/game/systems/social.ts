import {
	EMOTE_COOLDOWN_MS,
	EMOTE_DURATION_MS,
	EMOTE_IDS,
	type EmoteId,
	GIFT_COOLDOWN_MS,
	GIFT_RANGE,
	MATERIAL_IDS,
	type MaterialId,
	PING_BURST,
	PING_BURST_WINDOW_MS,
	PING_COOLDOWN_MS,
	PING_KINDS,
	PING_LIFETIME_MS,
	PING_MAX_DISTANCE,
} from "../../../shared/config/index.js";
import { lineOfSight } from "../../../shared/physics/lineOfSight.js";
import type { PingRequest } from "../../../shared/protocol/game.js";
import { sameTeam } from "../../../shared/teams.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";
import { isGhost } from "./ghosts.js";

let pingCounter = 0;

export function isPingKind(value: unknown): value is PingRequest["kind"] {
	return (
		typeof value === "string" &&
		(PING_KINDS as readonly string[]).includes(value)
	);
}

export function isEmoteId(value: unknown): value is EmoteId {
	return (
		typeof value === "string" &&
		(EMOTE_IDS as readonly string[]).includes(value)
	);
}

export function isMaterialId(value: unknown): value is MaterialId {
	return (
		typeof value === "string" &&
		(MATERIAL_IDS as readonly string[]).includes(value)
	);
}

export function allied(
	match: Match,
	first: MatchPlayer,
	second: MatchPlayer,
): boolean {
	return (
		first === second || match.possessed !== null || sameTeam(first, second)
	);
}

function audience(match: Match, sender: MatchPlayer): MatchPlayer[] {
	const ghost = isGhost(match, sender);
	return [...match.players.values()].filter(
		(other) =>
			allied(match, sender, other) &&
			(other === sender || !ghost || isGhost(match, other)),
	);
}

function pingAllowed(match: Match, player: MatchPlayer): boolean {
	const now = match.now;
	while (
		player.pingTimes.length > 0 &&
		now - player.pingTimes[0] >= PING_BURST_WINDOW_MS
	) {
		player.pingTimes.shift();
	}
	return player.pingReadyAt <= now && player.pingTimes.length < PING_BURST;
}

export function sendPing(
	match: Match,
	player: MatchPlayer,
	request: PingRequest,
): boolean {
	const ghost = isGhost(match, player);
	if (
		(!player.alive && !ghost) ||
		player.carried ||
		!pingAllowed(match, player)
	) {
		return false;
	}
	const eye = player.eyePosition();
	if (
		Math.hypot(request.x - eye.x, request.y - eye.y, request.z - eye.z) >
		PING_MAX_DISTANCE
	) {
		return false;
	}
	const anomaly =
		request.anomalyId === null ? null : match.anomalies[request.anomalyId];
	const anomalyId = anomaly?.active ? anomaly.id : null;
	player.pingReadyAt = match.now + PING_COOLDOWN_MS;
	player.pingTimes.push(match.now);
	pingCounter += 1;
	match.emitTo(audience(match, player), {
		type: "ping",
		id: pingCounter,
		playerId: player.id,
		kind:
			anomalyId === null && request.kind === "monster"
				? "danger"
				: request.kind,
		x: request.x,
		y: request.y,
		z: request.z,
		anomalyId,
		expiresAt: match.now + PING_LIFETIME_MS,
	});
	return true;
}

function broadcastEmote(
	match: Match,
	player: MatchPlayer,
	emote: EmoteId | null,
): void {
	const event = {
		type: "emote" as const,
		playerId: player.id,
		emote,
		until: player.emoteUntil,
	};
	if (isGhost(match, player)) {
		match.emitTo(
			[...match.players.values()].filter((other) => isGhost(match, other)),
			event,
		);
	} else {
		match.emit(event);
	}
}

export function stopEmote(match: Match, player: MatchPlayer): boolean {
	if (player.emoteUntil <= match.now) {
		return false;
	}
	player.emoteUntil = match.now;
	broadcastEmote(match, player, null);
	return true;
}

export function playEmote(
	match: Match,
	player: MatchPlayer,
	emote: EmoteId | null,
): boolean {
	if (emote === null) {
		return stopEmote(match, player);
	}
	const ghost = isGhost(match, player);
	if (
		(!player.alive && !ghost) ||
		player.hidden ||
		player.carried ||
		player.emoteReadyAt > match.now
	) {
		return false;
	}
	player.emoteReadyAt = match.now + EMOTE_COOLDOWN_MS;
	player.emoteUntil = match.now + EMOTE_DURATION_MS[emote];
	broadcastEmote(match, player, emote);
	return true;
}

export function giveFragment(
	match: Match,
	giver: MatchPlayer,
	targetId: string,
	material: MaterialId,
): boolean {
	const target = match.players.get(targetId);
	if (
		!target ||
		target === giver ||
		!giver.active ||
		!target.active ||
		giver.giftReadyAt > match.now ||
		giver.materials[material] < 1
	) {
		return false;
	}
	const distance = Math.hypot(
		target.position.x - giver.position.x,
		target.position.y - giver.position.y,
		target.position.z - giver.position.z,
	);
	if (
		distance > GIFT_RANGE + 0.4 ||
		!lineOfSight(match.world, giver.eyePosition(), target.eyePosition(), {
			ignoreFurniture: true,
			blockGlass: true,
		})
	) {
		return false;
	}
	giver.giftReadyAt = match.now + GIFT_COOLDOWN_MS;
	giver.materials[material] -= 1;
	target.materials[material] += 1;
	match.sendInventory(giver);
	match.sendInventory(target);
	match.emit({ type: "gift", fromId: giver.id, toId: target.id, material });
	return true;
}
