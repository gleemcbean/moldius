import { clamp01, fbm, hash01, perlin, smoothstep } from "./noise";
import { blendTone, paintTone, type Texel, type Tone } from "./SurfaceField";

const FREE = 4096;

export interface WoodLook {
	base: Tone;
	late: Tone;
	ringsPerMeter: number;
	figure: number;
	varnish: number;
}

export function woodFibers(
	texel: Texel,
	along: number,
	across: number,
	seed: number,
	look: WoodLook,
): number {
	const arch = perlin(along * 0.35, across * 0.9, FREE, FREE, seed) * 3.2;

	const wobble =
		perlin(along * 2.2, across * 3.1, FREE, FREE, seed + 3) * 0.55 +
		perlin(along * 7, across * 9, FREE, FREE, seed + 4) * 0.12;

	const rings = across * look.ringsPerMeter + (arch + wobble) * look.figure;
	const ring = rings - Math.floor(rings);
	const late = smoothstep(0.35, 0.8, ring) * (1 - smoothstep(0.82, 1, ring));
	const fiber = perlin(along * 9, across * 380, FREE, FREE, seed + 9);

	const pore = Math.max(
		0,
		perlin(along * 40, across * 700, FREE, FREE, seed + 10) - 0.45,
	);

	const broad = perlin(along * 0.9, across * 4, FREE, FREE, seed + 11) * 0.09;

	paintTone(texel, look.base, 1 + fiber * 0.06 + broad);
	blendTone(texel, look.late, late * 0.42 + pore * 0.6);

	texel.relief = 0.72 - late * 0.1 - pore * 0.3 + fiber * 0.03;
	texel.rough = clamp01(look.varnish + pore * 0.4 + late * 0.05);

	return late;
}

export function periodicWood(
	texel: Texel,
	u: number,
	v: number,
	tileU: number,
	tileV: number,
	seed: number,
	look: WoodLook,
): void {
	const rings = Math.max(1, Math.round(look.ringsPerMeter * tileV));
	const archCells = Math.max(1, Math.round(tileU * 0.7));
	const arch = perlin(u * archCells, v * 2, archCells, 2, seed) * 1.3;
	const wobbleU = Math.max(1, Math.round(tileU * 2.2));
	const wobbleV = Math.max(1, Math.round(tileV * 3));

	const wobble =
		perlin(u * wobbleU, v * wobbleV, wobbleU, wobbleV, seed + 3) * 0.3 +
		perlin(
			u * wobbleU * 3,
			v * wobbleV * 3,
			wobbleU * 3,
			wobbleV * 3,
			seed + 4,
		) *
			0.1;

	const spacing =
		fbm(u, v, 1, Math.max(1, Math.round(tileV * 8)), 3, seed + 7) * 1.6;

	const ringCoord = v * rings + (arch + wobble) * look.figure + spacing;
	const ring = ringCoord - Math.floor(ringCoord);
	const late = smoothstep(0.3, 0.85, ring) * (1 - smoothstep(0.86, 1, ring));
	const streakU = Math.max(1, Math.round(tileU * 2));
	const streakV = Math.max(1, Math.round(tileV * 30));
	const streak = fbm(u, v, streakU, streakV, 3, seed + 6) * 0.14;
	const fiberU = Math.max(1, Math.round(tileU * 9));
	const fiberV = Math.max(1, Math.round(tileV * 380));
	const fiber = perlin(u * fiberU, v * fiberV, fiberU, fiberV, seed + 9);
	const poreU = Math.max(1, Math.round(tileU * 40));
	const poreV = Math.max(1, Math.round(tileV * 700));

	const pore = Math.max(
		0,
		perlin(u * poreU, v * poreV, poreU, poreV, seed + 10) - 0.45,
	);

	const broad = fbm(u, v, 2, 4, 2, seed + 11) * 0.1;

	paintTone(texel, look.base, 1 + fiber * 0.07 + broad + streak * 1.3);
	blendTone(texel, look.late, late * 0.22 + pore * 0.6);

	texel.relief = 0.72 - late * 0.08 - pore * 0.3 + fiber * 0.03;
	texel.rough = clamp01(look.varnish + pore * 0.4 + late * 0.05);
}

export function grime(
	u: number,
	v: number,
	cells: number,
	seed: number,
	threshold: number,
): number {
	return smoothstep(
		threshold,
		threshold + 0.35,
		fbm(u, v, cells, cells, 4, seed),
	);
}

export function speckle(
	u: number,
	v: number,
	cellsU: number,
	cellsV: number,
	seed: number,
	density: number,
): number {
	const x = Math.floor(u * cellsU);
	const y = Math.floor(v * cellsV);

	return hash01(x, y, seed) < density ? 1 : 0;
}

export function stoneGrain(
	texel: Texel,
	u: number,
	v: number,
	cellsU: number,
	cellsV: number,
	seed: number,
	base: Tone,
	dark: Tone,
	light: Tone,
): number {
	const broad = fbm(u, v, cellsU, cellsV, 5, seed);
	const mid = fbm(u, v, cellsU * 4, cellsV * 4, 3, seed + 2);

	const fine = perlin(
		u * cellsU * 16,
		v * cellsV * 16,
		cellsU * 16,
		cellsV * 16,
		seed + 4,
	);

	const grainDark = speckle(u, v, cellsU * 40, cellsV * 40, seed + 7, 0.035);
	const grainLight = speckle(u, v, cellsU * 36, cellsV * 36, seed + 8, 0.025);

	paintTone(texel, base, 1 + broad * 0.22 + mid * 0.08 + fine * 0.03);
	blendTone(texel, dark, grainDark * 0.3 + Math.max(0, -broad) * 0.25);
	blendTone(texel, light, grainLight * 0.3 + Math.max(0, mid) * 0.08);

	return broad * 0.5 + mid * 0.35 + fine * 0.15;
}

export function veins(
	u: number,
	v: number,
	cells: number,
	seed: number,
	sharpness: number,
): number {
	const turbulence =
		fbm(u, v, cells, cells, 5, seed) * 1.15 +
		fbm(u, v, cells * 4, cells * 4, 3, seed + 21) * 0.22;

	const slant = Math.max(1, Math.round(cells * 0.6));

	const band = Math.abs(
		Math.sin((u * cells + v * slant + turbulence) * Math.PI),
	);

	return (1 - band) ** sharpness;
}
