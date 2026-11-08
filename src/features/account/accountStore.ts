import type { HatPattern } from "@shared/hatPatterns";
import {
	type AccountProfile,
	DISCORD_OUTCOMES,
	type DiscordOutcome,
	type MatchDetail,
	type MatchHistoryEntry,
} from "@shared/protocol/account";
import type { LanternTint, Tagline } from "@shared/rewards";
import { openOverlay } from "../../app/appStore";
import type { AccountNoticeKey } from "../../i18n/sections/account";
import { createStore } from "../../utils/store";
import { reconnectSocket } from "../network/connection";
import { settingsStore, updateSettings } from "../settings/settingsStore";
import { type ApiResult, accountApi } from "./accountApi";

export type AccountStatusKind =
	| "loading"
	| "disabled"
	| "unavailable"
	| "guest"
	| "signed-in";

export interface AccountNotice {
	tone: "success" | "error";
	key?: AccountNoticeKey;
	text?: string;
}

export interface AccountState {
	status: AccountStatusKind;
	account: AccountProfile | null;
	notice: AccountNotice | null;
	resetToken: string | null;
	discordEnabled: boolean;
}

export const accountStore = createStore<AccountState>({
	status: "loading",
	account: null,
	notice: null,
	resetToken: null,
	discordEnabled: false,
});

const DISCORD_PATTERN = /^#discord=([a-z-]+)$/;

const DISCORD_SUCCESS: readonly DiscordOutcome[] = ["connecte", "cree", "lie"];

const LINK_PATTERN = /^#(verifier|reinitialiser)=([A-Za-z0-9_-]{43})$/;

const PROFILE_SYNC_DELAY_MS = 900;

let initialized = false;
let syncTimer = 0;

function signedIn(account: AccountProfile): void {
	accountStore.set({ status: "signed-in", account });
	updateSettings({
		playerName: account.displayName,
		playerColor: account.color,
		playerPattern: account.pattern,
		playerLantern: account.lantern,
		playerTagline: account.tagline,
		language: account.language,
		...(account.termsAcceptedAt ? { termsAccepted: true } : {}),
	});
}

function signedOut(): void {
	accountStore.set({ status: "guest", account: null });
}

export async function refreshAccount(): Promise<void> {
	const result = await accountApi.status();
	if (!result.ok) {
		accountStore.set({ status: "unavailable", account: null });
		return;
	}
	accountStore.set({ discordEnabled: result.value.discord });
	if (!result.value.enabled) {
		accountStore.set({ status: "disabled", account: null });
		return;
	}
	if (result.value.account) {
		signedIn(result.value.account);
	} else {
		signedOut();
	}
}

/**
 * Sur un compte, seul l'accord enregistré compte : celui d'un visiteur sur le même
 * appareil n'est pas forcément venu de cette personne, on le redemande donc.
 */
export function termsAccepted(
	account: { status: string; account: AccountProfile | null },
	localChoice: boolean,
): boolean {
	return account.status === "signed-in"
		? Boolean(account.account?.termsAcceptedAt)
		: localChoice;
}

export async function acceptTerms(): Promise<boolean> {
	if (accountStore.get().status === "signed-in") {
		const result = await accountApi.acceptTerms();
		if (result.ok) {
			accountStore.set({ account: result.value.account });
		} else if (result.status === 401) {
			signedOut();
		} else {
			return false;
		}
	}
	updateSettings({ termsAccepted: true });
	return true;
}

function scheduleProfileSync(): void {
	window.clearTimeout(syncTimer);
	syncTimer = window.setTimeout(() => {
		const { account, status } = accountStore.get();
		const settings = settingsStore.get();
		const displayName = settings.playerName.trim();
		if (status !== "signed-in" || !account || displayName.length < 2) {
			return;
		}
		if (
			displayName === account.displayName &&
			settings.playerColor === account.color &&
			settings.playerPattern === account.pattern &&
			settings.playerLantern === account.lantern &&
			settings.playerTagline === account.tagline &&
			settings.language === account.language
		) {
			return;
		}
		void accountApi
			.updateProfile({
				displayName,
				color: settings.playerColor,
				pattern: settings.playerPattern,
				lantern: settings.playerLantern,
				tagline: settings.playerTagline,
				language: settings.language,
			})
			.then((result) => {
				if (result.ok) {
					accountStore.set({ account: result.value.account });
				} else if (result.status === 401) {
					signedOut();
				}
			});
	}, PROFILE_SYNC_DELAY_MS);
}

function readDiscordResult(): boolean {
	const match = DISCORD_PATTERN.exec(window.location.hash);
	if (!match) {
		return false;
	}
	window.history.replaceState(
		null,
		"",
		window.location.pathname + window.location.search,
	);
	const outcome = DISCORD_OUTCOMES.find((candidate) => candidate === match[1]);
	if (!outcome) {
		return true;
	}
	const local = settingsStore.get();
	openOverlay("account");
	const success = DISCORD_SUCCESS.includes(outcome);
	accountStore.set({
		notice: { tone: success ? "success" : "error", key: outcome },
	});
	if (success) {
		void refreshAccount().then(() => {
			reconnectSocket();
			if (outcome === "cree" && local.playerName.trim().length >= 2) {
				void saveProfile(
					local.playerName.trim(),
					local.playerColor,
					local.playerPattern,
					local.playerLantern,
					local.playerTagline,
				);
			}
		});
	}
	return true;
}

