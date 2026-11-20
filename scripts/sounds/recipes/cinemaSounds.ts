import type { SynthKit } from "../synthKit.js";
import { impact } from "./anomalySounds.js";
import type { SoundRecipe } from "./types.js";

const BEAT = 60 / 132;
const EIGHTH = BEAT / 2;
const BAR = BEAT * 4;
const PIANO_BARS = 8;
const PIANO_LOOP = BAR * PIANO_BARS;

const MELODY: readonly (number | null)[][] = [
	[69, 72, 76, 72, 71, 72, 69, 64],
	[68, 71, 74, 71, 68, 64, 65, 68],
	[69, 76, 81, 79, 77, 76, 74, 72],
	[74, 77, 81, 77, 76, 80, 83, 80],
	[81, 79, 76, 72, 69, 72, 76, 81],
	[81, 77, 72, 69, 68, 71, 76, 68],
	[69, 72, 76, 81, 77, 74, 69, 65],
	[64, 68, 71, 74, 72, 71, 69, null],
];

const HARMONY: readonly (readonly [number, readonly number[]])[][] = [
	[[45, [57, 60, 64]]],
	[[40, [56, 59, 62]]],
	[[45, [57, 60, 64]]],
	[
		[38, [57, 62, 65]],
		[40, [56, 59, 62]],
	],
	[[45, [57, 60, 64]]],
	[
		[41, [57, 60, 65]],
		[40, [56, 59, 62]],
	],
	[
		[45, [57, 60, 64]],
		[38, [57, 62, 65]],
	],
	[
		[40, [56, 59, 62]],
		[45, [57, 60, 64]],
	],
];

function frequency(midi: number): number {
	return 440 * 2 ** ((midi - 69) / 12);
}

function pianoNote(
	kit: SynthKit,
	midi: number,
	start: number,
	length: number,
	peak: number,
): void {
	const base = frequency(midi);
	const decay = Math.max(0.25, 1.4 - (midi - 40) * 0.018);

	for (const [ratio, level] of [
		[1, 1],
		[2.003, 0.42],
		[3.01, 0.2],
		[4.02, 0.09],
	] as const) {
		for (const cents of [0, 6]) {
			const voice = kit.osc(
				"sine",
				base * ratio,
				start,
				Math.min(length + decay, 3),
				kit.hit(
					start,
					0.003,
					decay / ratio ** 0.4,
					peak * level * 0.5,
					kit.out,
				),
			);

			voice.detune.value = cents;
		}
	}

	kit.noise(
		"white",
		start,
		0.02,
		kit.filter(
			"bandpass",
			base * 4,
			1,
			kit.hit(start, 0.001, 0.015, peak * 0.08, kit.out),
		),
	);
}

function shutter(
	kit: SynthKit,
	start: number,
	duration: number,
	rate: (time: number) => number,
	peak: number,
): void {
	let time = start;

	while (time < start + duration) {
		kit.noise(
			"white",
			time,
			0.012,
			kit.filter(
				"bandpass",
				3200,
				3,
				kit.hit(time, 0.001, 0.01, peak, kit.out),
			),
		);

		time += 1 / Math.max(2, rate(time - start));
	}
}

function motor(
	kit: SynthKit,
	start: number,
	duration: number,
	from: number,
	to: number,
	peak: number,
): void {
	const level = kit.gain(peak);

	const hum = kit.osc(
		"sawtooth",
		from,
		start,
		duration,
		kit.filter("lowpass", 420, 1, level),
	);

	kit.expEnvelope(hum.frequency, [
		{ time: start, value: from },
		{ time: start + duration, value: to },
	]);

	kit.lfo(6, from * 0.02, hum.frequency, start, duration);
}

