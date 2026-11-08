import { randomInt } from "node:crypto";
import { isHatPattern } from "../../shared/hatPatterns.js";
import {
	FRIEND_CODE_LENGTH,
	FRIEND_LIMIT,
	type FriendPerson,
} from "../../shared/protocol/friends.js";
import { isTagline } from "../../shared/rewards.js";
import { type Database, isUniqueViolation } from "./database.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_ATTEMPTS = 6;

interface PersonRow {
	id: string;
	display_name: string;
	hat_color: number;
	hat_pattern: string;
	tagline: string | null;
	appear_offline: boolean;
	requester_id: string;
	status: string;
}

export interface FriendLink extends FriendPerson {
	appearOffline: boolean;
	accepted: boolean;
	requestedByMe: boolean;
}

export type AddFriendOutcome =
	| { ok: true; accountId: string }
	| { ok: false; reason: "unknown" | "self" | "exists" | "limit" };

function pair(a: string, b: string): [string, string] {
	return a < b ? [a, b] : [b, a];
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
	} | null> {
		const { rows } = await this.database.query<{
			friend_code: string | null;
			appear_offline: boolean;
			display_name: string;
		}>(
			"SELECT friend_code, appear_offline, display_name FROM accounts WHERE id = $1",
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
		const [low, high] = await Promise.all([
			select("account_low", "account_high"),
			select("account_high", "account_low"),
		]);
		return [...low.rows, ...high.rows]
			.map((row) => ({
				accountId: row.id,
				name: row.display_name,
				color: Number(row.hat_color),
				pattern: isHatPattern(row.hat_pattern) ? row.hat_pattern : "plain",
				tagline: isTagline(row.tagline) ? row.tagline : null,
				appearOffline: row.appear_offline,
				accepted: row.status === "accepted",
				requestedByMe: row.requester_id === accountId,
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
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
		if (links.length >= FRIEND_LIMIT) {
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

	/** Seul le destinataire de la demande peut l'accepter. */
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
