import { createStore } from "../../utils/store";
import { settingsStore } from "../settings/settingsStore";
import {
	inputDeviceStore,
	markDevice,
	PAD_BUTTON,
	PadButtons,
	padCode,
	padFocus,
	parsePadCode,
	readPad,
	stick,
} from "./gamepad";
import { rumble } from "./rumble";
import { isTextTarget, openPadKeyboard } from "./textEntry";

const FOCUSABLE =
	'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const REPEAT_DELAY_MS = 380;
const REPEAT_RATE_MS = 110;
const BUTTON_REPEAT_DELAY_MS = 450;
const BUTTON_REPEAT_RATE_MS = 70;
const REPEAT_ATTRIBUTE = "data-pad-repeat";
const STICK_THRESHOLD = 0.55;
const SCROLL_SPEED = 900;
const FOCUS_ATTRIBUTE = "data-pad-focus";
const SCOPE_CHECK_MS = 150;
const MOUSE_TRAVEL_THRESHOLD = 12;
const MOUSE_TRAVEL_WINDOW_MS = 250;
const TABS = "[data-pad-tabs]";
const RADIO = '[role="radio"]:not([disabled])';

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
let repeatButton: number | null = null;
let nextButtonRepeat = 0;
let marked: HTMLElement | null = null;
let nextScopeCheck = 0;
let mouseTravel = 0;
let mouseTravelAt = 0;

export const padHintsStore = createStore<{ visible: boolean; tabs: boolean }>({
	visible: false,
	tabs: false,
});

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
	const priority = scopes.filter((scope) =>
		scope.hasAttribute("data-pad-priority"),
	);
	if (priority.length > 0) {
		return priority.at(-1) as HTMLElement;
	}
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

function radios(group: Element): HTMLElement[] {
	return [...group.querySelectorAll<HTMLElement>(RADIO)].filter(visible);
}

function pickRadio(
	group: Element,
	from: HTMLElement,
	delta: number,
	wrap: boolean,
	select: boolean,
): boolean {
	const options = radios(group);
	if (options.length < 2) {
		return false;
	}
	const index = options.indexOf(from);
	let next = (index < 0 ? 0 : index) + delta;
	if (wrap) {
		next = (next + options.length) % options.length;
	} else if (next < 0 || next >= options.length) {
		return false;
	}
	const target = options[next];
	if (!target || target === from) {
		return false;
	}
	focus(target);
	if (select) {
		target.click();
	}
	return true;
}

function switchTab(delta: number): void {
	const scope = activeScope();
	const current = currentFocus(scope);
	const group =
		[...scope.querySelectorAll<HTMLElement>(TABS)].find(visible) ??
		current?.closest('[role="radiogroup"]') ??
		null;
	if (!group) {
		return;
	}
	const options = radios(group);
	const checked =
		options.find((option) => option.getAttribute("aria-checked") === "true") ??
		options[0];
	if (checked && pickRadio(group, checked, delta, true, true)) {
		rumble("tick");
	}
}

