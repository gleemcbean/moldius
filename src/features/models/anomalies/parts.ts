import * as THREE from "three";
import { scaleUv } from "../../world/geometryUtils";
import type { ModelKit, Surface } from "../modelKit";

export function capGeometry(
	radius: number,
	reach: number,
): THREE.BufferGeometry {
	return scaleUv(
		new THREE.SphereGeometry(radius, 20, 8, 0, Math.PI * 2, 0, reach),
		Math.PI * 2 * radius,
		reach * radius,
	);
}

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
	kit: ModelKit,
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

export const SOCKET: Surface = { color: 0x020101, roughness: 1 };

export function wobbleSphere(
	kit: ModelKit,
	radius: number,
	material: Surface,
	segments = 22,
): { mesh: THREE.Mesh; base: Float32Array } {
	const mesh = kit.sphere(radius, material, [1, 1, 1], segments);
	const base = new Float32Array(
		(mesh.geometry.getAttribute("position") as THREE.BufferAttribute).array,
	);
	return { mesh, base };
}

export function deform(
	mesh: THREE.Mesh,
	base: Float32Array,
	time: number,
	amount: number,
	frequency: number,
	flatten = 0,
): void {
	const positions = mesh.geometry.getAttribute(
		"position",
	) as THREE.BufferAttribute;
	for (let index = 0; index < positions.count; index += 1) {
		const x = base[index * 3];
		const y = base[index * 3 + 1];
		const z = base[index * 3 + 2];
		const wave =
			1 +
			Math.sin(time * frequency + x * 9 + y * 7) * amount +
			Math.sin(time * frequency * 1.7 + z * 11) * amount * 0.6;
		const squash = y < 0 ? 1 - flatten : 1;
		positions.setXYZ(
			index,
			x * wave * (1 + flatten * 0.5),
			y * wave * squash,
			z * wave * (1 + flatten * 0.5),
		);
	}
	positions.needsUpdate = true;
	mesh.geometry.computeVertexNormals();
}
