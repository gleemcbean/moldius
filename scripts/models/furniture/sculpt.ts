import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
	meterLathe,
	meterSphere,
	placed,
	scaleUv,
} from "../../../src/features/world/geometryUtils";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import { type Part, part } from "./parts";

export type Profile = [number, number][];

function points(profile: Profile): THREE.Vector2[] {
	return profile.map(([radius, height]) => new THREE.Vector2(radius, height));
}

function interiorNormal(
	from: [number, number],
	to: [number, number],
): THREE.Vector2 {
	return new THREE.Vector2(-(to[1] - from[1]), to[0] - from[0]).normalize();
}

export function hollowProfile(outer: Profile, wall: number): Profile {
	const count = outer.length;
	const inner: Profile = [];
	for (let index = 1; index < count; index += 1) {
		const before = interiorNormal(outer[index - 1], outer[index]);
		const after =
			index + 1 < count
				? interiorNormal(outer[index], outer[index + 1])
				: before;
		const normal = before.add(after).normalize();
		inner.push([
			Math.max(0.001, outer[index][0] + normal.x * wall),
			outer[index][1] + normal.y * wall,
		]);
	}
	const rim = outer[count - 1];
	const rimInner = inner[inner.length - 1];
	const lip: [number, number] = [
		(rim[0] + rimInner[0]) / 2,
		Math.max(rim[1], rimInner[1]) + wall * 0.35,
	];
	return [...outer, lip, ...inner.reverse(), [0.001, outer[0][1] + wall]];
}

export function vessel(
	material: MaterialOptions,
	outer: Profile,
	wall: number,
	x: number,
	y: number,
	z: number,
	segments = 20,
): Part {
	return part(
		placed(meterLathe(points(hollowProfile(outer, wall)), segments), x, y, z),
		material,
	);
}

function smoothLatheSeam(
	geometry: THREE.BufferGeometry,
	rows: number,
	segments: number,
): void {
	const normal = geometry.getAttribute("normal") as THREE.BufferAttribute;
	for (let row = 0; row < rows; row += 1) {
		const first = row;
		const last = segments * rows + row;
		const x = normal.getX(first) + normal.getX(last);
		const y = normal.getY(first) + normal.getY(last);
		const z = normal.getZ(first) + normal.getZ(last);
		const length = Math.hypot(x, y, z) || 1;
		normal.setXYZ(first, x / length, y / length, z / length);
		normal.setXYZ(last, x / length, y / length, z / length);
	}
}

export interface PleatOptions {
	folds: number;
	depth: (height: number) => number;
	squash?: number;
	phase?: number;
	sway?: number;
	segments?: number;
}

export function pleated(
	material: MaterialOptions,
	profile: Profile,
	options: PleatOptions,
	x: number,
	y: number,
	z: number,
	rotationY = 0,
): Part {
	const segments = options.segments ?? 40;
	const geometry = meterLathe(points(profile), segments);
	const position = geometry.getAttribute("position") as THREE.BufferAttribute;
	const heights = profile.map(([, height]) => height);
	const low = Math.min(...heights);
	const span = Math.max(...heights) - low || 1;
	const phase = options.phase ?? 0;
	for (let index = 0; index < position.count; index += 1) {
		const px = position.getX(index);
		const py = position.getY(index);
		const pz = position.getZ(index);
		const t = Math.min(1, Math.max(0, (py - low) / span));
		const angle = Math.atan2(pz, px);
		const wobble = Math.sin(angle * 3 + phase * 1.7) * 0.35;
		const fold =
			1 + Math.sin(angle * options.folds + phase + wobble) * options.depth(t);
		const sway = (options.sway ?? 0) * (1 - t) * (1 - t);
		position.setXYZ(
			index,
			px * fold + sway,
			py,
			pz * fold * (options.squash ?? 1),
		);
	}
	geometry.computeVertexNormals();
	smoothLatheSeam(geometry, profile.length, segments);
	return part(placed(geometry, x, y, z, rotationY), material);
}

function tubeGeometry(
	path: THREE.Vector3[],
	radius: (t: number) => number,
	tubular: number,
	radial: number,
): THREE.BufferGeometry {
	const curve = new THREE.CatmullRomCurve3(path);
	const geometry = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
	const position = geometry.getAttribute("position") as THREE.BufferAttribute;
	const center = new THREE.Vector3();
	const vertex = new THREE.Vector3();
	for (let ring = 0; ring <= tubular; ring += 1) {
		curve.getPointAt(ring / tubular, center);
		const scale = radius(ring / tubular);
		for (let side = 0; side <= radial; side += 1) {
			const index = ring * (radial + 1) + side;
			vertex
				.fromBufferAttribute(position, index)
				.sub(center)
				.multiplyScalar(scale)
				.add(center);
			position.setXYZ(index, vertex.x, vertex.y, vertex.z);
		}
	}
	geometry.computeVertexNormals();
	const average = (radius(0) + radius(0.5) + radius(1)) / 3;
	return scaleUv(geometry, curve.getLength(), Math.PI * 2 * average);
}

export function bentTube(
	material: MaterialOptions,
	path: [number, number, number][],
	radius: number | ((t: number) => number),
	tubular = 16,
	radial = 8,
): Part {
	const profile = typeof radius === "number" ? () => radius : radius;
	const vectors = path.map(([x, y, z]) => new THREE.Vector3(x, y, z));
	const pieces = [tubeGeometry(vectors, profile, tubular, radial)];
	for (const [end, point] of [
		[0, vectors[0]],
		[1, vectors[vectors.length - 1]],
	] as const) {
		const size = profile(end);
		if (size > 0.0015) {
			pieces.push(
				placed(
					meterSphere(size, radial, Math.max(4, radial / 2 + 1)),
					point.x,
					point.y,
					point.z,
				),
			);
		}
	}
	return part(mergeGeometries(pieces, false) as THREE.BufferGeometry, material);
}

