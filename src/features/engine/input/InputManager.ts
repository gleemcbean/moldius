import { MOUSE_LOOK_SCALE } from "../../../config/feel";
import { ACTION_IDS, type ActionId } from "../../../types/settings";
import {
	markDevice,
	PAD_BUTTON,
	PAD_HOLD_MS,
	PadButtons,
	padCode,
	padFocus,
	parsePadCode,
	readPad,
	stick,
} from "../../gamepad/gamepad";
import { settingsStore } from "../../settings/settingsStore";

export type InputMode = "game" | "map" | "paused";

export interface FrameInput {
	held: Set<ActionId>;
	pressed: Set<ActionId>;
	released: Set<ActionId>;
	mouseX: number;
	mouseY: number;
	wheel: number;
	digits: number[];
	arrows: { x: number; y: number };
	zoomKeys: number;
	escape: boolean;
	move: { x: number; y: number };
	padLook: { x: number; y: number };
	menu: boolean;
	confirm: boolean;
	mapZoom: number;
	mapLevel: number;
	mapRecenter: boolean;
}

const PAD_YAW_RATE = 3.4;
const PAD_PITCH_RATE = 2.3;
const PAD_AIM_FACTOR = 0.5;
const PAD_LOOK_EXPONENT = 2;
const PAD_SPRINT_RELEASE = 0.2;
const PAD_MENU_TAP = padCode(PAD_BUTTON.start, false);
const PAD_MENU_HOLD = padCode(PAD_BUTTON.start, true);
const PAD_CYCLE_PREVIOUS = padCode(PAD_BUTTON.left, false);
const PAD_CYCLE_NEXT = padCode(PAD_BUTTON.right, false);
const PAD_TOGGLES: ReadonlySet<ActionId> = new Set(["sprint", "crouch"]);

const PAD_MAP_BUTTONS: ReadonlySet<number> = new Set([
	PAD_BUTTON.b,
	PAD_BUTTON.up,
	PAD_BUTTON.down,
	PAD_BUTTON.r3,
]);

const BROWSER_SENSITIVE = new Set([
	"Tab",
	"Space",
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Backspace",
	"Slash",
	"Quote",
	"F1",
	"F3",
	"F6",
	"F7",
]);

function isTextTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		(target instanceof HTMLElement && target.isContentEditable)
	);
}

function mouseCode(button: number): string | null {
	return button === 0
		? "MouseLeft"
		: button === 2
			? "MouseRight"
			: button === 1
				? "MouseMiddle"
				: null;
}

export class InputManager {
	mode: InputMode = "game";
	private readonly held = new Set<ActionId>();
	private readonly pressed = new Set<ActionId>();
	private readonly released = new Set<ActionId>();
	private readonly digits: number[] = [];
	private mouseX = 0;
	private mouseY = 0;
	private wheel = 0;
	private escape = false;
	private zoomKeys = 0;
	private readonly arrowsHeld = new Set<string>();
	private codeToAction = new Map<string, ActionId>();
	private readonly padButtons = new PadButtons();
	private readonly padHeld = new Set<ActionId>();
	private padEngaged = false;
	private padSprint = false;
	private padCrouch = false;
	private readonly toggleHeldSince = new Map<ActionId, number>();
	private lastPadPoll = 0;
	private move = { x: 0, y: 0 };
	private padLook = { x: 0, y: 0 };
	private menu = false;
	private confirm = false;
	private mapZoom = 0;
	private mapLevel = 0;
	private mapRecenter = false;
	private unsubscribe: (() => void) | null = null;
	pointerLocked = false;
	freePlay = false;
	private lockPending = false;
	onPointerLockChange: ((locked: boolean) => void) | null = null;

	constructor(private readonly element: HTMLElement) {}

	attach(): void {
		this.rebuildBindings();

		this.unsubscribe = settingsStore.subscribe(() => this.rebuildBindings());

		window.addEventListener("keydown", this.onKeyDown, true);
		window.addEventListener("keyup", this.onKeyUp, true);
		window.addEventListener("mousedown", this.onMouseDown, true);
		window.addEventListener("mouseup", this.onMouseUp, true);
		window.addEventListener("mousemove", this.onMouseMove);
		window.addEventListener("wheel", this.onWheel, { passive: false });
		window.addEventListener("blur", this.onBlur);
		window.addEventListener("contextmenu", this.onContextMenu);
		document.addEventListener("pointerlockchange", this.onPointerLock);
	}

