import type { HatPattern } from "../hatPatterns.js";

export type AdminLogin = "email" | "discord" | "both";

export interface AdminLiveStats {
	connected: number;
	signedIn: number;
	inLobby: number;
	inMatch: number;
	lobbies: number;
	matches: number;
	onlineAccountIds: string[];
}

export interface AdminPlayer {
	id: string;
	name: string;
	color: number;
	pattern: HatPattern;
	login: AdminLogin;
	verified: boolean;
	online: boolean;
	createdAt: string;
	lastLoginAt: string | null;
	lastSeenAt: string | null;
	lastMatchAt: string | null;
	gamesPlayed: number;
	wins: number;
	bestScore: number;
	totalScore: number;
	playtimeMs: number;
	friends: number;
}

export interface AdminHourStat {
	hour: number;
	average: number;
	peak: number;
}

export interface AdminDayStat {
	date: string;
	matches: number;
	registrations: number;
}

export interface AdminOverview {
	generatedAt: string;
	timeZone: string;
	live: Omit<AdminLiveStats, "onlineAccountIds">;
	totals: {
		accounts: number;
		verified: number;
		discord: number;
		new24h: number;
		new7d: number;
		new30d: number;
		active7d: number;
		active30d: number;
		gamesRecorded: number;
		matches: number;
		matches30d: number;
		averageDurationMs: number | null;
		averagePlayers: number | null;
		friendships: number;
	};
	presence: {
		days: number;
		samples: number;
		byHour: AdminHourStat[];
		heatmap: (number | null)[][];
		peak: { at: string; connected: number } | null;
		bestSlot: { weekday: number; hour: number; average: number } | null;
	};
	daily: AdminDayStat[];
	players: AdminPlayer[];
}
