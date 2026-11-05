import { GORGON_GAZE_CONE_RAD, GORGON_GAZE_RANGE } from "../config/index.js";
import { lookDirection, type Vec3 } from "../math.js";
import type { CollisionWorld } from "../physics/collisionWorld.js";
import { lineOfSight } from "../physics/lineOfSight.js";

export function isGazingAt(
	world: CollisionWorld,
	eye: Vec3,
	yaw: number,
	pitch: number,
	target: Vec3,
): boolean {
	const dx = target.x - eye.x;
	const dy = target.y - eye.y;
	const dz = target.z - eye.z;
	const distance = Math.hypot(dx, dy, dz);
	if (distance > GORGON_GAZE_RANGE || distance < 0.01) {
		return false;
	}
	const look = lookDirection(yaw, pitch);
	const cosine = (look.x * dx + look.y * dy + look.z * dz) / distance;
	if (cosine < Math.cos(GORGON_GAZE_CONE_RAD)) {
		return false;
	}
	return lineOfSight(world, eye, target);
}
