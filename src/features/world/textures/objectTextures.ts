import {
	hexToRgb,
	mix,
	type PixelPainter,
	type RGB,
	shade,
} from "./PixelPainter";
import type { TextureRecipe } from "./surfaceTextures";

function woodGrain(base: number): TextureRecipe {
	return {
		size: [32, 32],
		tile: 0.5,
		draw: (p) => {
			const color = hexToRgb(base);
			const rows = Array.from({ length: 32 }, () => p.rng.next() - 0.5);
			const phases = rows.map(() => p.rng.next() * Math.PI * 2);
			for (let y = 0; y < 32; y += 1) {
				const tone =
					rows[y] * 0.1 + rows[(y + 1) % 32] * 0.06 + rows[(y + 3) % 32] * 0.04;
				for (let x = 0; x < 32; x += 1) {
					const drift = Math.sin((x / 32) * Math.PI * 2 + phases[y]) * 0.018;
					p.setRaw(
						x,
						y,
						shade(color, 1 + tone + drift + (p.rng.next() - 0.5) * 0.025),
						255,
					);
				}
			}
			for (let index = 0; index < 9; index += 1) {
				const dark = index % 3 !== 0;
				p.rect(
					p.rng.int(0, 31),
					p.rng.int(0, 31),
					p.rng.int(9, 28),
					1,
					shade(color, dark ? 0.76 : 1.14),
					dark ? 96 : 60,
				);
			}
		},
	};
}

