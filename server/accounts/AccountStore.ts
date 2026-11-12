import { randomUUID } from "node:crypto";
import {
	type MatchMetrics,
	sanitizeChallengeProgress,
	withMatchMetrics,
} from "../../shared/challenges.js";
import {
	DEFAULT_HAT_PATTERN,
	type HatPattern,
	isHatPattern,
} from "../../shared/hatPatterns.js";
import {
	DEFAULT_LANGUAGE,
	isLanguage,
	type Language,
} from "../../shared/i18n/languages.js";
import { levelOf } from "../../shared/progression.js";
import type {
	AccountProfile,
	DailyBoard,
	DailyScoreEntry,
	MatchDetail,
	MatchDetailData,
	MatchHistoryEntry,
	PublicProfile,
} from "../../shared/protocol/account.js";
import {
	DEFAULT_LANTERN_TINT,
	isLanternTint,
	isTagline,
} from "../../shared/rewards.js";
import type { Database } from "./database.js";
import { type DiscordProfile, discordAvatarUrl } from "./discord.js";
import { parseMatchDetails } from "./matchDetails.js";

export interface StoredAccount {
	id: string;
	passwordHash: string | null;
	discordId: string | null;
	profile: AccountProfile;
}

export interface StoredSession {
	accountId: string;
	createdAt: Date;
	expiresAt: Date;
	lastUsedAt: Date;
}

export interface MatchRecord {
	accountId: string;
	matchId: string;
	playedAt: Date;
	durationMs: number;
	visibility: "public" | "private";
	playerName: string;
	color: number;
	rank: number;
	playerCount: number;
	score: number;
	captures: number;
	deaths: number;
	won: boolean;
	awarded?: boolean;
	dailyDate?: string | null;
	pattern?: HatPattern;
	metrics?: MatchMetrics;
	teamCount?: number;
	details?: MatchDetailData;
	xp?: number;
}

export interface PendingRegistration {
	email: string;
	emailKey: string;
	passwordHash: string;
	displayName: string;
	color: number;
	pattern: HatPattern;
	language: Language;
}

export type ProfileFields = Pick<
	AccountProfile,
	| "displayName"
	| "color"
	| "pattern"
	| "lantern"
	| "tagline"
	| "language"
	| "privateProfile"
>;

interface PendingRow {
	email: string;
	email_key: string;
	password_hash: string;
	display_name: string;
	hat_color: number;
	hat_pattern: string;
	language: string;
}

interface AccountRow {
	id: string;
	email: string | null;
	password_hash: string | null;
	discord_id: string | null;
	discord_username: string | null;
	discord_avatar: string | null;
	display_name: string;
	hat_color: number;
	hat_pattern: string;
	lantern_tint: string;
	tagline: string | null;
	language: string;
	total_captures: number;
	awards_earned: number;
	dailies_played: number;
	challenge_progress: unknown;
	games_played: number;
	wins: number;
	best_score: number;
	total_score: number;
	xp: number;
	private_profile: boolean | null;
	created_at: Date;
	terms_accepted_at: Date | string | null;
}

interface SessionRow {
	account_id: string;
	created_at: Date;
	expires_at: Date;
	last_used_at: Date;
}

interface HistoryRow {
	match_id: string;
	played_at: Date;
	duration_ms: number;
	visibility: string;
	player_name: string;
	color: number;
	rank: number;
	player_count: number;
	score: number;
	captures: number;
	deaths: number;
	won: boolean;
	daily_date: string | null;
	team_count: number | null;
	xp?: number | null;
	details?: unknown;
	has_details?: boolean;
}

const HISTORY_COLUMNS =
	"match_id, played_at, duration_ms, visibility, player_name, color, rank, player_count, score, captures, deaths, won, daily_date, team_count, xp";

const ACCOUNT_COLUMNS =
	"id, email, password_hash, discord_id, discord_username, discord_avatar, display_name, hat_color, hat_pattern, lantern_tint, tagline, language, games_played, wins, best_score, total_score, total_captures, awards_earned, dailies_played, xp, private_profile, challenge_progress, created_at, terms_accepted_at";

