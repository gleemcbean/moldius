import type { SynthKit } from "../synthKit";
import type { SoundRecipe } from "./types";

function growl(
	kit: SynthKit,
	start: number,
	duration: number,
	base: number,
	peak: number,
	brightness: number,
): void {
	const output = kit.hit(start, 0.08, duration, peak, kit.out);
	const filter = kit.filter("lowpass", brightness, 3, output);
	const saw = kit.osc(
		"sawtooth",
		base,
		start,
		duration + 0.1,
		kit.shaper(8, filter),
	);
	kit.lfo(
		kit.range(17, 29),
		base * 0.35,
		saw.frequency,
		start,
		duration + 0.1,
		"square",
	);
	kit.noise(
		"brown",
		start,
		duration,
		kit.filter(
			"bandpass",
			base * 3,
			1,
			kit.hit(start, 0.1, duration, peak * 0.5, kit.out),
		),
	);
}

function breath(
	kit: SynthKit,
	start: number,
	duration: number,
	center: number,
	peak: number,
): void {
	const band = kit.filter(
		"bandpass",
		center,
		1.4,
		kit.hit(start, duration * 0.4, duration * 0.6, peak, kit.out),
	);
	kit.envelope(band.frequency, [
		{ time: start, value: center * 0.8 },
		{ time: start + duration, value: center * 1.3 },
	]);
	kit.noise("pink", start, duration, band);
}

function whisper(
	kit: SynthKit,
	start: number,
	duration: number,
	peak: number,
): void {
	const syllables = Math.floor(duration / 0.13);
	for (let index = 0; index < syllables; index += 1) {
		const time = start + index * 0.13 + kit.range(0, 0.04);
		const formant = kit.filter(
			"bandpass",
			kit.range(1800, 5200),
			kit.range(4, 9),
			kit.hit(time, 0.02, 0.11, peak * kit.range(0.4, 1), kit.out),
		);
		kit.noise("white", time, 0.12, formant);
	}
}

function skitter(
	kit: SynthKit,
	start: number,
	duration: number,
	count: number,
	peak: number,
): void {
	for (let index = 0; index < count; index += 1) {
		const time = start + kit.range(0, duration - 0.03);
		kit.noise(
			"white",
			time,
			0.03,
			kit.filter(
				"bandpass",
				kit.range(2400, 6800),
				kit.range(2, 5),
				kit.hit(time, 0.002, 0.025, peak * kit.range(0.3, 1), kit.out),
			),
		);
	}
}

function squeak(
	kit: SynthKit,
	start: number,
	duration: number,
	peak: number,
): void {
	const base = kit.range(2600, 3800);
	const voice = kit.osc(
		"triangle",
		base,
		start,
		duration,
		kit.hit(start, 0.01, duration * 0.9, peak, kit.out),
	);
	kit.envelope(voice.frequency, [
		{ time: start, value: base },
		{ time: start + duration * 0.4, value: base * 1.25 },
		{ time: start + duration, value: base * 0.85 },
	]);
	kit.lfo(kit.range(30, 45), base * 0.06, voice.frequency, start, duration);
}

function scream(
	kit: SynthKit,
	start: number,
	duration: number,
	base: number,
	peak: number,
): void {
	const output = kit.hit(start, 0.04, duration, peak, kit.out);
	const formant = kit.filter("bandpass", base * 3.2, 1.6, output);
	const voice = kit.osc(
		"sawtooth",
		base,
		start,
		duration,
		kit.shaper(14, formant),
	);
	kit.envelope(voice.frequency, [
		{ time: start, value: base * 0.8 },
		{ time: start + duration * 0.25, value: base * 1.6 },
		{ time: start + duration, value: base * 1.1 },
	]);
	kit.lfo(kit.range(7, 11), base * 0.08, voice.frequency, start, duration);
	const second = kit.osc(
		"square",
		base * 1.51,
		start,
		duration,
		kit.shaper(10, formant),
	);
	kit.lfo(13, base * 0.1, second.frequency, start, duration);
	kit.noise(
		"white",
		start,
		duration,
		kit.filter(
			"highpass",
			3000,
			0.7,
			kit.hit(start, 0.05, duration, peak * 0.25, kit.out),
		),
	);
}

