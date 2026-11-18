import { settingsStore } from "../settings/settingsStore";
import { activePad, inputDeviceStore } from "./gamepad";

interface DualRumble {
	duration: number;
	strongMagnitude: number;
	weakMagnitude: number;
}

interface Actuator {
	playEffect?: (
		type: "dual-rumble",
		params: DualRumble & { startDelay?: number },
	) => Promise<unknown>;
}

interface LegacyActuator {
	pulse?: (value: number, duration: number) => Promise<unknown>;
}

type HapticPad = Gamepad & {
	vibrationActuator?: Actuator | null;
	hapticActuators?: readonly LegacyActuator[];
};

export const RUMBLES = {
	tick: { duration: 28, strongMagnitude: 0, weakMagnitude: 0.22 },
	select: { duration: 45, strongMagnitude: 0.05, weakMagnitude: 0.35 },
	back: { duration: 40, strongMagnitude: 0.12, weakMagnitude: 0.2 },
	denied: { duration: 70, strongMagnitude: 0.35, weakMagnitude: 0.1 },
	pickup: { duration: 90, strongMagnitude: 0.15, weakMagnitude: 0.45 },
	interact: { duration: 60, strongMagnitude: 0.1, weakMagnitude: 0.35 },
	photo: { duration: 80, strongMagnitude: 0.2, weakMagnitude: 0.55 },
	land: { duration: 110, strongMagnitude: 0.55, weakMagnitude: 0.25 },
	push: { duration: 120, strongMagnitude: 0.45, weakMagnitude: 0.4 },
	hit: { duration: 260, strongMagnitude: 0.85, weakMagnitude: 0.6 },
	grabbed: { duration: 420, strongMagnitude: 0.7, weakMagnitude: 0.9 },
	scare: { duration: 380, strongMagnitude: 1, weakMagnitude: 0.7 },
	death: { duration: 750, strongMagnitude: 1, weakMagnitude: 1 },
	heartbeat: { duration: 70, strongMagnitude: 0.4, weakMagnitude: 0 },
	ritual: { duration: 500, strongMagnitude: 0.5, weakMagnitude: 0.8 },
} satisfies Record<string, DualRumble>;

export type RumbleId = keyof typeof RUMBLES;

let busyUntil = 0;
let busyStrength = 0;

function hapticPad(): HapticPad | null {
	return activePad() as HapticPad | null;
}

export function rumbleSupported(): boolean {
	const pad = hapticPad();
	return (
		!pad ||
		typeof pad.vibrationActuator?.playEffect === "function" ||
		typeof pad.hapticActuators?.[0]?.pulse === "function"
	);
}

export function rumble(
	id: RumbleId,
	{ scale = 1, force = false }: { scale?: number; force?: boolean } = {},
): void {
	if (!force && inputDeviceStore.get().device !== "pad") {
		return;
	}
	const intensity = settingsStore.get().padVibration * scale;
	if (intensity <= 0) {
		return;
	}
	const pad = hapticPad();
	if (!pad) {
		return;
	}
	const effect = RUMBLES[id];
	const strength =
		Math.max(effect.strongMagnitude, effect.weakMagnitude) * scale;
	const now = performance.now();
	if (now < busyUntil && strength < busyStrength) {
		return;
	}
	busyUntil = now + effect.duration;
	busyStrength = strength;
	const params = {
		duration: effect.duration,
		strongMagnitude: Math.min(1, effect.strongMagnitude * intensity),
		weakMagnitude: Math.min(1, effect.weakMagnitude * intensity),
	};
	const actuator = pad.vibrationActuator;
	if (typeof actuator?.playEffect === "function") {
		actuator.playEffect("dual-rumble", params).catch(() => undefined);
		return;
	}
	const legacy = pad.hapticActuators?.[0];
	if (typeof legacy?.pulse === "function") {
		legacy
			.pulse(
				Math.max(params.strongMagnitude, params.weakMagnitude),
				effect.duration,
			)
			.catch(() => undefined);
	}
}
