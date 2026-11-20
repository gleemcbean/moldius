import { LEVEL_HEIGHT, MAX_UPPER_FLOORS } from "../config/index.js";
import type { Level } from "./types.js";

export function levelForHeight(
	y: number,
	maxLevel: number = MAX_UPPER_FLOORS,
	margin = 1.4,
): Level {
	const level = Math.floor((y + margin) / LEVEL_HEIGHT);

	return Math.max(0, Math.min(maxLevel, MAX_UPPER_FLOORS, level)) as Level;
}

export function floorsSeenFromEye(
	eyeY: number,
	eyeHeight: number,
): {
	lowest: number;
	highest: number;
} {
	const feet = eyeY - eyeHeight;

	return {
		lowest: Math.floor((feet + 0.3) / LEVEL_HEIGHT),
		highest: Math.ceil((feet - 0.3) / LEVEL_HEIGHT) + 0,
	};
}
