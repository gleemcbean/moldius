import {
	type BlockHit,
	courseLayout,
	createBlockHit,
	type GridHit,
	gridCell,
	type HerringboneHit,
	herringbone,
	locateBlock,
} from "./layouts";
import { grime, stoneGrain, veins, type WoodLook, woodFibers } from "./motifs";
import {
	createVoronoiSample,
	fbm,
	hash01,
	lerp,
	perlin,
	ridged,
	smoothstep,
	voronoi,
} from "./noise";
import type { FineRecipe } from "./recipes";
import { blendTone, mixTone, paintTone, scaleTone, tone } from "./SurfaceField";

const DIRT = tone(0x231c15);
const GRIME = tone(0x2e2a24);
const MOSS = tone(0x4a6a2c);
const MOSS_DEEP = tone(0x2f4a22);

function joint(edge: number, gap: number, bevel: number): number {
	return smoothstep(gap, gap + bevel, edge);
}

function plankFloor(base: number, late: number, varnish: number): FineRecipe {
	return {
		size: [512, 512],
		tile: [2, 2],
		depth: 0.006,
		parallax: true,
		paint: (field, rng) => {
			const layout = courseLayout(rng, 8, 2, {
				lengthSpread: 0.45,
				stagger: "random",
				blockVariance: 0.6,
			});
			const tones = Array.from(
				{ length: layout.count },
				() => 0.8 + rng.next() * 0.34,
			);
			const look: WoodLook = {
				base: tone(base),
				late: tone(late),
				ringsPerMeter: 34,
				figure: 1,
				varnish,
			};
			const hit = createBlockHit();
			const seed = field.seed;
			field.paint((u, v, texel) => {
				locateBlock(layout, u, v, hit);
				const along = hit.along * 2;
				const across = hit.across * 2;
				woodFibers(
					texel,
					along + hit.id * 3.7,
					across + hit.id * 0.41,
					seed + hit.id * 13,
					look,
				);
				scaleTone(texel, tones[hit.id]);
				const crown = hit.across / hit.height - 0.5;
				const grain = texel.relief;
				const sideEdge = hit.edgeV * 2;
				const endEdge = hit.edgeU * 2;
				const edge = Math.min(sideEdge, endEdge);
				const profile = joint(edge, 0.0008, 0.0035);
				texel.relief =
					(0.82 + (grain - 0.72) * 0.6 - crown * crown * 0.28) * profile;
				if (profile < 1) {
					blendTone(texel, DIRT, (1 - profile) * 0.75);
					texel.rough = lerp(0.95, texel.rough, profile);
					texel.ao = lerp(0.55, 1, profile);
				}
				const width = hit.height * 2;
				const endDistance = Math.min(along, hit.length * 2 - along);
				const sideOffset = Math.abs(across - width / 2) - width * 0.28;
				const nail = Math.hypot(endDistance - 0.035, sideOffset);
				if (nail < 0.0045) {
					paintTone(texel, tone(0x2a2522), 1 - nail * 60);
					texel.relief -= 0.06;
					texel.metal = 0.55;
					texel.rough = 0.6;
				}
				const wear = grime(u, v, 3, seed + 50, 0.05);
				texel.rough = lerp(texel.rough, 0.82, wear * 0.55);
				scaleTone(texel, 1 - wear * 0.08);
				const scratch = Math.abs(perlin(u * 6, v * 220, 6, 220, seed + 61));
				if (
					scratch < 0.02 &&
					hash01(Math.floor(u * 24), Math.floor(v * 24), seed + 62) < 0.25
				) {
					scaleTone(texel, 1.12);
					texel.rough = 0.9;
					texel.relief -= 0.03;
				}
			});
		},
	};
}

function herringboneParquet(): FineRecipe {
	return {
		size: [512, 512],
		tile: [2, 2],
		depth: 0.004,
		parallax: true,
		paint: (field) => {
			const look: WoodLook = {
				base: tone(0x9a6a3c),
				late: tone(0x5a3518),
				ringsPerMeter: 46,
				figure: 0.7,
				varnish: 0.38,
			};
			const hit: HerringboneHit = {
				id: 0,
				horizontal: true,
				along: 0,
				across: 0,
				edge: 0,
			};
			const seed = field.seed;
			field.paint((u, v, texel) => {
				herringbone(u, v, 16, 4, hit);
				const along = hit.along * 0.5;
				const across = hit.across * 0.125;
				woodFibers(
					texel,
					along + (hit.id % 97) * 1.3,
					across + (hit.id % 31) * 0.21,
					seed + hit.id,
					look,
				);
				const shade = 0.82 + hash01(hit.id, 3, seed) * 0.3;
				scaleTone(texel, hit.horizontal ? shade : shade * 0.94);
				const grain = texel.relief;
				const profile = joint(hit.edge * 2, 0.0006, 0.0025);
				texel.relief = (0.85 + (grain - 0.72) * 0.5) * profile;
				if (profile < 1) {
					blendTone(texel, DIRT, (1 - profile) * 0.8);
					texel.rough = lerp(0.95, texel.rough, profile);
				}
				const wear = grime(u, v, 2, seed + 7, 0.1);
				texel.rough = lerp(texel.rough, 0.72, wear * 0.6);
			});
		},
	};
}

