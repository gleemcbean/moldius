import {
	type AccountRevocation,
	AccountService,
	type AccountServiceOptions,
	type AuthenticatedSession,
} from "./AccountService.js";
import type { MatchRecord } from "./AccountStore.js";
import { readCookie, sessionCookieName } from "./cookies.js";
import type { Database } from "./database.js";
import type { DiscordClient } from "./discord.js";
import { migrate } from "./migrations.js";

const RETRY_MS = 30_000;
const PURGE_MS = 60 * 60_000;

export interface AccountModuleOptions
	extends Omit<AccountServiceOptions, "onRevoke"> {
	publicUrl?: string | null;
	dev?: boolean;
	discord?: DiscordClient | null;
}

export class AccountModule {
	service: AccountService | null = null;
	onRevoke: (revocation: AccountRevocation) => void = () => undefined;
	private retryTimer: NodeJS.Timeout | null = null;
	private purgeTimer: NodeJS.Timeout | null = null;
	private closed = false;

	constructor(
		private readonly database: Database | null,
		readonly cookieSecure: boolean,
		private readonly options: AccountModuleOptions = {},
	) {}

	get enabled(): boolean {
		return this.database !== null;
	}

	get discord(): DiscordClient | null {
		return this.options.discord ?? null;
	}

	linkBase(requestOrigin: string): string | null {
		if (this.options.publicUrl) {
			return this.options.publicUrl;
		}
		return this.options.dev ? requestOrigin : null;
	}

	async start(): Promise<void> {
		const database = this.database;
		if (!database || this.closed) {
			return;
		}
		try {
			const applied = await migrate(database);
			if (applied > 0) {
				console.log(
					`Comptes : ${applied} migration(s) PostgreSQL appliquée(s)`,
				);
			}
			this.service = new AccountService(database, {
				scrypt: this.options.scrypt,
				now: this.options.now,
				mailer: this.options.mailer ?? null,
				onRevoke: (revocation) => this.onRevoke(revocation),
			});
			this.purgeTimer = setInterval(() => {
				this.service?.purgeExpired().catch((error: unknown) => {
					console.error(
						"Comptes : purge des sessions impossible",
						describe(error),
					);
				});
			}, PURGE_MS);
			this.purgeTimer.unref();
		} catch (error) {
			console.error(
				`Comptes : base PostgreSQL injoignable (${describe(error)}), nouvel essai dans ${RETRY_MS / 1000} s`,
			);
			this.retryTimer = setTimeout(() => {
				this.retryTimer = null;
				void this.start();
			}, RETRY_MS);
			this.retryTimer.unref();
		}
	}

	async identify(
		cookieHeader: string | undefined,
	): Promise<AuthenticatedSession | null> {
		const service = this.service;
		if (!service) {
			return null;
		}
		try {
			return await service.authenticate(
				readCookie(cookieHeader, sessionCookieName(this.cookieSecure)),
			);
		} catch (error) {
			console.error("Comptes : identification impossible", describe(error));
			return null;
		}
	}

	record(records: MatchRecord[]): void {
		const service = this.service;
		if (!service) {
			return;
		}
		for (const record of records) {
			service.recordMatch(record).catch((error: unknown) => {
				console.error(
					"Comptes : enregistrement de partie impossible",
					describe(error),
				);
			});
		}
	}

	async close(): Promise<void> {
		this.closed = true;
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
		}
		if (this.purgeTimer) {
			clearInterval(this.purgeTimer);
		}
		this.service = null;
		await this.database?.close();
	}
}

function describe(error: unknown): string {
	if (error instanceof Error) {
		return (error as Error & { code?: string }).code ?? error.message;
	}
	return "erreur inconnue";
}
