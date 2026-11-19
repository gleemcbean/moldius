import * as THREE from "three";
import type {
	MaterialLibrary,
	MaterialOptions,
} from "../world/MaterialLibrary";
import { modelLibrary } from "./ModelLibrary";
import { type MaterialSlots, Rig } from "./rig";

export type Surface = MaterialOptions | THREE.Material;

export class ModelKit {
	constructor(readonly materials: MaterialLibrary) {}

	material(options: Surface): THREE.Material {
		return options instanceof THREE.Material
			? options
			: this.materials.get(options);
	}

	unique(options: MaterialOptions): THREE.Material {
		return this.materials.fresh(options);
	}

	rig(id: string, slots?: MaterialSlots): Rig {
		return new Rig(modelLibrary.template(id), this, slots);
	}

	model(id: string): THREE.Group {
		const group = new THREE.Group();
		group.add(this.rig(id).root);
		return group;
	}
}

export function modelYaw(yaw: number): number {
	return yaw + Math.PI;
}
