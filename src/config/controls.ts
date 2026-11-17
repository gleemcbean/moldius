import {
	inputDeviceStore,
	PAD_BUTTON,
	PAD_STICK_CODE,
	padCode,
	parsePadCode,
} from "../features/gamepad/gamepad";
import { settingsStore } from "../features/settings/settingsStore";
import { currentMessages } from "../i18n";
import { ACTION_IDS, type ActionId } from "../types/settings";
import { PAD_MOVEMENT_ACTIONS } from "./defaultKeys";

export type ActionGroupId =
	| "movement"
	| "objects"
	| "sabotage"
	| "social"
	| "interface";

export const ACTION_GROUPS: { id: ActionGroupId; actions: ActionId[] }[] = [
	{
		id: "movement",
		actions: [
			"moveForward",
			"moveBackward",
			"moveLeft",
			"moveRight",
			"sprint",
			"crouch",
			"jump",
		],
	},
	{
		id: "objects",
		actions: [
			"grimoire",
			"lantern",
			"interact",
			"radio",
			"camera",
			"aim",
			"photo",
			"pagePrevious",
			"pageNext",
		],
	},
	{ id: "sabotage", actions: ["push", "shout", "power"] },
	{ id: "social", actions: ["ping", "emote"] },
	{ id: "interface", actions: ["map", "leaderboard"] },
];

export const RESERVED_CODES = new Set([
	"Escape",
	"F11",
	"F12",
	"MetaLeft",
	"MetaRight",
]);

let layoutMap: Map<string, string> | null = null;

export async function loadKeyboardLayout(): Promise<void> {
	const keyboard = (
		navigator as Navigator & {
			keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> };
		}
	).keyboard;
	if (!keyboard?.getLayoutMap) {
		return;
	}
	try {
		layoutMap = await keyboard.getLayoutMap();
	} catch {
		layoutMap = null;
	}
}

export function padActive(): boolean {
	return inputDeviceStore.get().device === "pad";
}

export function activeBindings(): Record<ActionId, string> {
	const { keys, padKeys } = settingsStore.get();
	if (!padActive()) {
		return keys;
	}
	return Object.fromEntries(
		ACTION_IDS.map((action) => [
			action,
			PAD_MOVEMENT_ACTIONS.has(action)
				? PAD_STICK_CODE
				: padKeys[action] || keys[action],
		]),
	) as Record<ActionId, string>;
}

export function backCode(): string {
	return padActive() ? padCode(PAD_BUTTON.start, false) : "Escape";
}

export function confirmCode(): string {
	return padActive() ? padCode(PAD_BUTTON.start, true) : "Enter";
}

export function keyLabel(code: string): string {
	const labels = currentMessages().settings.controls;
	if (code === PAD_STICK_CODE) {
		return labels.padStick;
	}
	const pad = parsePadCode(code);
	if (pad) {
		const button = labels.padButtons[pad.button] ?? code;
		return pad.hold ? labels.padHold(button) : button;
	}
	const named = labels.keys[code];
	const mapped = layoutMap?.get(code);
	if (mapped && mapped.trim().length > 0 && !named) {
		return mapped.toUpperCase();
	}
	if (named) {
		return named;
	}
	if (code.startsWith("Key")) {
		return code.slice(3);
	}
	if (code.startsWith("Digit")) {
		return code.slice(5);
	}
	if (code.startsWith("Numpad")) {
		return labels.numpad(code.slice(6));
	}
	return code;
}
