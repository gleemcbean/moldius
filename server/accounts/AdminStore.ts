import { isHatPattern } from "../../shared/hatPatterns.js";
import type {
	AdminLiveStats,
	AdminLogin,
	AdminOverview,
	AdminPlayer,
} from "../../shared/protocol/admin.js";
import {
	ADMIN_TIME_ZONE,
	ADMIN_WINDOW_DAYS,
	summarizeDays,
	summarizePresence,
} from "./adminStats.js";
import type { Database } from "./database.js";

const DAY_MS = 86_400_000;
const SAMPLE_RETENTION_MS = 365 * DAY_MS;
const PLAYER_LIMIT = 2000;

interface AccountRow {
	id: string;
	display_name: string;
	hat_color: number;
	hat_pattern: string;
	email_key: string | null;
	email_verified_at: Date | string | null;
	password_hash: string | null;
	discord_id: string | null;
	created_at: Date | string;
	last_login_at: Date | string | null;
	last_seen_at: Date | string | null;
	games_played: number;
	wins: number;
	best_score: number;
	total_score: number | string;
}

const iso = (value: Date | string | null): string | null =>
	value === null ? null : new Date(value).toISOString();

const within = (value: string | null, now: number, ms: number): boolean =>
	value !== null && now - new Date(value).getTime() <= ms;

function loginOf(row: AccountRow): AdminLogin {
	if (row.discord_id && row.password_hash) {
		return "both";
	}
	return row.discord_id ? "discord" : "email";
}

export class AdminStore {
	constructor(
		private readonly database: Database,
		private readonly now: () => number = Date.now,
	) {}

	async isAdmin(accountId: string, emails: string[]): Promise<boolean> {
		if (emails.length === 0) {
			return false;
		}
		const { rows } = await this.database.query<{
			email_key: string | null;
			email_verified_at: Date | string | null;
		}>("SELECT email_key, email_verified_at FROM accounts WHERE id = $1", [
			accountId,
		]);
		const row = rows[0];
		return Boolean(
			row?.email_key && row.email_verified_at && emails.includes(row.email_key),
		);
	}

	async samplePresence(live: AdminLiveStats): Promise<void> {
		const now = this.now();
		await this.database.query(
			`INSERT INTO presence_samples (sampled_at, connected, signed_in, in_match)
       VALUES ($1, $2, $3, $4)`,
			[new Date(now), live.connected, live.signedIn, live.inMatch],
		);
		await this.database.query(
			"DELETE FROM presence_samples WHERE sampled_at < $1",
			[new Date(now - SAMPLE_RETENTION_MS)],
		);
	}

