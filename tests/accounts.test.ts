import { createHash } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { AccountModule } from "../server/accounts/AccountModule.js";
import {
	AccountService,
	type IssuedSession,
	MAILS_PER_ADDRESS,
	REGISTRATION_TTL_MS,
	RESET_TTL_MS,
	SESSION_IDLE_MS,
} from "../server/accounts/AccountService.js";
import type { MatchRecord } from "../server/accounts/AccountStore.js";
import {
	readCookie,
	serializeSessionCookie,
} from "../server/accounts/cookies.js";
import type { Database } from "../server/accounts/database.js";
import {
	type DiscordClient,
	type DiscordProfile,
	parseDiscordUser,
} from "../server/accounts/discord.js";
import { buildMatchRecords } from "../server/accounts/matchRecords.js";
import { MIGRATIONS, migrate } from "../server/accounts/migrations.js";
import {
	hashPassword,
	needsRehash,
	verifyPassword,
} from "../server/accounts/passwords.js";
import { Throttle } from "../server/accounts/throttle.js";
import { type RunningServer, startServer } from "../server/index.js";
import type { Mailer, MailMessage } from "../server/mail/mailer.js";
import { verificationEmail } from "../server/mail/templates.js";
import { SessionRegistry } from "../server/sessions/SessionRegistry.js";
import { accountMessage } from "../shared/i18n/accountMessages.js";
import { parseLanguage } from "../shared/i18n/languages.js";
import { PUBLIC_MATCH_CONFIG } from "../shared/matchConfig.js";
import { levelOf, matchXp } from "../shared/progression.js";
import type { AccountProfile } from "../shared/protocol/account.js";
import {
	isDeleteConfirmation,
	MATCH_HISTORY_LIMIT,
	type MatchHistoryEntry,
	validateEmail,
	validatePassword,
} from "../shared/protocol/account.js";
import type { MatchResults } from "../shared/protocol/game.js";
import { teamStandings } from "../shared/teams.js";
import { createTestDatabase } from "./helpers/testDatabase.js";

const FAST_SCRYPT = { logN: 14, r: 8, p: 1 };
const PUBLIC_URL = "https://mycelium.example";
const EMAIL = "Truffe.Noire@Example.org";
const PASSWORD = "spores-sous-la-lune";
const BLUE = 0x3f7fd6;
const GREEN = 0x4f9e45;

interface Reply {
	status: number;
	body: Record<string, unknown> | null;
	cookies: string[];
	headers: Headers;
}

const SESSION_COOKIE = "mycelium_session";

class Agent {
	readonly jar = new Map<string, string>();

	constructor(
		private readonly base: string,
		private readonly origin: string,
	) {}

	get cookie(): string | null {
		const value = this.jar.get(SESSION_COOKIE);
		return value === undefined ? null : `${SESSION_COOKIE}=${value}`;
	}

	set cookie(pair: string | null) {
		if (pair === null) {
			this.jar.delete(SESSION_COOKIE);
		} else {
			this.jar.set(SESSION_COOKIE, pair.split("=")[1]);
		}
	}

	async send(
		method: string,
		path: string,
		body?: unknown,
		headers: Record<string, string> = {},
	): Promise<Reply> {
		const cookieHeader = [...this.jar]
			.map(([name, value]) => `${name}=${value}`)
			.join("; ");
		const response = await fetch(`${this.base}${path}`, {
			method,
			redirect: "manual",
			headers: {
				Origin: this.origin,
				...(body !== undefined ? { "Content-Type": "application/json" } : {}),
				...(cookieHeader ? { Cookie: cookieHeader } : {}),
				...headers,
			},
			body:
				body === undefined
					? undefined
					: typeof body === "string"
						? body
						: JSON.stringify(body),
		});
		const cookies = response.headers.getSetCookie();
		for (const cookie of cookies) {
			const pair = cookie.split(";")[0];
			const separator = pair.indexOf("=");
			const name = pair.slice(0, separator);
			if (/Max-Age=0/.test(cookie)) {
				this.jar.delete(name);
			} else {
				this.jar.set(name, pair.slice(separator + 1));
			}
		}
		const text = await response.text();
		return {
			status: response.status,
			body: response.headers.get("content-type")?.includes("application/json")
				? (JSON.parse(text) as Record<string, unknown>)
				: null,
			cookies,
			headers: response.headers,
		};
	}

	get token(): string {
		return (this.cookie as string).split("=")[1];
	}
}

class FakeDiscord implements DiscordClient {
	readonly profiles = new Map<string, DiscordProfile>();
	lastRedirect = "";

	authorizeUrl(state: string, redirectUri: string): string {
		return `https://discord.test/authorize?${new URLSearchParams({ state, redirect_uri: redirectUri })}`;
	}

	async fetchProfile(
		code: string,
		redirectUri: string,
	): Promise<DiscordProfile> {
		this.lastRedirect = redirectUri;
		const profile = this.profiles.get(code);
		if (!profile) {
			throw new Error("code inconnu");
		}
		return profile;
	}
}

function discordProfile(
	id: string,
	username: string,
	email: string | null,
	locale: string | null = null,
): DiscordProfile {
	return {
		id,
		username,
		displayName: username,
		avatar: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
		email,
		emailVerified: email !== null,
		locale,
	};
}

class MemoryMailer implements Mailer {
	readonly kind = "memory" as const;
	readonly sent: MailMessage[] = [];

	async send(message: MailMessage): Promise<void> {
		this.sent.push(message);
	}

	last(to?: string): MailMessage {
		const matching = this.sent.filter(
			(message) => !to || message.to.toLowerCase() === to.toLowerCase(),
		);
		return matching[matching.length - 1];
	}

	token(kind: "verifier" | "reinitialiser", to?: string): string {
		const match = new RegExp(`#${kind}=([A-Za-z0-9_-]{43})`).exec(
			this.last(to).text,
		);
		if (!match) {
			throw new Error(`Aucun lien « ${kind} » dans le dernier e-mail`);
		}
		return match[1];
	}
}

interface Launched {
	server: RunningServer;
	database: Database;
	mailer: MemoryMailer;
	discord: FakeDiscord;
	agent: () => Agent;
}

const running: RunningServer[] = [];

async function launch(
	options: {
		mailer?: MemoryMailer | null;
		publicUrl?: string | null;
		discord?: FakeDiscord | null;
	} = {},
): Promise<Launched> {
	const db = await createTestDatabase();
	const mailer =
		options.mailer === undefined ? new MemoryMailer() : options.mailer;
	const discord =
		options.discord === undefined ? new FakeDiscord() : options.discord;
	const server = await startServer({
		port: 0,
		dev: false,
		database: db,
		cookieSecure: false,
		scrypt: FAST_SCRYPT,
		mailer,
		publicUrl: options.publicUrl === undefined ? PUBLIC_URL : options.publicUrl,
		discord,
	});
	running.push(server);
	const origin = `http://127.0.0.1:${server.port}`;
	return {
		server,
		database: db,
		mailer: mailer ?? new MemoryMailer(),
		discord: discord ?? new FakeDiscord(),
		agent: () => new Agent(`${origin}/api/account`, origin),
	};
}

async function createAccount(
	launched: Launched,
	agent: Agent,
	email = EMAIL,
	password = PASSWORD,
): Promise<void> {
	const registered = await agent.send("POST", "/register", {
		email,
		password,
		displayName: "Truffe Noire",
		color: BLUE,
	});
	expect(registered.status).toBe(202);
	const verified = await agent.send("POST", "/verify-email", {
		token: launched.mailer.token("verifier", email),
	});
	expect(verified.status).toBe(201);
}

beforeAll(() => {
	process.env.HOST = "127.0.0.1";
});

afterEach(async () => {
	while (running.length > 0) {
		await (running.pop() as RunningServer).close();
	}
});

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

