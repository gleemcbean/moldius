import { ENTITY_HISTORY_MS, MAX_EXTRAPOLATION_MS } from "@shared/config/index";
import { lerpAngle } from "@shared/math";

export interface Pose {
	x: number;
	y: number;
	z: number;
	yaw: number;
}

export interface Sampled<T> extends Pose {
	speed: number;
	value: T;
	extrapolated: boolean;
}

export class SnapshotBuffer<T extends Pose> {
	private readonly samples: { t: number; value: T }[] = [];

	get latest(): T | null {
		return this.samples[this.samples.length - 1]?.value ?? null;
	}

	get latestTime(): number {
		return this.samples[this.samples.length - 1]?.t ?? -Infinity;
	}

	get size(): number {
		return this.samples.length;
	}

	push(t: number, value: T): boolean {
		const last = this.samples[this.samples.length - 1];
		if (last && t <= last.t) {
			return false;
		}
		this.samples.push({ t, value });
		const cutoff = t - ENTITY_HISTORY_MS;
		while (this.samples.length > 2 && this.samples[0].t < cutoff) {
			this.samples.shift();
		}
		return true;
	}

	reset(): void {
		this.samples.length = 0;
	}

	sample(time: number): Sampled<T> | null {
		const count = this.samples.length;
		if (count === 0) {
			return null;
		}
		const first = this.samples[0];
		if (count === 1 || time <= first.t) {
			return {
				...pose(first.value),
				speed: 0,
				value: first.value,
				extrapolated: false,
			};
		}
		for (let index = count - 1; index > 0; index -= 1) {
			const previous = this.samples[index - 1];
			const next = this.samples[index];
			if (time >= previous.t && time <= next.t) {
				const span = Math.max(1, next.t - previous.t);
				const alpha = (time - previous.t) / span;
				return {
					x: previous.value.x + (next.value.x - previous.value.x) * alpha,
					y: previous.value.y + (next.value.y - previous.value.y) * alpha,
					z: previous.value.z + (next.value.z - previous.value.z) * alpha,
					yaw: lerpAngle(previous.value.yaw, next.value.yaw, alpha),
					speed:
						(Math.hypot(
							next.value.x - previous.value.x,
							next.value.z - previous.value.z,
						) /
							span) *
						1000,
					value: next.value,
					extrapolated: false,
				};
			}
		}
		const last = this.samples[count - 1];
		const before = this.samples[count - 2];
		const span = Math.max(1, last.t - before.t);
		const ahead = Math.min(time - last.t, MAX_EXTRAPOLATION_MS);
		const factor = ahead / span;
		return {
			x: last.value.x + (last.value.x - before.value.x) * factor,
			y: last.value.y + (last.value.y - before.value.y) * factor,
			z: last.value.z + (last.value.z - before.value.z) * factor,
			yaw: last.value.yaw,
			speed:
				(Math.hypot(
					last.value.x - before.value.x,
					last.value.z - before.value.z,
				) /
					span) *
				1000,
			value: last.value,
			extrapolated: true,
		};
	}
}

function pose(value: Pose): Pose {
	return { x: value.x, y: value.y, z: value.z, yaw: value.yaw };
}