function masonry(options: {
	base: number;
	mortar: number;
	rows: number;
	blocks: number;
	tile: [number, number];
	size: [number, number];
	depth: number;
	gap: number;
	bevel: number;
	rowSpread?: number;
	lengthSpread?: number;
	stagger?: "half" | "random";
	tooling?: number;
	worn?: number;
	moss?: number;
	variation?: number;
}): FineRecipe {
	return {
		size: options.size,
		tile: options.tile,
		depth: options.depth,
		parallax: true,
		paint: (field, rng) => {
			const layout = courseLayout(rng, options.rows, options.blocks, {
				rowSpread: options.rowSpread ?? 0,
				lengthSpread: options.lengthSpread ?? 0.2,
				stagger: options.stagger ?? "half",
			});
			const variation = options.variation ?? 0.22;
			const stones = Array.from({ length: layout.count }, () => ({
				shade: 1 + (rng.next() - 0.5) * variation * 2,
				warm: (rng.next() - 0.5) * 0.07,
				tiltU: (rng.next() - 0.5) * 0.2,
				tiltV: (rng.next() - 0.5) * 0.2,
				lift: rng.next() * 0.1,
				rugged: rng.chance(0.3) ? 0.6 + rng.next() * 0.4 : 0,
			}));
			const base = tone(options.base);
			const mortar = tone(options.mortar);
			const dark = mixTone(base, tone(0x1a1814), 0.55);
			const light = mixTone(base, tone(0xf0eadc), 0.4);
			const [tileU, tileV] = options.tile;
			const hit: BlockHit = createBlockHit();
			const seed = field.seed;
			const chipCells = Math.round(tileU * 18);
			const chipCellsV = Math.round(tileV * 18);
			field.paint((u, v, texel) => {
				locateBlock(layout, u, v, hit);
				const stone = stones[hit.id];
				const chip =
					perlin(
						u * chipCells,
						v * chipCellsV,
						chipCells,
						chipCellsV,
						seed + 3,
					) *
						options.gap *
						1.6 +
					fbm(u, v, chipCells * 3, chipCellsV * 3, 2, seed + 4) *
						options.gap *
						0.7;
				const edge = Math.min(hit.edgeU * tileU, hit.edgeV * tileV) + chip;
				const profile = joint(edge, options.gap, options.bevel);
				const grain = stoneGrain(
					texel,
					u,
					v,
					Math.round(tileU * 3),
					Math.round(tileV * 3),
					seed + 20,
					base,
					dark,
					light,
				);
				scaleTone(texel, stone.shade);
				texel.r += stone.warm;
				texel.b -= stone.warm;
				const tooling = options.tooling ?? 0;
				const marks =
					tooling > 0
						? Math.abs(
								Math.sin(
									(hit.along * tileU * 70 +
										perlin(u * 8, v * 8, 8, 8, seed + 5) * 2) *
										Math.PI,
								),
							) * tooling
						: 0;
				const top =
					0.78 +
					stone.lift +
					grain * 0.12 +
					(hit.along / hit.length - 0.5) * stone.tiltU +
					(hit.across / hit.height - 0.5) * stone.tiltV -
					marks * 0.05;
				const pit =
					Math.max(
						0,
						-fbm(
							u,
							v,
							Math.round(tileU * 24),
							Math.round(tileV * 24),
							3,
							seed + 6,
						) - 0.4,
					) * 0.6;
				const rock =
					stone.rugged > 0
						? ridged(
								u,
								v,
								Math.round(tileU * 6),
								Math.round(tileV * 6),
								3,
								seed + 12,
							) * stone.rugged
						: 0;
				const surface = top - pit * 0.4 + rock * 0.14 - stone.rugged * 0.07;
				scaleTone(texel, 0.84 + 0.16 * smoothstep(0, 0.05, edge) + rock * 0.08);
				const mortarRelief =
					0.08 +
					fbm(
						u,
						v,
						Math.round(tileU * 30),
						Math.round(tileV * 30),
						2,
						seed + 7,
					) *
						0.05;
				texel.relief = lerp(mortarRelief, surface, profile);
				const worn = (options.worn ?? 0) * smoothstep(0.02, 0.12, edge);
				texel.rough = lerp(0.95, 0.82 - worn * 0.3 + pit * 0.2, profile);
				if (pit > 0) {
					scaleTone(texel, 1 - pit * 0.6);
				}
				if (profile < 1) {
					const mortarTone =
						0.85 +
						fbm(
							u,
							v,
							Math.round(tileU * 40),
							Math.round(tileV * 40),
							2,
							seed + 8,
						) *
							0.25;
					const crumb = speckled(u, v, tileU, tileV, seed);
					const r = mortar[0] * mortarTone * (1 - crumb * 0.3);
					const g = mortar[1] * mortarTone * (1 - crumb * 0.3);
					const b = mortar[2] * mortarTone * (1 - crumb * 0.3);
					texel.r = lerp(r, texel.r, profile);
					texel.g = lerp(g, texel.g, profile);
					texel.b = lerp(b, texel.b, profile);
					texel.ao = lerp(0.5, 1, profile);
				}
				const soot = grime(u, v, 3, seed + 9, 0.15);
				blendTone(texel, GRIME, soot * 0.35);
				const moss = options.moss ?? 0;
				if (moss > 0) {
					const growth =
						smoothstep(
							0.1,
							0.45,
							fbm(u, v, 4, 4, 5, seed + 10) + (1 - profile) * 0.45,
						) * moss;
					if (growth > 0) {
						const tuft =
							0.5 +
							fbm(
								u,
								v,
								Math.round(tileU * 60),
								Math.round(tileV * 60),
								2,
								seed + 11,
							) *
								0.5;
						blendTone(texel, tuft > 0.55 ? MOSS : MOSS_DEEP, growth * 0.85);
						texel.relief = Math.max(
							texel.relief,
							lerp(texel.relief, 0.5 + tuft * 0.45, growth),
						);
						texel.rough = lerp(texel.rough, 1, growth);
					}
				}
			});
		},
	};
}

