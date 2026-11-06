import type { HatPattern } from "../hatPatterns.js";
import type { MatchConfig } from "../matchConfig.js";

export type LobbyVisibility = "public" | "private";

export type LobbyPhase =
	| "waiting"
	| "countdown"
	| "loading"
	| "playing"
	| "results";

export interface LobbyPlayerInfo {
	id: string;
	name: string;
	ready: boolean;
	micReady: boolean;
	connected: boolean;
	color: number;
	pattern: HatPattern;
	team: number | null;
}

export interface LobbyState {
	id: string;
	code: string | null;
	visibility: LobbyVisibility;
	hostId: string;
	capacity: number;
	minPlayers: number;
	players: LobbyPlayerInfo[];
	config: MatchConfig;
	configEditable: boolean;
	phase: LobbyPhase;
	countdownEndsAt: number | null;
	matchId: string | null;
}

export interface JoinRequest {
	name: string;
	color?: number;
	pattern?: HatPattern;
}

export interface JoinPrivateRequest extends JoinRequest {
	code: string;
}

export type LobbyErrorCode =
	| "invalid-name"
	| "not-found"
	| "full"
	| "in-progress"
	| "not-host"
	| "not-private"
	| "not-ready"
	| "not-enough-players"
	| "microphone-required"
	| "rate-limited"
	| "already-playing"
	| "invalid-request"
	| "sign-in-required"
	| "friend-not-found"
	| "friend-self"
	| "friend-exists"
	| "friend-limit"
	| "friend-offline"
	| "friend-busy"
	| "lobby-not-invitable";

export interface LobbyError {
	code: LobbyErrorCode;
	message: string;
}

export interface SessionInfo {
	playerId: string;
	sessionToken: string;
	iceServers: IceServerConfig[];
	dev: boolean;
}

export interface IceServerConfig {
	urls: string | string[];
	username?: string;
	credential?: string;
}

export type VoiceSignal =
	| { kind: "offer"; sdp: string }
	| { kind: "answer"; sdp: string }
	| {
			kind: "candidate";
			candidate: string;
			sdpMid: string | null;
			sdpMLineIndex: number | null;
	  };

export interface VoiceSignalEnvelope {
	peerId: string;
	signal: VoiceSignal;
}
