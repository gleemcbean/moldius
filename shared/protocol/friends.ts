import type { HatPattern } from "../hatPatterns.js";
import type { Tagline } from "../rewards.js";

export const FRIEND_CODE_LENGTH = 8;
export const FRIEND_LIMIT = 100;
export const DISCORD_FRIEND_LIMIT = 1000;

export type FriendStatus = "offline" | "online" | "lobby" | "match";

export interface FriendPerson {
	accountId: string;
	name: string;
	color: number;
	pattern: HatPattern;
	tagline: Tagline | null;
}

export interface FriendEntry extends FriendPerson {
	status: FriendStatus;
	codeFriend: boolean;
	discord: boolean;
	discordId: string | null;
	lobbyId: string | null;
}

export interface FriendsOverview {
	friendCode: string;
	appearOffline: boolean;
	discordId: string | null;
	discordSynced: boolean;
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

export function isDiscordId(value: unknown): value is string {
	return typeof value === "string" && /^[0-9]{5,25}$/.test(value);
}

const JOIN_SECRET_PREFIX = "moldius:lobby:";

export function lobbyJoinSecret(lobbyId: string): string {
	return `${JOIN_SECRET_PREFIX}${lobbyId}`;
}

export function lobbyFromJoinSecret(secret: unknown): string | null {
	if (typeof secret !== "string" || !secret.startsWith(JOIN_SECRET_PREFIX)) {
		return null;
	}
	const lobbyId = secret.slice(JOIN_SECRET_PREFIX.length);
	return /^[A-Za-z0-9_-]{1,64}$/.test(lobbyId) ? lobbyId : null;
}
