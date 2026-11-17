import { settingsStore } from "../settings/settingsStore";
import {
	inputDeviceStore,
	markDevice,
	PAD_BUTTON,
	PadButtons,
	padCode,
	padFocus,
	readPad,
	stick,
} from "./gamepad";

const FOCUSABLE =
	'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const REPEAT_DELAY_MS = 380;
const REPEAT_RATE_MS = 110;
const STICK_THRESHOLD = 0.55;
const SCROLL_SPEED = 900;
const FOCUS_ATTRIBUTE = "data-pad-focus";

type Direction = "up" | "down" | "left" | "right";

const VECTORS: Record<Direction, { x: number; y: number }> = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
};

const buttons = new PadButtons();
let started = false;
let frameHandle = 0;
let lastTick = 0;
let heldDirection: Direction | null = null;
let nextRepeat = 0;
let marked: HTMLElement | null = null;

function visible(element: HTMLElement): boolean {
	if (element.closest('[aria-hidden="true"], [inert]')) {
		return false;
	}
	const rect = element.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) {
		return false;
	}
	const style = getComputedStyle(element);
	return style.visibility !== "hidden" && style.pointerEvents !== "none";
}

function activeScope(): HTMLElement {
	const scopes = [
		...document.querySelectorAll<HTMLElement>("[data-pad-scope]"),
	].filter(visible);
	if (scopes.length === 0) {
		return document.body;
	}
	const top = document.elementFromPoint(
		window.innerWidth / 2,
		window.innerHeight / 2,
	);
	const covering = scopes.filter((scope) => top && scope.contains(top));
	return covering.at(-1) ?? scopes.at(-1) ?? document.body;
}

function candidates(scope: HTMLElement): HTMLElement[] {
	return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
		(element) => element.tagName !== "CANVAS" && visible(element),
	);
}