export function capsuleBetween(
	material: MaterialOptions,
	from: THREE.Vector3,
	to: THREE.Vector3,
	radius: number,
	radial = 8,
): Part {
	const direction = new THREE.Vector3().subVectors(to, from);
	const length = direction.length();
	const geometry = new THREE.CapsuleGeometry(radius, length, 3, radial);
	scaleUv(geometry, Math.PI * 2 * radius, length + radius * 2);
	geometry.applyMatrix4(
		new THREE.Matrix4().compose(
			new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5),
			new THREE.Quaternion().setFromUnitVectors(
				new THREE.Vector3(0, 1, 0),
				direction.normalize(),
			),
			new THREE.Vector3(1, 1, 1),
		),
	);
	return part(geometry, material);
}

export function extruded(
	material: MaterialOptions,
	shape: THREE.Shape,
	depth: number,
	bevel: number,
	x: number,
	y: number,
	z: number,
	rotationY = 0,
	rotationX = 0,
	rotationZ = 0,
): Part {
	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth: Math.max(0.0005, depth - bevel * 2),
		bevelEnabled: bevel > 0,
		bevelThickness: bevel,
		bevelSize: bevel,
		bevelSegments: 2,
		curveSegments: 10,
	});
	geometry.translate(0, 0, -(depth - bevel * 2) / 2);
	return part(
		placed(geometry, x, y, z, rotationY, rotationX, rotationZ),
		material,
	);
}

export function ellipsoid(
	material: MaterialOptions,
	radius: [number, number, number],
	x: number,
	y: number,
	z: number,
	rotationY = 0,
	rotationX = 0,
	rotationZ = 0,
	segments = 14,
): Part {
	const average = (radius[0] + radius[1] + radius[2]) / 3;
	const geometry = meterSphere(
		average,
		segments,
		Math.max(8, Math.round(segments * 0.7)),
	);
	geometry.scale(radius[0] / average, radius[1] / average, radius[2] / average);
	return part(
		placed(geometry, x, y, z, rotationY, rotationX, rotationZ),
		material,
	);
}

export function transformed(
	piece: Part,
	x: number,
	y: number,
	z: number,
	rotationY = 0,
	rotationX = 0,
	rotationZ = 0,
): Part {
	placed(piece.geometry, x, y, z, rotationY, rotationX, rotationZ);
	return piece;
}

export function sculptedHead(
	material: MaterialOptions,
	x: number,
	y: number,
	z: number,
	scale: number,
	options: { beard?: boolean; hair?: boolean } = {},
): Part[] {
	const s = scale;
	const parts: Part[] = [
		ellipsoid(
			material,
			[0.095 * s, 0.118 * s, 0.108 * s],
			x,
			y,
			z,
			0,
			0,
			0,
			18,
		),
		ellipsoid(
			material,
			[0.07 * s, 0.05 * s, 0.06 * s],
			x,
			y - 0.06 * s,
			z + 0.035 * s,
			0,
			0,
			0,
			12,
		),
		ellipsoid(
			material,
			[0.016 * s, 0.032 * s, 0.024 * s],
			x,
			y - 0.008 * s,
			z + 0.103 * s,
			0,
			0.25,
			0,
			8,
		),
		ellipsoid(
			material,
			[0.07 * s, 0.012 * s, 0.016 * s],
			x,
			y + 0.028 * s,
			z + 0.08 * s,
			0,
			0,
			0,
			10,
		),
		ellipsoid(
			material,
			[0.022 * s, 0.035 * s, 0.014 * s],
			x - 0.094 * s,
			y - 0.005 * s,
			z + 0.005 * s,
			0.3,
			0,
			0,
			8,
		),
		ellipsoid(
			material,
			[0.022 * s, 0.035 * s, 0.014 * s],
			x + 0.094 * s,
			y - 0.005 * s,
			z + 0.005 * s,
			-0.3,
			0,
			0,
			8,
		),
		ellipsoid(
			material,
			[0.032 * s, 0.009 * s, 0.012 * s],
			x,
			y - 0.052 * s,
			z + 0.088 * s,
			0,
			0,
			0,
			8,
		),
	];
	if (options.hair) {
		const hair = pleated(
			material,
			[
				[0.001, -0.02 * s],
				[0.098 * s, -0.02 * s],
				[0.106 * s, 0.045 * s],
				[0.084 * s, 0.1 * s],
				[0.001, 0.124 * s],
			],
			{ folds: 16, depth: (t) => 0.05 * (1 - t) + 0.015, segments: 32 },
			0,
			0,
			0,
		);
		hair.geometry.applyMatrix4(
			new THREE.Matrix4().compose(
				new THREE.Vector3(x, y + 0.02 * s, z - 0.03 * s),
				new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.45, 0, 0)),
				new THREE.Vector3(1, 1, 1),
			),
		);
		parts.push(hair);
	}
	if (options.beard) {
		parts.push(
			pleated(
				material,
				[
					[0.001, -0.3 * s],
					[0.035 * s, -0.25 * s],
					[0.075 * s, -0.12 * s],
					[0.085 * s, -0.02 * s],
					[0.06 * s, 0.03 * s],
					[0.001, 0.04 * s],
				],
				{
					folds: 9,
					depth: (t) => 0.14 * (1 - t) + 0.04,
					squash: 0.62,
					segments: 24,
				},
				x,
				y - 0.07 * s,
				z + 0.05 * s,
			),
		);
	}
	return parts;
}
