import {
	hexToRgb,
	mix,
	type PixelPainter,
	type RGB,
	shade,
} from "./PixelPainter";
import type { TextureRecipe } from "./surfaceTextures";

const BONE = hexToRgb(0xe2d8bc);
const BONE_SHADOW = hexToRgb(0x8a7e62);
const INK = hexToRgb(0x16100c);
const GOLD = hexToRgb(0xd8b45a);

function skullIcon(p: PixelPainter, x: number, y: number, tint = 1): void {
	const bone = shade(BONE, tint);
	p.rect(x + 1, y, 4, 1, bone);
	p.rect(x, y + 1, 6, 3, bone);
	p.rect(x + 1, y + 4, 4, 1, bone);
	p.rect(x + 1, y + 5, 1, 1, bone);
	p.rect(x + 4, y + 5, 1, 1, bone);
	p.rect(x + 1, y + 2, 1, 1, INK);
	p.rect(x + 4, y + 2, 1, 1, INK);
	p.set(x + 2.5, y + 3.5, BONE_SHADOW);
}

function butterfly(p: PixelPainter, x: number, y: number, color: RGB): void {
	p.rect(x, y, 2, 2, color);
	p.rect(x + 3, y, 2, 2, color);
	p.set(x, y + 2, shade(color, 0.8));
	p.set(x + 4, y + 2, shade(color, 0.8));
	p.rect(x + 2, y, 1, 3, INK);
	p.set(x + 1, y, shade(color, 1.3));
	p.set(x + 3, y, shade(color, 1.3));
}

function beetle(p: PixelPainter, x: number, y: number, color: RGB): void {
	p.rect(x, y + 1, 3, 3, color);
	p.set(x + 1, y, INK);
	p.rect(x + 1, y + 1, 1, 3, shade(color, 0.6));
	p.set(x - 1, y + 2, INK);
	p.set(x + 3, y + 2, INK);
}

function jar(p: PixelPainter, x: number, y: number, liquid: RGB): void {
	const glass = hexToRgb(0x9ab8a8);
	p.rect(x, y + 1, 5, 6, mix(glass, hexToRgb(0x1a1a14), 0.5));
	p.rect(x + 1, y + 3, 3, 4, liquid);
	p.rect(x, y, 5, 1, hexToRgb(0x6a4a2a));
	p.set(x + 1, y + 2, hexToRgb(0xd8e8e0));
}

function star(
	p: PixelPainter,
	x: number,
	y: number,
	color: RGB,
	big: boolean,
): void {
	p.set(x, y, color);
	if (big) {
		p.set(x - 1, y, shade(color, 0.7));
		p.set(x + 1, y, shade(color, 0.7));
		p.set(x, y - 1, shade(color, 0.7));
		p.set(x, y + 1, shade(color, 0.7));
	}
}

function wallpaperNursery(): TextureRecipe {
	return {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			const base = hexToRgb(0xb88f8a);
			p.fill(base);
			for (let x = 0; x < 32; x += 8) {
				p.rect(x, 0, 3, 32, hexToRgb(0xcdb4a4));
				p.rect(x + 3, 0, 1, 32, shade(base, 0.9));
			}
			const duck = (cx: number, cy: number) => {
				const yellow = hexToRgb(0xd8bc6a);
				p.rect(cx, cy, 3, 2, yellow);
				p.rect(cx + 2, cy - 2, 2, 2, yellow);
				p.set(cx + 4, cy - 1, hexToRgb(0xc8783a));
				p.set(cx + 3, cy - 2, INK);
			};
			duck(13, 9);
			duck(29, 25);
			star(p, 6, 22, hexToRgb(0xe8d8b8), true);
			star(p, 22, 4, hexToRgb(0xe8d8b8), true);
			p.noise(0.08);
			p.stain(3, hexToRgb(0x6a4a3a), 6, 70);
			for (let index = 0; index < 3; index += 1) {
				const x = p.rng.int(0, 31);
				for (let y = p.rng.int(0, 10); y < 32; y += 1) {
					p.set(x + (y % 5 === 0 ? 1 : 0), y, hexToRgb(0x5a3a30), 90);
				}
			}
		},
	};
}

