import * as THREE from "three";
import { MittenHand } from "../../../src/features/models/MittenHand";
import {
	MUSHROOM_CAP_REST,
	MUSHROOM_HIP_HEIGHT,
	SHIN_LENGTH,
	THIGH_LENGTH,
} from "../../../src/features/models/MushroomModel";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import { capTextureKey } from "../../../src/features/world/textures/textureKeys";
import type { BuildKit } from "../kit";
import { buildEyeball } from "./eyes";
import { buildMittenHand } from "./mittenHand";

const UPPER_ARM_LENGTH = 0.12;
const FOREARM_LENGTH = 0.11;
const EYE_HEIGHT = 0.49;
const EYE_SPACING = 0.088;
const EYE_RADIUS = 0.042;
const EYE_SHAPE: [number, number, number] = [1, 1.2, 0.82];
const STRAP_CENTER = 0.25;
const STRAP_RADIUS = 0.3;
const STRAP_TILT = -0.74;
const STRAP_WIDTH = 0.034;
const DEFAULT_CAP = capTextureKey(0xd8442f);

const BODY_PROFILE: [number, number][] = [
	[0.001, -0.08],
	[0.16, -0.07],
	[0.255, -0.005],
	[0.295, 0.11],
	[0.3, 0.25],
	[0.282, 0.4],
	[0.248, 0.53],
	[0.215, 0.63],
	[0.2, 0.7],
	[0.001, 0.73],
];

const CAP_PROFILE: [number, number][] = [
	[0.001, 0.66],
	[0.14, 0.645],
	[0.27, 0.59],
	[0.38, 0.49],
	[0.46, 0.36],
	[0.515, 0.21],
	[0.54, 0.08],
	[0.535, 0.0],
	[0.505, -0.045],
	[0.46, -0.04],
];

const GILL_PROFILE: [number, number][] = [
	[0.46, -0.04],
	[0.34, -0.012],
	[0.23, 0.0],
	[0.19, 0.004],
	[0.001, 0.012],
];

function bodyRadiusAt(height: number): number {
	for (let index = 1; index < BODY_PROFILE.length; index += 1) {
		const [r0, y0] = BODY_PROFILE[index - 1];
		const [r1, y1] = BODY_PROFILE[index];
		if (height >= y0 && height <= y1) {
			return r0 + ((r1 - r0) * (height - y0)) / (y1 - y0);
		}
	}
	return 0.2;
}

function latheGeometry(
	profile: [number, number][],
	segments: number,
	repeat: number,
): THREE.LatheGeometry {
	let area = 0;
	profile.forEach(([radius, height], index) => {
		const [nextRadius, nextHeight] = profile[(index + 1) % profile.length];
		area += radius * nextHeight - nextRadius * height;
	});
	const ordered = area < 0 ? [...profile].reverse() : profile;
	const geometry = new THREE.LatheGeometry(
		ordered.map(([radius, height]) => new THREE.Vector2(radius, height)),
		segments,
	);
	const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
	for (let index = 0; index < uv.count; index += 1) {
		uv.setXY(index, uv.getX(index) * repeat, uv.getY(index));
	}
	return geometry;
}

function addEyes(kit: BuildKit, body: THREE.Object3D): void {
	const radius = bodyRadiusAt(EYE_HEIGHT);
	[-1, 1].forEach((side, index) => {
		const x = side * EYE_SPACING;
		const eye = buildEyeball(kit, `eye_${index}`, {
			radius: EYE_RADIUS,
			sclera: { color: 0x0b0908, roughness: 0.22 },
		});
		eye.scale.set(...EYE_SHAPE);
		eye.position.set(x, EYE_HEIGHT, Math.sqrt(radius * radius - x * x) - 0.012);
		eye.rotation.y = side * 0.22;
		body.add(eye);
	});
}

