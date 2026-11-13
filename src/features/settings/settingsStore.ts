import { DEFAULT_HAT_PATTERN, isHatPattern } from "@shared/hatPatterns";
import { DEFAULT_PLAYER_COLOR, isPlayerColor } from "@shared/playerColors";
import {
	DEFAULT_LANTERN_TINT,
	isLanternTint,
	isTagline,
} from "@shared/rewards";
import { DEFAULT_KEYS } from "../../config/defaultKeys";
import {
	COLOR_LEVELS,
	DEFAULT_POST_EFFECT_PRESET,
	POST_EFFECT_PRESETS,
} from "../../config/graphics";
import {
	browserLanguage,
	isLanguage,
	type Language,
} from "../../i18n/language";
import { isDefaultName, randomDefaultName } from "../../i18n/names";
import {
	ACTION_IDS,
	type ActionId,
	type ColorLevels,
	POST_EFFECT_IDS,
	type PlayerSettings,
	type PostEffectLevels,
	type PostEffectPreset,
} from "../../types/settings";
import { readJson, writeJson } from "../../utils/storage";
import { createStore } from "../../utils/store";

const STORAGE_KEY = "mycelium.settings.v1";
const DEFAULT_FOV = 86;
const PREVIOUS_DEFAULT_FOV = 78;

export function defaultSettings(
	language: Language = browserLanguage(),
): PlayerSettings {
	return {
		version: 1,
		language,
		playerName: randomDefaultName(language),
		playerColor: DEFAULT_PLAYER_COLOR,
		playerPattern: DEFAULT_HAT_PATTERN,
		playerLantern: DEFAULT_LANTERN_TINT,
		playerTagline: null,
		keys: { ...DEFAULT_KEYS },
		mouseSensitivity: 1,
		invertY: false,
		fov: DEFAULT_FOV,
		brightness: 1,
		quality: "medium",
		shadows: false,
		renderScale: 1,
		effects: true,
		postEffects: { ...POST_EFFECT_PRESETS[DEFAULT_POST_EFFECT_PRESET] },
		colorLevels: 127,
		fpsLimit: 0,
		headBob: true,
		reduceMotion: false,
		showFps: false,
		volumes: {
			master: 0.85,
			ambience: 0.7,
			music: 0.5,
			effects: 0.85,
			voice: 1,
		},
		micDeviceId: null,
		voiceGate: 0.06,
		termsAccepted: false,
	};
}

function clampNumber(
	value: unknown,
	min: number,
	max: number,
	fallback: number,
): number {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(max, Math.max(min, value))
		: fallback;
}

export function migrateAimKey(
	keys: Record<ActionId, string>,
	saved: Partial<Record<ActionId, string>> | undefined,
): void {
	if (!saved || typeof saved.aim === "string") {
		return;
	}
	const usedBy = (code: string, except: ActionId) =>
		(Object.keys(keys) as ActionId[]).some(
			(action) => action !== except && keys[action] === code,
		);
	if (keys.photo === DEFAULT_KEYS.aim && !usedBy(DEFAULT_KEYS.photo, "photo")) {
		keys.photo = DEFAULT_KEYS.photo;
	}
	if (usedBy(keys.aim, "aim")) {
		const free = [
			"MouseLeft",
			"MouseRight",
			"MouseMiddle",
			"KeyB",
			"KeyZ",
		].find((code) => !usedBy(code, "aim"));
		keys.aim = free ?? keys.aim;
	}
}

type StoredSettings = Partial<PlayerSettings> & { ambiance?: unknown };

function sanitizePostEffects(
	raw: StoredSettings,
	base: PostEffectLevels,
): PostEffectLevels {
	const saved = raw.postEffects;
	if (!saved || typeof saved !== "object") {
		const legacy = clampNumber(raw.ambiance, 0, 1, 1);
		return Object.fromEntries(
			POST_EFFECT_IDS.map((id) => [id, base[id] * legacy]),
		) as PostEffectLevels;
	}
	return Object.fromEntries(
		POST_EFFECT_IDS.map((id) => [id, clampNumber(saved[id], 0, 1, base[id])]),
	) as PostEffectLevels;
}

