import { inviteUrl } from "@shared/inviteLink";
import type { LobbyState } from "@shared/protocol/lobby";
import { openOverlay } from "../../app/appStore";
import { currentMessages } from "../../i18n";
import { accountStore } from "../account/accountStore";
import { setOpenToFriends } from "../lobby/lobbyClient";
import { lobbyStore } from "../lobby/lobbyStore";
import { sessionStore } from "../network/sessionStore";
import { copyText, type MenuBuilder, type MenuSlot } from "./contextMenuStore";

export function friendsAvailable(): boolean {
	const status = accountStore.get().status;

	return status !== "loading" && status !== "disabled";
}

export function inviteSlots(lobby: LobbyState): MenuSlot[] {
	const labels = currentMessages().contextMenu.invite;
	const code = lobby.code;
	const waiting = lobby.phase === "waiting" || lobby.phase === "countdown";
	const isHost = lobby.hostId === sessionStore.get().playerId;

	return [
		code !== null && {
			kind: "action",
			id: "copy-link",
			label: labels.copyLink,
			icon: "copy",
			run: () =>
				void copyText(
					inviteUrl(window.location.origin, code),
					labels.linkCopied,
				),
		},
		code !== null && {
			kind: "action",
			id: "copy-code",
			label: labels.copyCode,
			icon: "code",
			run: () => void copyText(code, labels.codeCopied),
		},
		friendsAvailable() && {
			kind: "action",
			id: "invite-friends",
			label: labels.friends,
			icon: "users",
			disabled: !waiting,
			run: () => openOverlay("friends"),
		},
		lobby.visibility === "private" &&
			isHost && {
				kind: "action",
				id: "open-to-friends",
				label: labels.openToFriends,
				icon: "lock",
				checked: lobby.openToFriends,
				disabled: !waiting,
				run: () => setOpenToFriends(!lobby.openToFriends),
			},
	];
}

export function inviteMenu(): MenuBuilder {
	return () => {
		const lobby = lobbyStore.get().lobby;

		if (!lobby) {
			return [];
		}

		return [
			[
				{
					kind: "heading",
					id: "heading",
					label: currentMessages().contextMenu.invite.heading,
					detail: lobby.code ?? undefined,
				},
			],
			inviteSlots(lobby),
		];
	};
}
