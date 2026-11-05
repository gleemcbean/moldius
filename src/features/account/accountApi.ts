import type {
	AccountDeletionRequest,
	AccountErrorBody,
	AccountProfile,
	AccountStatus,
	EmailTokenRequest,
	LoginRequest,
	MatchHistoryEntry,
	PasswordChangeRequest,
	PasswordResetConfirmRequest,
	PasswordResetRequest,
	ProfileUpdateRequest,
	RegisterRequest,
	RegisterResponse,
} from "@shared/protocol/account";
import { currentLanguage, currentMessages } from "../../i18n";

export type ApiResult<T> =
	| { ok: true; value: T }
	| {
			ok: false;
			status: number;
			error: string;
			field?: AccountErrorBody["field"];
	  };

async function request<T>(
	method: string,
	path: string,
	body?: object,
): Promise<ApiResult<T>> {
	let response: Response;
	try {
		response = await fetch(`/api/account${path}`, {
			method,
			credentials: "same-origin",
			cache: "no-store",
			headers: {
				"X-Mycelium-Lang": currentLanguage(),
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
		});
	} catch {
		return { ok: false, status: 0, error: currentMessages().account.network };
	}
	if (response.status === 204) {
		return { ok: true, value: null as T };
	}
	const payload = (await response.json().catch(() => null)) as
		| (T & Partial<AccountErrorBody>)
		| null;
	if (!response.ok || !payload) {
		return {
			ok: false,
			status: response.status,
			error: payload?.error ?? currentMessages().account.unexpected,
			...(payload?.field ? { field: payload.field } : {}),
		};
	}
	return { ok: true, value: payload };
}

export const accountApi = {
	status: () => request<AccountStatus>("GET", "/me"),
	register: (input: RegisterRequest) =>
		request<RegisterResponse>("POST", "/register", input),
	verifyEmail: (input: EmailTokenRequest) =>
		request<{ account: AccountProfile }>("POST", "/verify-email", input),
	login: (input: LoginRequest) =>
		request<{ account: AccountProfile }>("POST", "/login", input),
	requestPasswordReset: (input: PasswordResetRequest) =>
		request<{ sent: true }>("POST", "/password-reset/request", input),
	confirmPasswordReset: (input: PasswordResetConfirmRequest) =>
		request<{ account: AccountProfile }>(
			"POST",
			"/password-reset/confirm",
			input,
		),
	logout: () => request<null>("POST", "/logout", {}),
	updateProfile: (input: ProfileUpdateRequest) =>
		request<{ account: AccountProfile }>("PATCH", "/profile", input),
	changePassword: (input: PasswordChangeRequest) =>
		request<{ account: AccountProfile }>("POST", "/password", input),
	remove: (input: AccountDeletionRequest) => request<null>("DELETE", "", input),
	unlinkDiscord: () =>
		request<{ account: AccountProfile }>("POST", "/discord/unlink", {}),
	history: () => request<{ entries: MatchHistoryEntry[] }>("GET", "/history"),
};
