export type PlankPoint = [x: number, y: number];

export interface PlankHole {
	halfWidth: number;
	bottom: number;
	top: number;
}

const EDGE_STEPS = 5;

export function plankDisc(
	radius: number,
	count: number,
	seam: number,
	hole: PlankHole | null = null,
): PlankPoint[][] {
	const width = (radius * 2) / count;
	const outlines: PlankPoint[][] = [];
	const edge = (x: number) => Math.sqrt(Math.max(0, radius * radius - x * x));
	for (let index = 0; index < count; index += 1) {
		const x0 = -radius + index * width + seam / 2;
		const x1 = x0 + width - seam;
		const xs = Array.from(
			{ length: EDGE_STEPS + 1 },
			(_, step) => x0 + ((x1 - x0) * step) / EDGE_STEPS,
		);
		const lowerEdge = xs.map((x): PlankPoint => [x, -edge(x)]);
		const upperEdge = xs.map((x): PlankPoint => [x, edge(x)]).reverse();
		if (!hole || x1 <= -hole.halfWidth || x0 >= hole.halfWidth) {
			outlines.push([...lowerEdge, ...upperEdge]);
			continue;
		}
		if (lowerEdge.some(([, y]) => y < hole.bottom)) {
			outlines.push([
				...lowerEdge.map(([x, y]): PlankPoint => [x, Math.min(y, hole.bottom)]),
				[x1, hole.bottom],
				[x0, hole.bottom],
			]);
		}
		if (upperEdge.some(([, y]) => y > hole.top)) {
			outlines.push([
				[x0, hole.top],
				[x1, hole.top],
				...upperEdge.map(([x, y]): PlankPoint => [x, Math.max(y, hole.top)]),
			]);
		}
	}
	return outlines;
}
