import type { ManorSize } from "../matchConfig.js";

export const LEVEL_HEIGHT = 4.4;
export const MAX_UPPER_FLOORS = 3;
export const SLAB_THICKNESS = 0.35;
export const WALL_GAP = 0.25;
export const FURNITURE_GRID = 0.25;
export const NAV_CELL_SIZE = 0.5;
export const NAV_AGENT_RADIUS = 0.4;

export const GRAND_ROOM_WIDTH: readonly [number, number] = [15, 20];
export const GRAND_ROOM_DEPTH: readonly [number, number] = [12.5, 16];
export const MEZZANINE_HEIGHT: readonly [number, number] = [3.25, 3.75];
export const MEZZANINE_HEADROOM: readonly [number, number] = [3.3, 4];
export const MEZZANINE_OPENING_MAX_HEIGHT = 2.8;
export const MIN_PILLAR_SPACING = 4;
export const DAIS_STEP_RISE = 0.18;
export const DAIS_STEP_RUN = 0.45;
export const RELIEF_MAX_HEIGHT = 1;
export const MEZZANINE_DECK_WIDTH = 3;
export const MEZZANINE_STAIR_WIDTH = 2.2;
export const MEZZANINE_RAIL_COLLIDER = 0.95;
export const MEZZANINE_POST_RADIUS = 0.18;
export const MEZZANINE_POST_SPACING = 4;
export const MANOR_GRAND_ROOMS: Record<ManorSize, number> = {
	small: 1,
	medium: 2,
	large: 3,
};

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
