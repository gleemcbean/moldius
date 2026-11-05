export interface Vec2 {
	x: number;
	z: number;
}

export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

export const TAU = Math.PI * 2;
export const EPSILON = 1e-6;

export function vec2(x: number, z: number): Vec2 {
	return { x, z };
}

export function vec3(x: number, y: number, z: number): Vec3 {
	return { x, y, z };
}

export function add2(a: Vec2, b: Vec2): Vec2 {
	return { x: a.x + b.x, z: a.z + b.z };
}

export function sub2(a: Vec2, b: Vec2): Vec2 {
	return { x: a.x - b.x, z: a.z - b.z };
}

export function scale2(a: Vec2, s: number): Vec2 {
	return { x: a.x * s, z: a.z * s };
}

export function dot2(a: Vec2, b: Vec2): number {
	return a.x * b.x + a.z * b.z;
}

export function cross2(a: Vec2, b: Vec2): number {
	return a.x * b.z - a.z * b.x;
}

export function length2(a: Vec2): number {
	return Math.hypot(a.x, a.z);
}

export function distance2(a: Vec2, b: Vec2): number {
	return Math.hypot(a.x - b.x, a.z - b.z);
}

export function distanceSq2(a: Vec2, b: Vec2): number {
	const dx = a.x - b.x;
	const dz = a.z - b.z;
	return dx * dx + dz * dz;
}

export function normalize2(a: Vec2): Vec2 {
	const length = length2(a);
	if (length < EPSILON) {
		return { x: 0, z: 0 };
	}
	return { x: a.x / length, z: a.z / length };
}

export function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
	return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

export function rotate2(a: Vec2, angle: number): Vec2 {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return { x: a.x * cos - a.z * sin, z: a.x * sin + a.z * cos };
}

export function inwardNormal(direction: Vec2): Vec2 {
	return { x: -direction.z, z: direction.x };
}

export function outwardNormal(direction: Vec2): Vec2 {
	return { x: direction.z, z: -direction.x };
}

export function distance3(a: Vec3, b: Vec3): number {
	return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function horizontalDistance(a: Vec3 | Vec2, b: Vec3 | Vec2): number {
	return Math.hypot(a.x - b.x, a.z - b.z);
}

export function clamp(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
	if (Math.abs(b - a) < EPSILON) {
		return 0;
	}
	return clamp((value - a) / (b - a), 0, 1);
}

export function smoothstep(
	edge0: number,
	edge1: number,
	value: number,
): number {
	const t = inverseLerp(edge0, edge1, value);
	return t * t * (3 - 2 * t);
}

export function wrapAngle(angle: number): number {
	let wrapped = angle % TAU;
	if (wrapped > Math.PI) {
		wrapped -= TAU;
	} else if (wrapped < -Math.PI) {
		wrapped += TAU;
	}
	return wrapped;
}

export function angleDifference(from: number, to: number): number {
	return wrapAngle(to - from);
}

export function lerpAngle(from: number, to: number, t: number): number {
	return from + angleDifference(from, to) * t;
}

export function approachAngle(
	from: number,
	to: number,
	maxStep: number,
): number {
	const delta = angleDifference(from, to);
	if (Math.abs(delta) <= maxStep) {
		return to;
	}
	return wrapAngle(from + Math.sign(delta) * maxStep);
}

export function yawToDirection(yaw: number): Vec2 {
	return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

export function directionToYaw(direction: Vec2): number {
	return Math.atan2(-direction.x, -direction.z);
}

export function lookDirection(yaw: number, pitch: number): Vec3 {
	const cosPitch = Math.cos(pitch);
	return {
		x: -Math.sin(yaw) * cosPitch,
		y: Math.sin(pitch),
		z: -Math.cos(yaw) * cosPitch,
	};
}

export function roundTo(value: number, step: number): number {
	return Math.round(value / step) * step;
}

export function quantize(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

export function closestPointOnSegment(point: Vec2, a: Vec2, b: Vec2): Vec2 {
	const abx = b.x - a.x;
	const abz = b.z - a.z;
	const lengthSq = abx * abx + abz * abz;
	if (lengthSq < EPSILON) {
		return { x: a.x, z: a.z };
	}
	const t = clamp(
		((point.x - a.x) * abx + (point.z - a.z) * abz) / lengthSq,
		0,
		1,
	);
	return { x: a.x + abx * t, z: a.z + abz * t };
}

export function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): number {
	return distance2(point, closestPointOnSegment(point, a, b));
}
