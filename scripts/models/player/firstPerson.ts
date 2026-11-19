import * as THREE from "three";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import type { BuildKit } from "../kit";

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
const ARM_ELBOW_RADIUS = 0.085;
const ARM_HAND_RADIUS = 0.062;
const ARM_LENGTH = 0.6;
const ARM_TIP_STEPS = 6;

export function buildFirstPersonBody(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "first_person_body";
	const skin: MaterialOptions = { texture: "mushroomStem", roughness: 0.85 };
	const limbs: MaterialOptions = { texture: "mushroomSkin", roughness: 0.85 };
	const boot: MaterialOptions = {
		texture: "tanLeather",
		color: 0x8a6448,
		roughness: 0.75,
	};
	const torso = kit.pivot("torso");
	torso.add(
		kit.mesh(
			new THREE.LatheGeometry(
				TORSO_PROFILE.map(([radius, y]) => new THREE.Vector2(radius, y)),
				28,
			),
			skin,
		),
	);
	root.add(torso);
	for (let index = 0; index < 2; index += 1) {
		const pivot = kit.pivot(`foot_${index}`);
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
		root.add(pivot);
		root.add(kit.named(`leg_${index}`, kit.cylinder(0.06, 0.06, 1, limbs, 12)));
	}
	return root;
}

export function buildFirstPersonArms(kit: BuildKit): THREE.Group {
	const half = ARM_LENGTH / 2;
	const tipHeight = ARM_HAND_RADIUS * 0.8;
	const profile = [
		new THREE.Vector2(0.001, -half),
		new THREE.Vector2(ARM_ELBOW_RADIUS, -half + 0.03),
	];
	for (let step = 0; step <= ARM_TIP_STEPS; step += 1) {
		const angle = (step / ARM_TIP_STEPS) * (Math.PI / 2);
		profile.push(
			new THREE.Vector2(
				Math.max(0.001, Math.cos(angle) * ARM_HAND_RADIUS),
				half - tipHeight + Math.sin(angle) * tipHeight,
			),
		);
	}
	const root = new THREE.Group();
	root.name = "first_person_arms";
	const skin: MaterialOptions = { color: 0xa58a6a, roughness: 0.85 };
	for (const [name, x] of [
		["left_arm", -0.22],
		["right_arm", 0.22],
	] as const) {
		const arm = kit.named(
			name,
			kit.mesh(new THREE.LatheGeometry(profile, 20), skin),
		);
		arm.position.x = x;
		root.add(arm);
	}
	return root;
}