	detach(): void {
		this.unsubscribe?.();
		window.removeEventListener("keydown", this.onKeyDown, true);
		window.removeEventListener("keyup", this.onKeyUp, true);
		window.removeEventListener("mousedown", this.onMouseDown, true);
		window.removeEventListener("mouseup", this.onMouseUp, true);
		window.removeEventListener("mousemove", this.onMouseMove);
		window.removeEventListener("wheel", this.onWheel);
		window.removeEventListener("blur", this.onBlur);
		window.removeEventListener("contextmenu", this.onContextMenu);
		document.removeEventListener("pointerlockchange", this.onPointerLock);

		if (document.pointerLockElement === this.element) {
			document.exitPointerLock();
		}
	}

	get capturing(): boolean {
		return this.pointerLocked || this.freePlay;
	}

	requestPointerLock(): void {
		if (document.pointerLockElement === this.element || this.lockPending) {
			return;
		}

		const request: Promise<void> | undefined = this.element.requestPointerLock({
			unadjustedMovement: true,
		});

		if (!request) {
			return;
		}

		this.lockPending = true;

		request
			.catch(() => this.element.requestPointerLock())
			.catch(() => undefined)
			.finally(() => {
				this.lockPending = false;
			});
	}

	releasePointerLock(): void {
		if (document.pointerLockElement === this.element) {
			document.exitPointerLock();
		}
	}

	isHeld(action: ActionId): boolean {
		return this.held.has(action);
	}

	clearHeld(): void {
		this.held.clear();
		this.arrowsHeld.clear();
		this.padHeld.clear();
		this.toggleHeldSince.clear();

		this.padSprint = false;
		this.padCrouch = false;
	}

	frame(): FrameInput {
		this.pollPad();

		const arrows = {
			x:
				(this.arrowsHeld.has("ArrowRight") ? 1 : 0) -
				(this.arrowsHeld.has("ArrowLeft") ? 1 : 0),
			y:
				(this.arrowsHeld.has("ArrowDown") ? 1 : 0) -
				(this.arrowsHeld.has("ArrowUp") ? 1 : 0),
		};

		const result: FrameInput = {
			held: new Set(this.held),
			pressed: new Set(this.pressed),
			released: new Set(this.released),
			mouseX: this.mouseX,
			mouseY: this.mouseY,
			wheel: this.wheel,
			digits: [...this.digits],
			arrows,
			zoomKeys: this.zoomKeys,
			escape: this.escape,
			move: { ...this.move },
			padLook: { ...this.padLook },
			menu: this.menu,
			confirm: this.confirm,
			mapZoom: this.mapZoom,
			mapLevel: this.mapLevel,
			mapRecenter: this.mapRecenter,
		};

		this.pressed.clear();
		this.released.clear();

		this.digits.length = 0;
		this.mouseX = 0;
		this.mouseY = 0;
		this.wheel = 0;
		this.zoomKeys = 0;
		this.escape = false;
		this.menu = false;
		this.confirm = false;
		this.mapZoom = 0;
		this.mapLevel = 0;
		this.mapRecenter = false;

		return result;
	}

	private rebuildBindings(): void {
		const { keys, padKeys } = settingsStore.get();

		this.codeToAction = new Map([
			...ACTION_IDS.filter((action) => padKeys[action] !== "").map(
				(action) => [padKeys[action], action] as const,
			),
			...ACTION_IDS.map((action) => [keys[action], action] as const),
		]);
	}

	private pressAction(action: ActionId): void {
		if (!this.held.has(action)) {
			this.pressed.add(action);
		}

		this.held.add(action);
	}

	private releaseAction(action: ActionId): void {
		if (this.held.delete(action)) {
			this.released.add(action);
		}
	}

	private press(code: string): boolean {
		const action = this.codeToAction.get(code);

		if (!action) {
			return false;
		}

		this.pressAction(action);

		return true;
	}

	private release(code: string): void {
		const action = this.codeToAction.get(code);

		if (action) {
			this.releaseAction(action);
		}
	}

