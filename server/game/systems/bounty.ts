import {
	BOUNTY_CLAIM_WINDOW_MS,
	BOUNTY_MIN_LEAD,
	BOUNTY_PUSH_COOLDOWN_MS,
	BOUNTY_PUSH_POINTS,
	BOUNTY_SENSE_FACTOR,
	bountyValue,
} from "../../../shared/config/index.js";
import type { GameEvent } from "../../../shared/protocol/game.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";

export class BountySystem {
	holderId: string | null = null;
	value = 0;

	constructor(private readonly enabled: boolean) {}

	senseFactor(player: MatchPlayer): number {
		return this.enabled && player.id === this.holderId
			? BOUNTY_SENSE_FACTOR
			: 1;
	}

	update(match: Match): void {
		if (!this.enabled) {
			return;
		}

		const ranked = [...match.players.values()]
			.filter((player) => player.connected)
			.sort((a, b) => b.score - a.score);

		const lead =
			ranked.length >= 2 ? ranked[0].score - ranked[1].score : -Infinity;

		const holder = lead >= BOUNTY_MIN_LEAD ? ranked[0] : null;
		const value = holder ? bountyValue(lead) : 0;

		if ((holder?.id ?? null) === this.holderId && value === this.value) {
			return;
		}

		for (const player of match.players.values()) {
			player.bountyHolder = player === holder;
		}

		this.holderId = holder?.id ?? null;
		this.value = value;

		match.emit({ type: "bounty", playerId: this.holderId, value });
	}

	onPush(match: Match, pusher: MatchPlayer, target: MatchPlayer): void {
		if (!this.enabled || target.id !== this.holderId) {
			return;
		}

		target.bountyPushedBy = pusher.id;
		target.bountyPushedAt = match.now;

		if (pusher.bountyPushReadyAt > match.now) {
			return;
		}

		pusher.bountyPushReadyAt = match.now + BOUNTY_PUSH_COOLDOWN_MS;

		this.reward(match, pusher, target, BOUNTY_PUSH_POINTS, "push");
	}

	onDeath(match: Match, victim: MatchPlayer): void {
		if (
			!this.enabled ||
			victim.id !== this.holderId ||
			victim.bountyPushedBy === null ||
			match.now - victim.bountyPushedAt > BOUNTY_CLAIM_WINDOW_MS
		) {
			return;
		}

		const claimer = match.players.get(victim.bountyPushedBy);

		victim.bountyPushedBy = null;

		if (claimer && claimer !== victim) {
			this.reward(match, claimer, victim, this.value, "claim");
		}
	}

	stateEvents(): GameEvent[] {
		return this.enabled && this.holderId
			? [{ type: "bounty", playerId: this.holderId, value: this.value }]
			: [];
	}

	private reward(
		match: Match,
		player: MatchPlayer,
		target: MatchPlayer,
		points: number,
		reason: "push" | "claim",
	): void {
		player.score += points;

		match.emit({
			type: "bountyReward",
			playerId: player.id,
			targetId: target.id,
			points,
			score: player.score,
			reason,
		});

		this.update(match);
	}
}
