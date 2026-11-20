import * as THREE from "three";
import type { MaterialOptions } from "../world/MaterialLibrary";
import type { ModelKit } from "./modelKit";

interface SurfaceData {
	surface?: MaterialOptions;
	owned?: string;
	slot?: string;
}

export type MaterialSlots = Record<string, MaterialOptions>;

export class Rig {
	readonly root: THREE.Object3D;
	private readonly nodes = new Map<string, THREE.Object3D>();
	private readonly ownedMaterials = new Map<string, THREE.Material>();
	private readonly ownedGeometries: THREE.BufferGeometry[] = [];

	constructor(
		template: THREE.Object3D,
		kit: ModelKit,
		private readonly slots: MaterialSlots = {},
	) {
		this.root = template.clone(true);

		this.root.traverse((object) => {
			if (object.name) {
				this.nodes.set(object.name, object);
			}

			if (object instanceof THREE.Mesh && !Array.isArray(object.material)) {
				object.material = this.resolve(kit, object.material);
			}
		});
	}

	private resolve(kit: ModelKit, template: THREE.Material): THREE.Material {
		const { surface, owned, slot } = template.userData as SurfaceData;

		if (!surface) {
			return template;
		}

		const replacement = slot ? this.slots[slot] : undefined;

		if (replacement) {
			return kit.material(replacement);
		}

		if (!owned) {
			return kit.material(surface);
		}

		let material = this.ownedMaterials.get(owned);

		if (!material) {
			material = kit.unique(surface);

			this.ownedMaterials.set(owned, material);
		}

		return material;
	}

	has(name: string): boolean {
		return this.nodes.has(name);
	}

	node(name: string): THREE.Object3D {
		const node = this.nodes.get(name);

		if (!node) {
			throw new Error(`Nœud « ${name} » absent du modèle ${this.root.name}`);
		}

		return node;
	}

	mesh(name: string): THREE.Mesh {
		const node = this.node(name);

		if (!(node instanceof THREE.Mesh)) {
			throw new Error(
				`« ${name} » n'est pas un maillage dans ${this.root.name}`,
			);
		}

		return node;
	}

	list(prefix: string): THREE.Object3D[] {
		const list: THREE.Object3D[] = [];

		for (let index = 0; this.nodes.has(`${prefix}_${index}`); index += 1) {
			list.push(this.node(`${prefix}_${index}`));
		}

		return list;
	}

	meshes(prefix: string): THREE.Mesh[] {
		const list: THREE.Mesh[] = [];

		for (let index = 0; this.nodes.has(`${prefix}_${index}`); index += 1) {
			list.push(this.mesh(`${prefix}_${index}`));
		}

		return list;
	}

	material<T extends THREE.Material = THREE.Material>(name: string): T {
		const material = this.ownedMaterials.get(name);

		if (!material) {
			throw new Error(
				`Matériau « ${name} » absent du modèle ${this.root.name}`,
			);
		}

		return material as T;
	}

	ownedMaterialList(): THREE.Material[] {
		return [...this.ownedMaterials.values()];
	}

	assign(owned: string, material: THREE.Material): void {
		this.root.traverse((object) => {
			if (
				object instanceof THREE.Mesh &&
				object.material === this.ownedMaterials.get(owned)
			) {
				object.material = material;
			}
		});

		this.ownedMaterials.get(owned)?.dispose();
		this.ownedMaterials.set(owned, material);
	}

	ownGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
		const geometry = mesh.geometry.clone();

		mesh.geometry = geometry;

		this.ownedGeometries.push(geometry);

		return geometry;
	}

	setMorphs(values: Record<string, number>): void {
		const reference = (this.root.userData.reference ?? {}) as Record<
			string,
			number
		>;

		this.root.traverse((object) => {
			if (
				!(object instanceof THREE.Mesh) ||
				!object.morphTargetDictionary ||
				!object.morphTargetInfluences
			) {
				return;
			}

			for (const [name, value] of Object.entries(values)) {
				const index = object.morphTargetDictionary[name];

				if (index !== undefined) {
					object.morphTargetInfluences[index] = value - (reference[name] ?? 0);
				}
			}
		});
	}

	dispose(): void {
		for (const geometry of this.ownedGeometries) {
			geometry.dispose();
		}

		for (const material of this.ownedMaterials.values()) {
			material.dispose();
		}
	}
}
