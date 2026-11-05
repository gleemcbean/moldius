import { hexToRgb, mix, type RGB, shade } from "./PixelPainter";
import type { TextureRecipe } from "./surfaceTextures";

function woodGrain(base: number): TextureRecipe {
	return {
		size: [32, 32],
		tile: 0.5,
		draw: (p) => {
			const color = hexToRgb(base);
			for (let y = 0; y < 32; y += 1) {
				for (let x = 0; x < 32; x += 1) {
					const wave = Math.sin(y * 0.55 + Math.sin(x * 0.25) * 2.2) * 0.07;
					p.setRaw(
						x,
						y,
						shade(color, 1 + wave + (p.rng.next() - 0.5) * 0.06),
						255,
					);
				}
			}
			for (let index = 0; index < 5; index += 1) {
				const y = p.rng.int(0, 31);
				p.rect(0, y, 32, 1, shade(color, 0.8), 140);
			}
		},
	};
}

function fabric(
	base: number,
	pattern: "plain" | "weave" | "diamond",
): TextureRecipe {
	return {
		size: [32, 32],
		tile: 0.5,
		draw: (p) => {
			const color = hexToRgb(base);
			p.fill(color);
			for (let y = 0; y < 32; y += 1) {
				for (let x = 0; x < 32; x += 1) {
					if (pattern === "weave" && (x + y) % 2 === 0) {
						p.set(x, y, shade(color, 0.88));
					}
					if (
						pattern === "diamond" &&
						Math.abs((x % 8) - 4) + Math.abs((y % 8) - 4) === 3
					) {
						p.set(x, y, shade(color, 1.3));
					}
				}
			}
			p.noise(0.12);
		},
	};
}

function metal(base: number, rust: number): TextureRecipe {
	return {
		size: [32, 32],
		tile: 0.5,
		draw: (p) => {
			const color = hexToRgb(base);
			for (let y = 0; y < 32; y += 1) {
				p.rect(0, y, 32, 1, shade(color, 0.92 + Math.sin(y * 0.8) * 0.06));
			}
			p.noise(0.14);
			p.stain(rust, hexToRgb(0x6b3a1e), 4, 120);
			p.speckle(10, shade(color, 1.4));
		},
	};
}

function leaves(base: number): TextureRecipe {
	return {
		size: [32, 32],
		tile: 0.5,
		draw: (p) => {
			p.fill(shade(hexToRgb(base), 0.45));
			for (let index = 0; index < 40; index += 1) {
				const x = p.rng.int(0, 31);
				const y = p.rng.int(0, 31);
				const tone = shade(hexToRgb(base), 0.7 + p.rng.next() * 0.6);
				p.rect(x, y, 3, 2, tone);
				p.set(x + 1, y, shade(tone, 1.3));
			}
		},
	};
}

