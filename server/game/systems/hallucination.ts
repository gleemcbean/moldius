import { HALLUCINATION_MS } from "../../../shared/config/index.js";
import type { AnomalyEntity } from "../ai/AnomalyEntity.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";

export function startHallucination(
	match: Match,
	player: MatchPlayer,
	source: AnomalyEntity,
): void {
	player.hallucinatingUntil = match.now + HALLUCINATION_MS;
	player.hallucinatedBy = source.id;

	match.emit({
		type: "hallucination",
		playerId: player.id,
		anomalyId: source.id,
		until: player.hallucinatingUntil,
	});
}

export function endHallucination(match: Match, player: MatchPlayer): void {
	if (player.hallucinatingUntil === 0) {
		return;
	}

	player.hallucinatingUntil = 0;
	player.hallucinatedBy = null;

	match.emit({
		type: "hallucination",
		playerId: player.id,
		anomalyId: null,
		until: 0,
	});
}

export function dispelVisionsOf(match: Match, entity: AnomalyEntity): void {
	for (const player of match.players.values()) {
		if (player.hallucinatedBy === entity.id) {
			endHallucination(match, player);
		}
	}
}

export function updateHallucinations(match: Match): void {
	for (const player of match.players.values()) {
		if (player.hallucinatingUntil === 0) {
			continue;
		}

		if (
			!player.alive ||
			!player.connected ||
			match.now >= player.hallucinatingUntil
		) {
			endHallucination(match, player);
		}
	}
}
