import type { LobbyPlayerInfo, LobbyState } from "@shared/protocol/lobby";
import { showToast } from "../../app/appStore";
import { currentMessages } from "../../i18n";
import { accountStore } from "../account/accountStore";
import {
	friendsStore,
	removeFriend,
	requestFriend,
	respondToFriend,
} from "../friends/friendsStore";
import {
	assignPlayerTeam,
	chooseTeam,
	kickPlayer,
	leaveLobby,
	promotePlayer,
	setReady,
} from "../lobby/lobbyClient";
import { lobbyStore } from "../lobby/lobbyStore";
import { sessionStore } from "../network/sessionStore";
import { openProfile } from "../profile/profileViewStore";
import { openSettings } from "../settings/settingsTab";
import { micIsUsable, micStore } from "../voice/micManager";
import { leaveVoice } from "../voice/voiceController";
import {
	isPeerMuted,
	MAX_PEER_VOLUME,
	peerVolume,
	setPeerMuted,
	setPeerVolume,
} from "../voice/voicePrefs";
import { copyText, type MenuBuilder, type MenuSlot } from "./contextMenuStore";

export type PlayerMenuPlace = "lobby" | "match" | "results";

export interface PlayerTarget {
	playerId: string;
	name: string;
	profileId?: string | null;
	color?: number;
}

interface PlayerContext {
	target: PlayerTarget;
	lobby: LobbyState | null;
	member: LobbyPlayerInfo | null;
	selfId: string | null;
	self: boolean;
	place: PlayerMenuPlace;
}

function headingOf({ target, lobby, member, self }: PlayerContext): MenuSlot {
	const labels = currentMessages();

	const detail = self
		? labels.contextMenu.you
		: member && lobby?.hostId === member.id
			? labels.contextMenu.host
			: member && !member.connected
				? labels.contextMenu.disconnected
				: member && member.team !== null
					? labels.common.teams[member.team]
					: undefined;

	return {
		kind: "heading",
		id: "heading",
		label: member?.name ?? target.name,
		detail,
		color: member?.color ?? target.color,
	};
}

function friendSlots({
	target,
	lobby,
	selfId,
	self,
}: PlayerContext): MenuSlot[] {
	const labels = currentMessages().contextMenu;
	const profileId = target.profileId ?? null;

	const ownProfile =
		lobby?.players.find((player) => player.id === selfId)?.profileId ?? null;

	if (
		self ||
		!profileId ||
		profileId === ownProfile ||
		accountStore.get().status !== "signed-in"
	) {
		return [];
	}

	const overview = friendsStore.get().overview;

	const friend = overview?.friends.find(
		(entry) => entry.accountId === profileId,
	);

	const incoming = overview?.incoming.some(
		(entry) => entry.accountId === profileId,
	);

	const outgoing = overview?.outgoing.some(
		(entry) => entry.accountId === profileId,
	);

	if (friend) {
		return [
			friend.codeFriend && {
				kind: "action",
				id: "friend-remove",
				label: labels.removeFriend,
				confirm: labels.removeFriendConfirm,
				icon: "users",
				danger: true,
				run: () => removeFriend(profileId),
			},
		];
	}

	if (incoming) {
		return [
			{
				kind: "action",
				id: "friend-accept",
				label: labels.acceptFriend,
				icon: "userPlus",
				run: () => respondToFriend(profileId, true),
			},
		];
	}

	return [
		{
			kind: "action",
			id: "friend-add",
			label: outgoing ? labels.friendPending : labels.addFriend,
			icon: "userPlus",
			disabled: outgoing,
			run: () =>
				requestFriend(profileId, (ok) => {
					if (ok) {
						showToast(labels.friendRequested(target.name), "success");
					}
				}),
		},
	];
}

function identitySlots(context: PlayerContext): MenuSlot[] {
	const labels = currentMessages().contextMenu;
	const profileId = context.target.profileId ?? null;

	return [
		profileId !== null && {
			kind: "action",
			id: "profile",
			label: labels.profile,
			icon: "user",
			run: () => openProfile(profileId),
		},
		...friendSlots(context),
		{
			kind: "action",
			id: "copy-name",
			label: labels.copyName,
			icon: "copy",
			run: () => void copyText(context.target.name, labels.nameCopied),
		},
	];
}

