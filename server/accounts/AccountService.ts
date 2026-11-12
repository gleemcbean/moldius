import { randomBytes } from "node:crypto";
import { dailyDateKey, isDailyDateKey } from "../../shared/dailyChallenge.js";
import { DEFAULT_HAT_PATTERN, isHatPattern } from "../../shared/hatPatterns.js";
import type {
	AccountMessageKey,
	AccountProblem,
	MessageParams,
} from "../../shared/i18n/accountMessages.js";
import {
	DEFAULT_LANGUAGE,
	isLanguage,
	type Language,
	parseLanguage,
} from "../../shared/i18n/languages.js";
import {
	isPlayerColor,
	PLAYER_COLOR_CHOICES,
} from "../../shared/playerColors.js";
import {
	type AccountField,
	type AccountProfile,
	type DailyBoard,
	type DiscordOutcome,
	EMAIL_MAX_LENGTH,
	emailKey,
	isDeleteConfirmation,
	MATCH_HISTORY_LIMIT,
	type MatchDetail,
	type MatchHistoryEntry,
	normalizeEmail,
	PUBLIC_RECENT_LIMIT,
	type PublicProfile,
	type RegisterResponse,
	validateEmail,
	validatePassword,
} from "../../shared/protocol/account.js";
import {
	accountProgress,
	hatUnlocked,
	isLanternTint,
	isTagline,
	lanternUnlocked,
	taglineUnlocked,
} from "../../shared/rewards.js";
import type { Mailer, MailMessage } from "../mail/mailer.js";
import {
	alreadyRegisteredEmail,
	passwordChangedEmail,
	passwordResetEmail,
	verificationEmail,
} from "../mail/templates.js";
import { sanitizeName } from "../net/validation.js";
import {
	AccountStore,
	type MatchRecord,
	type StoredAccount,
} from "./AccountStore.js";
import { type Database, isUniqueViolation } from "./database.js";
import type { DiscordProfile } from "./discord.js";
import {
	DEFAULT_SCRYPT,
	hashPassword,
	needsRehash,
	type ScryptParameters,
	verifyPassword,
} from "./passwords.js";
import { Throttle } from "./throttle.js";
import {
	createSessionToken,
	hashSessionToken,
	isSessionToken,
} from "./tokens.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_BOARD_LIMIT = 20;
export const SESSION_IDLE_MS = 30 * DAY_MS;
export const SESSION_ABSOLUTE_MS = 90 * DAY_MS;
const SESSION_REFRESH_MS = DAY_MS;
export const REGISTRATION_TTL_MS = DAY_MS;
export const RESET_TTL_MS = 60 * 60 * 1000;
export const MAILS_PER_ADDRESS = 3;
const MAIL_WINDOW_MS = 60 * 60 * 1000;

export interface AuthenticatedSession {
	accountId: string;
	tokenHash: string;
	refreshed: boolean;
}

export interface IssuedSession {
	profile: AccountProfile;
	token: string;
}

export type AccountRevocation =
	| { kind: "session"; tokenHash: string }
	| { kind: "account"; accountId: string; keepTokenHash: string | null };

export type ServiceResult<T> =
	| { ok: true; value: T }
	| {
			ok: false;
			status: number;
			problem: AccountProblem;
			field?: AccountField;
	  };

export interface AccountServiceOptions {
	scrypt?: ScryptParameters;
	now?: () => number;
	onRevoke?: (revocation: AccountRevocation) => void;
	mailer?: Mailer | null;
}

export function verificationLink(base: string, token: string): string {
	return `${base}/#verifier=${token}`;
}

export function resetLink(base: string, token: string): string {
	return `${base}/#reinitialiser=${token}`;
}

function fail(
	status: number,
	key: AccountMessageKey,
	field?: AccountField,
	params?: MessageParams,
): ServiceResult<never> {
	return {
		ok: false,
		status,
		problem: params ? { key, params } : { key },
		...(field ? { field } : {}),
	};
}

function invalid(
	status: number,
	problem: AccountProblem,
	field: AccountField,
): ServiceResult<never> {
	return fail(status, problem.key, field, problem.params);
}

