import type { SoundRecipe } from "./types";

function footstep(
	id: string,
	cutoff: number,
	body: number,
	peak: number,
	texture: "wood" | "stone" | "soft",
): SoundRecipe {
	return {
		id,
		duration: 0.42,
		variants: 6,
		render: (kit, variant) => {
			if (texture === "wood" && variant >= 4) {
				const creak = kit.osc(
					"sawtooth",
					32 + variant * 5,
					0.03,
					0.32,
					kit.filter(
						"bandpass",
						700 + variant * 90,
						12,
						kit.hit(0.03, 0.04, 0.28, 0.12, kit.out),
					),
				);
				kit.lfo(11, 9, creak.frequency, 0.03, 0.32, "square");
			}
			if (texture === "stone") {
				kit.noise(
					"white",
					0.01,
					0.06,
					kit.filter(
						"bandpass",
						5200,
						2,
						kit.hit(0.01, 0.002, 0.05, peak * 0.18, kit.out),
					),
				);
			}
			const tone = kit.filter(
				"lowpass",
				cutoff * kit.range(0.8, 1.2),
				0.8,
				kit.hit(0, 0.004, 0.16, peak, kit.out),
			);
			kit.noise("pink", 0, 0.2, tone);
			const thump = kit.osc(
				"sine",
				body + variant * 6,
				0,
				0.12,
				kit.hit(0, 0.003, 0.09, peak * 0.7, kit.out),
			);
			kit.expEnvelope(thump.frequency, [
				{ time: 0, value: body + variant * 6 },
				{ time: 0.1, value: body * 0.55 },
			]);
		},
	};
}

