import type { ManorLayout } from "@shared/manor/types";
import * as THREE from "three";
import type { ModelKit } from "../../models/modelKit";
import { disposeModel } from "../../models/occultModels";
import type { DynamicLight } from "../lighting/LightPool";

const VISIBLE_RANGE = 26;
const BLINK_SECONDS = 1.1;

function createWalkieModel(kit: ModelKit): THREE.Group {
	const root = new THREE.Group();
	const dark = { color: 0x24262a, roughness: 0.55, metalness: 0.2 };
	const body = kit.box(0.09, 0.17, 0.045, dark);
	body.position.y = 0.085;
	root.add(body);
	const grille = kit.box(0.066, 0.06, 0.006, {
		color: 0x4a4e55,
		roughness: 0.8,
	});
	grille.position.set(0, 0.12, 0.024);
	root.add(grille);
	const display = kit.box(0.05, 0.022, 0.004, {
		color: 0x9fdc8a,
		roughness: 0.3,
		emissive: 0x6fbf5a,
		emissiveIntensity: 1.2,
	});
	display.position.set(0, 0.066, 0.024);
	root.add(display);
	const antenna = kit.cylinder(0.005, 0.008, 0.16, dark);
	antenna.position.set(0.028, 0.25, 0);
	root.add(antenna);
	const knob = kit.cylinder(0.012, 0.012, 0.02, {
		color: 0xc23b2e,
		roughness: 0.5,
	});
	knob.position.set(-0.024, 0.18, 0);
	root.add(knob);
	return root;
}

export class WalkieViews {
	readonly group = new THREE.Group();
	private readonly template: THREE.Group;
	private readonly models = new Map<number, THREE.Object3D>();
	private readonly lights = new Map<number, DynamicLight>();
	private readonly taken = new Set<number>();
	private time = 0;

	constructor(layout: ManorLayout, kit: ModelKit, total: number) {
		this.template = createWalkieModel(kit);
		for (const spot of layout.walkies.slice(0, total)) {
			const model = this.template.clone();
			model.position.set(spot.x, spot.y - 0.03, spot.z);
			model.rotation.y = spot.id * 2.3;
			model.scale.setScalar(1.3);
			this.models.set(spot.id, model);
			this.group.add(model);
			this.lights.set(spot.id, {
				id: `walkie-${spot.id}`,
				position: new THREE.Vector3(spot.x, spot.y + 0.3, spot.z),
				color: 0x9fdc8a,
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