function speckled(
	u: number,
	v: number,
	tileU: number,
	tileV: number,
	seed: number,
): number {
	const cellsU = Math.round(tileU * 160);
	const cellsV = Math.round(tileV * 160);
	return hash01(Math.floor(u * cellsU), Math.floor(v * cellsV), seed + 31) <
		0.18
		? 1
		: 0;
}

function brickWall(options: {
	base: number;
	mortar: number;
	moss: number;
	burnt: number;
}): FineRecipe {
	return {
		size: [512, 256],
		tile: [2, 1],
		depth: 0.018,
		parallax: true,
		paint: (field, rng) => {
			const layout = courseLayout(rng, 10, 7, {
				lengthSpread: 0.05,
				stagger: "half",
			});
			const base = tone(options.base);
			const palette = [
				base,
				mixTone(base, tone(0x9a5a34), 0.5),
				mixTone(base, tone(0x5a3324), 0.6),
				mixTone(base, tone(0x8a6a58), 0.35),
			];
			const burnt = mixTone(base, tone(0x2a1a17), 0.6);
			const bricks = Array.from({ length: layout.count }, () => ({
				color: rng.chance(options.burnt) ? burnt : rng.pick(palette),
				shade: 0.82 + rng.next() * 0.26,
				tilt: (rng.next() - 0.5) * 0.14,
				lift: rng.next() * 0.06,
			}));
			const mortar = tone(options.mortar);
			const hit = createBlockHit();
			const seed = field.seed;
			field.paint((u, v, texel) => {
				locateBlock(layout, u, v, hit);
				const brick = bricks[hit.id];
				const chip =
					perlin(u * 70, v * 35, 70, 35, seed + 2) * 0.004 +
					perlin(u * 260, v * 130, 260, 130, seed + 3) * 0.0016;
				const edge = Math.min(hit.edgeU * 2, hit.edgeV) + chip;
				const profile = joint(edge, 0.007, 0.007);
				const clay = fbm(u, v, 24, 12, 4, seed + 4);
				const sand = perlin(u * 400, v * 200, 400, 200, seed + 5);
				paintTone(
					texel,
					brick.color,
					brick.shade * (1 + clay * 0.16 + sand * 0.05),
				);
				const flash = smoothstep(
					0.2,
					0.6,
					perlin(u * 16, v * 8, 16, 8, seed + 6),
				);
				blendTone(texel, tone(0x2b1a14), flash * 0.22);
				const gray = (texel.r + texel.g + texel.b) / 3;
				texel.r = lerp(gray, texel.r, 0.82);
				texel.g = lerp(gray, texel.g, 0.82);
				texel.b = lerp(gray, texel.b, 0.82);
				const surface =
					0.8 +
					brick.lift +
					clay * 0.1 +
					sand * 0.03 +
					(hit.along / hit.length - 0.5) * brick.tilt;
				const pore = Math.max(
					0,
					-perlin(u * 300, v * 150, 300, 150, seed + 7) - 0.5,
				);
				texel.relief = lerp(0.14 + sand * 0.04, surface - pore * 0.5, profile);
				texel.rough = lerp(0.97, 0.86 + pore * 0.2, profile);
				scaleTone(texel, 0.86 + 0.14 * smoothstep(0, 0.02, edge));
				if (profile < 1) {
					const grit =
						0.8 + perlin(u * 500, v * 250, 500, 250, seed + 8) * 0.25;
					const mix = 1 - profile;
					texel.r = lerp(texel.r, mortar[0] * grit, mix);
					texel.g = lerp(texel.g, mortar[1] * grit, mix);
					texel.b = lerp(texel.b, mortar[2] * grit, mix);
					texel.ao = lerp(0.55, 1, profile);
				}
				const efflorescence =
					smoothstep(0.35, 0.7, fbm(u, v, 6, 3, 4, seed + 9)) *
					(1 - profile * 0.6);
				blendTone(texel, tone(0xb9b2a2), efflorescence * 0.3);
				if (options.moss > 0) {
					const growth =
						smoothstep(
							0.05,
							0.4,
							fbm(u, v, 5, 3, 5, seed + 10) + (1 - profile) * 0.35,
						) * options.moss;
					const tuft = 0.5 + fbm(u, v, 120, 60, 2, seed + 11) * 0.5;
					blendTone(texel, tuft > 0.5 ? MOSS : MOSS_DEEP, growth * 0.9);
					texel.relief = lerp(
						texel.relief,
						Math.max(texel.relief, 0.55 + tuft * 0.4),
						growth,
					);
					texel.rough = lerp(texel.rough, 1, growth);
					const drip =
						smoothstep(
							0.9,
							0.99,
							1 - Math.abs(perlin(u * 40, v * 2, 40, 2, seed + 12)),
						) * smoothstep(0.25, 0.6, fbm(u, v, 8, 2, 3, seed + 13));
					blendTone(texel, tone(0x1f1d18), drip * 0.3);
				}
			});
		},
	};
}