export const PLAYER_SOUNDS: SoundRecipe[] = [
	footstep("step-wood", 1400, 95, 0.55, "wood"),
	footstep("step-stone", 2600, 140, 0.45, "stone"),
	footstep("step-soft", 700, 70, 0.35, "soft"),
	{
		id: "jump",
		duration: 0.45,
		variants: 3,
		render: (kit, variant) => {
			const band = kit.filter(
				"bandpass",
				600,
				1.6,
				kit.hit(0, 0.03, 0.28, 0.32, kit.out),
			);
			kit.expEnvelope(band.frequency, [
				{ time: 0, value: 500 + variant * 60 },
				{ time: 0.3, value: 1500 + variant * 120 },
			]);
			kit.noise("pink", 0, 0.32, band);
			const breath = kit.filter(
				"bandpass",
				900 + variant * 150,
				3,
				kit.hit(0, 0.02, 0.18, 0.12, kit.out),
			);
			kit.noise("white", 0, 0.2, breath);
		},
	},
	{
		id: "step-slime",
		duration: 0.35,
		variants: 3,
		render: (kit) => {
			const band = kit.filter(
				"bandpass",
				500,
				3,
				kit.hit(0, 0.01, 0.25, 0.8, kit.out),
			);
			kit.envelope(band.frequency, [
				{ time: 0, value: 300 },
				{ time: 0.2, value: 1100 },
			]);
			kit.noise("brown", 0, 0.3, band);
		},
	},
	// Un pas dans l'eau : le clapotis qui monte, puis quelques gouttes.
	{
		id: "step-water",
		duration: 0.42,
		variants: 4,
		render: (kit) => {
			const band = kit.filter(
				"bandpass",
				600,
				2.2,
				kit.hit(0, 0.012, 0.28, 0.75, kit.out),
			);
			kit.envelope(band.frequency, [
				{ time: 0, value: kit.range(380, 520) },
				{ time: 0.16, value: kit.range(1300, 1800) },
				{ time: 0.32, value: 700 },
			]);
			kit.noise("brown", 0, 0.34, band);
			kit.noise(
				"white",
				0.03,
				0.12,
				kit.filter(
					"highpass",
					3800,
					0.8,
					kit.hit(0.03, 0.004, 0.09, 0.12, kit.out),
				),
			);
			for (let drop = 0; drop < 2; drop += 1) {
				const at = 0.12 + kit.range(0, 0.2);
				const blip = kit.osc(
					"sine",
					900,
					at,
					0.06,
					kit.hit(at, 0.002, 0.05, 0.12, kit.out),
				);
				kit.expEnvelope(blip.frequency, [
					{ time: at, value: kit.range(700, 1000) },
					{ time: at + 0.05, value: kit.range(1700, 2400) },
				]);
			}
		},
	},
	// Le plongeon dans un récipient : une gerbe, puis l'eau qui retombe.
	{
		id: "splash",
		duration: 1,
		variants: 3,
		render: (kit) => {
			const body = kit.filter(
				"lowpass",
				2600,
				0.7,
				kit.hit(0, 0.006, 0.55, 0.9, kit.out),
			);
			kit.envelope(body.frequency, [
				{ time: 0, value: 3200 },
				{ time: 0.6, value: 700 },
			]);
			kit.noise("white", 0, 0.7, body);
			kit.noise(
				"brown",
				0,
				0.5,
				kit.filter("lowpass", 380, 0.8, kit.hit(0, 0.004, 0.35, 0.8, kit.out)),
			);
			for (let drop = 0; drop < 7; drop += 1) {
				const at = 0.18 + kit.range(0, 0.7);
				const blip = kit.osc(
					"sine",
					1000,
					at,
					0.07,
					kit.hit(at, 0.002, 0.06, kit.range(0.06, 0.16), kit.out),
				);
				kit.expEnvelope(blip.frequency, [
					{ time: at, value: kit.range(600, 1100) },
					{ time: at + 0.06, value: kit.range(1500, 2800) },
				]);
			}
		},
	},
	// Le chaudron fait effet : un gros glouglou qui remonte.
	{
		id: "brew-gulp",
		duration: 1.2,
		variants: 2,
		render: (kit, variant) => {
			for (let bubble = 0; bubble < 9; bubble += 1) {
				const at = bubble * 0.1 + kit.range(0, 0.05);
				const low = 140 + bubble * 22 + variant * 30;
				const tone = kit.osc(
					"sine",
					low,
					at,
					0.14,
					kit.filter(
						"lowpass",
						1400,
						1,
						kit.hit(at, 0.006, 0.11, 0.45, kit.out),
					),
				);
				kit.expEnvelope(tone.frequency, [
					{ time: at, value: low },
					{ time: at + 0.12, value: low * 2.6 },
				]);
			}
			const swell = kit.osc(
				"triangle",
				90,
				0,
				1.1,
				kit.hit(0, 0.25, 0.9, 0.18, kit.out),
			);
			kit.expEnvelope(swell.frequency, [
				{ time: 0, value: 70 },
				{ time: 1, value: 260 },
			]);
		},
	},
	{
		id: "land",
		duration: 0.35,
		variants: 2,
		render: (kit) => {
			kit.noise(
				"brown",
				0,
				0.25,
				kit.filter("lowpass", 500, 0.7, kit.hit(0, 0.004, 0.22, 0.9, kit.out)),
			);
			kit.osc("sine", 65, 0, 0.2, kit.hit(0, 0.004, 0.15, 0.7, kit.out));
		},
	},
	{
		id: "door-creak",
		duration: 0.9,
		variants: 3,
		render: (kit, variant) => {
			const output = kit.hit(0, 0.05, 0.75, 0.35, kit.out);
			const band = kit.filter("bandpass", 900 + variant * 150, 9, output);
			const saw = kit.osc("sawtooth", 48 + variant * 9, 0, 0.85, band);
			kit.lfo(13 + variant * 3, 22, saw.frequency, 0, 0.85, "square");
			kit.envelope(saw.frequency, [
				{ time: 0, value: 40 + variant * 9 },
				{ time: 0.8, value: 70 + variant * 12 },
			]);
		},
	},
	{
		id: "door-shut",
		duration: 0.6,
		variants: 2,
		render: (kit) => {
			kit.noise(
				"brown",
				0,
				0.4,
				kit.filter("lowpass", 800, 0.8, kit.hit(0, 0.003, 0.35, 1.1, kit.out)),
			);
			const knock = kit.osc(
				"triangle",
				90,
				0,
				0.3,
				kit.hit(0, 0.002, 0.25, 0.8, kit.out),
			);
			kit.expEnvelope(knock.frequency, [
				{ time: 0, value: 120 },
				{ time: 0.25, value: 55 },
			]);
			kit.noise(
				"white",
				0.02,
				0.05,
				kit.filter(
					"highpass",
					3000,
					1,
					kit.hit(0.02, 0.002, 0.05, 0.25, kit.out),
				),
			);
		},
	},
	{
		id: "valve-turn",
		duration: 1.1,
		variants: 1,
		render: (kit) => {
			for (let index = 0; index < 6; index += 1) {
				const start = index * 0.16;
				kit.noise(
					"white",
					start,
					0.05,
					kit.filter(
						"bandpass",
						2400,
						6,
						kit.hit(start, 0.002, 0.06, 0.5, kit.out),
					),
				);
				kit.osc(
					"square",
					300 + index * 20,
					start,
					0.04,
					kit.hit(start, 0.002, 0.04, 0.1, kit.out),
				);
			}
			kit.noise(
				"pink",
				0.3,
				0.8,
				kit.filter("lowpass", 900, 0.5, kit.hit(0.3, 0.3, 0.5, 0.25, kit.out)),
			);
		},
	},
	{
		id: "water-loop",
		duration: 2.4,
		variants: 1,
		loop: true,
		render: (kit) => {
			const output = kit.gain(0.55);
			const band = kit.filter("bandpass", 1400, 0.6, output);
			kit.noise("white", 0, 2.4, band);
			kit.lfo(5, 400, band.frequency, 0, 2.4);
			kit.noise(
				"pink",
				0,
				2.4,
				kit.filter("lowpass", 400, 0.7, kit.gain(0.4, kit.out)),
			);
		},
	},
	{
		id: "fire-loop",
		duration: 3,
		variants: 1,
		loop: true,
		render: (kit) => {
			kit.noise(
				"brown",
				0,
				3,
				kit.filter("lowpass", 500, 0.6, kit.gain(0.35, kit.out)),
			);
			for (let index = 0; index < 34; index += 1) {
				const start = kit.range(0, 2.9);
				kit.noise(
					"white",
					start,
					0.03,
					kit.filter(
						"highpass",
						kit.range(1500, 5000),
						1,
						kit.hit(start, 0.001, 0.03, kit.range(0.05, 0.35), kit.out),
					),
				);
			}
		},
	},
	{
		id: "lantern-open",
		duration: 0.4,
		variants: 1,
		render: (kit) => {
			kit.noise(
				"white",
				0,
				0.06,
				kit.filter("bandpass", 3500, 4, kit.hit(0, 0.002, 0.08, 0.4, kit.out)),
			);
			kit.noise(
				"pink",
				0.05,
				0.35,
				kit.filter(
					"lowpass",
					1200,
					0.5,
					kit.hit(0.05, 0.08, 0.3, 0.35, kit.out),
				),
			);
		},
	},
	{
		id: "lantern-close",
		duration: 0.3,
		variants: 1,
		render: (kit) => {
			kit.noise(
				"white",
				0,
				0.05,
				kit.filter("bandpass", 2800, 5, kit.hit(0, 0.002, 0.06, 0.45, kit.out)),
			);
			kit.osc("triangle", 520, 0, 0.12, kit.hit(0, 0.002, 0.1, 0.12, kit.out));
		},
	},
	{
		id: "page-turn",
		duration: 0.45,
		variants: 3,
		render: (kit) => {
			const band = kit.filter(
				"bandpass",
				2200,
				0.8,
				kit.hit(0, 0.04, 0.35, 0.35, kit.out),
			);
			kit.envelope(band.frequency, [
				{ time: 0, value: 1200 },
				{ time: 0.3, value: 4200 },
			]);
			kit.noise("white", 0, 0.42, band);
		},
	},
	{
		id: "book-open",
		duration: 0.6,
		variants: 1,
		render: (kit) => {
			kit.noise(
				"pink",
				0,
				0.45,
				kit.filter("lowpass", 1600, 0.6, kit.hit(0, 0.08, 0.4, 0.4, kit.out)),
			);
			kit.noise(
				"brown",
				0.35,
				0.15,
				kit.filter(
					"lowpass",
					300,
					0.7,
					kit.hit(0.35, 0.004, 0.12, 0.5, kit.out),
				),
			);
		},
	},
	{
		id: "hide",
		duration: 0.7,
		variants: 1,
		render: (kit) => {
			kit.noise(
				"pink",
				0,
				0.5,
				kit.filter("lowpass", 900, 0.6, kit.hit(0, 0.05, 0.4, 0.5, kit.out)),
			);
			kit.noise(
				"brown",
				0.45,
				0.2,
				kit.filter(
					"lowpass",
					500,
					0.8,
					kit.hit(0.45, 0.003, 0.15, 0.7, kit.out),
				),
			);
		},
	},
	{
		id: "push",
		duration: 0.4,
		variants: 2,
		render: (kit) => {
			kit.noise(
				"brown",
				0,
				0.3,
				kit.filter("lowpass", 700, 0.7, kit.hit(0, 0.01, 0.25, 1, kit.out)),
			);
			kit.noise(
				"white",
				0,
				0.2,
				kit.filter("bandpass", 1300, 1.2, kit.hit(0, 0.02, 0.15, 0.3, kit.out)),
			);
		},
	},
	{
		id: "shout",
		duration: 0.95,
		variants: 2,
		render: (kit, variant) => {
			const pitch = 1 + variant * 0.09;
			const level = kit.gain(0, kit.out);
			kit.envelope(level.gain, [
				{ time: 0, value: 0 },
				{ time: 0.03, value: 0.5 },
				{ time: 0.55, value: 0.42 },
				{ time: 0.9, value: 0 },
			]);
			const presence = kit.filter("highpass", 900, 0.7, level);
			const contour = [
				{ time: 0, value: 880 * pitch },
				{ time: 0.1, value: 1380 * pitch },
				{ time: 0.55, value: 1260 * pitch },
				{ time: 0.88, value: 900 * pitch },
			];
			const voices = [
				{ type: "sawtooth", ratio: 1, formant: 2700, q: 1.6, drive: 6 },
				{ type: "square", ratio: 1.5, formant: 3600, q: 2.4, drive: 3 },
			] as const;
			for (const voice of voices) {
				const formant = kit.filter(
					"bandpass",
					voice.formant,
					voice.q,
					presence,
				);
				const oscillator = kit.osc(
					voice.type,
					contour[0].value * voice.ratio,
					0,
					0.92,
					kit.shaper(voice.drive, formant),
				);
				kit.envelope(
					oscillator.frequency,
					contour.map((point) => ({
						time: point.time,
						value: point.value * voice.ratio,
					})),
				);
				kit.lfo(9 + variant, 45 * voice.ratio, oscillator.frequency, 0, 0.92);
			}
			kit.noise(
				"white",
				0,
				0.85,
				kit.filter("bandpass", 5600, 0.9, kit.hit(0, 0.02, 0.6, 0.12, kit.out)),
			);
		},
	},
	{
		id: "camera-shutter",
		duration: 0.22,
		variants: 2,
		render: (kit, variant) => {
			for (const at of [0, 0.075 + variant * 0.01]) {
				kit.noise(
					"white",
					at,
					0.05,
					kit.filter(
						"bandpass",
						3200 - at * 6000,
						1.4,
						kit.hit(at, 0.001, 0.045, 0.5, kit.out),
					),
				);
				kit.osc(
					"square",
					900 + variant * 120,
					at,
					0.015,
					kit.hit(at, 0.001, 0.012, 0.08, kit.out),
				);
			}
		},
	},
	{
		id: "radio-squelch",
		duration: 0.28,
		variants: 2,
		render: (kit, variant) => {
			const level = kit.hit(0, 0.004, 0.24, 0.32, kit.out);
			kit.noise(
				"white",
				0,
				0.26,
				kit.filter("bandpass", 1900 + variant * 500, 1.6, level),
			);
			kit.osc(
				"square",
				1400 + variant * 300,
				0,
				0.05,
				kit.hit(0, 0.002, 0.05, 0.1, kit.out),
			);
		},
	},
	{
		id: "stake-bell",
		duration: 2.6,
		variants: 1,
		render: (kit) => {
			for (const [ratio, volume] of [
				[1, 0.34],
				[2.76, 0.16],
				[5.4, 0.08],
			]) {
				kit.osc(
					"sine",
					196 * ratio,
					0,
					2.5,
					kit.hit(0, 0.004, 2.4 / ratio, volume, kit.out),
				);
			}
		},
	},
	{
		id: "stake-pact",
		duration: 1.4,
		variants: 1,
		render: (kit) => {
			kit.osc(
				"sawtooth",
				62,
				0,
				1.3,
				kit.filter("lowpass", 420, 1, kit.hit(0, 0.05, 1.2, 0.38, kit.out)),
			);
			kit.noise("brown", 0, 0.9, kit.hit(0, 0.02, 0.8, 0.3, kit.out));
		},
	},
	{
		id: "capture",
		duration: 1.9,
		variants: 1,
		render: (kit) => {
			const notes = [392, 494, 587, 784, 988];
			notes.forEach((frequency, index) => {
				const start = index * 0.09;
				kit.osc(
					"triangle",
					frequency,
					start,
					1.6,
					kit.hit(start, 0.01, 1.4, 0.22, kit.out),
				);
				kit.osc(
					"sine",
					frequency * 2,
					start,
					1.2,
					kit.hit(start, 0.01, 1, 0.06, kit.out),
				);
			});
			const shimmer = kit.filter(
				"highpass",
				5000,
				0.5,
				kit.hit(0, 0.4, 1.4, 0.15, kit.out),
			);
			kit.noise("white", 0, 1.8, shimmer);
		},
	},
	{
		id: "capture-fail",
		duration: 0.6,
		variants: 1,
		render: (kit) => {
			const tone = kit.osc(
				"square",
				180,
				0,
				0.45,
				kit.filter("lowpass", 900, 1, kit.hit(0, 0.01, 0.4, 0.25, kit.out)),
			);
			kit.envelope(tone.frequency, [
				{ time: 0, value: 200 },
				{ time: 0.4, value: 110 },
			]);
		},
	},
	{
		id: "hurt",
		duration: 0.5,
		variants: 3,
		render: (kit, variant) => {
			kit.noise(
				"brown",
				0,
				0.3,
				kit.filter("lowpass", 600, 0.8, kit.hit(0, 0.003, 0.25, 1, kit.out)),
			);
			const grunt = kit.osc(
				"sawtooth",
				150 + variant * 30,
				0,
				0.35,
				kit.filter("bandpass", 700, 2, kit.hit(0, 0.01, 0.3, 0.35, kit.out)),
			);
			kit.envelope(grunt.frequency, [
				{ time: 0, value: 190 + variant * 30 },
				{ time: 0.3, value: 120 },
			]);
		},
	},
	{
		id: "death",
		duration: 2.2,
		variants: 1,
		render: (kit) => {
			const low = kit.osc("sine", 110, 0, 2, kit.hit(0, 0.05, 2, 0.6, kit.out));
			kit.expEnvelope(low.frequency, [
				{ time: 0, value: 120 },
				{ time: 2, value: 35 },
			]);
			kit.noise(
				"pink",
				0,
				2,
				kit.filter("lowpass", 600, 0.6, kit.hit(0, 0.3, 1.6, 0.3, kit.out)),
			);
		},
	},
	{
		id: "respawn",
		duration: 1.4,
		variants: 1,
		render: (kit) => {
			const rise = kit.osc(
				"triangle",
				220,
				0,
				1.2,
				kit.hit(0, 0.3, 1, 0.25, kit.out),
			);
			kit.expEnvelope(rise.frequency, [
				{ time: 0, value: 220 },
				{ time: 1.1, value: 660 },
			]);
			kit.noise(
				"white",
				0,
				1.2,
				kit.filter("highpass", 4000, 0.6, kit.hit(0, 0.4, 0.8, 0.08, kit.out)),
			);
		},
	},
	{
		id: "spotted",
		duration: 1.6,
		variants: 1,
		render: (kit) => {
			const output = kit.hit(0, 0.01, 1.4, 0.45, kit.out);
			const filter = kit.filter("lowpass", 2400, 1, output);
			for (const frequency of [146.8, 155.6, 220]) {
				kit.osc("sawtooth", frequency, 0, 1.5, filter);
			}
			kit.noise(
				"brown",
				0,
				0.3,
				kit.filter("lowpass", 200, 0.7, kit.hit(0, 0.002, 0.25, 1.2, kit.out)),
			);
		},
	},
	{
		id: "heartbeat",
		duration: 0.9,
		variants: 1,
		render: (kit) => {
			for (const start of [0, 0.26]) {
				kit.osc(
					"sine",
					55,
					start,
					0.18,
					kit.hit(start, 0.005, 0.14, start === 0 ? 0.9 : 0.6, kit.out),
				);
			}
		},
	},
];
