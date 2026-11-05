import {
	closestPointOnSegment,
	cross2,
	distance2,
	EPSILON,
	rotate2,
	type Vec2,
} from "../math.js";
import type { ArcEdge, Bounds, OrientedBox, OutlineEdge } from "./types.js";

export const ARC_SEGMENTS = 8;

export function arcPoint(arc: ArcEdge, t: number): Vec2 {
	const angle = arc.startAngle + arc.sweep * t;
	return {
		x: arc.center.x + Math.cos(angle) * arc.radius,
		z: arc.center.z + Math.sin(angle) * arc.radius,
	};
}

export function tessellateOutline(edges: OutlineEdge[]): Vec2[] {
	const points: Vec2[] = [];
	for (const edge of edges) {
		points.push(edge.a);
		if (edge.kind === "arc") {
			for (let step = 1; step < ARC_SEGMENTS; step += 1) {
				points.push(arcPoint(edge, step / ARC_SEGMENTS));
			}
		}
	}
	return points;
}

export function edgeLength(edge: OutlineEdge): number {
	if (edge.kind === "arc") {
		return Math.abs(edge.sweep) * edge.radius;
	}
	return distance2(edge.a, edge.b);
}

export function edgeDirection(edge: OutlineEdge): Vec2 {
	const length = distance2(edge.a, edge.b);
	return {
		x: (edge.b.x - edge.a.x) / length,
		z: (edge.b.z - edge.a.z) / length,
	};
}

export function signedArea(polygon: Vec2[]): number {
	let sum = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index];
		const next = polygon[(index + 1) % polygon.length];
		sum += current.x * next.z - next.x * current.z;
	}
	return sum / 2;
}

export function polygonBounds(polygon: Vec2[]): Bounds {
	const bounds = {
		minX: Infinity,
		minZ: Infinity,
		maxX: -Infinity,
		maxZ: -Infinity,
	};
	for (const point of polygon) {
		bounds.minX = Math.min(bounds.minX, point.x);
		bounds.minZ = Math.min(bounds.minZ, point.z);
		bounds.maxX = Math.max(bounds.maxX, point.x);
		bounds.maxZ = Math.max(bounds.maxZ, point.z);
	}
	return bounds;
}

export function boundsOverlap(a: Bounds, b: Bounds, margin = 0): boolean {
	return (
		a.minX < b.maxX + margin &&
		a.maxX > b.minX - margin &&
		a.minZ < b.maxZ + margin &&
		a.maxZ > b.minZ - margin
	);
}

export function mergeBounds(a: Bounds, b: Bounds): Bounds {
	return {
		minX: Math.min(a.minX, b.minX),
		minZ: Math.min(a.minZ, b.minZ),
		maxX: Math.max(a.maxX, b.maxX),
		maxZ: Math.max(a.maxZ, b.maxZ),
	};
}

export function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
	let inside = false;
	for (
		let index = 0, previous = polygon.length - 1;
		index < polygon.length;
		previous = index++
	) {
		const a = polygon[index];
		const b = polygon[previous];
		const crosses = a.z > point.z !== b.z > point.z;
		if (
			crosses &&
			point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
		) {
			inside = !inside;
		}
	}
	return inside;
}

export function distanceToPolygonBoundary(
	point: Vec2,
	polygon: Vec2[],
): number {
	let best = Infinity;
	for (let index = 0; index < polygon.length; index += 1) {
		const a = polygon[index];
		const b = polygon[(index + 1) % polygon.length];
		best = Math.min(best, distance2(point, closestPointOnSegment(point, a, b)));
	}
	return best;
}

export function pointStrictlyInside(
	point: Vec2,
	polygon: Vec2[],
	margin: number,
): boolean {
	return (
		pointInPolygon(point, polygon) &&
		distanceToPolygonBoundary(point, polygon) > margin
	);
}

