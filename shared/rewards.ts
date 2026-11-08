import {
	type ChallengeId,
	type ChallengeProgress,
	CLASSIC_CHALLENGES,
	classicStatus,
	INCREMENTAL_CHALLENGES,
} from "./challenges.js";
import type { HatPattern } from "./hatPatterns.js";
import { levelOf } from "./progression.js";

export const LANTERN_TINTS = [
	"amber",
	"emerald",
	"violet",
	"crimson",
	"ice",
	"gold",
	"specter",
	"toxic",
	"rose",
	"abyss",
	"aurora",
] as const;

export type LanternTint = (typeof LANTERN_TINTS)[number];

export const DEFAULT_LANTERN_TINT: LanternTint = "amber";

export const LANTERN_TINT_COLORS: Record<LanternTint, number> = {
	amber: 0xffb468,
	emerald: 0x6dff9a,
	violet: 0xbb8cff,
	crimson: 0xff6a5a,
	ice: 0x9ad8ff,
	gold: 0xffd84a,
	specter: 0xe6e0ff,
	toxic: 0xc8f03a,
	rose: 0xff8cc8,
	abyss: 0x6a7cff,
	aurora: 0x5affd8,
};

export function isLanternTint(value: unknown): value is LanternTint {
	return (
		typeof value === "string" &&
		(LANTERN_TINTS as readonly string[]).includes(value)
	);
}

/** Une petite phrase affichée sous le pseudonyme : facultative, gagnée par les défis. */
export const TAGLINES = [
	"smile",
	"cat",
	"xd",
	"immortal",
	"unbeatable",
	"ghost",
	"daredevil",
	"chatterbox",
	"tireless",
	"bigGame",
	"veteran",
	"faithful",
	"sprout",
	"seasoned",
	"elder",
	"legend",
] as const;

export type Tagline = (typeof TAGLINES)[number];

export function isTagline(value: unknown): value is Tagline {
	return (
		typeof value === "string" && (TAGLINES as readonly string[]).includes(value)
	);
}

export interface ProgressStats {
	gamesPlayed: number;
	wins: number;
	captures: number;
	dailies: number;
	awards: number;
	xp?: number;
	challenges?: ChallengeProgress;
}

/** Une récompense se gagne par un défi de la liste ou en atteignant un niveau. */
export interface Reward {
	kind: "hat" | "lantern" | "tagline";
	value: HatPattern | LanternTint | Tagline;
	/** null pour une récompense de niveau. */
	challenge: ChallengeId | null;
	/** Le palier à atteindre, à partir de 1 ; null pour un défi classique. */
	tier: number | null;
	/** Le niveau qui la débloque, pour les récompenses de niveau. */
	level?: number;
}

function levelReward(
	level: number,
	kind: Reward["kind"],
	value: Reward["value"],
): Reward {
	return { kind, value, challenge: null, tier: null, level };
}

/** Purement visuel : débloquer une récompense ne donne aucun avantage en jeu. */
export const REWARDS: readonly Reward[] = [
	{ kind: "hat", value: "web", challenge: "veteran", tier: 2 },
	{ kind: "hat", value: "flames", challenge: "champion", tier: 1 },
	{ kind: "hat", value: "skull", challenge: "hunter", tier: 1 },
	{ kind: "hat", value: "crown", challenge: "regular", tier: 2 },
	{ kind: "hat", value: "lightning", challenge: "sprinter", tier: null },
	{ kind: "hat", value: "eyes", challenge: "prey", tier: null },
	{ kind: "hat", value: "laurel", challenge: "untouchable", tier: null },
	{ kind: "lantern", value: "emerald", challenge: "veteran", tier: 1 },
	{ kind: "lantern", value: "ice", challenge: "champion", tier: 2 },
	{ kind: "lantern", value: "crimson", challenge: "hunter", tier: 2 },
	{ kind: "lantern", value: "violet", challenge: "gambler", tier: 1 },
	{ kind: "lantern", value: "toxic", challenge: "crafter", tier: 1 },
	{ kind: "lantern", value: "specter", challenge: "ghost", tier: 2 },
	{ kind: "lantern", value: "gold", challenge: "champion", tier: 3 },
	{ kind: "tagline", value: "smile", challenge: "firstCapture", tier: null },
	{ kind: "tagline", value: "cat", challenge: "bunny", tier: null },
	{ kind: "tagline", value: "xd", challenge: "saboteur", tier: null },
	{ kind: "tagline", value: "immortal", challenge: "survivor", tier: null },
	{ kind: "tagline", value: "ghost", challenge: "hermit", tier: null },
	{ kind: "tagline", value: "daredevil", challenge: "daredevil", tier: null },
	{ kind: "tagline", value: "chatterbox", challenge: "operator", tier: null },
	{ kind: "tagline", value: "unbeatable", challenge: "champion", tier: 2 },
	{ kind: "tagline", value: "tireless", challenge: "runner", tier: 2 },
	{ kind: "tagline", value: "bigGame", challenge: "hunter", tier: 3 },
	{ kind: "tagline", value: "veteran", challenge: "veteran", tier: 3 },
	{ kind: "tagline", value: "faithful", challenge: "regular", tier: 3 },
	levelReward(5, "tagline", "sprout"),
	levelReward(10, "lantern", "rose"),
	levelReward(15, "hat", "hearts"),
	levelReward(20, "tagline", "seasoned"),
	levelReward(30, "lantern", "abyss"),
	levelReward(40, "tagline", "elder"),
	levelReward(50, "hat", "mycelium"),
	levelReward(75, "tagline", "legend"),
	levelReward(100, "lantern", "aurora"),
];