describe("mots de passe", () => {
	it("hache avec scrypt, un sel unique et une comparaison stricte", async () => {
		const first = await hashPassword(PASSWORD, FAST_SCRYPT);
		const second = await hashPassword(PASSWORD, FAST_SCRYPT);
		expect(first).toMatch(
			/^scrypt\$14\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/,
		);
		expect(first).not.toBe(second);
		expect(first).not.toContain(PASSWORD);
		expect(await verifyPassword(PASSWORD, first)).toBe(true);
		expect(await verifyPassword(`${PASSWORD}!`, first)).toBe(false);
		expect(await verifyPassword(PASSWORD, "scrypt$14$8$1$abc$def")).toBe(false);
		expect(await verifyPassword(PASSWORD, "plain-text")).toBe(false);
	});

	it("normalise l'Unicode et détecte les paramètres obsolètes", async () => {
		const hash = await hashPassword("ﬁl-des-spores-①", FAST_SCRYPT);
		expect(await verifyPassword("fil-des-spores-1", hash)).toBe(true);
		expect(needsRehash(hash, FAST_SCRYPT)).toBe(false);
		expect(needsRehash(hash, { logN: 15, r: 8, p: 3 })).toBe(true);
	});

	it("valide adresses e-mail et mots de passe", () => {
		expect(validateEmail("")).not.toBeNull();
		expect(validateEmail("sans-arobase.org")).not.toBeNull();
		expect(validateEmail("a@b")).not.toBeNull();
		expect(validateEmail("deux mots@example.org")).not.toBeNull();
		expect(validateEmail("injection@example.org\r\nBcc: x@y.z")).not.toBeNull();
		expect(validateEmail(`${"x".repeat(250)}@example.org`)).not.toBeNull();
		expect(validateEmail(" Truffe.Noire+jeu@Example.org ")).toBeNull();
		expect(validatePassword("court", EMAIL)).not.toBeNull();
		expect(validatePassword("azertyuiop", EMAIL)).not.toBeNull();
		expect(validatePassword("aaaaaaaaaaaa", EMAIL)).not.toBeNull();
		expect(validatePassword("ma-truffe.noire-42", EMAIL)).not.toBeNull();
		expect(validatePassword("x".repeat(129) + "abcd", EMAIL)).not.toBeNull();
		expect(validatePassword(PASSWORD, EMAIL)).toBeNull();
	});

	it("choisit la langue des messages selon les en-têtes", () => {
		expect(parseLanguage("en-GB,en;q=0.9,fr;q=0.8")).toBe("en");
		expect(parseLanguage("de-DE, fr-CA;q=0.7")).toBe("fr");
		expect(parseLanguage("*")).toBeNull();
		expect(parseLanguage(undefined)).toBeNull();
		expect(accountMessage("en", "tooManyMinutes", { minutes: 4 })).toBe(
			"Too many attempts. Try again in 4 minutes.",
		);
		expect(validatePassword("court", EMAIL)).toEqual({
			key: "passwordTooShort",
			params: { min: 10 },
		});
		expect(
			verificationEmail("a@example.org", "Morel", "https://x/", "en").subject,
		).toBe("Confirm your email address");
		expect(isDeleteConfirmation("SUPPRIMER")).toBe(true);
		expect(isDeleteConfirmation("DELETE")).toBe(true);
		expect(isDeleteConfirmation("delete")).toBe(false);
	});

	it("échappe le contenu des e-mails", () => {
		const message = verificationEmail(
			"a@example.org",
			"<img src=x onerror=alert(1)>",
			"https://mycelium.example/#verifier=jeton",
		);
		expect(message.html).not.toContain("<img");
		expect(message.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
		expect(message.text).toContain("https://mycelium.example/#verifier=jeton");
	});
});

describe("outils de sécurité", () => {
	it("limite les tentatives par fenêtre de temps", () => {
		const throttle = new Throttle(2, 1000);
		expect(throttle.hit("ip", 0)).toBe(0);
		expect(throttle.hit("ip", 10)).toBe(0);
		expect(throttle.hit("ip", 20)).toBe(980);
		expect(throttle.hit("autre", 20)).toBe(0);
		expect(throttle.hit("ip", 1001)).toBe(0);
		throttle.reset("ip");
		expect(throttle.retryAfter("ip", 1002)).toBe(0);
	});

	it("écrit des cookies de session stricts", () => {
		const local = serializeSessionCookie("jeton", {
			secure: false,
			maxAgeSeconds: 60,
		});
		expect(local).toBe(
			"mycelium_session=jeton; Path=/; Max-Age=60; HttpOnly; SameSite=Strict",
		);
		const secure = serializeSessionCookie("jeton", {
			secure: true,
			maxAgeSeconds: 60,
		});
		expect(secure.startsWith("__Host-mycelium_session=jeton")).toBe(true);
		expect(secure).toContain("; Secure");
		expect(
			readCookie("a=1; mycelium_session=xyz ; b=2", "mycelium_session"),
		).toBe("xyz");
		expect(readCookie("mycelium_session_old=1", "mycelium_session")).toBeNull();
		expect(readCookie(undefined, "mycelium_session")).toBeNull();
	});

	it("délie les sessions de jeu des comptes révoqués", () => {
		const sessions = new SessionRegistry();
		const a = sessions.hello("socket-a", null);
		const b = sessions.hello("socket-b", null);
		const c = sessions.hello("socket-c", null);
		a.account = { accountId: "compte-1", tokenHash: "h1" };
		b.account = { accountId: "compte-1", tokenHash: "h2" };
		c.account = { accountId: "compte-2", tokenHash: "h3" };
		sessions.revoke({
			kind: "account",
			accountId: "compte-1",
			keepTokenHash: "h2",
		});
		expect(a.account).toBeNull();
		expect(b.account?.tokenHash).toBe("h2");
		sessions.revoke({ kind: "session", tokenHash: "h3" });
		expect(c.account).toBeNull();
	});
});

describe("API des comptes", () => {
	it("inscrit après vérification de l'adresse, sans révéler les adresses existantes", async () => {
		const launched = await launch();
		const { database, mailer, agent } = launched;
		const alice = agent();

		expect((await alice.send("GET", "/me")).body).toEqual({
			enabled: true,
			discord: true,
			account: null,
		});

		const invalid = await alice.send("POST", "/register", {
			email: "pas-une-adresse",
			password: PASSWORD,
			displayName: "Truffe Noire",
			color: BLUE,
		});
		expect(invalid.status).toBe(400);
		expect(invalid.body?.field).toBe("email");
		const weak = await alice.send("POST", "/register", {
			email: EMAIL,
			password: "azertyuiop",
			displayName: "Truffe Noire",
			color: BLUE,
		});
		expect(weak.status).toBe(400);
		expect(weak.body?.field).toBe("password");
		expect(mailer.sent).toHaveLength(0);

		const badPattern = await alice.send("POST", "/register", {
			email: EMAIL,
			password: PASSWORD,
			displayName: "Truffe Noire",
			color: BLUE,
			pattern: "licorne",
		});
		expect(badPattern.status).toBe(400);
		expect(badPattern.body?.field).toBe("pattern");
		const registered = await alice.send("POST", "/register", {
			email: `  ${EMAIL} `,
			password: PASSWORD,
			displayName: "Truffe Noire",
			color: BLUE,
			pattern: "stars",
		});
		expect(registered.status).toBe(202);
		expect(registered.body).toEqual({ pending: true, email: EMAIL });
		expect(registered.cookies).toHaveLength(0);
		expect(mailer.sent).toHaveLength(1);
		const verification = mailer.last();
		expect(verification.to).toBe(EMAIL);
		expect(verification.subject).toContain("Confirmez");
		const token = mailer.token("verifier");
		expect(verification.text).toContain(`${PUBLIC_URL}/#verifier=${token}`);
		expect(verification.html).toContain(`${PUBLIC_URL}/#verifier=${token}`);

		const accounts = await database.query<{ total: number }>(
			"SELECT count(*)::int AS total FROM accounts",
		);
		expect(accounts.rows[0].total).toBe(0);
		const pending = await database.query<{
			token_hash: string;
			password_hash: string;
		}>("SELECT token_hash, password_hash FROM pending_registrations");
		expect(pending.rows).toHaveLength(1);
		expect(pending.rows[0].token_hash).toBe(sha256(token));
		expect(pending.rows[0].password_hash.startsWith("scrypt$")).toBe(true);
		expect(pending.rows[0].password_hash).not.toContain(PASSWORD);

		const early = await agent().send("POST", "/login", {
			email: EMAIL,
			password: PASSWORD,
		});
		expect(early.status).toBe(401);
		expect(
			(await alice.send("POST", "/verify-email", { token: "faux" })).status,
		).toBe(400);

		const verified = await alice.send("POST", "/verify-email", { token });
		expect(verified.status).toBe(201);
		const cookie = verified.cookies[0];
		expect(cookie).toMatch(/^mycelium_session=[A-Za-z0-9_-]{43}; /);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Strict");
		expect(cookie).toContain(`Max-Age=${SESSION_IDLE_MS / 1000}`);
		const account = verified.body?.account as Record<string, unknown>;
		expect(account).toMatchObject({
			email: EMAIL,
			displayName: "Truffe Noire",
			color: BLUE,
			pattern: "stars",
		});
		expect(Object.keys(account).sort()).toEqual([
			"challenges",
			"color",
			"createdAt",
			"discord",
			"displayName",
			"email",
			"hasPassword",
			"language",
			"lantern",
			"pattern",
			"privateProfile",
			"stats",
			"tagline",
			"termsAcceptedAt",
		]);
		expect(account).toMatchObject({
			privateProfile: false,
			hasPassword: true,
			discord: null,
			language: "fr",
		});
		expect((await alice.send("GET", "/me")).body?.account).toMatchObject({
			email: EMAIL,
		});
		expect(
			(await agent().send("POST", "/verify-email", { token })).status,
		).toBe(400);
		const stored = await database.query<{ email_verified_at: Date | null }>(
			"SELECT email_verified_at FROM accounts",
		);
		expect(stored.rows[0].email_verified_at).not.toBeNull();

		const again = await agent().send("POST", "/register", {
			email: EMAIL.toUpperCase(),
			password: "un-autre-mot-de-passe",
			displayName: "Imposteur",
			color: GREEN,
		});
		expect(again.status).toBe(202);
		expect(again.body).toEqual({ pending: true, email: EMAIL.toUpperCase() });
		expect(mailer.last().subject).toContain("existe déjà");
		expect(mailer.last().text).not.toMatch(/#verifier=/);
		const stillPending = await database.query<{ total: number }>(
			"SELECT count(*)::int AS total FROM pending_registrations",
		);
		expect(stillPending.rows[0].total).toBe(0);
		const intruder = await agent().send("POST", "/login", {
			email: EMAIL,
			password: "un-autre-mot-de-passe",
		});
		expect(intruder.status).toBe(401);

		const wrong = await agent().send("POST", "/login", {
			email: EMAIL.toLowerCase(),
			password: "mauvais-mot-de-passe",
		});
		const unknown = await agent().send("POST", "/login", {
			email: "personne@example.org",
			password: "mauvais-mot-de-passe",
		});
		expect(wrong.status).toBe(401);
		expect(wrong.body).toEqual({
			error: accountMessage("fr", "invalidCredentials"),
			code: "invalidCredentials",
		});
		expect(unknown.body).toEqual(wrong.body);
		const good = await agent().send("POST", "/login", {
			email: EMAIL.toLowerCase(),
			password: PASSWORD,
		});
		expect(good.status).toBe(200);
	});

	it("protège les requêtes et gère profil, mot de passe, déconnexion et suppression", async () => {
		const launched = await launch();
		const { database, mailer, agent } = launched;
		const alice = agent();
		await createAccount(launched, alice);

		const foreign = await alice.send(
			"POST",
			"/logout",
			{},
			{ Origin: "https://pirate.example" },
		);
		expect(foreign.status).toBe(403);
		const form = await alice.send("POST", "/logout", "a=b", {
			"Content-Type": "application/x-www-form-urlencoded",
		});
		expect(form.status).toBe(415);
		expect(
			(await alice.send("PATCH", "/profile", { displayName: "x".repeat(6000) }))
				.status,
		).toBe(413);
		expect((await alice.send("PATCH", "/profile", [1, 2])).status).toBe(400);
		expect(
			(await alice.send("PATCH", "/profile", { color: 0x123456 })).status,
		).toBe(400);
		expect(
			(await alice.send("PATCH", "/profile", { pattern: "licorne" })).body
				?.field,
		).toBe("pattern");
		const renamed = await alice.send("PATCH", "/profile", {
			displayName: "  Truffe   Royale ",
			color: GREEN,
			pattern: "swirl",
		});
		expect(renamed.body?.account).toMatchObject({
			displayName: "Truffe Royale",
			color: GREEN,
			pattern: "swirl",
		});
		expect((await alice.send("GET", "/me")).body?.account).toMatchObject({
			pattern: "swirl",
			termsAcceptedAt: null,
		});
		expect((await agent().send("POST", "/terms-acceptance", {})).status).toBe(
			401,
		);
		const acceptedDate = async () => {
			const { body } = await alice.send("POST", "/terms-acceptance", {});
			return (body?.account as AccountProfile | undefined)?.termsAcceptedAt;
		};
		const acceptedAt = await acceptedDate();
		expect(new Date(acceptedAt ?? "").getTime()).not.toBeNaN();
		expect(await acceptedDate()).toBe(acceptedAt);

		const laptop = agent();
		expect(
			(
				await laptop.send("POST", "/login", {
					email: EMAIL,
					password: PASSWORD,
				})
			).status,
		).toBe(200);
		expect(
			(
				await alice.send("POST", "/password", {
					currentPassword: "pas-le-bon-mot",
					newPassword: "nouvelles-spores-42",
				})
			).status,
		).toBe(403);
		const oldCookie = alice.cookie;
		const changed = await alice.send("POST", "/password", {
			currentPassword: PASSWORD,
			newPassword: "nouvelles-spores-42",
		});
		expect(changed.status).toBe(200);
		expect(alice.cookie).not.toBe(oldCookie);
		expect((await laptop.send("GET", "/history")).status).toBe(401);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mailer.last().subject).toContain("modifié");
		expect((await alice.send("GET", "/history")).body).toEqual({ entries: [] });

		const loggedOut = await alice.send("POST", "/logout", {});
		expect(loggedOut.status).toBe(204);
		expect(loggedOut.cookies[0]).toContain("Max-Age=0");
		expect(
			(
				await alice.send("POST", "/login", {
					email: EMAIL,
					password: "nouvelles-spores-42",
				})
			).status,
		).toBe(200);
		expect(
			(await alice.send("DELETE", "", { password: PASSWORD })).status,
		).toBe(403);
		expect(
			(await alice.send("DELETE", "", { password: "nouvelles-spores-42" }))
				.status,
		).toBe(204);
		const counts = await database.query<{ accounts: number; sessions: number }>(
			"SELECT (SELECT count(*) FROM accounts)::int AS accounts, (SELECT count(*) FROM auth_sessions)::int AS sessions",
		);
		expect(counts.rows[0]).toEqual({ accounts: 0, sessions: 0 });
	});

	it("réinitialise un mot de passe oublié par un lien à usage unique", async () => {
		const launched = await launch();
		const { mailer, agent } = launched;
		const owner = agent();
		await createAccount(launched, owner);
		const before = mailer.sent.length;

		const unknown = await agent().send("POST", "/password-reset/request", {
			email: "inconnu@example.org",
		});
		expect(unknown.status).toBe(202);
		const known = await agent().send("POST", "/password-reset/request", {
			email: EMAIL.toLowerCase(),
		});
		expect(known.status).toBe(202);
		expect(known.body).toEqual(unknown.body);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mailer.sent).toHaveLength(before + 1);
		expect(mailer.last().to).toBe(EMAIL);
		const token = mailer.token("reinitialiser");
		expect(mailer.last().text).toContain(
			`${PUBLIC_URL}/#reinitialiser=${token}`,
		);

		const browser = agent();
		const weak = await browser.send("POST", "/password-reset/confirm", {
			token,
			newPassword: "azertyuiop",
		});
		expect(weak.status).toBe(400);
		expect(weak.body?.field).toBe("newPassword");
		const reset = await browser.send("POST", "/password-reset/confirm", {
			token,
			newPassword: "spores-retrouvees-7",
		});
		expect(reset.status).toBe(200);
		expect(browser.cookie).not.toBeNull();
		expect((await owner.send("GET", "/history")).status).toBe(401);
		expect(
			(
				await agent().send("POST", "/password-reset/confirm", {
					token,
					newPassword: "encore-un-autre-9",
				})
			).status,
		).toBe(400);
		expect(
			(
				await agent().send("POST", "/login", {
					email: EMAIL,
					password: PASSWORD,
				})
			).status,
		).toBe(401);
		expect(
			(
				await agent().send("POST", "/login", {
					email: EMAIL,
					password: "spores-retrouvees-7",
				})
			).status,
		).toBe(200);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(mailer.last().subject).toContain("modifié");
	});

	it(`limite à ${MAILS_PER_ADDRESS} e-mails par heure et par adresse`, async () => {
		const { mailer, agent } = await launch();
		for (let attempt = 0; attempt < MAILS_PER_ADDRESS + 1; attempt += 1) {
			const reply = await agent().send("POST", "/register", {
				email: "cible@example.org",
				password: PASSWORD,
				displayName: "Cible",
				color: BLUE,
			});
			expect(reply.status).toBe(202);
		}
		expect(mailer.sent).toHaveLength(MAILS_PER_ADDRESS);
	});

	it("bloque les essais répétés sur un même compte", async () => {
		const launched = await launch();
		await createAccount(launched, launched.agent(), "morille@example.org");
		const attacker = launched.agent();
		for (let attempt = 0; attempt < 6; attempt += 1) {
			const reply = await attacker.send("POST", "/login", {
				email: "morille@example.org",
				password: `essai-numero-${attempt}`,
			});
			expect(reply.status).toBe(401);
		}
		const blocked = await attacker.send("POST", "/login", {
			email: "Morille@Example.org",
			password: PASSWORD,
		});
		expect(blocked.status).toBe(429);
		expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
		expect(attacker.cookie).toBeNull();
	});

	it("répond et écrit en anglais quand le joueur a choisi l'anglais", async () => {
		const { agent, mailer } = await launch();
		const english = agent();
		const wrong = await english.send(
			"POST",
			"/login",
			{ email: EMAIL, password: "mauvais-mot-de-passe" },
			{ "X-Mycelium-Lang": "en" },
		);
		expect(wrong.body).toEqual({
			error: "Incorrect email address or password.",
			code: "invalidCredentials",
		});
		const browser = await agent().send(
			"POST",
			"/register",
			{
				email: "a@example",
				password: PASSWORD,
				displayName: "Morel",
				color: BLUE,
			},
			{ "Accept-Language": "en-US,en;q=0.8" },
		);
		expect(browser.body).toMatchObject({
			error: "Invalid email address.",
			field: "email",
		});
		const registered = await english.send(
			"POST",
			"/register",
			{
				email: "morel@example.org",
				password: PASSWORD,
				displayName: "Bold Morel",
				color: BLUE,
			},
			{ "X-Mycelium-Lang": "en", "Accept-Language": "fr" },
		);
		expect(registered.status).toBe(202);
		const message = mailer.last("morel@example.org");
		expect(message.subject).toBe("Confirm your email address");
		expect(message.html).toContain('<html lang="en">');
		expect(message.text).toContain("Welcome, Bold Morel!");
		const verified = await english.send("POST", "/verify-email", {
			token: mailer.token("verifier", "morel@example.org"),
		});
		expect(verified.status).toBe(201);
		expect(verified.body?.account).toMatchObject({ language: "en" });
		const refused = await english.send(
			"DELETE",
			"",
			{ password: "mauvais-mot-de-passe" },
			{ "X-Mycelium-Lang": "en" },
		);
		expect(refused.body).toMatchObject({
			error: "Incorrect password.",
			code: "passwordWrong",
		});
	});

	it("enregistre la langue sur le compte et écrit les e-mails du compte dans cette langue", async () => {
		const { agent, mailer } = await launch();
		const browser = agent();
		const registered = await browser.send(
			"POST",
			"/register",
			{
				email: "cepe@example.org",
				password: PASSWORD,
				displayName: "Cèpe",
				color: BLUE,
				language: "en",
			},
			{ "X-Mycelium-Lang": "fr" },
		);
		expect(registered.status).toBe(202);
		expect(mailer.last("cepe@example.org").subject).toBe(
			"Confirm your email address",
		);
		const verified = await browser.send("POST", "/verify-email", {
			token: mailer.token("verifier", "cepe@example.org"),
		});
		expect(verified.body?.account).toMatchObject({ language: "en" });
		const invalid = await browser.send("PATCH", "/profile", {
			language: "klingon",
		});
		expect(invalid.status).toBe(400);
		expect(invalid.body?.field).toBe("language");
		const invalidAtRegistration = await agent().send("POST", "/register", {
			email: "autre@example.org",
			password: PASSWORD,
			displayName: "Autre",
			color: BLUE,
			language: "de",
		});
		expect(invalidAtRegistration.body?.field).toBe("language");

		await agent().send(
			"POST",
			"/password-reset/request",
			{ email: "cepe@example.org" },
			{ "X-Mycelium-Lang": "fr" },
		);
		expect(mailer.last("cepe@example.org").subject).toBe("Reset your password");
		const switched = await browser.send("PATCH", "/profile", {
			language: "fr",
		});
		expect(switched.body?.account).toMatchObject({
			language: "fr",
			displayName: "Cèpe",
		});
		expect((await browser.send("GET", "/me")).body?.account).toMatchObject({
			language: "fr",
		});
		await agent().send(
			"POST",
			"/password-reset/request",
			{ email: "cepe@example.org" },
			{ "X-Mycelium-Lang": "en" },
		);
		expect(mailer.last("cepe@example.org").subject).toBe(
			"Réinitialisation de votre mot de passe",
		);
	});

	it("refuse les inscriptions sans envoi d'e-mail ni adresse publique configurés", async () => {
		const withoutMail = await launch({ mailer: null });
		const reply = await withoutMail.agent().send("POST", "/register", {
			email: "a@example.org",
			password: PASSWORD,
			displayName: "Sans mail",
			color: BLUE,
		});
		expect(reply.status).toBe(503);
		expect(reply.body).toEqual({
			error: accountMessage("fr", "mailUnavailable"),
			code: "mailUnavailable",
		});
		const withoutUrl = await launch({ publicUrl: null });
		const second = await withoutUrl
			.agent()
			.send("POST", "/password-reset/request", {
				email: "a@example.org",
			});
		expect(second.status).toBe(503);
		expect(withoutUrl.mailer.sent).toHaveLength(0);
	});

	it("signale des comptes désactivés sans base de données", async () => {
		const server = await startServer({ port: 0, dev: false, database: null });
		running.push(server);
		const origin = `http://127.0.0.1:${server.port}`;
		const visitor = new Agent(`${origin}/api/account`, origin);
		expect((await visitor.send("GET", "/me")).body).toEqual({
			enabled: false,
			discord: false,
			account: null,
		});
		const login = await visitor.send("POST", "/login", {
			email: "a@example.org",
			password: PASSWORD,
		});
		expect(login.status).toBe(503);
	});
});

