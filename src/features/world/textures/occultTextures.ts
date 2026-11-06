import { hexToRgb, type RGB } from "./PixelPainter";
import type { TextureRecipe } from "./surfaceTextures";

const GLOW: RGB = [255, 255, 255];

function pentacle(): TextureRecipe {
	return {
		size: [64, 64],
		tile: 1,
		draw: (p) => {
			p.clear();
			const center = 31.5;
			for (const radius of [30, 29, 28]) {
				p.circle(center, center, radius, GLOW, 255, false);
			}
			for (let index = 0; index < 5; index += 1) {
				const a = (index / 5) * Math.PI * 2 - Math.PI / 2;
				const b = ((index + 2) / 5) * Math.PI * 2 - Math.PI / 2;
				const fromX = center + Math.cos(a) * 28;
				const fromY = center + Math.sin(a) * 28;
				const toX = center + Math.cos(b) * 28;
				const toY = center + Math.sin(b) * 28;
				for (let thickness = 0; thickness < 2; thickness += 1) {
					p.line(fromX + thickness, fromY, toX + thickness, toY, GLOW);
					p.line(fromX, fromY + thickness, toX, toY + thickness, GLOW);
				}
			}
		},
	};
}

function serpentIris(): TextureRecipe {
	return {
		size: [32, 32],
		tile: 1,
		draw: (p) => {
			p.clear();
			const jade = hexToRgb(0x18a868);
			const pale = hexToRgb(0x58e8a0);
			const rim = hexToRgb(0x06382a);
			for (let y = 0; y < 32; y += 1) {
				for (let x = 0; x < 32; x += 1) {
					const dx = (x - 15.5) / 15.5;
					const dy = (y - 15.5) / 15.5;
					const radius = Math.hypot(dx, dy);
					if (radius > 1) {
						continue;
					}
					const slit = 0.22 * Math.max(0, 1 - (dy / 0.84) ** 2);
					const color: RGB =
						Math.abs(dx) < slit
							? [2, 2, 2]
							: radius > 0.86
								? rim
								: radius < 0.5
									? pale
									: jade;
					p.setRaw(x, y, color, 255);
				}
			}
		},
	};
}

export const OCCULT_TEXTURES: Record<string, TextureRecipe> = {
	occultPentacle: pentacle(),
	occultIris: serpentIris(),
};
