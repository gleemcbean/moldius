import type { SeededRandom } from "@shared/random";
import { wrap } from "./noise";

export interface Course {
	start: number;
	end: number;
	joints: number[];
	firstId: number;
}

export interface CourseLayout {
	courses: Course[];
	count: number;
}

export interface BlockHit {
	id: number;
	row: number;
	along: number;
	length: number;
	across: number;
	height: number;
	edgeU: number;
	edgeV: number;
}

export function createBlockHit(): BlockHit {
	return {
		id: 0,
		row: 0,
		along: 0,
		length: 1,
		across: 0,
		height: 1,
		edgeU: 0,
		edgeV: 0,
	};
}

function normalizedSplits(
	rng: SeededRandom,
	count: number,
	spread: number,
): number[] {
	const sizes = Array.from(
		{ length: count },
		() => 1 + (rng.next() - 0.5) * 2 * spread,
	);

	const total = sizes.reduce((sum, size) => sum + size, 0);

	return sizes.map((size) => size / total);
}

export function courseLayout(
	rng: SeededRandom,
	rows: number,
	blocksPerRow: number,
	options: {
		rowSpread?: number;
		lengthSpread?: number;
		stagger?: "half" | "random";
		blockVariance?: number;
	} = {},
): CourseLayout {
	const heights = normalizedSplits(rng, rows, options.rowSpread ?? 0);
	const courses: Course[] = [];
	let start = 0;
	let nextId = 0;

	heights.forEach((height, row) => {
		const variance = options.blockVariance ?? 0;

		const blocks = Math.max(
			1,
			Math.round(blocksPerRow * (1 + (rng.next() - 0.5) * 2 * variance)),
		);

		const lengths = normalizedSplits(rng, blocks, options.lengthSpread ?? 0);

		const offset =
			options.stagger === "random"
				? rng.next()
				: row % 2 === 0
					? 0
					: 0.5 / blocks;

		const joints: number[] = [];
		let cursor = offset;

		for (const length of lengths) {
			joints.push(wrap(cursor, 1));

			cursor += length;
		}

		joints.sort((a, b) => a - b);
		courses.push({ start, end: start + height, joints, firstId: nextId });

		nextId += joints.length;
		start += height;
	});

	courses[courses.length - 1].end = 1;

	return { courses, count: nextId };
}

export function locateBlock(
	layout: CourseLayout,
	u: number,
	v: number,
	hit: BlockHit,
): BlockHit {
	const { courses } = layout;
	let low = 0;
	let high = courses.length - 1;

	while (low < high) {
		const middle = (low + high) >> 1;

		if (courses[middle].end <= v) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}

	const course = courses[low];
	const joints = course.joints;
	let index = joints.length - 1;

	for (let candidate = 0; candidate < joints.length; candidate += 1) {
		if (joints[candidate] > u) {
			index = candidate - 1;
			break;
		}
	}

	let blockStart: number;
	let blockEnd: number;
	let blockIndex: number;

	if (index < 0) {
		blockIndex = joints.length - 1;
		blockStart = joints[joints.length - 1] - 1;
		blockEnd = joints[0];
	} else {
		blockIndex = index;
		blockStart = joints[index];
		blockEnd = index + 1 < joints.length ? joints[index + 1] : joints[0] + 1;
	}

	const position = u < blockStart ? u + 1 : u;

	hit.id = course.firstId + blockIndex;
	hit.row = low;
	hit.along = position - blockStart;
	hit.length = blockEnd - blockStart;
	hit.across = v - course.start;
	hit.height = course.end - course.start;
	hit.edgeU = Math.min(hit.along, hit.length - hit.along);
	hit.edgeV = Math.min(hit.across, hit.height - hit.across);

	return hit;
}

export interface HerringboneHit {
	id: number;
	horizontal: boolean;
	along: number;
	across: number;
	edge: number;
}

export function herringbone(
	u: number,
	v: number,
	cells: number,
	ratio: number,
	hit: HerringboneHit,
): HerringboneHit {
	const x = u * cells;
	const y = v * cells;
	const i = Math.floor(x);
	const j = Math.floor(y);
	const period = ratio * 2;
	const diagonal = i - j;
	const stair = Math.floor(diagonal / period);
	const step = diagonal - stair * period;

	if (step < ratio) {
		const originX = j + stair * period;

		hit.horizontal = true;
		hit.along = (x - originX) / ratio;
		hit.across = y - j;
		hit.id = wrap(originX, cells) * 131 + wrap(j, cells) * 7 + 1;
	} else {
		const t = i - stair * period - ratio;
		const originY = t - ratio + 1;

		hit.horizontal = false;
		hit.along = (y - originY) / ratio;
		hit.across = x - i;
		hit.id = wrap(i, cells) * 131 + wrap(originY, cells) * 7 + 2;
	}

	const alongEdge = Math.min(hit.along, 1 - hit.along) * ratio;
	const acrossEdge = Math.min(hit.across, 1 - hit.across);

	hit.edge = Math.min(alongEdge, acrossEdge) / cells;

	return hit;
}

export interface GridHit {
	column: number;
	row: number;
	localU: number;
	localV: number;
	edge: number;
}

export function gridCell(
	u: number,
	v: number,
	columns: number,
	rows: number,
	hit: GridHit,
): GridHit {
	const x = u * columns;
	const y = v * rows;

	hit.column = Math.floor(x);
	hit.row = Math.floor(y);
	hit.localU = x - hit.column;
	hit.localV = y - hit.row;

	hit.edge = Math.min(
		Math.min(hit.localU, 1 - hit.localU) / columns,
		Math.min(hit.localV, 1 - hit.localV) / rows,
	);

	return hit;
}
