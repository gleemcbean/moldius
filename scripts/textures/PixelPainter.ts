import { SeededRandom } from "@shared/random";

export type RGB = [number, number, number];

export function hexToRgb(hex: number): RGB {
	return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

export function shade(color: RGB, factor: number): RGB {
	return [
		clampByte(color[0] * factor),
		clampByte(color[1] * factor),
		clampByte(color[2] * factor),
	];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
	return [
		clampByte(a[0] + (b[0] - a[0]) * t),
		clampByte(a[1] + (b[1] - a[1]) * t),
		clampByte(a[2] + (b[2] - a[2]) * t),
	];
}

function clampByte(value: number): number {
	return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}

export class PixelPainter {
	readonly canvas: HTMLCanvasElement;
	readonly data: ImageData;
	readonly rng: SeededRandom;

	constructor(
		readonly width: number,
		readonly height: number,
		seed: number,
	) {
		this.canvas = document.createElement("canvas");
		this.canvas.width = width;
		this.canvas.height = height;
		const context = this.canvas.getContext("2d", {
			willReadFrequently: true,
		}) as CanvasRenderingContext2D;
		this.data = context.createImageData(width, height);
		this.rng = new SeededRandom(seed);
	}

	get context(): CanvasRenderingContext2D {
		return this.canvas.getContext("2d") as CanvasRenderingContext2D;
	}

	set(x: number, y: number, color: RGB, alpha = 255): void {
		const px = ((Math.floor(x) % this.width) + this.width) % this.width;
		const py = ((Math.floor(y) % this.height) + this.height) % this.height;
		const index = (py * this.width + px) * 4;
		const pixels = this.data.data;
		if (alpha >= 255) {
			pixels[index] = color[0];
			pixels[index + 1] = color[1];
			pixels[index + 2] = color[2];
			pixels[index + 3] = 255;
			return;
		}
		const t = alpha / 255;
		pixels[index] = Math.round(pixels[index] * (1 - t) + color[0] * t);
		pixels[index + 1] = Math.round(pixels[index + 1] * (1 - t) + color[1] * t);
		pixels[index + 2] = Math.round(pixels[index + 2] * (1 - t) + color[2] * t);
		pixels[index + 3] = Math.max(pixels[index + 3], alpha);
	}

	setRaw(x: number, y: number, color: RGB, alpha: number): void {
		const index = (y * this.width + x) * 4;
		const pixels = this.data.data;
		pixels[index] = color[0];
		pixels[index + 1] = color[1];
		pixels[index + 2] = color[2];
		pixels[index + 3] = alpha;
	}

	get(x: number, y: number): RGB {
		const px = ((Math.floor(x) % this.width) + this.width) % this.width;
		const py = ((Math.floor(y) % this.height) + this.height) % this.height;
		const index = (py * this.width + px) * 4;
		const pixels = this.data.data;
		return [pixels[index], pixels[index + 1], pixels[index + 2]];
	}

	fill(color: RGB): void {
		for (let y = 0; y < this.height; y += 1) {
			for (let x = 0; x < this.width; x += 1) {
				this.setRaw(x, y, color, 255);
			}
		}
	}

	clear(): void {
		this.data.data.fill(0);
	}

	rect(
		x: number,
		y: number,
		width: number,
		height: number,
		color: RGB,
		alpha = 255,
	): void {
		for (let py = y; py < y + height; py += 1) {
			for (let px = x; px < x + width; px += 1) {
				this.set(px, py, color, alpha);
			}
		}
	}

	frame(
		x: number,
		y: number,
		width: number,
		height: number,
		color: RGB,
		thickness = 1,
	): void {
		this.rect(x, y, width, thickness, color);
		this.rect(x, y + height - thickness, width, thickness, color);
		this.rect(x, y, thickness, height, color);
		this.rect(x + width - thickness, y, thickness, height, color);
	}

	shadeRect(
		x: number,
		y: number,
		width: number,
		height: number,
		factor: number,
	): void {
		for (let py = y; py < y + height; py += 1) {
			for (let px = x; px < x + width; px += 1) {
				this.set(px, py, shade(this.get(px, py), factor));
			}
		}
	}

	noise(amount: number, chunk = 1): void {
		for (let y = 0; y < this.height; y += chunk) {
			for (let x = 0; x < this.width; x += chunk) {
				const factor = 1 + (this.rng.next() - 0.5) * amount;
				for (let dy = 0; dy < chunk; dy += 1) {
					for (let dx = 0; dx < chunk; dx += 1) {
						this.set(x + dx, y + dy, shade(this.get(x + dx, y + dy), factor));
					}
				}
			}
		}
	}

	speckle(count: number, color: RGB, alpha = 255, size = 1): void {
		for (let index = 0; index < count; index += 1) {
			const x = this.rng.int(0, this.width - 1);
			const y = this.rng.int(0, this.height - 1);
			this.rect(x, y, size, size, color, alpha);
		}
	}

	stain(count: number, color: RGB, maxRadius: number, alpha: number): void {
		for (let index = 0; index < count; index += 1) {
			const cx = this.rng.int(0, this.width - 1);
			const cy = this.rng.int(0, this.height - 1);
			const radius = this.rng.range(2, maxRadius);
			for (let y = -Math.ceil(radius); y <= Math.ceil(radius); y += 1) {
				for (let x = -Math.ceil(radius); x <= Math.ceil(radius); x += 1) {
					const distance = Math.hypot(x, y) / radius;
					if (distance <= 1 && this.rng.next() > distance * 0.7) {
						this.set(
							cx + x,
							cy + y,
							color,
							Math.round(alpha * (1 - distance * 0.6)),
						);
					}
				}
			}
		}
	}

	line(
		x0: number,
		y0: number,
		x1: number,
		y1: number,
		color: RGB,
		alpha = 255,
	): void {
		const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
		for (let step = 0; step <= steps; step += 1) {
			const t = step / steps;
			this.set(
				Math.round(x0 + (x1 - x0) * t),
				Math.round(y0 + (y1 - y0) * t),
				color,
				alpha,
			);
		}
	}

	circle(
		cx: number,
		cy: number,
		radius: number,
		color: RGB,
		alpha = 255,
		filled = true,
	): void {
		for (let y = -Math.ceil(radius); y <= Math.ceil(radius); y += 1) {
			for (let x = -Math.ceil(radius); x <= Math.ceil(radius); x += 1) {
				const distance = Math.hypot(x, y);
				if (filled ? distance <= radius : Math.abs(distance - radius) < 0.6) {
					this.set(Math.round(cx + x), Math.round(cy + y), color, alpha);
				}
			}
		}
	}

	commit(): HTMLCanvasElement {
		this.context.putImageData(this.data, 0, 0);
		return this.canvas;
	}
}
