import { randomInt } from "node:crypto";
import { isHatPattern } from "../../shared/hatPatterns.js";
import {
	DISCORD_FRIEND_LIMIT,
	FRIEND_CODE_LENGTH,
	FRIEND_LIMIT,
	type FriendPerson,
} from "../../shared/protocol/friends.js";
import { isTagline } from "../../shared/rewards.js";
import { type Database, isUniqueViolation } from "./database.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_ATTEMPTS = 6;
const INSERT_CHUNK = 200;

interface AccountRow {
	id: string;
	display_name: string;
	hat_color: number;
	hat_pattern: string;
	tagline: string | null;
	appear_offline: boolean;
}

interface PersonRow extends AccountRow {
	requester_id: string;
	status: string;
}

interface DiscordFriendRow extends AccountRow {
	discord_id: string;
}

export interface FriendLink extends FriendPerson {
	appearOffline: boolean;
	accepted: boolean;
	requestedByMe: boolean;
	codeFriend: boolean;
	discord: boolean;
	discordId: string | null;
}

export type AddFriendOutcome =
	| { ok: true; accountId: string }
	| { ok: false; reason: "unknown" | "self" | "exists" | "limit" };

export type DiscordSyncOutcome =
	| { ok: true; touched: string[] }
	| { ok: false; reason: "not-linked" | "mismatch" };

function pair(a: string, b: string): [string, string] {
	return a < b ? [a, b] : [b, a];
}

function person(row: AccountRow): FriendPerson {
	return {
		accountId: row.id,
		name: row.display_name,
		color: Number(row.hat_color),
		pattern: isHatPattern(row.hat_pattern) ? row.hat_pattern : "plain",
		tagline: isTagline(row.tagline) ? row.tagline : null,
	};
}

function randomCode(): string {
	let code = "";
	for (let index = 0; index < FRIEND_CODE_LENGTH; index += 1) {
		code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
	}
	return code;
}

export class FriendStore {
	constructor(
		private readonly database: Database,
		private readonly now: () => number = Date.now,
	) {}

	async identity(accountId: string): Promise<{
		friendCode: string;
		appearOffline: boolean;
		name: string;
		discordId: string | null;
		discordSynced: boolean;
	} | null> {
		const { rows } = await this.database.query<{
			friend_code: string | null;
			appear_offline: boolean;
			display_name: string;
			discord_id: string | null;
			discord_synced_at: Date | null;
		}>(
			"SELECT friend_code, appear_offline, display_name, discord_id, discord_synced_at FROM accounts WHERE id = $1",
			[accountId],
		);
		const row = rows[0];
		if (!row) {
			return null;
		}
		return {
			friendCode: row.friend_code ?? (await this.assignCode(accountId)),
			appearOffline: row.appear_offline,
			name: row.display_name,
			discordId: row.discord_id,
			discordSynced: row.discord_synced_at !== null,
		};
	}

