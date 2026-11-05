import { randomBytes } from "node:crypto";
import type { AccountRevocation } from "../accounts/AccountService.js";

export interface SessionAccount {
	accountId: string;
	tokenHash: string;
}

export interface Session {
	playerId: string;
	token: string;
	socketId: string | null;
	lobbyId: string | null;
	name: string | null;
	disconnectedAt: number | null;
	account: SessionAccount | null;
}

function randomId(bytes: number): string {
	return randomBytes(bytes).toString("base64url");
}

export class SessionRegistry {
	private readonly byToken = new Map<string, Session>();
	private readonly bySocket = new Map<string, Session>();
	private readonly byPlayer = new Map<string, Session>();

	hello(socketId: string, token: string | null): Session {
		const existing = token ? this.byToken.get(token) : undefined;
		if (existing) {
			if (existing.socketId) {
				this.bySocket.delete(existing.socketId);
			}
			existing.socketId = socketId;
			existing.disconnectedAt = null;
			this.bySocket.set(socketId, existing);
			return existing;
		}
		const session: Session = {
			playerId: `p_${randomId(9)}`,
			token: randomId(24),
			socketId,
			lobbyId: null,
			name: null,
			disconnectedAt: null,
			account: null,
		};
		this.byToken.set(session.token, session);
		this.byPlayer.set(session.playerId, session);
		this.bySocket.set(socketId, session);
		return session;
	}

	fromSocket(socketId: string): Session | null {
		return this.bySocket.get(socketId) ?? null;
	}

	withAccount(accountId: string): Session[] {
		return [...this.byToken.values()].filter(
			(session) => session.account?.accountId === accountId,
		);
	}

	fromPlayer(playerId: string): Session | null {
		return this.byPlayer.get(playerId) ?? null;
	}

	detach(socketId: string, now: number): Session | null {
		const session = this.bySocket.get(socketId);
		if (!session) {
			return null;
		}
		this.bySocket.delete(socketId);
		if (session.socketId === socketId) {
			session.socketId = null;
			session.disconnectedAt = now;
		}
		return session;
	}

	revoke(revocation: AccountRevocation): void {
		for (const session of this.byToken.values()) {
			const account = session.account;
			if (!account) {
				continue;
			}
			const revoked =
				revocation.kind === "session"
					? account.tokenHash === revocation.tokenHash
					: account.accountId === revocation.accountId &&
						account.tokenHash !== revocation.keepTokenHash;
			if (revoked) {
				session.account = null;
			}
		}
	}

	forget(session: Session): void {
		if (session.socketId) {
			return;
		}
		this.byToken.delete(session.token);
		this.byPlayer.delete(session.playerId);
	}
}
