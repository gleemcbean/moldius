import { clamp01 } from "./noise";
import type { SurfaceField } from "./SurfaceField";

export interface BakedSurface {
	width: number;
	height: number;
	albedo: Uint8Array;
	normal: Uint8Array;
	orm: Uint8Array;
}

function blurAxis(
	source: Float32Array,
	target: Float32Array,
	width: number,
	height: number,
	radius: number,
	horizontal: boolean,
): void {
	const span = radius * 2 + 1;
	const lines = horizontal ? height : width;
	const length = horizontal ? width : height;
	const stride = horizontal ? 1 : width;

	for (let line = 0; line < lines; line += 1) {
		const start = horizontal ? line * width : line;
		let sum = 0;

		for (let offset = -radius; offset <= radius; offset += 1) {
			const position = ((offset % length) + length) % length;

			sum += source[start + position * stride];
		}

		for (let position = 0; position < length; position += 1) {
			target[start + position * stride] = sum / span;

			const leaving = (((position - radius) % length) + length) % length;
			const entering = (position + radius + 1) % length;

			sum +=
				source[start + entering * stride] - source[start + leaving * stride];
		}
	}
}

export function blurWrapped(
	source: Float32Array,
	width: number,
	height: number,
	radius: number,
): Float32Array {
	const scratch = new Float32Array(source.length);
	const result = new Float32Array(source.length);

	blurAxis(source, scratch, width, height, radius, true);
	blurAxis(scratch, result, width, height, radius, false);
	blurAxis(result, scratch, width, height, radius, true);
	blurAxis(scratch, result, width, height, radius, false);

	return result;
}

function byte(value: number): number {
	return Math.round(clamp01(value) * 255);
}

export function bakeField(
	field: SurfaceField,
	tileX: number,
	tileY: number,
	depth: number,
): BakedSurface {
	const { width, height, relief, albedo, rough, metal, occlusion } = field;
	const count = width * height;
	const color = new Uint8Array(count * 4);
	const normal = new Uint8Array(count * 4);
	const orm = new Uint8Array(count * 4);

	const near = blurWrapped(
		relief,
		width,
		height,
		Math.max(1, Math.round(width / 128)),
	);

	const far = blurWrapped(
		relief,
		width,
		height,
		Math.max(2, Math.round(width / 24)),
	);

	const slopeX = (depth * width) / tileX;
	const slopeY = (depth * height) / tileY;
	const cavityStrength = Math.min(1, Math.max(0.04, depth / 0.014));

	for (let y = 0; y < height; y += 1) {
		const up = ((y + 1) % height) * width;
		const down = ((y - 1 + height) % height) * width;
		const row = y * width;

		for (let x = 0; x < width; x += 1) {
			const index = row + x;
			const right = (x + 1) % width;
			const left = (x - 1 + width) % width;
			const dx = (relief[row + right] - relief[row + left]) * 0.5 * slopeX;
			const dy = (relief[up + x] - relief[down + x]) * 0.5 * slopeY;
			const inverse = 1 / Math.sqrt(dx * dx + dy * dy + 1);
			const out = index * 4;

			normal[out] = byte(-dx * inverse * 0.5 + 0.5);
			normal[out + 1] = byte(-dy * inverse * 0.5 + 0.5);
			normal[out + 2] = byte(inverse * 0.5 + 0.5);
			normal[out + 3] = byte(relief[index]);

			const cavity =
				Math.max(0, near[index] - relief[index]) * 2.4 +
				Math.max(0, far[index] - relief[index]) * 1.3;

			const ambient =
				Math.max(0.22, 1 - cavity * cavityStrength) * occlusion[index];

			orm[out] = byte(ambient);
			orm[out + 1] = byte(Math.max(0.04, rough[index]));
			orm[out + 2] = byte(metal[index]);
			orm[out + 3] = 255;
			color[out] = byte(albedo[index * 3]);
			color[out + 1] = byte(albedo[index * 3 + 1]);
			color[out + 2] = byte(albedo[index * 3 + 2]);
			color[out + 3] = 255;
		}
	}

	return { width, height, albedo: color, normal, orm };
}