function segmentsProperlyCross(
	a: Vec2,
	b: Vec2,
	c: Vec2,
	d: Vec2,
	tolerance: number,
): boolean {
	const r = { x: b.x - a.x, z: b.z - a.z };
	const s = { x: d.x - c.x, z: d.z - c.z };
	const denominator = cross2(r, s);
	if (Math.abs(denominator) < EPSILON) {
		return false;
	}
	const ac = { x: c.x - a.x, z: c.z - a.z };
	const t = cross2(ac, s) / denominator;
	const u = cross2(ac, r) / denominator;
	const lengthR = Math.hypot(r.x, r.z);
	const lengthS = Math.hypot(s.x, s.z);
	const tMargin = tolerance / Math.max(lengthR, EPSILON);
	const uMargin = tolerance / Math.max(lengthS, EPSILON);
	return t > tMargin && t < 1 - tMargin && u > uMargin && u < 1 - uMargin;
}

export function segmentIntersectionParameter(
	a: Vec2,
	b: Vec2,
	c: Vec2,
	d: Vec2,
): number | null {
	const r = { x: b.x - a.x, z: b.z - a.z };
	const s = { x: d.x - c.x, z: d.z - c.z };
	const denominator = cross2(r, s);
	if (Math.abs(denominator) < EPSILON) {
		return null;
	}
	const ac = { x: c.x - a.x, z: c.z - a.z };
	const t = cross2(ac, s) / denominator;
	const u = cross2(ac, r) / denominator;
	if (t < 0 || t > 1 || u < 0 || u > 1) {
		return null;
	}
	return t;
}

export function polygonsOverlap(
	a: Vec2[],
	b: Vec2[],
	tolerance = 0.01,
): boolean {
	if (!boundsOverlap(polygonBounds(a), polygonBounds(b), -tolerance)) {
		return false;
	}
	for (let i = 0; i < a.length; i += 1) {
		const a0 = a[i];
		const a1 = a[(i + 1) % a.length];
		for (let j = 0; j < b.length; j += 1) {
			if (
				segmentsProperlyCross(a0, a1, b[j], b[(j + 1) % b.length], tolerance)
			) {
				return true;
			}
		}
	}
	return (
		containsSamplesOf(a, b, tolerance) || containsSamplesOf(b, a, tolerance)
	);
}

function containsSamplesOf(
	container: Vec2[],
	candidate: Vec2[],
	tolerance: number,
): boolean {
	for (let index = 0; index < candidate.length; index += 1) {
		const point = candidate[index];
		const next = candidate[(index + 1) % candidate.length];
		const middle = { x: (point.x + next.x) / 2, z: (point.z + next.z) / 2 };
		if (pointStrictlyInside(point, container, tolerance)) {
			return true;
		}
		if (pointStrictlyInside(middle, container, tolerance)) {
			return true;
		}
	}
	const centroid = polygonCentroid(candidate);
	return (
		pointStrictlyInside(centroid, candidate, tolerance) &&
		pointStrictlyInside(centroid, container, tolerance)
	);
}

export function polygonCentroid(polygon: Vec2[]): Vec2 {
	let area = 0;
	let cx = 0;
	let cz = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const current = polygon[index];
		const next = polygon[(index + 1) % polygon.length];
		const factor = current.x * next.z - next.x * current.z;
		area += factor;
		cx += (current.x + next.x) * factor;
		cz += (current.z + next.z) * factor;
	}
	if (Math.abs(area) < EPSILON) {
		return polygon[0] ?? { x: 0, z: 0 };
	}
	return { x: cx / (3 * area), z: cz / (3 * area) };
}

export function poleOfInaccessibility(polygon: Vec2[], step = 0.25): Vec2 {
	const bounds = polygonBounds(polygon);
	let best = polygonCentroid(polygon);
	let bestDistance = pointInPolygon(best, polygon)
		? distanceToPolygonBoundary(best, polygon)
		: -1;
	for (let x = bounds.minX + step / 2; x < bounds.maxX; x += step) {
		for (let z = bounds.minZ + step / 2; z < bounds.maxZ; z += step) {
			const point = { x, z };
			if (!pointInPolygon(point, polygon)) {
				continue;
			}
			const distance = distanceToPolygonBoundary(point, polygon);
			if (distance > bestDistance + 1e-6) {
				bestDistance = distance;
				best = point;
			}
		}
	}
	return best;
}

