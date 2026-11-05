import { randomUUID } from "node:crypto";
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
import type {
	AccountProfile,
	MatchHistoryEntry,
} from "../../shared/protocol/account.js";
import type { Database } from "./database.js";
import { type DiscordProfile, discordAvatarUrl } from "./discord.js";

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
	"displayName" | "color" | "pattern" | "language"
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
	language: string;
	games_played: number;
	wins: number;
	best_score: number;
	total_score: number;
	created_at: Date;
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
}

const ACCOUNT_COLUMNS =
	"id, email, password_hash, discord_id, discord_username, discord_avatar, display_name, hat_color, hat_pattern, language, games_played, wins, best_score, total_score, created_at";

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
			language: isLanguage(row.language) ? row.language : DEFAULT_LANGUAGE,
			createdAt: new Date(row.created_at).toISOString(),
			stats: {
				gamesPlayed: Number(row.games_played),
				wins: Number(row.wins),
				bestScore: Number(row.best_score),
				totalScore: Number(row.total_score),
			},
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
         updated_at = now()
       WHERE id = $1
       RETURNING ${ACCOUNT_COLUMNS}`,
			[id, fields.displayName, fields.color, fields.pattern, fields.language],
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
           rank, player_count, score, captures, deaths, won
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
           total_score = total_score + $3
         WHERE id = $1`,
				[record.accountId, record.won ? 1 : 0, record.score],
			);
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
			`SELECT match_id, played_at, duration_ms, visibility, player_name, color, rank,
              player_count, score, captures, deaths, won
       FROM match_history
       WHERE account_id = $1
       ORDER BY played_at DESC, id DESC
       LIMIT $2`,
			[accountId, limit],
		);
		return rows.map(toHistory);
	}
}
