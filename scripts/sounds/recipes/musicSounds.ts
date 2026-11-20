import type { SynthKit } from "../synthKit.js";
import type { SoundRecipe } from "./types.js";

export const CHORD_S = 14;
const CHORD_TAIL_S = 9;
const NOTE_S = 5;
const ECHO_S = 0.46;
const ECHO_FEEDBACK = 0.38;
const ECHO_CUTOFF = 1800;
const ECHO_TAIL_S = 2.5;
const CHORDS = [
	[45, 57, 60, 64],
	[41, 57, 60, 65],
	[38, 57, 62, 65],
	[40, 56, 59, 64],
	[43, 55, 59, 62],
] as const;
const MELODY = [69, 71, 72, 74, 76, 79, 81] as const;

function frequency(midi: number): number {
	return 440 * 2 ** ((midi - 69) / 12);
}

function renderChord(kit: SynthKit, notes: readonly number[]): void {
	const [root, ...tones] = notes;
	const end = CHORD_S + CHORD_TAIL_S;
	const envelope = kit.gain(0);
	kit.envelope(envelope.gain, [
		{ time: 0, value: 0 },
		{ time: 5, value: 1 },
	]);
	envelope.gain.setTargetAtTime(0, CHORD_S, 2.4);
	const filter = kit.filter("lowpass", 420, 0.4, envelope);
	kit.envelope(filter.frequency, [
		{ time: 0, value: 420 },
		{ time: CHORD_S * 0.55, value: 820 },
		{ time: CHORD_S + 4, value: 460 },
	]);
	for (const midi of tones) {
		for (const detune of [-7, 7]) {
			const voice = kit.osc(
				"triangle",
				frequency(midi),
				0,
				end,
				kit.gain(0.045, filter),
			);
			voice.detune.value = detune;
		}
	}
	kit.osc("sine", frequency(root), 0, end, kit.gain(0.11, envelope));
}

function renderNote(kit: SynthKit, midi: number): void {
	const echo = kit.gain(1, kit.out);
	const tone = kit.filter("lowpass", ECHO_CUTOFF, 1, kit.out);
	const delay = kit.delay(ECHO_S, tone);
	echo.connect(delay);
	tone.connect(kit.gain(ECHO_FEEDBACK, delay));
	const envelope = kit.gain(0, echo);
	kit.envelope(envelope.gain, [
		{ time: 0, value: 0 },
		{ time: 0.012, value: 0.05 },
	]);
	envelope.gain.setTargetAtTime(0, 0.012, 0.9);
	for (const [ratio, level] of [
		[1, 1],
		[3, 0.12],
	] as const) {
		kit.osc(
			"sine",
			frequency(midi) * ratio,
			0,
			NOTE_S,
			kit.gain(level, envelope),
		);
	}
}

export const NEXT_CHORDS: readonly (readonly number[])[] = [
	[1, 2, 3],
	[2, 0, 4],
	[3, 0],
	[0, 1],
	[0, 2],
];

export const MUSIC_CHORD: SoundRecipe = {
	id: "music-chord",
	duration: CHORD_S + CHORD_TAIL_S,
	variants: CHORDS.length,
	render: (kit, variant) => renderChord(kit, CHORDS[variant]),
};

export const MUSIC_NOTE: SoundRecipe = {
	id: "music-note",
	duration: NOTE_S + ECHO_TAIL_S,
	variants: MELODY.length,
	render: (kit, variant) => renderNote(kit, MELODY[variant]),
};
