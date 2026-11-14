export const GHOST_SPEED = 4.2;
export const GHOST_FAST_SPEED = 7.5;
export const GHOST_VERTICAL_SPEED = 3.4;
export const GHOST_BOUNDS_MARGIN = 5;
export const GHOST_FLOOR_MARGIN = 1.5;
export const GHOST_CEILING_MARGIN = 3;
export const GHOST_MOVEMENT_BUDGET_CAP = 4;
export const GHOST_DOOR_RANGE = 3.4;
export const GHOST_DOOR_COOLDOWN_MS = 8_000;
export const GHOST_KNOCK_COOLDOWN_MS = 12_000;
export const GHOST_KNOCK_LOUDNESS = 7;
export const GHOST_KNOCK_LIGHT_RANGE = 9;

export const PING_KINDS = [
	"here",
	"danger",
	"monster",
	"altar",
	"material",
	"hide",
	"regroup",
] as const;

export type PingKind = (typeof PING_KINDS)[number];

export const PING_WHEEL: readonly PingKind[] = [
	"here",
	"danger",
	"regroup",
	"monster",
	"material",
	"altar",
	"hide",
];

export const PING_LIFETIME_MS = 9_000;
export const PING_MAX_DISTANCE = 70;
export const PING_COOLDOWN_MS = 900;
export const PING_BURST = 3;
export const PING_BURST_WINDOW_MS = 6_000;
export const PING_HOLD_MS = 220;

export const PING_COLORS: Record<PingKind, number> = {
	here: 0xdce54d,
	danger: 0xe5533d,
	monster: 0xff7a3d,
	altar: 0x2ee6d6,
	material: 0xffc857,
	hide: 0x9fb2ff,
	regroup: 0x8fd36a,
};

export const EMOTE_IDS = [
	"wave",
	"dance",
	"bow",
	"point",
	"laugh",
	"panic",
] as const;

export type EmoteId = (typeof EMOTE_IDS)[number];

export const EMOTE_DURATION_MS: Record<EmoteId, number> = {
	wave: 2_400,
	dance: 6_000,
	bow: 2_200,
	point: 2_600,
	laugh: 3_000,
	panic: 3_600,
};

export const EMOTE_COOLDOWN_MS = 1_200;

export const GIFT_RANGE = 3;
export const GIFT_COOLDOWN_MS = 300;

export const BOUNTY_MIN_LEAD = 150;
export const BOUNTY_BASE = 100;
export const BOUNTY_LEAD_SHARE = 0.2;
export const BOUNTY_MAX = 400;
export const BOUNTY_PUSH_POINTS = 25;
export const BOUNTY_PUSH_COOLDOWN_MS = 15_000;
export const BOUNTY_CLAIM_WINDOW_MS = 10_000;
export const BOUNTY_SENSE_FACTOR = 1.25;

export function bountyValue(lead: number): number {
	return Math.min(
		BOUNTY_MAX,
		BOUNTY_BASE + Math.round((lead * BOUNTY_LEAD_SHARE) / 10) * 10,
	);
}

export const MANOR_EVENT_KINDS = [
	"bloodMoon",
	"lockdown",
	"fragmentRain",
	"thickFog",
	"frenzy",
	"greenTide",
] as const;

export type ManorEventKind = (typeof MANOR_EVENT_KINDS)[number];

export const MANOR_EVENT_DURATION_MS: Record<ManorEventKind, number> = {
	bloodMoon: 60_000,
	lockdown: 20_000,
	fragmentRain: 6_000,
	thickFog: 50_000,
	frenzy: 35_000,
	greenTide: 15_000,
};

export const MANOR_EVENT_WARNING_MS = 8_000;
export const MANOR_EVENT_FIRST_MS = 150_000;
export const MANOR_EVENT_GAP_MS = 150_000;
export const MANOR_EVENT_GAP_JITTER_MS = 60_000;
export const MANOR_EVENT_END_MARGIN_MS = 45_000;
export const BLOOD_MOON_POINTS_FACTOR = 2;
export const FRENZY_SPEED_FACTOR = 1.3;
export const FOG_VISION_FACTOR = 0.6;

export const MUTATOR_IDS = [
	"oneLife",
	"noMap",
	"darkness",
	"strongPush",
	"chaosBrews",
	"megaphone",
	"infiniteEnergy",
] as const;

export type MutatorId = (typeof MUTATOR_IDS)[number];

export const STRONG_PUSH_DISTANCE_FACTOR = 2.5;
export const STRONG_PUSH_COOLDOWN_FACTOR = 0.5;
export const STRONG_PUSH_ENERGY_FACTOR = 0.5;
export const CHAOS_BREW_INTERVAL_MS = 45_000;

export const POSSESSED_MIN_PLAYERS = 3;
export const POSSESSED_POWER_COOLDOWN_MS = 40_000;
export const POSSESSED_CALL_RANGE = 30;
export const ALTAR_CURSE_MS = 50_000;
export const VOTE_DURATION_MS = 45_000;
export const ROLE_REVEAL_MS = 8_000;

export function possessedQuota(hunters: number): number {
	return Math.max(3, Math.round(hunters * 1.5));
}
