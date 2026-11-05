import type { ManorSize } from "../matchConfig.js";

export const LEVEL_HEIGHT = 4.4;
export const MAX_UPPER_FLOORS = 3;
export const SLAB_THICKNESS = 0.35;
export const WALL_GAP = 0.25;
export const FURNITURE_GRID = 0.25;
export const NAV_CELL_SIZE = 0.5;
export const NAV_AGENT_RADIUS = 0.4;

export const MANOR_GROUND_ROOM_COUNT: Record<ManorSize, number> = {
	small: 15,
	medium: 23,
	large: 32,
};
export const MANOR_UPPER_ROOM_COUNT: Record<ManorSize, number> = {
	small: 5,
	medium: 8,
	large: 12,
};
export const MANOR_UPPER_LEVEL_SHARE = [1, 0.85, 0.7];
export const MANOR_MIN_UPPER_ROOMS = 4;
export const MANOR_LAYOUT_RETRIES = 6;
export const MANOR_HALF_EXTENT: Record<ManorSize, number> = {
	small: 30,
	medium: 38,
	large: 48,
};
export const MANOR_LOOPS: Record<ManorSize, number> = {
	small: 2,
	medium: 4,
	large: 6,
};
export const MANOR_WINDOWS: Record<ManorSize, number> = {
	small: 2,
	medium: 3,
	large: 4,
};
export const MANOR_OPENING_EDGE_MARGIN = 0.4;
export const MANOR_OPENING_SPACING = 0.7;