export class AccountService {
	private readonly store: AccountStore;
	private readonly scrypt: ScryptParameters;
	private readonly now: () => number;
	private readonly mailer: Mailer | null;
	private readonly mailThrottle = new Throttle(
		MAILS_PER_ADDRESS,
		MAIL_WINDOW_MS,
	);
	private dummyHash: Promise<string> | null = null;
	onRevoke: (revocation: AccountRevocation) => void;

	constructor(
		readonly database: Database,
		options: AccountServiceOptions = {},
	) {
		this.store = new AccountStore(database);
		this.scrypt = options.scrypt ?? DEFAULT_SCRYPT;
		this.now = options.now ?? Date.now;
		this.onRevoke = options.onRevoke ?? (() => undefined);
		this.mailer = options.mailer ?? null;
	}

	get canSendMail(): boolean {
		return this.mailer !== null;
	}

	private allowMail(key: string): boolean {
		return this.mailThrottle.hit(key, this.now()) === 0;
	}

	private async deliver(message: MailMessage): Promise<boolean> {
		try {
			await (this.mailer as Mailer).send(message);
			return true;
		} catch (error) {
			console.error(
				"Comptes : envoi d'e-mail impossible",
				error instanceof Error ? error.message : error,
			);
			return false;
		}
	}

	private dummy(): Promise<string> {
		this.dummyHash ??= hashPassword(
			randomBytes(18).toString("base64url"),
			this.scrypt,
		);
		return this.dummyHash;
	}

	private async issue(account: StoredAccount): Promise<IssuedSession> {
		const token = createSessionToken();
		const now = this.now();
		await this.store.createSession(
			hashSessionToken(token),
			account.id,
			new Date(now),
			new Date(now + SESSION_IDLE_MS),
		);
		return { profile: account.profile, token };
	}

	async register(
		input: {
			email: unknown;
			password: unknown;
			displayName: unknown;
			color: unknown;
			pattern?: unknown;
			language?: unknown;
		},
		base: string,
		fallbackLanguage: Language = DEFAULT_LANGUAGE,
		discord: DiscordProfile | null = null,
	): Promise<ServiceResult<RegisterResponse>> {
		if (!this.mailer) {
			return fail(503, "mailUnavailable");
		}
		if (typeof input.email !== "string") {
			return fail(400, "emailMissing", "email");
		}
		const emailError = validateEmail(input.email);
		if (emailError) {
			return invalid(400, emailError, "email");
		}
		if (typeof input.password !== "string") {
			return fail(400, "passwordMissing", "password");
		}
		const passwordError = validatePassword(input.password, input.email);
		if (passwordError) {
			return invalid(400, passwordError, "password");
		}
		const displayName = sanitizeName(input.displayName);
		if (!displayName) {
			return fail(400, "displayNameInvalid", "displayName");
		}
		if (!isPlayerColor(input.color)) {
			return fail(400, "colorInvalid", "color");
		}
		if (
			input.pattern !== undefined &&
			(!isHatPattern(input.pattern) || !hatUnlocked(input.pattern, null))
		) {
			return fail(400, "patternInvalid", "pattern");
		}
		if (input.language !== undefined && !isLanguage(input.language)) {
			return fail(400, "languageInvalid", "language");
		}
		const pattern = input.pattern ?? DEFAULT_HAT_PATTERN;
		const language = input.language ?? fallbackLanguage;
		const email = normalizeEmail(input.email);
		const key = emailKey(email);
		const passwordHash = await hashPassword(input.password, this.scrypt);
		const linkable =
			discord && !(await this.store.findByDiscord(discord.id)) ? discord : null;
		const accepted: ServiceResult<RegisterResponse> = {
			ok: true,
			value: { pending: true, email, discord: linkable?.username ?? null },
		};
		if (!this.allowMail(key)) {
			return accepted;
		}
		const existing = await this.store.findByEmail(key);
		let sent: boolean;
		if (existing) {
			sent = await this.deliver(
				alreadyRegisteredEmail(
					existing.profile.email ?? email,
					`${base}/`,
					existing.profile.language,
				),
			);
		} else {
			const token = createSessionToken();
			const now = this.now();
			await this.store.createPending(
				hashSessionToken(token),
				{
					email,
					emailKey: key,
					passwordHash,
					displayName,
					color: input.color,
					pattern,
					language,
					discord: linkable
						? {
								id: linkable.id,
								username: linkable.username,
								avatar: linkable.avatar,
							}
						: null,
				},
				new Date(now),
				new Date(now + REGISTRATION_TTL_MS),
			);
			sent = await this.deliver(
				verificationEmail(
					email,
					displayName,
					verificationLink(base, token),
					language,
				),
			);
		}
		return sent ? accepted : fail(502, "mailFailed");
	}

