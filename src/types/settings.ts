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
	"photo",
	"map",
	"leaderboard",
	"pagePrevious",
	"pageNext",
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

export type GraphicsQuality = "low" | "medium" | "high";

export type ColorLevels = 185 | 127 | 104;

export interface VolumeSettings {
	master: number;
	ambience: number;
	music: number;
	effects: number;
	voice: number;
}

export interface PlayerSettings {
	version: 1;
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
	ambiance: number;
	colorLevels: ColorLevels;
	fpsLimit: number;
	headBob: boolean;
	reduceMotion: boolean;
	showFps: boolean;
	volumes: VolumeSettings;
	micDeviceId: string | null;
	voiceGate: number;
	termsAccepted: boolean;
}
