import { audioEngine } from "./audioEngine";

export type UiSound = "default" | "confirm" | "danger" | "toggle" | "back";

interface Tone {
	type: OscillatorType;
	from: number;
	to?: number;
	at?: number;
	length: number;
	level: number;
}

interface Noise {
	frequency: number;
	q: number;
	length: number;
	level: number;
}

interface Cue {
	tones: Tone[];
	noise?: Noise;
	cutoff: number;
}

const HOVER_CUES: Record<UiSound, Cue> = {
	default: {
		cutoff: 3200,
		tones: [
			{ type: "triangle", from: 1400, to: 900, length: 0.075, level: 0.08 },
			{ type: "sine", from: 2800, length: 0.05, level: 0.02 },
		],
	},
	confirm: {
		cutoff: 2600,
		tones: [
			{ type: "sine", from: 880, to: 1180, length: 0.09, level: 0.09 },
			{ type: "triangle", from: 1760, to: 2360, length: 0.06, level: 0.025 },
		],
	},
	danger: {
		cutoff: 1400,
		tones: [
			{ type: "triangle", from: 520, to: 380, length: 0.09, level: 0.1 },
			{ type: "sine", from: 260, to: 190, length: 0.08, level: 0.05 },
		],
	},
	toggle: {
		cutoff: 5200,
		tones: [
			{ type: "square", from: 2300, to: 2100, length: 0.03, level: 0.025 },
		],
	},
	back: {
		cutoff: 2400,
		tones: [
			{ type: "triangle", from: 1100, to: 720, length: 0.08, level: 0.07 },
		],
	},
};

const CLICK_CUES: Record<UiSound, Cue> = {
	default: {
		cutoff: 4200,
		noise: { frequency: 1900, q: 1.4, length: 0.035, level: 0.12 },
		tones: [{ type: "sine", from: 240, to: 150, length: 0.07, level: 0.12 }],
	},
	confirm: {
		cutoff: 4800,
		noise: { frequency: 2600, q: 1.2, length: 0.025, level: 0.08 },
		tones: [
			{ type: "sine", from: 660, length: 0.16, level: 0.1 },
			{ type: "sine", from: 990, at: 0.07, length: 0.22, level: 0.1 },
			{ type: "triangle", from: 1980, at: 0.07, length: 0.12, level: 0.02 },
		],
	},
	danger: {
		cutoff: 1200,
		noise: { frequency: 500, q: 0.8, length: 0.08, level: 0.14 },
		tones: [
			{ type: "sine", from: 170, to: 80, length: 0.18, level: 0.2 },
			{ type: "triangle", from: 340, to: 220, length: 0.12, level: 0.05 },
		],
	},
	toggle: {
		cutoff: 6000,
		noise: { frequency: 3200, q: 2, length: 0.018, level: 0.1 },
		tones: [{ type: "square", from: 1600, length: 0.025, level: 0.03 }],
	},
	back: {
		cutoff: 2600,
		noise: { frequency: 1400, q: 1.2, length: 0.03, level: 0.08 },
		tones: [
			{ type: "triangle", from: 720, to: 420, length: 0.12, level: 0.09 },
		],
	},
};

const HOVER_GAP_MS = 45;
const CLICK_GAP_MS = 30;
const SOUND_ATTRIBUTE = "data-sound";
const HOVERABLE =
	'button, a[href], select, summary, input[type="checkbox"], input[type="radio"], input[type="range"], [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="radio"], [data-selectable]';
const TOGGLES =
	'select, input, [role="tab"], [role="switch"], [role="radio"], [role="option"]';

let lastHover = 0;
let lastClick = 0;
let noiseBuffer: AudioBuffer | null = null;

function noiseFor(context: AudioContext): AudioBuffer {
	if (!noiseBuffer || noiseBuffer.sampleRate !== context.sampleRate) {
		noiseBuffer = context.createBuffer(
			1,
			Math.ceil(context.sampleRate * 0.25),
			context.sampleRate,
		);
		const data = noiseBuffer.getChannelData(0);
		for (let index = 0; index < data.length; index += 1) {
			data[index] = Math.random() * 2 - 1;
		}
	}
	return noiseBuffer;
}

function envelope(
	context: AudioContext,
	start: number,
	length: number,
	level: number,
): GainNode {
	const gain = context.createGain();
	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(level, start + 0.004);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
	return gain;
}

function play(cue: Cue, pitch: number): void {
	const context = audioEngine.ctx;
	const now = context.currentTime;
	const filter = context.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.value = cue.cutoff;
	filter.connect(audioEngine.bus("ui"));
	let end = now;
	for (const tone of cue.tones) {
		const start = now + (tone.at ?? 0);
		const oscillator = context.createOscillator();
		oscillator.type = tone.type;
		oscillator.frequency.setValueAtTime(tone.from * pitch, start);
		if (tone.to !== undefined) {
			oscillator.frequency.exponentialRampToValueAtTime(
				tone.to * pitch,
				start + tone.length * 0.7,
			);
		}
		oscillator
			.connect(envelope(context, start, tone.length, tone.level))
			.connect(filter);
		oscillator.start(start);
		oscillator.stop(start + tone.length + 0.02);
		end = Math.max(end, start + tone.length + 0.02);
	}
	if (cue.noise) {
		const source = context.createBufferSource();
		source.buffer = noiseFor(context);
		const band = context.createBiquadFilter();
		band.type = "bandpass";
		band.frequency.value = cue.noise.frequency * pitch;
		band.Q.value = cue.noise.q;
		source
			.connect(band)
			.connect(envelope(context, now, cue.noise.length, cue.noise.level))
			.connect(filter);
		source.start(now);
		source.stop(now + cue.noise.length + 0.02);
		end = Math.max(end, now + cue.noise.length + 0.02);
	}
	window.setTimeout(() => filter.disconnect(), (end - now) * 1000 + 100);
}

export function playHoverTick(pitch = 1, sound: UiSound = "default"): void {
	const now = performance.now();
	if (now - lastHover < HOVER_GAP_MS || !audioEngine.running) {
		return;
	}
	lastHover = now;
	play(HOVER_CUES[sound], pitch);
}

export function playUiClick(sound: UiSound = "default"): void {
	const now = performance.now();
	if (now - lastClick < CLICK_GAP_MS || !audioEngine.running) {
		return;
	}
	lastClick = now;
	play(CLICK_CUES[sound], 1);
}

function isUiSound(value: string | null): value is UiSound {
	return value !== null && value in HOVER_CUES;
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
