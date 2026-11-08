import {
	DEFAULT_HAT_PATTERN,
	HAT_PATTERNS,
	type HatPattern,
} from "@shared/hatPatterns";
import { colorHex, PLAYER_COLOR_CHOICES } from "@shared/playerColors";
import {
	hexToRgb,
	mix,
	type PixelPainter,
	type RGB,
	shade,
} from "./PixelPainter";
import type { TextureRecipe } from "./surfaceTextures";

const CREAM = 0xf5eedf;
const CAP_WIDTH = 64;
const CAP_HEIGHT = 32;

type PatternPainter = (p: PixelPainter, light: RGB, base: RGB) => void;

function star(p: PixelPainter, cx: number, cy: number, color: RGB): void {
	for (let offset = -2; offset <= 2; offset += 1) {
		p.set(cx + offset, cy, color);
		p.set(cx, cy + offset, color);
	}
	for (const [dx, dy] of [
		[-1, -1],
		[1, -1],
		[-1, 1],
		[1, 1],
	] as const) {
		p.set(cx + dx, cy + dy, color);
	}
}

const WEB_SPOKES = 5;
const WEB_RINGS = [9, 18, 28];

const PATTERN_PAINTERS: Record<HatPattern, PatternPainter> = {
	hearts: (p) => {
		const heart: RGB = hexToRgb(0xff5a8a);
		const shine: RGB = hexToRgb(0xffc2d6);
		for (let index = 0; index < 6; index += 1) {
			const x = 5 + index * 11;
			const y = 8 + (index % 2) * 10;
			p.circle(x - 1.6, y, 2.2, heart);
			p.circle(x + 1.6, y, 2.2, heart);
			for (let row = 0; row < 4; row += 1) {
				p.rect(x - 3 + row, y + 1 + row, 7 - row * 2, 1, heart);
			}
			p.set(x - 2, y - 1, shine);
		}
	},
	// Des filaments qui se ramifient depuis le sommet, comme le réseau sous la terre.
	mycelium: (p, light) => {
		const thread: RGB = shade(light, 1.05);
		for (let root = 0; root < 6; root += 1) {
			let x = 5 + root * 11;
			let drift = root % 2 === 0 ? 0.35 : -0.35;
			for (let y = 0; y < CAP_HEIGHT - 3; y += 1) {
				p.set(Math.round(x) % CAP_WIDTH, y, thread, 230);
				if (y % 7 === 6) {
					for (let step = 1; step < 5; step += 1) {
						p.set(
							(Math.round(x) + step * Math.sign(drift)) % CAP_WIDTH,
							y + step,
							thread,
							180,
						);
					}
					drift = -drift;
				}
				x += drift + (p.rng.next() - 0.5) * 0.4;
			}
			p.circle(Math.round(x) % CAP_WIDTH, CAP_HEIGHT - 4, 1.2, thread);
		}
	},
	lightning: (p) => {
		const bolt: RGB = hexToRgb(0xffe14d);
		for (let index = 0; index < 4; index += 1) {
			const left = 4 + index * 16;
			for (let y = 1; y < CAP_HEIGHT - 3; y += 1) {
				const phase = y % 12;
				const x = left + (phase < 8 ? 8 - phase : phase - 8);
				p.rect(x, y, 3, 1, bolt);
			}
		}
	},
	eyes: (p, light) => {
		const dark: RGB = hexToRgb(0x14100f);
		for (let index = 0; index < 5; index += 1) {
			const x = 6 + index * 13;
			const y = 9 + (index % 2) * 10;
			p.circle(x, y, 4, light);
			p.circle(x, y, 1.8, dark);
			p.set(x + 1, y - 1, light);
		}
	},
	laurel: (p, _light, base) => {
		const leaf: RGB = hexToRgb(0x8fce55);
		const shadow: RGB = shade(leaf, 0.65);
		p.rect(0, CAP_HEIGHT - 12, CAP_WIDTH, 2, shade(base, 0.6));
		for (let x = 0; x < CAP_WIDTH; x += 6) {
			for (let step = 0; step < 4; step += 1) {
				p.set(x + step, CAP_HEIGHT - 13 - step, leaf);
				p.set(x + step + 1, CAP_HEIGHT - 13 - step, shadow);
				p.set(x + step, CAP_HEIGHT - 10 + step, leaf);
				p.set(x + step + 1, CAP_HEIGHT - 10 + step, shadow);
			}
		}
	},
	// Le haut de la texture devient le sommet du chapeau : les rayons y convergent.
	web: (p, light) => {
		const spacing = CAP_WIDTH / WEB_SPOKES;
		for (let spoke = 0; spoke < WEB_SPOKES; spoke += 1) {
			const x = Math.round(spoke * spacing);
			for (let y = 0; y < CAP_HEIGHT; y += 1) {
				p.set(x, y, light, 240);
			}
		}
		for (const [index, ring] of WEB_RINGS.entries()) {
			const sag = 3 + index;
			let previous = ring;
			for (let x = 0; x <= CAP_WIDTH; x += 1) {
				const along = (x % spacing) / spacing;
				const y = Math.round(ring - Math.sin(along * Math.PI) * sag);
				for (
					let step = Math.min(previous, y);
					step <= Math.max(previous, y);
					step += 1
				) {
					p.set(x % CAP_WIDTH, step, light, 240);
				}
				previous = y;
			}
		}
	},
	flames: (p, _light, base) => {
		const hot: RGB = hexToRgb(0xffb12e);
		const core: RGB = hexToRgb(0xfff0a0);
		for (let x = 0; x < CAP_WIDTH; x += 1) {
			const tip = 8 + Math.abs(Math.sin(x * 0.39)) * 12 + Math.sin(x * 1.3) * 2;
			for (let y = Math.round(tip); y < CAP_HEIGHT; y += 1) {
				p.set(x, y, y > tip + 6 ? core : hot, 240);
			}
		}
		p.rect(0, 0, CAP_WIDTH, 3, shade(base, 0.7), 150);
	},
	skull: (p, light) => {
		const dark: RGB = shade(light, 0.2);
		for (let index = 0; index < 5; index += 1) {
			const x = 6 + index * 13;
			const y = 9 + (index % 2) * 9;
			p.circle(x, y, 4.4, light);
			p.rect(x - 2, y + 3, 5, 3, light);
			p.circle(x - 1.8, y - 0.4, 1.2, dark);
			p.circle(x + 1.8, y - 0.4, 1.2, dark);
			p.set(x, y + 2, dark);
			p.set(x - 1, y + 5, dark);
			p.set(x + 1, y + 5, dark);
		}
	},
	crown: (p, _light, base) => {
		const gold: RGB = hexToRgb(0xf2c23a);
		const gem: RGB = hexToRgb(0xd63a5a);
		p.rect(0, CAP_HEIGHT - 11, CAP_WIDTH, 7, gold, 245);
		for (let index = 0; index < 8; index += 1) {
			const x = 4 + index * 8;
			for (let step = 0; step < 7; step += 1) {
				p.rect(
					x - 3 + Math.ceil(step / 2),
					CAP_HEIGHT - 12 - step,
					Math.max(1, 7 - step),
					1,
					gold,
					245,
				);
			}
			p.circle(x, CAP_HEIGHT - 8, 1.3, gem);
		}
		p.rect(0, CAP_HEIGHT - 4, CAP_WIDTH, 2, shade(base, 0.75), 180);
	},
	spots: (p, light) => {
		for (let index = 0; index < 9; index += 1) {
			const x = 4 + index * 7 + p.rng.int(-1, 1);
			const y = 6 + ((index * 11) % 18);
			const radius = 1.8 + p.rng.next() * 1.6;
			p.circle(x, y, radius, light);
			p.circle(x - 0.6, y - 0.6, radius * 0.4, shade(light, 1.08));
		}
	},
	plain: (p, _light, base) => {
		p.rect(0, CAP_HEIGHT - 4, CAP_WIDTH, 4, shade(base, 0.82), 150);
		p.speckle(10, shade(base, 0.86), 120);
	},
	speckles: (p, light) => {
		for (let index = 0; index < 70; index += 1) {
			const x = p.rng.next() * CAP_WIDTH;
			const y = 2 + p.rng.next() * (CAP_HEIGHT - 6);
			p.circle(x, y, 0.6 + p.rng.next() * 0.6, light, 230);
		}
	},
	stripes: (p, light) => {
		for (let x = 0; x < CAP_WIDTH; x += 1) {
			if (x % 8 < 3) {
				for (let y = 2; y < CAP_HEIGHT - 2; y += 1) {
					p.set(x, y, light, 225);
				}
			}
		}
	},
	rings: (p, light) => {
		for (const top of [5, 14, 23]) {
			p.rect(0, top, CAP_WIDTH, 3, light, 225);
			p.rect(0, top + 3, CAP_WIDTH, 1, shade(light, 0.85), 120);
		}
	},
	stars: (p, light) => {
		for (let index = 0; index < 8; index += 1) {
			star(p, 4 + index * 8 + p.rng.int(-1, 1), 6 + ((index * 7) % 18), light);
		}
	},
	scales: (p, light) => {
		for (let row = 0; row < 5; row += 1) {
			const cy = 3 + row * 6;
			for (let column = 0; column < 8; column += 1) {
				const cx = column * 8 + (row % 2) * 4;
				for (let step = 0; step <= 12; step += 1) {
					const angle = (step / 12) * Math.PI;
					p.set(
						cx + Math.cos(angle) * 3.6,
						cy + Math.sin(angle) * 3,
						light,
						230,
					);
				}
			}
		}
	},
	swirl: (p, light) => {
		for (let y = 0; y < CAP_HEIGHT - 2; y += 1) {
			for (let x = 0; x < CAP_WIDTH; x += 1) {
				if ((x + y * 2) % 16 < 5) {
					p.set(x, y, light, 220);
				}
			}
		}
	},
};

