import { lerpAngle } from "./math.js";

export const POSE_SMOOTHING_RATE = 16;
export const POSE_SMOOTHING_LAG_MS = 1000 / POSE_SMOOTHING_RATE;
const SNAP_DISTANCE = 2.5;

export interface SmoothedPose {
	x: number;
	y: number;
	z: number;
	yaw: number;
	speed: number;
}

export class PoseSmoother implements SmoothedPose {
	x = 0;
	y = 0;
	z = 0;
	yaw = 0;
	speed = 0;
	private ready = false;

	update(target: SmoothedPose, dt: number): void {
		const gap = Math.hypot(
			target.x - this.x,
			target.y - this.y,
			target.z - this.z,
		);
		if (!this.ready || gap > SNAP_DISTANCE) {
			this.x = target.x;
			this.y = target.y;
			this.z = target.z;
			this.yaw = target.yaw;
			this.speed = target.speed;
			this.ready = true;
			return;
		}
		const blend = 1 - Math.exp(-dt * POSE_SMOOTHING_RATE);
		this.x += (target.x - this.x) * blend;
		this.y += (target.y - this.y) * blend;
		this.z += (target.z - this.z) * blend;
		this.yaw = lerpAngle(this.yaw, target.yaw, blend);
		this.speed += (target.speed - this.speed) * (1 - Math.exp(-dt * 6));
	}

	reset(): void {
		this.ready = false;
	}
}