function cellStones(options: {
	base: number;
	mortar: number;
	cellsU: number;
	cellsV: number;
	jitter: number;
	gap: number;
	dome: number;
	depth: number;
	polish: number;
	moss: number;
}): FineRecipe {
	return {
		size: [512, 512],
		tile: [2, 2],
		depth: options.depth,
		parallax: true,
		paint: (field) => {
			const base = tone(options.base);
			const mortar = tone(options.mortar);
			const dark = mixTone(base, tone(0x161411), 0.5);
			const light = mixTone(base, tone(0xece6d8), 0.35);
			const sample = createVoronoiSample();
			const seed = field.seed;
			const { cellsU, cellsV } = options;
			field.paint((u, v, texel) => {
				const warpU = fbm(u, v, 8, 8, 3, seed + 1) * 0.18;
				const warpV = fbm(u, v, 8, 8, 3, seed + 2) * 0.18;
				voronoi(
					u * cellsU + warpU,
					v * cellsV + warpV,
					cellsU,
					cellsV,
					seed,
					options.jitter,
					sample,
				);
				const meters = (sample.edge / Math.max(cellsU, cellsV)) * 2;
				const chip =
					perlin(u * 90, v * 90, 90, 90, seed + 3) * options.gap * 0.6;
				const profile = smoothstep(
					options.gap,
					options.gap + options.dome,
					meters + chip,
				);
				const shade = 0.78 + hash01(sample.id, 1, seed) * 0.4;
				const hue = (hash01(sample.id, 2, seed) - 0.5) * 0.08;
				const grain = stoneGrain(
					texel,
					u,
					v,
					6,
					6,
					seed + 4,
					base,
					dark,
					light,
				);
				scaleTone(texel, shade);
				texel.r += hue;
				texel.b -= hue * 0.5;
				const radial =
					sample.distance / Math.max(1e-4, sample.distance + sample.edge);
				const rounded = Math.sqrt(Math.max(0, 1 - radial * radial));
				texel.relief = lerp(
					0.06 + grain * 0.04,
					0.42 + rounded * 0.5 + grain * 0.06,
					profile,
				);
				texel.rough = lerp(0.97, 0.78 - options.polish * rounded, profile);
				if (profile < 1) {
					const grit =
						0.75 + perlin(u * 400, v * 400, 400, 400, seed + 5) * 0.3;
					const mix = 1 - profile;
					texel.r = lerp(texel.r, mortar[0] * grit, mix);
					texel.g = lerp(texel.g, mortar[1] * grit, mix);
					texel.b = lerp(texel.b, mortar[2] * grit, mix);
					texel.ao = lerp(0.45, 1, profile);
				}
				if (options.moss > 0) {
					const growth =
						smoothstep(
							0.55,
							0.95,
							1 - profile + fbm(u, v, 5, 5, 4, seed + 6) * 0.6,
						) * options.moss;
					blendTone(
						texel,
						perlin(u * 300, v * 300, 300, 300, seed + 7) > 0 ? MOSS : MOSS_DEEP,
						growth,
					);
					texel.relief = lerp(
						texel.relief,
						Math.max(texel.relief, 0.3),
						growth,
					);
					texel.rough = lerp(texel.rough, 1, growth);
				}
				blendTone(texel, GRIME, grime(u, v, 3, seed + 8, 0.2) * 0.3);
			});
			field.smoothRelief(0.006);
		},
	};
}

