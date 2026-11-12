import { AWARD_FALLBACK } from "../../shared/awards.js";
import { entryWon } from "../../shared/challenges.js";
import { DEFAULT_HAT_PATTERN } from "../../shared/hatPatterns.js";
import type { MatchConfig } from "../../shared/matchConfig.js";
import { matchXp } from "../../shared/progression.js";
import type {
	MatchDetailData,
	MatchDetailRules,
} from "../../shared/protocol/account.js";
import type {
	MatchResultEntry,
	MatchResults,
} from "../../shared/protocol/game.js";
import type { MatchRecord } from "./AccountStore.js";

export function buildMatchRecords(
	results: MatchResults,
	visibility: "public" | "private",
	accounts: Map<string, string | null>,
	playedAt: Date,
	config: MatchConfig | null = null,
): MatchRecord[] {
	const records: MatchRecord[] = [];
	const rules = config ? detailRules(config) : null;
	for (const entry of results.entries) {
		const accountId = accounts.get(entry.playerId);
		if (!accountId) {
			continue;
		}
		const won = entryWon(results, entry);
		records.push({
			accountId,
			matchId: results.matchId,
			playedAt,
			durationMs: results.durationMs,
			visibility,
			playerName: entry.name,
			color: entry.color,
			rank: rankOf(results, entry),
			playerCount: results.entries.length,
			score: entry.score,
			captures: entry.captures,
			deaths: entry.deaths,
			won,
			xp: matchXp({ score: entry.score, won }),
			awarded: results.awards.some(
				(award) =>
					award.playerId === entry.playerId && award.id !== AWARD_FALLBACK,
			),
			dailyDate: results.daily,
			pattern: entry.pattern,
			metrics: results.metrics[entry.playerId],
			teamCount: results.teams.length,
			details: matchDetails(results, entry.playerId, rules, accounts),
		});
	}
	return records;
}

function detailRules(config: MatchConfig): MatchDetailRules {
	return {
		manorSize: config.manorSize,
		floors: config.floors,
		anomalies: config.simultaneousAnomalies,
		durationMinutes: config.durationMinutes,
		teamCount: config.teamCount,
		walkies: config.walkies,
	};
}

function matchDetails(
	results: MatchResults,
	selfId: string,
	rules: MatchDetailRules | null,
	accounts: Map<string, string | null>,
): MatchDetailData {
	return {
		players: results.entries.map((entry) => ({
			profileId: accounts.get(entry.playerId) ?? null,
			name: entry.name,
			color: entry.color,
			pattern: entry.pattern ?? DEFAULT_HAT_PATTERN,
			tagline: entry.tagline ?? null,
			team: entry.team,
			score: entry.score,
			captures: entry.captures,
			deaths: entry.deaths,
			self: entry.playerId === selfId,
			awards: results.awards
				.filter((award) => award.playerId === entry.playerId)
				.map((award) => ({ id: award.id, value: Math.round(award.value) })),
		})),
		teams: results.teams.map(({ team, score, captures, deaths }) => ({
			team,
			score,
			captures,
			deaths,
		})),
		winnerTeam: results.winnerTeam,
		rules,
		metrics: results.metrics[selfId] ?? {},
	};
}

function rankOf(results: MatchResults, entry: MatchResultEntry): number {
	if (results.teams.length > 0) {
		const team = results.teams.find((standing) => standing.team === entry.team);
		return (
			1 +
			results.teams.filter((other) => other.score > (team?.score ?? 0)).length
		);
	}
	return (
		1 + results.entries.filter((other) => other.score > entry.score).length
	);
}
