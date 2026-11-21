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

const center = new THREE.Vector3();

export class Batch {
	private readonly parts = new Map<
		string,
		{ options: MaterialOptions; geometries: THREE.BufferGeometry[] }
	>();

	constructor(private readonly cellSize = 0) {}

	add(options: MaterialOptions, geometry: THREE.BufferGeometry): void {
		const key = `${JSON.stringify(options)}${this.cell(geometry)}`;
		const entry = this.parts.get(key) ?? { options, geometries: [] };

		entry.geometries.push(geometry);
		this.parts.set(key, entry);
	}

	private cell(geometry: THREE.BufferGeometry): string {
		if (this.cellSize <= 0) {
			return "";
		}

		geometry.computeBoundingBox();
		geometry.boundingBox?.getCenter(center);

		const x = Math.floor(center.x / this.cellSize);
		const z = Math.floor(center.z / this.cellSize);

		return `@${x},${z}`;
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

			merged.computeBoundingBox();
			merged.boundingBox?.getCenter(center);
			merged.translate(-center.x, -center.y, -center.z);

			const mesh = new THREE.Mesh(merged, materials.get(options));

			mesh.position.copy(center);
			mesh.updateMatrix();

			mesh.matrixAutoUpdate = false;
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

export function spire(
	radius: number,
	height: number,
	sides: number,
	x: number,
	baseY: number,
	z: number,
): THREE.BufferGeometry {
	const geometry = meterCylinder(0, radius, height, sides, true);

	geometry.rotateY(Math.PI / sides);

	return placed(geometry, x, baseY + height / 2, z);
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

export function taperedTube(
	points: readonly THREE.Vector3[],
	radii: readonly number[],
	sides: number,
): THREE.BufferGeometry {
	const ring = sides + 1;
	const positions = new Float32Array(points.length * ring * 3);
	const normals = new Float32Array(points.length * ring * 3);
	const uvs = new Float32Array(points.length * ring * 2);
	const indices: number[] = [];
	const tangent = new THREE.Vector3();
	const previous = new THREE.Vector3();
	const normal = new THREE.Vector3();
	const binormal = new THREE.Vector3();
	const around = new THREE.Vector3();
	const turn = new THREE.Quaternion();
	const girth = Math.PI * 2 * radii[0];
	let travelled = 0;

	for (const [index, point] of points.entries()) {
		const before = points[Math.max(0, index - 1)];
		const after = points[Math.min(points.length - 1, index + 1)];

		tangent.subVectors(after, before).normalize();

		if (index === 0) {
			const upright = Math.abs(tangent.y) > 0.9;

			normal
				.set(upright ? 1 : 0, upright ? 0 : 1, 0)
				.cross(tangent)
				.normalize();
		} else {
			travelled += point.distanceTo(points[index - 1]);

			turn.setFromUnitVectors(previous, tangent);
			normal.applyQuaternion(turn);
			normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
		}

		binormal.crossVectors(tangent, normal);
		previous.copy(tangent);

		for (let side = 0; side <= sides; side += 1) {
			const angle = (side / sides) * Math.PI * 2;
			const vertex = index * ring + side;

			around
				.copy(normal)
				.multiplyScalar(Math.cos(angle))
				.addScaledVector(binormal, Math.sin(angle));

			positions[vertex * 3] = point.x + around.x * radii[index];
			positions[vertex * 3 + 1] = point.y + around.y * radii[index];
			positions[vertex * 3 + 2] = point.z + around.z * radii[index];
			normals[vertex * 3] = around.x;
			normals[vertex * 3 + 1] = around.y;
			normals[vertex * 3 + 2] = around.z;
			uvs[vertex * 2] = (side / sides) * girth;
			uvs[vertex * 2 + 1] = travelled;
		}
	}

	for (let index = 0; index < points.length - 1; index += 1) {
		for (let side = 0; side < sides; side += 1) {
			const a = index * ring + side;
			const b = a + ring;

			indices.push(a, a + 1, b, a + 1, b + 1, b);
		}
	}

	const geometry = new THREE.BufferGeometry();

	geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
	geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
	geometry.setIndex(indices);

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
		10,
	);
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
