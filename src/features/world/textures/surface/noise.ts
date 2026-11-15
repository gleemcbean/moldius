const GRADIENT_COUNT = 16;
const GRADIENT_X = new Float32Array(GRADIENT_COUNT);
const GRADIENT_Y = new Float32Array(GRADIENT_COUNT);
for (let index = 0; index < GRADIENT_COUNT; index += 1) {
	const angle = (index / GRADIENT_COUNT) * Math.PI * 2 + 0.19;
	GRADIENT_X[index] = Math.cos(angle);
	GRADIENT_Y[index] = Math.sin(angle);
}

export function hashInt(x: number, y: number, seed: number): number {
	let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ seed;
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return (h ^ (h >>> 16)) >>> 0;
}

export function hash01(x: number, y: number, seed: number): number {
	return hashInt(x, y, seed) / 4294967296;
}

export function wrap(value: number, period: number): number {
	const result = value % period;
	return result < 0 ? result + period : result;
}

export function clamp01(value: number): number {
	return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function smoothstep(
	edge0: number,
	edge1: number,
	value: number,
): number {
	const t = clamp01((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}

function fade(t: number): number {
	return t * t * t * (t * (t * 6 - 15) + 10);
}

function gradientDot(
	x: number,
	y: number,
	seed: number,
	dx: number,
	dy: number,
): number {
	const slot = hashInt(x, y, seed) & (GRADIENT_COUNT - 1);
	return GRADIENT_X[slot] * dx + GRADIENT_Y[slot] * dy;
}

export function perlin(
	x: number,
	y: number,
	periodX: number,
	periodY: number,
	seed: number,
): number {
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const fx = x - xi;
	const fy = y - yi;
	const x0 = wrap(xi, periodX);
	const y0 = wrap(yi, periodY);
	const x1 = wrap(xi + 1, periodX);
	const y1 = wrap(yi + 1, periodY);
	const u = fade(fx);
	const v = fade(fy);
	const bottom = lerp(
		gradientDot(x0, y0, seed, fx, fy),
		gradientDot(x1, y0, seed, fx - 1, fy),
		u,
	);
	const top = lerp(
		gradientDot(x0, y1, seed, fx, fy - 1),
		gradientDot(x1, y1, seed, fx - 1, fy - 1),
		u,
	);
	return lerp(bottom, top, v) * 1.42;
}

export function fbm(
	u: number,
	v: number,
	frequencyX: number,
	frequencyY: number,
	octaves: number,
	seed: number,
	gain = 0.5,
): number {
	let sum = 0;
	let amplitude = 1;
	let total = 0;
	let fx = frequencyX;
	let fy = frequencyY;
	for (let octave = 0; octave < octaves; octave += 1) {
		sum += perlin(u * fx, v * fy, fx, fy, seed + octave * 101) * amplitude;
		total += amplitude;
		amplitude *= gain;
		fx *= 2;
		fy *= 2;
	}
	return sum / total;
}

export function ridged(
	u: number,
	v: number,
	frequencyX: number,
	frequencyY: number,
	octaves: number,
	seed: number,
): number {
	let sum = 0;
	let amplitude = 1;
	let total = 0;
	let fx = frequencyX;
	let fy = frequencyY;
	for (let octave = 0; octave < octaves; octave += 1) {
		const value =
			1 - Math.abs(perlin(u * fx, v * fy, fx, fy, seed + octave * 77));
		sum += value * value * amplitude;
		total += amplitude;
		amplitude *= 0.5;
		fx *= 2;
		fy *= 2;
	}
	return sum / total;
}

export interface VoronoiSample {
	distance: number;
	edge: number;
	id: number;
	cellX: number;
	cellY: number;
	offsetX: number;
	offsetY: number;
}

export function createVoronoiSample(): VoronoiSample {
	return {
		distance: 0,
		edge: 0,
		id: 0,
		cellX: 0,
		cellY: 0,
		offsetX: 0,
		offsetY: 0,
	};
}

export function voronoi(
	x: number,
	y: number,
	cellsX: number,
	cellsY: number,
	seed: number,
	jitter: number,
	out: VoronoiSample,
): VoronoiSample {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const fx = x - ix;
	const fy = y - iy;
	let best = 8;
	let bestX = 0;
	let bestY = 0;
	let bestI = 0;
	let bestJ = 0;
	let bestId = 0;
	for (let j = -1; j <= 1; j += 1) {
		for (let i = -1; i <= 1; i += 1) {
			const cx = wrap(ix + i, cellsX);
			const cy = wrap(iy + j, cellsY);
			const hash = hashInt(cx, cy, seed);
			const ox = 0.5 + ((hash & 0xffff) / 65535 - 0.5) * jitter;
			const oy = 0.5 + ((hash >>> 16) / 65535 - 0.5) * jitter;
			const rx = i + ox - fx;
			const ry = j + oy - fy;
			const distance = rx * rx + ry * ry;
			if (distance < best) {
				best = distance;
				bestX = rx;
				bestY = ry;
				bestI = i;
				bestJ = j;
				bestId = cy * cellsX + cx;
			}
		}
	}
	let edge = 8;
	for (let j = -2; j <= 2; j += 1) {
		for (let i = -2; i <= 2; i += 1) {
			const gi = bestI + i;
			const gj = bestJ + j;
			const cx = wrap(ix + gi, cellsX);
			const cy = wrap(iy + gj, cellsY);
			const hash = hashInt(cx, cy, seed);
			const ox = 0.5 + ((hash & 0xffff) / 65535 - 0.5) * jitter;
			const oy = 0.5 + ((hash >>> 16) / 65535 - 0.5) * jitter;
			const rx = gi + ox - fx;
			const ry = gj + oy - fy;
			const dx = rx - bestX;
			const dy = ry - bestY;
			const length = dx * dx + dy * dy;
			if (length > 1e-6) {
				const inverse = 1 / Math.sqrt(length);
				const distance =
					0.5 * (bestX + rx) * dx * inverse + 0.5 * (bestY + ry) * dy * inverse;
				if (distance < edge) {
					edge = distance;
				}
			}
		}
	}
	out.distance = Math.sqrt(best);
	out.edge = edge;
	out.id = bestId;
	out.cellX = wrap(ix + bestI, cellsX);
	out.cellY = wrap(iy + bestJ, cellsY);
	out.offsetX = bestX;
	out.offsetY = bestY;
	return out;
}
