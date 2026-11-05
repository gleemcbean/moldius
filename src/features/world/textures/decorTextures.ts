import {
	hexToRgb,
	mix,
	type PixelPainter,
	type RGB,
	shade,
} from "./PixelPainter";
import type { TextureRecipe } from "./surfaceTextures";

function rug(
	field: number,
	border: number,
	accent: number,
	round: boolean,
): TextureRecipe {
	return {
		size: [48, 64],
		tile: 1,
		draw: (p) => {
			const fieldColor = hexToRgb(field);
			const borderColor = hexToRgb(border);
			const accentColor = hexToRgb(accent);
			p.clear();
			for (let y = 0; y < 64; y += 1) {
				for (let x = 0; x < 48; x += 1) {
					const nx = (x - 23.5) / 24;
					const ny = (y - 31.5) / 32;
					if (round && nx * nx + ny * ny > 1) {
						continue;
					}
					const edge = round
						? 1 - Math.sqrt(nx * nx + ny * ny)
						: Math.min(x, y, 47 - x, 63 - y) / 24;
					let color = fieldColor;
					if (edge < 0.12) {
						color = borderColor;
					} else if (edge < 0.16) {
						color = accentColor;
					} else if (edge < 0.24) {
						color = (x + y) % 4 < 2 ? shade(borderColor, 1.2) : borderColor;
					}
					const diamond = Math.abs(x - 23.5) / 12 + Math.abs(y - 31.5) / 16;
					if (diamond < 1 && diamond > 0.8) {
						color = accentColor;
					} else if (diamond < 0.35) {
						color = shade(accentColor, 0.85);
					}
					p.setRaw(x, y, shade(color, 0.92 + p.rng.next() * 0.14), 255);
				}
			}
		},
	};
}

function painting(draw: (p: PixelPainter) => void): TextureRecipe {
	return {
		size: [32, 40],
		tile: 1,
		draw: (p) => {
			draw(p);
			p.noise(0.1);
			p.frame(0, 0, 32, 40, hexToRgb(0x7a5a24), 2);
			p.frame(2, 2, 28, 36, hexToRgb(0x3a2a12), 1);
		},
	};
}

function gradientSky(p: PixelPainter, top: number, bottom: number): void {
	for (let y = 0; y < 40; y += 1) {
		p.rect(0, y, 32, 1, mix(hexToRgb(top), hexToRgb(bottom), y / 40));
	}
}

function glyphCircle(
	size: number,
	color: RGB,
	ringCount: number,
): (p: PixelPainter) => void {
	return (p) => {
		p.clear();
		const center = size / 2 - 0.5;
		for (let ring = 0; ring < ringCount; ring += 1) {
			const radius = center - 2 - ring * (size / 9);
			p.circle(center, center, radius, color, 230, false);
			p.circle(center, center, radius - 1, color, 150, false);
			const marks = 10 + ring * 6;
			for (let index = 0; index < marks; index += 1) {
				const angle = (index / marks) * Math.PI * 2 + ring * 0.3;
				const inner = radius - size / 18;
				const x = center + (Math.cos(angle) * (radius + inner)) / 2;
				const y = center + (Math.sin(angle) * (radius + inner)) / 2;
				const glyph = p.rng.int(0, 3);
				if (glyph === 0) {
					p.line(
						Math.round(x - 1),
						Math.round(y - 2),
						Math.round(x + 1),
						Math.round(y + 2),
						color,
						220,
					);
				} else if (glyph === 1) {
					p.circle(x, y, 1.4, color, 210, false);
				} else {
					p.rect(Math.round(x - 1), Math.round(y - 1), 3, 1, color, 220);
					p.rect(Math.round(x), Math.round(y - 2), 1, 4, color, 220);
				}
			}
		}
		const points = 5;
		const radius = center - 2 - (ringCount - 1) * (size / 9) - size / 14;
		for (let index = 0; index < points; index += 1) {
			const a = (index / points) * Math.PI * 2 - Math.PI / 2;
			const b = ((index + 2) / points) * Math.PI * 2 - Math.PI / 2;
			p.line(
				Math.round(center + Math.cos(a) * radius),
				Math.round(center + Math.sin(a) * radius),
				Math.round(center + Math.cos(b) * radius),
				Math.round(center + Math.sin(b) * radius),
				color,
				220,
			);
		}
	};
}