export function capRecipe(color: number, pattern: HatPattern): TextureRecipe {
	return {
		size: [CAP_WIDTH, CAP_HEIGHT],
		tile: 1,
		draw: (p) => {
			const base = hexToRgb(color);
			for (let y = 0; y < CAP_HEIGHT; y += 1) {
				p.rect(0, y, CAP_WIDTH, 1, shade(base, 1.12 - (y / CAP_HEIGHT) * 0.28));
			}
			p.noise(0.08);
			PATTERN_PAINTERS[pattern](p, hexToRgb(CREAM), base);
		},
	};
}

export function capTextureKey(
	color: number,
	pattern: HatPattern = DEFAULT_HAT_PATTERN,
): string {
	return `cap-${colorHex(color)}-${pattern}`;
}

const CAP_TEXTURES: Record<string, TextureRecipe> = Object.fromEntries(
	PLAYER_COLOR_CHOICES.flatMap((color) =>
		HAT_PATTERNS.map((pattern) => [
			capTextureKey(color, pattern),
			capRecipe(color, pattern),
		]),
	),
);

export const CREATURE_TEXTURES: Record<string, TextureRecipe> = {
	...CAP_TEXTURES,
	mushroomSkin: {
		size: [32, 32],
		tile: 0.35,
		draw: (p) => {
			p.fill(hexToRgb(0xf0e4cb));
			for (let y = 0; y < 32; y += 1) {
				p.rect(0, y, 32, 1, shade(hexToRgb(0xf0e4cb), 1.03 - (y % 16) * 0.004));
			}
			p.noise(0.035, 2);
			p.speckle(14, hexToRgb(0xdcc9a6), 200);
			p.speckle(5, hexToRgb(0xe8b8a4), 160);
		},
	},
	stem: {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0xe8dfc8));
			for (let x = 0; x < 32; x += 4) {
				p.rect(x, 0, 1, 32, hexToRgb(0xd8ccb0), 120);
			}
			p.noise(0.05);
		},
	},
	mushroomStem: {
		size: [32, 64],
		tile: 1,
		draw: (p) => {
			const bottom = hexToRgb(0xd8c9a8);
			const top = hexToRgb(0xf6efe0);
			for (let y = 0; y < 64; y += 1) {
				p.rect(
					0,
					y,
					32,
					1,
					mix(top, bottom, Math.min(1, (y / 64) ** 1.6 * 1.2)),
				);
			}
			for (let x = 1; x < 32; x += 3) {
				let column = x;
				for (let y = 6; y < 64; y += 1) {
					column += p.rng.int(-1, 1) * (y % 5 === 0 ? 1 : 0);
					p.set(column, y, hexToRgb(0xc9b894), 50 + y);
				}
			}
			p.noise(0.035);
		},
	},
	tanLeather: {
		size: [32, 32],
		tile: 0.4,
		draw: (p) => {
			p.fill(hexToRgb(0x9a6a40));
			p.noise(0.16, 2);
			p.noise(0.06);
			p.stain(3, hexToRgb(0x7a4e2c), 5, 90);
		},
	},
	gills: {
		size: [64, 8],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0xcbb998));
			for (let x = 0; x < 64; x += 4) {
				p.rect(x, 0, 1, 8, hexToRgb(0xa8936c));
			}
		},
	},
	clothPale: {
		size: [32, 64],
		tile: 1,
		draw: (p) => {
			for (let x = 0; x < 32; x += 1) {
				const fold = Math.sin(x * 0.8) * 0.12 + Math.sin(x * 2.1) * 0.05;
				p.rect(x, 0, 1, 64, shade(hexToRgb(0x8d8a9a), 1 + fold));
			}
			p.noise(0.1);
			for (let x = 0; x < 32; x += 1) {
				const tear = 56 + Math.round(p.rng.next() * 8);
				p.rect(x, tear, 1, 64 - tear, shade(hexToRgb(0x8d8a9a), 0.5));
			}
		},
	},
	eyeball: {
		size: [64, 32],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0xe8e2d0));
			for (let index = 0; index < 10; index += 1) {
				let x = p.rng.int(0, 63);
				let y = p.rng.int(0, 31);
				for (let step = 0; step < 10; step += 1) {
					p.set(x, y, hexToRgb(0xa83a2a), 160);
					x += p.rng.int(-1, 1);
					y += p.rng.int(-1, 1);
				}
			}
			p.circle(16, 16, 9, hexToRgb(0xc9a22a));
			p.circle(16, 16, 7, hexToRgb(0x8a6a1a));
			p.circle(16, 16, 4, hexToRgb(0x0a0806));
			p.circle(14, 14, 1.2, hexToRgb(0xffffff));
		},
	},
	mossDrape: {
		size: [32, 64],
		tile: 1,
		draw: (p) => {
			for (let x = 0; x < 32; x += 1) {
				const strand = 0.75 + p.rng.next() * 0.45 + Math.sin(x * 1.7) * 0.1;
				p.rect(x, 0, 1, 64, shade(hexToRgb(0x2e4a2c), strand));
			}
			p.noise(0.08);
			for (let x = 0; x < 32; x += 1) {
				const tear = 50 + Math.round(p.rng.next() * 12);
				p.rect(x, tear, 1, 64 - tear, hexToRgb(0x0e160c));
			}
		},
	},
	curtainPale: {
		size: [32, 64],
		tile: 1,
		draw: (p) => {
			for (let x = 0; x < 32; x += 1) {
				const fold =
					Math.sin((x / 32) * Math.PI * 4) * 0.14 + Math.sin(x * 1.3) * 0.04;
				p.rect(x, 0, 1, 64, shade(hexToRgb(0xd8ccb2), 1 + fold));
			}
			p.noise(0.06);
			for (let x = 0; x < 32; x += 1) {
				const tear = 54 + Math.round(p.rng.next() * 9);
				p.rect(x, tear, 1, 64 - tear, hexToRgb(0x2a2018));
			}
		},
	},
	iris: {
		size: [48, 16],
		tile: 1,
		draw: (p) => {
			for (let y = 0; y < 16; y += 1) {
				const ring = y / 15;
				p.rect(0, y, 48, 1, shade([255, 255, 255], 1 - ring ** 2.2 * 0.72));
			}
			for (let x = 0; x < 48; x += 1) {
				const tone = 0.78 + p.rng.next() * 0.3;
				for (let y = 0; y < 13; y += 1) {
					p.set(x, y, shade(p.get(x, y), tone));
				}
			}
			for (let index = 0; index < 16; index += 1) {
				p.set(p.rng.int(0, 47), p.rng.int(2, 9), [255, 255, 255], 120);
			}
		},
	},
	paperPages: {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			p.fill(hexToRgb(0xcdb98e));
			for (let y = 3; y < 32; y += 3) {
				p.rect(3, y, p.rng.int(14, 26), 1, hexToRgb(0x4a3a24), 150);
			}
			p.noise(0.1);
			p.stain(3, hexToRgb(0x8a6a3a), 5, 90);
		},
	},
};