	private async assignCode(accountId: string): Promise<string> {
		for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
			const code = randomCode();
			try {
				await this.database.query(
					"UPDATE accounts SET friend_code = $2 WHERE id = $1 AND friend_code IS NULL",
					[accountId, code],
				);
			} catch (error) {
				if (isUniqueViolation(error)) {
					continue;
				}
				throw error;
			}
			const { rows } = await this.database.query<{
				friend_code: string | null;
			}>("SELECT friend_code FROM accounts WHERE id = $1", [accountId]);
			if (rows[0]?.friend_code) {
				return rows[0].friend_code;
			}
		}
		throw new Error("Impossible d'attribuer un code ami");
	}

	async links(accountId: string): Promise<FriendLink[]> {
		const select = (mine: string, other: string) =>
			this.database.query<PersonRow>(
				`SELECT a.id, a.display_name, a.hat_color, a.hat_pattern, a.tagline, a.appear_offline,
                f.requester_id, f.status
         FROM friendships f
         JOIN accounts a ON a.id = f.${other}
         WHERE f.${mine} = $1`,
				[accountId],
			);
		const [low, high, discord] = await Promise.all([
			select("account_low", "account_high"),
			select("account_high", "account_low"),
			this.discordFriends(accountId),
		]);
		const links = new Map<string, FriendLink>();
		for (const row of [...low.rows, ...high.rows]) {
			const accepted = row.status === "accepted";
			links.set(row.id, {
				...person(row),
				appearOffline: row.appear_offline,
				accepted,
				requestedByMe: row.requester_id === accountId,
				codeFriend: accepted,
				discord: false,
				discordId: null,
			});
		}
		for (const row of discord) {
			const existing = links.get(row.id);
			links.set(row.id, {
				...(existing ?? {
					...person(row),
					appearOffline: row.appear_offline,
					requestedByMe: false,
					codeFriend: false,
				}),
				accepted: true,
				discord: true,
				discordId: row.discord_id,
			});
		}
		return [...links.values()].sort((a, b) => a.name.localeCompare(b.name));
	}

	private async discordFriends(accountId: string): Promise<DiscordFriendRow[]> {
		const { rows } = await this.database.query<DiscordFriendRow>(
			`SELECT a.id, a.display_name, a.hat_color, a.hat_pattern, a.tagline, a.appear_offline,
              a.discord_id
       FROM accounts me
       JOIN discord_friends mine ON mine.account_id = me.id
       JOIN accounts a ON a.discord_id = mine.discord_id
       JOIN discord_friends theirs ON theirs.account_id = a.id AND theirs.discord_id = me.discord_id
       WHERE me.id = $1 AND a.id <> me.id`,
			[accountId],
		);
		return rows;
	}

	async syncDiscord(
		accountId: string,
		discordId: string,
		friendIds: readonly string[],
	): Promise<DiscordSyncOutcome> {
		const identity = await this.identity(accountId);
		if (!identity?.discordId) {
			return { ok: false, reason: "not-linked" };
		}
		if (identity.discordId !== discordId) {
			return { ok: false, reason: "mismatch" };
		}
		const before = await this.discordFriends(accountId);
		const ids = [...new Set(friendIds)]
			.filter((id) => id !== discordId)
			.slice(0, DISCORD_FRIEND_LIMIT);
		await this.database.transaction(async (client) => {
			await client.query("DELETE FROM discord_friends WHERE account_id = $1", [
				accountId,
			]);
			for (let start = 0; start < ids.length; start += INSERT_CHUNK) {
				const chunk = ids.slice(start, start + INSERT_CHUNK);
				const values = chunk
					.map((_, index) => `($1, $${index + 2})`)
					.join(", ");
				await client.query(
					`INSERT INTO discord_friends (account_id, discord_id) VALUES ${values}`,
					[accountId, ...chunk],
				);
			}
			await client.query(
				"UPDATE accounts SET discord_synced_at = $2 WHERE id = $1",
				[accountId, new Date(this.now())],
			);
		});
		const after = await this.discordFriends(accountId);
		return {
			ok: true,
			touched: [...new Set([...before, ...after].map((row) => row.id))],
		};
	}

	async friendIds(accountId: string): Promise<string[]> {
		const links = await this.links(accountId);
		return links.filter((link) => link.accepted).map((link) => link.accountId);
	}

	async add(accountId: string, code: string): Promise<AddFriendOutcome> {
		const { rows } = await this.database.query<{ id: string }>(
			"SELECT id FROM accounts WHERE friend_code = $1",
			[code],
		);
		const target = rows[0]?.id;
		if (!target) {
			return { ok: false, reason: "unknown" };
		}
		if (target === accountId) {
			return { ok: false, reason: "self" };
		}
		const links = await this.links(accountId);
		const existing = links.find((link) => link.accountId === target);
		if (existing) {
			if (existing.accepted || existing.requestedByMe) {
				return { ok: false, reason: "exists" };
			}
			await this.accept(accountId, target);
			return { ok: true, accountId: target };
		}
		if (
			links.filter((link) => !link.discord || link.codeFriend).length >=
			FRIEND_LIMIT
		) {
			return { ok: false, reason: "limit" };
		}
		const [low, high] = pair(accountId, target);
		try {
			await this.database.query(
				`INSERT INTO friendships (account_low, account_high, requester_id, status, created_at)
         VALUES ($1, $2, $3, 'pending', $4)`,
				[low, high, accountId, new Date(this.now())],
			);
		} catch (error) {
			if (isUniqueViolation(error)) {
				return { ok: false, reason: "exists" };
			}
			throw error;
		}
		return { ok: true, accountId: target };
	}

	async accept(accountId: string, other: string): Promise<boolean> {
		const [low, high] = pair(accountId, other);
		const { rows } = await this.database.query(
			`UPDATE friendships SET status = 'accepted', accepted_at = $5
       WHERE account_low = $1 AND account_high = $2 AND requester_id = $3
         AND status = 'pending' AND requester_id <> $4
       RETURNING requester_id`,
			[low, high, other, accountId, new Date(this.now())],
		);
		return rows.length > 0;
	}

	async remove(accountId: string, other: string): Promise<boolean> {
		const [low, high] = pair(accountId, other);
		const { rows } = await this.database.query(
			`DELETE FROM friendships WHERE account_low = $1 AND account_high = $2
       RETURNING requester_id`,
			[low, high],
		);
		return rows.length > 0;
	}

	async setAppearOffline(accountId: string, offline: boolean): Promise<void> {
		await this.database.query(
			"UPDATE accounts SET appear_offline = $2 WHERE id = $1",
			[accountId, offline],
		);
	}

	async touchLastSeen(accountId: string): Promise<void> {
		await this.database.query(
			"UPDATE accounts SET last_seen_at = $2 WHERE id = $1",
			[accountId, new Date(this.now())],
		);
	}
}
