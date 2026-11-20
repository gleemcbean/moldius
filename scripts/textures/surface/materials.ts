import {
	grime,
	periodicWood,
	speckle,
	stoneGrain,
	veins,
	type WoodLook,
} from "./motifs";
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

function cells(tile: number, perMeter: number): number {
	return Math.max(1, Math.round(tile * perMeter));
}

function furnitureWood(
	base: number,
	late: number,
	varnish: number,
	figure = 1,
): FineRecipe {
	return {
		size: [256, 256],
		tile: [0.5, 0.5],
		depth: 0.0012,
		parallax: false,
		paint: (field) => {
			const look: WoodLook = {
				base: tone(base),
				late: tone(late),
				ringsPerMeter: 44,
				figure,
				varnish,
			};

			const seed = field.seed;

			field.paint((u, v, texel) => {
				periodicWood(texel, u, v, 0.5, 0.5, seed, look);

				const rub = grime(u, v, 2, seed + 30, 0.2);

				texel.rough = lerp(
					texel.rough,
					Math.min(0.85, texel.rough + 0.25),
					rub * 0.6,
				);

				scaleTone(texel, 1 - rub * 0.06);
			});
		},
	};
}

function paintedWood(paint: number, wood: number): FineRecipe {
	return {
		size: [256, 256],
		tile: [0.5, 0.5],
		depth: 0.0018,
		parallax: false,
		paint: (field) => {
			const coat = tone(paint);

			const look: WoodLook = {
				base: tone(wood),
				late: tone(0x3a2414),
				ringsPerMeter: 44,
				figure: 0.8,
				varnish: 0.8,
			};

			const seed = field.seed;

			field.paint((u, v, texel) => {
				periodicWood(texel, u, v, 0.5, 0.5, seed, look);

				const grain = texel.relief;
				const chips = smoothstep(0.38, 0.46, fbm(u, v, 4, 4, 5, seed + 3));
				const brush = perlin(u * 3, v * 140, 3, 140, seed + 4) * 0.05;

				if (chips < 1) {
					const keep = 1 - chips;
					const r = coat[0] * (1 + brush);
					const g = coat[1] * (1 + brush);
					const b = coat[2] * (1 + brush);

					texel.r = lerp(texel.r, r, keep);
					texel.g = lerp(texel.g, g, keep);
					texel.b = lerp(texel.b, b, keep);
					texel.relief = lerp(grain * 0.6, 0.85 + brush, keep);
					texel.rough = lerp(texel.rough, 0.62 - brush, keep);
				} else {
					texel.relief = grain * 0.6;
				}

				blendTone(texel, tone(0x22201c), grime(u, v, 3, seed + 5, 0.25) * 0.3);
			});
		},
	};
}

function blackIron(base: number, rust: number): FineRecipe {
	return {
		size: [256, 256],
		tile: [0.5, 0.5],
		depth: 0.0025,
		parallax: false,
		metallic: true,
		paint: (field) => {
			const metal = tone(base);
			const bright = mixTone(metal, tone(0xb8bcc0), 0.55);
			const oxide = tone(0x6b3a1e);
			const oxideDark = tone(0x3a2014);
			const sample = createVoronoiSample();
			const seed = field.seed;

			field.paint((u, v, texel) => {
				voronoi(u * 7, v * 7, 7, 7, seed + 1, 0.9, sample);

				const dent = sample.distance * sample.distance;
				const scale = fbm(u, v, 6, 6, 4, seed + 2);
				const rubbed = smoothstep(0.15, 0.5, scale);

				paintTone(texel, metal, 0.9 + scale * 0.2);
				blendTone(texel, bright, rubbed * 0.5);

				texel.metal = 0.55 + rubbed * 0.45;

				texel.rough =
					0.62 -
					rubbed * 0.24 +
					perlin(u * 90, v * 90, 45, 45, seed + 3) * 0.05;

				texel.relief = 0.55 + dent * 0.3 + scale * 0.1;

				const corrosion = smoothstep(
					0.5 - rust * 0.06,
					0.75 - rust * 0.05,
					fbm(u, v, 5, 5, 5, seed + 4) +
						(1 - smoothstep(0, 0.4, sample.edge)) * 0.15,
				);

				if (corrosion > 0) {
					const flake = perlin(u * 160, v * 160, 80, 80, seed + 5);

					blendTone(texel, flake > 0 ? oxide : oxideDark, corrosion);

					texel.metal = lerp(texel.metal, 0.05, corrosion);
					texel.rough = lerp(texel.rough, 0.95, corrosion);
					texel.relief = lerp(texel.relief, 0.6 + flake * 0.25, corrosion);
				}
			});
		},
	};
}