	async overview(live: AdminLiveStats): Promise<AdminOverview> {
		const now = this.now();
		const since = new Date(now - ADMIN_WINDOW_DAYS * DAY_MS);
		const [accounts, history, recent, samples, friendships] = await Promise.all(
			[
				this.database.query<AccountRow>(
					`SELECT id, display_name, hat_color, hat_pattern, email_key, email_verified_at,
                  password_hash, discord_id, created_at, last_login_at, last_seen_at,
                  games_played, wins, best_score, total_score
           FROM accounts`,
				),
				this.database.query<{
					account_id: string;
					last_played: Date | string;
					playtime: number | string | null;
				}>(
					`SELECT account_id, MAX(played_at) AS last_played, SUM(duration_ms) AS playtime
           FROM match_history GROUP BY account_id`,
				),
				this.database.query<{
					match_id: string;
					played_at: Date | string;
					duration_ms: number | string;
					player_count: number | string;
				}>(
					"SELECT match_id, played_at, duration_ms, player_count FROM match_history",
				),
				this.database.query<{
					sampled_at: Date | string;
					connected: number | string;
				}>(
					"SELECT sampled_at, connected FROM presence_samples WHERE sampled_at >= $1",
					[since],
				),
				this.database.query<{ account_low: string; account_high: string }>(
					"SELECT account_low, account_high FROM friendships WHERE status = 'accepted'",
				),
			],
		);

		const historyOf = new Map(
			history.rows.map((row) => [row.account_id, row] as const),
		);
		const friendCount = new Map<string, number>();
		for (const row of friendships.rows) {
			for (const id of [row.account_low, row.account_high]) {
				friendCount.set(id, (friendCount.get(id) ?? 0) + 1);
			}
		}
		const online = new Set(live.onlineAccountIds);
		const players: AdminPlayer[] = accounts.rows.map((row) => {
			const played = historyOf.get(row.id);
			return {
				id: row.id,
				name: row.display_name,
				color: Number(row.hat_color),
				pattern: isHatPattern(row.hat_pattern) ? row.hat_pattern : "plain",
				login: loginOf(row),
				verified: row.email_verified_at !== null,
				online: online.has(row.id),
				createdAt: new Date(row.created_at).toISOString(),
				lastLoginAt: iso(row.last_login_at),
				lastSeenAt: iso(row.last_seen_at),
				lastMatchAt: played ? iso(played.last_played) : null,
				gamesPlayed: Number(row.games_played),
				wins: Number(row.wins),
				bestScore: Number(row.best_score),
				totalScore: Number(row.total_score),
				playtimeMs: Number(played?.playtime ?? 0),
				friends: friendCount.get(row.id) ?? 0,
			};
		});
		const lastActivity = (player: AdminPlayer) =>
			[player.lastSeenAt, player.lastLoginAt, player.lastMatchAt]
				.filter((value): value is string => value !== null)
				.sort()
				.at(-1) ?? null;
		players.sort((a, b) =>
			(lastActivity(b) ?? b.createdAt).localeCompare(
				lastActivity(a) ?? a.createdAt,
			),
		);

		const matches = new Map<
			string,
			{ at: Date; duration: number; players: number }
		>();
		for (const row of recent.rows) {
			if (!matches.has(row.match_id)) {
				matches.set(row.match_id, {
					at: new Date(row.played_at),
					duration: Number(row.duration_ms),
					players: Number(row.player_count),
				});
			}
		}
		const allMatches = [...matches.entries()];
		const recentMatches = allMatches.filter(
			([, match]) => match.at.getTime() >= since.getTime(),
		);
		const average = (values: number[]) =>
			values.length > 0
				? values.reduce((sum, value) => sum + value, 0) / values.length
				: null;

		return {
			generatedAt: new Date(now).toISOString(),
			timeZone: ADMIN_TIME_ZONE,
			live: {
				connected: live.connected,
				signedIn: live.signedIn,
				inLobby: live.inLobby,
				inMatch: live.inMatch,
				lobbies: live.lobbies,
				matches: live.matches,
			},
			totals: {
				accounts: players.length,
				verified: players.filter((player) => player.verified).length,
				discord: players.filter((player) => player.login !== "email").length,
				new24h: players.filter((p) => within(p.createdAt, now, DAY_MS)).length,
				new7d: players.filter((p) => within(p.createdAt, now, 7 * DAY_MS))
					.length,
				new30d: players.filter((p) => within(p.createdAt, now, 30 * DAY_MS))
					.length,
				active7d: players.filter((p) =>
					within(lastActivity(p), now, 7 * DAY_MS),
				).length,
				active30d: players.filter((p) =>
					within(lastActivity(p), now, 30 * DAY_MS),
				).length,
				gamesRecorded: players.reduce((sum, p) => sum + p.gamesPlayed, 0),
				matches: allMatches.length,
				matches30d: recentMatches.length,
				averageDurationMs: average(
					recentMatches.map(([, match]) => match.duration),
				),
				averagePlayers: average(
					recentMatches.map(([, match]) => match.players),
				),
				friendships: friendships.rows.length,
			},
			presence: summarizePresence(
				samples.rows.map((row) => ({
					at: new Date(row.sampled_at),
					connected: Number(row.connected),
				})),
			),
			daily: summarizeDays(
				new Date(now),
				recentMatches.map(([matchId, match]) => ({ matchId, at: match.at })),
				players.map((player) => new Date(player.createdAt)),
			),
			players: players.slice(0, PLAYER_LIMIT),
		};
	}
}
