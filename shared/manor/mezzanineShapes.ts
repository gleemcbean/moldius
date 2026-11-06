import {
	MEZZANINE_DECK_WIDTH,
	MEZZANINE_POST_RADIUS,
	MEZZANINE_POST_SPACING,
	MEZZANINE_STAIR_WIDTH,
} from "../config/index.js";
import { closestPointOnSegment, distance2, type Vec2 } from "../math.js";
import type { SeededRandom } from "../random.js";
import {
	cleanPoint,
	distanceToPolygonBoundary,
	edgeDirection,
	edgeLength,
	pointInBox,
	pointInPolygon,
	polygonBounds,
} from "./polygon.js";
import type {
	MezzanineSegment,
	MezzanineShape,
	MezzanineSpec,
	OrientedBox,
	Room,
	StairSpec,
} from "./types.js";

export const MEZZANINE_SHAPES: readonly MezzanineShape[] = [
	"corner",
	"gallery",
	"diagonal",
	"crescent",
	"pier",
	"horseshoe",
	"bridge",
];

const STAIR_LANDING = 0.25;
const STAIR_TOP = 0.36;
const STAIR_APPROACH = 1.4;
const EPS = 0.03;
const ARM_MIN_WIDTH = 2.25;
const POST_WALL_DISTANCE = 1.7;
const POST_STAIR_DISTANCE = 1.4;
const POST_CORNER_SPACING = 2.8;
const POST_DOOR_CLEARANCE = 1.6;
const OUTSIDE = 1;

const DECK_CELL = 0.25;
const DECK_PASSAGE_RADIUS = 0.55;

export function postBoxes(posts: Vec2[]): OrientedBox[] {
	return posts.map((post) => ({
		cx: post.x,
		cz: post.z,
		hx: MEZZANINE_POST_RADIUS,
		hz: MEZZANINE_POST_RADIUS,
		rotation: 0,
		yMin: 0,
		yMax: 3,
	}));
}

/** Vrai si tout le plancher reste accessible à pied depuis le haut de l'escalier. */
export function deckIsConnected(
	deck: Vec2[],
	stairTop: MezzanineSegment,
	blockers: OrientedBox[],
): boolean {
	const bounds = polygonBounds(deck);
	const columns = Math.ceil((bounds.maxX - bounds.minX) / DECK_CELL) + 1;
	const rows = Math.ceil((bounds.maxZ - bounds.minZ) / DECK_CELL) + 1;
	const top = {
		x: (stairTop.a.x + stairTop.b.x) / 2,
		z: (stairTop.a.z + stairTop.b.z) / 2,
	};
	const free = new Set<number>();
	let start = -1;
	let nearest = Infinity;
	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			const point = {
				x: bounds.minX + column * DECK_CELL,
				z: bounds.minZ + row * DECK_CELL,
			};
			if (
				!pointInPolygon(point, deck) ||
				distanceToPolygonBoundary(point, deck) < DECK_PASSAGE_RADIUS ||
				blockers.some((box) => pointInBox(point, box, DECK_PASSAGE_RADIUS))
			) {
				continue;
			}
			const index = row * columns + column;
			free.add(index);
			const away = distance2(point, top);
			if (away < nearest) {
				nearest = away;
				start = index;
			}
		}
	}
	if (start < 0) {
		return false;
	}
	const seen = new Set([start]);
	const stack = [start];
	while (stack.length > 0) {
		const current = stack.pop() as number;
		const column = current % columns;
		const neighbors = [
			column > 0 ? current - 1 : -1,
			column < columns - 1 ? current + 1 : -1,
			current - columns,
			current + columns,
		];
		for (const next of neighbors) {
			if (free.has(next) && !seen.has(next)) {
				seen.add(next);
				stack.push(next);
			}
		}
	}
	return seen.size === free.size;
}

export interface StairMetrics {
	rise: number;
	tread: number;
}

