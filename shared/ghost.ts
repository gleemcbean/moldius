import {
	GHOST_BOUNDS_MARGIN,
	GHOST_CEILING_MARGIN,
	GHOST_FLOOR_MARGIN,
} from "./config/party.js";
import type { ManorLayout } from "./manor/types.js";
import type { Vec3 } from "./math.js";

export interface GhostBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	minZ: number;
	maxZ: number;
}

export function ghostBounds(layout: ManorLayout): GhostBounds {
	const floors = layout.rooms.map((room) => room.floorY);
	const ceilings = layout.rooms.map((room) => room.ceilingY);

	return {
		minX: layout.bounds.minX - GHOST_BOUNDS_MARGIN,
		maxX: layout.bounds.maxX + GHOST_BOUNDS_MARGIN,
		minZ: layout.bounds.minZ - GHOST_BOUNDS_MARGIN,
		maxZ: layout.bounds.maxZ + GHOST_BOUNDS_MARGIN,
		minY: Math.min(0, ...floors) - GHOST_FLOOR_MARGIN,
		maxY: Math.max(3, ...ceilings) + GHOST_CEILING_MARGIN,
	};
}

export function clampToGhostBounds(point: Vec3, bounds: GhostBounds): Vec3 {
	return {
		x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
		y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y)),
		z: Math.min(bounds.maxZ, Math.max(bounds.minZ, point.z)),
	};
}

export function insideGhostBounds(
	point: Vec3,
	bounds: GhostBounds,
	tolerance = 0.05,
): boolean {
	return (
		point.x >= bounds.minX - tolerance &&
		point.x <= bounds.maxX + tolerance &&
		point.y >= bounds.minY - tolerance &&
		point.y <= bounds.maxY + tolerance &&
		point.z >= bounds.minZ - tolerance &&
		point.z <= bounds.maxZ + tolerance
	);
}
