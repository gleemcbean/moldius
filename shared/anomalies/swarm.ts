import type { Vec3 } from "../math.js";
import type { CollisionWorld } from "../physics/collisionWorld.js";
import { lineOfSight } from "../physics/lineOfSight.js";

export const SWARM_DIRECTIONS = 16;
const SWARM_WALL_MARGIN = 0.3;
const SWARM_PROBE_HEIGHT = 0.3;

export function swarmClearance(
	world: CollisionWorld,
	center: Vec3,
	yaw: number,
	radius: number,
): number[] {
	const origin = { x: center.x, y: center.y + SWARM_PROBE_HEIGHT, z: center.z };
	return Array.from({ length: SWARM_DIRECTIONS }, (_, index) => {
		const angle = (index / SWARM_DIRECTIONS) * Math.PI * 2 + yaw;
		const point = (distance: number) => ({
			x: origin.x + Math.sin(angle) * distance,
			y: origin.y,
			z: origin.z + Math.cos(angle) * distance,
		});
		if (lineOfSight(world, origin, point(radius))) {
			return radius;
		}
		let low = 0;
		let high = radius;
		for (let step = 0; step < 8; step += 1) {
			const middle = (low + high) / 2;
			if (lineOfSight(world, origin, point(middle))) {
				low = middle;
			} else {
				high = middle;
			}
		}
		return Math.max(0, low - SWARM_WALL_MARGIN);
	});
}

export function clearanceToward(
	clearance: readonly number[],
	angle: number,
): number {
	const turn = angle / (Math.PI * 2);
	const index =
		((Math.round((turn - Math.floor(turn)) * SWARM_DIRECTIONS) %
			SWARM_DIRECTIONS) +
			SWARM_DIRECTIONS) %
		SWARM_DIRECTIONS;
	return clearance[index];
}
