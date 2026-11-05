export interface SessionCookieOptions {
	secure: boolean;
	maxAgeSeconds: number;
}

export function sessionCookieName(secure: boolean): string {
	return secure ? "__Host-mycelium_session" : "mycelium_session";
}

export function readCookie(
	header: string | undefined,
	name: string,
): string | null {
	if (!header) {
		return null;
	}
	for (const part of header.split(";")) {
		const separator = part.indexOf("=");
		if (separator < 0) {
			continue;
		}
		if (part.slice(0, separator).trim() === name) {
			const value = part.slice(separator + 1).trim();
			return value.length > 0 && value.length <= 256 ? value : null;
		}
	}
	return null;
}

export function serializeSessionCookie(
	token: string,
	options: SessionCookieOptions,
): string {
	return [
		`${sessionCookieName(options.secure)}=${token}`,
		"Path=/",
		`Max-Age=${options.maxAgeSeconds}`,
		"HttpOnly",
		"SameSite=Strict",
		...(options.secure ? ["Secure"] : []),
	].join("; ");
}

export function serializeClearedCookie(secure: boolean): string {
	return [
		`${sessionCookieName(secure)}=`,
		"Path=/",
		"Max-Age=0",
		"HttpOnly",
		"SameSite=Strict",
		...(secure ? ["Secure"] : []),
	].join("; ");
}

export function oauthCookieName(secure: boolean): string {
	return secure ? "__Host-mycelium_oauth" : "mycelium_oauth";
}

export function serializeOAuthCookie(
	value: string,
	secure: boolean,
	maxAgeSeconds: number,
): string {
	return [
		`${oauthCookieName(secure)}=${value}`,
		"Path=/",
		`Max-Age=${maxAgeSeconds}`,
		"HttpOnly",
		"SameSite=Lax",
		...(secure ? ["Secure"] : []),
	].join("; ");
}