function readEmailLink(): void {
	if (readDiscordResult()) {
		return;
	}
	const match = LINK_PATTERN.exec(window.location.hash);
	if (!match) {
		return;
	}
	window.history.replaceState(
		null,
		"",
		window.location.pathname + window.location.search,
	);
	const [, kind, token] = match;
	openOverlay("account");
	if (kind === "reinitialiser") {
		accountStore.set({ resetToken: token, notice: null });
		return;
	}
	void accountApi.verifyEmail({ token }).then((result) => {
		if (result.ok) {
			signedIn(result.value.account);
			reconnectSocket();
			accountStore.set({
				notice: { tone: "success", key: "emailConfirmed" },
			});
		} else {
			accountStore.set({ notice: { tone: "error", text: result.error } });
		}
	});
}

export function clearAccountNotice(): void {
	accountStore.set({ notice: null });
}

export function initAccount(): void {
	if (initialized) {
		return;
	}
	initialized = true;
	void refreshAccount();
	readEmailLink();
	window.addEventListener("hashchange", readEmailLink);
	settingsStore.subscribe((state, previous) => {
		if (
			state.playerName !== previous.playerName ||
			state.playerColor !== previous.playerColor ||
			state.playerPattern !== previous.playerPattern ||
			state.playerLantern !== previous.playerLantern ||
			state.playerTagline !== previous.playerTagline ||
			state.language !== previous.language
		) {
			scheduleProfileSync();
		}
	});
}

function afterAuthentication(
	result: ApiResult<{ account: AccountProfile }>,
): ApiResult<null> {
	if (!result.ok) {
		return result;
	}
	signedIn(result.value.account);
	reconnectSocket();
	return { ok: true, value: null };
}

export async function login(
	email: string,
	password: string,
): Promise<ApiResult<null>> {
	return afterAuthentication(await accountApi.login({ email, password }));
}

export async function register(
	email: string,
	password: string,
): Promise<ApiResult<string>> {
	const settings = settingsStore.get();
	const result = await accountApi.register({
		email,
		password,
		displayName: settings.playerName.trim(),
		color: settings.playerColor,
		pattern: settings.playerPattern,
		language: settings.language,
	});
	return result.ok ? { ok: true, value: result.value.email } : result;
}

export async function requestPasswordReset(
	email: string,
): Promise<ApiResult<null>> {
	const result = await accountApi.requestPasswordReset({ email });
	return result.ok ? { ok: true, value: null } : result;
}

export async function confirmPasswordReset(
	token: string,
	newPassword: string,
): Promise<ApiResult<null>> {
	const result = afterAuthentication(
		await accountApi.confirmPasswordReset({ token, newPassword }),
	);
	if (result.ok) {
		accountStore.set({ resetToken: null });
	}
	return result;
}

export function cancelPasswordReset(): void {
	accountStore.set({ resetToken: null });
}

export async function saveProfile(
	displayName: string,
	color: number,
	pattern: HatPattern,
	lantern: LanternTint,
	tagline: Tagline | null,
): Promise<ApiResult<null>> {
	const result = await accountApi.updateProfile({
		displayName,
		color,
		pattern,
		lantern,
		tagline,
	});
	if (!result.ok) {
		if (result.status === 401) {
			signedOut();
		}
		return result;
	}
	signedIn(result.value.account);
	return { ok: true, value: null };
}

/** S'enregistre aussitôt, sans attendre le reste du formulaire de profil. */
export async function setPrivateProfile(
	privateProfile: boolean,
): Promise<ApiResult<null>> {
	const result = await accountApi.updateProfile({ privateProfile });
	if (!result.ok) {
		if (result.status === 401) {
			signedOut();
		}
		return result;
	}
	signedIn(result.value.account);
	return { ok: true, value: null };
}

export async function logout(): Promise<void> {
	await accountApi.logout();
	signedOut();
	reconnectSocket();
}

export async function changePassword(
	currentPassword: string,
	newPassword: string,
): Promise<ApiResult<null>> {
	const result = await accountApi.changePassword({
		currentPassword,
		newPassword,
	});
	if (!result.ok) {
		return result;
	}
	accountStore.set({ account: result.value.account });
	reconnectSocket();
	return { ok: true, value: null };
}

export function startDiscord(mode: "login" | "link"): void {
	const query = new URLSearchParams({
		mode,
		lang: settingsStore.get().language,
	});
	window.location.assign(`/api/account/discord/start?${query.toString()}`);
}

export async function unlinkDiscord(): Promise<ApiResult<null>> {
	const result = await accountApi.unlinkDiscord();
	if (!result.ok) {
		return result;
	}
	accountStore.set({ account: result.value.account });
	return { ok: true, value: null };
}

export async function deleteAccount(
	password: string,
	confirmation: string,
): Promise<ApiResult<null>> {
	const result = await accountApi.remove({ password, confirmation });
	if (result.ok) {
		signedOut();
		reconnectSocket();
	}
	return result;
}

export async function loadHistory(): Promise<ApiResult<MatchHistoryEntry[]>> {
	const result = await accountApi.history();
	if (!result.ok) {
		if (result.status === 401) {
			signedOut();
		}
		return result;
	}
	return { ok: true, value: result.value.entries };
}

export async function loadHistoryDetail(
	matchId: string,
): Promise<ApiResult<MatchDetail>> {
	const result = await accountApi.historyDetail(matchId);
	if (!result.ok) {
		if (result.status === 401) {
			signedOut();
		}
		return result;
	}
	return { ok: true, value: result.value.match };
}
