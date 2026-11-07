import { AWARD_FALLBACK } from "../../shared/awards.js";
import { entryWon } from "../../shared/challenges.js";
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
): MatchRecord[] {
	const records: MatchRecord[] = [];
	for (const entry of results.entries) {
		const accountId = accounts.get(entry.playerId);
		if (!accountId) {
			continue;
		}
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
			won: entryWon(results, entry),
			awarded: results.awards.some(
				(award) =>
					award.playerId === entry.playerId && award.id !== AWARD_FALLBACK,
			),
			dailyDate: results.daily,
			pattern: entry.pattern,
			metrics: results.metrics[entry.playerId],
		});
	}
	return records;
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