describe("connexion avec Discord", () => {
	async function discordFlow(
		agent: Agent,
		mode: "login" | "link",
		code: string,
		language?: string,
	) {
		const query = new URLSearchParams({
			mode,
			...(language ? { lang: language } : {}),
		});
		const start = await agent.send("GET", `/discord/start?${query.toString()}`);
		const location = new URL(start.headers.get("location") ?? `${PUBLIC_URL}/`);
		const state = location.searchParams.get("state") ?? "";
		const callback = await agent.send(
			"GET",
			`/discord/callback?${new URLSearchParams({ code, state })}`,
		);
		return {
			start,
			location,
			state,
			callback,
			outcome: new URL(callback.headers.get("location") ?? `${PUBLIC_URL}/`)
				.hash,
		};
	}

	it("crée un compte avec Discord puis le reconnecte, avec un état à usage unique", async () => {
		const { discord, agent } = await launch();
		discord.profiles.set(
			"code-clyde",
			discordProfile("80351110224678912", "clyde", "clyde@example.org"),
		);
		const browser = agent();
		const flow = await discordFlow(browser, "login", "code-clyde");
		expect(flow.start.status).toBe(303);
		expect(flow.location.host).toBe("discord.test");
		expect(flow.location.searchParams.get("redirect_uri")).toBe(
			`${PUBLIC_URL}/api/account/discord/callback`,
		);
		const stateCookie = flow.start.cookies.find((cookie) =>
			cookie.startsWith("mycelium_oauth="),
		) as string;
		expect(stateCookie).toContain("HttpOnly");
		expect(stateCookie).toContain("SameSite=Lax");
		expect(flow.callback.status).toBe(303);
		expect(flow.callback.headers.get("location")).toBe(
			`${PUBLIC_URL}/#discord=cree`,
		);
		expect(discord.lastRedirect).toBe(
			`${PUBLIC_URL}/api/account/discord/callback`,
		);
		expect(browser.jar.has("mycelium_oauth")).toBe(false);
		const me = await browser.send("GET", "/me");
		expect(me.body?.account).toMatchObject({
			email: "clyde@example.org",
			displayName: "clyde",
			hasPassword: false,
			discord: {
				username: "clyde",
				avatarUrl:
					"https://cdn.discordapp.com/avatars/80351110224678912/a1b2c3d4e5f60718293a4b5c6d7e8f90.png?size=64",
			},
		});

		const replay = await browser.send(
			"GET",
			`/discord/callback?${new URLSearchParams({ code: "code-clyde", state: flow.state })}`,
		);
		expect(replay.headers.get("location")).toBe(
			`${PUBLIC_URL}/#discord=erreur-etat`,
		);
		const stolen = await agent().send("GET", "/discord/start?mode=login");
		const stolenState = new URL(
			stolen.headers.get("location") ?? `${PUBLIC_URL}/`,
		).searchParams.get("state") as string;
		const forged = await agent().send(
			"GET",
			`/discord/callback?${new URLSearchParams({ code: "code-clyde", state: stolenState })}`,
		);
		expect(forged.headers.get("location")).toBe(
			`${PUBLIC_URL}/#discord=erreur-etat`,
		);

		const again = await discordFlow(agent(), "login", "code-clyde");
		expect(again.outcome).toBe("#discord=connecte");
		const cancelled = agent();
		const start = await cancelled.send("GET", "/discord/start?mode=login");
		const state = new URL(
			start.headers.get("location") ?? `${PUBLIC_URL}/`,
		).searchParams.get("state") as string;
		const denied = await cancelled.send(
			"GET",
			`/discord/callback?${new URLSearchParams({ error: "access_denied", state })}`,
		);
		expect(denied.headers.get("location")).toBe(
			`${PUBLIC_URL}/#discord=annule`,
		);

		expect(
			(
				await agent().send("POST", "/login", {
					email: "clyde@example.org",
					password: PASSWORD,
				})
			).status,
		).toBe(401);
		const noPassword = await browser.send("POST", "/password", {
			currentPassword: PASSWORD,
			newPassword: "nouvelles-spores-42",
		});
		expect(noPassword.status).toBe(400);
		expect((await browser.send("POST", "/discord/unlink", {})).status).toBe(
			409,
		);
		expect(
			(await browser.send("DELETE", "", { confirmation: "non" })).status,
		).toBe(403);
		expect(
			(await browser.send("DELETE", "", { confirmation: "DELETE" })).status,
		).toBe(204);
	});

	it("lie et délie Discord sans jamais fusionner automatiquement deux comptes", async () => {
		const launched = await launch();
		const { discord, agent } = launched;
		const alice = agent();
		await createAccount(launched, alice);
		discord.profiles.set(
			"code-alice",
			discordProfile("111111111111111111", "alice_dc", EMAIL),
		);
		discord.profiles.set(
			"code-solo",
			discordProfile("222222222222222222", "solo", null),
		);

		const merge = await discordFlow(agent(), "login", "code-alice");
		expect(merge.outcome).toBe("#discord=email-existant");
		expect(
			merge.callback.cookies.some((cookie) =>
				cookie.startsWith("mycelium_session="),
			),
		).toBe(false);

		const anonymous = await agent().send("GET", "/discord/start?mode=link");
		expect(anonymous.headers.get("location")).toBe(
			`${PUBLIC_URL}/#discord=erreur-session`,
		);
		const linked = await discordFlow(alice, "link", "code-alice");
		expect(linked.outcome).toBe("#discord=lie");
		expect((await alice.send("GET", "/me")).body?.account).toMatchObject({
			email: EMAIL,
			discord: { username: "alice_dc" },
		});
		const viaDiscord = agent();
		expect((await discordFlow(viaDiscord, "login", "code-alice")).outcome).toBe(
			"#discord=connecte",
		);
		expect((await viaDiscord.send("GET", "/me")).body?.account).toMatchObject({
			email: EMAIL,
		});

		const solo = agent();
		expect((await discordFlow(solo, "login", "code-solo")).outcome).toBe(
			"#discord=cree",
		);
		expect((await solo.send("GET", "/me")).body?.account).toMatchObject({
			email: null,
			hasPassword: false,
		});
		expect((await discordFlow(solo, "link", "code-alice")).outcome).toBe(
			"#discord=deja-lie",
		);
		expect((await solo.send("POST", "/discord/unlink", {})).status).toBe(409);

		const unlinked = await alice.send("POST", "/discord/unlink", {});
		expect(unlinked.status).toBe(200);
		expect(unlinked.body?.account).toMatchObject({ discord: null });
	});

	it("signale Discord indisponible sans configuration", async () => {
		const { agent } = await launch({ discord: null });
		const visitor = agent();
		expect((await visitor.send("GET", "/me")).body).toMatchObject({
			discord: false,
		});
		const start = await visitor.send("GET", "/discord/start?mode=login");
		expect(start.headers.get("location")).toBe(
			`${PUBLIC_URL}/#discord=indisponible`,
		);
	});

	it("prend la langue du compte Discord à la création, puis garde celle du compte", async () => {
		const { discord, agent } = await launch();
		discord.profiles.set(
			"code-us",
			discordProfile(
				"333333333333333333",
				"morel",
				"morel@example.org",
				"en-US",
			),
		);
		discord.profiles.set(
			"code-fr",
			discordProfile("444444444444444444", "girolle", null, "fr"),
		);
		discord.profiles.set(
			"code-de",
			discordProfile("555555555555555555", "pfiffer", null, "de"),
		);
		const american = agent();
		expect(
			(await discordFlow(american, "login", "code-us", "fr")).outcome,
		).toBe("#discord=cree");
		expect((await american.send("GET", "/me")).body?.account).toMatchObject({
			language: "en",
		});
		const french = agent();
		await discordFlow(french, "login", "code-fr", "en");
		expect((await french.send("GET", "/me")).body?.account).toMatchObject({
			language: "fr",
		});
		const german = agent();
		await discordFlow(german, "login", "code-de", "en");
		expect((await german.send("GET", "/me")).body?.account).toMatchObject({
			language: "en",
		});

		expect(
			(await american.send("PATCH", "/profile", { language: "fr" })).status,
		).toBe(200);
		const again = agent();
		expect((await discordFlow(again, "login", "code-us", "en")).outcome).toBe(
			"#discord=connecte",
		);
		expect((await again.send("GET", "/me")).body?.account).toMatchObject({
			language: "fr",
		});
	});

	it("valide strictement le profil renvoyé par Discord", () => {
		expect(() => parseDiscordUser({ username: "sans-id" })).toThrow();
		expect(() =>
			parseDiscordUser({ id: "12<script>", username: "x" }),
		).toThrow();
		const unverified = parseDiscordUser({
			id: "123456789",
			username: "pseudo",
			global_name: "Pseudo Affiché",
			email: "pseudo@example.org",
			verified: false,
		});
		expect(unverified).toMatchObject({
			displayName: "Pseudo Affiché",
			email: "pseudo@example.org",
			emailVerified: false,
			locale: null,
		});
		expect(
			parseDiscordUser({ id: "123456789", username: "pseudo", locale: "en-GB" })
				.locale,
		).toBe("en-GB");
	});
});

