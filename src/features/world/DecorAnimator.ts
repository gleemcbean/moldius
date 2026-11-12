import type { ManorLayout } from "@shared/manor/types";
import * as THREE from "three";
import type { ParticleSystem } from "../engine/effects/Particles";
import type { PartAnimation } from "./furniture/parts";
import { decorTime } from "./MaterialLibrary";

export interface AnimatedDecor {
	holder: THREE.Object3D;
	base: THREE.Quaternion;
	animation: PartAnimation;
}

const MAX_DISTANCE = 26;
const SPARK_DISTANCE = 12;
const SPARK_INTERVAL = 0.22;

export class DecorAnimator {
	private time = 0;
	private sparkClock = 0;
	private readonly axis = new THREE.Vector3();
	private readonly spin = new THREE.Quaternion();
	private readonly scratch = new THREE.Vector3();
	private readonly fires: {
		position: THREE.Vector3;
		roomId: number;
		front: THREE.Vector3;
		width: number;
	}[];
	reduceMotion = false;

	constructor(
		private readonly items: AnimatedDecor[],
		layout: ManorLayout,
		private readonly particles: ParticleSystem,
	) {
		this.fires = layout.furniture
			.filter((item) => item.kind === "fireplace")
			.map((item) => ({
				position: new THREE.Vector3(item.x, item.y + 0.3, item.z),
				roomId: item.roomId,
				front: new THREE.Vector3(
					-Math.sin(item.rotation),
					0,
					Math.cos(item.rotation),
				),
				width: item.width * 0.4,
			}));
	}

	update(dt: number, eye: THREE.Vector3): void {
		if (this.reduceMotion) {
			return;
		}
		this.time += dt;
		decorTime.value = this.time;
		for (const { holder, base, animation } of this.items) {
			if (
				!holder.parent?.visible ||
				holder.position.distanceToSquared(eye) > MAX_DISTANCE * MAX_DISTANCE
			) {
				continue;
			}
			const angle =
				animation.kind === "spin"
					? this.time * animation.speed + animation.phase
					: Math.sin(this.time * animation.speed + animation.phase) *
						animation.amplitude;
			this.axis.fromArray(animation.axis);
			this.spin.setFromAxisAngle(this.axis, angle);
			holder.quaternion.copy(base).multiply(this.spin);
		}
		this.sparkClock += dt;
		if (this.sparkClock < SPARK_INTERVAL) {
			return;
		}
		this.sparkClock = 0;
		for (const fire of this.fires) {
			if (fire.position.distanceToSquared(eye) > SPARK_DISTANCE ** 2) {
				continue;
			}
			this.scratch
				.copy(fire.position)
				.addScaledVector(fire.front, 0.1)
				.add(
					new THREE.Vector3(
						(Math.random() - 0.5) * fire.width,
						Math.random() * 0.2,
						(Math.random() - 0.5) * fire.width,
					),
				);
			this.particles.emit(this.scratch, 1, {
				color: 0xff9a3c,
				speed: 0.12,
				up: 0.9,
				life: 1.1,
				size: 0.035,
				gravity: -0.15,
				spread: 0.4,
			});
		}
	}
}
