import * as THREE from "three";

const EPSILON = 1e-6;
const LINEAR_TOLERANCE = 2e-4;

export interface MorphAxis {
	name: string;
	step: number;
	build: (delta: number) => THREE.Object3D;
}

export interface MorphResult {
	attached: string[];
	nonLinear: string[];
	mismatched: string[];
}

function meshesOf(root: THREE.Object3D): THREE.Mesh[] {
	const meshes: THREE.Mesh[] = [];

	root.traverse((object) => {
		if (object instanceof THREE.Mesh) {
			meshes.push(object);
		}
	});

	return meshes;
}

function sameTopology(a: THREE.Mesh, b: THREE.Mesh): boolean {
	const pa = a.geometry.getAttribute("position");
	const pb = b.geometry.getAttribute("position");

	return pa.count === pb.count;
}

function worldPositions(mesh: THREE.Mesh, attribute: string): Float32Array {
	const source = mesh.geometry.getAttribute(attribute) as THREE.BufferAttribute;

	return new Float32Array(source.array as ArrayLike<number>);
}

export function attachMorphs(
	base: THREE.Object3D,
	axes: MorphAxis[],
): MorphResult {
	const result: MorphResult = { attached: [], nonLinear: [], mismatched: [] };
	const baseMeshes = meshesOf(base);

	const targets = new Map<
		THREE.Mesh,
		{ name: string; position: Float32Array; normal: Float32Array }[]
	>();

	for (const axis of axes) {
		const near = meshesOf(axis.build(axis.step));
		const far = meshesOf(axis.build(axis.step * 2));

		if (
			near.length !== baseMeshes.length ||
			far.length !== baseMeshes.length ||
			baseMeshes.some(
				(mesh, index) =>
					!sameTopology(mesh, near[index]) || !sameTopology(mesh, far[index]),
			)
		) {
			result.mismatched.push(axis.name);
			continue;
		}

		let used = false;
		let linear = true;

		baseMeshes.forEach((mesh, index) => {
			const p0 = worldPositions(mesh, "position");
			const p1 = worldPositions(near[index], "position");
			const p2 = worldPositions(far[index], "position");
			const n0 = worldPositions(mesh, "normal");
			const n1 = worldPositions(near[index], "normal");
			const position = new Float32Array(p0.length);
			const normal = new Float32Array(n0.length);
			let moving = false;

			for (let value = 0; value < p0.length; value += 1) {
				const delta = (p1[value] - p0[value]) / axis.step;

				position[value] = delta;

				if (Math.abs(delta) > EPSILON) {
					moving = true;
				}

				if (
					Math.abs(p0[value] + delta * axis.step * 2 - p2[value]) >
					LINEAR_TOLERANCE
				) {
					linear = false;
				}
			}

			for (let value = 0; value < n0.length; value += 1) {
				normal[value] = (n1[value] - n0[value]) / axis.step;
			}

			if (moving) {
				used = true;

				const list = targets.get(mesh) ?? [];

				list.push({ name: axis.name, position, normal });
				targets.set(mesh, list);
			}
		});

		if (!linear) {
			result.nonLinear.push(axis.name);
		}

		if (used) {
			result.attached.push(axis.name);
		}
	}

	for (const [mesh, list] of targets) {
		mesh.geometry.morphAttributes.position = list.map(
			({ position }) => new THREE.Float32BufferAttribute(position, 3),
		);

		if (
			list.some(({ normal }) =>
				normal.some((value) => Math.abs(value) > EPSILON),
			)
		) {
			mesh.geometry.morphAttributes.normal = list.map(
				({ normal }) => new THREE.Float32BufferAttribute(normal, 3),
			);
		}

		mesh.geometry.morphTargetsRelative = true;

		mesh.updateMorphTargets();

		mesh.morphTargetDictionary = Object.fromEntries(
			list.map(({ name }, index) => [name, index]),
		);

		mesh.morphTargetInfluences = list.map(() => 0);
	}

	return result;
}
