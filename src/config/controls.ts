import { currentMessages } from "../i18n";
import type { ActionId } from "../types/settings";

export type ActionGroupId = "movement" | "objects" | "sabotage" | "interface";

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
		actions: ["grimoire", "lantern", "interact", "pagePrevious", "pageNext"],
	},
	{ id: "sabotage", actions: ["push", "shout"] },
	{ id: "interface", actions: ["map"] },
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

export function keyLabel(code: string): string {
	const labels = currentMessages().settings.controls;
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