function addSatchel(kit: BuildKit, body: THREE.Object3D): void {
	const leather: MaterialOptions = { texture: "tanLeather", roughness: 0.7 };
	const strapPoint = (angle: number) => {
		const y =
			STRAP_CENTER + Math.cos(angle) * Math.sin(STRAP_TILT) * STRAP_RADIUS;
		const x = Math.cos(angle) * Math.cos(STRAP_TILT);
		const z = Math.sin(angle);
		const reach = (bodyRadiusAt(y) + 0.006) / Math.hypot(x, z);
		return new THREE.Vector3(x * reach, y, z * reach);
	};
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];
	const samples = 64;
	for (let step = 0; step <= samples; step += 1) {
		const angle = (step / samples) * Math.PI * 2;
		const point = strapPoint(angle);
		const tangent = strapPoint(angle + 0.01)
			.sub(point)
			.normalize();
		const outward = new THREE.Vector3(point.x, 0, point.z).normalize();
		const across = new THREE.Vector3()
			.crossVectors(tangent, outward)
			.multiplyScalar(STRAP_WIDTH / 2);
		for (const sign of [-1, 1]) {
			positions.push(
				point.x + across.x * sign,
				point.y + across.y * sign,
				point.z + across.z * sign,
			);
			normals.push(outward.x, outward.y, outward.z);
			uvs.push((step / samples) * 1.8, (sign + 1) * 0.02);
		}
		if (step < samples) {
			const first = step * 2;
			indices.push(
				first,
				first + 2,
				first + 1,
				first + 1,
				first + 2,
				first + 3,
			);
		}
	}
	const strap = new THREE.BufferGeometry();
	strap.setAttribute(
		"position",
		new THREE.Float32BufferAttribute(positions, 3),
	);
	strap.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
	strap.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
	strap.setIndex(indices);
	body.add(
		kit.mesh(strap, { ...leather, color: 0xc49a78, side: THREE.DoubleSide }),
	);

	const bag = new THREE.Group();
	bag.position.set(0.282, 0.035, -0.07);
	bag.rotation.set(0, 1.83, 0.05);
	body.add(bag);
	bag.add(kit.box(0.2, 0.13, 0.07, leather));
	const bottom = kit.mesh(
		new THREE.CylinderGeometry(0.035, 0.035, 0.2, 12).rotateZ(Math.PI / 2),
		leather,
	);
	bottom.position.y = -0.065;
	bag.add(bottom);
	const stowedBook = kit.named(
		"stowed_book",
		kit.box(0.15, 0.055, 0.045, {
			texture: "leather",
			color: 0xc24a32,
			roughness: 0.7,
		}),
	);
	stowedBook.position.set(0.008, 0.078, -0.004);
	stowedBook.rotation.z = 0.08;
	bag.add(stowedBook);
	const flap = kit.box(0.206, 0.085, 0.012, { ...leather, color: 0xc9a383 });
	flap.position.set(0, 0.028, 0.04);
	flap.rotation.x = 0.06;
	bag.add(flap);
	const buckle = kit.box(0.034, 0.032, 0.01, {
		texture: "brass",
		roughness: 0.4,
		metalness: 0.75,
	});
	buckle.position.set(0, -0.01, 0.048);
	bag.add(buckle);
}

function buildLeg(
	kit: BuildKit,
	hips: THREE.Object3D,
	index: number,
	side: -1 | 1,
	skin: MaterialOptions,
	boot: MaterialOptions,
): void {
	const hip = kit.pivot(`hip_${index}`, side * 0.12, 0, 0);
	hips.add(hip);
	hip.add(kit.limb(0.066, THIGH_LENGTH, skin, 12));
	const knee = kit.pivot(`knee_${index}`, 0, -THIGH_LENGTH, 0);
	hip.add(knee);
	knee.add(kit.limb(0.062, SHIN_LENGTH, skin, 12));
	const ankle = kit.pivot(`ankle_${index}`, 0, -SHIN_LENGTH, 0);
	knee.add(ankle);
	const foot = kit.sphere(0.078, boot, [1, 0.72, 1.35], 16);
	foot.position.set(0, -0.02, 0.03);
	ankle.add(foot);
	const shaft = kit.cylinder(0.07, 0.074, 0.075, boot, 16);
	shaft.position.y = 0.02;
	ankle.add(shaft);
	const cuff = kit.mesh(new THREE.TorusGeometry(0.072, 0.017, 6, 18), {
		...boot,
		color: 0x8a5d3c,
	});
	cuff.rotation.x = Math.PI / 2;
	cuff.position.y = 0.058;
	ankle.add(cuff);
}