function wallpaperStars(): TextureRecipe {
	return {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			const base = hexToRgb(0x141c38);
			p.fill(base);
			p.noise(0.12, 2);
			for (let index = 0; index < 14; index += 1) {
				star(
					p,
					p.rng.int(1, 30),
					p.rng.int(1, 30),
					mix(GOLD, hexToRgb(0xffffff), p.rng.next() * 0.5),
					p.rng.chance(0.3),
				);
			}
			const moon = (cx: number, cy: number) => {
				p.circle(cx, cy, 3, GOLD);
				p.circle(cx + 1.5, cy - 1, 2.6, base);
			};
			moon(9, 9);
			moon(25, 24);
			p.stain(2, shade(base, 0.6), 5, 80);
		},
	};
}

function armorPlate(): TextureRecipe {
	return {
		size: [32, 32],
		tile: 0.5,
		draw: (p) => {
			for (let y = 0; y < 32; y += 1) {
				p.rect(
					0,
					y,
					32,
					1,
					shade(hexToRgb(0x8a8e94), 0.8 + 0.4 * Math.sin((y / 32) * Math.PI)),
				);
			}
			for (let y = 7; y < 32; y += 8) {
				p.rect(0, y, 32, 1, hexToRgb(0x3a3c40));
				p.rect(0, y + 1, 32, 1, hexToRgb(0xc8ccd0));
				for (let x = 3; x < 32; x += 8) {
					p.set(x, y - 2, hexToRgb(0xe0e4e8));
					p.set(x + 1, y - 2, hexToRgb(0x4a4c50));
				}
			}
			p.rect(14, 0, 2, 32, hexToRgb(0xd8dce0), 140);
			p.stain(3, hexToRgb(0x6a4a2a), 4, 70);
			p.noise(0.06);
		},
	};
}

function curiosityShelves(): TextureRecipe {
	return {
		size: [48, 64],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0x3a2418));
			p.noise(0.15, 2);
			const liquids = [0x5a8a3a, 0xa83a2a, 0x3a6aa8, 0xc8a83a, 0x7a3a8a].map(
				hexToRgb,
			);
			for (let row = 0; row < 4; row += 1) {
				const top = row * 16;
				p.rect(0, top + 14, 48, 2, hexToRgb(0x6a4a2a));
				let x = 2;
				while (x < 44) {
					const kind = p.rng.int(0, 3);
					if (kind === 0) {
						jar(p, x, top + 6, p.rng.pick(liquids));
						x += 7;
					} else if (kind === 1) {
						skullIcon(p, x, top + 7);
						x += 8;
					} else if (kind === 2) {
						p.rect(x, top + 4, 7, 9, hexToRgb(0xd8c8a0));
						p.frame(x, top + 4, 7, 9, hexToRgb(0x6a4a2a));
						butterfly(p, x + 1, top + 7, p.rng.pick(liquids));
						x += 9;
					} else {
						p.circle(x + 3, top + 10, 3, hexToRgb(0x9ab8a8), 120);
						p.rect(x, top + 12, 7, 2, hexToRgb(0x6a4a2a));
						p.circle(x + 3, top + 10, 1.5, hexToRgb(0x8a6a3a));
						x += 8;
					}
				}
			}
		},
	};
}

function ossuary(): TextureRecipe {
	return {
		size: [48, 64],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0x3a3630));
			p.noise(0.2, 2);
			for (let row = 0; row < 4; row += 1) {
				const top = row * 16;
				p.rect(0, top, 48, 2, hexToRgb(0x6a645a));
				for (let x = 1; x < 46; x += 7) {
					skullIcon(p, x, top + 4 + (x % 2), 0.8 + p.rng.next() * 0.25);
				}
				for (let x = 0; x < 48; x += 2) {
					p.rect(x, top + 12, 2, 2, shade(BONE, 0.6 + p.rng.next() * 0.3));
				}
			}
			p.stain(4, hexToRgb(0x1a1612), 6, 120);
		},
	};
}

function starChart(): TextureRecipe {
	return {
		size: [48, 36],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0x1c2848));
			p.noise(0.1, 2);
			p.frame(0, 0, 48, 36, hexToRgb(0xc8b07a), 1);
			p.circle(24, 18, 15, GOLD, 180, false);
			p.circle(24, 18, 9, GOLD, 120, false);
			p.line(9, 18, 39, 18, GOLD, 90);
			p.line(24, 3, 24, 33, GOLD, 90);
			const points: [number, number][] = [];
			for (let index = 0; index < 9; index += 1) {
				const point: [number, number] = [p.rng.int(6, 42), p.rng.int(5, 31)];
				points.push(point);
				star(p, point[0], point[1], hexToRgb(0xf8f0d8), p.rng.chance(0.4));
			}
			for (let index = 1; index < 5; index += 1) {
				const [x0, y0] = points[index - 1];
				const [x1, y1] = points[index];
				p.line(x0, y0, x1, y1, hexToRgb(0xa8c0f0), 120);
			}
			p.stain(2, hexToRgb(0x6a5a3a), 5, 60);
		},
	};
}

