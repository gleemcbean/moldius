import { readInviteLink } from "@shared/inviteLink";
import { createStore } from "../../utils/store";

function takeInviteCode(): string | null {
	const invite = readInviteLink(
		window.location.pathname,
		window.location.search,
	);
	if (!invite) {
		return null;
	}
	window.history.replaceState(
		window.history.state,
		"",
		`${invite.path}${invite.search}${window.location.hash}`,
	);
	return invite.code;
}

export const inviteStore = createStore<{ code: string | null }>({
	code: takeInviteCode(),
});

export function consumeInvite(): void {
	inviteStore.set({ code: null });
}