	async verifyEmail(token: unknown): Promise<ServiceResult<IssuedSession>> {
		if (typeof token !== "string" || !isSessionToken(token)) {
			return fail(400, "linkInvalid", "token");
		}
		const now = this.now();
		const pending = await this.store.takePending(
			hashSessionToken(token),
			new Date(now),
		);
		if (!pending) {
			return fail(400, "registrationLinkInvalid", "token");
		}
		try {
			let account = await this.store.create(pending, new Date(now));
			await this.store.deletePendingFor(pending.emailKey);
			await this.store.touchLogin(account.id);
			if (pending.discord) {
				account =
					(await this.attachDiscord(account.id, pending.discord)) ?? account;
			}
			return { ok: true, value: await this.issue(account) };
		} catch (error) {
			if (isUniqueViolation(error)) {
				return fail(409, "emailAlreadyConfirmed", "token");
			}
			throw error;
		}
	}

	async login(
		email: unknown,
		password: unknown,
	): Promise<IssuedSession | null> {
		if (
			typeof email !== "string" ||
			typeof password !== "string" ||
			email.length > EMAIL_MAX_LENGTH ||
			[...password].length > 128
		) {
			await verifyPassword("invalid", await this.dummy());
			return null;
		}
		const account = await this.store.findByEmail(emailKey(email));
		if (!account?.passwordHash) {
			await verifyPassword(password, await this.dummy());
			return null;
		}
		if (!(await verifyPassword(password, account.passwordHash))) {
			return null;
		}
		if (needsRehash(account.passwordHash, this.scrypt)) {
			await this.store.updatePasswordHash(
				account.id,
				await hashPassword(password, this.scrypt),
				false,
			);
		}
		await this.store.touchLogin(account.id);
		return this.issue(account);
	}

	async requestPasswordReset(
		email: unknown,
		base: string,
	): Promise<ServiceResult<null>> {
		if (!this.mailer) {
			return fail(503, "mailUnavailable");
		}
		if (typeof email !== "string" || validateEmail(email)) {
			return fail(400, "emailInvalid", "email");
		}
		const key = emailKey(email);
		if (this.allowMail(key)) {
			const account = await this.store.findByEmail(key);
			if (account) {
				const token = createSessionToken();
				const now = this.now();
				await this.store.createReset(
					hashSessionToken(token),
					account.id,
					new Date(now),
					new Date(now + RESET_TTL_MS),
				);
				void this.deliver(
					passwordResetEmail(
						account.profile.email ?? normalizeEmail(email),
						resetLink(base, token),
						account.profile.language,
					),
				);
			}
		}
		return { ok: true, value: null };
	}

