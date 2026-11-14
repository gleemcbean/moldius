import {
	ALTAR_CURSE_MS,
	ALTAR_INTERACT_RANGE,
	POSSESSED_CALL_RANGE,
	POSSESSED_POWER_COOLDOWN_MS,
	possessedQuota,
	VOTE_DURATION_MS,
} from "../../../shared/config/index.js";
import { lineOfSight } from "../../../shared/physics/lineOfSight.js";
import type {
	GameEvent,
	PossessedOutcome,
	PowerRequest,
} from "../../../shared/protocol/game.js";
import { lureAnomalies } from "../ai/lure.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";

export class PossessedSystem {
	readonly possessedId: string;
	readonly quota: number;
	captures = 0;
	readonly votes = new Map<string, string>();
	voteEndsAt = 0;
	voting = false;
	readonly altarCurses = new Map<number, number>();

	constructor(match: Match) {
		const ids = [...match.players.keys()];
		this.possessedId = match.rng.fork("possessed").pick(ids);
		this.quota = possessedQuota(Math.max(1, ids.length - 1));
		const possessed = match.players.get(this.possessedId);
		if (possessed) {
			possessed.possessed = true;
		}
	}

	get quotaReached(): boolean {
		return this.captures >= this.quota;
	}

	sendRole(match: Match, player: MatchPlayer): void {
		match.sendTo(player.id, "game:role", {
			role: player.id === this.possessedId ? "possessed" : "hunter",
			quota: this.quota,
		});
	}

	altarCursed(altarId: number, now: number): boolean {
		return (this.altarCurses.get(altarId) ?? 0) > now;
	}

	onCapture(match: Match): void {
		this.captures += 1;
		match.emit({ type: "ritual", captures: this.captures, quota: this.quota });
		if (this.quotaReached) {
			this.startVote(match, "ritual");
		}
	}

	startVote(match: Match, reason: "ritual" | "timeout"): void {
		if (this.voting) {
			return;
		}
		this.voting = true;
		this.voteEndsAt = match.now + VOTE_DURATION_MS;
		match.enterVoting();
		match.emit({
			type: "vote",
			phase: "start",
			endsAt: this.voteEndsAt,
			reason,
		});
	}

	castVote(match: Match, voter: MatchPlayer, targetId: string): boolean {
		if (
			!this.voting ||
			!voter.connected ||
			targetId === voter.id ||
			!match.players.has(targetId)
		) {
			return false;
		}
		const first = !this.votes.has(voter.id);
		this.votes.set(voter.id, targetId);
		if (first) {
			match.emit({ type: "voteCast", voterId: voter.id });
		}
		return true;
	}

	voteFinished(match: Match): boolean {
		if (!this.voting) {
			return false;
		}
		const voters = [...match.players.values()].filter(
			(player) => player.connected,
		);
		return (
			match.now >= this.voteEndsAt ||
			(voters.length > 0 && voters.every((player) => this.votes.has(player.id)))
		);
	}

	outcome(): PossessedOutcome {
		const tally = new Map<string, number>();
		for (const target of this.votes.values()) {
			tally.set(target, (tally.get(target) ?? 0) + 1);
		}
		const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
		const unmasked =
			ranked.length > 0 &&
			ranked[0][0] === this.possessedId &&
			(ranked.length === 1 || ranked[1][1] < ranked[0][1]);
		return {
			possessedId: this.possessedId,
			winner: this.quotaReached && unmasked ? "hunters" : "possessed",
			quota: this.quota,
			captures: this.captures,
			quotaReached: this.quotaReached,
			unmasked,
			votes: Object.fromEntries(this.votes),
		};
	}

	castPower(match: Match, player: MatchPlayer, request: PowerRequest): boolean {
		if (
			player.id !== this.possessedId ||
			!player.active ||
			this.voting ||
			player.powerReadyAt > match.now
		) {
			return false;
		}
		const eye = player.eyePosition();
		const altar =
			request.altarId >= 0 ? match.layout.altars[request.altarId] : undefined;
		if (altar) {
			const distance = Math.hypot(
				altar.x - eye.x,
				altar.y + 0.8 - eye.y,
				altar.z - eye.z,
			);
			if (distance > ALTAR_INTERACT_RANGE + 0.5) {
				return false;
			}
			const until = match.now + ALTAR_CURSE_MS;
			this.altarCurses.set(altar.id, until);
			player.powerReadyAt = match.now + POSSESSED_POWER_COOLDOWN_MS;
			match.emit({ type: "altarCurse", altarId: altar.id, until });
			return true;
		}
		const point = { x: request.x, y: request.y, z: request.z };
		if (
			Math.hypot(point.x - eye.x, point.y - eye.y, point.z - eye.z) >
				POSSESSED_CALL_RANGE ||
			!lineOfSight(match.world, eye, point, {
				ignoreFurniture: true,
				blockGlass: true,
			})
		) {
			return false;
		}
		player.powerReadyAt = match.now + POSSESSED_POWER_COOLDOWN_MS;
		lureAnomalies(match, point, player.id);
		match.emit({ type: "darkCall", ...point });
		return true;
	}

	stateEvents(now: number): GameEvent[] {
		const events: GameEvent[] = [
			{ type: "ritual", captures: this.captures, quota: this.quota },
		];
		for (const [altarId, until] of this.altarCurses) {
			if (until > now) {
				events.push({ type: "altarCurse", altarId, until });
			}
		}
		if (this.voting) {
			events.push({
				type: "vote",
				phase: "start",
				endsAt: this.voteEndsAt,
				reason: this.quotaReached ? "ritual" : "timeout",
			});
			for (const voterId of this.votes.keys()) {
				events.push({ type: "voteCast", voterId });
			}
		}
		return events;
	}
}
