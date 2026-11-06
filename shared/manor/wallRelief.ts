import type { Room } from "./types.js";

/** Un point du profil vertical d'un mur : hauteur et avancée dans la salle. */
export interface ReliefNode {
	y: number;
	depth: number;
}

const COVE_STEPS = 5;
const CLEAR_HEIGHT = 2.4;
const MAX_TOP = 0.6;
/** Le joueur reste à cette distance des murs : un relief plus bas ne le gêne pas. */
export const WALL_RELIEF_MAX_LOW_DEPTH = 0.2;

function pick(seed: number, shift: number, count: number): number {
	return ((seed >>> shift) & 0xff) % count;
}

function topProfile(room: Room, base: number, size: number): ReliefNode[] {
	const h = room.height;
	switch (size < 0.3 ? 1 : pick(room.seed, 11, 3)) {
		case 0:
			return Array.from({ length: COVE_STEPS }, (_, step) => {
				const angle = (step / (COVE_STEPS - 1)) * (Math.PI / 2);
				return {
					y: h - size + size * Math.sin(angle),
					depth: base + size * (1 - Math.cos(angle)),
				};
			});
		case 1:
			return [
				{ y: h - size, depth: base },
				{ y: h, depth: base + size },
			];
		default:
			return [
				{ y: h - size, depth: base },
				{ y: h - size + 0.04, depth: base + size * 0.33 },
				{ y: h - size * 0.6, depth: base + size * 0.33 },
				{ y: h - size * 0.6 + 0.04, depth: base + size * 0.66 },
				{ y: h - size * 0.25, depth: base + size * 0.66 },
				{ y: h - size * 0.25 + 0.04, depth: base + size },
				{ y: h, depth: base + size },
			];
	}
}

/**
 * Profil d'un mur de bas en haut : bandeau, encorbellement et voussure. Le bas du
 * mur reste droit pour que les meubles adossés ne passent jamais à travers.
 */
export function wallProfile(room: Room): ReliefNode[] {
	const h = room.height;
	const flat: ReliefNode[] = [
		{ y: 0, depth: 0 },
		{ y: h, depth: 0 },
	];
	if (room.type === "stairwell" || room.type === "corridor") {
		return flat;
	}
	const nodes: ReliefNode[] = [];
	const deck = room.mezzanine ? room.mezzanine.floorY - room.floorY : null;
	const beltY = deck ?? (h >= 4.2 ? 2.75 : null);
	const size = Math.min(MAX_TOP, (h - CLEAR_HEIGHT) * 0.7);
	if (beltY !== null && beltY + 0.2 < h - Math.max(size, 0)) {
		nodes.push(
			{ y: beltY - 0.2, depth: 0 },
			{ y: beltY - 0.16, depth: 0.1 },
			{ y: beltY + 0.04, depth: 0.1 },
			{ y: beltY + 0.08, depth: 0 },
		);
	}
	if (size >= 0.1) {
		let overhang = 0;
		const start = deck !== null ? deck + 2.75 : 3.3;
		if (h - size - start > 0.5 && pick(room.seed, 19, 2) === 0) {
			overhang = 0.2;
			nodes.push({ y: start, depth: 0 }, { y: start + 0.2, depth: overhang });
		}
		nodes.push(...topProfile(room, overhang, size));
	}
	if (nodes.length === 0) {
		return flat;
	}
	if (nodes[0].y > 0) {
		nodes.unshift({ y: 0, depth: 0 });
	}
	const last = nodes[nodes.length - 1];
	if (last.y < h) {
		nodes.push({ y: h, depth: last.depth });
	}
	return nodes;
}

/** Garde la partie du profil comprise entre deux hauteurs. */
export function clipProfile(
	nodes: ReliefNode[],
	bottom: number,
	top: number,
): ReliefNode[] {
	const at = (y: number): number => {
		for (let index = 1; index < nodes.length; index += 1) {
			const a = nodes[index - 1];
			const b = nodes[index];
			if (y <= b.y) {
				const span = b.y - a.y;
				return span > 1e-6
					? a.depth + ((b.depth - a.depth) * (y - a.y)) / span
					: b.depth;
			}
		}
		return nodes[nodes.length - 1].depth;
	};
	return [
		{ y: bottom, depth: at(bottom) },
		...nodes.filter((node) => node.y > bottom + 1e-4 && node.y < top - 1e-4),
		{ y: top, depth: at(top) },
	];
}