	async resetPassword(
		token: unknown,
		newPassword: unknown,
		base: string,
	): Promise<ServiceResult<IssuedSession>> {
		if (typeof token !== "string" || !isSessionToken(token)) {
			return fail(400, "linkInvalid", "token");
		}
		const tokenHash = hashSessionToken(token);
		const now = new Date(this.now());
		const accountId = await this.store.peekReset(tokenHash, now);
		const account = accountId ? await this.store.findById(accountId) : null;
		if (!account) {
			return fail(400, "resetLinkInvalid", "token");
		}
		if (typeof newPassword !== "string") {
			return fail(400, "newPasswordMissing", "newPassword");
		}
		const passwordError = validatePassword(
			newPassword,
			account.profile.email ?? "",
		);
		if (passwordError) {
			return invalid(400, passwordError, "newPassword");
		}
		if ((await this.store.takeReset(tokenHash, now)) !== account.id) {
			return fail(400, "resetLinkInvalid", "token");
		}
		await this.store.updatePasswordHash(
			account.id,
			await hashPassword(newPassword, this.scrypt),
			true,
		);
		await this.store.deleteSessionsOf(account.id);
		await this.store.deleteResetsOf(account.id);
		const issued = await this.issue(account);
		this.onRevoke({
			kind: "account",
			accountId: account.id,
			keepTokenHash: hashSessionToken(issued.token),
		});
		if (account.profile.email) {
			void this.deliver(
				passwordChangedEmail(
					account.profile.email,
					`${base}/`,
					account.profile.language,
				),
			);
		}
		return { ok: true, value: issued };
	}

	async authenticate(
		token: string | null,
	): Promise<AuthenticatedSession | null> {
		if (!token || !isSessionToken(token)) {
			return null;
		}
		const tokenHash = hashSessionToken(token);
		const now = this.now();
		const session = await this.store.findSession(tokenHash, new Date(now));
		if (!session) {
			return null;
		}
		const absoluteEnd = session.createdAt.getTime() + SESSION_ABSOLUTE_MS;
		if (absoluteEnd <= now) {
			await this.store.deleteSession(tokenHash);
			return null;
		}
		let refreshed = false;
		if (now - session.lastUsedAt.getTime() >= SESSION_REFRESH_MS) {
			await this.store.extendSession(
				tokenHash,
				new Date(now),
				new Date(Math.min(absoluteEnd, now + SESSION_IDLE_MS)),
			);
			refreshed = true;
		}
		return { accountId: session.accountId, tokenHash, refreshed };
	}

	async logout(tokenHash: string): Promise<void> {
		await this.store.deleteSession(tokenHash);
		this.onRevoke({ kind: "session", tokenHash });
	}

	async profile(accountId: string): Promise<AccountProfile | null> {
		return (await this.store.findById(accountId))?.profile ?? null;
	}

	async updateProfile(
		accountId: string,
		patch: {
			displayName?: unknown;
			color?: unknown;
			pattern?: unknown;
			lantern?: unknown;
			tagline?: unknown;
			language?: unknown;
			privateProfile?: unknown;
		},
	): Promise<ServiceResult<AccountProfile>> {
		const account = await this.store.findById(accountId);
		if (!account) {
			return fail(401, "sessionExpired");
		}
		let displayName = account.profile.displayName;
		let color = account.profile.color;
		let pattern = account.profile.pattern;
		let lantern = account.profile.lantern;
		let tagline = account.profile.tagline;
		let language = account.profile.language;
		let privateProfile = account.profile.privateProfile;
		if (patch.displayName !== undefined) {
			const cleaned = sanitizeName(patch.displayName);
			if (!cleaned) {
				return fail(400, "displayNameInvalid", "displayName");
			}
			displayName = cleaned;
		}
		if (patch.color !== undefined) {
			if (!isPlayerColor(patch.color)) {
				return fail(400, "colorInvalid", "color");
			}
			color = patch.color;
		}
		if (patch.pattern !== undefined) {
			if (
				!isHatPattern(patch.pattern) ||
				!hatUnlocked(patch.pattern, accountProgress(account.profile))
			) {
				return fail(400, "patternInvalid", "pattern");
			}
			pattern = patch.pattern;
		}
		if (patch.lantern !== undefined) {
			if (
				!isLanternTint(patch.lantern) ||
				!lanternUnlocked(patch.lantern, accountProgress(account.profile))
			) {
				return fail(400, "patternInvalid", "pattern");
			}
			lantern = patch.lantern;
		}
		if (patch.tagline !== undefined) {
			if (
				patch.tagline !== null &&
				(!isTagline(patch.tagline) ||
					!taglineUnlocked(patch.tagline, accountProgress(account.profile)))
			) {
				return fail(400, "patternInvalid", "pattern");
			}
			tagline = patch.tagline;
		}
		if (patch.language !== undefined) {
			if (!isLanguage(patch.language)) {
				return fail(400, "languageInvalid", "language");
			}
			language = patch.language;
		}
		if (patch.privateProfile !== undefined) {
			if (typeof patch.privateProfile !== "boolean") {
				return fail(400, "invalidRequest");
			}
			privateProfile = patch.privateProfile;
		}
		const updated = await this.store.updateProfile(accountId, {
			displayName,
			color,
			pattern,
			lantern,
			tagline,
			language,
			privateProfile,
		});
		return updated
			? { ok: true, value: updated.profile }
			: fail(401, "sessionExpired");
	}