export const CINEMA_SOUNDS: SoundRecipe[] = [
	{
		id: "cinema-idle",
		duration: 3,
		variants: 1,
		loop: true,
		render: (kit) => {
			motor(kit, 0, 3, 52, 52, 0.12);
			shutter(kit, 0, 3, () => 18, 0.16);

			const flutter = kit.filter("bandpass", 900, 0.7, kit.gain(0.05));

			kit.lfo(18, 0.04, flutter.Q, 0, 3);
			kit.noise("pink", 0, 3, flutter);
		},
	},
	{
		id: "cinema-charge",
		duration: 2.1,
		variants: 1,
		render: (kit) => {
			motor(kit, 0, 2.1, 40, 170, 0.22);
			shutter(kit, 0, 2, (time) => 6 + time * 12, 0.2);

			const buzz = kit.osc(
				"square",
				60,
				0.3,
				1.8,
				kit.filter("lowpass", 900, 1, kit.hit(0.3, 1.4, 0.4, 0.06, kit.out)),
			);

			kit.lfo(30, 4, buzz.frequency, 0.3, 1.8);
		},
	},
	{
		id: "cinema-roll",
		duration: 1.4,
		variants: 1,
		render: (kit) => {
			impact(kit, 0.45, 70);
			motor(kit, 0.05, 1.3, 120, 150, 0.15);
			shutter(kit, 0.05, 1.3, () => 24, 0.18);
		},
	},
	{
		id: "cinema-stall",
		duration: 2.6,
		variants: 1,
		render: (kit) => {
			motor(kit, 0, 2.2, 160, 28, 0.2);
			shutter(kit, 0, 2.3, (time) => Math.max(2.5, 24 - time * 11), 0.24);
			impact(kit, 0.5, 50);

			const fizz = kit.filter(
				"highpass",
				2500,
				0.7,
				kit.hit(0.1, 0.3, 2, 0.1, kit.out),
			);

			kit.noise("white", 0.1, 2.4, fizz);
		},
	},
	{
		id: "cinema-rewind",
		duration: 1.7,
		variants: 1,
		render: (kit) => {
			motor(kit, 0, 1.6, 260, 90, 0.14);
			shutter(kit, 0, 1.6, (time) => 40 - time * 20, 0.14);
		},
	},
	{
		id: "film-piano",
		duration: PIANO_LOOP,
		variants: 1,
		loop: true,
		render: (kit) => {
			MELODY.forEach((bar, barIndex) => {
				bar.forEach((note, step) => {
					if (note !== null) {
						pianoNote(kit, note, barIndex * BAR + step * EIGHTH, EIGHTH, 0.32);
					}
				});
			});

			HARMONY.forEach((chords, barIndex) => {
				const span = BAR / chords.length;

				chords.forEach(([bass, triad], index) => {
					const start = barIndex * BAR + index * span;

					for (let beat = 0; beat < span / BEAT - 0.01; beat += 1) {
						const time = start + beat * BEAT;

						if (beat % 2 === 0) {
							pianoNote(kit, bass, time, BEAT, 0.3);
						} else {
							for (const tone of triad) {
								pianoNote(kit, tone, time, BEAT * 0.6, 0.12);
							}
						}
					}
				});
			});
		},
	},
	{
		id: "film-jump",
		duration: 0.25,
		variants: 2,
		render: (kit, variant) => {
			const tone = kit.osc(
				"sine",
				820 + variant * 90,
				0,
				0.2,
				kit.hit(0, 0.002, 0.12, 0.35, kit.out),
			);

			kit.expEnvelope(tone.frequency, [
				{ time: 0, value: 700 + variant * 90 },
				{ time: 0.12, value: 1250 + variant * 90 },
			]);

			kit.noise(
				"white",
				0,
				0.015,
				kit.filter("bandpass", 2400, 2, kit.hit(0, 0.001, 0.01, 0.2, kit.out)),
			);
		},
	},
	{
		id: "film-win",
		duration: 3.2,
		variants: 1,
		render: (kit) => {
			[60, 64, 67, 72, 76].forEach((note, index) => {
				pianoNote(kit, note, index * 0.09, 1.6, 0.26);
			});

			const fizz = kit.filter(
				"highpass",
				3000,
				0.7,
				kit.hit(0, 0.2, 2.6, 0.12, kit.out),
			);

			kit.noise("white", 0, 3, fizz);
		},
	},
	{
		id: "film-fin",
		duration: 3.6,
		variants: 1,
		render: (kit) => {
			const chords: [number, readonly number[]][] = [
				[0, [57, 60, 63, 66]],
				[0.42, [56, 59, 62, 65]],
				[0.95, [33, 45, 57, 60, 64]],
			];

			for (const [time, notes] of chords) {
				for (const note of notes) {
					pianoNote(kit, note, time, 1.8, 0.2);
				}
			}

			shutter(kit, 1.6, 1.9, (time) => Math.max(1.5, 9 - time * 4), 0.22);
		},
	},
];
