import express, {
	type NextFunction,
	type Request,
	type Response,
	type Router,
} from "express";
import {
	type AccountMessageKey,
	type AccountProblem,
	accountMessage,
} from "../../shared/i18n/accountMessages.js";
import {
	DEFAULT_LANGUAGE,
	isLanguage,
	type Language,
	parseLanguage,
} from "../../shared/i18n/languages.js";
import {
	type AccountErrorBody,
	type AccountField,
	type AccountStatus,
	type DiscordOutcome,
	emailKey,
} from "../../shared/protocol/account.js";
import { isRecord } from "../net/validation.js";
import type { AccountModule } from "./AccountModule.js";
import {
	type AccountService,
	type AuthenticatedSession,
	SESSION_IDLE_MS,
} from "./AccountService.js";
import {
	oauthCookieName,
	readCookie,
	serializeClearedCookie,
	serializeOAuthCookie,
	serializeSessionCookie,
	sessionCookieName,
} from "./cookies.js";
import type { DiscordProfile } from "./discord.js";
import { HashQueueFullError } from "./passwords.js";
import { Throttle } from "./throttle.js";
import {
	createSessionToken,
	hashSessionToken,
	isSessionToken,
} from "./tokens.js";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const OAUTH_TTL_MS = 10 * 60_000;
const MAX_OAUTH_STATES = 10_000;

interface OAuthState {
	mode: "login" | "link";
	accountId: string | null;
	language: Language;
	expiresAt: number;
}

interface Throttles {
	authByIp: Throttle;
	registerByIp: Throttle;
	loginFailures: Throttle;
	accountFailures: Throttle;
	writesByIp: Throttle;
	readsByIp: Throttle;
	tokensByIp: Throttle;
	resetsByIp: Throttle;
	oauthByIp: Throttle;
	passwordFailures: Throttle;
}

export interface AccountRouter {
	router: Router;
	dispose(): void;
}

function createThrottles(): Throttles {
	return {
		authByIp: new Throttle(20, 10 * 60_000),
		registerByIp: new Throttle(5, 60 * 60_000),
		loginFailures: new Throttle(6, 15 * 60_000),
		accountFailures: new Throttle(30, 15 * 60_000),
		writesByIp: new Throttle(60, 60_000),
		readsByIp: new Throttle(240, 60_000),
		tokensByIp: new Throttle(30, 10 * 60_000),
		resetsByIp: new Throttle(10, 60 * 60_000),
		oauthByIp: new Throttle(30, 10 * 60_000),
		passwordFailures: new Throttle(6, 15 * 60_000),
	};
}

export function requestLanguage(request: Request): Language {
	return (
		parseLanguage(request.get("x-mycelium-lang")) ??
		parseLanguage(request.get("accept-language")) ??
		DEFAULT_LANGUAGE
	);
}

function sendProblem(
	request: Request,
	response: Response,
	status: number,
	problem: AccountProblem,
	field?: AccountField,
): void {
	const body: AccountErrorBody = {
		error: accountMessage(
			requestLanguage(request),
			problem.key,
			problem.params,
		),
		code: problem.key,
		...(field ? { field } : {}),
	};
	response.status(status).json(body);
}

function sendError(
	request: Request,
	response: Response,
	status: number,
	key: AccountMessageKey,
): void {
	sendProblem(request, response, status, { key });
}

function tooMany(request: Request, response: Response, retryMs: number): void {
	const seconds = Math.max(1, Math.ceil(retryMs / 1000));
	response.setHeader("Retry-After", String(seconds));
	const minutes = Math.ceil(seconds / 60);
	sendProblem(
		request,
		response,
		429,
		minutes > 1
			? { key: "tooManyMinutes", params: { minutes } }
			: { key: "tooManyMinute" },
	);
}

function clientIp(request: Request): string {
	return request.ip ?? request.socket.remoteAddress ?? "inconnu";
}

function sameOrigin(request: Request): boolean {
	const origin = request.get("origin");
	if (origin !== undefined) {
		return origin === `${request.protocol}://${request.host}`;
	}
	const site = request.get("sec-fetch-site");
	return site === undefined || site === "same-origin" || site === "none";
}