function impact(kit: SynthKit, peak: number, low: number): void {
	kit.noise(
		"brown",
		0,
		0.35,
		kit.filter("lowpass", 900, 0.7, kit.hit(0, 0.002, 0.3, peak, kit.out)),
	);
	const thump = kit.osc(
		"sine",
		low * 2,
		0,
		0.3,
		kit.hit(0, 0.002, 0.25, peak * 0.8, kit.out),
	);
	kit.expEnvelope(thump.frequency, [
		{ time: 0, value: low * 2 },
		{ time: 0.25, value: low },
	]);
}

function riser(
	kit: SynthKit,
	duration: number,
	from: number,
	to: number,
	peak: number,
	type: OscillatorType,
): void {
	const output = kit.gain(0);
	kit.envelope(output.gain, [
		{ time: 0, value: 0 },
		{ time: duration * 0.85, value: peak },
		{ time: duration, value: 0 },
	]);
	const tone = kit.osc(
		type,
		from,
		0,
		duration,
		kit.filter("lowpass", 1800, 2, output),
	);
	kit.expEnvelope(tone.frequency, [
		{ time: 0, value: from },
		{ time: duration, value: to },
	]);
	kit.lfo(9, from * 0.04, tone.frequency, 0, duration);
}

export const ANOMALY_SOUNDS: SoundRecipe[] = [
	{
		id: "colosse-idle",
		duration: 3.4,
		variants: 2,
		loop: true,
		render: (kit) => {
			breath(kit, 0.1, 1.3, 220, 0.5);
			breath(kit, 1.8, 1.3, 190, 0.45);
			for (let index = 0; index < 5; index += 1) {
				const time = kit.range(0.2, 3.1);
				kit.noise(
					"white",
					time,
					0.05,
					kit.filter(
						"bandpass",
						kit.range(3200, 5200),
						8,
						kit.hit(time, 0.003, 0.05, 0.25, kit.out),
					),
				);
			}
		},
	},
	{
		id: "colosse-windup",
		duration: 1.1,
		variants: 2,
		render: (kit, variant) => growl(kit, 0, 0.95, 46 + variant * 6, 0.75, 700),
	},
	{
		id: "colosse-throw",
		duration: 0.9,
		variants: 2,
		render: (kit) => {
			const band = kit.filter(
				"bandpass",
				400,
				1.2,
				kit.hit(0, 0.12, 0.6, 0.7, kit.out),
			);
			kit.expEnvelope(band.frequency, [
				{ time: 0, value: 300 },
				{ time: 0.6, value: 2200 },
			]);
			kit.noise("pink", 0, 0.75, band);
			growl(kit, 0, 0.35, 70, 0.4, 1200);
		},
	},
	{
		id: "throw-impact",
		duration: 0.7,
		variants: 2,
		render: (kit) => {
			const thump = kit.osc(
				"sine",
				120,
				0,
				0.5,
				kit.hit(0, 0.005, 0.45, 0.9, kit.out),
			);
			kit.expEnvelope(thump.frequency, [
				{ time: 0, value: 140 },
				{ time: 0.4, value: 45 },
			]);
			kit.noise(
				"brown",
				0,
				0.4,
				kit.filter("lowpass", 900, 1, kit.hit(0, 0.004, 0.35, 0.6, kit.out)),
			);
		},
	},
	{
		id: "fulgurant-idle",
		duration: 2.4,
		variants: 1,
		loop: true,
		render: (kit) => {
			for (let index = 0; index < 12; index += 1) {
				const time = index * 0.2 + 0.02;
				kit.osc(
					"square",
					index % 2 === 0 ? 1900 : 1500,
					time,
					0.02,
					kit.filter(
						"highpass",
						900,
						1,
						kit.hit(time, 0.001, 0.02, 0.12, kit.out),
					),
				);
			}
			kit.osc(
				"sawtooth",
				55,
				0,
				2.4,
				kit.filter("lowpass", 240, 1, kit.gain(0.08, kit.out)),
			);
		},
	},
	{
		id: "fulgurant-charge",
		duration: 1.6,
		variants: 1,
		render: (kit) => {
			riser(kit, 1.5, 180, 2400, 0.45, "sawtooth");
			riser(kit, 1.5, 360, 3600, 0.2, "square");
		},
	},
	{
		id: "fulgurant-fire",
		duration: 0.9,
		variants: 2,
		render: (kit) => {
			const zap = kit.osc(
				"square",
				1800,
				0,
				0.5,
				kit.filter("lowpass", 5000, 2, kit.hit(0, 0.002, 0.45, 0.6, kit.out)),
			);
			kit.expEnvelope(zap.frequency, [
				{ time: 0, value: 2600 },
				{ time: 0.45, value: 90 },
			]);
			kit.noise(
				"white",
				0,
				0.25,
				kit.filter("highpass", 1500, 0.7, kit.hit(0, 0.001, 0.22, 0.5, kit.out)),
			);
		},
	},
	{
		id: "fulgurant-vent",
		duration: 2.6,
		variants: 1,
		render: (kit) => {
			kit.noise(
				"white",
				0,
				2.5,
				kit.filter("highpass", 2600, 0.6, kit.hit(0, 0.05, 2.4, 0.35, kit.out)),
			);
			for (let index = 0; index < 6; index += 1) {
				const time = 0.3 + index * 0.35;
				kit.osc(
					"sine",
					kit.range(600, 900),
					time,
					0.08,
					kit.hit(time, 0.005, 0.08, 0.08, kit.out),
				);
			}
		},
	},
	{
		id: "gorgone-idle",
		duration: 3.6,
		variants: 2,
		loop: true,
		render: (kit) => {
			for (let index = 0; index < 5; index += 1) {
				const time = kit.range(0.1, 3.0);
				kit.noise(
					"white",
					time,
					0.45,
					kit.filter(
						"bandpass",
						kit.range(5000, 7500),
						3,
						kit.hit(time, 0.08, 0.35, 0.18, kit.out),
					),
				);
			}
			whisper(kit, 0.4, 2.4, 0.08);
		},
	},
	{
		id: "gorgone-shriek",
		duration: 1.2,
		variants: 1,
		render: (kit) => {
			scream(kit, 0, 0.9, 620, 0.7);
			scream(kit, 0.05, 0.85, 930, 0.35);
			kit.noise(
				"white",
				0,
				0.9,
				kit.filter("bandpass", 6200, 2, kit.hit(0, 0.05, 0.8, 0.3, kit.out)),
			);
		},
	},
	{
		id: "brume-idle",
		duration: 4,
		variants: 1,
		loop: true,
		render: (kit) => {
			const air = kit.filter("lowpass", 420, 0.7, kit.gain(0.12, kit.out));
			kit.noise("pink", 0, 4, air);
			kit.lfo(0.5, 160, air.frequency, 0, 4);
			breath(kit, 0.6, 1.6, 900, 0.1);
			breath(kit, 2.4, 1.4, 760, 0.08);
		},
	},
	{
		id: "brume-cling",
		duration: 1.6,
		variants: 1,
		render: (kit) => {
			breath(kit, 0, 1.4, 600, 0.3);
			whisper(kit, 0.2, 1.2, 0.18);
		},
	},
	{
		id: "ratroi-idle",
		duration: 3,
		variants: 2,
		loop: true,
		render: (kit) => {
			skitter(kit, 0, 3, 46, 0.12);
			for (let index = 0; index < 5; index += 1) {
				squeak(kit, kit.range(0, 2.7), kit.range(0.08, 0.2), 0.07);
			}
		},
	},
	{
		id: "ratroi-scatter",
		duration: 1.3,
		variants: 1,
		render: (kit) => {
			skitter(kit, 0, 1.2, 140, 0.32);
			for (let index = 0; index < 9; index += 1) {
				squeak(kit, kit.range(0, 0.8), kit.range(0.1, 0.3), 0.16);
			}
		},
	},
	{
		id: "ratroi-bite",
		duration: 0.7,
		variants: 2,
		render: (kit) => {
			for (let index = 0; index < 4; index += 1) {
				squeak(kit, index * 0.06, 0.25, 0.22);
			}
			skitter(kit, 0.2, 0.4, 60, 0.3);
		},
	},
	{
		id: "murmure-idle",
		duration: 3,
		variants: 2,
		loop: true,
		render: (kit) => {
			whisper(kit, 0.1, 2.6, 0.22);
			kit.noise(
				"pink",
				0,
				3,
				kit.filter("bandpass", 700, 0.8, kit.gain(0.06, kit.out)),
			);
		},
	},
	{
		id: "murmure-awaken",
		duration: 1.4,
		variants: 1,
		render: (kit) => {
			whisper(kit, 0, 1.2, 0.45);
			riser(kit, 1.3, 140, 420, 0.35, "sawtooth");
		},
	},
	{
		id: "murmure-attack",
		duration: 0.8,
		variants: 2,
		render: (kit) => scream(kit, 0, 0.6, 320, 0.5),
	},
	{
		id: "veilleur-idle",
		duration: 3.2,
		variants: 2,
		loop: true,
		render: (kit) => {
			breath(kit, 0.1, 1.2, 380, 0.4);
			breath(kit, 1.6, 1.4, 300, 0.35);
		},
	},
	{
		id: "veilleur-chase",
		duration: 1.6,
		variants: 2,
		render: (kit, variant) => growl(kit, 0, 1.3, 58 + variant * 9, 0.6, 900),
	},
	{
		id: "veilleur-windup",
		duration: 1,
		variants: 1,
		render: (kit) => {
			breath(kit, 0, 0.7, 520, 0.6);
			growl(kit, 0.45, 0.45, 75, 0.5, 1400);
		},
	},
	{
		id: "cendre-idle",
		duration: 3,
		variants: 1,
		loop: true,
		render: (kit) => {
			kit.noise(
				"brown",
				0,
				3,
				kit.filter("lowpass", 300, 0.8, kit.gain(0.45, kit.out)),
			);
			for (let index = 0; index < 20; index += 1) {
				const start = kit.range(0, 2.9);
				kit.noise(
					"white",
					start,
					0.04,
					kit.filter(
						"bandpass",
						kit.range(800, 3000),
						2,
						kit.hit(start, 0.002, 0.04, kit.range(0.1, 0.4), kit.out),
					),
				);
			}
		},
	},
	{
		id: "cendre-windup",
		duration: 1,
		variants: 1,
		render: (kit) => {
			riser(kit, 0.9, 50, 160, 0.45, "sawtooth");
			kit.noise(
				"brown",
				0,
				0.9,
				kit.filter("lowpass", 600, 1, kit.hit(0, 0.6, 0.3, 0.6, kit.out)),
			);
		},
	},
	{
		id: "cendre-spit",
		duration: 0.5,
		variants: 2,
		render: (kit) => {
			kit.noise(
				"white",
				0,
				0.3,
				kit.filter(
					"bandpass",
					1500,
					0.8,
					kit.hit(0, 0.004, 0.28, 0.8, kit.out),
				),
			);
			impact(kit, 0.5, 70);
		},
	},
	{
		id: "ember-impact",
		duration: 0.6,
		variants: 2,
		render: (kit) => {
			impact(kit, 0.7, 60);
			for (let index = 0; index < 8; index += 1) {
				const start = kit.range(0.02, 0.45);
				kit.noise(
					"white",
					start,
					0.03,
					kit.filter(
						"highpass",
						3500,
						1,
						kit.hit(start, 0.001, 0.03, 0.2, kit.out),
					),
				);
			}
		},
	},
	{
		id: "collecteur-idle",
		duration: 3,
		variants: 1,
		loop: true,
		render: (kit) => {
			for (let index = 0; index < 9; index += 1) {
				const start = index * 0.32 + kit.range(0, 0.1);
				kit.osc(
					"square",
					kit.range(500, 900),
					start,
					0.05,
					kit.filter(
						"bandpass",
						1800,
						6,
						kit.hit(start, 0.001, 0.05, 0.18, kit.out),
					),
				);
			}
			breath(kit, 0.2, 1.6, 260, 0.25);
		},
	},
	{
		id: "collecteur-windup",
		duration: 1.1,
		variants: 1,
		render: (kit) => {
			growl(kit, 0, 0.9, 45, 0.55, 700);
			kit.noise(
				"pink",
				0.5,
				0.5,
				kit.filter("bandpass", 900, 1, kit.hit(0.5, 0.2, 0.3, 0.4, kit.out)),
			);
		},
	},
	{
		id: "collecteur-grab",
		duration: 0.9,
		variants: 1,
		render: (kit) => {
			impact(kit, 0.9, 55);
			kit.noise(
				"pink",
				0.15,
				0.7,
				kit.filter("lowpass", 500, 0.7, kit.hit(0.15, 0.05, 0.6, 0.6, kit.out)),
			);
		},
	},
	{
		id: "archiviste-idle",
		duration: 4,
		variants: 1,
		loop: true,
		render: (kit) => {
			for (let index = 0; index < 7; index += 1) {
				const start = kit.range(0, 3.6);
				const band = kit.filter(
					"bandpass",
					kit.range(1500, 4000),
					1,
					kit.hit(start, 0.08, 0.35, 0.25, kit.out),
				);
				kit.noise("white", start, 0.4, band);
			}
			kit.osc("sine", 82, 0, 4, kit.gain(0.08, kit.out));
			kit.osc("sine", 123.5, 0, 4, kit.gain(0.05, kit.out));
		},
	},
	{
		id: "archiviste-charge",
		duration: 1.2,
		variants: 1,
		render: (kit) => {
			riser(kit, 1.1, 110, 440, 0.4, "triangle");
			kit.noise(
				"white",
				0,
				1.1,
				kit.filter("highpass", 3000, 0.5, kit.hit(0, 0.9, 0.2, 0.25, kit.out)),
			);
		},
	},
	{
		id: "archiviste-pulse",
		duration: 1.4,
		variants: 1,
		render: (kit) => {
			impact(kit, 1.0, 40);
			kit.osc("sine", 220, 0, 1.2, kit.hit(0, 0.01, 1.1, 0.3, kit.out));
			kit.osc("sine", 329.6, 0, 1.2, kit.hit(0, 0.01, 1.1, 0.2, kit.out));
		},
	},
	{
		id: "luciole-idle",
		duration: 3,
		variants: 1,
		loop: true,
		render: (kit) => {
			for (let index = 0; index < 10; index += 1) {
				const start = kit.range(0, 2.8);
				const frequency = kit.range(1800, 3200);
				kit.osc(
					"sine",
					frequency,
					start,
					0.4,
					kit.hit(start, 0.005, 0.35, 0.08, kit.out),
				);
			}
			const wings = kit.filter("bandpass", 260, 2, kit.gain(0.08, kit.out));
			const buzz = kit.osc("sawtooth", 130, 0, 3, wings);
			kit.lfo(0.6, 20, buzz.frequency, 0, 3);
		},
	},
	{
		id: "double-reveal",
		duration: 1.2,
		variants: 1,
		render: (kit) => {
			scream(kit, 0.1, 0.9, 210, 0.55);
			kit.noise(
				"white",
				0,
				0.2,
				kit.filter("bandpass", 1200, 0.6, kit.hit(0, 0.002, 0.2, 0.5, kit.out)),
			);
		},
	},
	{
		id: "double-bite",
		duration: 0.5,
		variants: 2,
		render: (kit) => {
			impact(kit, 0.8, 90);
			kit.noise(
				"white",
				0,
				0.12,
				kit.filter("highpass", 2000, 0.8, kit.hit(0, 0.001, 0.1, 0.4, kit.out)),
			);
		},
	},
	{
		id: "hurleur-scream",
		duration: 2.3,
		variants: 3,
		render: (kit, variant) => {
			scream(kit, 0, 1.0, 520 + variant * 60, 0.75);
			scream(kit, 1.05, 1.15, 600 + variant * 40, 0.8);
		},
	},
	{
		id: "hurleur-wings",
		duration: 2,
		variants: 1,
		loop: true,
		render: (kit) => {
			for (let index = 0; index < 16; index += 1) {
				const start = index * 0.125;
				kit.noise(
					"pink",
					start,
					0.08,
					kit.filter(
						"lowpass",
						900,
						0.6,
						kit.hit(start, 0.01, 0.07, 0.25, kit.out),
					),
				);
			}
		},
	},
	{
		id: "suinteur-idle",
		duration: 3,
		variants: 1,
		loop: true,
		render: (kit) => {
			for (let index = 0; index < 8; index += 1) {
				const start = kit.range(0, 2.7);
				const bubble = kit.osc(
					"sine",
					kit.range(140, 320),
					start,
					0.12,
					kit.hit(start, 0.01, 0.1, 0.25, kit.out),
				);
				kit.expEnvelope(bubble.frequency, [
					{ time: start, value: kit.range(140, 220) },
					{ time: start + 0.1, value: kit.range(300, 520) },
				]);
			}
			kit.noise(
				"brown",
				0,
				3,
				kit.filter("lowpass", 250, 0.7, kit.gain(0.25, kit.out)),
			);
		},
	},
	{
		id: "suinteur-windup",
		duration: 0.8,
		variants: 1,
		render: (kit) => {
			const band = kit.filter(
				"bandpass",
				300,
				4,
				kit.hit(0, 0.5, 0.25, 0.6, kit.out),
			);
			kit.envelope(band.frequency, [
				{ time: 0, value: 200 },
				{ time: 0.7, value: 900 },
			]);
			kit.noise("brown", 0, 0.75, band);
		},
	},
	{
		id: "slime-spit",
		duration: 0.5,
		variants: 2,
		render: (kit) => {
			const band = kit.filter(
				"bandpass",
				700,
				2,
				kit.hit(0, 0.005, 0.35, 0.8, kit.out),
			);
			kit.envelope(band.frequency, [
				{ time: 0, value: 1200 },
				{ time: 0.3, value: 400 },
			]);
			kit.noise("pink", 0, 0.4, band);
		},
	},
	{
		id: "slime-splat",
		duration: 0.6,
		variants: 2,
		render: (kit) => {
			kit.noise(
				"brown",
				0,
				0.45,
				kit.filter("lowpass", 700, 1.5, kit.hit(0, 0.003, 0.4, 0.9, kit.out)),
			);
			const squish = kit.filter(
				"bandpass",
				500,
				3,
				kit.hit(0.02, 0.01, 0.3, 0.5, kit.out),
			);
			kit.envelope(squish.frequency, [
				{ time: 0.02, value: 300 },
				{ time: 0.3, value: 1300 },
			]);
			kit.noise("white", 0.02, 0.3, squish);
		},
	},
	{
		id: "boursoufle-idle",
		duration: 3.4,
		variants: 1,
		loop: true,
		render: (kit) => {
			breath(kit, 0.1, 1.4, 180, 0.4);
			breath(kit, 1.8, 1.4, 150, 0.35);
			kit.osc("sine", 48, 0, 3.4, kit.gain(0.08, kit.out));
		},
	},
	{
		id: "boursoufle-inflate",
		duration: 1.3,
		variants: 1,
		render: (kit) => {
			riser(kit, 1.25, 60, 380, 0.55, "sawtooth");
			const band = kit.filter(
				"bandpass",
				400,
				2,
				kit.hit(0, 1.1, 0.2, 0.5, kit.out),
			);
			kit.envelope(band.frequency, [
				{ time: 0, value: 200 },
				{ time: 1.2, value: 1800 },
			]);
			kit.noise("pink", 0, 1.25, band);
		},
	},
	{
		id: "explosion",
		duration: 2.6,
		variants: 1,
		render: (kit) => {
			kit.noise(
				"brown",
				0,
				2.4,
				kit.filter("lowpass", 1200, 0.6, kit.hit(0, 0.004, 2.2, 1.4, kit.out)),
			);
			kit.noise(
				"white",
				0,
				0.6,
				kit.filter("lowpass", 4000, 0.5, kit.hit(0, 0.002, 0.5, 0.8, kit.out)),
			);
			const sub = kit.osc(
				"sine",
				70,
				0,
				1.5,
				kit.hit(0, 0.004, 1.3, 1.2, kit.out),
			);
			kit.expEnvelope(sub.frequency, [
				{ time: 0, value: 90 },
				{ time: 1.4, value: 25 },
			]);
			const squelch = kit.filter(
				"bandpass",
				600,
				2,
				kit.hit(0.05, 0.02, 0.8, 0.6, kit.out),
			);
			kit.noise("pink", 0.05, 0.9, squelch);
		},
	},
	{
		id: "melee-swing",
		duration: 0.5,
		variants: 2,
		render: (kit) => {
			const band = kit.filter(
				"bandpass",
				600,
				1.2,
				kit.hit(0, 0.12, 0.3, 0.6, kit.out),
			);
			kit.envelope(band.frequency, [
				{ time: 0, value: 300 },
				{ time: 0.3, value: 1600 },
			]);
			kit.noise("white", 0, 0.45, band);
		},
	},
	{
		id: "melee-hit",
		duration: 0.5,
		variants: 2,
		render: (kit) => impact(kit, 1, 60),
	},
];