	private setPadHeld(action: ActionId, on: boolean): void {
		if (on && !this.padHeld.has(action)) {
			this.padHeld.add(action);
			this.pressAction(action);
		} else if (!on && this.padHeld.delete(action)) {
			this.releaseAction(action);
		}
	}

	private disengagePad(): void {
		for (const action of [...this.padHeld]) {
			this.setPadHeld(action, false);
		}

		this.toggleHeldSince.clear();

		this.padSprint = false;
		this.padCrouch = false;
		this.move = { x: 0, y: 0 };
		this.padLook = { x: 0, y: 0 };

		this.padButtons.reset();

		this.padEngaged = false;
	}

	private pollPad(): void {
		const now = performance.now();
		const dt = Math.min(0.05, Math.max(0, (now - this.lastPadPoll) / 1000));

		this.lastPadPoll = now;

		const pad = padFocus.owner === "game" ? readPad() : null;

		if (!pad) {
			if (this.padEngaged) {
				this.disengagePad();
			}

			return;
		}

		this.padEngaged = true;

		const settings = settingsStore.get();

		const edges = this.padButtons.update(
			pad.buttons,
			now,
			(button) =>
				button === PAD_BUTTON.start ||
				(!(this.mode === "map" && PAD_MAP_BUTTONS.has(button)) &&
					this.codeToAction.has(padCode(button, true))),
		);

		for (const edge of edges) {
			markDevice("pad");
			this.padEdge(edge.code, edge.down, now);
		}

		const left = stick(
			pad.axes[0] ?? 0,
			pad.axes[1] ?? 0,
			settings.padDeadzone,
		);

		const right = stick(
			pad.axes[2] ?? 0,
			pad.axes[3] ?? 0,
			settings.padDeadzone,
		);

		if (left.magnitude > 0 || right.magnitude > 0) {
			markDevice("pad");
		}

		this.move = { x: left.x, y: left.y };
		this.padLook = { x: right.x, y: right.y };

		if (this.padSprint && left.magnitude < PAD_SPRINT_RELEASE) {
			this.padSprint = false;
		}

		this.setPadHeld("sprint", this.padSprint);
		this.setPadHeld("crouch", this.padCrouch);

		if (this.mode === "map") {
			this.mapZoom -= right.y * dt;

			return;
		}

		if (right.magnitude > 0) {
			const curve = right.magnitude ** (PAD_LOOK_EXPONENT - 1);
			const aiming = this.held.has("aim") ? PAD_AIM_FACTOR : 1;

			const toPixels =
				(settings.padSensitivity * aiming * dt) /
				(MOUSE_LOOK_SCALE * settings.mouseSensitivity);

			this.mouseX += right.x * curve * PAD_YAW_RATE * toPixels;
			this.mouseY += right.y * curve * PAD_PITCH_RATE * toPixels;
		}
	}

	private setPadToggle(action: ActionId, on: boolean): void {
		if (action === "sprint") {
			this.padSprint = on;

			if (on) {
				this.padCrouch = false;
			}
		} else {
			this.padCrouch = on;

			if (on) {
				this.padSprint = false;
			}
		}
	}

	private padToggleEdge(action: ActionId, down: boolean, now: number): void {
		if (down) {
			const wasOn = action === "sprint" ? this.padSprint : this.padCrouch;

			this.setPadToggle(action, !wasOn);

			if (wasOn) {
				this.toggleHeldSince.delete(action);
			} else {
				this.toggleHeldSince.set(action, now);
			}

			return;
		}

		const since = this.toggleHeldSince.get(action);

		this.toggleHeldSince.delete(action);

		if (since !== undefined && now - since >= PAD_HOLD_MS) {
			this.setPadToggle(action, false);
		}
	}

	private mapEdge(code: string, down: boolean): boolean {
		const pad = parsePadCode(code);

		if (
			this.mode !== "map" ||
			!pad ||
			pad.hold ||
			!PAD_MAP_BUTTONS.has(pad.button)
		) {
			return false;
		}

		const { button } = pad;

		if (!down) {
			return true;
		}

		if (button === PAD_BUTTON.b) {
			this.escape = true;
		} else if (button === PAD_BUTTON.r3) {
			this.mapRecenter = true;
		} else {
			this.mapLevel += button === PAD_BUTTON.up ? 1 : -1;
		}

		return true;
	}

