import { directionToYaw, type Vec2, type Vec3 } from "../math.js";
import type { CompulsionKind } from "../protocol/game.js";

export interface CompulsionOrder {
	kind: CompulsionKind;
	until: number;
	path: Vec3[];
	leap: Vec2 | null;
}

export interface CompulsionSteer {
	forward: number;
	sprint: boolean;
	jump: boolean;
	yaw: number | null;
	held: boolean;
}

const WAYPOINT_REACH = 0.55;
const LEAP_TAKEOFF = 1.15;
const LEAP_OVERSHOOT = 0.6;

const STILL: CompulsionSteer = {
	forward: 0,
	sprint: false,
	jump: false,
	yaw: null,
	held: true,
};

const FREE: CompulsionSteer = { ...STILL, held: false };

export function compelsMovement(kind: CompulsionKind): boolean {
	return kind !== "lantern";
}

export class CompulsionDriver {
	private index = 0;
	private leaping = false;

	constructor(readonly order: CompulsionOrder) {}

	activeAt(now: number): boolean {
		return now < this.order.until;
	}

	steer(position: Vec3, now: number): CompulsionSteer {
		if (!this.activeAt(now)) {
			return FREE;
		}

		switch (this.order.kind) {
			case "lure":
				return this.follow(position, this.order.path.length);
			case "leap":
				return this.leap(position);
			case "lantern":
				return FREE;
			default:
				return STILL;
		}
	}

	private follow(position: Vec3, count: number): CompulsionSteer {
		const path = this.order.path;

		while (
			this.index < count &&
			Math.hypot(
				path[this.index].x - position.x,
				path[this.index].z - position.z,
			) < WAYPOINT_REACH
		) {
			this.index += 1;
		}

		if (this.index >= count) {
			return STILL;
		}

		const target = path[this.index];

		return {
			forward: 1,
			sprint: true,
			jump: false,
			yaw: directionToYaw({
				x: target.x - position.x,
				z: target.z - position.z,
			}),
			held: true,
		};
	}

	private leap(position: Vec3): CompulsionSteer {
		const path = this.order.path;
		const direction = this.order.leap;
		const edge = path[path.length - 1];

		if (!direction || !edge) {
			return STILL;
		}

		if (!this.leaping) {
			const step = this.follow(position, path.length - 1);

			if (step.forward > 0) {
				return step;
			}

			this.leaping = true;
		}

		const ahead =
			(edge.x - position.x) * direction.x + (edge.z - position.z) * direction.z;

		return {
			forward: 1,
			sprint: true,
			jump: ahead <= LEAP_TAKEOFF && ahead > -LEAP_OVERSHOOT,
			yaw: directionToYaw(direction),
			held: true,
		};
	}
}
