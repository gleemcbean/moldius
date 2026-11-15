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

export const SURFACE_TEXTURES: Record<string, TextureRecipe> = {
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
