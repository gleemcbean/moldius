import { OCCULT_IDS, type OccultId } from "@shared/config/occult";
import type { ManorEventKind } from "@shared/config/party";
import type { BrewEffect } from "@shared/manor/brews";
import type { Level } from "@shared/manor/types";
import type {
	CastFailureReason,
	PlayerInventory,
	PlayerRole,
} from "@shared/protocol/game";
import type { Tagline } from "@shared/rewards";
import { createStore } from "../../utils/store";

export type CastPhase = "idle" | "listening" | "sent";

export interface TutorialCheck {
	label: string;
	ok: boolean;
}

export interface TutorialChoice {
	key: string;
	label: string;
}

export interface TutorialHud {
	chapter: string;
	chapterIndex: number;
	chapterCount: number;
	step: number;
	steps: number;
	title: string;
	body: string;
	checks: TutorialCheck[];
	choices: TutorialChoice[];
	arrow: number | null;
	distance: number | null;
	hint: string;
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
	bounty: boolean;
	voted: boolean;
}

export interface WheelHud {
	title: string;
	labels: string[];
	colors: string[];
	selected: number | null;
}

export interface GiftHud {
	name: string;
	selected: number;
}

export interface StatsLine {
	label: string;
	value: string;
	warn: boolean;
}

export interface StatsHud {
	lines: StatsLine[];
	frames: number[];
}

export interface HudState {
	remainingMs: number;
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
	occultInPlay: readonly OccultId[];
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
	cameraAiming: boolean;
	photoCount: number;
	photoFlashAt: number;
	brew: BrewEffect | null;
	brewLeftMs: number;
	brewTotalMs: number;
	level: Level;
	serverNow: number;
	ghost: boolean;
	oneLife: boolean;
	ghostDoorReadyAt: number;
	ghostKnockReadyAt: number;
	wheel: WheelHud | null;
	gift: GiftHud | null;
	manorEvent: {
		kind: ManorEventKind;
		phase: "warning" | "start";
		startsAt: number;
		endsAt: number;
	} | null;
	bounty: { name: string; value: number; self: boolean } | null;
	ritual: { captures: number; quota: number } | null;
	role: PlayerRole | null;
	roleShownAt: number;
	powerReadyAt: number;
	noMap: boolean;
	voting: boolean;
	stats: StatsHud | null;
	pushCooldownMs: number;
	infection: InfectionHud | null;
	film: boolean;
}

export interface InfectionHud {
	until: number;
	compelled: boolean;
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
		occultInPlay: OCCULT_IDS,
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
		cameraAiming: false,
		photoCount: 0,
		photoFlashAt: 0,
		brew: null,
		brewLeftMs: 0,
		brewTotalMs: 1,
		level: 0,
		serverNow: 0,
		ghost: false,
		oneLife: false,
		ghostDoorReadyAt: 0,
		ghostKnockReadyAt: 0,
		wheel: null,
		gift: null,
		manorEvent: null,
		bounty: null,
		ritual: null,
		role: null,
		roleShownAt: 0,
		powerReadyAt: 0,
		noMap: false,
		voting: false,
		stats: null,
		pushCooldownMs: 0,
		infection: null,
		film: false,
	};
}

export const hudStore = createStore<HudState>(initialHud());

let feedbackCounter = 0;

export function pushFeedback(text: string, tone: HudFeedback["tone"]): void {
	feedbackCounter += 1;

	hudStore.set({ feedback: { id: feedbackCounter, text, tone } });
}
