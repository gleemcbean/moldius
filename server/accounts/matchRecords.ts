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
			won:
				results.teams.length > 0
					? results.winnerTeam !== null && results.winnerTeam === entry.team
					: results.winnerId === entry.playerId,
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
