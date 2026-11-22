import type { SynthKit } from "../synthKit.js";
import { breath, whisper } from "./anomalySounds.js";
import type { SoundRecipe } from "./types.js";

function flutter(
	kit: SynthKit,
	start: number,
	duration: number,
	rate: number,
	peak: number,
	brightness: number,
): void {
	const beats = Math.floor(duration * rate);

	for (let index = 0; index < beats; index += 1) {
		const time = start + index / rate + kit.range(-0.008, 0.008);
		const swell = 0.6 + 0.4 * Math.sin((index / Math.max(1, beats)) * Math.PI);

		kit.noise(
			"pink",
			time,
			0.09,
			kit.filter(
				"bandpass",
				brightness * kit.range(0.85, 1.15),
				0.8,
				kit.hit(time, 0.012, 0.07, peak * swell, kit.out),
			),
		);
	}
}

function glitter(
	kit: SynthKit,
	start: number,
	duration: number,
	count: number,
	peak: number,
): void {
	for (let index = 0; index < count; index += 1) {
		const time = start + kit.range(0, duration);
		const pitch = kit.range(2200, 6400);

		const ping = kit.osc(
			"sine",
			pitch,
			time,
			0.35,
			kit.hit(time, 0.003, kit.range(0.12, 0.3), peak, kit.out),
		);

		kit.expEnvelope(ping.frequency, [
			{ time, value: pitch },
			{ time: time + 0.3, value: pitch * kit.range(0.92, 1.08) },
		]);
	}
}

function warble(
	kit: SynthKit,
	start: number,
	duration: number,
	from: number,
	to: number,
	peak: number,
): void {
	const output = kit.gain(0);

	kit.envelope(output.gain, [
		{ time: start, value: 0 },
		{ time: start + duration * 0.35, value: peak },
		{ time: start + duration * 0.7, value: peak * 0.8 },
		{ time: start + duration, value: 0 },
	]);

	const tone = kit.filter("lowpass", 2400, 1.2, output);

	for (const detune of [1, 1.012, 0.991]) {
		const voice = kit.osc("triangle", from * detune, start, duration, tone);

		kit.expEnvelope(voice.frequency, [
			{ time: start, value: from * detune },
			{ time: start + duration, value: to * detune },
		]);

		kit.lfo(kit.range(4.5, 7), from * 0.035, voice.frequency, start, duration);
	}
}

export const VISION_SOUNDS: SoundRecipe[] = [
	{
		id: "phalene-idle",
		duration: 3,
		variants: 1,
		loop: true,
		render: (kit) => {
			flutter(kit, 0, 3, 5.5, 0.16, 700);

			for (let index = 0; index < 6; index += 1) {
				const start = kit.range(0, 2.7);

				kit.osc(
					"sine",
					kit.range(2400, 3600),
					start,
					0.6,
					kit.hit(start, 0.01, 0.5, 0.035, kit.out),
				);
			}
		},
	},
	{
		id: "phalene-windup",
		duration: 1.1,
		variants: 1,
		render: (kit) => {
			flutter(kit, 0, 1, 14, 0.32, 900);
			glitter(kit, 0.2, 0.8, 14, 0.05);
			breath(kit, 0, 1, 1400, 0.18);
		},
	},
	{
		id: "phalene-dust",
		duration: 1.6,
		variants: 2,
		render: (kit) => {
			flutter(kit, 0, 0.35, 18, 0.45, 650);
			glitter(kit, 0.05, 1.1, 36, 0.07);

			const sweep = kit.filter(
				"bandpass",
				3200,
				0.9,
				kit.hit(0.02, 0.06, 1.2, 0.3, kit.out),
			);

			kit.expEnvelope(sweep.frequency, [
				{ time: 0.02, value: 4200 },
				{ time: 1.3, value: 500 },
			]);

			kit.noise("pink", 0.02, 1.4, sweep);
		},
	},
	{
		id: "phalene-sting",
		duration: 0.6,
		variants: 2,
		render: (kit) => {
			kit.noise(
				"white",
				0,
				0.14,
				kit.filter(
					"highpass",
					3800,
					0.7,
					kit.hit(0, 0.002, 0.12, 0.5, kit.out),
				),
			);

			const whistle = kit.osc(
				"sine",
				2600,
				0,
				0.4,
				kit.hit(0, 0.004, 0.32, 0.16, kit.out),
			);

			kit.expEnvelope(whistle.frequency, [
				{ time: 0, value: 2600 },
				{ time: 0.35, value: 700 },
			]);

			flutter(kit, 0.05, 0.4, 16, 0.25, 800);
		},
	},
	{
		id: "visions-start",
		duration: 2.8,
		variants: 1,
		render: (kit) => {
			warble(kit, 0, 2.6, 180, 420, 0.16);
			warble(kit, 0.15, 2.4, 271, 610, 0.1);
			glitter(kit, 0.3, 2.2, 40, 0.045);
			whisper(kit, 0.6, 1.6, 0.12);

			const swell = kit.filter(
				"bandpass",
				500,
				1.1,
				kit.hit(0, 1.6, 1, 0.22, kit.out),
			);

			kit.expEnvelope(swell.frequency, [
				{ time: 0, value: 300 },
				{ time: 2.2, value: 3600 },
			]);

			kit.noise("pink", 0, 2.6, swell);
		},
	},
	{
		id: "visions-end",
		duration: 1.6,
		variants: 1,
		render: (kit) => {
			warble(kit, 0, 1.4, 520, 160, 0.12);
			glitter(kit, 0, 0.9, 18, 0.04);
			breath(kit, 0.1, 1.2, 900, 0.14);
		},
	},
	{
		id: "phantom-vanish",
		duration: 1,
		variants: 3,
		render: (kit) => {
			breath(kit, 0, 0.7, kit.range(1100, 1700), 0.3);
			glitter(kit, 0.02, 0.5, 10, 0.05);

			const fall = kit.osc(
				"triangle",
				kit.range(700, 900),
				0,
				0.7,
				kit.hit(0, 0.01, 0.6, 0.06, kit.out),
			);

			kit.expEnvelope(fall.frequency, [
				{ time: 0, value: 880 },
				{ time: 0.65, value: 220 },
			]);
		},
	},
];