function nudge(element: HTMLElement, direction: Direction): boolean {
	if (direction !== "left" && direction !== "right") {
		return false;
	}
	const delta = direction === "right" ? 1 : -1;
	const group =
		element.getAttribute("role") === "radio"
			? element.closest('[role="radiogroup"]')
			: null;
	if (group) {
		return pickRadio(group, element, delta, false, false);
	}
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

function defaultFocus(scope: HTMLElement): HTMLElement | null {
	const preferred = scope.querySelector<HTMLElement>("[data-pad-default]");
	if (preferred && visible(preferred)) {
		return preferred;
	}
	const options = candidates(scope).sort((a, b) => {
		const ca = center(a);
		const cb = center(b);
		return ca.y - cb.y || ca.x - cb.x;
	});
	const checkedTab = scope.querySelector<HTMLElement>(
		`${TABS} [aria-checked="true"]`,
	);
	if (checkedTab && options.includes(checkedTab)) {
		return checkedTab;
	}
	return (
		options.find((option) => option.dataset.sound !== "back") ??
		options[0] ??
		null
	);
}

function checkScope(now: number): void {
	if (now < nextScopeCheck) {
		return;
	}
	nextScopeCheck = now + SCOPE_CHECK_MS;
	const scope = activeScope();
	const usingPad = inputDeviceStore.get().device === "pad";
	const current = currentFocus(scope);
	if (usingPad && !current) {
		const target = defaultFocus(scope);
		if (target) {
			focus(target);
		}
	} else if (usingPad && current && current !== marked) {
		mark(current);
	}
	const tabs = [...scope.querySelectorAll<HTMLElement>(TABS)].some(visible);
	const hints = padHintsStore.get();
	if (hints.visible !== usingPad || hints.tabs !== tabs) {
		padHintsStore.set({ visible: usingPad, tabs });
	}
}

function hideHints(): void {
	if (padHintsStore.get().visible) {
		padHintsStore.set({ visible: false });
	}
}

function activate(): void {
	const scope = activeScope();
	const current = currentFocus(scope);
	if (!current) {
		const target = defaultFocus(scope);
		if (target) {
			focus(target);
		}
		return;
	}
	rumble("select");
	if (isTextTarget(current)) {
		openPadKeyboard(current);
		return;
	}
	if (current instanceof HTMLInputElement && current.type === "number") {
		current.focus();
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

function repeatable(button: number): boolean {
	if (!padFocus.repeatButtons?.has(button)) {
		return false;
	}
	if (button !== PAD_BUTTON.a) {
		return true;
	}
	const focused = document.activeElement;
	return (
		focused instanceof HTMLElement && focused.hasAttribute(REPEAT_ATTRIBUTE)
	);
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
		repeatButton = null;
		hideHints();
		return;
	}
	for (const edge of buttons.update(pad.buttons, now, () => false)) {
		if (!edge.down) {
			continue;
		}
		markDevice("pad");
		const button = parsePadCode(edge.code)?.button;
		if (button !== undefined && repeatable(button)) {
			repeatButton = button;
			nextButtonRepeat = now + BUTTON_REPEAT_DELAY_MS;
		}
		if (button !== undefined && padFocus.onButton?.(button)) {
			continue;
		}
		if (edge.code === padCode(PAD_BUTTON.a, false)) {
			activate();
		} else if (
			edge.code === padCode(PAD_BUTTON.b, false) ||
			edge.code === padCode(PAD_BUTTON.start, false)
		) {
			rumble("back");
			if (!padFocus.onMenu?.()) {
				back();
			}
		} else if (
			edge.code === padCode(PAD_BUTTON.lb, false) ||
			edge.code === padCode(PAD_BUTTON.rb, false)
		) {
			switchTab(edge.code === padCode(PAD_BUTTON.rb, false) ? 1 : -1);
		}
	}
	if (repeatButton !== null) {
		if (!pad.buttons[repeatButton] || !repeatable(repeatButton)) {
			repeatButton = null;
		} else if (now >= nextButtonRepeat) {
			nextButtonRepeat = now + BUTTON_REPEAT_RATE_MS;
			if (!padFocus.onButton?.(repeatButton)) {
				activate();
			}
		}
	}
	checkScope(now);
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
		hideHints();
	}
}

function onDesktopInput(event: Event): void {
	if (event.isTrusted && inputDeviceStore.get().device === "pad") {
		markDevice("keyboard");
	}
}

function onPointerMove(event: PointerEvent): void {
	if (inputDeviceStore.get().device !== "pad") {
		mouseTravel = 0;
		return;
	}
	if (event.timeStamp - mouseTravelAt > MOUSE_TRAVEL_WINDOW_MS) {
		mouseTravel = 0;
	}
	mouseTravelAt = event.timeStamp;
	mouseTravel += Math.hypot(event.movementX, event.movementY);
	if (mouseTravel > MOUSE_TRAVEL_THRESHOLD) {
		mouseTravel = 0;
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
	window.addEventListener("pointermove", onPointerMove, { passive: true });
	window.addEventListener("pointerdown", onDesktopInput, {
		capture: true,
		passive: true,
	});
	window.addEventListener("keydown", onDesktopInput, {
		capture: true,
		passive: true,
	});
	window.addEventListener("wheel", onDesktopInput, {
		capture: true,
		passive: true,
	});
	inputDeviceStore.subscribe((state) => {
		document.documentElement.toggleAttribute(
			"data-pad-active",
			state.device === "pad",
		);
		if (state.device !== "pad") {
			mark(null);
			hideHints();
		}
	});
	onConnection();
}