function polishedAlloy(options: {
	base: number;
	tarnish: number;
	patina: number;
	patinaAmount: number;
	roughness: number;
}): FineRecipe {
	return {
		size: [256, 256],
		tile: [0.5, 0.5],
		depth: 0.0012,
		parallax: false,
		metallic: true,
		paint: (field) => {
			const metal = tone(options.base);
			const tarnish = tone(options.tarnish);
			const patina = tone(options.patina);
			const sample = createVoronoiSample();
			const seed = field.seed;

			field.paint((u, v, texel) => {
				const brushed = perlin(u * 4, v * 360, 4, 360, seed + 1);

				const hammer = voronoi(
					u * 9,
					v * 9,
					9,
					9,
					seed + 2,
					0.85,
					sample,
				).distance;

				const age = fbm(u, v, 6, 6, 4, seed + 3);
				const dull = smoothstep(0.0, 0.7, age);

				paintTone(texel, metal, 0.94 + brushed * 0.05 + age * 0.04);
				blendTone(texel, tarnish, dull * 0.28);

				texel.metal = 1;

				texel.rough =
					options.roughness + dull * 0.07 + Math.abs(brushed) * 0.05;

				texel.relief = 0.6 - hammer * hammer * 0.12 + brushed * 0.03;

				const green =
					smoothstep(0.42, 0.62, fbm(u, v, 6, 6, 4, seed + 4)) *
					options.patinaAmount;

				if (green > 0) {
					const crust =
						0.8 + perlin(u * 200, v * 200, 100, 100, seed + 5) * 0.3;

					blendTone(texel, patina, green * crust);

					texel.metal = lerp(1, 0.1, green);
					texel.rough = lerp(texel.rough, 0.9, green);
					texel.relief += green * 0.15;
				}
			});
		},
	};
}

function pipeSteel(): FineRecipe {
	return {
		size: [256, 256],
		tile: [0.5, 0.5],
		depth: 0.002,
		parallax: false,
		metallic: true,
		paint: (field) => {
			const paint = tone(0x4f5452);
			const oxide = tone(0x6e3c1c);
			const seed = field.seed;

			field.paint((u, v, texel) => {
				const coat = fbm(u, v, 3, 3, 4, seed);

				paintTone(texel, paint, 0.92 + coat * 0.16);

				texel.metal = 0.35;
				texel.rough = 0.58 + coat * 0.1;
				texel.relief = 0.7 + coat * 0.08;

				const streak =
					smoothstep(
						0.55,
						0.9,
						1 - Math.abs(perlin(u * 24, v * 1, 24, 1, seed + 1)),
					) * smoothstep(0.1, 0.6, fbm(u, v, 3, 3, 3, seed + 2));

				blendTone(texel, oxide, streak * 0.55);

				texel.rough = lerp(texel.rough, 0.9, streak);

				const blister = smoothstep(0.45, 0.65, fbm(u, v, 7, 7, 4, seed + 3));

				if (blister > 0) {
					blendTone(texel, oxide, blister);

					texel.metal = lerp(texel.metal, 0.05, blister);
					texel.rough = lerp(texel.rough, 0.97, blister);

					texel.relief +=
						blister * 0.2 * (0.5 + perlin(u * 120, v * 120, 60, 60, seed + 4));
				}
			});
		},
	};
}

