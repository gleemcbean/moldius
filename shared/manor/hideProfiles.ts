import { EYE_HEIGHT_STANDING } from "../config/index.js";
import type { Vec2 } from "../math.js";

export interface HideProfile {
	interior: Vec2;
	eye: number;
}

export const TRUNK_LID = 0.1;
export const CASK_CRADLE = 0.14;

export function caskRadius(width: number, height: number): number {
	return Math.min(width, height - CASK_CRADLE) / 2;
}

export function caskCenter(width: number, height: number): number {
	return CASK_CRADLE + caskRadius(width, height);
}

export function hideProfile(
	kind: string,
	width: number,
	depth: number,
	height: number,
): HideProfile {
	switch (kind) {
		case "lockers":
			return {
				interior: { x: -width / 2 + 0.3, z: -0.04 },
				eye: EYE_HEIGHT_STANDING,
			};
		case "trunk":
			return {
				interior: { x: 0, z: depth / 2 - 0.2 },
				eye: height - TRUNK_LID + 0.03,
			};
		case "cask":
			return {
				interior: { x: 0, z: depth / 2 - 0.45 },
				eye: caskCenter(width, height) - 0.04,
			};
		default:
			return { interior: { x: 0, z: -0.06 }, eye: EYE_HEIGHT_STANDING };
	}
}