function sanitize(raw: StoredSettings | null): PlayerSettings {
	const base = defaultSettings(
		isLanguage(raw?.language) ? raw.language : undefined,
	);
	if (!raw || raw.version !== 1) {
		return base;
	}
	const keys = { ...base.keys };
	for (const action of ACTION_IDS) {
		const code = raw.keys?.[action];
		if (typeof code === "string" && code.length > 0 && code.length < 32) {
			keys[action] = code;
		}
	}
	migrateAimKey(keys, raw.keys);
	return {
		version: 1,
		language: base.language,
		playerName:
			typeof raw.playerName === "string" && raw.playerName.trim().length >= 2
				? raw.playerName.slice(0, 18)
				: base.playerName,
		playerColor: isPlayerColor(raw.playerColor)
			? raw.playerColor
			: base.playerColor,
		playerPattern: isHatPattern(raw.playerPattern)
			? raw.playerPattern
			: base.playerPattern,
		playerLantern: isLanternTint(raw.playerLantern)
			? raw.playerLantern
			: base.playerLantern,
		playerTagline: isTagline(raw.playerTagline)
			? raw.playerTagline
			: base.playerTagline,
		keys,
		mouseSensitivity: clampNumber(
			raw.mouseSensitivity,
			0.2,
			3,
			base.mouseSensitivity,
		),
		invertY: typeof raw.invertY === "boolean" ? raw.invertY : base.invertY,
		fov:
			raw.fov === PREVIOUS_DEFAULT_FOV
				? base.fov
				: clampNumber(raw.fov, 60, 100, base.fov),
		brightness: clampNumber(raw.brightness, 0.6, 1.6, base.brightness),
		quality:
			raw.quality === "low" ||
			raw.quality === "high" ||
			raw.quality === "medium"
				? raw.quality
				: base.quality,
		shadows: typeof raw.shadows === "boolean" ? raw.shadows : base.shadows,
		renderScale: clampNumber(raw.renderScale, 0.5, 1.25, base.renderScale),
		effects: typeof raw.effects === "boolean" ? raw.effects : base.effects,
		postEffects: sanitizePostEffects(raw, base.postEffects),
		colorLevels: COLOR_LEVELS.includes(raw.colorLevels as ColorLevels)
			? (raw.colorLevels as ColorLevels)
			: base.colorLevels,
		fpsLimit: clampNumber(raw.fpsLimit, 0, 240, base.fpsLimit),
		headBob: typeof raw.headBob === "boolean" ? raw.headBob : base.headBob,
		reduceMotion:
			typeof raw.reduceMotion === "boolean"
				? raw.reduceMotion
				: base.reduceMotion,
		showFps: typeof raw.showFps === "boolean" ? raw.showFps : base.showFps,
		volumes: {
			master: clampNumber(raw.volumes?.master, 0, 1, base.volumes.master),
			ambience: clampNumber(raw.volumes?.ambience, 0, 1, base.volumes.ambience),
			music: clampNumber(raw.volumes?.music, 0, 1, base.volumes.music),
			effects: clampNumber(raw.volumes?.effects, 0, 1, base.volumes.effects),
			voice: clampNumber(raw.volumes?.voice, 0, 1.5, base.volumes.voice),
		},
		micDeviceId: typeof raw.micDeviceId === "string" ? raw.micDeviceId : null,
		voiceGate: clampNumber(raw.voiceGate, 0, 0.3, base.voiceGate),
		termsAccepted: raw.termsAccepted === true,
	};
}

export const settingsStore = createStore<PlayerSettings>(
	sanitize(readJson<StoredSettings>(STORAGE_KEY)),
);

settingsStore.subscribe((state) => writeJson(STORAGE_KEY, state));

export function updateSettings(patch: Partial<PlayerSettings>): void {
	settingsStore.set(patch);
}

export function setPostEffect(id: keyof PostEffectLevels, value: number): void {
	settingsStore.set({
		postEffects: { ...settingsStore.get().postEffects, [id]: value },
	});
}

export function applyPostEffectPreset(preset: PostEffectPreset): void {
	settingsStore.set({ postEffects: { ...POST_EFFECT_PRESETS[preset] } });
}

export function matchingPostEffectPreset(
	levels: PostEffectLevels,
): PostEffectPreset | null {
	const presets = Object.keys(POST_EFFECT_PRESETS) as PostEffectPreset[];
	return (
		presets.find((preset) =>
			POST_EFFECT_IDS.every(
				(id) => Math.abs(POST_EFFECT_PRESETS[preset][id] - levels[id]) < 0.001,
			),
		) ?? null
	);
}

export function setLanguage(language: Language, renameDefault: boolean): void {
	const { playerName } = settingsStore.get();
	settingsStore.set(
		renameDefault && isDefaultName(playerName)
			? { language, playerName: randomDefaultName(language) }
			: { language },
	);
}

export function resetControls(): void {
	settingsStore.set({ keys: { ...DEFAULT_KEYS } });
}

export function resetAllSettings(): void {
	const current = settingsStore.get();
	settingsStore.replace({
		...defaultSettings(current.language),
		playerName: current.playerName,
		micDeviceId: current.micDeviceId,
	});
}

export interface BindingChange {
	swappedWith: ActionId | null;
}

export function bindKey(action: ActionId, code: string): BindingChange {
	const keys = { ...settingsStore.get().keys };
	const previous = keys[action];
	const conflict =
		(Object.keys(keys) as ActionId[]).find(
			(other) => other !== action && keys[other] === code,
		) ?? null;
	keys[action] = code;
	if (conflict) {
		keys[conflict] = previous;
	}
	settingsStore.set({ keys });
	return { swappedWith: conflict };
}
