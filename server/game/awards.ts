import {
	AWARD_FALLBACK,
	type AwardId,
	type MatchAward,
} from "../../shared/awards.js";
import type { MatchMetrics } from "../../shared/challenges.js";
import {
	SERVER_TICK_MS,
	VOICE_AUDIBLE_LEVEL,
} from "../../shared/config/index.js";
import type { GameEvent } from "../../shared/protocol/game.js";
import type { MatchPlayer } from "./MatchPlayer.js";

export interface PlayerStats {
	screamMs: number;
	longestHideMs: number;
	hideRunMs: number;
	fallDamage: number;
	pushes: number;
	doors: number;
	fragments: number;
	sprintMeters: number;
	chasedMs: number;
	radioMs: number;
	lanternMs: number;
	abandons: number;
	pacts: number;
	captures: number;
	deaths: number;
	jumps: number;
	hideMs: number;
	crafts: number;
	stakes: number;
}

function emptyStats(): PlayerStats {
	return {
		screamMs: 0,
		longestHideMs: 0,
		hideRunMs: 0,
		fallDamage: 0,
		pushes: 0,
		doors: 0,
		fragments: 0,
		sprintMeters: 0,
		chasedMs: 0,
		radioMs: 0,
		lanternMs: 0,
		abandons: 0,
		pacts: 0,
		captures: 0,
		deaths: 0,
		jumps: 0,
		hideMs: 0,
		crafts: 0,
		stakes: 0,
	};
}

const SCREAM_LEVEL = 0.55;
const ABANDON_RANGE = 12;

/** Par ordre d'intérêt : un joueur repart avec le titre le plus drôle qu'il mérite. */
const AWARD_RULES: readonly {
	id: AwardId;
	metric: (stats: PlayerStats) => number;
	minimum: number;
}[] = [
	{ id: "abandoner", metric: (s) => s.abandons, minimum: 1 },
	{ id: "hider", metric: (s) => s.longestHideMs, minimum: 45_000 },
	{ id: "screamer", metric: (s) => s.screamMs, minimum: 4_000 },
	{ id: "gravity", metric: (s) => s.fallDamage, minimum: 25 },
	{ id: "traitor", metric: (s) => s.pushes, minimum: 3 },
	{ id: "gambler", metric: (s) => s.pacts, minimum: 1 },
	{ id: "radioHost", metric: (s) => s.radioMs, minimum: 20_000 },
	{ id: "prey", metric: (s) => s.chasedMs, minimum: 30_000 },
	{ id: "hunter", metric: (s) => s.captures, minimum: 2 },
	{ id: "martyr", metric: (s) => s.deaths, minimum: 3 },
	{ id: "doorman", metric: (s) => s.doors, minimum: 15 },
	{ id: "bunny", metric: (s) => s.jumps, minimum: 40 },
	{ id: "marathon", metric: (s) => s.sprintMeters, minimum: 250 },
	{ id: "collector", metric: (s) => s.fragments, minimum: 10 },
	{ id: "lighthouse", metric: (s) => s.lanternMs, minimum: 120_000 },
];

/** Ce qui se mesure pendant la partie ; le reste s'ajoute à la fin. */
export function liveChallengeMetrics(stats: PlayerStats): MatchMetrics {
	return {
		captures: stats.captures,
		fragments: stats.fragments,
		crafts: stats.crafts,
		doors: stats.doors,
		sprintMeters: Math.floor(stats.sprintMeters),
		hideSeconds: Math.floor(stats.hideMs / 1000),
		longestHideSeconds: Math.floor(stats.longestHideMs / 1000),
		chasedSeconds: Math.floor(stats.chasedMs / 1000),
		radioSeconds: Math.floor(stats.radioMs / 1000),
		jumps: stats.jumps,
		pushes: stats.pushes,
		stakes: stats.stakes,
	};
}

export function pickAwards(
	stats: ReadonlyMap<string, PlayerStats>,
): MatchAward[] {
	const awards: MatchAward[] = [];
	const served = new Set<string>();
	for (const rule of AWARD_RULES) {
		let best: { playerId: string; value: number } | null = null;
		for (const [playerId, entry] of stats) {
			const value = rule.metric(entry);
			if (
				!served.has(playerId) &&
				value >= rule.minimum &&
				(!best || value > best.value)
			) {
				best = { playerId, value };
			}
		}
		if (best) {
			served.add(best.playerId);
			awards.push({ playerId: best.playerId, id: rule.id, value: best.value });
		}
	}
	for (const playerId of stats.keys()) {
		if (!served.has(playerId)) {
			awards.push({ playerId, id: AWARD_FALLBACK, value: 0 });
		}
	}
	return awards;
}

export class AwardTracker {
	readonly stats = new Map<string, PlayerStats>();

	private of(playerId: string): PlayerStats {
		let entry = this.stats.get(playerId);
		if (!entry) {
			entry = emptyStats();
			this.stats.set(playerId, entry);
		}
		return entry;
	}

	addPlayer(playerId: string): void {
		this.of(playerId);
	}

	tick(player: MatchPlayer, now: number, chased: boolean): void {
		const stats = this.of(player.id);
		stats.jumps = Math.max(stats.jumps, player.jumpsSeen);
		if (!player.alive) {
			stats.hideRunMs = 0;
			return;
		}
		const dt = SERVER_TICK_MS;
		if (player.hidden) {
			stats.hideRunMs += dt;
			stats.hideMs += dt;
			stats.longestHideMs = Math.max(stats.longestHideMs, stats.hideRunMs);
		} else {
			stats.hideRunMs = 0;
		}
		const level = player.voiceLevelNow(now);
		if (level >= SCREAM_LEVEL) {
			stats.screamMs += dt;
		}
		if (player.radioOn && level >= VOICE_AUDIBLE_LEVEL) {
			stats.radioMs += dt;
		}
		if (player.lanternOpen) {
			stats.lanternMs += dt;
		}
		if (chased) {
			stats.chasedMs += dt;
		}
		if (player.sprintIntent && player.moveInput && !player.sprintLocked) {
			stats.sprintMeters +=
				(Math.hypot(player.velocity.x, player.velocity.z) * dt) / 1000;
		}
	}

	event(event: GameEvent, players: ReadonlyMap<string, MatchPlayer>): void {
		switch (event.type) {
			case "push":
				this.of(event.fromId).pushes += 1;
				break;
			case "door":
				if (event.by && players.has(event.by)) {
					this.of(event.by).doors += 1;
				}
				break;
			case "pickup":
				if (event.playerId) {
					this.of(event.playerId).fragments += 1;
				}
				break;
			case "capture":
				this.of(event.playerId).captures += 1;
				break;
			case "damage":
				if (event.source === "fall") {
					this.of(event.playerId).fallDamage += event.amount;
				}
				break;
			case "stake":
				if (event.playerId) {
					this.of(event.playerId).stakes += 1;
					if (event.stake === "pact") {
						this.of(event.playerId).pacts += 1;
					}
				}
				break;
			case "craft":
				this.of(event.playerId).crafts += 1;
				break;
			case "death": {
				this.of(event.playerId).deaths += 1;
				if (event.cause === "fall" || event.cause === "pact") {
					break;
				}
				const victim = players.get(event.playerId);
				for (const other of players.values()) {
					if (
						victim &&
						other !== victim &&
						other.alive &&
						Math.hypot(
							other.position.x - victim.position.x,
							other.position.y - victim.position.y,
							other.position.z - victim.position.z,
						) < ABANDON_RANGE
					) {
						this.of(other.id).abandons += 1;
					}
				}
				break;
			}
			default:
				break;
		}
	}
}