function glazedTiles(options: {
	first: number;
	second: number;
	columns: number;
	tile: number;
	gap: number;
	glaze: number;
	crackle: number;
	marble: boolean;
}): FineRecipe {
	return {
		size: [512, 512],
		tile: [options.tile, options.tile],
		depth: 0.004,
		parallax: true,
		paint: (field) => {
			const first = tone(options.first);
			const second = tone(options.second);
			const grout = tone(0x6f685c);
			const hit: GridHit = { column: 0, row: 0, localU: 0, localV: 0, edge: 0 };
			const sample = createVoronoiSample();
			const seed = field.seed;
			const cells = options.columns;
			field.paint((u, v, texel) => {
				gridCell(u, v, cells, cells, hit);
				const parity = (hit.column + hit.row) % 2 === 0;
				const color = parity ? first : second;
				const id = hit.row * cells + hit.column;
				const meters = hit.edge * options.tile;
				const profile = joint(meters, options.gap, options.gap * 1.4);
				const shade = 0.94 + hash01(id, 1, seed) * 0.1;
				paintTone(texel, color, shade);
				if (options.marble) {
					const vein = veins(
						u + hash01(id, 12, seed),
						v + hash01(id, 13, seed),
						cells,
						seed + (parity ? 3 : 5),
						18,
					);
					const cloud = fbm(u, v, cells * 2, cells * 2, 4, seed + 4) * 0.08;
					scaleTone(texel, 1 + cloud);
					blendTone(
						texel,
						parity
							? mixTone(first, tone(0x5c574e), 0.6)
							: mixTone(second, tone(0xd8d2c4), 0.55),
						vein * 0.75,
					);
				} else {
					const pool = fbm(u, v, cells * 3, cells * 3, 3, seed + 6);
					scaleTone(texel, 1 + pool * 0.06);
				}
				const pillow = Math.min(
					hit.localU,
					1 - hit.localU,
					hit.localV,
					1 - hit.localV,
				);
				const crown = smoothstep(0, 0.18, pillow);
				const tiltU = (hash01(id, 7, seed) - 0.5) * 0.08;
				const tiltV = (hash01(id, 8, seed) - 0.5) * 0.08;
				let crackle = 0;
				if (options.crackle > 0) {
					voronoi(
						u * cells * 5,
						v * cells * 5,
						cells * 5,
						cells * 5,
						seed + 9,
						0.9,
						sample,
					);
					crackle = (1 - smoothstep(0, 0.035, sample.edge)) * options.crackle;
				}
				texel.relief = lerp(
					0.1,
					0.84 +
						crown * 0.1 +
						(hit.localU - 0.5) * tiltU +
						(hit.localV - 0.5) * tiltV -
						crackle * 0.03,
					profile,
				);
				texel.rough = lerp(0.95, options.glaze + crackle * 0.25, profile);
				blendTone(texel, tone(0x3a352d), crackle * 0.35);
				if (profile < 1) {
					const grit =
						0.8 + perlin(u * 600, v * 600, 600, 600, seed + 10) * 0.25;
					const mix = 1 - profile;
					texel.r = lerp(texel.r, grout[0] * grit, mix);
					texel.g = lerp(texel.g, grout[1] * grit, mix);
					texel.b = lerp(texel.b, grout[2] * grit, mix);
					texel.ao = lerp(0.6, 1, profile);
				}
				const dirt = grime(u, v, 2, seed + 11, 0.25);
				blendTone(texel, GRIME, dirt * 0.25);
				texel.rough = lerp(texel.rough, 0.7, dirt * 0.4);
			});
		},
	};
}

