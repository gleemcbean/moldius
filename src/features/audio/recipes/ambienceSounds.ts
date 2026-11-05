import type { SoundRecipe } from "./types";

const MUSIC_BOX_NOTES = [
	[0, 659.3],
	[0.4, 523.3],
	[0.8, 440],
	[1.2, 493.9],
	[1.6, 523.3],
	[2.0, 493.9],
	[2.4, 440],
	[3.2, 415.3],
	[3.6, 440],
	[4.0, 493.9],
	[4.8, 329.6],
	[5.6, 659.3],
	[6.0, 587.3],
	[6.4, 523.3],
	[6.8, 493.9],
	[7.2, 440],
	[8.0, 440],
] as const;

export const AMBIENCE_SOUNDS: SoundRecipe[] = [
	{
		id: "rain-glass-loop",
		duration: 6,
		variants: 1,
		loop: true,
		render: (kit) => {
			kit.noise(
				"pink",
				0,
				6,
				kit.filter("highpass", 1800, 0.6, kit.gain(0.16, kit.out)),
			);
			kit.noise(
				"brown",
				0,
				6,
				kit.filter("lowpass", 400, 0.7, kit.gain(0.12, kit.out)),
			);
			for (let index = 0; index < 90; index += 1) {
				const time = kit.range(0, 5.9);
				kit.noise(
					"white",
					time,
					0.02,
					kit.filter(
						"bandpass",
						kit.range(2500, 6500),
						kit.range(4, 9),
						kit.hit(time, 0.001, 0.02, kit.range(0.05, 0.22), kit.out),
					),
				);
			}
		},
	},
	{
		id: "crypt-rumble-loop",
		duration: 8,
		variants: 1,
		loop: true,
		render: (kit) => {
			const low = kit.filter("lowpass", 120, 1.4, kit.gain(0.5, kit.out));
			kit.noise("brown", 0, 8, low);
			kit.lfo(0.25, 50, low.frequency, 0, 8);
			const hum = kit.osc("sine", 36, 0, 8, kit.gain(0.18, kit.out));
			kit.lfo(0.125, 1.5, hum.frequency, 0, 8);
			for (const time of [1.3, 4.6, 6.9]) {
				const drop = kit.osc(
					"sine",
					1100,
					time,
					0.2,
					kit.hit(time, 0.002, 0.18, 0.12, kit.out),
				);
				kit.expEnvelope(drop.frequency, [
					{ time, value: 900 },
					{ time: time + 0.08, value: 1800 },
				]);
			}
		},
	},
	{
		id: "pond-water-loop",
		duration: 6,
		variants: 1,
		loop: true,
		render: (kit) => {
			kit.noise(
				"brown",
				0,
				6,
				kit.filter("lowpass", 320, 0.7, kit.gain(0.1, kit.out)),
			);
			kit.noise(
				"pink",
				0,
				6,
				kit.filter("bandpass", 1400, 0.8, kit.gain(0.025, kit.out)),
			);
			for (let index = 0; index < 14; index += 1) {
				const time = kit.range(0, 5.8);
				const bubble = kit.osc(
					"sine",
					500,
					time,
					0.08,
					kit.hit(time, 0.002, 0.06, kit.range(0.03, 0.07), kit.out),
				);
				kit.expEnvelope(bubble.frequency, [
					{ time, value: kit.range(380, 620) },
					{ time: time + 0.06, value: kit.range(1100, 1700) },
				]);
			}
		},
	},
	{
		id: "organ-drone-loop",
		duration: 8,
		variants: 1,
		loop: true,
		render: (kit) => {
			const output = kit.filter("lowpass", 1400, 0.7, kit.gain(0.2, kit.out));
			for (const [frequency, level] of [
				[73.4, 0.5],
				[146.8, 0.35],
				[174.6, 0.25],
				[220, 0.25],
				[293.7, 0.12],
			] as const) {
				for (const detune of [-0.4, 0.4]) {
					const pipe = kit.osc(
						"triangle",
						frequency + detune,
						0,
						8,
						kit.gain(level, output),
					);
					kit.lfo(5.2, frequency * 0.003, pipe.frequency, 0, 8);
				}
			}
			kit.noise(
				"pink",
				0,
				8,
				kit.filter("bandpass", 900, 1.5, kit.gain(0.02, kit.out)),
			);
		},
	},
	{
		id: "pipes-loop",
		duration: 6,
		variants: 1,
		loop: true,
		render: (kit) => {
			kit.osc(
				"sine",
				58,
				0,
				6,
				kit.filter("lowpass", 200, 1, kit.gain(0.12, kit.out)),
			);
			for (let index = 0; index < 7; index += 1) {
				const time = kit.range(0.2, 5.2);
				const length = kit.range(0.3, 0.7);
				const band = kit.filter(
					"bandpass",
					kit.range(250, 600),
					6,
					kit.hit(time, 0.05, length, kit.range(0.15, 0.3), kit.out),
				);
				kit.lfo(kit.range(12, 22), 160, band.frequency, time, length);
				kit.noise("pink", time, length + 0.1, band);
			}
		},
	},
	{
		id: "attic-wind-loop",
		duration: 8,
		variants: 1,
		loop: true,
		render: (kit) => {
			const whistle = kit.filter("bandpass", 1100, 18, kit.gain(0.5, kit.out));
			kit.noise("white", 0, 8, whistle);
			kit.lfo(0.125, 420, whistle.frequency, 0, 8);
			const gust = kit.filter("bandpass", 380, 1.4, kit.gain(0.3, kit.out));
			kit.noise("pink", 0, 8, gust);
			kit.lfo(0.25, 160, gust.frequency, 0, 8);
		},
	},
	{
		id: "music-box-loop",
		duration: 9.6,
		variants: 1,
		loop: true,
		render: (kit) => {
			for (const [time, frequency] of MUSIC_BOX_NOTES) {
				for (const [ratio, level] of [
					[1, 0.22],
					[2.01, 0.08],
					[4.2, 0.03],
				] as const) {
					kit.osc(
						"sine",
						frequency * ratio * 0.998,
						time,
						1.4,
						kit.hit(time, 0.002, 1.3, level, kit.out),
					);
				}
			}
		},
	},
	{
		id: "clock-loop",
		duration: 2,
		variants: 1,
		loop: true,
		render: (kit) => {
			for (const [time, tock] of [
				[0.05, false],
				[1.05, true],
			] as const) {
				kit.noise(
					"white",
					time,
					0.015,
					kit.filter(
						"bandpass",
						tock ? 3100 : 3900,
						6,
						kit.hit(time, 0.0008, 0.035, 0.6, kit.out),
					),
				);
				kit.osc(
					"sine",
					tock ? 980 : 1260,
					time,
					0.16,
					kit.hit(time, 0.001, 0.1, 0.2, kit.out),
				);
			}
		},
	},
	{
		id: "drone-loop",
		duration: 8,
		variants: 1,
		loop: true,
		render: (kit) => {
			const output = kit.gain(0.32);
			const filter = kit.filter("lowpass", 220, 1.2, output);
			for (const frequency of [41.2, 41.7, 43.7, 58.3, 61.7, 82.6]) {
				const oscillator = kit.osc("sawtooth", frequency, 0, 8, filter);
				kit.lfo(0.125, 0.4, oscillator.frequency, 0, 8);
			}
			kit.lfo(0.125, 60, filter.frequency, 0, 8);
		},
	},
	{
		id: "moan-far",
		duration: 3,
		variants: 3,
		loop: false,
		render: (kit) => {
			const start = kit.range(150, 190);
			const output = kit.filter(
				"bandpass",
				kit.range(380, 520),
				1.4,
				kit.gain(0.5, kit.out),
			);
			const envelope = kit.gain(0, output);
			kit.envelope(envelope.gain, [
				{ time: 0, value: 0 },
				{ time: 0.9, value: 0.5 },
				{ time: 2.2, value: 0.35 },
				{ time: 3, value: 0 },
			]);
			for (const detune of [0, 1.8]) {
				const voice = kit.osc("triangle", start + detune, 0, 3, envelope);
				kit.envelope(voice.frequency, [
					{ time: 0, value: start + detune },
					{ time: 3, value: start * 0.68 + detune },
				]);
				kit.lfo(5.5, 3, voice.frequency, 0, 3);
			}
			kit.noise(
				"pink",
				0,
				3,
				kit.filter("bandpass", 700, 2, kit.gain(0.04, envelope)),
			);
		},
	},
	{
		id: "chains-far",
		duration: 1.6,
		variants: 3,
		loop: false,
		render: (kit) => {
			for (let index = 0; index < 9; index += 1) {
				const time = index * kit.range(0.09, 0.16);
				const ring = kit.hit(time, 0.002, 0.25, kit.range(0.05, 0.12), kit.out);
				kit.osc("sine", kit.range(1900, 2600), time, 0.4, ring);
				kit.osc("sine", kit.range(3300, 4200), time, 0.3, ring);
				kit.noise(
					"white",
					time,
					0.03,
					kit.filter(
						"bandpass",
						kit.range(3000, 6000),
						6,
						kit.hit(time, 0.001, 0.03, 0.12, kit.out),
					),
				);
			}
		},
	},
	{
		id: "wind-loop",
		duration: 8,
		variants: 1,
		loop: true,
		render: (kit) => {
			const band = kit.filter("bandpass", 500, 2.2, kit.gain(0.32, kit.out));
			kit.noise("pink", 0, 8, band);
			kit.lfo(0.25, 260, band.frequency, 0, 8);
			const high = kit.filter("bandpass", 1400, 6, kit.gain(0.06, kit.out));
			kit.noise("white", 0, 8, high);
			kit.lfo(0.375, 500, high.frequency, 0, 8);
		},
	},
	{
		id: "creak",
		duration: 1.4,
		variants: 4,
		render: (kit, variant) => {
			const output = kit.hit(0, 0.1, 1.2, 0.3, kit.out);
			const band = kit.filter("bandpass", 600 + variant * 210, 10, output);
			const saw = kit.osc("sawtooth", 30 + variant * 7, 0, 1.3, band);
			kit.lfo(9 + variant * 2, 14, saw.frequency, 0, 1.3, "square");
			kit.envelope(saw.frequency, [
				{ time: 0, value: 28 + variant * 6 },
				{ time: 1.2, value: 44 + variant * 8 },
			]);
		},
	},
	{
		id: "thump",
		duration: 1,
		variants: 3,
		render: (kit) => {
			kit.noise(
				"brown",
				0,
				0.6,
				kit.filter("lowpass", 260, 0.7, kit.hit(0, 0.004, 0.5, 1, kit.out)),
			);
			kit.osc("sine", 45, 0, 0.5, kit.hit(0, 0.004, 0.4, 0.8, kit.out));
		},
	},
	{
		id: "whisper-far",
		duration: 2.4,
		variants: 3,
		render: (kit) => {
			for (let index = 0; index < 14; index += 1) {
				const start = index * 0.15 + kit.range(0, 0.05);
				const formant = kit.filter(
					"bandpass",
					kit.range(1500, 4500),
					kit.range(5, 10),
					kit.hit(start, 0.03, 0.12, kit.range(0.08, 0.2), kit.out),
				);
				kit.noise("white", start, 0.14, formant);
			}
		},
	},
	{
		id: "drip",
		duration: 0.6,
		variants: 3,
		render: (kit, variant) => {
			const drop = kit.osc(
				"sine",
				900 + variant * 200,
				0,
				0.15,
				kit.hit(0, 0.002, 0.12, 0.3, kit.out),
			);
			kit.expEnvelope(drop.frequency, [
				{ time: 0, value: 700 + variant * 200 },
				{ time: 0.08, value: 1600 + variant * 250 },
			]);
		},
	},
	{
		id: "clock-tick",
		duration: 0.3,
		variants: 2,
		render: (kit, variant) => {
			const tock = variant === 1;
			kit.noise(
				"white",
				0,
				0.015,
				kit.filter(
					"bandpass",
					tock ? 3100 : 3900,
					6,
					kit.hit(0, 0.0008, 0.035, 0.6, kit.out),
				),
			);
			kit.osc(
				"sine",
				tock ? 980 : 1260,
				0,
				0.16,
				kit.hit(0, 0.001, 0.1, 0.22, kit.out),
			);
			kit.osc(
				"triangle",
				tock ? 2350 : 2900,
				0,
				0.06,
				kit.hit(0, 0.0005, 0.03, 0.08, kit.out),
			);
			kit.osc(
				"sine",
				tock ? 150 : 185,
				0,
				0.08,
				kit.hit(0, 0.002, 0.05, 0.25, kit.out),
			);
		},
	},
	{
		id: "ui-hover",
		duration: 0.08,
		variants: 1,
		render: (kit) => {
			kit.osc(
				"square",
				1320,
				0,
				0.05,
				kit.filter("lowpass", 3000, 1, kit.hit(0, 0.002, 0.05, 0.06, kit.out)),
			);
		},
	},
	{
		id: "ui-click",
		duration: 0.15,
		variants: 1,
		render: (kit) => {
			kit.osc(
				"square",
				660,
				0,
				0.06,
				kit.filter("lowpass", 2400, 1, kit.hit(0, 0.002, 0.06, 0.12, kit.out)),
			);
			kit.osc(
				"square",
				990,
				0.05,
				0.06,
				kit.filter(
					"lowpass",
					2400,
					1,
					kit.hit(0.05, 0.002, 0.06, 0.1, kit.out),
				),
			);
		},
	},
];