function pebbledLeather(): FineRecipe {
	return {
		size: [256, 256],
		tile: [0.5, 0.5],
		depth: 0.0016,
		parallax: false,
		paint: (field) => {
			const hide = tone(0x4a2a1a);
			const sample = createVoronoiSample();
			const seed = field.seed;

			field.paint((u, v, texel) => {
				voronoi(u * 64, v * 64, 64, 64, seed, 0.9, sample);

				const bump = smoothstep(0, 0.32, sample.edge);
				const crease = ridged(u, v, 3, 3, 4, seed + 1);
				const fold = smoothstep(0.82, 0.97, crease);
				const tone2 = fbm(u, v, 3, 3, 5, seed + 2);

				paintTone(texel, hide, 0.88 + tone2 * 0.24 + bump * 0.06);

				texel.relief = 0.45 + bump * 0.35 - fold * 0.3;
				texel.rough = 0.62 - bump * 0.1 + fold * 0.2;

				scaleTone(texel, 1 - fold * 0.25);

				const scuff = grime(u, v, 3, seed + 3, 0.35);

				blendTone(texel, tone(0x7a5a40), scuff * 0.3);

				texel.rough = lerp(texel.rough, 0.85, scuff * 0.5);
			});
		},
	};
}

function honedStone(options: {
	base: number;
	dark: number;
	light: number;
	tile: number;
	size: number;
	roughness: number;
	pits: number;
	sparkle?: number;
}): FineRecipe {
	return {
		size: [options.size, options.size],
		tile: [options.tile, options.tile],
		depth: 0.0018,
		parallax: false,
		paint: (field) => {
			const base = tone(options.base);
			const dark = tone(options.dark);
			const light = tone(options.light);
			const seed = field.seed;
			const broad = cells(options.tile, 4);
			const pitCells = cells(options.tile, 90);

			field.paint((u, v, texel) => {
				const grain = stoneGrain(
					texel,
					u,
					v,
					broad,
					broad,
					seed,
					base,
					dark,
					light,
				);

				const pit =
					Math.max(
						0,
						-perlin(u * pitCells, v * pitCells, pitCells, pitCells, seed + 3) -
							0.55,
					) * options.pits;

				texel.relief = 0.7 + grain * 0.1 - pit * 0.6;
				texel.rough = options.roughness + pit * 0.3;

				scaleTone(texel, 1 - pit * 0.5);

				if (options.sparkle) {
					const mica = speckle(
						u,
						v,
						pitCells * 3,
						pitCells * 3,
						seed + 4,
						options.sparkle,
					);

					texel.metal = mica * 0.6;
					texel.rough = lerp(texel.rough, 0.25, mica);
				}
			});
		},
	};
}

function polishedMarble(options: {
	base: number;
	vein: number;
	strength: number;
	sharpness: number;
	cloud: number;
}): FineRecipe {
	return {
		size: [512, 512],
		tile: [1, 1],
		depth: 0.0008,
		parallax: false,
		paint: (field) => {
			const base = tone(options.base);
			const vein = tone(options.vein);
			const seed = field.seed;

			field.paint((u, v, texel) => {
				const cloud = fbm(u, v, 3, 3, 5, seed);

				paintTone(texel, base, 1 + cloud * options.cloud);

				const main = veins(u, v, 2, seed + 1, options.sharpness);
				const thin = veins(u, v, 5, seed + 2, options.sharpness * 3);

				blendTone(
					texel,
					vein,
					main * options.strength + thin * options.strength * 0.5,
				);

				texel.rough = 0.14 + Math.abs(cloud) * 0.06 + thin * 0.05;
				texel.relief = 0.7 - main * 0.08;

				const etch = grime(u, v, 3, seed + 3, 0.35);

				texel.rough = lerp(texel.rough, 0.45, etch * 0.6);
			});
		},
	};
}

