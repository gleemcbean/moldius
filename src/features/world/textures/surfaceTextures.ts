import {
	hexToRgb,
	mix,
	type PixelPainter,
	type RGB,
	shade,
} from "./PixelPainter";

export type TextureRecipe = {
	size: [number, number];
	tile: number | [number, number];
	draw: (painter: PixelPainter) => void;
};

function planks(
	base: number,
	plankHeight: number,
	variation: number,
): TextureRecipe {
	return {
		size: [64, 64],
		tile: 2,
		draw: (p) => {
			const color = hexToRgb(base);
			for (let row = 0; row < 64 / plankHeight; row += 1) {
				const tone = shade(color, 1 + (p.rng.next() - 0.5) * variation);
				const offset = p.rng.int(0, 63);
				p.rect(0, row * plankHeight, 64, plankHeight, tone);
				for (let x = 0; x < 64; x += 1) {
					const grain =
						Math.sin((x + offset) * 0.35 + row * 3) * 0.05 +
						(p.rng.next() - 0.5) * 0.08;
					for (
						let y = row * plankHeight + 1;
						y < (row + 1) * plankHeight - 1;
						y += 1
					) {
						if (p.rng.next() < 0.35) {
							p.set(x, y, shade(tone, 1 + grain));
						}
					}
				}
				p.rect(0, row * plankHeight, 64, 1, shade(tone, 0.55));
				const seam = (offset + p.rng.int(16, 40)) % 64;
				p.rect(seam, row * plankHeight, 1, plankHeight, shade(tone, 0.6));
				if (p.rng.chance(0.5)) {
					p.circle(
						p.rng.int(4, 60),
						row * plankHeight + plankHeight / 2,
						1.2,
						shade(tone, 0.65),
					);
				}
			}
			p.noise(0.08);
		},
	};
}

function wallpaper(
	base: number,
	motif: number,
	stripe: boolean,
): TextureRecipe {
	return {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			const background = hexToRgb(base);
			const accent = hexToRgb(motif);
			p.fill(background);
			p.noise(0.1);
			if (stripe) {
				for (let x = 0; x < 32; x += 8) {
					p.rect(x, 0, 2, 32, shade(background, 0.82));
					p.rect(x + 4, 0, 1, 32, mix(background, accent, 0.4));
				}
			}
			const drawDamask = (cx: number, cy: number) => {
				p.set(cx, cy - 4, accent);
				p.rect(cx - 1, cy - 3, 3, 1, accent);
				p.rect(cx - 2, cy - 2, 5, 2, accent);
				p.rect(cx - 3, cy, 7, 1, mix(accent, background, 0.3));
				p.rect(cx - 2, cy + 1, 5, 1, accent);
				p.rect(cx - 1, cy + 2, 3, 2, accent);
				p.set(cx, cy + 4, accent);
				p.set(cx - 3, cy - 3, mix(accent, background, 0.5));
				p.set(cx + 3, cy - 3, mix(accent, background, 0.5));
				p.set(cx, cy, shade(accent, 1.25));
			};
			drawDamask(8, 8);
			drawDamask(24, 24);
			p.speckle(6, shade(background, 0.7));
			p.stain(2, shade(background, 0.75), 4, 60);
		},
	};
}

function stoneBlocks(
	base: number,
	blockWidth: number,
	blockHeight: number,
	tile: number,
): TextureRecipe {
	return {
		size: [64, 64],
		tile,
		draw: (p) => {
			const color = hexToRgb(base);
			const mortar = shade(color, 0.45);
			p.fill(mortar);
			for (let row = 0; row * blockHeight < 64; row += 1) {
				const offset = row % 2 === 0 ? 0 : blockWidth / 2;
				for (let column = -1; column * blockWidth < 64; column += 1) {
					const x = column * blockWidth + offset;
					const tone = shade(color, 0.85 + p.rng.next() * 0.3);
					p.rect(
						x + 1,
						row * blockHeight + 1,
						blockWidth - 2,
						blockHeight - 2,
						tone,
					);
					p.rect(
						x + 1,
						row * blockHeight + 1,
						blockWidth - 2,
						1,
						shade(tone, 1.18),
					);
					p.rect(
						x + 1,
						row * blockHeight + blockHeight - 2,
						blockWidth - 2,
						1,
						shade(tone, 0.78),
					);
				}
			}
			p.noise(0.22);
			p.stain(5, shade(color, 0.6), 6, 70);
			p.speckle(40, shade(color, 1.3), 120);
		},
	};
}