	private padEdge(code: string, down: boolean, now: number): void {
		if (this.mapEdge(code, down)) {
			return;
		}

		if (code === PAD_MENU_TAP) {
			if (down) {
				this.escape = true;
				this.menu = true;
			}

			return;
		}

		if (code === PAD_MENU_HOLD) {
			if (down) {
				this.confirm = true;
			}

			return;
		}

		if (code === PAD_CYCLE_PREVIOUS || code === PAD_CYCLE_NEXT) {
			if (down) {
				this.wheel += code === PAD_CYCLE_NEXT ? 1 : -1;
			}

			return;
		}

		const action = this.codeToAction.get(code);

		if (!action) {
			return;
		}

		if (PAD_TOGGLES.has(action)) {
			this.padToggleEdge(action, down, now);

			return;
		}

		this.setPadHeld(action, down);
	}

	private readonly onKeyDown = (event: KeyboardEvent) => {
		if (isTextTarget(event.target)) {
			return;
		}

		if (event.isTrusted) {
			markDevice("keyboard");
		}

		if (event.code === "Escape") {
			this.escape = true;

			return;
		}

		if (event.code.startsWith("Arrow")) {
			this.arrowsHeld.add(event.code);
		}

		if (event.code === "Equal" || event.code === "NumpadAdd") {
			this.zoomKeys += 1;
		}

		if (event.code === "Minus" || event.code === "NumpadSubtract") {
			this.zoomKeys -= 1;
		}

		const digitMatch = /^(?:Digit|Numpad)(\d)$/.exec(event.code);

		const mapped = event.repeat
			? this.codeToAction.has(event.code)
			: this.press(event.code);

		if (digitMatch && !mapped) {
			this.digits.push(Number(digitMatch[1]));
		}

		if (
			mapped ||
			digitMatch ||
			BROWSER_SENSITIVE.has(event.code) ||
			event.ctrlKey ||
			event.altKey
		) {
			event.preventDefault();
		}
	};

	private readonly onKeyUp = (event: KeyboardEvent) => {
		if (event.code.startsWith("Arrow")) {
			this.arrowsHeld.delete(event.code);
		}

		this.release(event.code);

		if (
			!isTextTarget(event.target) &&
			(this.codeToAction.has(event.code) || event.code === "Tab")
		) {
			event.preventDefault();
		}
	};

	private readonly onMouseDown = (event: MouseEvent) => {
		const code = mouseCode(event.button);

		if (!code || !this.capturing) {
			return;
		}

		markDevice("keyboard");

		if (this.press(code)) {
			event.preventDefault();
		}
	};

	private readonly onMouseUp = (event: MouseEvent) => {
		const code = mouseCode(event.button);

		if (code) {
			this.release(code);
		}
	};

	private readonly onMouseMove = (event: MouseEvent) => {
		if (this.capturing) {
			this.mouseX += event.movementX;
			this.mouseY += event.movementY;
		}
	};

	private readonly onWheel = (event: WheelEvent) => {
		if (isTextTarget(event.target)) {
			return;
		}

		if (this.capturing || this.mode === "map") {
			event.preventDefault();

			this.wheel += Math.sign(event.deltaY);
		}
	};

	private readonly onContextMenu = (event: MouseEvent) => {
		if (this.capturing) {
			event.preventDefault();
		}
	};

	private readonly onBlur = () => {
		for (const action of this.held) {
			this.released.add(action);
		}

		this.clearHeld();
	};

	reconcilePointerLock(): void {
		if ((document.pointerLockElement === this.element) !== this.pointerLocked) {
			this.onPointerLock();
		}
	}

	private readonly onPointerLock = () => {
		this.pointerLocked = document.pointerLockElement === this.element;

		if (!this.pointerLocked) {
			for (const action of this.held) {
				if (action !== "crouch" && action !== "leaderboard") {
					this.released.add(action);
				}
			}

			for (const action of [...this.held]) {
				if (action !== "crouch" && action !== "leaderboard") {
					this.held.delete(action);
				}
			}
		}

		this.onPointerLockChange?.(this.pointerLocked);
	};
}
