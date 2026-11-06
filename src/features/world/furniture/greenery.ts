import * as THREE from "three";
import type { MaterialOptions } from "../MaterialLibrary";
import {
	cylinder,
	cylinderBetween,
	type FurnitureBuilder,
	lathe,
	type Part,
} from "./parts";
import { curvedLeaf, leafMaterial, potMaterial } from "./plants";

const VINE: MaterialOptions = { color: 0x4a5a2a, roughness: 1 };
const ROPE: MaterialOptions = { color: 0x6a5a40, roughness: 1 };
const WICKER: MaterialOptions = { texture: "woodLight", roughness: 1 };

function leafCard(
	material: MaterialOptions,
	at: THREE.Vector3,
	size: number,
	facing: THREE.Vector3,
	spin: number,
): Part {
	const geometry = new THREE.PlaneGeometry(size, size);
	geometry.rotateZ(spin);
	const direction = facing.clone().normalize();
	geometry.applyQuaternion(
		new THREE.Quaternion().setFromUnitVectors(
			new THREE.Vector3(0, 0, 1),
			direction,
		),
	);
	const normals = geometry.getAttribute("normal") as THREE.BufferAttribute;
	for (let index = 0; index < normals.count; index += 1) {
		normals.setXYZ(index, direction.x, direction.y, direction.z);
	}
	geometry.translate(at.x, at.y, at.z);
	return { geometry, material };
}

/** Lianes qui descendent en zigzag, garnies de feuilles. */
function strand(
	material: MaterialOptions,
	rng: { next(): number; range(a: number, b: number): number },
	start: THREE.Vector3,
	length: number,
	offset: () => number,
	facing: THREE.Vector3,
): Part[] {
	const parts: Part[] = [];
	let point = start.clone();
	const step = 0.32;
	for (let run = 0; run < length; run += step) {
		const next = new THREE.Vector3(
			point.x + rng.range(-0.09, 0.09),
			point.y - step,
			offset(),
		);
		parts.push(cylinderBetween(VINE, point, next, 0.009, 4));
		for (let leaf = 0; leaf < 2; leaf += 1) {
			parts.push(
				leafCard(
					material,
					new THREE.Vector3(
						next.x + rng.range(-0.1, 0.1),
						next.y + rng.range(-0.08, 0.08),
						next.z + rng.range(0, 0.05),
					),
					rng.range(0.16, 0.26),
					new THREE.Vector3(
						facing.x + rng.range(-0.4, 0.4),
						facing.y + rng.range(-0.3, 0.3),
						facing.z,
					),
					rng.next() * Math.PI * 2,
				),
			);
		}
		point = next;
	}
	return parts;
}

/** Lierre accroché à un mur. */
export const ivyWall: FurnitureBuilder = ({ item, rng }) => {
	const material = leafMaterial(rng, "leafSprig");
	const parts: Part[] = [];
	const strands = Math.max(3, Math.round(item.width / 0.3));
	for (let index = 0; index < strands; index += 1) {
		const x = -item.width / 2 + ((index + 0.5) / strands) * item.width;
		const reach = item.height * rng.range(0.45, 1);
		parts.push(
			...strand(
				material,
				rng,
				new THREE.Vector3(x, item.height, 0.03),
				reach,
				() => rng.range(0.03, 0.07),
				new THREE.Vector3(0, 0, 1),
			),
		);
	}
	return parts;
};

/** Plante qui retombe d'un garde-corps dans le vide, côté +z. */
export const railVine: FurnitureBuilder = ({ item, rng }) => {
	const material = leafMaterial(rng, "leafSprig");
	const parts: Part[] = [];
	const strands = Math.max(3, Math.round(item.width / 0.28));
	for (let index = 0; index < strands; index += 1) {
		const x = -item.width / 2 + ((index + 0.5) / strands) * item.width;
		const top = new THREE.Vector3(x, 1.02, 0.02);
		const lip = new THREE.Vector3(x, 0.95, 0.1);
		parts.push(cylinderBetween(VINE, top, lip, 0.009, 4));
		parts.push(
			...strand(
				material,
				rng,
				lip,
				rng.range(0.8, 2.6),
				() => rng.range(0.08, 0.17),
				new THREE.Vector3(0, 0, 1),
			),
		);
	}
	return parts;
};

