import { AWARD_IDS, type AwardId } from "../../shared/awards.js";
import {
	CHALLENGE_METRICS,
	type MatchMetrics,
} from "../../shared/challenges.js";
import { DEFAULT_HAT_PATTERN, isHatPattern } from "../../shared/hatPatterns.js";
import { MANOR_SIZES, type ManorSize } from "../../shared/matchConfig.js";
import type {
	MatchDetailData,
	MatchDetailPlayer,
	MatchDetailRules,
	MatchDetailTeam,
} from "../../shared/protocol/account.js";
import { isTagline } from "../../shared/rewards.js";

type Loose = Record<string, unknown>;

function isRecord(value: unknown): value is Loose {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function count(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
		? value
		: 0;
}

function teamOf(value: unknown): number | null {
	return typeof value === "number" && Number.isInteger(value) && value >= 0
		? value
		: null;
}

function parsePlayer(raw: unknown): MatchDetailPlayer | null {
	if (!isRecord(raw) || typeof raw.name !== "string") {
		return null;
	}
	const awards = Array.isArray(raw.awards) ? raw.awards : [];
	return {
		profileId:
			typeof raw.profileId === "string" && /^[\w-]{1,64}$/.test(raw.profileId)
				? raw.profileId
				: null,
		name: raw.name.slice(0, 32),
		color: count(raw.color),
		pattern: isHatPattern(raw.pattern) ? raw.pattern : DEFAULT_HAT_PATTERN,
		tagline: isTagline(raw.tagline) ? raw.tagline : null,
		team: teamOf(raw.team),
		score: count(raw.score),
		captures: count(raw.captures),
		deaths: count(raw.deaths),
		self: raw.self === true,
		awards: awards.flatMap((award) =>
			isRecord(award) && (AWARD_IDS as readonly unknown[]).includes(award.id)
				? [{ id: award.id as AwardId, value: count(award.value) }]
				: [],
		),
	};
}

function parseTeam(raw: unknown): MatchDetailTeam | null {
	const team = isRecord(raw) ? teamOf(raw.team) : null;
	if (!isRecord(raw) || team === null) {
		return null;
	}
	return {
		team,
		score: count(raw.score),
		captures: count(raw.captures),
		deaths: count(raw.deaths),
	};
}

function parseRules(raw: unknown): MatchDetailRules | null {
	if (
		!isRecord(raw) ||
		!(MANOR_SIZES as readonly unknown[]).includes(raw.manorSize)
	) {
		return null;
	}
	return {
		manorSize: raw.manorSize as ManorSize,
		floors: count(raw.floors),
		anomalies: count(raw.anomalies),
		durationMinutes: count(raw.durationMinutes),
		teamCount: count(raw.teamCount),
		walkies: raw.walkies === true,
	};
}

function parseMetrics(raw: unknown): MatchMetrics {
	const metrics: MatchMetrics = {};
	if (isRecord(raw)) {
		for (const metric of CHALLENGE_METRICS) {
			const value = count(raw[metric]);
			if (value > 0) {
				metrics[metric] = value;
			}
		}
	}
	return metrics;
}

/** Relit le détail enregistré ; une ligne ancienne ou abîmée n'a simplement pas de détail. */
export function parseMatchDetails(raw: unknown): MatchDetailData | null {
	let value = raw;
	if (typeof value === "string") {
		try {
			value = JSON.parse(value);
		} catch {
			return null;
		}
	}
	if (!isRecord(value) || !Array.isArray(value.players)) {
		return null;
	}
	const players = value.players.flatMap((entry) => {
		const player = parsePlayer(entry);
		return player ? [player] : [];
	});
	if (players.length === 0) {
		return null;
	}
	return {
		players,
		teams: (Array.isArray(value.teams) ? value.teams : []).flatMap((entry) => {
			const team = parseTeam(entry);
			return team ? [team] : [];
		}),
		winnerTeam: teamOf(value.winnerTeam),
		rules: parseRules(value.rules),
		metrics: parseMetrics(value.metrics),
	};
}