function specimens(): TextureRecipe {
	return {
		size: [40, 30],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0xd8ccae));
			p.noise(0.06);
			const colors = [0x3a6aa8, 0xc8603a, 0x8a3a8a, 0x3a8a6a, 0xc8a83a].map(
				hexToRgb,
			);
			for (let row = 0; row < 3; row += 1) {
				for (let column = 0; column < 4; column += 1) {
					const x = 4 + column * 9;
					const y = 4 + row * 8;
					if ((row + column) % 2 === 0) {
						butterfly(p, x, y, p.rng.pick(colors));
					} else {
						beetle(p, x + 1, y, p.rng.pick(colors));
					}
					p.rect(x, y + 5, 5, 1, hexToRgb(0x8a7a5a));
				}
			}
			p.frame(0, 0, 40, 30, hexToRgb(0x3a2418), 2);
		},
	};
}

function sheetCloth(): TextureRecipe {
	return {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			for (let x = 0; x < 32; x += 1) {
				const fold = Math.sin(x * 0.55) * 0.08 + Math.sin(x * 1.7 + 1) * 0.04;
				p.rect(x, 0, 1, 32, shade(hexToRgb(0xd8d2c4), 1 + fold));
			}
			p.noise(0.05);
			p.stain(4, hexToRgb(0x9a8e78), 6, 70);
			p.speckle(20, hexToRgb(0xa89c86), 120);
		},
	};
}

function sheetHanging(): TextureRecipe {
	return {
		size: [32, 48],
		tile: 1,
		draw: (p) => {
			for (let x = 0; x < 32; x += 1) {
				const fold = Math.sin(x * 0.6) * 0.1 + Math.sin(x * 1.9) * 0.04;
				const bottom =
					40 + Math.round(Math.sin(x * 0.9) * 3 + p.rng.next() * 4);
				for (let y = 0; y < bottom; y += 1) {
					p.setRaw(x, y, shade(hexToRgb(0xd4cec0), 1 + fold - y * 0.003), 255);
				}
			}
			p.stain(3, hexToRgb(0x8a7e6a), 6, 80);
			for (let index = 0; index < 3; index += 1) {
				const x = p.rng.int(4, 27);
				const y = p.rng.int(8, 30);
				for (let dy = 0; dy < 3; dy += 1) {
					for (let dx = 0; dx < 2; dx += 1) {
						p.setRaw(x + dx, y + dy, [0, 0, 0], 0);
					}
				}
			}
		},
	};
}

function wicker(): TextureRecipe {
	return {
		size: [16, 16],
		tile: 0.25,
		draw: (p) => {
			p.fill(hexToRgb(0x8a6a3a));
			for (let y = 0; y < 16; y += 4) {
				for (let x = 0; x < 16; x += 4) {
					const horizontal = ((x + y) / 4) % 2 === 0;
					p.rect(
						x,
						y,
						horizontal ? 4 : 2,
						horizontal ? 2 : 4,
						hexToRgb(0xc8a060),
					);
				}
			}
			p.noise(0.12);
		},
	};
}

function horsePaint(): TextureRecipe {
	return {
		size: [32, 32],
		tile: 0.6,
		draw: (p) => {
			p.fill(hexToRgb(0xe8e0d0));
			for (let index = 0; index < 9; index += 1) {
				p.circle(
					p.rng.int(0, 31),
					p.rng.int(0, 31),
					2 + p.rng.next() * 2,
					hexToRgb(0x9a948a),
					160,
				);
			}
			p.rect(0, 14, 32, 4, hexToRgb(0xa82a2a));
			p.rect(0, 15, 32, 1, GOLD);
			p.noise(0.08);
			for (let index = 0; index < 4; index += 1) {
				let x = p.rng.int(0, 31);
				for (let y = p.rng.int(0, 20); y < 32; y += 1) {
					x += p.rng.int(-1, 1);
					p.set(x, y, hexToRgb(0x6a5a4a), 120);
				}
			}
		},
	};
}