function mosaic(): FineRecipe {
	const palette = [0x2f6f78, 0xd8cdb4, 0x8a3b2c, 0x1d4a52].map(tone);
	return {
		size: [512, 512],
		tile: [1, 1],
		depth: 0.004,
		parallax: true,
		paint: (field) => {
			const hit: GridHit = { column: 0, row: 0, localU: 0, localV: 0, edge: 0 };
			const seed = field.seed;
			field.paint((u, v, texel) => {
				gridCell(u, v, 16, 16, hit);
				const id = hit.row * 16 + hit.column;
				const ring = Math.max(
					Math.abs(hit.column - 7.5),
					Math.abs(hit.row - 7.5),
				);
				const color = palette[Math.floor(ring) % palette.length];
				const inset = 0.08 + hash01(id, 1, seed) * 0.08;
				const skewU = (hash01(id, 2, seed) - 0.5) * 0.06;
				const skewV = (hash01(id, 3, seed) - 0.5) * 0.06;
				const localU = hit.localU + (hit.localV - 0.5) * skewU;
				const localV = hit.localV + (hit.localU - 0.5) * skewV;
				const inside = Math.min(localU, 1 - localU, localV, 1 - localV);
				const profile = smoothstep(inset * 0.5, inset * 0.5 + 0.12, inside);
				paintTone(texel, color, 0.88 + hash01(id, 4, seed) * 0.22);
				scaleTone(
					texel,
					1 + perlin(u * 160, v * 160, 160, 160, seed + 5) * 0.05,
				);
				texel.relief = lerp(0.12, 0.82 + hash01(id, 6, seed) * 0.12, profile);
				texel.rough = lerp(0.96, 0.32 + hash01(id, 7, seed) * 0.2, profile);
				if (profile < 1) {
					const mix = 1 - profile;
					blendTone(texel, tone(0x8a8070), mix);
					texel.ao = lerp(0.55, 1, profile);
				}
				blendTone(texel, GRIME, grime(u, v, 2, seed + 8, 0.25) * 0.3);
			});
		},
	};
}

function terracottaFloor(): FineRecipe {
	return {
		size: [512, 512],
		tile: [2, 2],
		depth: 0.01,
		parallax: true,
		paint: (field) => {
			const clay = tone(0x9c5a3c);
			const hit: GridHit = { column: 0, row: 0, localU: 0, localV: 0, edge: 0 };
			const seed = field.seed;
			field.paint((u, v, texel) => {
				gridCell(u, v, 4, 4, hit);
				const id = hit.row * 4 + hit.column;
				const chip = perlin(u * 80, v * 80, 80, 80, seed + 1) * 0.004;
				const profile = joint(hit.edge * 2 + chip, 0.006, 0.01);
				const body = fbm(u, v, 12, 12, 4, seed + 2);
				paintTone(texel, clay, 0.84 + hash01(id, 1, seed) * 0.26 + body * 0.12);
				const pore = Math.max(
					0,
					-perlin(u * 260, v * 260, 260, 260, seed + 3) - 0.45,
				);
				texel.relief = lerp(0.1, 0.82 + body * 0.08 - pore * 0.4, profile);
				texel.rough = lerp(0.98, 0.86, profile);
				const growth = smoothstep(
					0.4,
					0.95,
					1 - profile + fbm(u, v, 6, 6, 4, seed + 4) * 0.7,
				);
				blendTone(texel, growth > 0.5 ? MOSS : MOSS_DEEP, growth * 0.9);
				if (profile < 1) {
					blendTone(texel, tone(0x4b4538), (1 - profile) * (1 - growth));
					texel.ao = lerp(0.5, 1, profile);
				}
				blendTone(texel, tone(0x6b6b4c), grime(u, v, 4, seed + 5, 0.15) * 0.3);
			});
		},
	};
}

function plasterWall(
	base: number,
	stain: number,
	cracks: number,
	seedShift: number,
): FineRecipe {
	return {
		size: [512, 512],
		tile: [2, 2],
		depth: 0.0035,
		parallax: false,
		paint: (field) => {
			const color = tone(base);
			const water = tone(stain);
			const sample = createVoronoiSample();
			const seed = field.seed + seedShift;
			field.paint((u, v, texel) => {
				const trowel = fbm(u, v, 5, 5, 5, seed + 1);
				const grain = perlin(u * 300, v * 300, 300, 300, seed + 2);
				paintTone(texel, color, 1 + trowel * 0.07 + grain * 0.025);
				texel.relief = 0.6 + trowel * 0.25 + grain * 0.04;
				texel.rough = 0.92 - Math.max(0, trowel) * 0.1;
				const damp = smoothstep(0.1, 0.55, fbm(u, v, 3, 3, 5, seed + 3));
				blendTone(texel, water, damp * 0.45);
				const ring = smoothstep(
					0.02,
					0.0,
					Math.abs(fbm(u, v, 3, 3, 5, seed + 3) - 0.1),
				);
				blendTone(texel, mixTone(water, tone(0x2a2218), 0.4), ring * 0.15);
				if (cracks > 0) {
					const warp = fbm(u, v, 6, 6, 3, seed + 4) * 0.5;
					voronoi(u * 4 + warp, v * 4 - warp, 4, 4, seed + 5, 1, sample);
					const line = 1 - smoothstep(0.0, 0.012, sample.edge);
					const mask =
						smoothstep(0.25, 0.5, fbm(u, v, 3, 3, 3, seed + 6)) * cracks;
					const crack = line * mask;
					texel.relief -= crack * 0.45;
					blendTone(texel, tone(0x241e17), crack * 0.8);
					texel.ao = 1 - crack * 0.5;
					const flake =
						smoothstep(0.6, 0.85, fbm(u, v, 8, 8, 4, seed + 7)) * mask;
					if (flake > 0) {
						texel.relief -= flake * 0.25;
						blendTone(texel, tone(0x6a5c4a), flake * 0.6);
						texel.rough = 0.98;
					}
				}
			});
		},
	};
}