export const DECOR_TEXTURES: Record<string, TextureRecipe> = {
	rugPersian: rug(0x6a1c1c, 0x1f2a4a, 0xc9a24a, false),
	rugBlue: rug(0x1e2c4c, 0x6a3a1a, 0xb9b08a, false),
	rugGreen: rug(0x24402a, 0x4a1f1f, 0xc4a65a, false),
	rugRound: rug(0x5a2a4a, 0x1d1d26, 0xc9a24a, true),
	rugRunner: rug(0x5c1a1e, 0x2a1a12, 0xb8913c, false),
	paintingLandscape: painting((p) => {
		gradientSky(p, 0x2a3a5a, 0xa57a4a);
		for (let x = 0; x < 32; x += 1) {
			const hill = 26 + Math.round(Math.sin(x * 0.3) * 3);
			p.rect(x, hill, 1, 40 - hill, hexToRgb(0x2a3a1e));
		}
		p.circle(22, 12, 3, hexToRgb(0xe9d48a));
		p.rect(8, 18, 3, 9, hexToRgb(0x1e1a14));
		p.rect(6, 15, 7, 4, hexToRgb(0x223018));
	}),
	paintingPortrait: painting((p) => {
		gradientSky(p, 0x2a1a14, 0x120c08);
		p.circle(16, 15, 6, hexToRgb(0xc9a07a));
		p.rect(10, 11, 12, 3, hexToRgb(0x2a1a10));
		p.rect(7, 22, 18, 18, hexToRgb(0x3a1a2a));
		p.rect(14, 22, 4, 5, hexToRgb(0xe8e0d0));
		p.set(13, 15, hexToRgb(0x120c08));
		p.set(18, 15, hexToRgb(0x120c08));
	}),
	paintingMushroom: painting((p) => {
		gradientSky(p, 0x1a2a1a, 0x0c140c);
		p.rect(13, 20, 6, 14, hexToRgb(0xe6dcc4));
		p.circle(16, 19, 9, hexToRgb(0xa8342a));
		p.rect(6, 20, 21, 4, hexToRgb(0x120c08));
		p.circle(13, 15, 1.5, hexToRgb(0xf2ead8));
		p.circle(19, 13, 1.5, hexToRgb(0xf2ead8));
	}),
	paintingStillLife: painting((p) => {
		gradientSky(p, 0x3a2a1a, 0x1a120a);
		p.rect(4, 30, 24, 4, hexToRgb(0x5a3a1a));
		p.circle(11, 26, 4, hexToRgb(0x8a2a1a));
		p.circle(19, 27, 3, hexToRgb(0x6a8a2a));
		p.rect(22, 16, 3, 12, hexToRgb(0x2a4a5a));
	}),
	paintingStorm: painting((p) => {
		gradientSky(p, 0x1a1a24, 0x3a3a4a);
		p.line(18, 4, 14, 16, hexToRgb(0xf0f0c0));
		p.line(14, 16, 20, 18, hexToRgb(0xf0f0c0));
		p.line(20, 18, 16, 30, hexToRgb(0xf0f0c0));
		p.rect(0, 32, 32, 8, hexToRgb(0x10141a));
		p.rect(5, 24, 6, 9, hexToRgb(0x0a0a0c));
		p.rect(7, 21, 2, 3, hexToRgb(0x0a0a0c));
	}),
	paintingAbstract: painting((p) => {
		gradientSky(p, 0x40284a, 0x182030);
		for (let index = 0; index < 6; index += 1) {
			p.circle(
				p.rng.int(6, 26),
				p.rng.int(6, 34),
				p.rng.range(2, 6),
				shade(hexToRgb(0xc9a24a), 0.6 + p.rng.next()),
				200,
			);
		}
	}),
	tapestry: {
		size: [32, 48],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0x3a1a22));
			p.frame(0, 0, 32, 48, hexToRgb(0xb8913c), 2);
			glyphCircle(32, hexToRgb(0xc9a24a), 2)(p);
			for (let y = 0; y < 48; y += 1) {
				for (let x = 0; x < 32; x += 1) {
					if (p.get(x, y)[0] === 0 && p.get(x, y)[1] === 0) {
						p.setRaw(
							x,
							y,
							shade(hexToRgb(0x3a1a22), 0.9 + ((x + y) % 3) * 0.05),
							255,
						);
					}
				}
			}
			p.frame(0, 0, 32, 48, hexToRgb(0xb8913c), 2);
			p.rect(0, 44, 32, 4, hexToRgb(0x2a1218));
			for (let x = 1; x < 32; x += 3) {
				p.rect(x, 46, 1, 2, hexToRgb(0xb8913c));
			}
		},
	},
	ritualCircle: {
		size: [96, 96],
		tile: 1,
		draw: glyphCircle(96, hexToRgb(0xb21e2a), 3),
	},
	archivistCircle: {
		size: [128, 128],
		tile: 1,
		draw: glyphCircle(128, hexToRgb(0xf2d36a), 4),
	},
	occultCircle: {
		size: [128, 128],
		tile: 1,
		draw: (p) => {
			const turquoise = hexToRgb(0x2ee6d6);
			glyphCircle(128, turquoise, 2)(p);
			const tips = Array.from({ length: 5 }, (_, index) => {
				const angle = (index / 5) * Math.PI * 2 - Math.PI / 2;
				return [
					Math.round(63.5 + Math.cos(angle) * 44),
					Math.round(63.5 + Math.sin(angle) * 44),
				];
			});
			for (let index = 0; index < 5; index += 1) {
				const [x0, y0] = tips[index];
				const [x1, y1] = tips[(index + 2) % 5];
				p.line(x0, y0, x1, y1, turquoise, 240);
				p.line(x0 + 1, y0, x1 + 1, y1, turquoise, 200);
			}
		},
	},
	bloodStain: {
		size: [64, 64],
		tile: 1,
		draw: (p) => {
			p.clear();
			const dark = hexToRgb(0x4a0606);
			const fresh = hexToRgb(0x7c0e0e);
			for (let index = 0; index < 7; index += 1) {
				p.circle(
					32 + p.rng.range(-9, 9),
					32 + p.rng.range(-9, 9),
					p.rng.range(5, 11),
					index % 2 === 0 ? dark : fresh,
					235,
				);
			}
			for (let index = 0; index < 18; index += 1) {
				const angle = p.rng.range(0, Math.PI * 2);
				const distance = p.rng.range(16, 30);
				p.circle(
					32 + Math.cos(angle) * distance,
					32 + Math.sin(angle) * distance,
					p.rng.range(0.6, 2.4),
					fresh,
					220,
				);
			}
		},
	},
	bloodSmear: {
		size: [64, 64],
		tile: 1,
		draw: (p) => {
			p.clear();
			const dark = hexToRgb(0x520808);
			const fresh = hexToRgb(0x861212);
			for (let x = 6; x < 58; x += 1) {
				const thickness = 5 + Math.sin(x * 0.21) * 2 + (58 - x) * 0.08;
				const y = 32 + Math.sin(x * 0.09) * 6;
				for (let dy = -thickness; dy <= thickness; dy += 1) {
					if (p.rng.next() < 0.85 - Math.abs(dy) / (thickness * 2.2)) {
						p.set(x, y + dy, x % 5 === 0 ? dark : fresh, 225);
					}
				}
			}
			p.circle(10, 32, 9, dark, 235);
			for (let index = 0; index < 10; index += 1) {
				p.circle(
					p.rng.range(4, 60),
					p.rng.range(14, 50),
					p.rng.range(0.6, 2),
					fresh,
					210,
				);
			}
		},
	},
	pondWater: {
		size: [64, 64],
		tile: 2,
		draw: (p) => {
			p.fill(hexToRgb(0x1d4743));
			p.noise(0.18, 2);
			const ripple = hexToRgb(0x4f8f86);
			for (let index = 0; index < 14; index += 1) {
				p.circle(
					p.rng.int(0, 63),
					p.rng.int(0, 63),
					p.rng.range(3, 9),
					ripple,
					70,
					false,
				);
			}
			p.speckle(30, hexToRgb(0xa9d6cc), 90);
		},
	},
};
