import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
	meterBox,
	meterCylinder,
	meterLathe,
	placed,
	scaleUv,
} from "../../world/geometryUtils";
import type {
	MaterialLibrary,
	MaterialOptions,
} from "../../world/MaterialLibrary";

export class Batch {
	private readonly parts = new Map<
		string,
		{ options: MaterialOptions; geometries: THREE.BufferGeometry[] }
	>();

	add(options: MaterialOptions, geometry: THREE.BufferGeometry): void {
		const key = JSON.stringify(options);
		const entry = this.parts.get(key) ?? { options, geometries: [] };

		entry.geometries.push(geometry);
		this.parts.set(key, entry);
	}

	build(
		materials: MaterialLibrary,
		cast: boolean,
		receive: boolean,
	): THREE.Group {
		const group = new THREE.Group();

		for (const { options, geometries } of this.parts.values()) {
			const merged = mergeGeometries(geometries, false);

			for (const geometry of geometries) {
				geometry.dispose();
			}

			if (!merged) {
				continue;
			}

			const mesh = new THREE.Mesh(merged, materials.get(options));

			mesh.castShadow = cast && !options.unlit;
			mesh.receiveShadow = receive && !options.unlit;

			group.add(mesh);
		}

		return group;
	}
}

export function box(
	width: number,
	height: number,
	depth: number,
	x: number,
	y: number,
	z: number,
	rotationY = 0,
	rotationX = 0,
	rotationZ = 0,
): THREE.BufferGeometry {
	return placed(
		meterBox(width, height, depth),
		x,
		y,
		z,
		rotationY,
		rotationX,
		rotationZ,
	);
}

export function pyramid(
	halfWidth: number,
	halfDepth: number,
	height: number,
	x: number,
	y: number,
	z: number,
): THREE.BufferGeometry {
	const geometry = meterCylinder(0, 1, height, 4);

	geometry.rotateY(Math.PI / 4);
	geometry.scale(halfWidth / Math.SQRT1_2, 1, halfDepth / Math.SQRT1_2);

	return placed(geometry, x, y, z);
}

export function twistedSpire(
	radius: number,
	height: number,
	turns: number,
	x: number,
	y: number,
	z: number,
): THREE.BufferGeometry {
	const geometry = scaleUv(
		new THREE.CylinderGeometry(0, radius, height, 8, 12),
		Math.PI * 2 * radius,
		height,
	);

	const position = geometry.getAttribute("position") as THREE.BufferAttribute;

	for (let index = 0; index < position.count; index += 1) {
		const rise = position.getY(index) / height + 0.5;
		const angle = rise * turns * Math.PI * 2;
		const curl = Math.sin(rise * Math.PI) * radius * 0.25;
		const px = position.getX(index);
		const pz = position.getZ(index);

		position.setXYZ(
			index,
			px * Math.cos(angle) - pz * Math.sin(angle) + curl,
			position.getY(index),
			px * Math.sin(angle) + pz * Math.cos(angle),
		);
	}

	geometry.computeVertexNormals();

	return placed(geometry, x, y, z);
}

export function gable(
	width: number,
	height: number,
	x: number,
	y: number,
	z: number,
	rotationY: number,
): THREE.BufferGeometry {
	const shape = new THREE.Shape();

	shape.moveTo(-width / 2, 0);
	shape.lineTo(width / 2, 0);
	shape.lineTo(0, height);
	shape.closePath();

	return placed(new THREE.ShapeGeometry(shape), x, y, z, rotationY);
}

export function halfDisc(radius: number): THREE.BufferGeometry {
	return scaleUv(
		new THREE.CircleGeometry(radius, 16, 0, Math.PI),
		radius * 2,
		radius * 2,
	);
}

export function segment(
	from: THREE.Vector3,
	to: THREE.Vector3,
	radiusFrom: number,
	radiusTo: number,
): THREE.BufferGeometry {
	const direction = to.clone().sub(from);
	const length = direction.length();
	const geometry = meterCylinder(radiusTo, radiusFrom, length, 6);

	geometry.translate(0, length / 2, 0);

	geometry.applyQuaternion(
		new THREE.Quaternion().setFromUnitVectors(
			new THREE.Vector3(0, 1, 0),
			direction.normalize(),
		),
	);

	geometry.translate(from.x, from.y, from.z);

	return geometry;
}

export function mushroomCap(radius: number): THREE.BufferGeometry {
	return meterLathe(
		[
			new THREE.Vector2(radius * 0.9, -radius * 0.12),
			new THREE.Vector2(radius, radius * 0.05),
			new THREE.Vector2(radius * 0.82, radius * 0.38),
			new THREE.Vector2(radius * 0.45, radius * 0.58),
			new THREE.Vector2(0.001, radius * 0.64),
		],
		14,
	);
}

export function crystalGeometry(
	radius: number,
	length: number,
): THREE.BufferGeometry {
	const geometry = new THREE.OctahedronGeometry(radius, 0);

	geometry.scale(1, length / (radius * 2), 1);

	return geometry;
}

export function fitted(object: THREE.Object3D, height: number): THREE.Group {
	const bounds = new THREE.Box3().setFromObject(object);
	const size = bounds.getSize(new THREE.Vector3());

	if (size.y > 0) {
		object.scale.multiplyScalar(height / size.y);
	}

	const scaled = new THREE.Box3().setFromObject(object);

	object.position.y -= scaled.min.y;

	const wrapper = new THREE.Group();

	wrapper.add(object);

	return wrapper;
}
