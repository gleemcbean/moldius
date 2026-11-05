import { ENTITY_HISTORY_MS } from '../../shared/config/index.js';
import { lerpAngle, type Vec3 } from '../../shared/math.js';

export interface PoseSample {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export class PoseHistory {
  private readonly samples: PoseSample[] = [];

  push(sample: PoseSample): void {
    this.samples.push(sample);
    const cutoff = sample.t - ENTITY_HISTORY_MS;
    while (this.samples.length > 2 && this.samples[0]!.t < cutoff) {
      this.samples.shift();
    }
  }

  clear(): void {
    this.samples.length = 0;
  }

  get size(): number {
    return this.samples.length;
  }

  sampleAt(t: number): PoseSample | null {
    if (this.samples.length === 0) {
      return null;
    }
    const first = this.samples[0]!;
    const last = this.samples[this.samples.length - 1]!;
    if (t <= first.t) {
      return first;
    }
    if (t >= last.t) {
      return last;
    }
    for (let index = this.samples.length - 1; index > 0; index -= 1) {
      const previous = this.samples[index - 1]!;
      const next = this.samples[index]!;
      if (previous.t <= t && t <= next.t) {
        const span = next.t - previous.t;
        const alpha = span > 0 ? (t - previous.t) / span : 0;
        return {
          t,
          x: previous.x + (next.x - previous.x) * alpha,
          y: previous.y + (next.y - previous.y) * alpha,
          z: previous.z + (next.z - previous.z) * alpha,
          yaw: lerpAngle(previous.yaw, next.yaw, alpha),
        };
      }
    }
    return last;
  }

  positionAt(t: number): Vec3 | null {
    const sample = this.sampleAt(t);
    return sample ? { x: sample.x, y: sample.y, z: sample.z } : null;
  }
}
