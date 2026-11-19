import { blurWrapped } from "./bakeSurface";
import { clamp01, lerp, wrap } from "./noise";

export type Tone = readonly [number, number, number];

export interface Texel {
	relief: number;
	r: number;
	g: number;
	b: number;
	rough: number;
	metal: number;
	ao: number;
}

export function tone(hex: number): Tone {
	return [
		((hex >> 16) & 255) / 255,
		((hex >> 8) & 255) / 255,
		(hex & 255) / 255,
	];
}

export function mixTone(a: Tone, b: Tone, t: number): Tone {
	return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function paintTone(texel: Texel, color: Tone, factor = 1): void {
	texel.r = color[0] * factor;
	texel.g = color[1] * factor;
	texel.b = color[2] * factor;
}

export function blendTone(texel: Texel, color: Tone, amount: number): void {
	const t = clamp01(amount);
	texel.r = lerp(texel.r, color[0], t);
	texel.g = lerp(texel.g, color[1], t);
	texel.b = lerp(texel.b, color[2], t);
}

export function scaleTone(texel: Texel, factor: number): void {
	texel.r *= factor;
	texel.g *= factor;
	texel.b *= factor;
}

export type SurfaceShader = (u: number, v: number, texel: Texel) => void;

export class SurfaceField {
	readonly relief: Float32Array;
	readonly albedo: Float32Array;
	readonly rough: Float32Array;
	readonly metal: Float32Array;
	readonly occlusion: Float32Array;

	constructor(
		readonly width: number,
		readonly height: number,
		readonly seed: number,
	) {
		const count = width * height;
		this.relief = new Float32Array(count);
		this.albedo = new Float32Array(count * 3);
		this.rough = new Float32Array(count);
		this.metal = new Float32Array(count);
		this.occlusion = new Float32Array(count);
	}

	paint(shader: SurfaceShader): void {
		const texel: Texel = {
			relief: 0.5,
			r: 0.5,
			g: 0.5,
			b: 0.5,
			rough: 0.8,
			metal: 0,
			ao: 1,
		};
		const { width, height } = this;
		for (let y = 0; y < height; y += 1) {
			const v = (y + 0.5) / height;
			for (let x = 0; x < width; x += 1) {
				const index = y * width + x;
				texel.relief = 0.5;
				texel.r = 0.5;
				texel.g = 0.5;
				texel.b = 0.5;
				texel.rough = 0.8;
				texel.metal = 0;
				texel.ao = 1;
				shader((x + 0.5) / width, v, texel);
				this.relief[index] = clamp01(texel.relief);
				this.albedo[index * 3] = texel.r;
				this.albedo[index * 3 + 1] = texel.g;
				this.albedo[index * 3 + 2] = texel.b;
				this.rough[index] = texel.rough;
				this.metal[index] = texel.metal;
				this.occlusion[index] = texel.ao;
			}
		}
	}

	reliefAt(x: number, y: number): number {
		return this.relief[
			wrap(Math.round(y), this.height) * this.width +
				wrap(Math.round(x), this.width)
		];
	}

	smoothRelief(radius: number): void {
		const steps = Math.max(1, Math.round(radius * this.width));
		this.relief.set(blurWrapped(this.relief, this.width, this.height, steps));
	}

	normalizeRelief(): void {
		let low = Number.POSITIVE_INFINITY;
		let high = Number.NEGATIVE_INFINITY;
		for (const value of this.relief) {
			low = Math.min(low, value);
			high = Math.max(high, value);
		}
		const span = high - low || 1;
		for (let index = 0; index < this.relief.length; index += 1) {
			this.relief[index] = (this.relief[index] - low) / span;
		}
	}
}