	async acceptTerms(accountId: string): Promise<ServiceResult<AccountProfile>> {
		const updated = await this.store.acceptTerms(accountId);
		return updated
			? { ok: true, value: updated.profile }
			: fail(401, "sessionExpired");
	}

	async changePassword(
		accountId: string,
		currentPassword: unknown,
		newPassword: unknown,
		base: string,
	): Promise<ServiceResult<IssuedSession>> {
		const account = await this.store.findById(accountId);
		if (!account) {
			return fail(401, "sessionExpired");
		}
		if (!account.passwordHash) {
			return fail(400, "noPasswordYet", "currentPassword");
		}
		if (
			typeof currentPassword !== "string" ||
			[...currentPassword].length > 128 ||
			!(await verifyPassword(currentPassword, account.passwordHash))
		) {
			return fail(403, "currentPasswordWrong", "currentPassword");
		}
		if (typeof newPassword !== "string") {
			return fail(400, "newPasswordMissing", "newPassword");
		}
		const passwordError = validatePassword(
			newPassword,
			account.profile.email ?? "",
		);
		if (passwordError) {
			return invalid(400, passwordError, "newPassword");
		}
		if (newPassword === currentPassword) {
			return fail(400, "newPasswordSame", "newPassword");
		}
		await this.store.updatePasswordHash(
			accountId,
			await hashPassword(newPassword, this.scrypt),
			true,
		);
		await this.store.deleteSessionsOf(accountId);
		await this.store.deleteResetsOf(accountId);
		const issued = await this.issue(account);
		this.onRevoke({
			kind: "account",
			accountId,
			keepTokenHash: hashSessionToken(issued.token),
		});
		if (this.mailer && base && account.profile.email) {
			void this.deliver(
				passwordChangedEmail(
					account.profile.email,
					`${base}/`,
					account.profile.language,
				),
			);
		}
		return { ok: true, value: issued };
	}

	async deleteAccount(
		accountId: string,
		password: unknown,
		confirmation: unknown,
	): Promise<ServiceResult<null>> {
		const account = await this.store.findById(accountId);
		if (!account) {
			return fail(401, "sessionExpired");
		}
		if (!account.passwordHash) {
			if (!isDeleteConfirmation(confirmation)) {
				return fail(403, "deleteConfirmation", "confirmation");
			}
		} else if (
			typeof password !== "string" ||
			[...password].length > 128 ||
			!(await verifyPassword(password, account.passwordHash))
		) {
			return fail(403, "passwordWrong", "password");
		}
		await this.store.delete(accountId);
		this.onRevoke({ kind: "account", accountId, keepTokenHash: null });
		return { ok: true, value: null };
	}

