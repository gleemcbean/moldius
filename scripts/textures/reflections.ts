import type { PixelData } from "./PixelPainter";

export const REFLECTION_FACE_SIZE = 32;
const CEILING = [84, 70, 56];
const FLOOR = [20, 15, 12];
const HORIZON = [58, 47, 37];

type Glint = [number, number, number, number, number, number, number];

const FACE_GLINTS: Glint[][] = [
	[[9, 14, 2, 3, 255, 196, 120]],
	[
		[21, 13, 2, 3, 255, 186, 110],
		[5, 6, 7, 9, 26, 32, 44],
	],
	[],
	[],
	[[15, 12, 3, 4, 255, 206, 140]],
	[
		[24, 15, 2, 2, 240, 170, 96],
		[8, 5, 8, 10, 22, 28, 40],
	],
];

function mixChannel(a: number[], b: number[], t: number): number[] {
	return a.map((value, index) => Math.round(value + (b[index] - value) * t));
}

function paintFace(index: number): PixelData {
	const size = REFLECTION_FACE_SIZE;
	const data = new Uint8ClampedArray(size * size * 4);

	const rect = (
		x: number,
		y: number,
		width: number,
		height: number,
		color: number[],
	) => {
		for (let py = y; py < y + height; py += 1) {
			for (let px = x; px < x + width; px += 1) {
				const offset = (py * size + px) * 4;

				data[offset] = color[0];
				data[offset + 1] = color[1];
				data[offset + 2] = color[2];
				data[offset + 3] = 255;
			}
		}
	};

	if (index === 2) {
		rect(0, 0, size, size, CEILING);
		rect(8, 8, 16, 16, [112, 92, 72]);
		rect(13, 13, 6, 6, [150, 122, 90]);

		return { width: size, height: size, data };
	}

	if (index === 3) {
		rect(0, 0, size, size, FLOOR);

		return { width: size, height: size, data };
	}

	for (let y = 0; y < size; y += 1) {
		const t = y / (size - 1);

		rect(
			0,
			y,
			size,
			1,
			t < 0.5
				? mixChannel(CEILING, HORIZON, t * 2)
				: mixChannel(HORIZON, FLOOR, (t - 0.5) * 2),
		);
	}

	for (const [x, y, width, height, r, g, b] of FACE_GLINTS[index]) {
		rect(x, y, width, height, [r, g, b]);
	}

	return { width: size, height: size, data };
}

export function reflectionFaces(): PixelData[] {
	return Array.from({ length: 6 }, (_, index) => paintFace(index));
}
