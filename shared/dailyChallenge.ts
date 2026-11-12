import { ENABLED_SPECIES_IDS } from "./config/monsters.js";
import type { SpeciesId } from "./config/species.js";
import { defaultPrivateConfig, type MatchConfig } from "./matchConfig.js";
import { hashString } from "./random.js";

export const DAILY_THEMES = [
	"siege",
	"labyrinth",
	"paranoia",
	"famine",
	"giants",
	"blitz",
	"swarm",
] as const;

export type DailyTheme = (typeof DAILY_THEMES)[number];

const THEME_RULES: Record<
	DailyTheme,
	Partial<Omit<MatchConfig, "species">> & { species?: SpeciesId[] }
> = {
	siege: {
		manorSize: "small",
		floors: 0,
		simultaneousAnomalies: 5,
		durationMinutes: 6,
	},
	labyrinth: {
		manorSize: "large",
		floors: 2,
		upperFloorSize: "medium",
		stairCount: 2,
		simultaneousAnomalies: 3,
		durationMinutes: 10,
	},
	paranoia: {
		manorSize: "medium",
		floors: 1,
		simultaneousAnomalies: 4,
		species: ["double", "murmure", "brume", "hurleur"],
	},
	famine: {
		manorSize: "medium",
		floors: 1,
		itemsPerPlayer: 3,
		simultaneousAnomalies: 3,
	},
	giants: {
		manorSize: "large",
		floors: 1,
		simultaneousAnomalies: 3,
		species: ["colosse", "gorgone", "fulgurant", "veilleur"],
	},
	blitz: {
		manorSize: "small",
		floors: 0,
		simultaneousAnomalies: 4,
		durationMinutes: 3,
		itemsPerPlayer: 12,
	},
	swarm: {
		manorSize: "medium",
		floors: 1,
		simultaneousAnomalies: 7,
		durationMinutes: 7,
		species: ["rat-roi", "luciole", "suinteur", "boursoufle", "murmure"],
	},
};

const DAY_MS = 86_400_000;

export function dailyDateKey(now: number): string {
	return new Date(now).toISOString().slice(0, 10);
}

export function msUntilNextDaily(now: number): number {
	return DAY_MS - (((now % DAY_MS) + DAY_MS) % DAY_MS);
}

export function formatDailyCountdown(ms: number): string {
	const seconds = Math.max(0, Math.ceil(ms / 1000));
	return [seconds / 3600, (seconds % 3600) / 60, seconds % 60]
		.map((part) => String(Math.floor(part)).padStart(2, "0"))
		.join(":");
}

export function isDailyDateKey(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		!Number.isNaN(Date.parse(`${value}T00:00:00Z`))
	);
}

export interface DailyChallenge {
	date: string;
	theme: DailyTheme;
	seed: number;
	config: MatchConfig;
}

export function dailyChallenge(date: string): DailyChallenge {
	const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
	const theme = DAILY_THEMES[(day * 3) % DAILY_THEMES.length];
	const { species, ...rules } = THEME_RULES[theme];
	const config: MatchConfig = {
		...defaultPrivateConfig(),
		teamCount: 0,
		...rules,
	};
	if (species) {
		config.species = ENABLED_SPECIES_IDS.filter((id) => species.includes(id));
	}
	return {
		date,
		theme,
		seed: hashString(`moldius-daily:${date}`) >>> 0,
		config,
	};
}