function center(element: HTMLElement): { x: number; y: number } {
	const rect = element.getBoundingClientRect();
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function mark(element: HTMLElement | null): void {
	if (marked && marked !== element) {
		marked.removeAttribute(FOCUS_ATTRIBUTE);
	}
	marked = element;
	element?.setAttribute(FOCUS_ATTRIBUTE, "");
}

function focus(element: HTMLElement): void {
	element.focus({ preventScroll: true });
	element.scrollIntoView({ block: "nearest", inline: "nearest" });
	mark(element);
}

function currentFocus(scope: HTMLElement): HTMLElement | null {
	const active = document.activeElement;
	return active instanceof HTMLElement &&
		active !== document.body &&
		scope.contains(active) &&
		visible(active)
		? active
		: null;
}

function nudge(element: HTMLElement, direction: Direction): boolean {
	if (direction !== "left" && direction !== "right") {
		return false;
	}
	const delta = direction === "right" ? 1 : -1;
	if (element instanceof HTMLInputElement && element.type === "range") {
		if (delta > 0) {
			element.stepUp();
		} else {
			element.stepDown();
		}
		element.dispatchEvent(new Event("input", { bubbles: true }));
		element.dispatchEvent(new Event("change", { bubbles: true }));
		return true;
	}
	if (element instanceof HTMLSelectElement) {
		const next = Math.max(
			0,
			Math.min(element.options.length - 1, element.selectedIndex + delta),
		);
		if (next !== element.selectedIndex) {
			element.selectedIndex = next;
			element.dispatchEvent(new Event("change", { bubbles: true }));
		}
		return true;
	}
	return false;
}

function move(direction: Direction): void {
	const scope = activeScope();
	const options = candidates(scope);
	const current = currentFocus(scope);
	if (!current) {
		const first = [...options].sort((a, b) => {
			const ca = center(a);
			const cb = center(b);
			return ca.y - cb.y || ca.x - cb.x;
		})[0];
		if (first) {
			focus(first);
		}
		return;
	}
	if (nudge(current, direction)) {
		return;
	}
	const from = center(current);
	const vector = VECTORS[direction];
	let best: HTMLElement | null = null;
	let bestScore = Number.POSITIVE_INFINITY;
	for (const option of options) {
		if (option === current || option.contains(current)) {
			continue;
		}
		const to = center(option);
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const along = dx * vector.x + dy * vector.y;
		if (along <= 4) {
			continue;
		}
		const across = Math.abs(dx * vector.y - dy * vector.x);
		const score = along + across * 2.5;
		if (score < bestScore) {
			bestScore = score;
			best = option;
		}
	}
	if (best) {
		focus(best);
	}
}

function activate(): void {
	const scope = activeScope();
	const current = currentFocus(scope);
	if (!current) {
		move("down");
		return;
	}
	if (
		current instanceof HTMLInputElement &&
		["text", "email", "password", "search", "number"].includes(current.type)
	) {
		current.focus();
		return;
	}
	if (current instanceof HTMLTextAreaElement) {
		return;
	}
	current.click();
}

function back(): void {
	for (const type of ["keydown", "keyup"] as const) {
		window.dispatchEvent(
			new KeyboardEvent(type, {
				code: "Escape",
				key: "Escape",
				bubbles: true,
				cancelable: true,
			}),
		);
	}
}

function scrollTarget(): Element | null {
	let element: Element | null = currentFocus(activeScope());
	while (element) {
		const style = getComputedStyle(element);
		if (
			/(auto|scroll)/.test(style.overflowY) &&
			element.scrollHeight > element.clientHeight
		) {
			return element;
		}
		element = element.parentElement;
	}
	return document.scrollingElement;
}

function direction(pad: {
	buttons: boolean[];
	axes: number[];
}): Direction | null {
	if (pad.buttons[PAD_BUTTON.up]) {
		return "up";
	}
	if (pad.buttons[PAD_BUTTON.down]) {
		return "down";
	}
	if (pad.buttons[PAD_BUTTON.left]) {
		return "left";
	}
	if (pad.buttons[PAD_BUTTON.right]) {
		return "right";
	}
	const x = pad.axes[0] ?? 0;
	const y = pad.axes[1] ?? 0;
	if (Math.hypot(x, y) < STICK_THRESHOLD) {
		return null;
	}
	return Math.abs(x) > Math.abs(y)
		? x > 0
			? "right"
			: "left"
		: y > 0
			? "down"
			: "up";
}

function tick(now: number): void {
	frameHandle = requestAnimationFrame(tick);
	const dt = Math.min(0.05, Math.max(0, (now - lastTick) / 1000));
	lastTick = now;
	const pad =
		padFocus.owner === "ui" && !padFocus.captureActive ? readPad() : null;
	if (!pad) {
		buttons.reset();
		heldDirection = null;
		return;
	}
	for (const edge of buttons.update(pad.buttons, now, () => false)) {
		if (!edge.down) {
			continue;
		}
		markDevice("pad");
		if (edge.code === padCode(PAD_BUTTON.a, false)) {
			activate();
		} else if (edge.code === padCode(PAD_BUTTON.b, false)) {
			back();
		} else if (edge.code === padCode(PAD_BUTTON.start, false)) {
			if (!padFocus.onMenu?.()) {
				back();
			}
		}
	}
	const next = direction(pad);
	if (next !== heldDirection) {
		heldDirection = next;
		if (next) {
			markDevice("pad");
			move(next);
			nextRepeat = now + REPEAT_DELAY_MS;
		}
	} else if (next && now >= nextRepeat) {
		move(next);
		nextRepeat = now + REPEAT_RATE_MS;
	}
	const scroll = stick(
		pad.axes[2] ?? 0,
		pad.axes[3] ?? 0,
		settingsStore.get().padDeadzone,
	);
	if (Math.abs(scroll.y) > 0) {
		markDevice("pad");
		scrollTarget()?.scrollBy({ top: scroll.y * SCROLL_SPEED * dt });
	}
}

function onConnection(): void {
	const connected = [...(navigator.getGamepads?.() ?? [])].some(
		(pad) => pad?.connected,
	);
	inputDeviceStore.set({ connected });
	if (connected && !frameHandle) {
		lastTick = performance.now();
		frameHandle = requestAnimationFrame(tick);
	} else if (!connected && frameHandle) {
		cancelAnimationFrame(frameHandle);
		frameHandle = 0;
		markDevice("keyboard");
	}
}

export function startMenuNavigator(): void {
	if (started || typeof window === "undefined") {
		return;
	}
	started = true;
	window.addEventListener("gamepadconnected", onConnection);
	window.addEventListener("gamepaddisconnected", onConnection);
	window.addEventListener(
		"pointermove",
		(event) => {
			if (
				inputDeviceStore.get().device === "pad" &&
				Math.hypot(event.movementX, event.movementY) > 6
			) {
				markDevice("keyboard");
				mark(null);
			}
		},
		{ passive: true },
	);
	inputDeviceStore.subscribe((state) => {
		if (state.device !== "pad") {
			mark(null);
		}
	});
	onConnection();
}
