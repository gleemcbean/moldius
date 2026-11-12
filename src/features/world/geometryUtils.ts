import { orientLatheProfile } from "@shared/latheProfile";
import * as THREE from "three";

export function scaleUv(
	geometry: THREE.BufferGeometry,
	scaleU: number,
	scaleV: number,
): THREE.BufferGeometry {
	const uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
	if (!uv) {
		return geometry;
	}
	for (let index = 0; index < uv.count; index += 1) {
		uv.setXY(index, uv.getX(index) * scaleU, uv.getY(index) * scaleV);
	}
	uv.needsUpdate = true;
	return geometry;
}

export function meterBox(
	width: number,
	height: number,
	depth: number,
): THREE.BufferGeometry {
	const geometry = new THREE.BoxGeometry(width, height, depth);
	const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
	const faceSizes: [number, number][] = [
		[depth, height],
		[depth, height],
		[width, depth],
		[width, depth],
		[width, height],
		[width, height],
	];
	for (let face = 0; face < 6; face += 1) {
		const [su, sv] = faceSizes[face];
		for (let vertex = 0; vertex < 4; vertex += 1) {
			const index = face * 4 + vertex;
			uv.setXY(index, uv.getX(index) * su, uv.getY(index) * sv);
		}
	}
	uv.needsUpdate = true;
	return geometry;
}

export function meterCircle(
	radius: number,
	segments = 20,
): THREE.BufferGeometry {
	const size = radius * 2;
	return scaleUv(new THREE.CircleGeometry(radius, segments), size, size);
}

export function meterCylinder(
	radiusTop: number,
	radiusBottom: number,
	height: number,
	segments = 16,
	open = false,
): THREE.BufferGeometry {
	const geometry = new THREE.CylinderGeometry(
		radiusTop,
		radiusBottom,
		height,
		segments,
		1,
		open,
	);
	return scaleUv(
		geometry,
		Math.PI * 2 * Math.max(radiusTop, radiusBottom),
		height,
	);
}

export function meterSphere(
	radius: number,
	widthSegments = 18,
	heightSegments = 12,
): THREE.BufferGeometry {
	return scaleUv(
		new THREE.SphereGeometry(radius, widthSegments, heightSegments),
		Math.PI * 2 * radius,
		Math.PI * radius,
	);
}

export function meterLathe(
	input: THREE.Vector2[],
	segments = 20,
): THREE.BufferGeometry {
	const points = orientLatheProfile(input);
	const geometry = new THREE.LatheGeometry(points, segments);
	let length = 0;
	for (let index = 1; index < points.length; index += 1) {
		length += points[index].distanceTo(points[index - 1]);
	}
	const radius = Math.max(...points.map((point) => point.x));
	return scaleUv(geometry, Math.PI * 2 * radius, length);
}

export function meterTorus(
	radius: number,
	tube: number,
	radial = 8,
	tubular = 24,
	arc = Math.PI * 2,
): THREE.BufferGeometry {
	return scaleUv(
		new THREE.TorusGeometry(radius, tube, radial, tubular, arc),
		arc * radius,
		Math.PI * 2 * tube,
	);
}

export function placed(
	geometry: THREE.BufferGeometry,
	x: number,
	y: number,
	z: number,
	rotationY = 0,
	rotationX = 0,
	rotationZ = 0,
): THREE.BufferGeometry {
	const matrix = new THREE.Matrix4().compose(
		new THREE.Vector3(x, y, z),
		new THREE.Quaternion().setFromEuler(
			new THREE.Euler(rotationX, rotationY, rotationZ, "YXZ"),
		),
		new THREE.Vector3(1, 1, 1),
	);
	geometry.applyMatrix4(matrix);
	return geometry;
}