/** Liane enroulée autour d'un pilier, de bas en haut. */
export const climbingVine: FurnitureBuilder = ({ item, rng }) => {
	const material = leafMaterial(rng, "leafSprig");
	const parts: Part[] = [];
	const radius = item.width / 2;
	const turns = item.height / 0.9;
	const steps = Math.round(turns * 9);
	let previous: THREE.Vector3 | null = null;
	const phase = rng.next() * Math.PI * 2;
	for (let index = 0; index <= steps; index += 1) {
		const t = index / steps;
		const angle = phase + t * turns * Math.PI * 2;
		const point = new THREE.Vector3(
			Math.cos(angle) * radius,
			t * item.height,
			Math.sin(angle) * radius,
		);
		if (previous) {
			parts.push(cylinderBetween(VINE, previous, point, 0.012, 4));
		}
		previous = point;
		parts.push(
			leafCard(
				material,
				point,
				rng.range(0.16, 0.28),
				new THREE.Vector3(point.x, rng.range(-0.3, 0.5), point.z),
				rng.next() * Math.PI * 2,
			),
		);
	}
	return parts;
};

/** Fougère dans un panier suspendu au plafond. */
export const hangingFern: FurnitureBuilder = ({ item, rng }) => {
	const material = leafMaterial(rng, "leafBlade");
	const basket = 0.22;
	const y = 0.32;
	const parts: Part[] = [
		lathe(
			WICKER,
			[
				[0.001, y - 0.16],
				[basket * 0.6, y - 0.14],
				[basket, y],
				[basket * 0.9, y],
				[0.001, y - 0.02],
			],
			0,
			0,
			0,
			12,
		),
	];
	for (let index = 0; index < 3; index += 1) {
		const angle = (index / 3) * Math.PI * 2;
		parts.push(
			cylinderBetween(
				ROPE,
				new THREE.Vector3(
					Math.cos(angle) * basket,
					y,
					Math.sin(angle) * basket,
				),
				new THREE.Vector3(0, item.height, 0),
				0.006,
				4,
			),
		);
	}
	const fronds = rng.int(11, 15);
	for (let index = 0; index < fronds; index += 1) {
		parts.push(
			curvedLeaf(
				material,
				new THREE.Vector3(0, y - 0.01, 0),
				rng.range(0.13, 0.2),
				rng.range(0.55, 0.85),
				(index / fronds) * Math.PI * 2 + rng.range(-0.2, 0.2),
				rng.range(0.5, 1.1),
				rng.range(1.2, 1.9),
			),
		);
	}
	return parts;
};

/** Grand palmier dans un pot de terre cuite. */
export const palmTree: FurnitureBuilder = ({ item, rng }) => {
	const material = leafMaterial(rng, "palmFrond");
	const potRadius = item.width * 0.36;
	const potHeight = 0.55;
	const parts: Part[] = [
		lathe(
			potMaterial(),
			[
				[0.001, 0],
				[potRadius * 0.74, 0],
				[potRadius, potHeight * 0.85],
				[potRadius * 1.08, potHeight],
				[potRadius * 0.92, potHeight],
				[0.001, potHeight - 0.03],
			],
			0,
			0,
			0,
			14,
		),
		cylinder(
			{ texture: "bark", roughness: 1 },
			0.06,
			0.1,
			item.height * 0.55,
			0,
			potHeight - 0.03,
			0,
			8,
		),
	];
	const crown = new THREE.Vector3(0, potHeight + item.height * 0.53, 0);
	const fronds = rng.int(9, 12);
	for (let index = 0; index < fronds; index += 1) {
		parts.push(
			curvedLeaf(
				material,
				crown,
				rng.range(0.34, 0.46),
				rng.range(1.15, 1.6),
				(index / fronds) * Math.PI * 2 + rng.range(-0.15, 0.15),
				rng.range(0.35, 0.95),
				rng.range(0.9, 1.5),
			),
		);
	}
	return parts;
};
