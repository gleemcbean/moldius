import type { SoundRecipe } from "./types.js";

export const PARTY_SOUNDS: SoundRecipe[] = [
	{
		id: "ping",
		duration: 0.7,
		variants: 1,
		render: (kit) => {
			for (const [time, frequency] of [
				[0, 1320],
				[0.09, 1760],
			]) {
				kit.osc(
					"sine",
					frequency,
					time,
					0.55,
					kit.hit(time, 0.004, 0.5, 0.22, kit.out),
				);

				kit.osc(
					"triangle",
					frequency * 2,
					time,
					0.3,
					kit.hit(time, 0.003, 0.25, 0.05, kit.out),
				);
			}
		},
	},
	{
		id: "ping-danger",
		duration: 0.8,
		variants: 1,
		render: (kit) => {
			for (const time of [0, 0.18, 0.36]) {
				kit.osc(
					"square",
					time === 0.18 ? 620 : 880,
					time,
					0.16,
					kit.filter(
						"lowpass",
						2400,
						0.7,
						kit.hit(time, 0.004, 0.14, 0.12, kit.out),
					),
				);
			}
		},
	},
	{
		id: "poltergeist",
		duration: 2.4,
		variants: 2,
		render: (kit, variant) => {
			for (const time of [0, 0.22, 0.4]) {
				const knock = kit.filter(
					"bandpass",
					180 + variant * 30,
					2.4,
					kit.hit(time, 0.002, 0.18, 0.9, kit.out),
				);

				kit.noise("brown", time, 0.2, knock);
			}

			const wail = kit.osc(
				"sine",
				420,
				0.6,
				1.7,
				kit.filter("lowpass", 1400, 0.8, kit.hit(0.6, 0.5, 1.4, 0.16, kit.out)),
			);

			kit.expEnvelope(wail.frequency, [
				{ time: 0.6, value: 360 + variant * 40 },
				{ time: 1.4, value: 520 + variant * 60 },
				{ time: 2.3, value: 300 },
			]);

			kit.lfo(5.5, 14, wail.frequency, 0.6, 1.7);
		},
	},
	{
		id: "dark-call",
		duration: 2.8,
		variants: 1,
		render: (kit) => {
			const drone = kit.osc(
				"sawtooth",
				55,
				0,
				2.7,
				kit.filter("lowpass", 380, 1.4, kit.hit(0, 0.6, 2.2, 0.32, kit.out)),
			);

			kit.lfo(0.9, 6, drone.frequency, 0, 2.7);

			kit.noise(
				"pink",
				0,
				2.6,
				kit.filter("bandpass", 700, 4, kit.hit(0, 0.9, 1.8, 0.18, kit.out)),
			);
		},
	},
	{
		id: "event-gong",
		duration: 3.6,
		variants: 1,
		render: (kit) => {
			for (const [ratio, volume] of [
				[1, 0.4],
				[1.48, 0.2],
				[2.32, 0.12],
				[3.9, 0.06],
			]) {
				kit.osc(
					"sine",
					98 * ratio,
					0,
					3.5,
					kit.hit(0, 0.01, 3.3 / ratio, volume, kit.out),
				);
			}

			kit.noise(
				"pink",
				0,
				0.4,
				kit.filter(
					"highpass",
					1800,
					0.7,
					kit.hit(0, 0.003, 0.3, 0.12, kit.out),
				),
			);
		},
	},
	{
		id: "bounty",
		duration: 0.9,
		variants: 1,
		render: (kit) => {
			[0, 0.07, 0.14, 0.24].forEach((time, index) => {
				kit.osc(
					"triangle",
					1568 + index * 220,
					time,
					0.5,
					kit.hit(time, 0.002, 0.4, 0.14, kit.out),
				);
			});
		},
	},
	{
		id: "gift",
		duration: 0.8,
		variants: 1,
		render: (kit) => {
			[0, 0.06, 0.12].forEach((time, index) => {
				kit.osc(
					"sine",
					988 * 1.26 ** index,
					time,
					0.6,
					kit.hit(time, 0.003, 0.5, 0.16, kit.out),
				);
			});
		},
	},
	{
		id: "ghost-whoosh",
		duration: 1.6,
		variants: 1,
		render: (kit) => {
			const band = kit.filter(
				"bandpass",
				400,
				1.2,
				kit.hit(0, 0.4, 1.1, 0.4, kit.out),
			);

			kit.expEnvelope(band.frequency, [
				{ time: 0, value: 200 },
				{ time: 0.8, value: 1800 },
				{ time: 1.5, value: 600 },
			]);

			kit.noise("pink", 0, 1.5, band);
		},
	},
];