function fabric(base: number, pattern: "plain" | "weave"): TextureRecipe {
	return {
		size: [32, 32],
		tile: 0.5,
		draw: (p) => {
			const color = hexToRgb(base);
			p.fill(color);
			for (let y = 0; y < 32; y += 1) {
				for (let x = 0; x < 32; x += 1) {
					if (pattern === "weave" && (y % 4 === 0 || x % 4 === 0)) {
						p.set(x, y, shade(color, 0.96));
					}
				}
			}
			p.noise(0.05);
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

function paintLeaf(
	p: PixelPainter,
	x: number,
	y: number,
	angle: number,
	length: number,
	width: number,
	color: RGB,
): void {
	const ux = Math.cos(angle);
	const uy = Math.sin(angle);
	const reach = Math.ceil(length);
	for (let dy = -reach; dy <= reach; dy += 1) {
		for (let dx = -reach; dx <= reach; dx += 1) {
			const along = (dx * ux + dy * uy) / length;
			const across = -dx * uy + dy * ux;
			if (along < -1 || along > 1) {
				continue;
			}
			const limit = width * Math.max(0, 1 - along * along);
			if (Math.abs(across) > limit) {
				continue;
			}
			const rib = Math.abs(across) < 0.5;
			const edge = Math.abs(across) > limit - 0.8;
			p.set(
				x + dx,
				y + dy,
				shade(color, rib ? 1.22 : edge ? 0.82 : 1 + across * 0.04),
			);
		}
	}
}

function leaves(base: number): TextureRecipe {
	return {
		size: [48, 48],
		tile: 0.5,
		draw: (p) => {
			const color = hexToRgb(base);
			p.fill(shade(color, 0.3));
			const count = 90;
			for (let index = 0; index < count; index += 1) {
				paintLeaf(
					p,
					p.rng.int(0, 47),
					p.rng.int(0, 47),
					p.rng.next() * Math.PI * 2,
					4 + p.rng.next() * 2.5,
					1.5 + p.rng.next() * 0.8,
					shade(color, 0.5 + (index / count) * 0.62 + p.rng.next() * 0.1),
				);
			}
		},
	};
}

function leafBlade(): TextureRecipe {
	return {
		size: [16, 64],
		tile: 1,
		draw: (p) => {
			p.clear();
			const base = hexToRgb(0x6f9a58);
			for (let y = 0; y < 64; y += 1) {
				const along = y / 63;
				const half = Math.max(0.6, 7 * Math.sin(Math.PI * along ** 0.62));
				for (let x = 0; x < 16; x += 1) {
					const across = Math.abs(x + 0.5 - 8);
					if (across > half) {
						continue;
					}
					const vein = Math.floor(y + across * 1.4) % 7 === 0 ? 0.88 : 1;
					const edge = across > half - 1 ? 0.78 : 1;
					const rib = across < 1 ? 1.28 : 1;
					const light = 0.82 + (1 - along) * 0.32;
					p.setRaw(x, y, shade(base, vein * edge * rib * light), 255);
				}
			}
		},
	};
}

function palmFrond(): TextureRecipe {
	return {
		size: [48, 96],
		tile: 1,
		draw: (p) => {
			p.clear();
			const base = hexToRgb(0x5f8f4e);
			const rib = shade(base, 0.62);
			for (let y = 3; y < 92; y += 4) {
				const along = y / 95;
				const span = 22 * Math.sin(Math.PI * along ** 0.7);
				for (const side of [-1, 1]) {
					const tone = shade(base, 0.8 + p.rng.next() * 0.34);
					for (let step = 0; step <= span; step += 0.5) {
						const t = step / Math.max(span, 1);
						const half = 1.7 * (1 - t) ** 0.5;
						const px = 24 + side * step;
						const py = y + step * 0.62;
						for (let d = -half; d <= half; d += 0.5) {
							p.set(px, py + d, shade(tone, d < 0 ? 1.1 : 0.92));
						}
					}
				}
			}
			for (let y = 0; y < 96; y += 1) {
				p.set(23, y, rib);
				p.set(24, y, shade(rib, 1.2));
			}
		},
	};
}

function leafSprig(): TextureRecipe {
	return {
		size: [48, 48],
		tile: 1,
		draw: (p) => {
			p.clear();
			const base = hexToRgb(0x76a35c);
			for (let index = 0; index < 13; index += 1) {
				const angle = (index / 13) * Math.PI * 2 + p.rng.next() * 0.5;
				const reach = 9 + p.rng.next() * 7;
				const margin = 7;
				paintLeafClipped(
					p,
					24 + Math.cos(angle) * reach,
					24 + Math.sin(angle) * reach,
					angle + (p.rng.next() - 0.5) * 0.7,
					margin,
					2.8 + p.rng.next() * 0.6,
					shade(base, 0.7 + p.rng.next() * 0.42),
				);
			}
			for (let index = 0; index < 5; index += 1) {
				paintLeafClipped(
					p,
					24 + (p.rng.next() - 0.5) * 12,
					24 + (p.rng.next() - 0.5) * 12,
					p.rng.next() * Math.PI * 2,
					6.5,
					2.8,
					shade(base, 0.86 + p.rng.next() * 0.4),
				);
			}
		},
	};
}

function paintLeafClipped(
	p: PixelPainter,
	x: number,
	y: number,
	angle: number,
	length: number,
	width: number,
	color: RGB,
): void {
	const ux = Math.cos(angle);
	const uy = Math.sin(angle);
	const reach = Math.ceil(length);
	for (let dy = -reach; dy <= reach; dy += 1) {
		for (let dx = -reach; dx <= reach; dx += 1) {
			const px = Math.round(x + dx);
			const py = Math.round(y + dy);
			if (px < 1 || py < 1 || px > 46 || py > 46) {
				continue;
			}
			const along = (dx * ux + dy * uy) / length;
			const across = -dx * uy + dy * ux;
			const limit = width * Math.max(0, 1 - along * along);
			if (along < -1 || along > 1 || Math.abs(across) > limit) {
				continue;
			}
			p.set(px, py, shade(color, Math.abs(across) < 0.5 ? 1.2 : 1));
		}
	}
}

function terracotta(): TextureRecipe {
	return {
		size: [48, 32],
		tile: [0.6, 0.4],
		draw: (p) => {
			const clay = hexToRgb(0xa8603c);
			for (let y = 0; y < 32; y += 1) {
				const band = 1 + Math.sin((y / 32) * Math.PI * 6) * 0.025;
				for (let x = 0; x < 48; x += 1) {
					p.setRaw(x, y, shade(clay, band + (p.rng.next() - 0.5) * 0.05), 255);
				}
			}
			p.stain(4, shade(clay, 0.78), 7, 36);
			p.speckle(10, shade(clay, 1.25), 90);
		},
	};
}

function veinedStone(
	base: number,
	vein: number,
	veins: number,
	strength: number,
): TextureRecipe {
	return {
		size: [64, 64],
		tile: 1,
		draw: (p) => {
			const baseColor = hexToRgb(base);
			const veinColor = hexToRgb(vein);
			p.fill(baseColor);
			p.stain(6, shade(baseColor, 0.86), 15, 34);
			p.stain(4, shade(baseColor, 1.12), 11, 26);
			for (let index = 0; index < veins; index += 1) {
				const origin = p.rng.int(0, 63);
				const phase = p.rng.next() * Math.PI * 2;
				const wander = 3 + p.rng.next() * 6;
				const slant = p.rng.int(-1, 1) * 64;
				for (let y = 0; y < 64; y += 1) {
					const t = (y / 64) * Math.PI * 2;
					const x =
						origin +
						(y / 64) * slant +
						Math.sin(t + phase) * wander +
						Math.sin(t * 3 + phase * 2) * 1.8;
					p.set(x, y, veinColor, strength);
					p.set(x + 1, y, veinColor, strength * 0.4);
				}
			}
			p.noise(0.025);
		},
	};
}

function grainedStone(
	base: number,
	dark: number,
	light: number,
	grains: number,
): TextureRecipe {
	return {
		size: [48, 48],
		tile: 0.75,
		draw: (p) => {
			const baseColor = hexToRgb(base);
			p.fill(baseColor);
			p.stain(5, shade(baseColor, 0.9), 12, 30);
			p.speckle(grains, hexToRgb(dark), 90);
			p.speckle(Math.round(grains * 0.7), hexToRgb(light), 80);
			p.noise(0.05);
		},
	};
}

function beddedStone(base: number, band: number): TextureRecipe {
	return {
		size: [48, 48],
		tile: 1,
		draw: (p) => {
			const baseColor = hexToRgb(base);
			const bandColor = hexToRgb(band);
			p.fill(baseColor);
			for (let row = 0; row < 7; row += 1) {
				const y = p.rng.int(0, 47);
				const thickness = p.rng.int(1, 4);
				for (let x = 0; x < 48; x += 1) {
					const wave = Math.round(Math.sin((x / 48) * Math.PI * 2 + row) * 1.2);
					p.rect(x, y + wave, 1, thickness, bandColor, 60);
				}
			}
			p.speckle(40, shade(baseColor, 0.8), 120);
			p.noise(0.06);
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
	velvetPurple: fabric(0x46264f, "plain"),
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
		size: [64, 64],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0xd9d4c8));
			p.stain(5, hexToRgb(0xc4bfb4), 16, 26);
			for (let index = 0; index < 3; index += 1) {
				const origin = p.rng.int(0, 63);
				const phase = p.rng.next() * Math.PI * 2;
				const wander = 3 + p.rng.next() * 4;
				const vein = hexToRgb(0x9c978c);
				for (let y = 0; y < 64; y += 1) {
					const t = (y / 64) * Math.PI * 2;
					const x =
						origin +
						Math.sin(t + phase) * wander +
						Math.sin(t * 3 + phase * 2) * 1.6;
					p.set(x, y, vein, 74);
					p.set(x + 1, y, vein, 28);
				}
			}
			p.noise(0.025);
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
	marbleBlack: veinedStone(0x24242a, 0xc0bcae, 4, 150),
	marbleRose: veinedStone(0xc49a92, 0x7a4a48, 4, 110),
	marbleGreen: veinedStone(0x2c5546, 0xa8cfae, 5, 130),
	marbleGold: veinedStone(0xd2c29c, 0x8a6a30, 3, 120),
	limestone: grainedStone(0xbcb29a, 0x8e856f, 0xd8cfb8, 150),
	granite: grainedStone(0x6c6c70, 0x2c2c30, 0xb4b4b8, 340),
	basalt: grainedStone(0x35373c, 0x1e2024, 0x54575c, 220),
	sandstone: beddedStone(0xb48c5c, 0x8c6638),
	slate: beddedStone(0x4a525a, 0x323840),
	terracotta: terracotta(),
	leafBlade: leafBlade(),
	palmFrond: palmFrond(),
	leafSprig: leafSprig(),
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