function tiles(
	a: number,
	b: number,
	count: number,
	tile: number,
): TextureRecipe {
	return {
		size: [64, 64],
		tile,
		draw: (p) => {
			const colorA = hexToRgb(a);
			const colorB = hexToRgb(b);
			const size = 64 / count;
			for (let row = 0; row < count; row += 1) {
				for (let column = 0; column < count; column += 1) {
					const color = (row + column) % 2 === 0 ? colorA : colorB;
					p.rect(
						column * size,
						row * size,
						size,
						size,
						shade(color, 0.92 + p.rng.next() * 0.12),
					);
					p.rect(column * size, row * size, size, 1, shade(color, 0.7));
					p.rect(column * size, row * size, 1, size, shade(color, 0.7));
				}
			}
			p.noise(0.12);
			p.stain(4, [60, 50, 40], 5, 40);
		},
	};
}

function floralWallpaper(
	base: number,
	petal: number,
	leaf: number,
): TextureRecipe {
	return {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			const background = hexToRgb(base);
			const bloom = hexToRgb(petal);
			const green = hexToRgb(leaf);
			p.fill(background);
			p.noise(0.1);
			const flower = (cx: number, cy: number) => {
				p.line(cx, cy + 2, cx - 3, cy + 6, green);
				p.line(cx, cy + 2, cx + 3, cy + 5, green);
				p.set(cx - 3, cy + 5, shade(green, 1.2));
				p.set(cx + 3, cy + 4, shade(green, 1.2));
				for (const [dx, dy] of [
					[0, -2],
					[2, 0],
					[0, 2],
					[-2, 0],
				]) {
					p.rect(cx + dx - 1, cy + dy - 1, 2, 2, bloom);
				}
				p.set(cx, cy, shade(bloom, 1.4));
			};
			flower(8, 6);
			flower(24, 22);
			p.speckle(10, mix(background, bloom, 0.35));
			p.stain(3, shade(background, 0.72), 5, 60);
		},
	};
}

function trellisWallpaper(base: number, lattice: number): TextureRecipe {
	return {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			const background = hexToRgb(base);
			const accent = hexToRgb(lattice);
			p.fill(background);
			p.noise(0.08);
			for (let offset = 0; offset < 32; offset += 16) {
				p.line(offset, 0, offset + 32, 32, accent);
				p.line(offset + 32, 0, offset, 32, accent);
				p.line(offset - 32, 0, offset, 32, accent);
				p.line(offset, 0, offset - 32, 32, accent);
			}
			for (const [x, y] of [
				[0, 0],
				[16, 16],
				[16, 0],
				[0, 16],
			]) {
				p.circle(x, y, 1.2, shade(accent, 1.3));
			}
			p.stain(3, shade(background, 0.7), 6, 60);
		},
	};
}

function stripedWallpaper(a: number, b: number): TextureRecipe {
	return {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			const first = hexToRgb(a);
			const second = hexToRgb(b);
			for (let x = 0; x < 32; x += 1) {
				const band = Math.floor(x / 4) % 2 === 0 ? first : second;
				p.rect(x, 0, 1, 32, band);
			}
			for (let x = 0; x < 32; x += 8) {
				p.rect(x + 3, 0, 1, 32, shade(first, 0.7));
			}
			p.noise(0.1);
			p.stain(4, shade(first, 0.65), 6, 70);
			for (let index = 0; index < 2; index += 1) {
				const x = p.rng.int(0, 31);
				for (let y = p.rng.int(0, 10); y < 32; y += 1) {
					p.set(x, y, shade(p.get(x, y), 0.8));
				}
			}
		},
	};
}

