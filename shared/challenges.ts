import type { MatchResultEntry, MatchResults } from "./protocol/game.js";

export const CHALLENGE_METRICS = [
	"games",
	"wins",
	"flawless",
	"flawlessWins",
	"dailies",
	"captures",
	"fragments",
	"crafts",
	"doors",
	"sprintMeters",
	"hideSeconds",
	"longestHideSeconds",
	"chasedSeconds",
	"radioSeconds",
	"jumps",
	"pushes",
	"stakes",
] as const;

export type ChallengeMetric = (typeof CHALLENGE_METRICS)[number];

export type MatchMetrics = Partial<Record<ChallengeMetric, number>>;

/** Par mesure : le cumul de toutes les parties et le record sur une seule. */
export type ChallengeProgress = Partial<
	Record<ChallengeMetric, { total: number; best: number }>
>;

export const METRIC_UNITS: Partial<
	Record<ChallengeMetric, "meters" | "seconds">
> = {
	sprintMeters: "meters",
	hideSeconds: "seconds",
	longestHideSeconds: "seconds",
	chasedSeconds: "seconds",
	radioSeconds: "seconds",
};

/** Un classique se réussit une fois, en une seule partie. */
export const CLASSIC_CHALLENGES = [
	{ id: "firstCapture", metric: "captures", target: 1 },
	{ id: "hatTrick", metric: "captures", target: 3 },
	{ id: "firstWin", metric: "wins", target: 1 },
	{ id: "survivor", metric: "flawless", target: 1 },
	{ id: "untouchable", metric: "flawlessWins", target: 1 },
	{ id: "hermit", metric: "longestHideSeconds", target: 60 },
	{ id: "sprinter", metric: "sprintMeters", target: 500 },
	{ id: "gatherer", metric: "fragments", target: 20 },
	{ id: "artisan", metric: "crafts", target: 3 },
	{ id: "daredevil", metric: "stakes", target: 1 },
	{ id: "prey", metric: "chasedSeconds", target: 45 },
	{ id: "operator", metric: "radioSeconds", target: 60 },
	{ id: "doorman", metric: "doors", target: 30 },
	{ id: "bunny", metric: "jumps", target: 50 },
	{ id: "saboteur", metric: "pushes", target: 5 },
] as const satisfies readonly {
	id: string;
	metric: ChallengeMetric;
	target: number;
}[];

/** Un incrémental s'accumule de partie en partie, palier après palier. */
export const INCREMENTAL_CHALLENGES = [
	{ id: "veteran", metric: "games", tiers: [5, 25, 100] },
	{ id: "champion", metric: "wins", tiers: [3, 15, 50] },
	{ id: "hunter", metric: "captures", tiers: [10, 50, 200] },
	{ id: "forager", metric: "fragments", tiers: [50, 250, 1000] },
	{ id: "crafter", metric: "crafts", tiers: [10, 50, 200] },
	{ id: "runner", metric: "sprintMeters", tiers: [2000, 10000, 50000] },
	{ id: "ghost", metric: "hideSeconds", tiers: [300, 1800, 7200] },
	{ id: "gambler", metric: "stakes", tiers: [5, 25, 100] },
	{ id: "regular", metric: "dailies", tiers: [1, 7, 30] },
] as const satisfies readonly {
	id: string;
	metric: ChallengeMetric;
	tiers: readonly number[];
}[];

export type ClassicChallenge = (typeof CLASSIC_CHALLENGES)[number];
export type IncrementalChallenge = (typeof INCREMENTAL_CHALLENGES)[number];
export type ChallengeId = ClassicChallenge["id"] | IncrementalChallenge["id"];

export const CHALLENGE_STEP_COUNT =
	CLASSIC_CHALLENGES.length +
	INCREMENTAL_CHALLENGES.reduce(
		(sum, challenge) => sum + challenge.tiers.length,
		0,
	);

export function sanitizeChallengeProgress(raw: unknown): ChallengeProgress {
	let value = raw;
	if (typeof value === "string") {
		try {
			value = JSON.parse(value);
		} catch {
			return {};
		}
	}
	if (typeof value !== "object" || value === null) {
		return {};
	}
	const clean = (input: unknown) =>
		typeof input === "number" && Number.isFinite(input) && input > 0
			? input
			: 0;
	const progress: ChallengeProgress = {};
	for (const metric of CHALLENGE_METRICS) {
		const entry = (value as Record<string, unknown>)[metric] as
			| { total?: unknown; best?: unknown }
			| undefined;
		if (entry && typeof entry === "object") {
			progress[metric] = { total: clean(entry.total), best: clean(entry.best) };
		}
	}
	return progress;
}

export function withMatchMetrics(
	progress: ChallengeProgress,
	metrics: MatchMetrics,
): ChallengeProgress {
	const merged: ChallengeProgress = { ...progress };
	for (const metric of CHALLENGE_METRICS) {
		const value = metrics[metric] ?? 0;
		if (value > 0) {
			const entry = progress[metric] ?? { total: 0, best: 0 };
			merged[metric] = {
				total: entry.total + value,
				best: Math.max(entry.best, value),
			};
		}
	}
	return merged;
}

export function classicStatus(
	challenge: ClassicChallenge,
	progress: ChallengeProgress,
): { value: number; target: number; done: boolean } {
	const best = progress[challenge.metric]?.best ?? 0;
	return {
		value: Math.min(best, challenge.target),
		target: challenge.target,
		done: best >= challenge.target,
	};
}

export function incrementalStatus(
	challenge: IncrementalChallenge,
	progress: ChallengeProgress,
): { value: number; target: number; tier: number; done: boolean } {
	const total = progress[challenge.metric]?.total ?? 0;
	const tiers: readonly number[] = challenge.tiers;
	const tier = tiers.filter((amount) => total >= amount).length;
	const done = tier === tiers.length;
	const target = tiers[done ? tiers.length - 1 : tier];
	return { value: Math.min(total, target), target, tier, done };
}

export function completedStepCount(progress: ChallengeProgress): number {
	return (
		CLASSIC_CHALLENGES.filter(
			(challenge) => classicStatus(challenge, progress).done,
		).length +
		INCREMENTAL_CHALLENGES.reduce(
			(sum, challenge) => sum + incrementalStatus(challenge, progress).tier,
			0,
		)
	);
}

export interface CompletedChallenge {
	id: ChallengeId;
	/** Le palier atteint, à partir de 1 ; null pour un défi classique. */
	tier: number | null;
}

export function newlyCompleted(
	before: ChallengeProgress,
	after: ChallengeProgress,
): CompletedChallenge[] {
	const completed: CompletedChallenge[] = [];
	for (const challenge of CLASSIC_CHALLENGES) {
		if (
			classicStatus(challenge, after).done &&
			!classicStatus(challenge, before).done
		) {
			completed.push({ id: challenge.id, tier: null });
		}
	}
	for (const challenge of INCREMENTAL_CHALLENGES) {
		const from = incrementalStatus(challenge, before).tier;
		const to = incrementalStatus(challenge, after).tier;
		for (let tier = from + 1; tier <= to; tier += 1) {
			completed.push({ id: challenge.id, tier });
		}
	}
	return completed;
}

export function entryWon(
	results: Pick<MatchResults, "teams" | "winnerTeam" | "winnerId">,
	entry: Pick<MatchResultEntry, "playerId" | "team">,
): boolean {
	return results.teams.length > 0
		? results.winnerTeam !== null && results.winnerTeam === entry.team
		: results.winnerId === entry.playerId;
}
