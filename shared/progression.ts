export const MATCH_XP_BASE = 40;
export const MATCH_XP_WIN_BONUS = 60;
export const MATCH_XP_SCORE_DIVISOR = 10;
export const MATCH_XP_MAX = 600;

export const LEVEL_MILESTONES = [5, 10, 15, 20, 30, 40, 50, 75, 100] as const;

export function matchXpParts(result: { score: number; won: boolean }): {
	base: number;
	score: number;
	win: number;
} {
	return {
		base: MATCH_XP_BASE,
		score: Math.floor(Math.max(0, result.score) / MATCH_XP_SCORE_DIVISOR),
		win: result.won ? MATCH_XP_WIN_BONUS : 0,
	};
}

export function matchXp(result: { score: number; won: boolean }): number {
	const parts = matchXpParts(result);
	return Math.min(MATCH_XP_MAX, parts.base + parts.score + parts.win);
}

export function xpForNextLevel(level: number): number {
	return 100 + 25 * (Math.max(1, level) - 1);
}

export function xpForLevel(level: number): number {
	const steps = Math.max(0, Math.floor(level) - 1);
	return 100 * steps + (25 * steps * (steps - 1)) / 2;
}

export interface LevelProgress {
	level: number;
	into: number;
	needed: number;
}

export function levelProgress(xp: number): LevelProgress {
	const total = Math.max(0, Math.floor(xp));
	let level = 1;
	while (xpForLevel(level + 1) <= total) {
		level += 1;
	}
	return {
		level,
		into: total - xpForLevel(level),
		needed: xpForNextLevel(level),
	};
}

export function levelOf(xp: number): number {
	return levelProgress(xp).level;
}
