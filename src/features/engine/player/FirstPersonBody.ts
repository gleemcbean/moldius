import * as THREE from "three";
import type { ModelKit } from "../../models/modelKit";
import type { MaterialOptions } from "../../world/MaterialLibrary";

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
const TORSO_PROFILE: [number, number][] = [
	[0.001, -0.08],
	[0.15, -0.07],
	[0.205, -0.03],
	[0.218, 0.03],
	[0.22, 0.15],
	[0.212, 0.2],
	[0.16, 0.225],
	[0.001, 0.235],
];
const STANCE = 0.11;
const FORWARD = TORSO_BEHIND - HIP_INSET;
const ANKLE_HEIGHT = 0.1;
const UP = new THREE.Vector3(0, 1, 0);
const STRIDE = 0.13;

interface Foot {
	pivot: THREE.Group;
	leg: THREE.Mesh;
	side: -1 | 1;
}

export class FirstPersonBody {
	readonly root = new THREE.Group();
	private readonly torso = new THREE.Group();
	private readonly feet: Foot[] = [];
	private phase = 0;

	constructor(kit: ModelKit) {
		const skin: MaterialOptions = { texture: "mushroomStem", roughness: 0.85 };
		const limbs: MaterialOptions = { texture: "mushroomSkin", roughness: 0.85 };
		const boot: MaterialOptions = {
			texture: "tanLeather",
			color: 0x8a6448,
			roughness: 0.75,
		};
		this.torso.add(
			kit.mesh(
				new THREE.LatheGeometry(
					TORSO_PROFILE.map(([radius, y]) => new THREE.Vector2(radius, y)),
					28,
				),
				skin,
			),
		);
		this.torso.position.z = TORSO_BEHIND;
		this.root.add(this.torso);
		for (const side of [-1, 1] as const) {
			const pivot = new THREE.Group();
			const foot = kit.sphere(0.078, boot, [1, 0.72, 1.35], 16);
			foot.position.set(0, 0.035, -0.03);
			pivot.add(foot);
			const shaft = kit.cylinder(0.07, 0.074, 0.075, boot, 16);
			shaft.position.y = 0.075;
			pivot.add(shaft);
			const cuff = kit.mesh(new THREE.TorusGeometry(0.072, 0.017, 6, 18), {
				...boot,
				color: 0x8a5d3c,
			});
			cuff.rotation.x = Math.PI / 2;
			cuff.position.y = 0.113;
			pivot.add(cuff);
			this.root.add(pivot);
			const leg = kit.cylinder(0.06, 0.06, 1, limbs, 12);
			this.root.add(leg);
			this.feet.push({ pivot, leg, side });
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
		this.root.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
			}
		});
	}
}
