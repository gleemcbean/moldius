import * as THREE from "three";
import { describe, expect, it } from "vitest";

interface Source {
	id: number;
	furnitureId: null;
	roomId: number;
	level: 0;
	position: { x: number; y: number; z: number };
	color: number;
	intensity: number;
	radius: number;
	kind: "candle";
}

interface Pool {
	reduceFlicker: boolean;
	update(camera: THREE.Vector3, dynamic: unknown[], dt: number): void;
}

const { LightPool } = (await import(
	`${"../src/features/engine/lighting"}/LightPool.ts`
)) as {
	LightPool: new (scene: THREE.Scene, size: number, sources: Source[]) => Pool;
};

function candles(roomId: number, x: number): Source[] {
	return [0, 1, 2, 3, 4, 5].map((index) => ({
		id: roomId * 10 + index,
		furnitureId: null,
		roomId,
		level: 0,
		position: {
			x: x + (index % 3) * 1.5,
			y: 1.2,
			z: Math.floor(index / 3) * 1.5,
		},
		color: 0xffb060,
		intensity: 1,
		radius: 5,
		kind: "candle",
	}));
}

function lit(scene: THREE.Scene): THREE.PointLight[] {
	return scene.children.filter(
		(child): child is THREE.PointLight =>
			child instanceof THREE.PointLight && child.intensity > 0.01,
	);
}

describe("réserve de lumières", () => {
	it("éclaire une salle lointaine d'une seule lumière regroupée", () => {
		const scene = new THREE.Scene();
		const pool = new LightPool(scene, 4, [...candles(1, 0), ...candles(2, 40)]);
		for (let frame = 0; frame < 120; frame += 1) {
			pool.update(new THREE.Vector3(1.5, 1.6, 0.7), [], 1 / 30);
		}
		const lights = lit(scene);
		expect(lights.length).toBe(4);
		expect(lights.some((light) => light.position.x > 30)).toBe(false);
		const far = new THREE.Scene();
		const distant = new LightPool(far, 4, [
			...candles(1, 0),
			...candles(2, 22),
		]);
		for (let frame = 0; frame < 120; frame += 1) {
			distant.update(new THREE.Vector3(1.5, 1.6, 0.7), [], 1 / 30);
		}
		expect(lit(far).some((light) => light.position.x > 20)).toBe(true);
	});

	it("allume et éteint les lumières sans à-coup", () => {
		const scene = new THREE.Scene();
		const pool = new LightPool(scene, 3, [...candles(1, 0), ...candles(2, 30)]);
		pool.reduceFlicker = true;
		const camera = new THREE.Vector3(1.5, 1.6, 0.7);
		const slots = scene.children.filter(
			(child): child is THREE.PointLight => child instanceof THREE.PointLight,
		);
		const history = slots.map(() => [0]);
		for (let frame = 0; frame < 240; frame += 1) {
			camera.x += 0.05;
			pool.update(camera, [], 1 / 30);
			slots.forEach((light, index) => {
				history[index].push(light.intensity);
			});
		}
		const peak = Math.max(...history.flat());
		for (const intensities of history) {
			for (let frame = 1; frame < intensities.length; frame += 1) {
				expect(
					Math.abs(intensities[frame] - intensities[frame - 1]),
				).toBeLessThan(peak * 0.1);
			}
		}
	});
	it("garde la salle quittée éclairée sans trou en s'éloignant", () => {
		for (const size of [3, 6, 8, 12]) {
			const scene = new THREE.Scene();
			const pool = new LightPool(scene, size, [
				...candles(1, 0),
				...candles(3, 10),
				...candles(2, 30),
			]);
			pool.reduceFlicker = true;
			const camera = new THREE.Vector3(1.5, 1.6, 0.7);
			const lights = scene.children.filter(
				(child): child is THREE.PointLight => child instanceof THREE.PointLight,
			);
			for (let frame = 0; frame < 90; frame += 1) {
				pool.update(camera, [], 1 / 30);
			}
			const left: number[] = [];
			for (let frame = 0; frame < 470; frame += 1) {
				camera.x += 0.05;
				pool.update(camera, [], 1 / 30);
				left.push(
					lights
						.filter((light) => light.position.x < 5)
						.reduce((sum, light) => sum + light.intensity, 0),
				);
			}
			for (let frame = 0; frame < left.length; frame += 1) {
				const later = Math.max(...left.slice(frame));
				expect(left[frame]).toBeGreaterThanOrEqual(later * 0.6);
			}
			if (size >= 6) {
				expect(left[left.length - 1]).toBeGreaterThan(0);
			}
		}
	});
});
