import type {
	FriendEntry,
	FriendInvite,
	FriendPerson,
} from "@shared/protocol/friends";
import { showToast } from "../../app/appStore";
import { currentMessages } from "../../i18n";
import {
	acceptInvite,
	dismissInvite,
	friendsStore,
	inviteFriend,
	joinFriend,
	removeFriend,
	respondToFriend,
} from "../friends/friendsStore";
import { lobbyStore } from "../lobby/lobbyStore";
import { openProfile } from "../profile/profileViewStore";
import { copyText, type MenuBuilder, type MenuSlot } from "./contextMenuStore";

function personSlots(person: FriendPerson): MenuSlot[] {
	const labels = currentMessages().contextMenu;

	return [
		{
			kind: "action",
			id: "profile",
			label: labels.profile,
			icon: "user",
			run: () => openProfile(person.accountId),
		},
		{
			kind: "action",
			id: "copy-name",
			label: labels.copyName,
			icon: "copy",
			run: () => void copyText(person.name, labels.nameCopied),
		},
	];
}

function lobbyAccess(): { canInvite: boolean; canJoin: boolean } {
	const lobby = lobbyStore.get().lobby;

	return {
		canInvite:
			lobby !== null &&
			(lobby.phase === "waiting" || lobby.phase === "countdown"),
		canJoin:
			lobby === null ||
			(lobby.phase !== "loading" && lobby.phase !== "playing"),
	};
}

function friendActions(friend: FriendEntry): MenuSlot[] {
	const labels = currentMessages().contextMenu;
	const { canInvite, canJoin } = lobbyAccess();
	const lobbyId = friend.lobbyId;

	return [
		canJoin &&
			lobbyId !== null && {
				kind: "action",
				id: "join",
				label: labels.friend.join,
				icon: "play",
				run: () => joinFriend(lobbyId),
			},
		canInvite && {
			kind: "action",
			id: "invite",
			label: labels.friend.invite,
			icon: "userPlus",
			disabled: friend.status === "offline" || friend.status === "match",
			run: () =>
				inviteFriend(friend.accountId, (ok) => {
					if (ok) {
						showToast(labels.friend.invited(friend.name), "success");
					}
				}),
		},
	];
}

export function friendMenu(accountId: string): MenuBuilder {
	return () => {
		const labels = currentMessages();
		const overview = friendsStore.get().overview;

		const friend = overview?.friends.find(
			(entry) => entry.accountId === accountId,
		);

		if (!friend) {
			return [];
		}

		return [
			[
				{
					kind: "heading",
					id: "heading",
					label: friend.name,
					detail: labels.friends.status[friend.status],
					color: friend.color,
				},
			],
			friendActions(friend),
			personSlots(friend),
			[
				friend.codeFriend && {
					kind: "action",
					id: "remove",
					label: labels.contextMenu.removeFriend,
					confirm: labels.contextMenu.removeFriendConfirm,
					icon: "close",
					danger: true,
					run: () => removeFriend(accountId),
				},
			],
		];
	};
}

export function requestMenu(
	person: FriendPerson,
	direction: "incoming" | "outgoing",
): MenuBuilder {
	return () => {
		const labels = currentMessages().contextMenu.friend;
		const overview = friendsStore.get().overview;

		const list =
			direction === "incoming" ? overview?.incoming : overview?.outgoing;

		if (!list?.some((entry) => entry.accountId === person.accountId)) {
			return [];
		}

		return [
			[
				{
					kind: "heading",
					id: "heading",
					label: person.name,
					color: person.color,
				},
			],
			direction === "incoming"
				? [
						{
							kind: "action",
							id: "accept",
							label: labels.accept,
							icon: "check",
							run: () => respondToFriend(person.accountId, true),
						},
						{
							kind: "action",
							id: "decline",
							label: labels.decline,
							icon: "close",
							danger: true,
							run: () => respondToFriend(person.accountId, false),
						},
					]
				: [
						{
							kind: "action",
							id: "cancel",
							label: labels.cancel,
							icon: "close",
							danger: true,
							run: () => removeFriend(person.accountId),
						},
					],
			personSlots(person),
		];
	};
}

export function friendCodeMenu(code: string): MenuBuilder {
	return () => [
		[
			{
				kind: "action",
				id: "copy-code",
				label: currentMessages().contextMenu.friend.copyCode,
				icon: "copy",
				run: () => void copyText(code, currentMessages().friends.copied),
			},
		],
	];
}

export function invitationMenu(invite: FriendInvite): MenuBuilder {
	return () => {
		const labels = currentMessages().contextMenu.invitation;

		if (!friendsStore.get().invites.includes(invite)) {
			return [];
		}

		return [
			[
				{
					kind: "heading",
					id: "heading",
					label: labels.heading(invite.fromName),
				},
			],
			[
				{
					kind: "action",
					id: "join",
					label: labels.join,
					icon: "play",
					run: () => acceptInvite(invite),
				},
				{
					kind: "action",
					id: "dismiss",
					label: labels.dismiss,
					icon: "close",
					run: () => dismissInvite(invite),
				},
			],
			[
				{
					kind: "action",
					id: "profile",
					label: currentMessages().contextMenu.profile,
					icon: "user",
					run: () => openProfile(invite.fromAccountId),
				},
			],
		];
	};
}
