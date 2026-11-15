import {
	hexToRgb,
	mix,
	type PixelPainter,
	type RGB,
	shade,
} from "./PixelPainter";
import type { TextureRecipe } from "./surfaceTextures";

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

export const OBJECT_TEXTURES: Record<string, TextureRecipe> = {
	velvetRed: fabric(0x6a1a22, "plain"),
	velvetGreen: fabric(0x23402e, "plain"),
	velvetBlue: fabric(0x22305a, "plain"),
	velvetPurple: fabric(0x46264f, "plain"),
	linen: fabric(0xd8cfba, "weave"),
	burlap: fabric(0x8a7048, "weave"),
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
	leafBlade: leafBlade(),
	palmFrond: palmFrond(),
	leafSprig: leafSprig(),
	foliage: leaves(0x3f7a34),
	foliageDark: leaves(0x2a5a2a),
	foliageWarm: leaves(0x6a7a2a),
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
	flameNeutral: {
		size: [16, 32],
		tile: 1,
		draw: (p) => {
			p.clear();
			for (let y = 0; y < 32; y += 1) {
				const width = Math.round(
					Math.sin((y / 32) * Math.PI) * 7 * (y / 32 + 0.3),
				);
				const color: RGB = mix(
					hexToRgb(0xffffff),
					hexToRgb(0xa8a8a8),
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