function beddedRock(base: number, band: number, roughness: number): FineRecipe {
	return {
		size: [256, 256],
		tile: [1, 1],
		depth: 0.004,
		parallax: false,
		paint: (field) => {
			const color = tone(base);
			const layer = tone(band);
			const seed = field.seed;

			field.paint((u, v, texel) => {
				const strata = fbm(u, v, 2, 16, 4, seed);
				const thin = fbm(u, v, 3, 48, 2, seed + 5);
				const fine = perlin(u * 12, v * 140, 12, 140, seed + 1);

				paintTone(texel, color, 0.92 + strata * 0.2 + fine * 0.05);

				blendTone(
					texel,
					layer,
					smoothstep(0.05, 0.35, strata) * 0.55 +
						smoothstep(0.3, 0.5, thin) * 0.25,
				);

				const flake = smoothstep(0.4, 0.7, fbm(u, v, 6, 6, 4, seed + 2));

				texel.relief =
					0.6 + strata * 0.18 + thin * 0.05 + fine * 0.05 + flake * 0.15;

				texel.rough = roughness + flake * 0.08;

				scaleTone(texel, 1 + flake * 0.05);
			});
		},
	};
}

function terracottaClay(): FineRecipe {
	return {
		size: [192, 128],
		tile: [0.6, 0.4],
		depth: 0.0015,
		parallax: false,
		paint: (field) => {
			const clay = tone(0xa8603c);
			const seed = field.seed;

			field.paint((u, v, texel) => {
				const throwing =
					Math.sin(
						v * Math.PI * 2 * 6 + perlin(u * 3, v * 2, 3, 2, seed) * 0.6,
					) * 0.5;

				const body = fbm(u, v, 3, 2, 4, seed + 1);

				paintTone(texel, clay, 0.92 + body * 0.14 + throwing * 0.04);

				const pore = speckle(u, v, 180, 120, seed + 2, 0.05);
				const grog = speckle(u, v, 120, 80, seed + 3, 0.03);

				blendTone(texel, tone(0x6a3820), pore * 0.6);
				blendTone(texel, tone(0xd89a70), grog * 0.5);

				texel.relief = 0.65 + throwing * 0.1 + body * 0.05 - pore * 0.3;
				texel.rough = 0.88;

				blendTone(texel, tone(0xd8d0bc), grime(u, v, 2, seed + 4, 0.35) * 0.35);
			});
		},
	};
}

function glazedCeramic(): FineRecipe {
	return {
		size: [256, 256],
		tile: [0.5, 0.5],
		depth: 0.0005,
		parallax: false,
		paint: (field) => {
			const glaze = tone(0xe6e1d3);
			const sample = createVoronoiSample();
			const seed = field.seed;

			field.paint((u, v, texel) => {
				const pool = fbm(u, v, 3, 3, 4, seed);

				paintTone(texel, glaze, 0.97 + pool * 0.05);
				voronoi(u * 14, v * 14, 14, 14, seed + 1, 1, sample);

				const craze = 1 - smoothstep(0, 0.03, sample.edge);

				blendTone(texel, tone(0x9a9282), craze * 0.5);

				texel.relief = 0.8 + pool * 0.04 - craze * 0.2;
				texel.rough = 0.1 + craze * 0.2;

				blendTone(texel, tone(0xb9b3a3), grime(u, v, 2, seed + 2, 0.4) * 0.4);
			});
		},
	};
}

function candleWax(): FineRecipe {
	return {
		size: [128, 128],
		tile: [0.2, 0.2],
		depth: 0.0012,
		parallax: false,
		paint: (field) => {
			const wax = tone(0xe9dcb8);
			const seed = field.seed;

			field.paint((u, v, texel) => {
				const drip = smoothstep(
					0.55,
					0.9,
					1 - Math.abs(perlin(u * 6, v * 1, 6, 1, seed)),
				);

				const lump = fbm(u, v, 3, 3, 4, seed + 1);

				paintTone(texel, wax, 0.94 + lump * 0.08 + drip * 0.05);

				texel.relief = 0.5 + drip * 0.35 + lump * 0.1;
				texel.rough = 0.42 - drip * 0.12;

				blendTone(texel, tone(0x8a7a58), grime(u, v, 2, seed + 2, 0.45) * 0.25);
			});
		},
	};
}

