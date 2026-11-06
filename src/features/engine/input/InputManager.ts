import { ACTION_IDS, type ActionId } from "../../../types/settings";
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
}

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
	}

	frame(): FrameInput {
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
		};
		this.pressed.clear();
		this.released.clear();
		this.digits.length = 0;
		this.mouseX = 0;
		this.mouseY = 0;
		this.wheel = 0;
		this.zoomKeys = 0;
		this.escape = false;
		return result;
	}

	private rebuildBindings(): void {
		const keys = settingsStore.get().keys;
		this.codeToAction = new Map(
			ACTION_IDS.map((action) => [keys[action], action] as const),
		);
	}

	private press(code: string): boolean {
		const action = this.codeToAction.get(code);
		if (!action) {
			return false;
		}
		if (!this.held.has(action)) {
			this.pressed.add(action);
		}
		this.held.add(action);
		return true;
	}

	private release(code: string): void {
		const action = this.codeToAction.get(code);
		if (action && this.held.delete(action)) {
			this.released.add(action);
		}
	}

	private readonly onKeyDown = (event: KeyboardEvent) => {
		if (isTextTarget(event.target)) {
			return;
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