describe("historique et sessions", () => {
	async function serviceWithClock() {
		const database = await createTestDatabase();
		await migrate(database);
		let now = Date.parse("2026-03-01T12:00:00Z");
		const mailer = new MemoryMailer();
		const service = new AccountService(database, {
			scrypt: FAST_SCRYPT,
			now: () => now,
			mailer,
		});
		const advance = (ms: number) => {
			now += ms;
		};
		const create = async (email: string) => {
			const registered = await service.register(
				{ email, password: PASSWORD, displayName: "Girolle", color: BLUE },
				PUBLIC_URL,
			);
			if (!registered.ok) {
				throw new Error(registered.problem.key);
			}
			const verified = await service.verifyEmail(
				mailer.token("verifier", email),
			);
			if (!verified.ok) {
				throw new Error(verified.problem.key);
			}
			return verified.value.token;
		};
		const token = await create("girolle@example.org");
		return { database, service, mailer, token, advance, create };
	}

	it("classe le défi du jour en gardant le meilleur score de chacun", async () => {
		const { database, service, token, create } = await serviceWithClock();
		try {
			const first = await service.authenticate(token);
			const other = await service.authenticate(
				await create("cepe@example.org"),
			);
			if (!first || !other) {
				throw new Error("Session should not be null");
			}
			const play = (
				accountId: string,
				matchId: string,
				score: number,
				awarded = false,
			) =>
				service.recordMatch({
					accountId,
					matchId,
					playedAt: new Date("2026-03-02T10:00:00Z"),
					durationMs: 480_000,
					visibility: "private",
					playerName: accountId === first.accountId ? "Girolle" : "Cepe",
					color: BLUE,
					rank: 1,
					playerCount: 1,
					score,
					captures: 2,
					deaths: 0,
					won: true,
					awarded,
					dailyDate: "2026-03-02",
					pattern: "stars",
				});
			await play(first.accountId, "d1", 300, true);
			await play(first.accountId, "d2", 100);
			await play(other.accountId, "d3", 500);
			const board = await service.dailyBoard("2026-03-02", first.accountId);
			expect(board.entries.map((entry) => [entry.name, entry.score])).toEqual([
				["Cepe", 500],
				["Girolle", 300],
			]);
			expect(board.me).toMatchObject({ rank: 2, score: 300, self: true });
			expect(
				(await service.dailyBoard("2026-03-03", first.accountId)).entries,
			).toEqual([]);
			const profile = await service.profile(first.accountId);
			expect(profile?.stats).toMatchObject({
				dailies: 1,
				awards: 1,
				captures: 4,
			});
			expect(profile?.challenges).toEqual({});
			await service.recordMatch({
				accountId: first.accountId,
				matchId: "c1",
				playedAt: new Date("2026-03-02T11:00:00Z"),
				durationMs: 480_000,
				visibility: "private",
				playerName: "Girolle",
				color: BLUE,
				rank: 1,
				playerCount: 2,
				score: 10,
				captures: 3,
				deaths: 0,
				won: true,
				metrics: { captures: 3, games: 1 },
			});
			await service.recordMatch({
				accountId: first.accountId,
				matchId: "c2",
				playedAt: new Date("2026-03-02T12:00:00Z"),
				durationMs: 480_000,
				visibility: "private",
				playerName: "Girolle",
				color: BLUE,
				rank: 1,
				playerCount: 2,
				score: 10,
				captures: 1,
				deaths: 0,
				won: true,
				metrics: { captures: 1, games: 1 },
			});
			expect((await service.profile(first.accountId))?.challenges).toEqual({
				captures: { total: 4, best: 3 },
				games: { total: 2, best: 1 },
			});
		} finally {
			await database.close();
		}
	});

	it("refuse un motif ou une lanterne pas encore débloqués", async () => {
		const { database, service, token } = await serviceWithClock();
		try {
			const session = await service.authenticate(token);
			if (!session) {
				throw new Error("Session should not be null");
			}
			expect(
				(await service.updateProfile(session.accountId, { pattern: "crown" }))
					.ok,
			).toBe(false);
			expect(
				(await service.updateProfile(session.accountId, { lantern: "violet" }))
					.ok,
			).toBe(false);
			expect(
				(await service.updateProfile(session.accountId, { pattern: "stars" }))
					.ok,
			).toBe(true);
			const lantern = await service.updateProfile(session.accountId, {
				lantern: "amber",
			});
			expect(lantern.ok && lantern.value.lantern).toBe("amber");
			expect(
				(
					await service.updateProfile(session.accountId, {
						pattern: "lightning",
					})
				).ok,
			).toBe(false);
			await service.recordMatch({
				accountId: session.accountId,
				matchId: "m_sprint",
				playedAt: new Date("2026-03-02T10:00:00Z"),
				durationMs: 480_000,
				visibility: "private",
				playerName: "Girolle",
				color: BLUE,
				rank: 1,
				playerCount: 2,
				score: 10,
				captures: 0,
				deaths: 0,
				won: false,
				metrics: { sprintMeters: 500 },
			});
			expect(
				(
					await service.updateProfile(session.accountId, {
						pattern: "lightning",
					})
				).ok,
			).toBe(true);
		} finally {
			await database.close();
		}
	});

	it("reprend les parties déjà jouées dans la progression des défis", async () => {
		const { database, service, token } = await serviceWithClock();
		try {
			const session = await service.authenticate(token);
			if (!session) {
				throw new Error("Session should not be null");
			}
			await database.query(
				"ALTER TABLE accounts DROP COLUMN challenge_progress",
			);
			await database.query(
				"UPDATE accounts SET games_played = 26, wins = 4, total_captures = 11 WHERE id = $1",
				[session.accountId],
			);
			for (const statement of MIGRATIONS.find(
				(migration) => migration.version === 9,
			)?.statements ?? []) {
				await database.query(statement);
			}
			const profile = await service.profile(session.accountId);
			expect(profile?.challenges).toEqual({
				games: { total: 26, best: 1 },
				wins: { total: 4, best: 1 },
				captures: { total: 11, best: 1 },
				dailies: { total: 0, best: 0 },
			});
			expect(
				(await service.updateProfile(session.accountId, { pattern: "web" })).ok,
			).toBe(true);
		} finally {
			await database.close();
		}
	});

	it("montre un profil public avec le niveau, sans email ni réglages", async () => {
		const { database, service, token } = await serviceWithClock();
		try {
			const session = await service.authenticate(token);
			if (!session) {
				throw new Error("Session should not be null");
			}
			const won = await service.recordMatch({
				accountId: session.accountId,
				matchId: "m_public",
				playedAt: new Date("2026-03-01T12:30:00Z"),
				durationMs: 480_000,
				visibility: "public",
				playerName: "Girolle",
				color: BLUE,
				rank: 1,
				playerCount: 4,
				score: 1_500,
				captures: 3,
				deaths: 0,
				won: true,
				xp: matchXp({ score: 1_500, won: true }),
			});
			expect(won).toBe(true);
			const profile = await service.publicProfile(session.accountId);
			expect(profile).toMatchObject({
				profileId: session.accountId,
				displayName: "Girolle",
				stats: { gamesPlayed: 1, wins: 1, xp: 40 + 150 + 60 },
				recent: [{ rank: 1, playerCount: 4, score: 1_500, won: true }],
			});
			const text = JSON.stringify(profile);
			expect(text).not.toContain("@");
			expect(text).not.toContain("language");
			expect((await service.history(session.accountId))[0].xp).toBe(250);
			expect(await service.publicProfile("pas-un-identifiant")).toBeNull();
			expect(
				await service.publicProfile("00000000-0000-4000-8000-000000000000"),
			).toBeNull();
		} finally {
			await database.close();
		}
	});

	it("réserve un profil privé au joueur et à ses amis", async () => {
		const { database, service, token, create } = await serviceWithClock();
		try {
			const owner = await service.authenticate(token);
			const friend = await service.authenticate(
				await create("cepe@example.org"),
			);
			const stranger = await service.authenticate(
				await create("morille@example.org"),
			);
			if (!owner || !friend || !stranger) {
				throw new Error("Session should not be null");
			}
			await service.recordMatch({
				accountId: owner.accountId,
				matchId: "m_secret",
				playedAt: new Date("2026-03-01T12:30:00Z"),
				durationMs: 480_000,
				visibility: "public",
				playerName: "Girolle",
				color: BLUE,
				rank: 1,
				playerCount: 4,
				score: 1_500,
				captures: 3,
				deaths: 0,
				won: true,
				xp: matchXp({ score: 1_500, won: true }),
			});
			expect(
				(
					await service.updateProfile(owner.accountId, {
						privateProfile: "oui",
					})
				).ok,
			).toBe(false);
			const updated = await service.updateProfile(owner.accountId, {
				privateProfile: true,
			});
			expect(updated.ok && updated.value.privateProfile).toBe(true);
			expect(updated.ok && updated.value.displayName).toBe("Girolle");

			const hidden = {
				private: true,
				displayName: "Girolle",
				level: levelOf(250),
				createdAt: null,
				stats: null,
				recent: [],
			};
			expect(await service.publicProfile(owner.accountId)).toMatchObject(
				hidden,
			);
			expect(
				await service.publicProfile(owner.accountId, stranger.accountId),
			).toMatchObject(hidden);

			const shown = {
				private: true,
				stats: { gamesPlayed: 1, xp: 250 },
				recent: [{ score: 1_500 }],
			};
			expect(
				await service.publicProfile(owner.accountId, owner.accountId),
			).toMatchObject(shown);
			const [low, high] = [owner.accountId, friend.accountId].sort();
			await database.query(
				`INSERT INTO friendships (account_low, account_high, requester_id, status, created_at)
         VALUES ($1, $2, $1, 'pending', now())`,
				[low, high],
			);
			expect(
				await service.publicProfile(owner.accountId, friend.accountId),
			).toMatchObject(hidden);
			await database.query(
				"UPDATE friendships SET status = 'accepted' WHERE account_low = $1 AND account_high = $2",
				[low, high],
			);
			expect(
				await service.publicProfile(owner.accountId, friend.accountId),
			).toMatchObject(shown);

			await service.updateProfile(owner.accountId, { privateProfile: false });
			expect(
				await service.publicProfile(owner.accountId, stranger.accountId),
			).toMatchObject({ private: false, stats: { gamesPlayed: 1 } });
		} finally {
			await database.close();
		}
	});

	it("garde le classement détaillé d'une partie, lisible par ses seuls joueurs", async () => {
		const { database, service, token, create } = await serviceWithClock();
		try {
			const first = await service.authenticate(token);
			const other = await service.authenticate(
				await create("cepe@example.org"),
			);
			if (!first || !other) {
				throw new Error("Session should not be null");
			}
			const results: MatchResults = {
				matchId: "m_detail",
				durationMs: 960_000,
				winnerId: "p1",
				teams: [],
				winnerTeam: null,
				awards: [{ playerId: "p2", id: "hider", value: 95.4 }],
				highlights: [],
				daily: null,
				metrics: { p1: { fragments: 12, sprintMeters: 340 } },
				entries: [
					{
						playerId: "p1",
						name: "Girolle",
						score: 300,
						captures: 2,
						deaths: 0,
						color: BLUE,
						pattern: "stars",
						tagline: "cat",
						team: null,
					},
					{
						playerId: "p2",
						name: "Invité",
						score: 100,
						captures: 1,
						deaths: 1,
						color: GREEN,
						team: null,
					},
				],
			};
			const [record] = buildMatchRecords(
				results,
				"public",
				new Map([
					["p1", first.accountId],
					["p2", null],
				]),
				new Date("2026-03-04T20:00:00Z"),
				{
					...PUBLIC_MATCH_CONFIG,
					teamCount: 0,
				},
			);
			expect(await service.recordMatch(record)).toBe(true);
			const [entry] = await service.history(first.accountId);
			expect(entry).toMatchObject({
				matchId: "m_detail",
				hasDetails: true,
				teamCount: 0,
				daily: null,
				rank: 1,
			});
			const detail = await service.historyDetail(first.accountId, "m_detail");
			expect(detail?.players).toEqual([
				expect.objectContaining({
					profileId: first.accountId,
					name: "Girolle",
					self: true,
					tagline: "cat",
					pattern: "stars",
					awards: [],
				}),
				expect.objectContaining({
					profileId: null,
					name: "Invité",
					self: false,
					tagline: null,
					awards: [{ id: "hider", value: 95 }],
				}),
			]);
			expect(detail?.metrics).toEqual({ fragments: 12, sprintMeters: 340 });
			expect(detail?.rules).toMatchObject({ manorSize: "medium", floors: 1 });
			expect(JSON.stringify(detail)).not.toContain("@");
			expect(JSON.stringify(detail)).not.toContain(token);
			expect(
				await service.historyDetail(other.accountId, "m_detail"),
			).toBeNull();
			expect(
				await service.historyDetail(first.accountId, "../m_detail"),
			).toBeNull();
		} finally {
			await database.close();
		}
	});

	it("n'accepte une devise sur le profil qu'une fois débloquée", async () => {
		const { database, service, token } = await serviceWithClock();
		try {
			const session = await service.authenticate(token);
			if (!session) {
				throw new Error("Session should not be null");
			}
			const locked = await service.updateProfile(session.accountId, {
				tagline: "immortal",
			});
			expect(locked.ok).toBe(false);
			expect(
				(await service.updateProfile(session.accountId, { tagline: "nope" }))
					.ok,
			).toBe(false);
			await database.query(
				`UPDATE accounts SET challenge_progress = '{"flawless":{"total":1,"best":1}}' WHERE id = $1`,
				[session.accountId],
			);
			const unlocked = await service.updateProfile(session.accountId, {
				tagline: "immortal",
			});
			expect(unlocked.ok && unlocked.value.tagline).toBe("immortal");
			const cleared = await service.updateProfile(session.accountId, {
				tagline: null,
			});
			expect(cleared.ok && cleared.value.tagline).toBeNull();
		} finally {
			await database.close();
		}
	});

	it(`ne garde que les ${MATCH_HISTORY_LIMIT} dernières parties et cumule les statistiques`, async () => {
		const { database, service, token } = await serviceWithClock();
		try {
			const session = await service.authenticate(token);
			if (!session) {
				throw new Error("Session should not be null");
			}
			const accountId = session.accountId;
			const base = Date.parse("2026-03-02T10:00:00Z");
			for (let index = 0; index < 30; index += 1) {
				const record: MatchRecord = {
					accountId,
					matchId: `m_${index}`,
					playedAt: new Date(base + index * 60_000),
					durationMs: 480_000,
					visibility: index % 2 === 0 ? "public" : "private",
					playerName: "Girolle",
					color: BLUE,
					rank: index % 3 === 0 ? 1 : 2,
					playerCount: 3,
					score: index * 10,
					captures: index % 4,
					deaths: 1,
					won: index % 3 === 0,
					xp: matchXp({ score: index * 10, won: index % 3 === 0 }),
				};
				expect(await service.recordMatch(record)).toBe(true);
			}
			expect(
				await service.recordMatch({
					accountId,
					matchId: "m_29",
					playedAt: new Date(base),
					durationMs: 1,
					visibility: "public",
					playerName: "Doublon",
					color: BLUE,
					rank: 1,
					playerCount: 1,
					score: 9999,
					captures: 0,
					deaths: 0,
					won: true,
				}),
			).toBe(false);
			const history = await service.history(accountId);
			expect(history).toHaveLength(MATCH_HISTORY_LIMIT);
			expect(history[0].matchId).toBe("m_29");
			expect((history.at(-1) as MatchHistoryEntry).matchId).toBe("m_5");
			expect(history[0]).toMatchObject({
				visibility: "private",
				score: 290,
				rank: 2,
				won: false,
			});
			const profile = await service.profile(accountId);
			expect(profile?.stats).toEqual({
				gamesPlayed: 30,
				wins: 10,
				bestScore: 290,
				totalScore: 4350,
				captures: 43,
				dailies: 0,
				awards: 0,
				xp: 40 * 30 + 435 + 60 * 10,
			});
			const rows = await database.query<{ total: number }>(
				"SELECT count(*)::int AS total FROM match_history",
			);
			expect(rows.rows[0].total).toBe(MATCH_HISTORY_LIMIT);
		} finally {
			await database.close();
		}
	});

	it("fait expirer les sessions inactives et trop anciennes", async () => {
		const { database, service, token, advance } = await serviceWithClock();
		try {
			advance(20 * 24 * 3600_000);
			expect(await service.authenticate(token)).toMatchObject({
				refreshed: true,
			});
			advance(25 * 24 * 3600_000);
			expect(await service.authenticate(token)).not.toBeNull();
			advance(31 * 24 * 3600_000);
			expect(await service.authenticate(token)).toBeNull();
			expect(await service.authenticate("jeton-invalide")).toBeNull();

			const fresh = (await service.login(
				"GIROLLE@example.org",
				PASSWORD,
			)) as IssuedSession;
			for (let day = 0; day < 80; day += 20) {
				advance(20 * 24 * 3600_000);
				expect(await service.authenticate(fresh.token)).not.toBeNull();
			}
			advance(20 * 24 * 3600_000);
			expect(await service.authenticate(fresh.token)).toBeNull();
		} finally {
			await database.close();
		}
	});

	it("fait expirer les liens de confirmation et de réinitialisation", async () => {
		const { database, service, mailer, advance } = await serviceWithClock();
		try {
			await service.register(
				{
					email: "lente@example.org",
					password: PASSWORD,
					displayName: "Lente",
					color: BLUE,
				},
				PUBLIC_URL,
			);
			const late = mailer.token("verifier", "lente@example.org");
			advance(REGISTRATION_TTL_MS + 1000);
			expect(await service.verifyEmail(late)).toMatchObject({
				ok: false,
				status: 400,
			});
			expect(await service.login("lente@example.org", PASSWORD)).toBeNull();

			await service.requestPasswordReset("girolle@example.org", PUBLIC_URL);
			await new Promise((resolve) => setTimeout(resolve, 20));
			const reset = mailer.token("reinitialiser", "girolle@example.org");
			advance(RESET_TTL_MS + 1000);
			expect(
				await service.resetPassword(reset, "jamais-applique-3", PUBLIC_URL),
			).toMatchObject({
				ok: false,
				status: 400,
			});
			expect(
				await service.login("girolle@example.org", PASSWORD),
			).not.toBeNull();
		} finally {
			await database.close();
		}
	});

	it("relie un cookie de session au compte pour le serveur de jeu", async () => {
		const database = await createTestDatabase();
		const mailer = new MemoryMailer();
		const module = new AccountModule(database, false, {
			scrypt: FAST_SCRYPT,
			mailer,
		});
		await module.start();
		try {
			await (module.service as AccountService).register(
				{
					email: "pleurote@example.org",
					password: PASSWORD,
					displayName: "Pleurote",
					color: BLUE,
				},
				PUBLIC_URL,
			);
			const verified = await (module.service as AccountService).verifyEmail(
				mailer.token("verifier"),
			);
			expect(verified.ok).toBe(true);
			const token = verified.ok ? verified.value.token : "";
			const identity = await module.identify(
				`autre=1; mycelium_session=${token}`,
			);
			expect(identity?.tokenHash).toBe(sha256(token));
			expect(
				await module.identify(`__Host-mycelium_session=${token}`),
			).toBeNull();
			expect(await module.identify("mycelium_session=faux")).toBeNull();
		} finally {
			await module.close();
		}
	});

	it("convertit les résultats de partie en lignes d'historique", () => {
		const results: MatchResults = {
			matchId: "m_test",
			durationMs: 480_000,
			winnerId: "p1",
			teams: [],
			winnerTeam: null,
			awards: [],
			highlights: [],
			daily: null,
			metrics: { p1: { games: 1, captures: 2 } },
			entries: [
				{
					playerId: "p1",
					name: "Amanite",
					score: 300,
					captures: 2,
					deaths: 0,
					color: BLUE,
					team: null,
				},
				{
					playerId: "p2",
					name: "Cèpe",
					score: 100,
					captures: 1,
					deaths: 1,
					color: GREEN,
					team: null,
				},
				{
					playerId: "p3",
					name: "Invité",
					score: 100,
					captures: 1,
					deaths: 2,
					color: BLUE,
					team: null,
				},
			],
		};
		const playedAt = new Date("2026-03-03T20:00:00Z");
		const records = buildMatchRecords(
			results,
			"private",
			new Map([
				["p1", "compte-1"],
				["p2", null],
				["p3", "compte-3"],
			]),
			playedAt,
		);
		expect(records).toEqual([
			expect.objectContaining({
				accountId: "compte-1",
				rank: 1,
				won: true,
				playerCount: 3,
			}),
			expect.objectContaining({
				accountId: "compte-3",
				rank: 2,
				won: false,
				deaths: 2,
			}),
		]);
		expect(records[0]).toMatchObject({
			visibility: "private",
			playedAt,
			matchId: "m_test",
		});
	});

	it("en mode équipes, classe et fait gagner l'équipe entière", () => {
		const entry = (playerId: string, score: number, team: number) => ({
			playerId,
			name: playerId,
			score,
			captures: 1,
			deaths: 0,
			color: BLUE,
			team,
		});
		const entries = [
			entry("p1", 300, 0),
			entry("p2", 250, 1),
			entry("p3", 200, 1),
		];
		const results: MatchResults = {
			matchId: "m_teams",
			durationMs: 480_000,
			winnerId: null,
			teams: teamStandings(entries),
			winnerTeam: 1,
			entries,
			awards: [],
			highlights: [],
			daily: null,
			metrics: {},
		};
		const records = buildMatchRecords(
			results,
			"private",
			new Map([
				["p1", "compte-1"],
				["p2", "compte-2"],
				["p3", "compte-3"],
			]),
			new Date("2026-03-03T20:00:00Z"),
		);
		expect(results.teams.map((team) => [team.team, team.score])).toEqual([
			[1, 450],
			[0, 300],
		]);
		expect(records.map((record) => [record.rank, record.won])).toEqual([
			[2, false],
			[1, true],
			[1, true],
		]);
	});
});