function furrowedBark(): FineRecipe {
	return {
		size: [256, 256],
		tile: [0.5, 0.5],
		depth: 0.012,
		parallax: true,
		paint: (field) => {
			const bark = tone(0x4a3828);
			const deep = tone(0x1e150d);
			const lichen = tone(0x8a9a6a);
			const sample = createVoronoiSample();
			const seed = field.seed;

			field.paint((u, v, texel) => {
				const warp = fbm(u, v, 3, 1, 3, seed);
				const furrow = Math.abs(perlin(u * 9 + warp * 3, v, 9, 1, seed + 1));

				voronoi(u * 5 + warp, v * 3, 5, 3, seed + 2, 1, sample);

				const breaks = smoothstep(0, 0.12, sample.edge);
				const ridge = smoothstep(0.04, 0.45, furrow) * (0.55 + breaks * 0.45);
				const fibers = perlin(u * 40, v * 6, 40, 6, seed + 3) * 0.5 + 0.5;

				paintTone(texel, bark, 0.72 + ridge * 0.36 + fibers * 0.08);
				blendTone(texel, deep, (1 - ridge) * 0.8);

				texel.relief = ridge * (0.85 + fibers * 0.15);
				texel.rough = 0.95;
				texel.ao = 0.45 + ridge * 0.55;

				const patch =
					smoothstep(0.45, 0.7, fbm(u, v, 5, 5, 4, seed + 4)) * ridge;

				blendTone(texel, lichen, patch * 0.6);
			});
		},
	};
}

function looseSoil(): FineRecipe {
	return {
		size: [256, 256],
		tile: [0.6, 0.6],
		depth: 0.01,
		parallax: true,
		paint: (field) => {
			const earth = tone(0x3a2a1c);
			const pebble = tone(0x48423c);
			const sample = createVoronoiSample();
			const seed = field.seed;

			field.paint((u, v, texel) => {
				voronoi(u * 30, v * 30, 30, 30, seed, 1, sample);

				const clump =
					smoothstep(0, 0.3, sample.edge) *
					(0.6 + hash01(sample.id, 1, seed) * 0.4);

				const crumbs = fbm(u, v, 18, 18, 3, seed + 1);

				paintTone(texel, earth, 0.8 + clump * 0.3 + crumbs * 0.15);

				texel.relief = 0.25 + clump * 0.45 + crumbs * 0.1;
				texel.rough = 1;

				const stone = voronoi(u * 11, v * 11, 11, 11, seed + 2, 0.9, sample);

				if (hash01(stone.id, 2, seed) < 0.12 && stone.distance < 0.3) {
					const dome = 1 - stone.distance / 0.3;

					paintTone(
						texel,
						pebble,
						0.8 + dome * 0.3 + hash01(stone.id, 3, seed) * 0.2,
					);

					texel.relief = Math.max(texel.relief, 0.55 + Math.sqrt(dome) * 0.45);
					texel.rough = 0.7;
				}
			});
		},
	};
}

function pageEdges(): FineRecipe {
	return {
		size: [256, 128],
		tile: [0.25, 0.02],
		depth: 0.0006,
		parallax: false,
		paint: (field, rng) => {
			const paper = tone(0xd9caa6);
			const aged = tone(0x8a6c42);

			const sheets = Array.from({ length: 48 }, () => ({
				lift: rng.next(),
				shade: 0.86 + rng.next() * 0.16,
			}));

			const seed = field.seed;

			field.paint((u, v, texel) => {
				const wave = perlin(u * 6, v * 2, 6, 2, seed) * 0.6;
				const row = v * sheets.length + wave;

				const index =
					((Math.floor(row) % sheets.length) + sheets.length) % sheets.length;

				const sheet = sheets[index];
				const within = row - Math.floor(row);
				const gap = 1 - smoothstep(0, 0.22, Math.min(within, 1 - within));

				paintTone(texel, paper, sheet.shade * (1 - gap * 0.35));

				const foxing = smoothstep(0.35, 0.75, fbm(u, v, 5, 2, 4, seed + 1));

				blendTone(texel, aged, foxing * 0.45 + Math.abs(v - 0.5) * 0.3);

				texel.relief = 0.55 + sheet.lift * 0.35 - gap * 0.45;
				texel.rough = 0.95;
			});
		},
	};
}

