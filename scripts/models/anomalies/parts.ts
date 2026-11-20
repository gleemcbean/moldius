import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { scaleUv } from "../../../src/features/world/geometryUtils";
import type { BuildKit, Surface } from "../kit";

export function hoodGeometry(
	radius: number,
	opening: number,
): THREE.BufferGeometry {
	return scaleUv(
		new THREE.SphereGeometry(
			radius,
			20,
			12,
			0,
			Math.PI * 2,
			opening,
			Math.PI - opening,
		).rotateX(Math.PI / 2),
		Math.PI * 2 * radius,
		Math.PI * radius,
	);
}

export function normalizeHeightUv(mesh: THREE.Mesh, top = 0.98): void {
	const uv = mesh.geometry.getAttribute("uv") as THREE.BufferAttribute;
	let highest = 0;

	for (let index = 0; index < uv.count; index += 1) {
		highest = Math.max(highest, uv.getY(index));
	}

	for (let index = 0; index < uv.count; index += 1) {
		uv.setY(index, (uv.getY(index) / highest) * top);
	}
}

export function claws(
	kit: BuildKit,
	material: Surface,
	count: number,
	length: number,
	radius: number,
	spread = 0.35,
	curl = 0.35,
): THREE.Group {
	const hand = new THREE.Group();

	for (let index = 0; index < count; index += 1) {
		const offset = index - (count - 1) / 2;

		const claw = kit.mesh(
			new THREE.ConeGeometry(radius, length, 6).translate(0, length / 2, 0),
			material,
		);

		claw.rotation.set(Math.PI - curl, 0, offset * spread);

		claw.position.x = offset * radius * 1.3;

		hand.add(claw);
	}

	return hand;
}

export const SOCKET = { color: 0x020101, roughness: 1 };

export function wobbleSphere(
	kit: BuildKit,
	radius: number,
	material: Surface,
	segments = 22,
): THREE.Mesh {
	return kit.sphere(radius, material, [1, 1, 1], segments);
}

function bakedGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
	mesh.updateMatrix();

	const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);

	if (!geometry.index) {
		const count = geometry.getAttribute("position").count;

		geometry.setIndex(Array.from({ length: count }, (_, vertex) => vertex));
	}

	return geometry;
}

function staticMeshes(
	parent: THREE.Object3D,
): Map<THREE.Material, THREE.Mesh[]> {
	const groups = new Map<THREE.Material, THREE.Mesh[]>();

	for (const child of parent.children) {
		if (
			!(child instanceof THREE.Mesh) ||
			child.name !== "" ||
			child.children.length > 0 ||
			Array.isArray(child.material)
		) {
			continue;
		}

		const list = groups.get(child.material) ?? [];

		list.push(child);
		groups.set(child.material, list);
	}

	return groups;
}

export function mergeStaticParts(root: THREE.Object3D): void {
	const parents: THREE.Object3D[] = [];

	root.traverse((object) => {
		parents.push(object);
	});

	for (const parent of parents) {
		for (const [material, meshes] of staticMeshes(parent)) {
			if (meshes.length < 2) {
				continue;
			}

			const geometries = meshes.map(bakedGeometry);
			const merged = mergeGeometries(geometries, false);

			for (const geometry of geometries) {
				geometry.dispose();
			}

			if (!merged) {
				continue;
			}

			for (const mesh of meshes) {
				parent.remove(mesh);
				mesh.geometry.dispose();
			}

			parent.add(new THREE.Mesh(merged, material));
		}
	}
}
