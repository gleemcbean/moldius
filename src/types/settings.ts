import type { HatPattern } from "@shared/hatPatterns";
import type { Language } from "@shared/i18n/languages";
import type { LanternTint, Tagline } from "@shared/rewards";

export const ACTION_IDS = [
	"moveForward",
	"moveBackward",
	"moveLeft",
	"moveRight",
	"sprint",
	"crouch",
	"jump",
	"grimoire",
	"lantern",
	"interact",
	"push",
	"shout",
	"radio",
	"camera",
	"aim",
	"photo",
	"map",
	"leaderboard",
	"pagePrevious",
	"pageNext",
	"ping",
	"emote",
	"power",
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

export type GraphicsQuality = "low" | "medium" | "high";

export const STATS_METRICS = [
	"fps",
	"frameTime",
	"ping",
	"jitter",
	"snapshots",
	"loss",
	"interpolation",
	"drawCalls",
	"triangles",
	"memory",
	"voice",
] as const;

export type StatsMetric = (typeof STATS_METRICS)[number];

export type StatsCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export type StatsPreset = "off" | "minimal" | "network" | "full";

export interface StatsOverlaySettings {
	metrics: Record<StatsMetric, boolean>;
	corner: StatsCorner;
	graph: boolean;
	opacity: number;
}

export interface VolumeSettings {
	master: number;
	ambience: number;
	music: number;
	effects: number;
	voice: number;
}

export interface PlayerSettings {
	version: 1;
	keysRevision: number;
	language: Language;
	playerName: string;
	playerColor: number;
	playerPattern: HatPattern;
	playerLantern: LanternTint;
	playerTagline: Tagline | null;
	keys: Record<ActionId, string>;
	padKeys: Record<ActionId, string>;
	mouseSensitivity: number;
	padSensitivity: number;
	padDeadzone: number;
	padVibration: number;
	invertY: boolean;
	fov: number;
	brightness: number;
	quality: GraphicsQuality;
	shadows: boolean;
	renderScale: number;
	effects: boolean;
	fpsLimit: number;
	headBob: boolean;
	reduceMotion: boolean;
	stats: StatsOverlaySettings;
	volumes: VolumeSettings;
	micDeviceId: string | null;
	speakerDeviceId: string | null;
	voiceGate: number;
	termsAccepted: boolean;
}
