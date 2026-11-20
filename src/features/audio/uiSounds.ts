import { audioEngine } from "./audioEngine";
import { soundBank } from "./soundBank";

const UI_SOUNDS = ["default", "confirm", "danger", "toggle", "back"] as const;

export type UiSound = (typeof UI_SOUNDS)[number];

const HOVER_GAP_MS = 45;
const CLICK_GAP_MS = 30;
const SOUND_ATTRIBUTE = "data-sound";

const HOVERABLE =
	'button, a[href], select, summary, input[type="checkbox"], input[type="radio"], input[type="range"], [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="radio"], [data-selectable]';

const TOGGLES =
	'select, input, [role="tab"], [role="switch"], [role="radio"], [role="option"]';

let lastHover = 0;
let lastClick = 0;

export function playHoverTick(pitch = 1, sound: UiSound = "default"): void {
	const now = performance.now();

	if (now - lastHover < HOVER_GAP_MS || !audioEngine.running) {
		return;
	}

	lastHover = now;

	soundBank.play(`ui-hover-${sound}`, { bus: "ui", rate: pitch });
}

export function playUiClick(sound: UiSound = "default"): void {
	const now = performance.now();

	if (now - lastClick < CLICK_GAP_MS || !audioEngine.running) {
		return;
	}

	lastClick = now;

	soundBank.play(`ui-click-${sound}`, { bus: "ui" });
}

function isUiSound(value: string | null): value is UiSound {
	return value !== null && (UI_SOUNDS as readonly string[]).includes(value);
}

function soundOf(element: Element): UiSound {
	const value =
		element.closest(`[${SOUND_ATTRIBUTE}]`)?.getAttribute(SOUND_ATTRIBUTE) ??
		null;

	if (isUiSound(value)) {
		return value;
	}

	return element.matches(TOGGLES) ? "toggle" : "default";
}

function hoverable(target: EventTarget | null): Element | null {
	if (!(target instanceof Element)) {
		return null;
	}

	const element = target.closest(HOVERABLE);

	if (!element || element.matches(':disabled, [aria-disabled="true"]')) {
		return null;
	}

	return element;
}

export function installHoverSounds(): () => void {
	const onOver = (event: PointerEvent) => {
		if (event.pointerType === "touch") {
			return;
		}

		const element = hoverable(event.target);

		if (
			!element ||
			(event.relatedTarget instanceof Node &&
				element.contains(event.relatedTarget))
		) {
			return;
		}

		playHoverTick(1, soundOf(element));
	};

	const onFocus = (event: FocusEvent) => {
		const element = hoverable(event.target);

		if (element?.matches(":focus-visible")) {
			playHoverTick(1, soundOf(element));
		}
	};

	const onClick = (event: MouseEvent) => {
		const element = hoverable(event.target);

		if (element && !element.matches('input[type="range"]')) {
			playUiClick(soundOf(element));
		}
	};

	document.addEventListener("pointerover", onOver);
	document.addEventListener("focusin", onFocus);
	document.addEventListener("click", onClick, true);

	return () => {
		document.removeEventListener("pointerover", onOver);
		document.removeEventListener("focusin", onFocus);
		document.removeEventListener("click", onClick, true);
	};
}
