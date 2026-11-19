import * as THREE from "three";
import type { Rig } from "./rig";

export interface HandPose {
	curl: number;
	thumb: number;
}

export const RELAXED_HAND: HandPose = { curl: 0.15, thumb: 0.2 };
export const GRIP_HAND: HandPose = { curl: 1, thumb: 0.9 };
export const SUPPORT_HAND: HandPose = { curl: 0.05, thumb: -0.4 };

export const MITT_RADIUS = 0.056;
export const MITT_CENTER = -0.06;

export class MittenHand {
	constructor(
		readonly root: THREE.Object3D,
		private readonly mitt: THREE.Object3D,
		private readonly thumb: THREE.Object3D,
		private readonly thumbSide: 1 | -1,
	) {}

	static from(rig: Rig, name: string, thumbSide: 1 | -1): MittenHand {
		return new MittenHand(
			rig.node(name),
			rig.node(`${name}_mitt`),
			rig.node(`${name}_thumb`),
			thumbSide,
		);
	}

	setPose(pose: HandPose): void {
		this.mitt.rotation.x = -pose.curl * 0.35;
		this.mitt.scale.set(1, 1 - pose.curl * 0.12, 1 + pose.curl * 0.1);
		this.thumb.position.set(
			this.thumbSide * 0.046,
			MITT_CENTER + 0.018 - pose.thumb * 0.012,
			0.02 + pose.thumb * 0.018,
		);
		this.thumb.rotation.z = this.thumbSide * (0.7 - pose.thumb * 0.3);
	}

	static gripCenter(size = 1): THREE.Vector3 {
		return new THREE.Vector3(
			0,
			(MITT_CENTER - MITT_RADIUS * 0.75) * size,
			0.008 * size,
		);
	}
}