export function createAccountRouter(accounts: AccountModule): AccountRouter {
	const router = express.Router();
	const throttles = createThrottles();
	const now = () => Date.now();
	const oauthStates = new Map<string, OAuthState>();
	const pruneStates = () => {
		for (const [key, state] of oauthStates) {
			if (state.expiresAt <= now()) {
				oauthStates.delete(key);
			}
		}
	};
	const pruneTimer = setInterval(() => {
		for (const throttle of Object.values(throttles)) {
			throttle.prune(now());
		}
		pruneStates();
	}, 5 * 60_000);
	pruneTimer.unref();

	const setSession = (response: Response, token: string) => {
		response.append(
			"Set-Cookie",
			serializeSessionCookie(token, {
				secure: accounts.cookieSecure,
				maxAgeSeconds: Math.floor(SESSION_IDLE_MS / 1000),
			}),
		);
	};
	const clearSession = (response: Response) => {
		response.append(
			"Set-Cookie",
			serializeClearedCookie(accounts.cookieSecure),
		);
	};
	const cookieToken = (request: Request) =>
		readCookie(
			request.headers.cookie,
			sessionCookieName(accounts.cookieSecure),
		);

	router.use((request, response, next) => {
		response.setHeader("Cache-Control", "no-store");
		response.setHeader("Pragma", "no-cache");
		if (MUTATING.has(request.method)) {
			if (!sameOrigin(request)) {
				sendError(request, response, 403, "originRefused");
				return;
			}
			if (!request.is("application/json")) {
				sendError(request, response, 415, "unsupportedFormat");
				return;
			}
			const blocked = throttles.writesByIp.hit(clientIp(request), now());
			if (blocked > 0) {
				tooMany(request, response, blocked);
				return;
			}
		} else {
			const blocked = throttles.readsByIp.hit(clientIp(request), now());
			if (blocked > 0) {
				tooMany(request, response, blocked);
				return;
			}
		}
		next();
	});
	router.use(
		express.json({ limit: "4kb", strict: true, type: "application/json" }),
	);
	router.use((request, response, next) => {
		if (MUTATING.has(request.method) && !isRecord(request.body)) {
			sendError(request, response, 400, "invalidRequest");
			return;
		}
		next();
	});

	const service = (
		request: Request,
		response: Response,
	): AccountService | null => {
		const ready = accounts.service;
		if (!ready) {
			sendError(
				request,
				response,
				503,
				accounts.enabled ? "serviceUnavailable" : "accountsDisabled",
			);
		}
		return ready;
	};

	const authenticated = async (
		request: Request,
		response: Response,
		ready: AccountService,
	): Promise<AuthenticatedSession | null> => {
		const token = cookieToken(request);
		const session = await ready.authenticate(token);
		if (!session) {
			if (token) {
				clearSession(response);
			}
			sendError(request, response, 401, "notSignedIn");
			return null;
		}
		if (session.refreshed && token) {
			setSession(response, token);
		}
		return session;
	};

	router.get("/me", async (request, response) => {
		if (!accounts.enabled) {
			response.json({
				enabled: false,
				discord: false,
				account: null,
			} satisfies AccountStatus);
			return;
		}
		const ready = service(request, response);
		if (!ready) {
			return;
		}
		const token = cookieToken(request);
		const session = await ready.authenticate(token);
		if (!session) {
			if (token) {
				clearSession(response);
			}
			response.json({
				enabled: true,
				discord: accounts.discord !== null,
				account: null,
			} satisfies AccountStatus);
			return;
		}
		const profile = await ready.profile(session.accountId);
		if (!profile) {
			clearSession(response);
		} else if (session.refreshed && token) {
			setSession(response, token);
		}
		response.json({
			enabled: true,
			discord: accounts.discord !== null,
			account: profile,
		} satisfies AccountStatus);
	});

	const linkBase = (request: Request, response: Response): string | null => {
		const base = accounts.linkBase(`${request.protocol}://${request.host}`);
		if (!base) {
			sendError(request, response, 503, "mailUnavailable");
		}
		return base;
	};

	router.post("/register", async (request, response) => {
		const ready = service(request, response);
		const base = ready && linkBase(request, response);
		if (!ready || !base) {
			return;
		}
		const ip = clientIp(request);
		const blocked = Math.max(
			throttles.authByIp.retryAfter(ip, now()),
			throttles.registerByIp.retryAfter(ip, now()),
		);
		if (blocked > 0) {
			tooMany(request, response, blocked);
			return;
		}
		throttles.authByIp.record(ip, now());
		const body = request.body as Record<string, unknown>;
		const result = await ready.register(
			{
				email: body.email,
				password: body.password,
				displayName: body.displayName,
				color: body.color,
				pattern: body.pattern,
				language: body.language,
			},
			base,
			requestLanguage(request),
		);
		if (!result.ok) {
			sendProblem(
				request,
				response,
				result.status,
				result.problem,
				result.field,
			);
			return;
		}
		throttles.registerByIp.record(ip, now());
		response.status(202).json(result.value);
	});

	router.post("/verify-email", async (request, response) => {
		const ready = service(request, response);
		if (!ready) {
			return;
		}
		const ip = clientIp(request);
		const blocked = throttles.tokensByIp.hit(ip, now());
		if (blocked > 0) {
			tooMany(request, response, blocked);
			return;
		}
		const body = request.body as Record<string, unknown>;
		const result = await ready.verifyEmail(body.token);
		if (!result.ok) {
			sendProblem(
				request,
				response,
				result.status,
				result.problem,
				result.field,
			);
			return;
		}
		const previous = await ready.authenticate(cookieToken(request));
		if (previous) {
			await ready.logout(previous.tokenHash);
		}
		setSession(response, result.value.token);
		response.status(201).json({ account: result.value.profile });
	});

	router.post("/login", async (request, response) => {
		const ready = service(request, response);
		if (!ready) {
			return;
		}
		const body = request.body as Record<string, unknown>;
		const ip = clientIp(request);
		const key =
			typeof body.email === "string" ? emailKey(body.email).slice(0, 254) : "";
		const pair = `${ip}|${key}`;
		const blocked = Math.max(
			throttles.authByIp.retryAfter(ip, now()),
			throttles.loginFailures.retryAfter(pair, now()),
			throttles.accountFailures.retryAfter(key, now()),
		);
		if (blocked > 0) {
			tooMany(request, response, blocked);
			return;
		}
		throttles.authByIp.record(ip, now());
		const issued = await ready.login(body.email, body.password);
		if (!issued) {
			throttles.loginFailures.record(pair, now());
			throttles.accountFailures.record(key, now());
			sendError(request, response, 401, "invalidCredentials");
			return;
		}
		throttles.loginFailures.reset(pair);
		const previous = await ready.authenticate(cookieToken(request));
		if (previous) {
			await ready.logout(previous.tokenHash);
		}
		setSession(response, issued.token);
		response.json({ account: issued.profile });
	});

	router.post("/password-reset/request", async (request, response) => {
		const ready = service(request, response);
		const base = ready && linkBase(request, response);
		if (!ready || !base) {
			return;
		}
		const blocked = throttles.resetsByIp.hit(clientIp(request), now());
		if (blocked > 0) {
			tooMany(request, response, blocked);
			return;
		}
		const body = request.body as Record<string, unknown>;
		const result = await ready.requestPasswordReset(body.email, base);
		if (!result.ok) {
			sendProblem(
				request,
				response,
				result.status,
				result.problem,
				result.field,
			);
			return;
		}
		response.status(202).json({ sent: true });
	});

	router.post("/password-reset/confirm", async (request, response) => {
		const ready = service(request, response);
		const base = ready && linkBase(request, response);
		if (!ready || !base) {
			return;
		}
		const blocked = throttles.tokensByIp.hit(clientIp(request), now());
		if (blocked > 0) {
			tooMany(request, response, blocked);
			return;
		}
		const body = request.body as Record<string, unknown>;
		const result = await ready.resetPassword(
			body.token,
			body.newPassword,
			base,
		);
		if (!result.ok) {
			sendProblem(
				request,
				response,
				result.status,
				result.problem,
				result.field,
			);
			return;
		}
		setSession(response, result.value.token);
		response.json({ account: result.value.profile });
	});

	const requestOrigin = (request: Request) =>
		`${request.protocol}://${request.host}`;
	const discordResult = (
		response: Response,
		base: string,
		outcome: DiscordOutcome,
	) => {
		response.redirect(303, `${base}/#discord=${outcome}`);
	};

	router.get("/discord/start", async (request, response) => {
		const base = accounts.linkBase(requestOrigin(request));
		if (!base) {
			sendError(request, response, 503, "publicUrlMissing");
			return;
		}
		const ready = accounts.service;
		const client = accounts.discord;
		if (!ready || !client) {
			discordResult(response, base, "indisponible");
			return;
		}
		const blocked = throttles.oauthByIp.hit(clientIp(request), now());
		if (blocked > 0) {
			tooMany(request, response, blocked);
			return;
		}
		const mode = request.query.mode === "link" ? "link" : "login";
		let accountId: string | null = null;
		if (mode === "link") {
			const session = await ready.authenticate(cookieToken(request));
			if (!session) {
				discordResult(response, base, "erreur-session");
				return;
			}
			accountId = session.accountId;
		}
		if (oauthStates.size >= MAX_OAUTH_STATES) {
			pruneStates();
			if (oauthStates.size >= MAX_OAUTH_STATES) {
				discordResult(response, base, "erreur-discord");
				return;
			}
		}
		const state = createSessionToken();
		const language = isLanguage(request.query.lang)
			? request.query.lang
			: requestLanguage(request);
		oauthStates.set(hashSessionToken(state), {
			mode,
			accountId,
			language,
			expiresAt: now() + OAUTH_TTL_MS,
		});
		response.append(
			"Set-Cookie",
			serializeOAuthCookie(state, accounts.cookieSecure, OAUTH_TTL_MS / 1000),
		);
		response.redirect(
			303,
			client.authorizeUrl(state, `${base}/api/account/discord/callback`),
		);
	});

	router.get("/discord/callback", async (request, response) => {
		const base = accounts.linkBase(requestOrigin(request));
		if (!base) {
			sendError(request, response, 503, "publicUrlMissing");
			return;
		}
		response.append(
			"Set-Cookie",
			serializeOAuthCookie("", accounts.cookieSecure, 0),
		);
		const ready = accounts.service;
		const client = accounts.discord;
		if (!ready || !client) {
			discordResult(response, base, "indisponible");
			return;
		}
		const blocked = throttles.tokensByIp.hit(clientIp(request), now());
		if (blocked > 0) {
			tooMany(request, response, blocked);
			return;
		}
		const state =
			typeof request.query.state === "string" ? request.query.state : "";
		const key = isSessionToken(state) ? hashSessionToken(state) : null;
		const record = key ? oauthStates.get(key) : undefined;
		if (key) {
			oauthStates.delete(key);
		}
		const cookie = readCookie(
			request.headers.cookie,
			oauthCookieName(accounts.cookieSecure),
		);
		if (!record || record.expiresAt <= now() || cookie !== state) {
			discordResult(response, base, "erreur-etat");
			return;
		}
		if (request.query.error !== undefined) {
			discordResult(response, base, "annule");
			return;
		}
		const code =
			typeof request.query.code === "string" ? request.query.code : "";
		if (!/^[A-Za-z0-9_-]{1,256}$/.test(code)) {
			discordResult(response, base, "erreur-discord");
			return;
		}
		let profile: DiscordProfile;
		try {
			profile = await client.fetchProfile(
				code,
				`${base}/api/account/discord/callback`,
			);
		} catch (error) {
			console.error(
				"Comptes : connexion Discord impossible",
				error instanceof Error ? error.message : error,
			);
			discordResult(response, base, "erreur-discord");
			return;
		}
		if (record.mode === "link") {
			discordResult(
				response,
				base,
				await ready.linkDiscord(record.accountId as string, profile),
			);
			return;
		}
		const { outcome, issued } = await ready.discordLogin(
			profile,
			record.language,
		);
		if (issued) {
			setSession(response, issued.token);
		}
		discordResult(response, base, outcome);
	});

	router.post("/discord/unlink", async (request, response) => {
		const ready = service(request, response);
		const session = ready && (await authenticated(request, response, ready));
		if (!ready || !session) {
			return;
		}
		const result = await ready.unlinkDiscord(session.accountId);
		if (!result.ok) {
			sendProblem(
				request,
				response,
				result.status,
				result.problem,
				result.field,
			);
			return;
		}
		response.json({ account: result.value });
	});

	router.post("/logout", async (request, response) => {
		const ready = accounts.service;
		if (ready) {
			const session = await ready.authenticate(cookieToken(request));
			if (session) {
				await ready.logout(session.tokenHash);
			}
		}
		clearSession(response);
		response.status(204).end();
	});

	router.patch("/profile", async (request, response) => {
		const ready = service(request, response);
		const session = ready && (await authenticated(request, response, ready));
		if (!ready || !session) {
			return;
		}
		const body = request.body as Record<string, unknown>;
		const result = await ready.updateProfile(session.accountId, {
			displayName: body.displayName,
			color: body.color,
			pattern: body.pattern,
			lantern: body.lantern,
			tagline: body.tagline,
			language: body.language,
			privateProfile: body.privateProfile,
		});
		if (!result.ok) {
			sendProblem(
				request,
				response,
				result.status,
				result.problem,
				result.field,
			);
			return;
		}
		response.json({ account: result.value });
	});

	router.post("/terms-acceptance", async (request, response) => {
		const ready = service(request, response);
		const session = ready && (await authenticated(request, response, ready));
		if (!ready || !session) {
			return;
		}
		const result = await ready.acceptTerms(session.accountId);
		if (!result.ok) {
			sendProblem(request, response, result.status, result.problem);
			return;
		}
		response.json({ account: result.value });
	});

	router.post("/password", async (request, response) => {
		const ready = service(request, response);
		const session = ready && (await authenticated(request, response, ready));
		if (!ready || !session) {
			return;
		}
		const blocked = throttles.passwordFailures.retryAfter(
			session.accountId,
			now(),
		);
		if (blocked > 0) {
			tooMany(request, response, blocked);
			return;
		}
		const body = request.body as Record<string, unknown>;
		const result = await ready.changePassword(
			session.accountId,
			body.currentPassword,
			body.newPassword,
			accounts.linkBase(`${request.protocol}://${request.host}`) ?? "",
		);
		if (!result.ok) {
			if (result.status === 403) {
				throttles.passwordFailures.record(session.accountId, now());
			}
			sendProblem(
				request,
				response,
				result.status,
				result.problem,
				result.field,
			);
			return;
		}
		throttles.passwordFailures.reset(session.accountId);
		setSession(response, result.value.token);
		response.json({ account: result.value.profile });
	});

	router.delete("/", async (request, response) => {
		const ready = service(request, response);
		const session = ready && (await authenticated(request, response, ready));
		if (!ready || !session) {
			return;
		}
		const blocked = throttles.passwordFailures.retryAfter(
			session.accountId,
			now(),
		);
		if (blocked > 0) {
			tooMany(request, response, blocked);
			return;
		}
		const body = request.body as Record<string, unknown>;
		const result = await ready.deleteAccount(
			session.accountId,
			body.password,
			body.confirmation,
		);
		if (!result.ok) {
			if (result.status === 403) {
				throttles.passwordFailures.record(session.accountId, now());
			}
			sendProblem(
				request,
				response,
				result.status,
				result.problem,
				result.field,
			);
			return;
		}
		clearSession(response);
		response.status(204).end();
	});

	router.get("/daily", async (request, response) => {
		const ready = service(request, response);
		if (!ready) {
			return;
		}
		const session = await ready.authenticate(cookieToken(request));
		response.json(
			await ready.dailyBoard(request.query.date, session?.accountId ?? null),
		);
	});

	router.get("/history", async (request, response) => {
		const ready = service(request, response);
		const session = ready && (await authenticated(request, response, ready));
		if (!ready || !session) {
			return;
		}
		response.json({ entries: await ready.history(session.accountId) });
	});

	router.get("/history/:matchId", async (request, response) => {
		const ready = service(request, response);
		const session = ready && (await authenticated(request, response, ready));
		if (!ready || !session) {
			return;
		}
		const detail = await ready.historyDetail(
			session.accountId,
			request.params.matchId,
		);
		if (!detail) {
			sendError(request, response, 404, "notFound");
			return;
		}
		response.json({ match: detail });
	});

	router.get("/players/:profileId", async (request, response) => {
		const ready = service(request, response);
		if (!ready) {
			return;
		}
		const viewer = await ready.authenticate(cookieToken(request));
		const profile = await ready.publicProfile(
			request.params.profileId,
			viewer?.accountId ?? null,
		);
		if (!profile) {
			sendError(request, response, 404, "notFound");
			return;
		}
		response.json({ profile });
	});

	router.use((request: Request, response: Response) => {
		sendError(request, response, 404, "notFound");
	});

	router.use(
		(
			error: unknown,
			request: Request,
			response: Response,
			_next: NextFunction,
		) => {
			if (response.headersSent) {
				return;
			}
			if (error instanceof HashQueueFullError) {
				response.setHeader("Retry-After", "5");
				sendError(request, response, 503, "serverBusy");
				return;
			}
			const status =
				typeof error === "object" && error !== null
					? Number(
							(error as { status?: unknown; statusCode?: unknown }).status ??
								500,
						)
					: 500;
			if (status === 413) {
				sendError(request, response, 413, "payloadTooLarge");
				return;
			}
			if (status >= 400 && status < 500) {
				sendError(request, response, 400, "invalidRequest");
				return;
			}
			console.error(
				"Comptes : erreur interne",
				error instanceof Error ? error.message : error,
			);
			sendError(request, response, 500, "internalError");
		},
	);

	return {
		router,
		dispose: () => clearInterval(pruneTimer),
	};
}
