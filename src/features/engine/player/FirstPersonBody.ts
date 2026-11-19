import * as THREE from "three";
import type { ModelKit } from "../../models/modelKit";

export interface BodyInput {
	x: number;
	y: number;
	z: number;
	yaw: number;
	speed: number;
	crouch: number;
	grounded: boolean;
	visible: boolean;
}

const HIP_HEIGHT = 0.36;
const CROUCH_HIP_DROP = 0.14;
const TORSO_BEHIND = 0.28;
const HIP_INSET = 0.14;
const STANCE = 0.11;
const FORWARD = TORSO_BEHIND - HIP_INSET;
const ANKLE_HEIGHT = 0.1;
const UP = new THREE.Vector3(0, 1, 0);
const STRIDE = 0.13;

interface Foot {
	pivot: THREE.Object3D;
	leg: THREE.Object3D;
	side: -1 | 1;
}

export class FirstPersonBody {
	readonly root: THREE.Object3D;
	private readonly torso: THREE.Object3D;
	private readonly feet: Foot[] = [];
	private phase = 0;

	constructor(kit: ModelKit) {
		const rig = kit.rig("player/first_person_body");
		this.root = rig.root;
		this.torso = rig.node("torso");
		this.torso.position.z = TORSO_BEHIND;
		for (const [index, side] of ([-1, 1] as const).entries()) {
			this.feet.push({
				pivot: rig.node(`foot_${index}`),
				leg: rig.node(`leg_${index}`),
				side,
			});
		}
	}

	update(dt: number, input: BodyInput): void {
		this.root.visible = input.visible;
		if (!input.visible) {
			return;
		}
		const moving = input.grounded ? Math.min(1, input.speed / 3) : 0;
		this.phase += dt * (4 + input.speed * 1.8) * (moving > 0.05 ? 1 : 0);
		this.root.position.set(input.x, input.y, input.z);
		this.root.rotation.set(0, input.yaw, 0);
		const bob = Math.abs(Math.sin(this.phase)) * 0.015 * moving;
		this.torso.position.y = HIP_HEIGHT - CROUCH_HIP_DROP * input.crouch + bob;
		this.torso.scale.y = 1 - input.crouch * 0.12;
		for (const { pivot, leg, side } of this.feet) {
			const swing = Math.sin(this.phase + (side > 0 ? 0 : Math.PI));
			const lift = Math.max(0, Math.cos(this.phase + (side > 0 ? 0 : Math.PI)));
			pivot.position.set(
				side * STANCE * (1 + input.crouch * 0.3),
				lift * 0.05 * moving,
				FORWARD - swing * STRIDE * moving,
			);
			pivot.rotation.set(swing * 0.35 * moving, 0, 0);
			const ankle = new THREE.Vector3(0, ANKLE_HEIGHT, 0).applyEuler(
				pivot.rotation,
			);
			ankle.add(pivot.position);
			const hip = new THREE.Vector3(
				side * STANCE,
				this.torso.position.y - 0.03,
				FORWARD,
			);
			const span = new THREE.Vector3().subVectors(hip, ankle);
			leg.position.copy(ankle).addScaledVector(span, 0.5);
			leg.scale.set(1, span.length(), 1);
			leg.quaternion.setFromUnitVectors(UP, span.normalize());
		}
	}

	dispose(): void {
		this.root.removeFromParent();
	}
}