function voiceSlots({ target, member, self }: PlayerContext): MenuSlot[] {
	const labels = currentMessages().contextMenu;
	const id = target.playerId;

	if (self || !member?.connected) {
		return [];
	}

	const muted = isPeerMuted(id);

	return [
		{
			kind: "action",
			id: "mute",
			label: muted ? labels.unmute : labels.mute,
			icon: muted ? "speaker" : "speakerOff",
			checked: muted,
			run: () => {
				if (!muted) {
					setPeerMuted(id, true);
				} else if (peerVolume(id) === 0) {
					setPeerVolume(id, 1);
				} else {
					setPeerMuted(id, false);
				}
			},
		},
		{
			kind: "range",
			id: "volume",
			label: labels.volume,
			icon: "speaker",
			value: muted ? 0 : Math.round(peerVolume(id) * 100),
			min: 0,
			max: MAX_PEER_VOLUME * 100,
			step: 10,
			format: labels.volumeValue,
			change: (value) => setPeerVolume(id, value / 100),
		},
	];
}

function selfSlots({ lobby, member, self, place }: PlayerContext): MenuSlot[] {
	const labels = currentMessages();

	if (!self || !lobby || !member || place !== "lobby") {
		return [];
	}

	const waiting = lobby.phase === "waiting" || lobby.phase === "countdown";
	const teams = lobby.phase === "waiting" ? lobby.config.teamCount : 0;

	return [
		waiting && {
			kind: "action",
			id: "ready",
			label: member.ready
				? labels.contextMenu.notReady
				: labels.contextMenu.ready,
			icon: "check",
			checked: member.ready,
			disabled: !member.ready && !micIsUsable(micStore.get().status),
			run: () => setReady(!member.ready),
		},
		...Array.from({ length: teams }, (_, team): MenuSlot => {
			return (
				team !== member.team && {
					kind: "action",
					id: `team-${team}`,
					label: labels.contextMenu.joinTeam(labels.common.teams[team]),
					icon: "flag",
					run: () => chooseTeam(team),
				}
			);
		}),
		{
			kind: "action",
			id: "audio",
			label: labels.contextMenu.audioSettings,
			icon: "mic",
			run: () => openSettings("audio"),
		},
		{
			kind: "action",
			id: "leave",
			label: labels.contextMenu.leaveLobby,
			confirm: labels.contextMenu.leaveLobbyConfirm,
			icon: "door",
			danger: true,
			run: () => {
				leaveVoice();
				leaveLobby();
			},
		},
	];
}

function hostSlots({
	target,
	lobby,
	member,
	selfId,
	self,
	place,
}: PlayerContext): MenuSlot[] {
	const labels = currentMessages();

	if (
		self ||
		!lobby ||
		!member ||
		lobby.visibility !== "private" ||
		lobby.hostId !== selfId
	) {
		return [];
	}

	const teams =
		lobby.phase === "waiting" && place !== "match" ? lobby.config.teamCount : 0;

	const name = member.name;

	return [
		{
			kind: "action",
			id: "promote",
			label: labels.contextMenu.promote,
			confirm: labels.contextMenu.promoteConfirm,
			icon: "crown",
			disabled: !member.connected,
			run: () =>
				promotePlayer(target.playerId, () =>
					showToast(labels.contextMenu.promoted(name), "success"),
				),
		},
		...Array.from({ length: teams }, (_, team): MenuSlot => {
			return (
				team !== member.team && {
					kind: "action",
					id: `move-${team}`,
					label: labels.contextMenu.moveToTeam(labels.common.teams[team]),
					icon: "flag",
					run: () => assignPlayerTeam(target.playerId, team),
				}
			);
		}),
		{
			kind: "action",
			id: "kick",
			label: labels.contextMenu.kick,
			confirm: labels.contextMenu.kickConfirm,
			icon: "door",
			danger: true,
			run: () =>
				kickPlayer(target.playerId, false, () =>
					showToast(labels.contextMenu.kicked(name), "info"),
				),
		},
		{
			kind: "action",
			id: "ban",
			label: labels.contextMenu.ban,
			confirm: labels.contextMenu.banConfirm,
			icon: "ban",
			danger: true,
			run: () =>
				kickPlayer(target.playerId, true, () =>
					showToast(labels.contextMenu.banned(name), "info"),
				),
		},
	];
}

export function playerMenu(
	target: PlayerTarget,
	place: PlayerMenuPlace,
): MenuBuilder {
	return () => {
		const lobby = lobbyStore.get().lobby;
		const selfId = sessionStore.get().playerId;

		const member =
			lobby?.players.find((player) => player.id === target.playerId) ?? null;

		const context: PlayerContext = {
			target: {
				...target,
				profileId: member?.profileId ?? target.profileId ?? null,
			},
			lobby,
			member,
			selfId,
			self: target.playerId === selfId,
			place,
		};

		return [
			[headingOf(context)],
			identitySlots(context),
			voiceSlots(context),
			selfSlots(context),
			hostSlots(context),
		];
	};
}