	async discordLogin(
		discord: DiscordProfile,
		fallbackLanguage: Language = DEFAULT_LANGUAGE,
	): Promise<{ outcome: DiscordOutcome; issued: IssuedSession | null }> {
		const linked = await this.store.findByDiscord(discord.id);
		if (linked) {
			const refreshed =
				(await this.store.setDiscord(linked.id, discord)) ?? linked;
			await this.store.touchLogin(linked.id);
			return { outcome: "connecte", issued: await this.issue(refreshed) };
		}
		const verifiedEmail =
			discord.email && discord.emailVerified && !validateEmail(discord.email)
				? normalizeEmail(discord.email)
				: null;
		if (
			verifiedEmail &&
			(await this.store.findByEmail(emailKey(verifiedEmail)))
		) {
			return { outcome: "email-existant", issued: null };
		}
		const displayName =
			sanitizeName(discord.displayName) ??
			sanitizeName(discord.username) ??
			"Champignon";
		const color =
			PLAYER_COLOR_CHOICES[
				Math.floor(Math.random() * PLAYER_COLOR_CHOICES.length)
			];
		try {
			const account = await this.store.createFromDiscord(
				discord,
				verifiedEmail
					? { email: verifiedEmail, emailKey: emailKey(verifiedEmail) }
					: null,
				displayName,
				color,
				parseLanguage(discord.locale ?? undefined) ?? fallbackLanguage,
				new Date(this.now()),
			);
			await this.store.touchLogin(account.id);
			return { outcome: "cree", issued: await this.issue(account) };
		} catch (error) {
			if (isUniqueViolation(error)) {
				return { outcome: "deja-lie", issued: null };
			}
			throw error;
		}
	}

	private async attachDiscord(
		accountId: string,
		discord: { id: string; username: string; avatar: string | null },
	) {
		if (await this.store.findByDiscord(discord.id)) {
			return null;
		}
		try {
			return await this.store.setDiscord(accountId, {
				id: discord.id,
				username: discord.username,
				displayName: discord.username,
				avatar: discord.avatar,
				email: null,
				emailVerified: false,
				locale: null,
			});
		} catch (error) {
			if (isUniqueViolation(error)) {
				return null;
			}
			throw error;
		}
	}

	async linkDiscord(
		accountId: string,
		discord: DiscordProfile,
	): Promise<DiscordOutcome> {
		const linked = await this.store.findByDiscord(discord.id);
		if (linked && linked.id !== accountId) {
			return "deja-lie";
		}
		try {
			return (await this.store.setDiscord(accountId, discord))
				? "lie"
				: "erreur-session";
		} catch (error) {
			if (isUniqueViolation(error)) {
				return "deja-lie";
			}
			throw error;
		}
	}

	async unlinkDiscord(
		accountId: string,
	): Promise<ServiceResult<AccountProfile>> {
		const account = await this.store.findById(accountId);
		if (!account) {
			return fail(401, "sessionExpired");
		}
		if (!account.passwordHash || !account.profile.email) {
			return fail(
				409,
				account.profile.email ? "unlinkNeedsPassword" : "unlinkDiscordOnly",
			);
		}
		const updated = await this.store.setDiscord(accountId, null);
		return updated
			? { ok: true, value: updated.profile }
			: fail(401, "sessionExpired");
	}

	history(accountId: string): Promise<MatchHistoryEntry[]> {
		return this.store.history(accountId, MATCH_HISTORY_LIMIT);
	}

	historyDetail(
		accountId: string,
		matchId: unknown,
	): Promise<MatchDetail | null> {
		if (typeof matchId !== "string" || !/^m_[\w-]{1,32}$/.test(matchId)) {
			return Promise.resolve(null);
		}
		return this.store.historyDetail(accountId, matchId);
	}

	publicProfile(
		profileId: unknown,
		viewerId: string | null = null,
	): Promise<PublicProfile | null> {
		if (
			typeof profileId !== "string" ||
			!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				profileId,
			)
		) {
			return Promise.resolve(null);
		}
		return this.store.publicProfile(profileId, PUBLIC_RECENT_LIMIT, viewerId);
	}

	recordMatch(record: MatchRecord): Promise<boolean> {
		return this.store.recordMatch(record, MATCH_HISTORY_LIMIT);
	}

	dailyBoard(date: unknown, accountId: string | null): Promise<DailyBoard> {
		return this.store.dailyBoard(
			isDailyDateKey(date) ? date : dailyDateKey(this.now()),
			accountId,
			DAILY_BOARD_LIMIT,
		);
	}

	purgeExpired(): Promise<void> {
		return this.store.deleteExpired(new Date(this.now()));
	}
}
