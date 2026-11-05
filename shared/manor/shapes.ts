import { cross2, dot2, normalize2, rotate2, sub2, type Vec2 } from "../math.js";
import { cleanNumber, cleanPoint, signedArea } from "./polygon.js";
import type { ArcEdge, OutlineEdge } from "./types.js";

export type CornerTreatment =
	| { kind: "square" }
	| { kind: "chamfer"; size: number }
	| { kind: "round"; size: number };

export const SQUARE: CornerTreatment = { kind: "square" };

export const WALL_HEADINGS_DEGREES = [
	0, 45, 90, 135, 180, 225, 270, 315,
] as const;

export function outlineFromVertices(
	vertices: Vec2[],
	treatments: CornerTreatment[],
): OutlineEdge[] {
	const count = vertices.length;
	const starts: Vec2[] = [];
	const ends: Vec2[] = [];
	const cornerEdges: (OutlineEdge | null)[] = [];

	for (let index = 0; index < count; index += 1) {
		const previous = vertices[(index - 1 + count) % count];
		const corner = vertices[index];
		const next = vertices[(index + 1) % count];
		const incoming = normalize2(sub2(corner, previous));
		const outgoing = normalize2(sub2(next, corner));
		const treatment = treatments[index] ?? SQUARE;
		const isRightAngle = Math.abs(dot2(incoming, outgoing)) < 1e-6;

		if (treatment.kind === "square" || !isRightAngle) {
			ends[index] = corner;
			starts[index] = corner;
			cornerEdges[index] = null;
			continue;
		}

		const size = treatment.size;
		const before = {
			x: corner.x - incoming.x * size,
			z: corner.z - incoming.z * size,
		};
		const after = {
			x: corner.x + outgoing.x * size,
			z: corner.z + outgoing.z * size,
		};
		ends[index] = before;
		starts[index] = after;

		if (treatment.kind === "chamfer") {
			cornerEdges[index] = {
				kind: "line",
				a: cleanPoint(before),
				b: cleanPoint(after),
			};
		} else {
			cornerEdges[index] = buildQuarterArc(
				before,
				after,
				incoming,
				outgoing,
				size,
			);
		}
	}

	const edges: OutlineEdge[] = [];
	for (let index = 0; index < count; index += 1) {
		const cornerEdge = cornerEdges[index];
		if (cornerEdge) {
			edges.push(cornerEdge);
		}
		const nextIndex = (index + 1) % count;
		const sideStart = starts[index];
		const sideEnd = ends[nextIndex];
		if (Math.hypot(sideEnd.x - sideStart.x, sideEnd.z - sideStart.z) > 1e-4) {
			edges.push({
				kind: "line",
				a: cleanPoint(sideStart),
				b: cleanPoint(sideEnd),
			});
		}
	}
	return edges;
}

function buildQuarterArc(
	before: Vec2,
	after: Vec2,
	incoming: Vec2,
	outgoing: Vec2,
	radius: number,
): ArcEdge {
	const center = {
		x: before.x + outgoing.x * radius,
		z: before.z + outgoing.z * radius,
	};
	const turn = Math.sign(cross2(incoming, outgoing));
	const startAngle = Math.atan2(before.z - center.z, before.x - center.x);
	return {
		kind: "arc",
		a: cleanPoint(before),
		b: cleanPoint(after),
		center: cleanPoint(center),
		radius,
		startAngle: cleanNumber(startAngle),
		sweep: (turn * Math.PI) / 2,
	};
}

export function rectangleVertices(width: number, depth: number): Vec2[] {
	return [
		{ x: 0, z: 0 },
		{ x: width, z: 0 },
		{ x: width, z: depth },
		{ x: 0, z: depth },
	];
}

export function lShapeVertices(
	width: number,
	depth: number,
	notchWidth: number,
	notchDepth: number,
): Vec2[] {
	return [
		{ x: 0, z: 0 },
		{ x: width, z: 0 },
		{ x: width, z: depth - notchDepth },
		{ x: width - notchWidth, z: depth - notchDepth },
		{ x: width - notchWidth, z: depth },
		{ x: 0, z: depth },
	];
}

export function corridorPathVertices(path: Vec2[], width: number): Vec2[] {
	const half = width / 2;
	const left: Vec2[] = [];
	const right: Vec2[] = [];
	for (let index = 0; index < path.length; index += 1) {
		const point = path[index];
		const previous = path[index - 1];
		const next = path[index + 1];
		const directionIn = previous ? normalize2(sub2(point, previous)) : null;
		const directionOut = next ? normalize2(sub2(next, point)) : null;
		const normalIn = directionIn
			? { x: -directionIn.z, z: directionIn.x }
			: null;
		const normalOut = directionOut
			? { x: -directionOut.z, z: directionOut.x }
			: null;
		const normal = normalize2({
			x: (normalIn?.x ?? 0) + (normalOut?.x ?? 0),
			z: (normalIn?.z ?? 0) + (normalOut?.z ?? 0),
		});
		const reference = normalIn ?? (normalOut as Vec2);
		const miter = half / Math.max(0.35, dot2(normal, reference));
		left.push({ x: point.x + normal.x * miter, z: point.z + normal.z * miter });
		right.push({
			x: point.x - normal.x * miter,
			z: point.z - normal.z * miter,
		});
	}
	const polygon = [...right, ...left.reverse()];
	return signedArea(polygon) < 0 ? polygon.reverse() : polygon;
}

export function transformEdges(
	edges: OutlineEdge[],
	rotation: number,
	offset: Vec2,
): OutlineEdge[] {
	return edges.map((edge) => {
		const a = cleanPoint(translate(rotate2(edge.a, rotation), offset));
		const b = cleanPoint(translate(rotate2(edge.b, rotation), offset));
		if (edge.kind === "line") {
			return { kind: "line", a, b };
		}
		return {
			kind: "arc",
			a,
			b,
			center: cleanPoint(translate(rotate2(edge.center, rotation), offset)),
			radius: edge.radius,
			startAngle: cleanNumber(edge.startAngle + rotation),
			sweep: edge.sweep,
		};
	});
}

function translate(point: Vec2, offset: Vec2): Vec2 {
	return { x: point.x + offset.x, z: point.z + offset.z };
}
