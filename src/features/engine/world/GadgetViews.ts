import type { WalkieSpot } from "@shared/manor/types";
import * as THREE from "three";
import { disposeModel } from "../../models/occultModels";
import type { DynamicLight } from "../lighting/LightPool";

const VISIBLE_RANGE = 26;
const BLINK_SECONDS = 1.1;

/** Talkies et appareils photo posés dans le manoir, qui clignotent pour qu'on les trouve. */
export class GadgetViews {
	readonly group = new THREE.Group();
	private readonly template: THREE.Group;
	private readonly models = new Map<number, THREE.Object3D>();
	private readonly lights = new Map<number, DynamicLight>();
	private readonly taken = new Set<number>();
	private time = 0;

	constructor(
		spots: readonly WalkieSpot[],
		template: THREE.Group,
		total: number,
		private readonly color: number,
		prefix: string,
	) {
		this.template = template;
		for (const spot of spots.slice(0, total)) {
			const model = this.template.clone();
			model.position.set(spot.x, spot.y - 0.03, spot.z);
			model.rotation.y = spot.id * 2.3;
			model.scale.setScalar(1.3);
			this.models.set(spot.id, model);
			this.group.add(model);
			this.lights.set(spot.id, {
				id: `${prefix}-${spot.id}`,
				position: new THREE.Vector3(spot.x, spot.y + 0.3, spot.z),
				color: this.color,
				intensity: 0,
				radius: 2.4,
				priority: 1,
				flicker: 0,
			});
		}
	}

	isAvailable(id: number): boolean {
		return this.models.has(id) && !this.taken.has(id);
	}

	setAvailable(id: number, available: boolean): void {
		if (available) {
			this.taken.delete(id);
		} else {
			this.taken.add(id);
		}
	}

	update(dt: number, eye: THREE.Vector3, lights: DynamicLight[]): void {
		this.time += dt;
		const blinking = this.time % BLINK_SECONDS < 0.18;
		for (const [id, model] of this.models) {
			const near =
				!this.taken.has(id) &&
				model.position.distanceToSquared(eye) < VISIBLE_RANGE * VISIBLE_RANGE;
			model.visible = near;
			const light = this.lights.get(id);
			if (near && blinking && light) {
				light.intensity = 0.9;
				lights.push(light);
			}
		}
	}

	dispose(): void {
		disposeModel(this.template);
	}
}
