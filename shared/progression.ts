/** L'expérience : chaque partie en rapporte, selon le score, et fait monter de niveau. */
export const MATCH_XP_BASE = 40;
export const MATCH_XP_WIN_BONUS = 60;
export const MATCH_XP_SCORE_DIVISOR = 10;
export const MATCH_XP_MAX = 600;

/** Les niveaux qui débloquent une récompense. */
export const LEVEL_MILESTONES = [5, 10, 15, 20, 30, 40, 50, 75, 100] as const;

/** Ce que rapporte une partie, poste par poste, avant le plafond. */
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

/** L'expérience à gagner pour passer du niveau donné au suivant. */
export function xpForNextLevel(level: number): number {
	return 100 + 25 * (Math.max(1, level) - 1);
}

/** L'expérience totale qu'il faut avoir pour atteindre ce niveau. */
export function xpForLevel(level: number): number {
	const steps = Math.max(0, Math.floor(level) - 1);
	return 100 * steps + (25 * steps * (steps - 1)) / 2;
}

export interface LevelProgress {
	level: number;
	/** L'expérience déjà gagnée dans ce niveau. */
	into: number;
	/** L'expérience qu'il faut pour passer au suivant. */
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