function convexHull(points: Vec2[]): Vec2[] {
	const sorted = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
	const turn = (o: Vec2, a: Vec2, b: Vec2) =>
		(a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
	const half = (list: Vec2[]) => {
		const chain: Vec2[] = [];
		for (const point of list) {
			while (
				chain.length >= 2 &&
				turn(chain[chain.length - 2], chain[chain.length - 1], point) <= 1e-9
			) {
				chain.pop();
			}
			chain.push(point);
		}
		chain.pop();
		return chain;
	};
	return [...half(sorted), ...half([...sorted].reverse())];
}

/** Sutherland-Hodgman : `clip` est convexe et tourne dans le sens positif. */
function clipToConvex(subject: Vec2[], clip: Vec2[]): Vec2[] {
	let output = subject;
	for (let index = 0; index < clip.length && output.length > 0; index += 1) {
		const a = clip[index];
		const b = clip[(index + 1) % clip.length];
		const side = (point: Vec2) =>
			(b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
		const input = output;
		output = [];
		for (let current = 0; current < input.length; current += 1) {
			const from = input[current];
			const to = input[(current + 1) % input.length];
			const sideFrom = side(from);
			const sideTo = side(to);
			if (sideFrom >= 0) {
				output.push(from);
			}
			if (sideFrom >= 0 !== sideTo >= 0) {
				const t = sideFrom / (sideFrom - sideTo);
				output.push({
					x: from.x + (to.x - from.x) * t,
					z: from.z + (to.z - from.z) * t,
				});
			}
		}
	}
	return output.filter((point, index) => {
		const next = output[(index + 1) % output.length];
		return distance2(point, next) > 0.01;
	});
}

interface ClearRect {
	pa: number;
	pb: number;
	qa: number;
	qb: number;
}

interface Podium {
	p: number;
	q: number;
	width: number;
	depth: number;
}

interface Design {
	polygon: Vec2[];
	clear: ClearRect;
	keepClear: ClearRect | null;
	podium: Podium | null;
}

/**
 * Trace une mezzanine dans le repère du mur du fond : x suit ce mur, z entre
 * dans la salle. La forme est dessinée sans tenir compte du contour, puis
 * découpée par lui : pans coupés et arrondis sont donc suivis exactement.
 */
export function buildMezzanine(
	room: Room,
	back: number,
	mirrored: boolean,
	deckHeight: number,
	shape: MezzanineShape,
	rng: SeededRandom,
	metrics: StairMetrics,
	groundDoors: Vec2[],
): MezzanineSpec | null {
	const edge = room.edges[back];
	if (edge.kind !== "line" || edgeLength(edge) < 5) {
		return null;
	}
	const along = edgeDirection(edge);
	const normal = { x: -along.z, z: along.x };
	const rawQ = (point: Vec2) =>
		(point.x - edge.a.x) * normal.x + (point.z - edge.a.z) * normal.z;
	const inwardSign =
		room.polygon.reduce((sum, point) => sum + rawQ(point), 0) >= 0 ? 1 : -1;
	const inward = { x: normal.x * inwardSign, z: normal.z * inwardSign };
	const rawP = (point: Vec2) =>
		(point.x - edge.a.x) * along.x + (point.z - edge.a.z) * along.z;
	const rawPs = room.polygon.map(rawP);
	const pLo = Math.min(...rawPs);
	const pHi = Math.max(...rawPs);
	const toLocal = (point: Vec2): Vec2 => ({
		x: mirrored ? pLo + pHi - rawP(point) : rawP(point),
		z: (point.x - edge.a.x) * inward.x + (point.z - edge.a.z) * inward.z,
	});
	const toWorld = (point: Vec2): Vec2 => {
		const p = mirrored ? pLo + pHi - point.x : point.x;
		return cleanPoint({
			x: edge.a.x + along.x * p + inward.x * point.z,
			z: edge.a.z + along.z * p + inward.z * point.z,
		});
	};
	const outline = room.polygon.map(toLocal);
	const qMax = Math.max(...outline.map((point) => point.z));
	const label = toLocal(room.labelPoint);
	const hull = convexHull(outline);

	const inRoom = (point: Vec2) =>
		pointInPolygon(point, outline) ||
		distanceToPolygonBoundary(point, outline) < EPS;
	const spanAt = (q: number): { lo: number; hi: number } | null => {
		let lo = Infinity;
		let hi = -Infinity;
		for (let index = 0; index < outline.length; index += 1) {
			const a = outline[index];
			const b = outline[(index + 1) % outline.length];
			if ((a.z - q) * (b.z - q) > 0) {
				continue;
			}
			if (Math.abs(a.z - b.z) < 1e-6) {
				lo = Math.min(lo, a.x, b.x);
				hi = Math.max(hi, a.x, b.x);
				continue;
			}
			const x = a.x + ((b.x - a.x) * (q - a.z)) / (b.z - a.z);
			lo = Math.min(lo, x);
			hi = Math.max(hi, x);
		}
		return lo <= hi ? { lo, hi } : null;
	};

	const stairWidth = MEZZANINE_STAIR_WIDTH;
	const stepCount = Math.round(deckHeight / metrics.rise);
	const run = stepCount * metrics.tread;
	const stairLength = STAIR_LANDING + run + STAIR_TOP;
	const central = shape === "horseshoe";
	let deckWidth = MEZZANINE_DECK_WIDTH + rng.pick([0, 0, 0.25, 0.5]);
	if (shape === "gallery") {
		deckWidth += rng.pick([0, 0.5, 1]);
	}
	if (!central) {
		let reach = 0;
		while (reach <= 5 && (spanAt(reach + 0.01)?.hi ?? -Infinity) < pHi - 0.01) {
			reach += 0.25;
		}
		deckWidth = Math.max(deckWidth, reach);
		if (deckWidth > 4.5) {
			return null;
		}
	}
	const voidMiddle = (pLo + pHi) / 2;
	const stairCenter = central
		? voidMiddle + rng.pick([-1, 1]) * (stairWidth / 2 + 1.4)
		: pHi - stairWidth / 2;
	const stairInner = central ? stairCenter - stairWidth / 2 : pHi - stairWidth;
	const stairOuter = stairCenter + stairWidth / 2;
	const stairBottom = deckWidth + stairLength;
	if (!inRoom({ x: stairCenter, z: stairBottom + STAIR_APPROACH })) {
		return null;
	}

	const armEnd = (side: "lo" | "hi"): number | null => {
		let end: number | null = null;
		for (let q = deckWidth; q <= qMax; q += 0.25) {
			const span = spanAt(q);
			const width = span
				? side === "lo"
					? pLo + deckWidth - span.lo
					: span.hi - (pHi - deckWidth)
				: 0;
			if (width < ARM_MIN_WIDTH) {
				break;
			}
			end = q;
		}
		return end !== null && end >= deckWidth + 2 ? end : null;
	};
	const strip = (depth: number): Vec2[] => [
		{ x: pLo - OUTSIDE, z: -OUTSIDE },
		{ x: pHi + OUTSIDE, z: -OUTSIDE },
		{ x: pHi + OUTSIDE, z: depth },
	];
	const closeStrip = (depth: number): Vec2 => ({ x: pLo - OUTSIDE, z: depth });

	const design = ((): Design | null => {
		switch (shape) {
			case "corner":
			case "diagonal": {
				const end = armEnd("lo");
				if (end === null) {
					return null;
				}
				const arm =
					rng.chance(0.3) && end - deckWidth > 5
						? Math.round((deckWidth + (end - deckWidth) * 0.65) * 4) / 4
						: end;
				const cut = shape === "diagonal" ? rng.pick([2.5, 3, 3.5]) : 0;
				const inner = pLo + deckWidth;
				if (inner + cut > stairInner - 1 || deckWidth + cut > arm - 0.5) {
					return null;
				}
				return {
					polygon: [
						...strip(deckWidth),
						...(cut > 0
							? [
									{ x: inner + cut, z: deckWidth },
									{ x: inner, z: deckWidth + cut },
								]
							: [{ x: inner, z: deckWidth }]),
						{ x: inner, z: arm },
						closeStrip(arm),
					],
					clear: {
						pa: inner,
						pb: stairInner,
						qa: deckWidth + cut,
						qb: qMax,
					},
					keepClear: null,
					podium: {
						p: pLo + deckWidth / 2,
						q: arm - 1.2,
						width: deckWidth - 0.75,
						depth: 1.75,
					},
				};
			}
			case "gallery":
				return {
					polygon: [...strip(deckWidth), closeStrip(deckWidth)],
					clear: {
						pa: pLo + 0.5,
						pb: stairInner - 0.5,
						qa: deckWidth,
						qb: qMax,
					},
					keepClear: null,
					podium: {
						p: pLo + 1.5,
						q: deckWidth / 2,
						width: 2.25,
						depth: deckWidth - 1,
					},
				};
			case "crescent": {
				const radius = rng.pick([2.5, 3, 3.5]);
				const bulge = Math.min(radius, rng.pick([2, 2.5, 3]));
				const from = pLo + radius + 0.5;
				const to = stairInner - radius - 0.75;
				if (from > to) {
					return null;
				}
				const center = rng.range(from, to);
				const arc = Array.from({ length: 9 }, (_, index) => {
					const angle = (Math.PI * index) / 8;
					return {
						x: center + radius * Math.cos(angle),
						z: deckWidth + bulge * Math.sin(angle),
					};
				});
				return {
					polygon: [...strip(deckWidth), ...arc, closeStrip(deckWidth)],
					clear: {
						pa: pLo + 0.5,
						pb: stairInner - 0.5,
						qa: deckWidth + bulge,
						qb: qMax,
					},
					keepClear: null,
					podium: {
						p: center,
						q: deckWidth + bulge * 0.35,
						width: radius * 1.1,
						depth: Math.max(1.75, bulge * 0.7),
					},
				};
			}
			case "pier": {
				const width = rng.pick([3, 3.25, 3.5]);
				const length = rng.pick([2.5, 3, 3.5, 4]);
				const from = pLo + 1.5;
				const to = stairInner - width - 1.5;
				if (from > to) {
					return null;
				}
				const start = rng.range(from, to);
				const tip = deckWidth + length;
				return {
					polygon: [
						...strip(deckWidth),
						{ x: start + width, z: deckWidth },
						{ x: start + width, z: tip },
						{ x: start, z: tip },
						{ x: start, z: deckWidth },
						closeStrip(deckWidth),
					],
					clear: {
						pa: pLo + 0.5,
						pb: stairInner - 0.5,
						qa: tip,
						qb: qMax,
					},
					keepClear: null,
					podium: {
						p: start + width / 2,
						q: tip - 1,
						width: width - 0.75,
						depth: 1.5,
					},
				};
			}
			case "horseshoe": {
				const lowArm = armEnd("lo");
				const highArm = armEnd("hi");
				if (lowArm === null || highArm === null) {
					return null;
				}
				const low = pLo + deckWidth;
				const high = pHi - deckWidth;
				if (stairInner < low + 1 || stairOuter > high - 1) {
					return null;
				}
				const shorter = rng.chance(0.5) ? "lo" : "hi";
				const shorten = (end: number, side: string) =>
					side === shorter && rng.chance(0.5)
						? Math.round((deckWidth + (end - deckWidth) * 0.6) * 4) / 4
						: end;
				const lowEnd = shorten(lowArm, "lo");
				const highEnd = shorten(highArm, "hi");
				return {
					polygon: [
						{ x: pLo - OUTSIDE, z: -OUTSIDE },
						{ x: pHi + OUTSIDE, z: -OUTSIDE },
						{ x: pHi + OUTSIDE, z: highEnd },
						{ x: high, z: highEnd },
						{ x: high, z: deckWidth },
						{ x: low, z: deckWidth },
						{ x: low, z: lowEnd },
						{ x: pLo - OUTSIDE, z: lowEnd },
					],
					clear: {
						pa: low,
						pb: high,
						qa: stairBottom + STAIR_APPROACH,
						qb: qMax,
					},
					keepClear: null,
					podium: {
						p: pLo + deckWidth / 2,
						q: lowEnd - 1.2,
						width: deckWidth - 0.75,
						depth: 1.75,
					},
				};
			}
			case "bridge": {
				const front = qMax - deckWidth;
				const width = rng.pick([2.5, 2.75, 3]);
				const from = pLo + 1.5;
				const to = stairInner - width - 1.5;
				if (stairBottom + 0.5 > front || from > to) {
					return null;
				}
				const start = rng.range(from, to);
				const rightWider = stairInner - (start + width) >= start - pLo;
				return {
					polygon: [
						...strip(deckWidth),
						{ x: start + width, z: deckWidth },
						{ x: start + width, z: front },
						{ x: pHi + OUTSIDE, z: front },
						{ x: pHi + OUTSIDE, z: qMax + OUTSIDE },
						{ x: pLo - OUTSIDE, z: qMax + OUTSIDE },
						{ x: pLo - OUTSIDE, z: front },
						{ x: start, z: front },
						{ x: start, z: deckWidth },
						closeStrip(deckWidth),
					],
					clear: {
						pa: rightWider ? start + width : pLo + 0.5,
						pb: rightWider ? stairInner : start,
						qa: deckWidth,
						qb: front,
					},
					keepClear: {
						pa: start - 0.3,
						pb: start + width + 0.3,
						qa: deckWidth - 0.6,
						qb: front + 0.6,
					},
					podium: null,
				};
			}
		}
	})();
	if (!design) {
		return null;
	}

	let deck = clipToConvex(design.polygon, hull);
	if (deck.length < 4) {
		return null;
	}
	const backEdgeStart = deck.reduce(
		(best, point, index) => {
			const next = deck[(index + 1) % deck.length];
			const length =
				Math.abs(point.z) < 0.01 && Math.abs(next.z) < 0.01
					? distance2(point, next)
					: 0;
			return length > best.length ? { index, length } : best;
		},
		{ index: -1, length: 0 },
	);
	if (backEdgeStart.index < 0) {
		return null;
	}
	deck = [
		...deck.slice(backEdgeStart.index),
		...deck.slice(0, backEdgeStart.index),
	];

	const samples = (a: Vec2, b: Vec2): Vec2[] => {
		const count = Math.max(1, Math.ceil(distance2(a, b) / 0.5));
		return Array.from({ length: count + 1 }, (_, step) => ({
			x: a.x + ((b.x - a.x) * step) / count,
			z: a.z + ((b.z - a.z) * step) / count,
		}));
	};
	const deckEdgesLocal = deck.map(
		(point, index) => [point, deck[(index + 1) % deck.length]] as const,
	);
	if (
		deckEdgesLocal.some(([a, b]) => samples(a, b).some((p) => !inRoom(p))) ||
		pointInPolygon(label, deck)
	) {
		return null;
	}
	const stairCorners: Vec2[] = [
		{ x: stairInner, z: deckWidth },
		{ x: stairOuter, z: deckWidth },
		{ x: stairOuter, z: stairBottom },
		{ x: stairInner, z: stairBottom },
	];
	if (
		stairCorners.some((corner) => !inRoom(corner)) ||
		pointInPolygon(label, stairCorners) ||
		distanceToPolygonBoundary(label, stairCorners) < 0.5
	) {
		return null;
	}

	// Un garde-corps court sur chaque bord libre, sauf au débouché de l'escalier.
	const rails: MezzanineSegment[] = [];
	for (const [a, b] of deckEdgesLocal) {
		const free = samples(a, b).some(
			(point) => distanceToPolygonBoundary(point, outline) > EPS,
		);
		if (!free) {
			continue;
		}
		const onStairTop =
			Math.abs(a.z - deckWidth) < 0.01 && Math.abs(b.z - deckWidth) < 0.01;
		const low = Math.min(a.x, b.x);
		const high = Math.max(a.x, b.x);
		if (onStairTop && high > stairInner && low < stairOuter) {
			if (low < stairInner - 0.05) {
				rails.push({
					a: { x: low, z: deckWidth },
					b: { x: stairInner, z: deckWidth },
				});
			}
			if (high > stairOuter + 0.05) {
				rails.push({
					a: { x: stairOuter, z: deckWidth },
					b: { x: high, z: deckWidth },
				});
			}
			continue;
		}
		rails.push({ a, b });
	}
	if (rails.length === 0) {
		return null;
	}
	rails.sort((r, s) => distance2(s.a, s.b) - distance2(r.a, r.b));

	const worldDeck = deck.map(toWorld);
	const doorSpots = groundDoors.map(toLocal);
	const postAllowed = (point: Vec2) =>
		distanceToPolygonBoundary(point, outline) >= POST_WALL_DISTANCE &&
		distanceToPolygonBoundary(point, stairCorners) >= POST_STAIR_DISTANCE &&
		!pointInPolygon(point, stairCorners) &&
		doorSpots.every((door) => distance2(point, door) >= POST_DOOR_CLEARANCE);
	const posts: Vec2[] = [];
	const addPost = (point: Vec2, spacing: number) => {
		if (
			postAllowed(point) &&
			posts.every((post) => distance2(post, point) >= spacing)
		) {
			posts.push(point);
		}
	};
	for (const rail of rails) {
		addPost(rail.a, POST_CORNER_SPACING);
		addPost(rail.b, POST_CORNER_SPACING);
	}
	for (const rail of rails) {
		const length = distance2(rail.a, rail.b);
		const count = Math.floor(length / MEZZANINE_POST_SPACING);
		for (let step = 1; step <= count; step += 1) {
			const t = step / (count + 1);
			addPost(
				{
					x: rail.a.x + (rail.b.x - rail.a.x) * t,
					z: rail.a.z + (rail.b.z - rail.a.z) * t,
				},
				MEZZANINE_POST_SPACING - 0.5,
			);
		}
	}
	for (const rail of rails) {
		if (posts.length >= 2) {
			break;
		}
		addPost(
			{ x: (rail.a.x + rail.b.x) / 2, z: (rail.a.z + rail.b.z) / 2 },
			POST_CORNER_SPACING,
		);
	}
	if (posts.length < 2) {
		return null;
	}

	const stairTop: MezzanineSegment = {
		a: { x: stairInner, z: deckWidth },
		b: { x: stairOuter, z: deckWidth },
	};
	if (!deckIsConnected(deck, stairTop, postBoxes(posts))) {
		return null;
	}

	const deckEdges: number[] = [];
	room.edges.forEach((candidate, index) => {
		if (candidate.kind !== "line" || edgeLength(candidate) < 2.6) {
			return;
		}
		const direction = edgeDirection(candidate);
		const length = edgeLength(candidate);
		const middle = {
			x: (candidate.a.x + candidate.b.x) / 2,
			z: (candidate.a.z + candidate.b.z) / 2,
		};
		let side = { x: -direction.z, z: direction.x };
		if (
			!pointInPolygon(
				{ x: middle.x + side.x * 0.2, z: middle.z + side.z * 0.2 },
				room.polygon,
			)
		) {
			side = { x: -side.x, z: -side.z };
		}
		let covered = true;
		for (let at = 0.4; at <= length - 0.4 && covered; at += 0.5) {
			covered = pointInPolygon(
				{
					x: candidate.a.x + direction.x * at + side.x * 1.2,
					z: candidate.a.z + direction.z * at + side.z * 1.2,
				},
				worldDeck,
			);
		}
		if (covered) {
			deckEdges.push(index);
		}
	});
	if (deckEdges.length === 0) {
		return null;
	}

	let stairEdge = -1;
	let stairEdgeFrom = 0;
	let stairEdgeTo = 0;
	if (!central) {
		const top = toWorld({ x: stairOuter, z: deckWidth });
		const bottom = toWorld({ x: stairOuter, z: stairBottom });
		stairEdge = room.edges.findIndex((candidate) => {
			if (candidate.kind !== "line") {
				return false;
			}
			return [top, bottom].every(
				(point) =>
					distance2(
						point,
						closestPointOnSegment(point, candidate.a, candidate.b),
					) < 0.02,
			);
		});
		if (stairEdge < 0) {
			return null;
		}
		const wall = room.edges[stairEdge];
		const direction = edgeDirection(wall);
		const project = (point: Vec2) =>
			(point.x - wall.a.x) * direction.x + (point.z - wall.a.z) * direction.z;
		const ends = [project(top), project(bottom)];
		const toBottom = ends[1] > ends[0] ? 1 : -1;
		const extended = ends[1] + toBottom * STAIR_APPROACH * 0.85;
		const padded = ends[0] - toBottom * 0.2;
		stairEdgeFrom = Math.max(0, Math.min(padded, extended));
		stairEdgeTo = Math.min(edgeLength(wall), Math.max(padded, extended));
	}

	const clear = { ...design.clear };
	clear.qb = Math.min(clear.qb, qMax);
	const clearFits = () =>
		[
			{ x: clear.pa, z: clear.qa },
			{ x: clear.pb, z: clear.qa },
			{ x: clear.pb, z: clear.qb },
			{ x: clear.pa, z: clear.qb },
		].every(inRoom);
	for (let guard = 0; guard < 40 && !clearFits(); guard += 1) {
		const deep = clear.qb - clear.qa;
		const wide = clear.pb - clear.pa;
		if (deep >= wide) {
			clear.qb -= 0.25;
		} else {
			clear.pa += 0.125;
			clear.pb -= 0.125;
		}
	}
	const clearCenterLocal = clearFits()
		? { x: (clear.pa + clear.pb) / 2, z: (clear.qa + clear.qb) / 2 }
		: label;

	const forward = { x: -inward.x, z: -inward.z };
	const right = { x: forward.z, z: -forward.x };
	const stair: StairSpec = {
		origin: toWorld({ x: stairCenter, z: stairBottom }),
		forward: cleanPoint(forward),
		right: cleanPoint(right),
		width: stairWidth,
		length: stairLength,
		bottomLanding: STAIR_LANDING,
		run,
		stepCount,
		rise: deckHeight / stepCount,
		topY: deckHeight,
	};
	const cornerSpan = spanAt(0.8);
	const worldSegment = (a: Vec2, b: Vec2): MezzanineSegment => ({
		a: toWorld(a),
		b: toWorld(b),
	});
	const rectangle = (rect: ClearRect): Vec2[] =>
		[
			{ x: rect.pa, z: rect.qa },
			{ x: rect.pb, z: rect.qa },
			{ x: rect.pb, z: rect.qb },
			{ x: rect.pa, z: rect.qb },
		].map(toWorld);
	const rotation = Math.atan2(-inward.x, inward.z);
	const podium =
		design.podium && design.podium.width >= 1.5 && design.podium.depth >= 1.25
			? {
					center: toWorld({ x: design.podium.p, z: design.podium.q }),
					rotation,
					width: Math.round(design.podium.width * 4) / 4,
					depth: Math.round(design.podium.depth * 4) / 4,
				}
			: null;
	return {
		shape,
		floorY: room.floorY + deckHeight,
		deck: worldDeck,
		deckEdges,
		rails: rails.map(({ a, b }) => worldSegment(a, b)),
		posts: posts.map(toWorld),
		stair,
		stairPolygon: stairCorners.map(toWorld),
		stairSide: worldSegment(
			{ x: stairInner, z: deckWidth },
			{ x: stairInner, z: stairBottom },
		),
		stairSideOuter: central
			? worldSegment(
					{ x: stairOuter, z: deckWidth },
					{ x: stairOuter, z: stairBottom },
				)
			: null,
		stairEnd: worldSegment(
			{ x: stairInner, z: deckWidth },
			{ x: stairOuter, z: deckWidth },
		),
		stairEdge,
		stairEdgeFrom,
		stairEdgeTo,
		corner: toWorld({
			x: (cornerSpan?.lo ?? pLo) + 0.8,
			z: 0.8,
		}),
		clearCenter: toWorld(clearCenterLocal),
		clearWidth: Math.max(0, clear.pb - clear.pa),
		clearDepth: Math.max(0, clear.qb - clear.qa),
		clearRotation: rotation,
		deckKeepClear: design.keepClear ? rectangle(design.keepClear) : null,
		podium,
	};
}
