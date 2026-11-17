import { DEFAULT_HAT_PATTERN, isHatPattern } from "@shared/hatPatterns";
import { DEFAULT_PLAYER_COLOR, isPlayerColor } from "@shared/playerColors";
import {
	DEFAULT_LANTERN_TINT,
	isLanternTint,
	isTagline,
} from "@shared/rewards";
import {
	DEFAULT_KEYS,
	DEFAULT_PAD_KEYS,
	PAD_MOVEMENT_ACTIONS,
} from "../../config/defaultKeys";
import {
	browserLanguage,
	isLanguage,
	type Language,
} from "../../i18n/language";
import { isDefaultName, randomDefaultName } from "../../i18n/names";
import {
	ACTION_IDS,
	type ActionId,
	type PlayerSettings,
	STATS_METRICS,
	type StatsCorner,
	type StatsMetric,
	type StatsOverlaySettings,
	type StatsPreset,
} from "../../types/settings";
import { readJson, writeJson } from "../../utils/storage";
import { createStore } from "../../utils/store";
import { isBindablePadCode } from "../gamepad/gamepad";

const STORAGE_KEY = "mycelium.settings.v1";
const DEFAULT_FOV = 86;
const PREVIOUS_DEFAULT_FOV = 78;
const KEYS_REVISION = 3;
const CAMERA_CLICKS_REVISION = 2;
const MIDDLE_PING_REVISION = 3;
const PREVIOUS_PING_KEY = "KeyQ";
const STATS_CORNERS: readonly StatsCorner[] = [
	"topLeft",
	"topRight",
	"bottomLeft",
	"bottomRight",
];
const FREE_KEY_CODES = [
	"MouseMiddle",
	"KeyQ",
	"KeyB",
	"KeyT",
	"KeyZ",
	"KeyH",
	"KeyJ",
	"KeyK",
	"KeyL",
	"KeyN",
	"KeyU",
	"KeyY",
	"KeyI",
	"KeyO",
	"KeyP",
];

export const STATS_PRESETS: Record<
	Exclude<StatsPreset, "off">,
	readonly StatsMetric[]
> = {
	minimal: ["fps", "ping"],
	network: ["fps", "ping", "jitter", "snapshots", "loss", "interpolation"],
	full: STATS_METRICS,
};

export function statsMetrics(
	enabled: readonly StatsMetric[],
): Record<StatsMetric, boolean> {
	return Object.fromEntries(
		STATS_METRICS.map((metric) => [metric, enabled.includes(metric)]),
	) as Record<StatsMetric, boolean>;
}

export function defaultStats(): StatsOverlaySettings {
	return {
		metrics: statsMetrics([]),
		corner: "bottomRight",
		graph: false,
		opacity: 0.85,
	};
}

export function matchingStatsPreset(
	stats: StatsOverlaySettings,
): StatsPreset | null {
	const enabled = STATS_METRICS.filter((metric) => stats.metrics[metric]);
	if (enabled.length === 0) {
		return "off";
	}
	const presets = Object.keys(STATS_PRESETS) as Exclude<StatsPreset, "off">[];
	return (
		presets.find(
			(preset) =>
				STATS_PRESETS[preset].length === enabled.length &&
				STATS_PRESETS[preset].every((metric) => stats.metrics[metric]),
		) ?? null
	);
}

