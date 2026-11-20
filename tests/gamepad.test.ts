import { describe, expect, it } from "vitest";

type Keys = Record<string, string>;
type Edge = { code: string; down: boolean };

interface Tracker {
	update(
		buttons: readonly boolean[],
		now: number,
		hasHold: (button: number) => boolean,
	): Edge[];
	reset(): void;
}

const clientRoot = "../src";

const gamepad = (await import(`${clientRoot}/features/gamepad/gamepad.ts`)) as {
	PadButtons: new () => Tracker;
	PAD_HOLD_MS: number;
	parsePadCode: (code: string) => { button: number; hold: boolean } | null;
	isBindablePadCode: (code: string) => boolean;
	activePad: () => { index: number } | null;
	stick: (
		x: number,
		y: number,
		deadzone: number,
	) => { x: number; y: number; magnitude: number };
};

const { DEFAULT_PAD_KEYS } = (await import(
	`${clientRoot}/config/defaultKeys.ts`
)) as { DEFAULT_PAD_KEYS: Keys };

const { sanitizePadKeys } = (await import(
	`${clientRoot}/features/settings/settingsStore.ts`
)) as { sanitizePadKeys: (saved: unknown) => Keys };

function pressed(...indices: number[]): boolean[] {
	return Array.from({ length: 17 }, (_, index) => indices.includes(index));
}

describe("gamepad buttons", () => {
	it("ignores buttons already held when the tracker starts", () => {
		const tracker = new gamepad.PadButtons();

		expect(tracker.update(pressed(0), 0, () => false)).toEqual([]);
		expect(tracker.update(pressed(), 16, () => false)).toEqual([]);

		expect(tracker.update(pressed(0), 32, () => false)).toEqual([
			{ code: "Pad0", down: true },
		]);
	});

	it("fires immediately on buttons without a long press", () => {
		const tracker = new gamepad.PadButtons();

		tracker.update(pressed(), 0, () => false);

		expect(tracker.update(pressed(2), 10, () => false)).toEqual([
			{ code: "Pad2", down: true },
		]);

		expect(tracker.update(pressed(), 20, () => false)).toEqual([
			{ code: "Pad2", down: false },
		]);
	});

	it("separates a short tap from a long press", () => {
		const tracker = new gamepad.PadButtons();
		const hold = () => true;

		tracker.update(pressed(), 0, hold);
		expect(tracker.update(pressed(11), 10, hold)).toEqual([]);

		expect(tracker.update(pressed(), 100, hold)).toEqual([
			{ code: "Pad11", down: true },
			{ code: "Pad11", down: false },
		]);

		expect(tracker.update(pressed(11), 200, hold)).toEqual([]);

		expect(
			tracker.update(pressed(11), 200 + gamepad.PAD_HOLD_MS, hold),
		).toEqual([{ code: "Pad11Hold", down: true }]);

		expect(tracker.update(pressed(11), 900, hold)).toEqual([]);

		expect(tracker.update(pressed(), 950, hold)).toEqual([
			{ code: "Pad11Hold", down: false },
		]);
	});
});

describe("gamepad codes and sticks", () => {
	it("parses button codes and rejects reserved buttons", () => {
		expect(gamepad.parsePadCode("Pad8Hold")).toEqual({ button: 8, hold: true });
		expect(gamepad.parsePadCode("KeyW")).toBeNull();
		expect(gamepad.parsePadCode("Pad40")).toBeNull();
		expect(gamepad.isBindablePadCode("Pad0")).toBe(true);
		expect(gamepad.isBindablePadCode("Pad9")).toBe(false);
		expect(gamepad.isBindablePadCode("Pad14Hold")).toBe(false);
	});

	it("rescales the stick outside the dead zone", () => {
		expect(gamepad.stick(0.1, 0.05, 0.15).magnitude).toBe(0);

		const full = gamepad.stick(1, 0, 0.15);

		expect(full.x).toBeCloseTo(1);
		expect(full.magnitude).toBeCloseTo(1);

		const half = gamepad.stick(0, -0.575, 0.15);

		expect(half.y).toBeCloseTo(-0.5);
	});

	it("keeps default bindings unique and bindable", () => {
		const codes = Object.values(DEFAULT_PAD_KEYS).filter((code) => code !== "");

		expect(new Set(codes).size).toBe(codes.length);
		expect(codes.every((code) => gamepad.isBindablePadCode(code))).toBe(true);
	});

	it("sanitizes saved controller bindings", () => {
		expect(sanitizePadKeys(undefined)).toEqual(DEFAULT_PAD_KEYS);

		const saved = sanitizePadKeys({
			jump: "Pad2",
			interact: "Pad2",
			lantern: "Pad9",
			moveForward: "Pad0",
			pageNext: "Pad4Hold",
		});

		expect(saved.jump).toBe("Pad2");
		expect(saved.interact).toBe("");
		expect(saved.lantern).toBe(DEFAULT_PAD_KEYS.lantern);
		expect(saved.moveForward).toBe("");
		expect(saved.pageNext).toBe("Pad4Hold");
	});
});

function fakePad(index: number, pressed: boolean, timestamp: number) {
	return {
		index,
		connected: true,
		mapping: "standard",
		timestamp,
		axes: [0, 0, 0, 0],
		buttons: Array.from({ length: 17 }, (_, button) => ({
			pressed: pressed && button === 0,
			value: pressed && button === 0 ? 1 : 0,
		})),
	};
}

describe("choix de la manette active", () => {
	it("reste sur la manette utilisée quand un doublon se met à jour", () => {
		let pads = [fakePad(0, false, 1), fakePad(1, true, 1)];

		Object.defineProperty(globalThis, "navigator", {
			value: { getGamepads: () => pads },
			configurable: true,
		});

		expect(gamepad.activePad()?.index).toBe(1);

		pads = [fakePad(0, false, 99), fakePad(1, false, 2)];

		expect(gamepad.activePad()?.index).toBe(1);

		pads = [fakePad(0, true, 100), fakePad(1, true, 3)];

		expect(gamepad.activePad()?.index).toBe(1);

		pads = [fakePad(0, true, 101), fakePad(1, false, 4)];

		expect(gamepad.activePad()?.index).toBe(0);
	});
});