function verticalBoards(): FineRecipe {
	return {
		size: [256, 256],
		tile: [1, 1],
		depth: 0.006,
		parallax: true,
		paint: (field) => {
			const look: WoodLook = {
				base: tone(0x5c3a22),
				late: tone(0x2e1a0e),
				ringsPerMeter: 40,
				figure: 0.9,
				varnish: 0.48,
			};
			const seed = field.seed;
			field.paint((u, v, texel) => {
				const column = Math.floor(u * 4);
				const local = u * 4 - column;
				woodFibers(
					texel,
					v + column * 2.9,
					local * 0.25 + column * 0.53,
					seed + column * 7,
					look,
				);
				scaleTone(texel, 0.86 + hash01(column, 1, seed) * 0.24);
				const grain = texel.relief;
				const groove = Math.min(local, 1 - local) * 0.25;
				const profile = smoothstep(0.001, 0.007, groove);
				texel.relief = (0.82 + (grain - 0.72) * 0.5) * (0.25 + profile * 0.75);
				if (profile < 1) {
					scaleTone(texel, 0.55 + profile * 0.45);
					texel.ao = lerp(0.6, 1, profile);
				}
				const wear = grime(u, v, 2, seed + 4, 0.2);
				texel.rough = lerp(texel.rough, 0.75, wear * 0.5);
			});
		},
	};
}

function raisedPanel(): FineRecipe {
	return {
		size: [256, 256],
		tile: [1, 1],
		depth: 0.018,
		parallax: true,
		paint: (field) => {
			const look: WoodLook = {
				base: tone(0x4b2f1c),
				late: tone(0x24140a),
				ringsPerMeter: 36,
				figure: 1,
				varnish: 0.42,
			};
			const seed = field.seed;
			field.paint((u, v, texel) => {
				const rail = v < 0.12 || v > 0.9;
				const stile = u < 0.08 || u > 0.92;
				const vertical = stile && !rail;
				woodFibers(
					texel,
					vertical ? v : u,
					vertical ? u * 0.3 : v * 0.3,
					seed + (vertical ? 3 : 7),
					look,
				);
				const grain = texel.relief;
				const inU = Math.min(u - 0.08, 0.92 - u);
				const inV = Math.min(v - 0.12, 0.9 - v);
				const inner = Math.min(inU, inV);
				let height: number;
				if (inner < 0) {
					const capTop =
						v > 0.9
							? smoothstep(0.9, 0.93, v) * (1 - smoothstep(0.97, 1, v))
							: 0;
					height = 0.72 + capTop * 0.22;
				} else if (inner < 0.012) {
					height = 0.72 - smoothstep(0, 0.012, inner) * 0.36;
				} else if (inner < 0.07) {
					height = 0.36 + smoothstep(0.012, 0.07, inner) * 0.5;
				} else {
					height = 0.86 + perlin(u * 3, v * 3, 3, 3, seed) * 0.02;
				}
				texel.relief = height + (grain - 0.72) * 0.08;
				if (inner >= 0 && inner < 0.016) {
					scaleTone(texel, 0.62);
					texel.ao = 0.6;
				}
				const seam = Math.min(Math.abs(u - 0.08), Math.abs(u - 0.92));
				if (inner < 0 && !vertical && seam < 0.003) {
					scaleTone(texel, 0.6);
					texel.relief -= 0.05;
				}
				blendTone(texel, GRIME, grime(u, v, 2, seed + 4, 0.25) * 0.25);
			});
		},
	};
}

