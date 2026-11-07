import { DEFAULT_HAT_PATTERN, isHatPattern } from "@shared/hatPatterns";
import { DEFAULT_PLAYER_COLOR, isPlayerColor } from "@shared/playerColors";
import { DEFAULT_LANTERN_TINT, isLanternTint } from "@shared/rewards";
import { DEFAULT_KEYS } from "../../config/defaultKeys";
import { COLOR_LEVELS } from "../../config/graphics";
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
	type PlayerSettings,
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
		keys: { ...DEFAULT_KEYS },
		mouseSensitivity: 1,
		invertY: false,
		fov: DEFAULT_FOV,
		brightness: 1,
		quality: "medium",
		shadows: false,
		renderScale: 1,
		effects: true,
		ambiance: 1,
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

function sanitize(raw: Partial<PlayerSettings> | null): PlayerSettings {
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
		ambiance: clampNumber(raw.ambiance, 0, 1, base.ambiance),
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
	sanitize(readJson<PlayerSettings>(STORAGE_KEY)),
);

settingsStore.subscribe((state) => writeJson(STORAGE_KEY, state));

export function updateSettings(patch: Partial<PlayerSettings>): void {
	settingsStore.set(patch);
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