function fleurWallpaper(base: number, motif: number): TextureRecipe {
	return {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			const background = hexToRgb(base);
			const accent = hexToRgb(motif);
			p.fill(background);
			p.noise(0.1, 2);
			const lily = (cx: number, cy: number) => {
				p.rect(cx, cy - 4, 1, 8, accent);
				p.rect(cx - 1, cy - 3, 3, 2, accent);
				p.line(cx - 1, cy, cx - 3, cy - 2, accent);
				p.line(cx + 1, cy, cx + 3, cy - 2, accent);
				p.set(cx - 3, cy - 1, accent);
				p.set(cx + 3, cy - 1, accent);
				p.rect(cx - 2, cy + 1, 5, 1, shade(accent, 0.8));
				p.set(cx, cy - 4, shade(accent, 1.3));
			};
			lily(8, 8);
			lily(24, 24);
			p.frame(0, 0, 32, 32, shade(background, 0.85));
			p.stain(2, shade(background, 0.7), 5, 70);
		},
	};
}

function rubbleStone(base: number): TextureRecipe {
	return {
		size: [64, 64],
		tile: 2,
		draw: (p) => {
			const color = hexToRgb(base);
			p.fill(shade(color, 0.42));
			for (let index = 0; index < 46; index += 1) {
				const cx = p.rng.int(0, 63);
				const cy = p.rng.int(0, 63);
				const radius = p.rng.range(3.5, 7);
				const tone = shade(color, 0.75 + p.rng.next() * 0.4);
				for (let y = -Math.ceil(radius); y <= Math.ceil(radius); y += 1) {
					for (
						let x = -Math.ceil(radius * 1.4);
						x <= Math.ceil(radius * 1.4);
						x += 1
					) {
						if (Math.hypot(x / 1.4, y) <= radius - 0.5) {
							p.set(
								cx + x,
								cy + y,
								y < -radius * 0.5 ? shade(tone, 1.15) : tone,
							);
						}
					}
				}
			}
			p.noise(0.2);
			p.stain(6, shade(color, 0.55), 7, 80);
		},
	};
}

function mossyBrick(): TextureRecipe {
	return {
		size: [64, 32],
		tile: [2, 1],
		draw: (p) => {
			const base = hexToRgb(0x6a4434);
			p.fill(hexToRgb(0x3f3a32));
			for (let row = 0; row < 8; row += 1) {
				const offset = row % 2 === 0 ? 0 : 8;
				for (let column = -1; column < 5; column += 1) {
					p.rect(
						column * 16 + offset + 1,
						row * 4 + 1,
						15,
						3,
						shade(base, 0.7 + p.rng.next() * 0.35),
					);
				}
			}
			p.noise(0.16);
			p.stain(9, hexToRgb(0x3e5a2c), 6, 140);
			p.speckle(40, hexToRgb(0x5d7a3a), 170);
			for (let index = 0; index < 4; index += 1) {
				let x = p.rng.int(0, 63);
				for (let y = 0; y < 32; y += 1) {
					p.set(x, y, hexToRgb(0x2a2a22), 110);
					x += p.rng.int(-1, 1);
				}
			}
		},
	};
}