export const OBJECT_TEXTURES: Record<string, TextureRecipe> = {
	woodDark: woodGrain(0x3d2718),
	woodMedium: woodGrain(0x6b4426),
	woodLight: woodGrain(0x9a7046),
	woodRed: woodGrain(0x6a2c1c),
	woodPainted: woodGrain(0x3f4a3a),
	iron: metal(0x3b3d40, 4),
	brass: metal(0xa07a32, 1),
	copper: metal(0x9a5534, 3),
	pipeMetal: metal(0x4f5452, 7),
	velvetRed: fabric(0x6a1a22, "plain"),
	velvetGreen: fabric(0x23402e, "plain"),
	velvetBlue: fabric(0x22305a, "plain"),
	velvetPurple: fabric(0x46264f, "diamond"),
	linen: fabric(0xd8cfba, "weave"),
	burlap: fabric(0x8a7048, "weave"),
	leather: {
		size: [32, 32],
		tile: 0.5,
		draw: (p) => {
			p.fill(hexToRgb(0x4a2a1a));
			p.noise(0.25, 2);
			p.noise(0.1);
		},
	},
	stoneSmooth: {
		size: [32, 32],
		tile: 0.6,
		draw: (p) => {
			p.fill(hexToRgb(0x76726a));
			p.noise(0.18, 2);
			p.noise(0.08);
			p.stain(3, hexToRgb(0x5b5850), 5, 80);
		},
	},
	marble: {
		size: [32, 32],
		tile: 0.6,
		draw: (p) => {
			p.fill(hexToRgb(0xd9d4c8));
			for (let index = 0; index < 4; index += 1) {
				let x = p.rng.int(0, 31);
				for (let y = 0; y < 32; y += 1) {
					x += p.rng.int(-1, 1);
					p.set(x, y, hexToRgb(0x8f8a80), 160);
				}
			}
			p.noise(0.05);
		},
	},
	books: {
		size: [64, 32],
		tile: [0.8, 0.4],
		draw: (p) => {
			const colors = [
				0x6a1f1f, 0x1f3a5a, 0x2e4a24, 0x5a3a1a, 0x3a1f4a, 0x7a5a1a, 0x222222,
				0x8a6a3a,
			].map(hexToRgb);
			p.fill(hexToRgb(0x1a120c));
			let x = 0;
			while (x < 64) {
				const width = p.rng.int(2, 5);
				const height = p.rng.int(20, 31);
				const color = p.rng.pick(colors);
				p.rect(x, 32 - height, width, height, color);
				p.rect(x, 32 - height + 3, width, 1, hexToRgb(0xc9a44a));
				p.rect(x, 32 - height + height - 5, width, 1, hexToRgb(0xc9a44a));
				p.rect(x + width - 1, 32 - height, 1, height, shade(color, 0.6));
				x += width;
			}
			p.noise(0.08);
		},
	},
	paper: {
		size: [32, 32],
		tile: 0.4,
		draw: (p) => {
			p.fill(hexToRgb(0xd9c9a0));
			p.noise(0.08);
			for (let y = 4; y < 32; y += 4) {
				p.rect(4, y, 22, 1, hexToRgb(0x6a5a40), 120);
			}
		},
	},
	soil: {
		size: [32, 32],
		tile: 0.6,
		draw: (p) => {
			p.fill(hexToRgb(0x3a2a1c));
			p.noise(0.4, 2);
			p.speckle(30, hexToRgb(0x5a4a34));
		},
	},
	foliage: leaves(0x3f7a34),
	foliageDark: leaves(0x2a5a2a),
	foliageWarm: leaves(0x6a7a2a),
	bark: {
		size: [32, 32],
		tile: 0.5,
		draw: (p) => {
			p.fill(hexToRgb(0x4a3828));
			for (let x = 0; x < 32; x += 3) {
				p.rect(x, 0, 1, 32, hexToRgb(0x2e2218));
			}
			p.noise(0.2);
		},
	},
	ceramic: {
		size: [32, 32],
		tile: 0.5,
		draw: (p) => {
			p.fill(hexToRgb(0xe6e1d3));
			p.noise(0.04);
			p.stain(2, hexToRgb(0xb9b3a3), 4, 60);
		},
	},
	wax: {
		size: [16, 16],
		tile: 0.2,
		draw: (p) => {
			p.fill(hexToRgb(0xe9dcb8));
			p.noise(0.06);
		},
	},
	slime: {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0x5f9a2a));
			for (let index = 0; index < 18; index += 1) {
				p.circle(
					p.rng.int(0, 31),
					p.rng.int(0, 31),
					p.rng.range(1, 3),
					hexToRgb(0x9ad04a),
					180,
				);
			}
			p.noise(0.15);
		},
	},
	windowNight: {
		size: [32, 64],
		tile: [1, 2],
		draw: (p) => {
			for (let y = 0; y < 64; y += 1) {
				p.rect(
					0,
					y,
					32,
					1,
					mix(hexToRgb(0x1a2440), hexToRgb(0x070a12), y / 64),
				);
			}
			p.speckle(18, hexToRgb(0xb8c4ff), 180);
			for (let x = 0; x < 32; x += 1) {
				const height =
					52 + Math.round(Math.sin(x * 0.7) * 3 + p.rng.next() * 3);
				p.rect(x, height, 1, 64 - height, hexToRgb(0x04060a));
			}
		},
	},
	flame: {
		size: [16, 32],
		tile: 1,
		draw: (p) => {
			p.clear();
			for (let y = 0; y < 32; y += 1) {
				const width = Math.round(
					Math.sin((y / 32) * Math.PI) * 7 * (y / 32 + 0.3),
				);
				const color: RGB = mix(
					hexToRgb(0xfff3b0),
					hexToRgb(0xff6a10),
					1 - y / 32,
				);
				p.rect(8 - width, y, width * 2, 1, color);
			}
		},
	},
	cobweb: {
		size: [64, 64],
		tile: 1,
		draw: (p) => {
			p.clear();
			const color: RGB = [220, 220, 210];
			for (let index = 0; index < 7; index += 1) {
				const angle = (index / 6) * (Math.PI / 2);
				p.line(
					0,
					0,
					Math.round(Math.cos(angle) * 63),
					Math.round(Math.sin(angle) * 63),
					color,
					150,
				);
			}
			for (let ring = 8; ring < 64; ring += 8) {
				for (let index = 0; index < 6; index += 1) {
					const a0 = (index / 6) * (Math.PI / 2);
					const a1 = ((index + 1) / 6) * (Math.PI / 2);
					const sag = ring * 0.85;
					p.line(
						Math.round(Math.cos(a0) * ring),
						Math.round(Math.sin(a0) * ring),
						Math.round(Math.cos((a0 + a1) / 2) * sag),
						Math.round(Math.sin((a0 + a1) / 2) * sag),
						color,
						110,
					);
					p.line(
						Math.round(Math.cos((a0 + a1) / 2) * sag),
						Math.round(Math.sin((a0 + a1) / 2) * sag),
						Math.round(Math.cos(a1) * ring),
						Math.round(Math.sin(a1) * ring),
						color,
						110,
					);
				}
			}
		},
	},
	mirror: {
		size: [16, 32],
		tile: 1,
		draw: (p) => {
			for (let y = 0; y < 32; y += 1) {
				p.rect(
					0,
					y,
					16,
					1,
					mix(hexToRgb(0x6a7680), hexToRgb(0x2a3038), y / 32),
				);
			}
			p.line(2, 30, 12, 4, hexToRgb(0xb8c2c8), 90);
			p.line(5, 30, 14, 10, hexToRgb(0xb8c2c8), 60);
			p.stain(3, hexToRgb(0x3a3a30), 3, 100);
		},
	},
};
