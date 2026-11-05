import { describe, expect, it } from "vitest";
import {
	bodyFits,
	buildChaseCourse,
	ChaseDirector,
	RUN_SPEED,
	SHOWCASE_SEED,
} from "../shared/showcase/chaseDirector.js";

describe("poursuite de l'écran d'accueil", () => {
	const course = buildChaseCourse(SHOWCASE_SEED);

	it("boucle à travers plusieurs pièces du manoir", () => {
		expect(course.loop.openings.length).toBeGreaterThanOrEqual(4);
		const types = new Set(
			course.loop.rooms.map((id) => course.layout.rooms[id].type),
		);
		expect(
			[...types].filter((type) => type !== "corridor").length,
		).toBeGreaterThanOrEqual(3);
		const first = course.path.sample(0).position;
		const end = course.path.sample(course.path.length - 0.001).position;
		expect(Math.hypot(first.x - end.x, first.z - end.z)).toBeLessThan(0.5);
		for (let distance = 0; distance < course.path.length; distance += 0.5) {
			const { position } = course.path.sample(distance);
			expect(course.grid.nearestNode(position, 1, false)).not.toBeNull();
		}
	});

	it("garde le champignon visible et le monstre derrière lui", () => {
		const director = new ChaseDirector(course);
		const dt = 1 / 30;
		const frames = Math.ceil((course.path.length / RUN_SPEED) * 30);
		let hidden = 0;
		let close = 0;
		let cuts = 0;
		let hunterSeen = 0;
		let last: { x: number; z: number } | null = null;
		for (let index = 0; index < frames; index += 1) {
			const frame = director.update(dt);
			if (director.runnerShare(frame.camera, frame.runner) < 0.79) {
				hidden += 1;
			}
			if (
				director.visibleShare(
					frame.camera,
					frame.hunter,
					[0.6, 1.4, 2.0],
					0.3,
				) >= 0.6
			) {
				hunterSeen += 1;
			}
			const distance = Math.hypot(
				frame.camera.x - frame.runner.x,
				frame.camera.z - frame.runner.z,
			);
			if (distance < 2.3) {
				close += 1;
			}
			if (
				last &&
				Math.hypot(frame.camera.x - last.x, frame.camera.z - last.z) > 0.6
			) {
				cuts += 1;
			}
			last = { x: frame.camera.x, z: frame.camera.z };
			const ground = { x: frame.camera.x, z: frame.camera.z };
			expect(course.world.regionAt(ground, frame.runner.y)).not.toBeNull();
			const look = {
				x: frame.target.x - frame.camera.x,
				z: frame.target.z - frame.camera.z,
			};
			const toRunner = {
				x: frame.runner.x - frame.camera.x,
				z: frame.runner.z - frame.camera.z,
			};
			const cosine =
				(look.x * toRunner.x + look.z * toRunner.z) /
				(Math.hypot(look.x, look.z) * Math.hypot(toRunner.x, toRunner.z));
			expect(cosine).toBeGreaterThan(Math.cos((40 * Math.PI) / 180));
		}
		expect(hidden / frames).toBeLessThan(0.04);
		expect(close / frames).toBeLessThan(0.04);
		expect(hunterSeen / frames).toBeGreaterThan(0.5);
		expect(cuts).toBeLessThanOrEqual(8);
	});

	it("ne fait jamais demi-tour au champignon ni au monstre en pleine course", () => {
		const seeds = [SHOWCASE_SEED, 4, 6, 8];
		for (const seed of seeds) {
			const loop = buildChaseCourse(seed);
			expect(loop.loop.rooms.length, `graine ${seed}`).toBeGreaterThanOrEqual(
				4,
			);
			let previous: { x: number; z: number } | null = null;
			for (let distance = 0; distance < loop.path.length; distance += 0.05) {
				const { direction } = loop.path.sample(distance);
				if (previous) {
					expect(
						direction.x * previous.x + direction.z * previous.z,
						`graine ${seed}, ${distance.toFixed(2)} m`,
					).toBeGreaterThan(-0.2);
				}
				previous = direction;
			}
			const director = new ChaseDirector(loop);
			const dt = 1 / 30;
			let last = director.update(dt);
			let backwards = 0;
			const frames = Math.ceil((loop.path.length / RUN_SPEED) * 30);
			for (let frame = 0; frame < frames; frame += 1) {
				const shot = director.update(dt);
				for (const [from, to] of [
					[last.runnerYaw, shot.runnerYaw],
					[last.hunterYaw, shot.hunterYaw],
				]) {
					const turn = Math.abs(
						Math.atan2(Math.sin(to - from), Math.cos(to - from)),
					);
					expect(turn / dt, `graine ${seed}`).toBeLessThan(7);
				}
				const moved = {
					x: shot.runner.x - last.runner.x,
					z: shot.runner.z - last.runner.z,
				};
				const facing =
					(-Math.sin(shot.runnerYaw) * moved.x -
						Math.cos(shot.runnerYaw) * moved.z) /
					(Math.hypot(moved.x, moved.z) || 1);
				if (facing < -0.17) {
					backwards += 1;
				}
				last = shot;
			}
			expect(backwards, `graine ${seed}`).toBeLessThanOrEqual(3);
		}
	});

	it("garde les personnages et la caméra à l'écart des murs", () => {
		for (const seed of [SHOWCASE_SEED, 4, 6, 8, 12]) {
			const course = buildChaseCourse(seed);
			for (let distance = 0; distance < course.path.length; distance += 0.05) {
				const { position } = course.path.sample(distance);
				expect(
					bodyFits(course.world, position),
					`graine ${seed}, ${distance.toFixed(2)} m`,
				).toBe(true);
			}
			const director = new ChaseDirector(course);
			const frames = Math.ceil((course.path.length / RUN_SPEED) * 30);
			for (let frame = 0; frame < frames; frame += 1) {
				const shot = director.update(1 / 30);
				expect(
					course.world.regionAt(
						{ x: shot.camera.x, z: shot.camera.z },
						shot.runner.y,
					),
					`graine ${seed}, image ${frame}`,
				).not.toBeNull();
			}
		}
	});
});
