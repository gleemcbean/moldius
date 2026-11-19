import type { AudioNode, OscillatorType } from "../offlineAudio.js";
import type { SynthKit } from "../synthKit.js";
import type { SoundRecipe } from "./types.js";

type UiSound = "default" | "confirm" | "danger" | "toggle" | "back";

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

const ATTACK = 0.004;
const RELEASE = 0.02;

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

function envelope(
	kit: SynthKit,
	start: number,
	length: number,
	level: number,
	destination: AudioNode,
): AudioNode {
	const gain = kit.gain(0, destination);
	kit.expEnvelope(gain.gain, [
		{ time: start, value: 0.0001 },
		{ time: start + ATTACK, value: level },
		{ time: start + length, value: 0.0001 },
	]);
	return gain;
}

function renderCue(kit: SynthKit, cue: Cue): void {
	const filter = kit.filter("lowpass", cue.cutoff, 1, kit.out);
	for (const tone of cue.tones) {
		const start = tone.at ?? 0;
		const oscillator = kit.osc(
			tone.type,
			tone.from,
			start,
			tone.length + RELEASE,
			envelope(kit, start, tone.length, tone.level, filter),
		);
		if (tone.to !== undefined) {
			kit.expEnvelope(oscillator.frequency, [
				{ time: start, value: tone.from },
				{ time: start + tone.length * 0.7, value: tone.to },
			]);
		}
	}
	if (cue.noise) {
		kit.noise(
			"white",
			0,
			cue.noise.length + RELEASE,
			kit.filter(
				"bandpass",
				cue.noise.frequency,
				cue.noise.q,
				envelope(kit, 0, cue.noise.length, cue.noise.level, filter),
			),
		);
	}
}

function cueDuration(cue: Cue): number {
	const ends = cue.tones.map((tone) => (tone.at ?? 0) + tone.length);
	if (cue.noise) {
		ends.push(cue.noise.length);
	}
	return Math.max(...ends) + RELEASE + 0.01;
}

function cueRecipes(kind: string, cues: Record<UiSound, Cue>): SoundRecipe[] {
	return Object.entries(cues).map(([sound, cue]) => ({
		id: `ui-${kind}-${sound}`,
		duration: cueDuration(cue),
		variants: 1,
		render: (kit) => renderCue(kit, cue),
	}));
}

export const UI_SOUNDS: SoundRecipe[] = [
	...cueRecipes("hover", HOVER_CUES),
	...cueRecipes("click", CLICK_CUES),
];
