import type { SynthKit } from "../synthKit.js";
import {
	breath,
	creak,
	growl,
	impact,
	puff,
	scream,
	skitter,
} from "./anomalySounds.js";
import type { SoundRecipe } from "./types.js";

function clack(kit: SynthKit, start: number, peak: number): void {
	kit.noise(
		"white",
		start,
		0.05,
		kit.filter(
			"bandpass",
			kit.range(1100, 1900),
			kit.range(4, 8),
			kit.hit(start, 0.001, 0.04, peak, kit.out),
		),
	);

	kit.osc(
		"triangle",
		kit.range(160, 230),
		start,
		0.06,
		kit.hit(start, 0.001, 0.05, peak * 0.45, kit.out),
	);
}

function rattle(
	kit: SynthKit,
	start: number,
	duration: number,
	count: number,
	peak: number,
): void {
	for (let index = 0; index < count; index += 1) {
		const progress = index / count;
		const time = start + duration * (1 - (1 - progress) ** 1.6);

		clack(kit, time, peak * (0.5 + progress * 0.5));
	}
}

function hiss(
	kit: SynthKit,
	start: number,
	duration: number,
	center: number,
	peak: number,
): void {
	const band = kit.filter(
		"bandpass",
		center,
		0.8,
		kit.hit(start, duration * 0.5, duration * 0.5, peak, kit.out),
	);

	kit.noise("pink", start, duration, band);
}

function heartbeat(kit: SynthKit, start: number, peak: number): void {
	for (const [offset, level] of [
		[0, 1],
		[0.22, 0.7],
	] as const) {
		const thump = kit.osc(
			"sine",
			70,
			start + offset,
			0.3,
			kit.hit(start + offset, 0.004, 0.22, peak * level, kit.out),
		);

		kit.expEnvelope(thump.frequency, [
			{ time: start + offset, value: 70 },
			{ time: start + offset + 0.25, value: 38 },
		]);
	}
}

export const INFECTION_SOUNDS: SoundRecipe[] = [
	{
		id: "cordyceps-idle",
		duration: 4,
		variants: 2,
		loop: true,
		render: (kit) => {
			skitter(kit, 0, 4, 26, 0.2);

			for (let index = 0; index < 5; index += 1) {
				clack(kit, kit.range(0.1, 3.8), kit.range(0.35, 0.6));
			}

			for (let index = 0; index < 3; index += 1) {
				creak(
					kit,
					kit.range(0, 3.4),
					kit.range(0.2, 0.5),
					kit.range(90, 140),
					0.28,
				);
			}

			breath(kit, 0.4, 1.6, 420, 0.18);
			hiss(kit, 2.2, 1.6, 2600, 0.12);
		},
	},
	{
		id: "cordyceps-windup",
		duration: 1.1,
		variants: 2,
		render: (kit, variant) => {
			rattle(kit, 0, 0.75, 9 + variant * 2, 0.45);
			hiss(kit, 0, 0.9, 3200, 0.22);
			growl(kit, 0.1, 0.8, 62 + variant * 10, 0.35, 700);
		},
	},
	{
		id: "cordyceps-ripe",
		duration: 1.8,
		variants: 2,
		render: (kit) => {
			puff(kit, 0.05, 0.55);
			skitter(kit, 0.1, 1.2, 14, 0.06);
			hiss(kit, 0.2, 1.4, 4200, 0.08);
		},
	},
	{
		id: "infection-bite",
		duration: 1.6,
		variants: 1,
		render: (kit) => {
			impact(kit, 0.7, 55);
			rattle(kit, 0, 0.12, 3, 0.5);
			puff(kit, 0.12, 0.45);

			for (const [frequency, detune] of [
				[880, 0],
				[932, 1],
			] as const) {
				const whine = kit.osc(
					"sine",
					frequency,
					0.2,
					1.3,
					kit.hit(0.2, 0.1, 1.1, 0.07, kit.out),
				);

				kit.expEnvelope(whine.frequency, [
					{ time: 0.2, value: frequency },
					{ time: 1.5, value: frequency * (0.45 + detune * 0.05) },
				]);
			}
		},
	},
	{
		id: "compulsion-pulse",
		duration: 1.8,
		variants: 2,
		render: (kit) => {
			heartbeat(kit, 0, 0.75);
			heartbeat(kit, 0.75, 0.6);

			const sweep = kit.filter(
				"bandpass",
				600,
				1.4,
				kit.hit(0, 0.6, 1.1, 0.12, kit.out),
			);

			kit.expEnvelope(sweep.frequency, [
				{ time: 0, value: 400 },
				{ time: 1.6, value: 3800 },
			]);

			kit.noise("pink", 0, 1.7, sweep);
			skitter(kit, 0.3, 1.3, 18, 0.05);
		},
	},
	{
		id: "infected-scream",
		duration: 1.7,
		variants: 2,
		render: (kit, variant) => {
			scream(kit, 0, 1.4, 300 + variant * 45, 0.5);
			growl(kit, 0.05, 1.2, 95, 0.18, 1200);
			skitter(kit, 0, 1.5, 16, 0.08);
		},
	},
];
