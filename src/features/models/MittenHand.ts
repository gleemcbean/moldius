import * as THREE from "three";
import type { MaterialOptions } from "../world/MaterialLibrary";
import type { ModelKit } from "./modelKit";

export interface HandPose {
	curl: number;
	thumb: number;
}

export const RELAXED_HAND: HandPose = { curl: 0.15, thumb: 0.2 };
export const GRIP_HAND: HandPose = { curl: 1, thumb: 0.9 };
export const SUPPORT_HAND: HandPose = { curl: 0.05, thumb: -0.4 };

const MITT_RADIUS = 0.056;
const MITT_CENTER = -0.06;

export class MittenHand {
	readonly root = new THREE.Group();
	private readonly mitt: THREE.Mesh;
	private readonly thumb: THREE.Mesh;

	constructor(
		kit: ModelKit,
		skin: MaterialOptions,
		private readonly thumbSide: 1 | -1,
		size = 1,
	) {
		this.mitt = kit.sphere(MITT_RADIUS, skin, [1, 1.2, 0.85], 14);
		this.mitt.position.y = MITT_CENTER;
		this.root.add(this.mitt);
		this.thumb = kit.sphere(0.024, skin, [1, 1.35, 1], 10);
		this.root.add(this.thumb);
		this.root.scale.setScalar(size);
		this.setPose(RELAXED_HAND);
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

export function orientHand(
	hand: THREE.Object3D,
	fingerDirection: THREE.Vector3,
	palmDirection: THREE.Vector3,
): void {
	const yAxis = fingerDirection.clone().normalize().negate();
	const zAxis = palmDirection
		.clone()
		.addScaledVector(yAxis, -palmDirection.dot(yAxis))
		.normalize();
	const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
	hand.quaternion.setFromRotationMatrix(
		new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis),
	);
}
