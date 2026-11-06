import type { HatPattern } from "../hatPatterns.js";

export const FRIEND_CODE_LENGTH = 8;
export const FRIEND_LIMIT = 100;

export type FriendStatus = "offline" | "online" | "lobby" | "match";

export interface FriendPerson {
	accountId: string;
	name: string;
	color: number;
	pattern: HatPattern;
}

export interface FriendEntry extends FriendPerson {
	status: FriendStatus;
}

export interface FriendsOverview {
	friendCode: string;
	appearOffline: boolean;
	friends: FriendEntry[];
	incoming: FriendPerson[];
	outgoing: FriendPerson[];
}

export interface FriendInvite {
	fromAccountId: string;
	fromName: string;
	lobbyId: string;
	code: string | null;
}

export interface PublicLobbyPreview {
	players: { name: string; color: number; pattern: HatPattern }[];
	capacity: number;
	playing: number;
}

export function normalizeFriendCode(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const code = value
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "");
	return code.length === FRIEND_CODE_LENGTH ? code : null;
}