/** Les récompenses de niveau, de la plus proche à la plus lointaine. */
export function levelRewards(): Reward[] {
	return REWARDS.filter((reward) => reward.level !== undefined).sort(
		(a, b) => (a.level ?? 0) - (b.level ?? 0),
	);
}

export function accountProgress(account: {
	stats: Omit<ProgressStats, "challenges">;
	challenges?: ChallengeProgress;
}): ProgressStats {
	return { ...account.stats, challenges: account.challenges ?? {} };
}

export function rewardProgress(
	reward: Reward,
	stats: ProgressStats | null,
): { value: number; target: number } {
	if (reward.level !== undefined) {
		return {
			value: Math.min(levelOf(stats?.xp ?? 0), reward.level),
			target: reward.level,
		};
	}
	const progress = stats?.challenges ?? {};
	const classic = CLASSIC_CHALLENGES.find(({ id }) => id === reward.challenge);
	if (classic) {
		const { value, target } = classicStatus(classic, progress);
		return { value, target };
	}
	const incremental = INCREMENTAL_CHALLENGES.find(
		({ id }) => id === reward.challenge,
	);
	if (!incremental || reward.tier === null) {
		return { value: 0, target: 1 };
	}
	const target = (incremental.tiers as readonly number[])[reward.tier - 1];
	return {
		value: Math.min(progress[incremental.metric]?.total ?? 0, target),
		target,
	};
}

export function rewardUnlocked(
	reward: Reward,
	stats: ProgressStats | null,
): boolean {
	if (stats === null) {
		return false;
	}
	const { value, target } = rewardProgress(reward, stats);
	return value >= target;
}

export function rewardsForChallenge(id: ChallengeId): Reward[] {
	return REWARDS.filter((reward) => reward.challenge === id).sort(
		(a, b) => (a.tier ?? 0) - (b.tier ?? 0),
	);
}

function cosmeticUnlocked(
	kind: Reward["kind"],
	value: string,
	stats: ProgressStats | null,
): boolean {
	const reward = REWARDS.find(
		(entry) => entry.kind === kind && entry.value === value,
	);
	return reward === undefined || rewardUnlocked(reward, stats);
}

export function hatUnlocked(
	pattern: HatPattern,
	stats: ProgressStats | null,
): boolean {
	return cosmeticUnlocked("hat", pattern, stats);
}

export function lanternUnlocked(
	tint: LanternTint,
	stats: ProgressStats | null,
): boolean {
	return cosmeticUnlocked("lantern", tint, stats);
}

/** Sans titre, rien à débloquer ; un titre inconnu ou verrouillé est refusé. */
export function taglineUnlocked(
	tagline: Tagline | null,
	stats: ProgressStats | null,
): boolean {
	return tagline === null || cosmeticUnlocked("tagline", tagline, stats);
}

/** Ce que le serveur accepte d'un client : un titre débloqué, sinon aucun. */
export function allowedTagline(
	value: unknown,
	stats: ProgressStats | null,
): Tagline | null {
	return isTagline(value) && taglineUnlocked(value, stats) ? value : null;
}

export function rewardFor(
	kind: Reward["kind"],
	value: string,
): Reward | undefined {
	return REWARDS.find((entry) => entry.kind === kind && entry.value === value);
}

export function newlyUnlocked(
	before: ProgressStats | null,
	after: ProgressStats | null,
): Reward[] {
	return REWARDS.filter(
		(reward) =>
			rewardUnlocked(reward, after) && !rewardUnlocked(reward, before),
	);
}
