import type { Vec3 } from "@shared/math";
import type { CollisionWorld } from "@shared/physics/collisionWorld";
import * as THREE from "three";
import { soundBank } from "../audio/soundBank";
import { footstepSound } from "../engine/audio/AmbientAudio";

interface Echo {
	key: string;
	weight: number;
	near: number;
	far: number;
	volume: number;
	behind: boolean;
}

interface Pending {
	at: number;
	key: string;
	position: THREE.Vector3 | null;
	volume: number;
}

const ECHOES: readonly Echo[] = [
	{ key: "steps", weight: 4, near: 2.5, far: 5, volume: 0.6, behind: true },
	{
		key: "whisper-far",
		weight: 3,
		near: 1.2,
		far: 3.5,
		volume: 0.7,
		behind: true,
	},
	{
		key: "door-creak",
		weight: 2,
		near: 4,
		far: 10,
		volume: 0.8,
		behind: false,
	},
	{
		key: "door-shut",
		weight: 1.5,
		near: 5,
		far: 12,
		volume: 0.9,
		behind: false,
	},
	{ key: "thump", weight: 1.5, near: 3, far: 9, volume: 0.8, behind: false },
	{ key: "creak", weight: 1.5, near: 2, far: 7, volume: 0.7, behind: true },
	{ key: "moan-far", weight: 1, near: 8, far: 16, volume: 0.8, behind: false },
	{
		key: "chains-far",
		weight: 1,
		near: 8,
		far: 16,
		volume: 0.7,
		behind: false,
	},
	{
		key: "melee-swing",
		weight: 1,
		near: 0.8,
		far: 1.3,
		volume: 0.9,
		behind: true,
	},
	{ key: "shout", weight: 0.8, near: 7, far: 15, volume: 0.6, behind: false },
	{
		key: "veilleur-chase",
		weight: 0.8,
		near: 7,
		far: 14,
		volume: 0.8,
		behind: true,
	},
	{
		key: "hurleur-scream",
		weight: 0.5,
		near: 10,
		far: 18,
		volume: 0.9,
		behind: false,
	},
	{ key: "spotted", weight: 0.6, near: 0, far: 0, volume: 0.55, behind: false },
];

const TOTAL_WEIGHT = ECHOES.reduce((sum, echo) => sum + echo.weight, 0);

function pick(random: () => number): Echo {
	let roll = random() * TOTAL_WEIGHT;

	for (const echo of ECHOES) {
		roll -= echo.weight;

		if (roll <= 0) {
			return echo;
		}
	}

	return ECHOES[0];
}

export class PhantomEchoes {
	private readonly queue: Pending[] = [];
	private time = 0;
	private nextAt = 1.5;

	constructor(private readonly world: CollisionWorld) {}

	update(
		dt: number,
		active: boolean,
		feet: Vec3,
		yaw: number,
		random: () => number,
	): void {
		this.time += dt;

		if (!active) {
			this.queue.length = 0;
			this.nextAt = this.time + 1.5;

			return;
		}

		for (const pending of [...this.queue]) {
			if (pending.at > this.time) {
				continue;
			}

			this.queue.splice(this.queue.indexOf(pending), 1);

			soundBank.play(pending.key, {
				volume: pending.volume,
				...(pending.position
					? {
							position: pending.position,
							refDistance: 1.5,
							maxDistance: 26,
						}
					: {}),
			});
		}

		if (this.time >= this.nextAt) {
			this.nextAt = this.time + 2.4 + random() * 3.6;

			this.schedule(pick(random), feet, yaw, random);
		}
	}

	private around(
		echo: Echo,
		feet: Vec3,
		yaw: number,
		random: () => number,
	): THREE.Vector3 {
		const angle = echo.behind
			? yaw + Math.PI + (random() - 0.5) * 1.4
			: random() * Math.PI * 2;

		const distance = echo.near + random() * (echo.far - echo.near);

		return new THREE.Vector3(
			feet.x - Math.sin(angle) * distance,
			feet.y + 1,
			feet.z - Math.cos(angle) * distance,
		);
	}

	private schedule(
		echo: Echo,
		feet: Vec3,
		yaw: number,
		random: () => number,
	): void {
		if (echo.key === "spotted") {
			this.queue.push({
				at: this.time,
				key: echo.key,
				position: null,
				volume: echo.volume,
			});

			return;
		}

		if (echo.key !== "steps") {
			this.queue.push({
				at: this.time,
				key: echo.key,
				position: this.around(echo, feet, yaw, random),
				volume: echo.volume,
			});

			return;
		}

		const room = this.world.roomAt({ x: feet.x, z: feet.z }, feet.y + 0.1);
		const key = footstepSound(room?.style.floor);
		const start = this.around(echo, feet, yaw, random);
		const steps = 3 + Math.floor(random() * 3);

		for (let step = 0; step < steps; step += 1) {
			const closer = 1 - (step / steps) * 0.55;

			this.queue.push({
				at: this.time + step * 0.42,
				key,
				position: new THREE.Vector3(
					feet.x + (start.x - feet.x) * closer,
					feet.y + 0.1,
					feet.z + (start.z - feet.z) * closer,
				),
				volume: echo.volume,
			});
		}
	}
}