export function boxCorners(box: {
	cx: number;
	cz: number;
	hx: number;
	hz: number;
	rotation: number;
}): Vec2[] {
	const local: Vec2[] = [
		{ x: -box.hx, z: -box.hz },
		{ x: box.hx, z: -box.hz },
		{ x: box.hx, z: box.hz },
		{ x: -box.hx, z: box.hz },
	];
	return local.map((corner) => {
		const rotated = rotate2(corner, box.rotation);
		return { x: rotated.x + box.cx, z: rotated.z + box.cz };
	});
}

export function worldToBoxLocal(point: Vec2, box: OrientedBox): Vec2 {
	return rotate2({ x: point.x - box.cx, z: point.z - box.cz }, -box.rotation);
}

export function pointInBox(point: Vec2, box: OrientedBox, margin = 0): boolean {
	const local = worldToBoxLocal(point, box);
	return (
		Math.abs(local.x) <= box.hx + margin && Math.abs(local.z) <= box.hz + margin
	);
}

export function boxesOverlap2D(
	a: { cx: number; cz: number; hx: number; hz: number; rotation: number },
	b: { cx: number; cz: number; hx: number; hz: number; rotation: number },
	margin = 0,
): boolean {
	const axes: Vec2[] = [
		rotate2({ x: 1, z: 0 }, a.rotation),
		rotate2({ x: 0, z: 1 }, a.rotation),
		rotate2({ x: 1, z: 0 }, b.rotation),
		rotate2({ x: 0, z: 1 }, b.rotation),
	];
	const cornersA = boxCorners(a);
	const cornersB = boxCorners(b);
	for (const axis of axes) {
		const rangeA = projectRange(cornersA, axis);
		const rangeB = projectRange(cornersB, axis);
		if (
			rangeA.max + margin <= rangeB.min ||
			rangeB.max + margin <= rangeA.min
		) {
			return false;
		}
	}
	return true;
}

function projectRange(
	points: Vec2[],
	axis: Vec2,
): { min: number; max: number } {
	let min = Infinity;
	let max = -Infinity;
	for (const point of points) {
		const projection = point.x * axis.x + point.z * axis.z;
		min = Math.min(min, projection);
		max = Math.max(max, projection);
	}
	return { min, max };
}

export function boxInsidePolygon(
	box: { cx: number; cz: number; hx: number; hz: number; rotation: number },
	polygon: Vec2[],
	margin: number,
): boolean {
	const corners = boxCorners(box);
	for (let index = 0; index < corners.length; index += 1) {
		const corner = corners[index];
		const next = corners[(index + 1) % corners.length];
		if (
			!pointInPolygon(corner, polygon) ||
			distanceToPolygonBoundary(corner, polygon) < margin
		) {
			return false;
		}
		const middle = { x: (corner.x + next.x) / 2, z: (corner.z + next.z) / 2 };
		if (!pointInPolygon(middle, polygon)) {
			return false;
		}
	}
	for (const vertex of polygon) {
		if (pointInBox(vertex, { ...box, yMin: 0, yMax: 0 }, margin)) {
			return false;
		}
	}
	return true;
}

export function snapAngle(angle: number, step = Math.PI / 4): number {
	return Math.round(angle / step) * step;
}

export function cleanNumber(value: number): number {
	const rounded = Math.round(value * 1e6) / 1e6;
	return Object.is(rounded, -0) ? 0 : rounded;
}

export function cleanPoint(point: Vec2): Vec2 {
	return { x: cleanNumber(point.x), z: cleanNumber(point.z) };
}
