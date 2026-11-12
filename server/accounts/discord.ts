const AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const API_URL = "https://discord.com/api/v10";
const TIMEOUT_MS = 10_000;

export interface DiscordProfile {
	id: string;
	username: string;
	displayName: string;
	avatar: string | null;
	email: string | null;
	emailVerified: boolean;
	locale: string | null;
}

export interface DiscordClient {
	authorizeUrl(state: string, redirectUri: string): string;
	fetchProfile(code: string, redirectUri: string): Promise<DiscordProfile>;
	profileFromToken(accessToken: string): Promise<DiscordProfile>;
}

export function discordAvatarUrl(
	id: string,
	avatar: string | null,
): string | null {
	if (
		!avatar ||
		!/^[0-9]{5,25}$/.test(id) ||
		!/^(a_)?[0-9a-f]{32}$/.test(avatar)
	) {
		return null;
	}
	return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=64`;
}

function text(value: unknown, max: number): string | null {
	return typeof value === "string" && value.length > 0 && value.length <= max
		? value
		: null;
}

export function parseDiscordUser(payload: unknown): DiscordProfile {
	const user = (
		typeof payload === "object" && payload !== null ? payload : {}
	) as Record<string, unknown>;
	const id = text(user.id, 25);
	const username = text(user.username, 64);
	if (!id || !/^[0-9]+$/.test(id) || !username) {
		throw new Error("Profil Discord inattendu");
	}
	const email = text(user.email, 254);
	return {
		id,
		username,
		displayName: text(user.global_name, 64) ?? username,
		avatar: text(user.avatar, 64),
		email,
		emailVerified: Boolean(email) && user.verified === true,
		locale: text(user.locale, 16),
	};
}

async function currentUser(accessToken: string): Promise<DiscordProfile> {
	const userResponse = await fetch(`${API_URL}/users/@me`, {
		headers: { Authorization: `Bearer ${accessToken}` },
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!userResponse.ok) {
		throw new Error(`Profil Discord indisponible (${userResponse.status})`);
	}
	return parseDiscordUser(await userResponse.json());
}

export function createDiscordClient(
	clientId: string,
	clientSecret: string,
): DiscordClient {
	const credentials = { client_id: clientId, client_secret: clientSecret };
	return {
		authorizeUrl(state, redirectUri) {
			const query = new URLSearchParams({
				response_type: "code",
				client_id: clientId,
				scope: "identify email",
				state,
				redirect_uri: redirectUri,
			});
			return `${AUTHORIZE_URL}?${query.toString()}`;
		},
		async fetchProfile(code, redirectUri) {
			const tokenResponse = await fetch(`${API_URL}/oauth2/token`, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					...credentials,
					grant_type: "authorization_code",
					code,
					redirect_uri: redirectUri,
				}),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			if (!tokenResponse.ok) {
				throw new Error(
					`Échange du code Discord refusé (${tokenResponse.status})`,
				);
			}
			const token = (await tokenResponse.json()) as { access_token?: unknown };
			if (typeof token.access_token !== "string") {
				throw new Error("Jeton Discord absent");
			}
			try {
				return await currentUser(token.access_token);
			} finally {
				void fetch(`${API_URL}/oauth2/token/revoke`, {
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					body: new URLSearchParams({
						...credentials,
						token: token.access_token,
						token_type_hint: "access_token",
					}),
					signal: AbortSignal.timeout(TIMEOUT_MS),
				}).catch(() => undefined);
			}
		},
		profileFromToken(accessToken) {
			return currentUser(accessToken);
		},
	};
}