function toAccount(row: AccountRow): StoredAccount {
	return {
		id: row.id,
		passwordHash: row.password_hash,
		discordId: row.discord_id,
		profile: {
			email: row.email,
			hasPassword: Boolean(row.password_hash),
			discord: row.discord_id
				? {
						username: row.discord_username ?? "Discord",
						avatarUrl: discordAvatarUrl(row.discord_id, row.discord_avatar),
					}
				: null,
			displayName: row.display_name,
			color: Number(row.hat_color),
			pattern: isHatPattern(row.hat_pattern)
				? row.hat_pattern
				: DEFAULT_HAT_PATTERN,
			lantern: isLanternTint(row.lantern_tint)
				? row.lantern_tint
				: DEFAULT_LANTERN_TINT,
			tagline: isTagline(row.tagline) ? row.tagline : null,
			language: isLanguage(row.language) ? row.language : DEFAULT_LANGUAGE,
			createdAt: new Date(row.created_at).toISOString(),
			termsAcceptedAt: row.terms_accepted_at
				? new Date(row.terms_accepted_at).toISOString()
				: null,
			privateProfile: Boolean(row.private_profile),
			stats: {
				gamesPlayed: Number(row.games_played),
				wins: Number(row.wins),
				bestScore: Number(row.best_score),
				totalScore: Number(row.total_score),
				captures: Number(row.total_captures),
				dailies: Number(row.dailies_played),
				awards: Number(row.awards_earned),
				xp: Number(row.xp ?? 0),
			},
			challenges: sanitizeChallengeProgress(row.challenge_progress),
		},
	};
}

function toHistory(row: HistoryRow): MatchHistoryEntry {
	return {
		matchId: row.match_id,
		playedAt: new Date(row.played_at).toISOString(),
		durationMs: Number(row.duration_ms),
		visibility: row.visibility === "private" ? "private" : "public",
		playerName: row.player_name,
		color: Number(row.color),
		rank: Number(row.rank),
		playerCount: Number(row.player_count),
		score: Number(row.score),
		captures: Number(row.captures),
		deaths: Number(row.deaths),
		won: Boolean(row.won),
		daily: row.daily_date ?? null,
		teamCount: Number(row.team_count ?? 0),
		hasDetails: Boolean(row.has_details),
		xp: Number(row.xp ?? 0),
	};
}

export class AccountStore {
	constructor(private readonly database: Database) {}

	async findByEmail(emailKey: string): Promise<StoredAccount | null> {
		const { rows } = await this.database.query<AccountRow>(
			`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE email_key = $1`,
			[emailKey],
		);
		return rows[0] ? toAccount(rows[0]) : null;
	}

	async findByDiscord(discordId: string): Promise<StoredAccount | null> {
		const { rows } = await this.database.query<AccountRow>(
			`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE discord_id = $1`,
			[discordId],
		);
		return rows[0] ? toAccount(rows[0]) : null;
	}

	async createFromDiscord(
		discord: DiscordProfile,
		email: { email: string; emailKey: string } | null,
		displayName: string,
		color: number,
		language: Language,
		createdAt: Date,
	): Promise<StoredAccount> {
		const { rows } = await this.database.query<AccountRow>(
			`INSERT INTO accounts (id, email, email_key, email_verified_at, password_hash, discord_id,
         discord_username, discord_avatar, display_name, hat_color, hat_pattern, language)
       VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${ACCOUNT_COLUMNS}`,
			[
				randomUUID(),
				email?.email ?? null,
				email?.emailKey ?? null,
				email ? createdAt : null,
				discord.id,
				discord.username,
				discord.avatar,
				displayName,
				color,
				DEFAULT_HAT_PATTERN,
				language,
			],
		);
		return toAccount(rows[0]);
	}

	async setDiscord(
		accountId: string,
		discord: DiscordProfile | null,
	): Promise<StoredAccount | null> {
		const { rows } = await this.database.query<AccountRow>(
			`UPDATE accounts SET discord_id = $2, discord_username = $3, discord_avatar = $4, updated_at = now()
       WHERE id = $1
       RETURNING ${ACCOUNT_COLUMNS}`,
			[
				accountId,
				discord?.id ?? null,
				discord?.username ?? null,
				discord?.avatar ?? null,
			],
		);
		return rows[0] ? toAccount(rows[0]) : null;
	}

