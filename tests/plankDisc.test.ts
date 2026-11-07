import { describe, expect, it } from "vitest";
import { type PlankPoint, plankDisc } from "../shared/plankDisc.js";

function inside(point: PlankPoint, outline: PlankPoint[]): boolean {
	let result = false;
	for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
		const [xi, yi] = outline[i];
		const [xj, yj] = outline[j];
		if (
			yi > point[1] !== yj > point[1] &&
			point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
		) {
			result = !result;
		}
	}
	return result;
}

describe("planches d'un fond de tonneau", () => {
	const radius = 0.6;
	const count = 10;
	const seam = 0.004;
	const width = (radius * 2) / count;

	function sample(visit: (point: PlankPoint) => void): void {
		for (let x = -radius; x <= radius; x += 0.013) {
			for (let y = -radius; y <= radius; y += 0.013) {
				const seamDistance = Math.abs(((x + radius) / width) % 1) * width;
				const nearSeam = seamDistance < seam || width - seamDistance < seam;
				if (Math.hypot(x, y) < radius * 0.985 && !nearSeam) {
					visit([x, y]);
				}
			}
		}
	}

	it("remplit tout le cercle sans déborder", () => {
		const outlines = plankDisc(radius, count, seam);
		sample((point) => {
			expect(outlines.some((outline) => inside(point, outline))).toBe(true);
		});
		for (const outline of outlines) {
			for (const [x, y] of outline) {
				expect(Math.hypot(x, y)).toBeLessThanOrEqual(radius + 1e-6);
			}
		}
	});

	it("ne laisse vide que le trou demandé", () => {
		const hole = { halfWidth: width * 2, bottom: -0.3, top: 0.3 };
		const outlines = plankDisc(radius, count, seam, hole);
		sample((point) => {
			const inHole =
				Math.abs(point[0]) < hole.halfWidth &&
				point[1] > hole.bottom &&
				point[1] < hole.top;
			expect(outlines.some((outline) => inside(point, outline))).toBe(!inHole);
		});
	});
});
