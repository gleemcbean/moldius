import type { HatPattern } from "../hatPatterns.js";
import type {
	AccountMessageKey,
	AccountProblem,
} from "../i18n/accountMessages.js";
import type { Language } from "../i18n/languages.js";

export const EMAIL_MAX_LENGTH = 254;
export const EMAIL_PATTERN =
	/^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const MATCH_HISTORY_LIMIT = 25;

export interface AccountStats {
	gamesPlayed: number;
	wins: number;
	bestScore: number;
	totalScore: number;
}

export interface DiscordLink {
	username: string;
	avatarUrl: string | null;
}

export interface AccountProfile {
	email: string | null;
	displayName: string;
	color: number;
	pattern: HatPattern;
	language: Language;
	createdAt: string;
	hasPassword: boolean;
	discord: DiscordLink | null;
	stats: AccountStats;
}

export const DISCORD_OUTCOMES = [
	"connecte",
	"cree",
	"lie",
	"annule",
	"indisponible",
	"erreur-etat",
	"erreur-session",
	"erreur-discord",
	"deja-lie",
	"email-existant",
] as const;

export type DiscordOutcome = (typeof DISCORD_OUTCOMES)[number];

export const DELETE_CONFIRMATIONS: Record<Language, string> = {
	fr: "SUPPRIMER",
	en: "DELETE",
};

export function isDeleteConfirmation(value: unknown): boolean {
	return Object.values(DELETE_CONFIRMATIONS).some((word) => word === value);
}

export interface MatchHistoryEntry {
	matchId: string;
	playedAt: string;
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

export interface AccountStatus {
	enabled: boolean;
	discord: boolean;
	account: AccountProfile | null;
}

export interface RegisterRequest {
	email: string;
	password: string;
	displayName: string;
	color: number;
	pattern?: HatPattern;
	language?: Language;
}

export interface LoginRequest {
	email: string;
	password: string;
}

export interface RegisterResponse {
	pending: true;
	email: string;
}

export interface EmailTokenRequest {
	token: string;
}

export interface PasswordResetRequest {
	email: string;
}

export interface PasswordResetConfirmRequest {
	token: string;
	newPassword: string;
}

export interface ProfileUpdateRequest {
	displayName?: string;
	color?: number;
	pattern?: HatPattern;
	language?: Language;
}

export interface PasswordChangeRequest {
	currentPassword: string;
	newPassword: string;
}

export interface AccountDeletionRequest {
	password?: string;
	confirmation?: string;
}

export type AccountField =
	| "email"
	| "password"
	| "newPassword"
	| "currentPassword"
	| "displayName"
	| "color"
	| "pattern"
	| "language"
	| "token"
	| "confirmation";

export interface AccountErrorBody {
	error: string;
	code: AccountMessageKey;
	field?: AccountField;
}

export function normalizeEmail(value: string): string {
	return value.trim().normalize("NFC");
}

export function emailKey(value: string): string {
	return normalizeEmail(value).toLowerCase();
}

export function validateEmail(value: string): AccountProblem | null {
	const email = normalizeEmail(value);
	if (email.length === 0) {
		return { key: "emailMissing" };
	}
	if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
		return { key: "emailInvalid" };
	}
	return null;
}

export function validatePassword(
	password: string,
	email: string,
): AccountProblem | null {
	const length = [...password].length;
	if (length < PASSWORD_MIN_LENGTH) {
		return { key: "passwordTooShort", params: { min: PASSWORD_MIN_LENGTH } };
	}
	if (length > PASSWORD_MAX_LENGTH) {
		return { key: "passwordTooLong", params: { max: PASSWORD_MAX_LENGTH } };
	}
	const lowered = password.toLowerCase();
	const localPart = emailKey(email).split("@")[0] ?? "";
	if (localPart.length >= 3 && lowered.includes(localPart)) {
		return { key: "passwordContainsEmail" };
	}
	if (new Set(password).size < 4 || COMMON_PASSWORDS.has(lowered)) {
		return { key: "passwordTooWeak" };
	}
	return null;
}

const COMMON_PASSWORDS = new Set([
	"0123456789",
	"1234567890",
	"12345678910",
	"0987654321",
	"1111111111",
	"1q2w3e4r5t",
	"azertyuiop",
	"qwertyuiop",
	"motdepasse",
	"motdepasse1",
	"motdepasse123",
	"password12",
	"password123",
	"password1234",
	"passw0rd123",
	"iloveyou12",
	"jetaime123",
	"soleil1234",
	"doudou1234",
	"football123",
	"azerty1234",
	"azerty12345",
	"qwerty1234",
	"qwerty12345",
	"abcdefghij",
	"abcd123456",
	"admin12345",
	"mycelium123",
	"champignon",
	"champignon1",
	"champignons",
]);
