import { isAppPath, readInviteLink } from "@shared/inviteLink";
import { createStore } from "../../utils/store";

function takeInviteCode(): string | null {
	const invite = readInviteLink(
		window.location.pathname,
		window.location.search,
	);
	if (!invite) {
		if (!isAppPath(window.location.pathname)) {
			window.history.replaceState(window.history.state, "", "/");
		}
		return null;
	}
	const path = isAppPath(invite.path) ? invite.path : "/";
	window.history.replaceState(
		window.history.state,
		"",
		`${path}${invite.search}${window.location.hash}`,
	);
	return invite.code;
}

export const inviteStore = createStore<{ code: string | null }>({
	code: takeInviteCode(),
});

/**
 * Pour qui n'y a pas droit, une page réservée se comporte exactement comme une
 * adresse de cinq lettres quelconque : un code d'invitation qui n'existe pas.
 */
export function treatPathAsInvite(): void {
	const code = window.location.pathname.replace(/\//g, "").toUpperCase();
	window.history.replaceState(
		window.history.state,
		"",
		`/${window.location.search}${window.location.hash}`,
	);
	inviteStore.set({ code });
}

export function consumeInvite(): void {
	inviteStore.set({ code: null });
}
