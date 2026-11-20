import { hashString, SeededRandom } from "@shared/random";
import type { PixelData } from "./PixelPainter";

type Point = [number, number];
type Polygon = Point[];

const SUPERSAMPLE = 4;

export function beamFade(): PixelData {
	const size = 32;
	const data = new Uint8ClampedArray(size * 4);

	for (let row = 0; row < size; row += 1) {
		const along = row / (size - 1);
		const value = Math.round(255 * along ** 1.6 * Math.min(1, row / 3));

		data.set([value, value, value, 255], (size - 1 - row) * 4);
	}

	return { width: 1, height: size, data };
}

function hexColor(hex: string): [number, number, number] {
	const value = Number.parseInt(hex.slice(1), 16);

	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function insidePolygon(x: number, y: number, polygon: Polygon): boolean {
	let inside = false;

	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
		const [xi, yi] = polygon[i];
		const [xj, yj] = polygon[j];

		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}

	return inside;
}

function strokePolygons(points: Point[], halfWidth: number): Polygon[] {
	const polygons: Polygon[] = [];
	const normals: Point[] = [];

	for (let index = 1; index < points.length; index += 1) {
		const [x0, y0] = points[index - 1];
		const [x1, y1] = points[index];
		const length = Math.hypot(x1 - x0, y1 - y0) || 1;
		const nx = (-(y1 - y0) / length) * halfWidth;
		const ny = ((x1 - x0) / length) * halfWidth;

		normals.push([nx, ny]);

		polygons.push([
			[x0 + nx, y0 + ny],
			[x1 + nx, y1 + ny],
			[x1 - nx, y1 - ny],
			[x0 - nx, y0 - ny],
		]);
	}

	for (let index = 1; index < normals.length; index += 1) {
		const [px, py] = points[index];
		const [ax, ay] = normals[index - 1];
		const [bx, by] = normals[index];
		const sumX = ax + bx;
		const sumY = ay + by;
		const sumLength = Math.hypot(sumX, sumY);

		if (sumLength < 1e-6) {
			continue;
		}

		const cos = (sumX * ax + sumY * ay) / (sumLength * halfWidth);
		const miter = halfWidth / Math.max(cos, 0.1);
		const mx = (sumX / sumLength) * miter;
		const my = (sumY / sumLength) * miter;

		polygons.push(
			[
				[px, py],
				[px + ax, py + ay],
				[px + mx, py + my],
				[px + bx, py + by],
			],
			[
				[px, py],
				[px - ax, py - ay],
				[px - mx, py - my],
				[px - bx, py - by],
			],
		);
	}

	return polygons;
}

function blend(
	data: Uint8ClampedArray,
	offset: number,
	color: [number, number, number],
	coverage: number,
): void {
	for (let channel = 0; channel < 3; channel += 1) {
		data[offset + channel] = Math.round(
			data[offset + channel] * (1 - coverage) + color[channel] * coverage,
		);
	}
}

export function altarPage(seed: string, mirrored: boolean): PixelData {
	const width = 96;
	const height = 128;
	const data = new Uint8ClampedArray(width * height * 4);

	const fillRect = (
		x: number,
		y: number,
		w: number,
		h: number,
		color: [number, number, number],
	) => {
		for (let py = y; py < y + h; py += 1) {
			for (let px = x; px < x + w; px += 1) {
				const offset = (py * width + px) * 4;

				data[offset] = color[0];
				data[offset + 1] = color[1];
				data[offset + 2] = color[2];
				data[offset + 3] = 255;
			}
		}
	};

	const rng = new SeededRandom(hashString(seed));

	fillRect(0, 0, width, height, hexColor("#e6d6ac"));

	const ink = hexColor("#2c1a10");

	for (let y = 10; y < 122; y += 7) {
		if (!mirrored && y > 32 && y < 88) {
			continue;
		}

		let x = 10;

		while (x < 84) {
			const word = rng.int(5, 15);

			fillRect(x, y, Math.min(word, 86 - x), 2, ink);

			x += word + 3;
		}
	}

	if (mirrored) {
		return { width, height, data };
	}

	const star: Point[] = [];

	for (let index = 0; index <= 5; index += 1) {
		const angle = (index * 2 * 2 * Math.PI) / 5 - Math.PI / 2;

		star.push([48 + Math.cos(angle) * 24, 60 + Math.sin(angle) * 24]);
	}

	const polygons = strokePolygons(star, 1);
	const teal = hexColor("#0fae9f");

	for (const shape of [
		(x: number, y: number) =>
			polygons.some((polygon) => insidePolygon(x, y, polygon)),
		(x: number, y: number) => Math.abs(Math.hypot(x - 48, y - 60) - 26) <= 1,
	]) {
		for (let py = 0; py < height; py += 1) {
			for (let px = 0; px < width; px += 1) {
				let hits = 0;

				for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
					for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
						if (
							shape(
								px + (sx + 0.5) / SUPERSAMPLE,
								py + (sy + 0.5) / SUPERSAMPLE,
							)
						) {
							hits += 1;
						}
					}
				}

				if (hits > 0) {
					blend(
						data,
						(py * width + px) * 4,
						teal,
						hits / (SUPERSAMPLE * SUPERSAMPLE),
					);
				}
			}
		}
	}

	return { width, height, data };
}
