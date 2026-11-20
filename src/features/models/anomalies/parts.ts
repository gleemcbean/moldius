import type * as THREE from "three";

export function basePositions(mesh: THREE.Mesh): Float32Array {
	return new Float32Array(
		(mesh.geometry.getAttribute("position") as THREE.BufferAttribute).array,
	);
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
