import { describe, expect, it, vi } from "vitest";
import { SERVER_TICK_MS } from "../shared/config/index.js";
import { PoseSmoother } from "../shared/poseSmoother.js";
import { MatchSimulation } from "./helpers/simulation.js";

const FRAME_S = 1 / 60;

interface Pumped {
	pump(): void;
	lastClock: number;
}

function stepsPerFrame(positions: readonly number[]): {
	largest: number;
	backwards: number;
} {
	let largest = 0;
	let backwards = 0;
	for (let index = 1; index < positions.length; index += 1) {
		const delta = positions[index] - positions[index - 1];
		largest = Math.max(largest, delta);
		if (delta < -1e-9) {
			backwards += 1;
		}
	}
	return { largest, backwards };
}

describe("régularité des déplacements", () => {
	it("date les ticks serveur à intervalles fixes même quand la boucle rattrape son retard", () => {
		const sim = new MatchSimulation();
		const loop = sim.match as unknown as Pumped;
		loop.lastClock = sim.clock.now();
		const step = vi.spyOn(sim.match, "step");
		for (const gap of [25, 31, 140, 7, 62, 18, 95, 25, 25, 49]) {
			sim.clock.advance(gap);
			loop.pump();
		}
		const times = step.mock.calls.map(([time]) => time as number);
		expect(times.length).toBeGreaterThanOrEqual(8);
		for (let index = 1; index < times.length; index += 1) {
			expect(times[index] - times[index - 1]).toBeCloseTo(SERVER_TICK_MS, 6);
		}
	});

	it("lisse une position qui avance par à-coups sans jamais reculer", () => {
		const smoother = new PoseSmoother();
		const raw: number[] = [];
		const smoothed: number[] = [];
		let target = 0;
		for (let frame = 0; frame < 240; frame += 1) {
			if (frame % 6 === 0) {
				target += 0.4;
			}
			smoother.update({ x: target, y: 0, z: 0, yaw: 0, speed: 4 }, FRAME_S);
			raw.push(target);
			smoothed.push(smoother.x);
		}
		const jerky = stepsPerFrame(raw);
		const smooth = stepsPerFrame(smoothed);
		expect(jerky.largest).toBeCloseTo(0.4, 6);
		expect(smooth.backwards).toBe(0);
		expect(smooth.largest).toBeLessThan(jerky.largest * 0.35);
		expect(target - smoother.x).toBeLessThan(0.6);
	});

	it("garde une vitesse apparente régulière malgré l'horloge client bruitée", () => {
		const speed = 4;
		const smoother = new PoseSmoother();
		const raw: number[] = [];
		const smoothed: number[] = [];
		let previousRaw: number | null = null;
		let previousSmoothed = 0;
		for (let frame = 0; frame < 180; frame += 1) {
			const renderTime = frame * FRAME_S * 1000 + Math.sin(frame * 2.3) * 4;
			const x = (speed * renderTime) / 1000;
			smoother.update({ x, y: 0, z: 0, yaw: 0, speed }, FRAME_S);
			if (previousRaw !== null && frame > 30) {
				raw.push((x - previousRaw) / FRAME_S);
				smoothed.push((smoother.x - previousSmoothed) / FRAME_S);
			}
			previousRaw = x;
			previousSmoothed = smoother.x;
		}
		const spread = (velocities: number[]) =>
			(Math.max(...velocities) - Math.min(...velocities)) / speed;
		expect(spread(raw)).toBeGreaterThan(0.5);
		expect(spread(smoothed)).toBeLessThan(0.25);
	});

	it("téléporte au lieu de glisser après un saut de plus de 2,5 m ou une remise à zéro", () => {
		const smoother = new PoseSmoother();
		smoother.update({ x: 0, y: 0, z: 0, yaw: 0, speed: 0 }, FRAME_S);
		smoother.update({ x: 6, y: 0, z: 0, yaw: 1, speed: 0 }, FRAME_S);
		expect(smoother.x).toBe(6);
		smoother.reset();
		smoother.update({ x: 7, y: 0, z: 0, yaw: 0, speed: 0 }, FRAME_S);
		expect(smoother.x).toBe(7);
	});

	it("tourne par le plus court chemin quand l'angle passe de π à -π", () => {
		const smoother = new PoseSmoother();
		smoother.update({ x: 0, y: 0, z: 0, yaw: 3.1, speed: 0 }, FRAME_S);
		smoother.update({ x: 0, y: 0, z: 0, yaw: -3.1, speed: 0 }, FRAME_S);
		expect(Math.abs(Math.abs(smoother.yaw) - Math.PI)).toBeLessThan(0.1);
	});
});
