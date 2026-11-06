import * as THREE from "three";
import type { MaterialOptions } from "../MaterialLibrary";
import { cylinderBetween, type Part, sphere } from "./parts";

const LEAF_TINTS = [0xffffff, 0xc6dca6, 0xe6dc8e, 0xa8cda0] as const;

export function leafMaterial(
	rng: { pick<T>(items: readonly T[]): T },
	texture: "leafBlade" | "palmFrond" | "leafSprig",
): MaterialOptions {
	return {
		texture,
		color: rng.pick(LEAF_TINTS),
		roughness: 1,
		alphaTest: 0.5,
		side: THREE.DoubleSide,
		wave: "foliage",
	};
}

export function potMaterial(): MaterialOptions {
	return { texture: "terracotta", roughness: 0.95 };
}

export function curvedLeaf(
	material: MaterialOptions,
	root: THREE.Vector3,
	width: number,
	length: number,
	yaw: number,
	lean: number,
	droop: number,
): Part {
	const geometry = new THREE.PlaneGeometry(width, length, 1, 5);
	const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
	for (let vertex = 0; vertex < positions.count; vertex += 1) {
		const t = (positions.getY(vertex) + length / 2) / length;
		const bend = t * t;
		positions.setXYZ(
			vertex,
			positions.getX(vertex),
			length * t * (1 - droop * bend * 0.55),
			length * bend * droop,
		);
	}
	geometry.computeVertexNormals();
	geometry.rotateX(lean);
	geometry.rotateY(yaw);
	geometry.translate(root.x, root.y, root.z);
	return { geometry, material };
}

export function leafyBush(
	material: MaterialOptions,
	core: MaterialOptions,
	center: THREE.Vector3,
	radius: number,
	rng: { next(): number },
	cards: number,
	squashY = 1,
): Part[] {
	const parts: Part[] = [
		sphere(core, radius * 0.72, center.x, center.y, center.z, 1, squashY, 1, 8),
	];
	const up = new THREE.Vector3(0, 0, 1);
	const golden = Math.PI * (3 - Math.sqrt(5));
	const size = radius * 0.95;
	for (let index = 0; index < cards; index += 1) {
		const height = 1 - ((index + 0.5) / cards) * 2;
		const ring = Math.sqrt(Math.max(0, 1 - height * height));
		const angle = index * golden + rng.next() * 0.4;
		const direction = new THREE.Vector3(
			Math.cos(angle) * ring,
			height,
			Math.sin(angle) * ring,
		).normalize();
		const geometry = new THREE.PlaneGeometry(size, size);
		geometry.rotateZ(rng.next() * Math.PI * 2);
		geometry.applyQuaternion(
			new THREE.Quaternion().setFromUnitVectors(up, direction),
		);
		const normals = geometry.getAttribute("normal") as THREE.BufferAttribute;
		for (let vertex = 0; vertex < normals.count; vertex += 1) {
			normals.setXYZ(vertex, direction.x, direction.y, direction.z);
		}
		geometry.translate(
			center.x + direction.x * radius * 0.68,
			center.y + direction.y * radius * 0.68 * squashY,
			center.z + direction.z * radius * 0.68,
		);
		parts.push({ geometry, material });
	}
	return parts;
}

export function flowerHead(
	petal: MaterialOptions,
	heart: MaterialOptions,
	center: THREE.Vector3,
	radius: number,
): Part[] {
	const parts: Part[] = [
		sphere(
			heart,
			radius * 0.42,
			center.x,
			center.y + radius * 0.14,
			center.z,
			1,
			0.7,
			1,
			6,
		),
	];
	for (let index = 0; index < 5; index += 1) {
		const angle = (index / 5) * Math.PI * 2;
		parts.push(
			sphere(
				petal,
				radius * 0.55,
				center.x + Math.cos(angle) * radius * 0.62,
				center.y,
				center.z + Math.sin(angle) * radius * 0.62,
				1,
				0.42,
				1,
				6,
			),
		);
	}
	return parts;
}

export function stem(
	material: MaterialOptions,
	from: THREE.Vector3,
	to: THREE.Vector3,
	radius = 0.008,
): Part {
	return cylinderBetween(material, from, to, radius, 5);
}