export const SURFACE_TEXTURES: Record<string, TextureRecipe> = {
	oakPlanks: planks(0x8a5a32, 8, 0.25),
	darkPlanks: planks(0x4d3221, 8, 0.3),
	parquet: {
		size: [64, 64],
		tile: 2,
		draw: (p) => {
			const base = hexToRgb(0x9a6a3c);
			for (let y = 0; y < 64; y += 1) {
				for (let x = 0; x < 64; x += 1) {
					const cell = Math.floor((x + y) / 8) % 2;
					const strip = Math.floor((cell === 0 ? x : y) / 4) % 2;
					const tone = shade(base, cell === 0 ? 1.05 : 0.88);
					p.setRaw(x, y, strip === 0 ? tone : shade(tone, 0.92), 255);
					if ((x + y) % 8 === 0) {
						p.setRaw(x, y, shade(base, 0.55), 255);
					}
				}
			}
			p.noise(0.12);
		},
	},
	stoneFlags: stoneBlocks(0x6f6a62, 21, 16, 2),
	cobble: {
		size: [64, 64],
		tile: 2,
		draw: (p) => {
			const base = hexToRgb(0x5a5650);
			p.fill(shade(base, 0.4));
			for (let index = 0; index < 70; index += 1) {
				const cx = p.rng.int(0, 63);
				const cy = p.rng.int(0, 63);
				const radius = p.rng.range(3, 5.5);
				const tone = shade(base, 0.8 + p.rng.next() * 0.45);
				p.circle(cx, cy, radius, tone);
				p.circle(cx - 1, cy - 1, radius * 0.45, shade(tone, 1.15));
			}
			p.noise(0.15);
		},
	},
	checkerTiles: tiles(0xd9d2c0, 0x2a2826, 4, 2),
	mosaic: {
		size: [64, 64],
		tile: 1,
		draw: (p) => {
			const palette = [0x2f6f78, 0xd8cdb4, 0x8a3b2c, 0x1d4a52].map(hexToRgb);
			for (let row = 0; row < 16; row += 1) {
				for (let column = 0; column < 16; column += 1) {
					const ring = Math.max(Math.abs(column - 7.5), Math.abs(row - 7.5));
					const color = palette[Math.floor(ring) % palette.length];
					p.rect(
						column * 4,
						row * 4,
						4,
						4,
						shade(color, 0.9 + p.rng.next() * 0.2),
					);
					p.rect(column * 4, row * 4, 4, 1, shade(color, 0.6));
					p.rect(column * 4, row * 4, 1, 4, shade(color, 0.6));
				}
			}
			p.noise(0.08);
		},
	},
	greenhouseTiles: {
		size: [64, 64],
		tile: 2,
		draw: (p) => {
			const terracotta = hexToRgb(0x9c5a3c);
			for (let row = 0; row < 4; row += 1) {
				for (let column = 0; column < 4; column += 1) {
					const tone = shade(terracotta, 0.85 + p.rng.next() * 0.3);
					p.rect(column * 16, row * 16, 16, 16, tone);
					p.frame(column * 16, row * 16, 16, 16, shade(terracotta, 0.5));
				}
			}
			p.noise(0.18);
			p.stain(10, [70, 82, 44], 5, 90);
			p.speckle(30, [90, 110, 50], 160);
		},
	},
	redCarpet: {
		size: [64, 64],
		tile: 2,
		draw: (p) => {
			const base = hexToRgb(0x6e1d22);
			p.fill(base);
			p.noise(0.2);
			for (let index = 0; index < 4; index += 1) {
				const cx = 16 + (index % 2) * 32;
				const cy = 16 + Math.floor(index / 2) * 32;
				p.circle(cx, cy, 6, shade(base, 1.35), 255, false);
				p.circle(cx, cy, 2, hexToRgb(0xc9a14a));
			}
			p.speckle(80, shade(base, 0.7));
		},
	},
	wallpaperGreen: wallpaper(0x2b4232, 0x6f8d52, true),
	wallpaperRed: wallpaper(0x5b1f24, 0xa5643c, false),
	wallpaperBlue: wallpaper(0x22314d, 0x6d86a8, true),
	wallpaperOchre: wallpaper(0x7a5a2a, 0xc79d4f, false),
	wallpaperPurple: wallpaper(0x3a2444, 0x8c6aa1, true),
	wallpaperFloral: floralWallpaper(0x4a3a2c, 0xb0605a, 0x5d7244),
	wallpaperTrellis: trellisWallpaper(0x2e3b36, 0x9a8a5a),
	wallpaperStripes: stripedWallpaper(0x5a2228, 0x8a6c4a),
	wallpaperFleur: fleurWallpaper(0x1f2a44, 0xb0924e),
	rubbleStone: rubbleStone(0x6a645a),
	mossyBrick: mossyBrick(),
	plaster: {
		size: [64, 64],
		tile: 2,
		draw: (p) => {
			p.fill(hexToRgb(0x8d8576));
			p.noise(0.16, 2);
			p.noise(0.1);
			p.stain(6, hexToRgb(0x6d6556), 9, 70);
			p.stain(3, hexToRgb(0x4f5a3a), 5, 50);
			for (let index = 0; index < 3; index += 1) {
				let x = p.rng.int(0, 63);
				let y = p.rng.int(0, 63);
				for (let step = 0; step < 14; step += 1) {
					p.set(x, y, hexToRgb(0x5d564a));
					x += p.rng.int(-1, 1);
					y += 1;
				}
			}
		},
	},
	stoneBlocks: stoneBlocks(0x5f5a52, 21, 12, 2),
	brick: {
		size: [64, 32],
		tile: [2, 1],
		draw: (p) => {
			const base = hexToRgb(0x7a3b2b);
			p.fill(hexToRgb(0x4a4038));
			for (let row = 0; row < 8; row += 1) {
				const offset = row % 2 === 0 ? 0 : 8;
				for (let column = -1; column < 5; column += 1) {
					const tone = shade(base, 0.8 + p.rng.next() * 0.4);
					p.rect(column * 16 + offset + 1, row * 4 + 1, 15, 3, tone);
				}
			}
			p.noise(0.18);
			p.stain(4, hexToRgb(0x3a2e28), 4, 60);
		},
	},
	woodPanels: {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			const base = hexToRgb(0x5c3a22);
			for (let column = 0; column < 4; column += 1) {
				const tone = shade(base, 0.9 + p.rng.next() * 0.2);
				p.rect(column * 8, 0, 8, 32, tone);
				p.rect(column * 8, 0, 1, 32, shade(tone, 0.6));
				p.rect(column * 8 + 1, 0, 1, 32, shade(tone, 1.15));
				for (let y = 0; y < 32; y += 1) {
					if (p.rng.next() < 0.3) {
						p.set(column * 8 + p.rng.int(2, 7), y, shade(tone, 0.85));
					}
				}
			}
			p.noise(0.06);
		},
	},
	tiles: tiles(0xc8d6cf, 0xb4c6be, 4, 1),
	greenhouseBrick: {
		size: [64, 32],
		tile: [2, 1],
		draw: (p) => {
			const base = hexToRgb(0x8c4a33);
			p.fill(hexToRgb(0x5d564c));
			for (let row = 0; row < 8; row += 1) {
				const offset = row % 2 === 0 ? 0 : 8;
				for (let column = -1; column < 5; column += 1) {
					p.rect(
						column * 16 + offset + 1,
						row * 4 + 1,
						15,
						3,
						shade(base, 0.85 + p.rng.next() * 0.3),
					);
				}
			}
			p.noise(0.15);
			p.stain(8, hexToRgb(0x4f6a35), 5, 110);
		},
	},
	wainscot: {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			const base = hexToRgb(0x4b2f1c);
			p.fill(base);
			p.frame(2, 3, 28, 24, shade(base, 0.62), 1);
			p.frame(3, 4, 26, 22, shade(base, 1.25), 1);
			p.rect(0, 0, 32, 2, shade(base, 1.3));
			p.rect(0, 30, 32, 2, shade(base, 0.55));
			p.noise(0.1);
		},
	},
	ceilingPlaster: {
		size: [64, 64],
		tile: 2,
		draw: (p) => {
			p.fill(hexToRgb(0x6f6a60));
			p.noise(0.12, 2);
			p.stain(5, hexToRgb(0x58534a), 10, 70);
			p.stain(2, hexToRgb(0x4a3f2e), 6, 60);
		},
	},
	vaultStone: stoneBlocks(0x55514b, 16, 8, 2),
	coffer: {
		size: [32, 32],
		tile: 1.5,
		draw: (p) => {
			const base = hexToRgb(0x5a4632);
			p.fill(shade(base, 0.8));
			p.rect(3, 3, 26, 26, shade(base, 0.62));
			p.frame(3, 3, 26, 26, shade(base, 1.2));
			p.rect(9, 9, 14, 14, shade(base, 0.55));
			p.noise(0.1);
		},
	},
	skyNight: {
		size: [128, 64],
		tile: [8, 4],
		draw: (p) => {
			for (let y = 0; y < 64; y += 1) {
				const color: RGB = mix(hexToRgb(0x0b1020), hexToRgb(0x1b2440), y / 64);
				p.rect(0, y, 128, 1, color);
			}
			p.speckle(70, hexToRgb(0xcfd8ff), 200);
			p.speckle(12, hexToRgb(0xffffff));
			p.circle(98, 14, 6, hexToRgb(0xe9e7d4));
			p.circle(96, 13, 5, hexToRgb(0xd4d2be));
		},
	},
};
