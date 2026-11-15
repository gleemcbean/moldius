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

export type ColorLevels = 185 | 127 | 104 | 86;

export const POST_EFFECT_IDS = [
	"curvature",
	"aberration",
	"bleed",
	"vignette",
	"grain",
	"scanlines",
	"dither",
	"flicker",
	"band",
	"saturation",
	"danger",
] as const;

export type PostEffectId = (typeof POST_EFFECT_IDS)[number];

export type PostEffectLevels = Record<PostEffectId, number>;

export type PostEffectPreset = "clear" | "balanced" | "vhs";

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
	mouseSensitivity: number;
	invertY: boolean;
	fov: number;
	brightness: number;
	quality: GraphicsQuality;
	shadows: boolean;
	renderScale: number;
	effects: boolean;
	postEffects: PostEffectLevels;
	colorLevels: ColorLevels;
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