	async findById(id: string): Promise<StoredAccount | null> {
		const { rows } = await this.database.query<AccountRow>(
			`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE id = $1`,
			[id],
		);
		return rows[0] ? toAccount(rows[0]) : null;
	}

	async create(
		input: PendingRegistration,
		verifiedAt: Date,
	): Promise<StoredAccount> {
		const { rows } = await this.database.query<AccountRow>(
			`INSERT INTO accounts (id, email, email_key, email_verified_at, password_hash, display_name,
         hat_color, hat_pattern, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${ACCOUNT_COLUMNS}`,
			[
				randomUUID(),
				input.email,
				input.emailKey,
				verifiedAt,
				input.passwordHash,
				input.displayName,
				input.color,
				input.pattern,
				input.language,
			],
		);
		return toAccount(rows[0]);
	}

	async createPending(
		tokenHash: string,
		pending: PendingRegistration,
		createdAt: Date,
		expiresAt: Date,
	): Promise<void> {
		await this.database.query(
			`INSERT INTO pending_registrations
         (token_hash, email, email_key, password_hash, display_name, hat_color, hat_pattern,
          language, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			[
				tokenHash,
				pending.email,
				pending.emailKey,
				pending.passwordHash,
				pending.displayName,
				pending.color,
				pending.pattern,
				pending.language,
				createdAt,
				expiresAt,
			],
		);
	}

	async takePending(
		tokenHash: string,
		now: Date,
	): Promise<PendingRegistration | null> {
		const { rows } = await this.database.query<PendingRow>(
			`DELETE FROM pending_registrations WHERE token_hash = $1 AND expires_at > $2
       RETURNING email, email_key, password_hash, display_name, hat_color, hat_pattern, language`,
			[tokenHash, now],
		);
		const row = rows[0];
		return row
			? {
					email: row.email,
					emailKey: row.email_key,
					passwordHash: row.password_hash,
					displayName: row.display_name,
					color: Number(row.hat_color),
					pattern: isHatPattern(row.hat_pattern)
						? row.hat_pattern
						: DEFAULT_HAT_PATTERN,
					language: isLanguage(row.language) ? row.language : DEFAULT_LANGUAGE,
				}
			: null;
	}

	async deletePendingFor(emailKey: string): Promise<void> {
		await this.database.query(
			"DELETE FROM pending_registrations WHERE email_key = $1",
			[emailKey],
		);
	}

	async createReset(
		tokenHash: string,
		accountId: string,
		createdAt: Date,
		expiresAt: Date,
	): Promise<void> {
		await this.database.query(
			`INSERT INTO password_resets (token_hash, account_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4)`,
			[tokenHash, accountId, createdAt, expiresAt],
		);
	}

	async peekReset(tokenHash: string, now: Date): Promise<string | null> {
		const { rows } = await this.database.query<{ account_id: string }>(
			"SELECT account_id FROM password_resets WHERE token_hash = $1 AND expires_at > $2",
			[tokenHash, now],
		);
		return rows[0]?.account_id ?? null;
	}

	async takeReset(tokenHash: string, now: Date): Promise<string | null> {
		const { rows } = await this.database.query<{ account_id: string }>(
			"DELETE FROM password_resets WHERE token_hash = $1 AND expires_at > $2 RETURNING account_id",
			[tokenHash, now],
		);
		return rows[0]?.account_id ?? null;
	}

	async deleteResetsOf(accountId: string): Promise<void> {
		await this.database.query(
			"DELETE FROM password_resets WHERE account_id = $1",
			[accountId],
		);
	}

	async updateProfile(
		id: string,
		fields: ProfileFields,
	): Promise<StoredAccount | null> {
		const { rows } = await this.database.query<AccountRow>(
			`UPDATE accounts SET display_name = $2, hat_color = $3, hat_pattern = $4, language = $5,
         lantern_tint = $6, tagline = $7, private_profile = $8, updated_at = now()
       WHERE id = $1
       RETURNING ${ACCOUNT_COLUMNS}`,
			[
				id,
				fields.displayName,
				fields.color,
				fields.pattern,
				fields.language,
				fields.lantern,
				fields.tagline,
				fields.privateProfile,
			],
		);
		return rows[0] ? toAccount(rows[0]) : null;
	}

	async dailyBoard(
		date: string,
		accountId: string | null,
		limit: number,
	): Promise<DailyBoard> {
		interface ScoreRow {
			account_id: string;
			player_name: string;
			color: number;
			pattern: string;
			best_score: number;
			captures: number;
			deaths: number;
			tagline: string | null;
			profile_id: string | null;
		}
		const columns =
			"d.account_id, d.player_name, d.color, d.pattern, d.best_score, d.captures, d.deaths, a.tagline, a.id AS profile_id";
		const from = "daily_scores d LEFT JOIN accounts a ON a.id = d.account_id";
		const toEntry = (row: ScoreRow, rank: number): DailyScoreEntry => ({
			rank,
			profileId: row.profile_id ?? null,
			name: row.player_name,
			color: Number(row.color),
			pattern: isHatPattern(row.pattern) ? row.pattern : DEFAULT_HAT_PATTERN,
			tagline: isTagline(row.tagline) ? row.tagline : null,
			score: Number(row.best_score),
			captures: Number(row.captures),
			deaths: Number(row.deaths),
			self: row.account_id === accountId,
		});
		const { rows } = await this.database.query<ScoreRow>(
			`SELECT ${columns} FROM ${from} WHERE d.challenge_date = $1
       ORDER BY d.best_score DESC, d.updated_at ASC LIMIT $2`,
			[date, limit],
		);
		const entries = rows.map((row, index) => toEntry(row, index + 1));
		let me = entries.find((entry) => entry.self) ?? null;
		if (!me && accountId) {
			const own = await this.database.query<ScoreRow>(
				`SELECT ${columns} FROM ${from} WHERE d.challenge_date = $1 AND d.account_id = $2`,
				[date, accountId],
			);
			if (own.rows[0]) {
				const ahead = await this.database.query<{ count: string }>(
					"SELECT count(*) AS count FROM daily_scores WHERE challenge_date = $1 AND best_score > $2",
					[date, own.rows[0].best_score],
				);
				me = toEntry(own.rows[0], Number(ahead.rows[0]?.count ?? 0) + 1);
			}
		}
		return { date, entries, me };
	}

	async acceptTerms(id: string): Promise<StoredAccount | null> {
		const { rows } = await this.database.query<AccountRow>(
			`UPDATE accounts
       SET terms_accepted_at = COALESCE(terms_accepted_at, now())
       WHERE id = $1
       RETURNING ${ACCOUNT_COLUMNS}`,
			[id],
		);
		return rows[0] ? toAccount(rows[0]) : null;
	}

	async updatePasswordHash(
		id: string,
		passwordHash: string,
		changed: boolean,
	): Promise<void> {
		await this.database.query(
			changed
				? "UPDATE accounts SET password_hash = $2, password_changed_at = now(), updated_at = now() WHERE id = $1"
				: "UPDATE accounts SET password_hash = $2 WHERE id = $1",
			[id, passwordHash],
		);
	}

	async touchLogin(id: string): Promise<void> {
		await this.database.query(
			"UPDATE accounts SET last_login_at = now() WHERE id = $1",
			[id],
		);
	}

	async delete(id: string): Promise<void> {
		await this.database.query("DELETE FROM accounts WHERE id = $1", [id]);
	}

	async createSession(
		tokenHash: string,
		accountId: string,
		createdAt: Date,
		expiresAt: Date,
	): Promise<void> {
		await this.database.query(
			`INSERT INTO auth_sessions (token_hash, account_id, created_at, last_used_at, expires_at)
       VALUES ($1, $2, $3, $3, $4)`,
			[tokenHash, accountId, createdAt, expiresAt],
		);
	}

	async findSession(
		tokenHash: string,
		now: Date,
	): Promise<StoredSession | null> {
		const { rows } = await this.database.query<SessionRow>(
			`SELECT account_id, created_at, expires_at, last_used_at FROM auth_sessions
       WHERE token_hash = $1 AND expires_at > $2`,
			[tokenHash, now],
		);
		const row = rows[0];
		return row
			? {
					accountId: row.account_id,
					createdAt: new Date(row.created_at),
					expiresAt: new Date(row.expires_at),
					lastUsedAt: new Date(row.last_used_at),
				}
			: null;
	}

	async extendSession(
		tokenHash: string,
		usedAt: Date,
		expiresAt: Date,
	): Promise<void> {
		await this.database.query(
			"UPDATE auth_sessions SET last_used_at = $2, expires_at = $3 WHERE token_hash = $1",
			[tokenHash, usedAt, expiresAt],
		);
	}

	async deleteSession(tokenHash: string): Promise<void> {
		await this.database.query(
			"DELETE FROM auth_sessions WHERE token_hash = $1",
			[tokenHash],
		);
	}

	async deleteSessionsOf(accountId: string): Promise<void> {
		await this.database.query(
			"DELETE FROM auth_sessions WHERE account_id = $1",
			[accountId],
		);
	}

	async deleteExpired(now: Date): Promise<void> {
		await this.database.query(
			"DELETE FROM auth_sessions WHERE expires_at <= $1",
			[now],
		);
		await this.database.query(
			"DELETE FROM pending_registrations WHERE expires_at <= $1",
			[now],
		);
		await this.database.query(
			"DELETE FROM password_resets WHERE expires_at <= $1",
			[now],
		);
	}

	async recordMatch(record: MatchRecord, keep: number): Promise<boolean> {
		return this.database.transaction(async (client) => {
			const existing = await client.query(
				"SELECT 1 FROM match_history WHERE account_id = $1 AND match_id = $2",
				[record.accountId, record.matchId],
			);
			if (existing.rows.length > 0) {
				return false;
			}
			const inserted = await client.query<{ id: string }>(
				`INSERT INTO match_history (
           id, account_id, match_id, played_at, duration_ms, visibility, player_name, color,
           rank, player_count, score, captures, deaths, won, daily_date, team_count, details, xp
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (account_id, match_id) DO NOTHING
         RETURNING id`,
				[
					randomUUID(),
					record.accountId,
					record.matchId,
					record.playedAt,
					record.durationMs,
					record.visibility,
					record.playerName,
					record.color,
					record.rank,
					record.playerCount,
					record.score,
					record.captures,
					record.deaths,
					record.won,
					record.dailyDate ?? null,
					record.teamCount ?? 0,
					record.details ? JSON.stringify(record.details) : null,
					record.xp ?? 0,
				],
			);
			if (inserted.rows.length === 0) {
				return false;
			}
			await client.query(
				`UPDATE accounts SET
           games_played = games_played + 1,
           wins = wins + $2,
           best_score = greatest(best_score, $3),
           total_score = total_score + $3,
           total_captures = total_captures + $4,
           awards_earned = awards_earned + $5,
           xp = xp + $6
         WHERE id = $1`,
				[
					record.accountId,
					record.won ? 1 : 0,
					record.score,
					record.captures,
					record.awarded ? 1 : 0,
					record.xp ?? 0,
				],
			);
			if (record.metrics) {
				const saved = await client.query<{ challenge_progress: unknown }>(
					"SELECT challenge_progress FROM accounts WHERE id = $1 FOR UPDATE",
					[record.accountId],
				);
				await client.query(
					"UPDATE accounts SET challenge_progress = $2 WHERE id = $1",
					[
						record.accountId,
						JSON.stringify(
							withMatchMetrics(
								sanitizeChallengeProgress(saved.rows[0]?.challenge_progress),
								record.metrics,
							),
						),
					],
				);
			}
			if (record.dailyDate) {
				const previous = await client.query<{ best_score: number }>(
					"SELECT best_score FROM daily_scores WHERE challenge_date = $1 AND account_id = $2",
					[record.dailyDate, record.accountId],
				);
				const best = previous.rows[0];
				const score = [
					record.dailyDate,
					record.accountId,
					record.playerName,
					record.color,
					record.pattern ?? DEFAULT_HAT_PATTERN,
					record.score,
					record.captures,
					record.deaths,
					record.playedAt,
				];
				if (!best) {
					await client.query(
						`INSERT INTO daily_scores
               (challenge_date, account_id, player_name, color, pattern, best_score, captures, deaths, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
						score,
					);
					await client.query(
						"UPDATE accounts SET dailies_played = dailies_played + 1 WHERE id = $1",
						[record.accountId],
					);
				} else if (record.score > Number(best.best_score)) {
					await client.query(
						`UPDATE daily_scores
             SET player_name = $3, color = $4, pattern = $5, best_score = $6,
               captures = $7, deaths = $8, updated_at = $9
             WHERE challenge_date = $1 AND account_id = $2`,
						score,
					);
				}
			}
			await client.query(
				`DELETE FROM match_history
         WHERE account_id = $1 AND id NOT IN (
           SELECT id FROM match_history WHERE account_id = $1
           ORDER BY played_at DESC, id DESC
           LIMIT $2
         )`,
				[record.accountId, keep],
			);
			return true;
		});
	}

	async history(
		accountId: string,
		limit: number,
	): Promise<MatchHistoryEntry[]> {
		const { rows } = await this.database.query<HistoryRow>(
			`SELECT ${HISTORY_COLUMNS}, details IS NOT NULL AS has_details
       FROM match_history
       WHERE account_id = $1
       ORDER BY played_at DESC, id DESC
       LIMIT $2`,
			[accountId, limit],
		);
		return rows.map(toHistory);
	}

	async historyDetail(
		accountId: string,
		matchId: string,
	): Promise<MatchDetail | null> {
		const { rows } = await this.database.query<HistoryRow>(
			`SELECT ${HISTORY_COLUMNS}, details
       FROM match_history
       WHERE account_id = $1 AND match_id = $2`,
			[accountId, matchId],
		);
		const row = rows[0];
		const details = row ? parseMatchDetails(row.details) : null;
		if (!row || !details) {
			return null;
		}
		return { ...toHistory({ ...row, has_details: true }), ...details };
	}

	async publicProfile(
		accountId: string,
		recentLimit: number,
		viewerId: string | null,
	): Promise<PublicProfile | null> {
		const account = await this.findById(accountId);
		if (!account) {
			return null;
		}
		const { profile } = account;
		const identity = {
			profileId: account.id,
			displayName: profile.displayName,
			color: profile.color,
			pattern: profile.pattern,
			lantern: profile.lantern,
			tagline: profile.tagline,
			level: levelOf(profile.stats.xp ?? 0),
			private: profile.privateProfile,
		};
		if (
			profile.privateProfile &&
			!(viewerId && (await this.canSeePrivate(account.id, viewerId)))
		) {
			return { ...identity, createdAt: null, stats: null, recent: [] };
		}
		const { rows } = await this.database.query<HistoryRow>(
			`SELECT ${HISTORY_COLUMNS}
       FROM match_history
       WHERE account_id = $1
       ORDER BY played_at DESC, id DESC
       LIMIT $2`,
			[accountId, recentLimit],
		);
		return {
			...identity,
			createdAt: profile.createdAt,
			stats: profile.stats,
			recent: rows.map((row) => {
				const entry = toHistory(row);
				return {
					playedAt: entry.playedAt,
					rank: entry.rank,
					playerCount: entry.playerCount,
					score: entry.score,
					won: entry.won,
					daily: entry.daily,
					teamCount: entry.teamCount,
				};
			}),
		};
	}

	private async canSeePrivate(
		accountId: string,
		viewerId: string,
	): Promise<boolean> {
		if (accountId === viewerId) {
			return true;
		}
		const [low, high] =
			accountId < viewerId ? [accountId, viewerId] : [viewerId, accountId];
		const { rows } = await this.database.query(
			`SELECT 1 FROM friendships
       WHERE account_low = $1 AND account_high = $2 AND status = 'accepted'`,
			[low, high],
		);
		if (rows.length > 0) {
			return true;
		}
		const discord = await this.database.query(
			`SELECT 1 FROM accounts me
       JOIN discord_friends mine ON mine.account_id = me.id
       JOIN accounts a ON a.discord_id = mine.discord_id
       JOIN discord_friends theirs ON theirs.account_id = a.id AND theirs.discord_id = me.discord_id
       WHERE me.id = $1 AND a.id = $2`,
			[viewerId, accountId],
		);
		return discord.rows.length > 0;
	}
}
