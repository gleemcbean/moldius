import type { MaterialId } from "@shared/config/index";
import type { ManorLayout } from "@shared/manor/types";
import * as THREE from "three";
import type { ModelKit } from "../../models/modelKit";
import { createMaterialModel, disposeModel } from "../../models/occultModels";

const VISIBLE_RANGE = 26;

export class PickupViews {
	readonly group = new THREE.Group();
	private readonly taken = new Set<number>();
	private readonly models = new Map<number, THREE.Object3D>();
	private readonly templates = new Map<MaterialId, THREE.Group>();

	constructor(
		layout: ManorLayout,
		private readonly kit: ModelKit,
	) {
		for (const pickup of layout.pickups) {
			if (pickup.spot === "container") {
				continue;
			}
			const model = this.template(pickup.material).clone();
			model.position.set(pickup.x, pickup.y - 0.03, pickup.z);
			model.rotation.y = pickup.id * 1.7;
			model.scale.setScalar(pickup.spot === "floor" ? 1.25 : 1.05);
			this.models.set(pickup.id, model);
			this.group.add(model);
		}
	}

	private template(material: MaterialId): THREE.Group {
		let template = this.templates.get(material);
		if (!template) {
			template = createMaterialModel(this.kit, material);
			this.templates.set(material, template);
		}
		return template;
	}

	setMaterial(id: number, material: MaterialId): void {
		const previous = this.models.get(id);
		if (!previous) {
			return;
		}
		const model = this.template(material).clone();
		model.position.copy(previous.position);
		model.rotation.copy(previous.rotation);
		model.scale.copy(previous.scale);
		this.group.remove(previous);
		this.models.set(id, model);
		this.group.add(model);
	}

	isAvailable(id: number): boolean {
		return !this.taken.has(id);
	}

	setTaken(id: number, taken: boolean): void {
		if (taken) {
			this.taken.add(id);
		} else {
			this.taken.delete(id);
		}
	}

	update(dt: number, eye: THREE.Vector3): void {
		for (const [id, model] of this.models) {
			const near =
				!this.taken.has(id) &&
				model.position.distanceToSquared(eye) < VISIBLE_RANGE * VISIBLE_RANGE;
			model.visible = near;
			if (near) {
				model.rotation.y += dt * 0.5;
			}
		}
	}

	dispose(): void {
		for (const template of this.templates.values()) {
			disposeModel(template);
		}
	}
}