function dollFace(): TextureRecipe {
	return {
		size: [32, 16],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0xf0e2d4));
			p.noise(0.05);
			for (const x of [6, 10]) {
				p.rect(x, 7, 2, 2, hexToRgb(0x1a2a4a));
				p.set(x, 7, hexToRgb(0xffffff));
			}
			p.rect(8, 11, 2, 1, hexToRgb(0xa82a2a));
			p.set(5, 10, hexToRgb(0xe8a0a0));
			p.set(12, 10, hexToRgb(0xe8a0a0));
			p.line(11, 2, 13, 8, hexToRgb(0x6a5a50));
			const hair = hexToRgb(0x6a3a1a);
			p.rect(0, 0, 32, 4, hair);
			p.rect(15, 4, 17, 8, hair);
			p.rect(1, 4, 2, 6, hair);
			p.rect(13, 4, 2, 6, hair);
		},
	};
}

function sarcophagusLid(): TextureRecipe {
	return {
		size: [32, 64],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0x8a8478));
			p.noise(0.15, 2);
			const light = hexToRgb(0xb0aa9c);
			const dark = hexToRgb(0x5a554c);
			p.circle(16, 10, 5, light);
			p.rect(11, 15, 10, 30, light);
			p.rect(10, 22, 12, 3, dark);
			p.rect(12, 21, 8, 1, light);
			p.rect(9, 45, 6, 14, light);
			p.rect(17, 45, 6, 14, light);
			p.rect(15, 15, 2, 30, dark, 120);
			p.set(14, 9, dark);
			p.set(18, 9, dark);
			p.frame(1, 1, 30, 62, dark, 1);
			p.stain(3, hexToRgb(0x4a5a3a), 6, 90);
		},
	};
}

function cageBars(): TextureRecipe {
	return {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			p.clear();
			const brass = hexToRgb(0xb89048);
			for (let x = 1; x < 32; x += 4) {
				for (let y = 0; y < 32; y += 1) {
					p.setRaw(x, y, shade(brass, 0.85 + (y % 6 === 0 ? 0.25 : 0)), 255);
				}
			}
			for (const y of [0, 1, 15, 30, 31]) {
				for (let x = 0; x < 32; x += 1) {
					p.setRaw(x, y, shade(brass, 1.1), 255);
				}
			}
		},
	};
}

function spindles(): TextureRecipe {
	return {
		size: [32, 16],
		tile: 1,
		draw: (p) => {
			p.clear();
			const wood = hexToRgb(0xe4dcc8);
			for (let x = 1; x < 32; x += 4) {
				for (let y = 0; y < 16; y += 1) {
					p.setRaw(x, y, shade(wood, 0.9), 255);
					p.setRaw(x + 1, y, wood, 255);
				}
			}
			for (const y of [0, 1, 14, 15]) {
				for (let x = 0; x < 32; x += 1) {
					p.setRaw(x, y, shade(wood, 1.05), 255);
				}
			}
		},
	};
}

function fur(): TextureRecipe {
	return {
		size: [16, 16],
		tile: 0.3,
		draw: (p) => {
			p.fill(hexToRgb(0x6a4a2e));
			for (let index = 0; index < 40; index += 1) {
				const x = p.rng.int(0, 15);
				const y = p.rng.int(0, 15);
				p.line(
					x,
					y,
					x + p.rng.int(-1, 1),
					y + 2,
					p.rng.chance(0.5) ? hexToRgb(0x8a6a44) : hexToRgb(0x4a321e),
				);
			}
		},
	};
}

function boneTexture(): TextureRecipe {
	return {
		size: [16, 16],
		tile: 0.3,
		draw: (p) => {
			p.fill(BONE);
			p.noise(0.1);
			p.speckle(10, BONE_SHADOW, 140);
		},
	};
}

export const CURIO_TEXTURES: Record<string, TextureRecipe> = {
	wallpaperNursery: wallpaperNursery(),
	wallpaperStars: wallpaperStars(),
	armorPlate: armorPlate(),
	curiosityShelves: curiosityShelves(),
	ossuary: ossuary(),
	starChart: starChart(),
	specimens: specimens(),
	sheetCloth: sheetCloth(),
	sheetHanging: sheetHanging(),
	wicker: wicker(),
	horsePaint: horsePaint(),
	dollFace: dollFace(),
	sarcophagusLid: sarcophagusLid(),
	cageBars: cageBars(),
	spindles: spindles(),
	fur: fur(),
	bone: boneTexture(),
};
