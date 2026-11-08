import type { Level } from "@shared/manor/types";
import type { CastFailureReason, PlayerInventory } from "@shared/protocol/game";
import type { Tagline } from "@shared/rewards";
import { createStore } from "../../utils/store";

export type CastPhase = "idle" | "listening" | "sent";

export interface TutorialCheck {
	label: string;
	ok: boolean;
}

export interface TutorialHud {
	checks: TutorialCheck[];
	index: number;
	total: number;
	title: string;
	body: string;
	arrow: number | null;
	distance: number | null;
	finished: boolean;
}

export interface HudFeedback {
	id: number;
	text: string;
	tone: "success" | "error" | "info" | "warning";
}

export interface LeaderboardRow {
	id: string;
	name: string;
	color: number;
	score: number;
	health: number;
	energy: number;
	alive: boolean;
	self: boolean;
	team: number | null;
	walkie: boolean;
	radio: boolean;
	tagline: Tagline | null;
}

export interface HudState {
	remainingMs: number;
	anomaliesInMs: number;
	health: number;
	energy: number;
	sprintLocked: boolean;
	energyDeniedAt: number;
	lanternOpen: boolean;
	crouching: boolean;
	prompt: string | null;
	castPhase: CastPhase;
	inventory: PlayerInventory | null;
	altarOpen: boolean;
	altarSelected: number;
	heldSlot: number;
	tutorial: TutorialHud | null;
	devMode: boolean;
	devLive: { text: string; matches: boolean };
	devCasts: DevCastEntry[];
	feedback: HudFeedback | null;
	dead: boolean;
	respawnAt: number;
	hidden: boolean;
	carried: boolean;
	spotted: number;
	gaze: number;
	haze: number;
	howlerNearby: boolean;
	slimed: boolean;
	damageAt: number;
	protectedUntil: number;
	pushReadyAt: number;
	shoutReadyAt: number;
	voiceLevel: number;
	voiceTransmitting: boolean;
	showMap: boolean;
	leaderboard: LeaderboardRow[];
	showLeaderboard: boolean;
	paused: boolean;
	fps: number;
	walkieHeld: boolean;
	walkieTalking: boolean;
	walkieSpeakers: string[];
	cameraHeld: boolean;
	cameraRaised: boolean;
	photoCount: number;
	photoFlashAt: number;
	level: Level;
	serverNow: number;
}

export interface DevCastEntry {
	id: number;
	expected: readonly string[];
	transcripts: string[];
	matchedLabel: string | null;
	result: "pending" | "ignored" | "ok" | CastFailureReason;
}

export function initialHud(): HudState {
	return {
		remainingMs: 0,
		anomaliesInMs: 0,
		health: 100,
		energy: 100,
		sprintLocked: false,
		energyDeniedAt: 0,
		lanternOpen: false,
		crouching: false,
		prompt: null,
		castPhase: "idle",
		inventory: null,
		altarOpen: false,
		altarSelected: 0,
		heldSlot: 0,
		tutorial: null,
		devMode: false,
		devLive: { text: "", matches: false },
		devCasts: [],
		feedback: null,
		dead: false,
		respawnAt: 0,
		hidden: false,
		carried: false,
		spotted: 0,
		gaze: 0,
		howlerNearby: false,
		slimed: false,
		damageAt: 0,
		protectedUntil: 0,
		pushReadyAt: 0,
		shoutReadyAt: 0,
		voiceLevel: 0,
		haze: 0,
		voiceTransmitting: false,
		showMap: false,
		leaderboard: [],
		showLeaderboard: false,
		paused: false,
		fps: 0,
		walkieHeld: false,
		walkieTalking: false,
		walkieSpeakers: [],
		cameraHeld: false,
		cameraRaised: false,
		photoCount: 0,
		photoFlashAt: 0,
		level: 0,
		serverNow: 0,
	};
}

export const hudStore = createStore<HudState>(initialHud());

let feedbackCounter = 0;

export function pushFeedback(text: string, tone: HudFeedback["tone"]): void {
	feedbackCounter += 1;
	hudStore.set({ feedback: { id: feedbackCounter, text, tone } });
}