export const FINE_MATERIALS: Record<string, FineRecipe> = {
	pageEdges: pageEdges(),
	woodDark: furnitureWood(0x3d2718, 0x1c0f07, 0.42),
	woodMedium: furnitureWood(0x6b4426, 0x3a2010, 0.45),
	woodLight: furnitureWood(0x9a7046, 0x5e3e20, 0.5, 0.8),
	woodRed: furnitureWood(0x6a2c1c, 0x2e0f08, 0.36, 1.1),
	woodPainted: paintedWood(0x3f4a3a, 0x7a5a3a),
	iron: blackIron(0x3b3d40, 4),
	brass: polishedAlloy({
		base: 0xc9a050,
		tarnish: 0x6a4a1c,
		patina: 0x4f8a6a,
		patinaAmount: 0.15,
		roughness: 0.22,
	}),
	copper: polishedAlloy({
		base: 0xc07850,
		tarnish: 0x5a2a14,
		patina: 0x4f9a83,
		patinaAmount: 0.55,
		roughness: 0.28,
	}),
	pipeMetal: pipeSteel(),
	leather: pebbledLeather(),
	stoneSmooth: honedStone({
		base: 0x76726a,
		dark: 0x4f4b45,
		light: 0x9a968c,
		tile: 0.6,
		size: 256,
		roughness: 0.62,
		pits: 1,
	}),
	marble: polishedMarble({
		base: 0xd9d4c8,
		vein: 0x8c877c,
		strength: 0.7,
		sharpness: 14,
		cloud: 0.05,
	}),
	marbleBlack: polishedMarble({
		base: 0x24242a,
		vein: 0xc0bcae,
		strength: 0.8,
		sharpness: 22,
		cloud: 0.12,
	}),
	marbleRose: polishedMarble({
		base: 0xc49a92,
		vein: 0x7a4a48,
		strength: 0.6,
		sharpness: 12,
		cloud: 0.08,
	}),
	marbleGreen: polishedMarble({
		base: 0x2c5546,
		vein: 0xa8cfae,
		strength: 0.65,
		sharpness: 16,
		cloud: 0.12,
	}),
	marbleGold: polishedMarble({
		base: 0xd2c29c,
		vein: 0x8a6a30,
		strength: 0.6,
		sharpness: 12,
		cloud: 0.06,
	}),
	limestone: honedStone({
		base: 0xbcb29a,
		dark: 0x8e856f,
		light: 0xd8cfb8,
		tile: 0.75,
		size: 256,
		roughness: 0.78,
		pits: 1.4,
	}),
	granite: honedStone({
		base: 0x6c6c70,
		dark: 0x2c2c30,
		light: 0xb4b4b8,
		tile: 0.75,
		size: 256,
		roughness: 0.42,
		pits: 0.3,
		sparkle: 0.04,
	}),
	basalt: honedStone({
		base: 0x35373c,
		dark: 0x1e2024,
		light: 0x54575c,
		tile: 0.75,
		size: 256,
		roughness: 0.6,
		pits: 1.2,
	}),
	sandstone: beddedRock(0xb48c5c, 0x8c6638, 0.92),
	slate: beddedRock(0x4a525a, 0x323840, 0.7),
	terracotta: terracottaClay(),
	ceramic: glazedCeramic(),
	wax: candleWax(),
	bark: furrowedBark(),
	soil: looseSoil(),
};
