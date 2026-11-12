import { PRIVATE_CODE_LENGTH } from "./config/index.js";

export const INVITE_PARAM = "lobby";

const RESERVED_PATHS = new Set(["terms", "privacy", "admin"]);

export function isAppPath(pathname: string): boolean {
	const path = pathname.replace(/\/+$/, "");
	return path === "" || RESERVED_PATHS.has(path.slice(1));
}

export interface InviteLink {
	code: string | null;
	path: string;
	search: string;
}

export function inviteUrl(origin: string, code: string): string {
	return `${origin}/${code}`;
}

export function readInviteLink(
	pathname: string,
	search: string,
): InviteLink | null {
	const params = new URLSearchParams(search);
	const segment = /^\/([A-Za-z0-9]+)\/?$/.exec(pathname)?.[1] ?? null;
	const fromPath =
		segment !== null &&
		segment.length === PRIVATE_CODE_LENGTH &&
		!RESERVED_PATHS.has(segment)
			? segment
			: null;
	if (fromPath === null && !params.has(INVITE_PARAM)) {
		return null;
	}
	const code = (fromPath ?? params.get(INVITE_PARAM) ?? "")
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
	params.delete(INVITE_PARAM);
	const query = params.toString();
	return {
		code: code.length === PRIVATE_CODE_LENGTH ? code : null,
		path: fromPath === null ? pathname : "/",
		search: query ? `?${query}` : "",
	};
}

export function inviteCodeFromText(
	text: string,
	origin: string,
): string | null {
	let url: URL;
	try {
		url = new URL(text.trim());
	} catch {
		return null;
	}
	if (url.origin !== origin) {
		return null;
	}
	return readInviteLink(url.pathname, url.search)?.code ?? null;
}
