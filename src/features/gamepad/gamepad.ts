import { createStore } from "../../utils/store";

export const PAD_BUTTON = {
	a: 0,
	b: 1,
	x: 2,
	y: 3,
	lb: 4,
	rb: 5,
	lt: 6,
	rt: 7,
	back: 8,
	start: 9,
	l3: 10,
	r3: 11,
	up: 12,
	down: 13,
	left: 14,
	right: 15,
	home: 16,
} as const;

export const PAD_BUTTON_COUNT = 17;
export const PAD_HOLD_MS = 320;
export const PAD_STICK_CODE = "PadLeftStick";
export const PAD_RESERVED_BUTTONS: ReadonlySet<number> = new Set([
	PAD_BUTTON.start,
	PAD_BUTTON.left,
	PAD_BUTTON.right,
	PAD_BUTTON.home,
]);

const TRIGGER_THRESHOLD = 0.35;
const PAD_CODE = /^Pad(\d{1,2})(Hold)?$/;

export interface PadSnapshot {
	buttons: boolean[];
	axes: number[];
}

export interface PadEdge {
	code: string;
	down: boolean;
}

export type InputDevice = "keyboard" | "pad";

export const inputDeviceStore = createStore<{
	device: InputDevice;
	connected: boolean;
}>({ device: "keyboard", connected: false });

export const padFocus: {
	owner: "ui" | "game";
	captureActive: boolean;
	onMenu: (() => boolean) | null;
} = { owner: "ui", captureActive: false, onMenu: null };

export function markDevice(device: InputDevice): void {
	if (inputDeviceStore.get().device !== device) {
		inputDeviceStore.set({ device });
	}
}

export function padCode(button: number, hold: boolean): string {
	return `Pad${button}${hold ? "Hold" : ""}`;
}

export function parsePadCode(
	code: string,
): { button: number; hold: boolean } | null {
	const match = PAD_CODE.exec(code);
	if (!match) {
		return null;
	}
	const button = Number(match[1]);
	return button < PAD_BUTTON_COUNT
		? { button, hold: match[2] === "Hold" }
		: null;
}

export function isBindablePadCode(code: string): boolean {
	const parsed = parsePadCode(code);
	return parsed !== null && !PAD_RESERVED_BUTTONS.has(parsed.button);
}

export function activePad(): Gamepad | null {
	const pads =
		typeof navigator !== "undefined" && navigator.getGamepads
			? navigator.getGamepads()
			: [];
	let best: Gamepad | null = null;
	for (const pad of pads) {
		if (!pad?.connected) {
			continue;
		}
		const better =
			!best ||
			(pad.mapping === "standard" && best.mapping !== "standard") ||
			(pad.mapping === best.mapping && pad.timestamp > best.timestamp);
		if (better) {
			best = pad;
		}
	}
	return best;
}

export function readPad(): PadSnapshot | null {
	const best = activePad();
	if (!best) {
		return null;
	}
	const buttons: boolean[] = [];
	for (let index = 0; index < PAD_BUTTON_COUNT; index += 1) {
		const button = best.buttons[index];
		const trigger = index === PAD_BUTTON.lt || index === PAD_BUTTON.rt;
		buttons.push(
			button
				? trigger
					? button.value > TRIGGER_THRESHOLD || button.pressed
					: button.pressed
				: false,
		);
	}
	return { buttons, axes: [...best.axes] };
}

export function stick(
	x: number,
	y: number,
	deadzone: number,
): { x: number; y: number; magnitude: number } {
	const length = Math.hypot(x, y);
	if (!Number.isFinite(length) || length <= deadzone) {
		return { x: 0, y: 0, magnitude: 0 };
	}
	const magnitude = Math.min(1, (length - deadzone) / (1 - deadzone));
	return {
		x: (x / length) * magnitude,
		y: (y / length) * magnitude,
		magnitude,
	};
}

export class PadButtons {
	private previous: boolean[] = [];
	private since: number[] = [];
	private holdFired: boolean[] = [];
	private swallowed: boolean[] = [];
	private primed = false;

	reset(): void {
		this.primed = false;
	}

	update(
		buttons: readonly boolean[],
		now: number,
		hasHold: (button: number) => boolean,
	): PadEdge[] {
		if (!this.primed) {
			this.primed = true;
			this.previous = [...buttons];
			this.since = buttons.map(() => now);
			this.holdFired = buttons.map(() => false);
			this.swallowed = [...buttons];
			return [];
		}
		const edges: PadEdge[] = [];
		buttons.forEach((down, button) => {
			const was = this.previous[button] ?? false;
			const tap = padCode(button, false);
			const hold = padCode(button, true);
			if (down && !was) {
				this.since[button] = now;
				this.holdFired[button] = false;
				this.swallowed[button] = false;
				if (!hasHold(button)) {
					edges.push({ code: tap, down: true });
				}
			} else if (down && was) {
				if (
					!this.swallowed[button] &&
					!this.holdFired[button] &&
					hasHold(button) &&
					now - (this.since[button] ?? now) >= PAD_HOLD_MS
				) {
					this.holdFired[button] = true;
					edges.push({ code: hold, down: true });
				}
			} else if (!down && was) {
				if (this.swallowed[button]) {
					this.swallowed[button] = false;
				} else if (this.holdFired[button]) {
					edges.push({ code: hold, down: false });
				} else if (hasHold(button)) {
					edges.push({ code: tap, down: true }, { code: tap, down: false });
				} else {
					edges.push({ code: tap, down: false });
				}
				this.holdFired[button] = false;
			}
		});
		this.previous = [...buttons];
		return edges;
	}
}
