export const AWARD_IDS = [
	"abandoner",
	"hider",
	"screamer",
	"gravity",
	"traitor",
	"gambler",
	"radioHost",
	"prey",
	"hunter",
	"martyr",
	"doorman",
	"bunny",
	"marathon",
	"collector",
	"lighthouse",
	"tourist",
] as const;

export type AwardId = (typeof AWARD_IDS)[number];

/** Le titre de consolation : il ne compte pas pour débloquer des récompenses. */
export const AWARD_FALLBACK: AwardId = "tourist";

export interface MatchAward {
	playerId: string;
	id: AwardId;
	value: number;
}