function coffers(): FineRecipe {
	return {
		size: [256, 256],
		tile: [1.5, 1.5],
		depth: 0.07,
		parallax: true,
		paint: (field) => {
			const look: WoodLook = {
				base: tone(0x5a4632),
				late: tone(0x2a1d10),
				ringsPerMeter: 30,
				figure: 0.8,
				varnish: 0.6,
			};
			const seed = field.seed;
			field.paint((u, v, texel) => {
				const ring = Math.min(u, 1 - u, v, 1 - v);
				const vertical = Math.min(u, 1 - u) < Math.min(v, 1 - v);
				woodFibers(
					texel,
					vertical ? v * 1.5 : u * 1.5,
					vertical ? u * 0.4 : v * 0.4,
					seed + (vertical ? 1 : 2),
					look,
				);
				const grain = texel.relief;
				let height: number;
				if (ring < 0.07) {
					height = 1;
				} else if (ring < 0.1) {
					height = 1 - smoothstep(0.07, 0.1, ring) * 0.35;
				} else if (ring < 0.16) {
					height = 0.65;
				} else if (ring < 0.2) {
					height = 0.65 - smoothstep(0.16, 0.2, ring) * 0.4;
				} else if (ring < 0.24) {
					height = 0.25;
				} else if (ring < 0.27) {
					height = 0.25 - smoothstep(0.24, 0.27, ring) * 0.2;
				} else {
					height = 0.05;
				}
				texel.relief = height + (grain - 0.72) * 0.03;
				const depthShade = 0.6 + height * 0.4;
				scaleTone(texel, depthShade);
				texel.ao = 0.55 + height * 0.45;
				if (ring > 0.27) {
					const rosette = Math.hypot(u - 0.5, v - 0.5);
					if (rosette < 0.07) {
						const petals =
							Math.cos(Math.atan2(v - 0.5, u - 0.5) * 8) * 0.5 + 0.5;
						texel.relief =
							0.05 + (1 - rosette / 0.07) * 0.45 * (0.6 + petals * 0.4);
						paintTone(texel, tone(0xb08a3c), 0.7 + petals * 0.3);
						texel.metal = 0.7;
						texel.rough = 0.45;
					}
				}
			});
		},
	};
}

export const FINE_ARCHITECTURE: Record<string, FineRecipe> = {
	oakPlanks: plankFloor(0x8a5a32, 0x4a2a14, 0.5),
	darkPlanks: plankFloor(0x4d3221, 0x22140a, 0.56),
	parquet: herringboneParquet(),
	stoneFlags: masonry({
		base: 0x726c63,
		mortar: 0x3a3630,
		rows: 4,
		blocks: 3,
		tile: [2, 2],
		size: [512, 512],
		depth: 0.022,
		gap: 0.006,
		bevel: 0.016,
		rowSpread: 0.2,
		lengthSpread: 0.3,
		stagger: "random",
		worn: 1,
	}),
	cobble: cellStones({
		base: 0x5f5a53,
		mortar: 0x2e2a25,
		cellsU: 9,
		cellsV: 9,
		jitter: 0.85,
		gap: 0.008,
		dome: 0.07,
		depth: 0.04,
		polish: 0.3,
		moss: 0.25,
	}),
	checkerTiles: glazedTiles({
		first: 0xddd5c2,
		second: 0x23211f,
		columns: 4,
		tile: 2,
		gap: 0.0015,
		glaze: 0.16,
		crackle: 0,
		marble: true,
	}),
	tiles: glazedTiles({
		first: 0xc8d6cf,
		second: 0xb4c6be,
		columns: 4,
		tile: 1,
		gap: 0.0018,
		glaze: 0.12,
		crackle: 0.6,
		marble: false,
	}),
	mosaic: mosaic(),
	greenhouseTiles: terracottaFloor(),
	stoneBlocks: masonry({
		base: 0x66605a,
		mortar: 0x3c3934,
		rows: 6,
		blocks: 3,
		tile: [2, 2],
		size: [512, 512],
		depth: 0.024,
		gap: 0.005,
		bevel: 0.02,
		rowSpread: 0.15,
		lengthSpread: 0.25,
		tooling: 1,
	}),
	vaultStone: masonry({
		base: 0x5a5650,
		mortar: 0x34312c,
		rows: 8,
		blocks: 4,
		tile: [2, 2],
		size: [512, 512],
		depth: 0.018,
		gap: 0.004,
		bevel: 0.012,
		lengthSpread: 0.15,
		tooling: 0.6,
	}),
	rubbleStone: cellStones({
		base: 0x6a645a,
		mortar: 0x37332d,
		cellsU: 5,
		cellsV: 8,
		jitter: 0.95,
		gap: 0.012,
		dome: 0.1,
		depth: 0.045,
		polish: 0.05,
		moss: 0.15,
	}),
	brick: brickWall({ base: 0x7a3b2b, mortar: 0x6a6258, moss: 0, burnt: 0.12 }),
	mossyBrick: brickWall({
		base: 0x6a4434,
		mortar: 0x45403a,
		moss: 0.9,
		burnt: 0.2,
	}),
	greenhouseBrick: brickWall({
		base: 0x8c4a33,
		mortar: 0x6a6358,
		moss: 0.45,
		burnt: 0.06,
	}),
	plaster: plasterWall(0x8d8576, 0x5d5444, 1, 0),
	ceilingPlaster: plasterWall(0x6f6a60, 0x4a4234, 0.7, 9),
	woodPanels: verticalBoards(),
	wainscot: raisedPanel(),
	coffer: coffers(),
};