export function defaultSettings(
	language: Language = browserLanguage(),
): PlayerSettings {
	return {
		version: 1,
		keysRevision: KEYS_REVISION,
		language,
		playerName: randomDefaultName(language),
		playerColor: DEFAULT_PLAYER_COLOR,
		playerPattern: DEFAULT_HAT_PATTERN,
		playerLantern: DEFAULT_LANTERN_TINT,
		playerTagline: null,
		keys: { ...DEFAULT_KEYS },
		padKeys: { ...DEFAULT_PAD_KEYS },
		mouseSensitivity: 1,
		padSensitivity: 1,
		padDeadzone: 0.15,
		invertY: false,
		fov: DEFAULT_FOV,
		brightness: 1,
		quality: "medium",
		shadows: false,
		renderScale: 0.85,
		effects: true,
		fpsLimit: 0,
		headBob: true,
		reduceMotion: false,
		stats: defaultStats(),
		volumes: {
			master: 0.85,
			ambience: 0.7,
			music: 0.5,
			effects: 0.85,
			voice: 1,
		},
		micDeviceId: null,
		speakerDeviceId: null,
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
			(action) =>
				action !== except &&
				typeof saved[action] === "string" &&
				keys[action] === code,
		);
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

export function migrateCameraClicks(
	keys: Record<ActionId, string>,
	revision: unknown,
): void {
	if (typeof revision === "number" && revision >= CAMERA_CLICKS_REVISION) {
		return;
	}
	if (keys.aim === "MouseLeft" && keys.photo === "MouseRight") {
		keys.aim = "MouseRight";
		keys.photo = "MouseLeft";
	}
}

export function migratePingKey(
	keys: Record<ActionId, string>,
	revision: unknown,
): void {
	if (
		(typeof revision === "number" && revision >= MIDDLE_PING_REVISION) ||
		keys.ping !== PREVIOUS_PING_KEY
	) {
		return;
	}
	const middleTaken = ACTION_IDS.some(
		(action) => action !== "ping" && keys[action] === "MouseMiddle",
	);
	if (!middleTaken) {
		keys.ping = "MouseMiddle";
	}
}

export function assignFreshKeys(
	keys: Record<ActionId, string>,
	saved: Partial<Record<ActionId, string>> | undefined,
): void {
	if (!saved) {
		return;
	}
	ACTION_IDS.forEach((action, index) => {
		if (typeof saved[action] === "string") {
			return;
		}
		const used = (code: string) =>
			ACTION_IDS.some((other) => other !== action && keys[other] === code);
		const settled = ACTION_IDS.some(
			(other, otherIndex) =>
				other !== action &&
				keys[other] === keys[action] &&
				(typeof saved[other] === "string" || otherIndex < index),
		);
		if (settled) {
			keys[action] = FREE_KEY_CODES.find((code) => !used(code)) ?? keys[action];
		}
	});
}

type StoredSettings = Partial<PlayerSettings> & {
	showFps?: unknown;
};

function sanitizeStats(raw: StoredSettings): StatsOverlaySettings {
	const base = defaultStats();
	const saved = raw.stats;
	if (!saved || typeof saved !== "object") {
		return raw.showFps === true
			? { ...base, metrics: statsMetrics(["fps"]) }
			: base;
	}
	const metrics = saved.metrics as Partial<Record<StatsMetric, unknown>>;
	return {
		metrics: Object.fromEntries(
			STATS_METRICS.map((metric) => [
				metric,
				typeof metrics?.[metric] === "boolean"
					? metrics[metric]
					: base.metrics[metric],
			]),
		) as Record<StatsMetric, boolean>,
		corner: STATS_CORNERS.includes(saved.corner) ? saved.corner : base.corner,
		graph: typeof saved.graph === "boolean" ? saved.graph : base.graph,
		opacity: clampNumber(saved.opacity, 0.3, 1, base.opacity),
	};
}

export function sanitizePadKeys(
	saved: Partial<Record<ActionId, unknown>> | undefined,
): Record<ActionId, string> {
	const padKeys = { ...DEFAULT_PAD_KEYS };
	if (!saved || typeof saved !== "object") {
		return padKeys;
	}
	const taken = new Set<string>();
	for (const action of ACTION_IDS) {
		const code = saved[action];
		if (PAD_MOVEMENT_ACTIONS.has(action)) {
			padKeys[action] = "";
		} else if (
			code === "" ||
			(typeof code === "string" && isBindablePadCode(code))
		) {
			padKeys[action] = code !== "" && taken.has(code) ? "" : code;
		}
		if (padKeys[action] !== "") {
			taken.add(padKeys[action]);
		}
	}
	return padKeys;
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
	migrateCameraClicks(keys, raw.keysRevision);
	migratePingKey(keys, raw.keysRevision);
	assignFreshKeys(keys, raw.keys);
	return {
		version: 1,
		keysRevision: KEYS_REVISION,
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
		padKeys: sanitizePadKeys(raw.padKeys),
		mouseSensitivity: clampNumber(
			raw.mouseSensitivity,
			0.2,
			3,
			base.mouseSensitivity,
		),
		padSensitivity: clampNumber(
			raw.padSensitivity,
			0.3,
			3,
			base.padSensitivity,
		),
		padDeadzone: clampNumber(raw.padDeadzone, 0.05, 0.4, base.padDeadzone),
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
		fpsLimit: clampNumber(raw.fpsLimit, 0, 240, base.fpsLimit),
		headBob: typeof raw.headBob === "boolean" ? raw.headBob : base.headBob,
		reduceMotion:
			typeof raw.reduceMotion === "boolean"
				? raw.reduceMotion
				: base.reduceMotion,
		stats: sanitizeStats(raw),
		volumes: {
			master: clampNumber(raw.volumes?.master, 0, 1, base.volumes.master),
			ambience: clampNumber(raw.volumes?.ambience, 0, 1, base.volumes.ambience),
			music: clampNumber(raw.volumes?.music, 0, 1, base.volumes.music),
			effects: clampNumber(raw.volumes?.effects, 0, 1, base.volumes.effects),
			voice: clampNumber(raw.volumes?.voice, 0, 1.5, base.volumes.voice),
		},
		micDeviceId: typeof raw.micDeviceId === "string" ? raw.micDeviceId : null,
		speakerDeviceId:
			typeof raw.speakerDeviceId === "string" ? raw.speakerDeviceId : null,
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

export function setLanguage(language: Language, renameDefault: boolean): void {
	const { playerName } = settingsStore.get();
	settingsStore.set(
		renameDefault && isDefaultName(playerName)
			? { language, playerName: randomDefaultName(language) }
			: { language },
	);
}

export function updateStats(patch: Partial<StatsOverlaySettings>): void {
	settingsStore.set({ stats: { ...settingsStore.get().stats, ...patch } });
}

export function setStatsMetric(metric: StatsMetric, enabled: boolean): void {
	const stats = settingsStore.get().stats;
	updateStats({ metrics: { ...stats.metrics, [metric]: enabled } });
}

export function applyStatsPreset(preset: StatsPreset): void {
	updateStats({
		metrics: statsMetrics(preset === "off" ? [] : STATS_PRESETS[preset]),
	});
}

export function resetControls(): void {
	settingsStore.set({
		keys: { ...DEFAULT_KEYS },
		padKeys: { ...DEFAULT_PAD_KEYS },
	});
}

export function resetAllSettings(): void {
	const current = settingsStore.get();
	settingsStore.replace({
		...defaultSettings(current.language),
		playerName: current.playerName,
		micDeviceId: current.micDeviceId,
		speakerDeviceId: current.speakerDeviceId,
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

export function bindPad(action: ActionId, code: string): BindingChange {
	const padKeys = { ...settingsStore.get().padKeys };
	const previous = padKeys[action];
	const conflict =
		ACTION_IDS.find(
			(other) => other !== action && code !== "" && padKeys[other] === code,
		) ?? null;
	padKeys[action] = code;
	if (conflict) {
		padKeys[conflict] = previous;
	}
	settingsStore.set({ padKeys });
	return { swappedWith: conflict };
}