function buildArm(
	kit: BuildKit,
	body: THREE.Object3D,
	index: number,
	side: -1 | 1,
	skin: MaterialOptions,
): THREE.Object3D {
	const shoulder = kit.pivot(`shoulder_${index}`, side * 0.27, 0.36, 0);
	body.add(shoulder);
	shoulder.add(kit.limb(0.046, UPPER_ARM_LENGTH, skin, 12));
	const elbow = kit.pivot(`elbow_${index}`, 0, -UPPER_ARM_LENGTH, 0);
	shoulder.add(elbow);
	elbow.add(kit.limb(0.044, FOREARM_LENGTH, skin, 12));
	const hand = buildMittenHand(
		kit,
		`hand_${index}`,
		skin,
		side === 1 ? -1 : 1,
		1.05,
	);
	hand.position.y = -FOREARM_LENGTH;
	hand.rotation.y = (-side * Math.PI) / 2;
	elbow.add(hand);
	return hand;
}

function buildBook(kit: BuildKit): THREE.Group {
	const book = kit.pivot("book");
	const leather: MaterialOptions = {
		texture: "leather",
		color: 0x7a2a1e,
		roughness: 0.7,
	};
	const paper: MaterialOptions = { texture: "paper", roughness: 1 };
	for (const side of [-1, 1]) {
		const cover = kit.box(0.15, 0.008, 0.21, leather);
		cover.position.set(side * 0.075, 0, 0);
		cover.rotation.z = -side * 0.12;
		book.add(cover);
		const pages = kit.box(0.137, 0.016, 0.196, paper);
		pages.position.set(side * 0.07, 0.011, 0);
		pages.rotation.z = -side * 0.12;
		book.add(pages);
	}
	book.position.set(0.04, 0.2, 0.4);
	book.rotation.set(-0.45, 0, 0);
	book.visible = false;
	return book;
}

export function buildMushroom(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "mushroom";
	const skin: MaterialOptions = { texture: "mushroomStem", roughness: 0.85 };
	const limbs: MaterialOptions = { texture: "mushroomSkin", roughness: 0.85 };
	const boot: MaterialOptions = {
		texture: "tanLeather",
		color: 0x8a6448,
		roughness: 0.75,
	};
	const figure = kit.pivot("figure");
	const hips = kit.pivot("hips", 0, MUSHROOM_HIP_HEIGHT, 0);
	const body = kit.pivot("body");
	root.add(figure);
	figure.add(hips);
	hips.add(body);
	body.add(kit.mesh(latheGeometry(BODY_PROFILE, 28, 1).rotateY(Math.PI), skin));
	addEyes(kit, body);
	addSatchel(kit, body);
	const cap = kit.pivot("cap", 0, MUSHROOM_CAP_REST, 0);
	body.add(cap);
	cap.add(
		kit.named(
			"cap_shell",
			kit.mesh(latheGeometry(CAP_PROFILE, 36, 2), {
				texture: DEFAULT_CAP,
				roughness: 0.6,
				fixedRepeat: true,
			}),
		),
	);
	cap.add(
		kit.mesh(latheGeometry(GILL_PROFILE, 36, 6), {
			texture: "gills",
			roughness: 1,
			fixedRepeat: true,
			side: THREE.DoubleSide,
		}),
	);
	const hands: THREE.Object3D[] = [];
	([-1, 1] as const).forEach((side, index) => {
		buildLeg(kit, hips, index, side, limbs, boot);
		hands.push(buildArm(kit, body, index, side, limbs));
	});
	body.add(buildBook(kit));
	const held = kit.anchor("held");
	held.position.copy(MittenHand.gripCenter(1));
	hands[1].add(held);
	return root;
}
