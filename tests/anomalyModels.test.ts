import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SPECIES_IDS, type SpeciesId } from "../shared/config/species.js";

interface PoseableModel {
	root: THREE.Object3D;
	update(input: {
		state: string;
		stateMs: number;
		extra: number;
		speed: number;
		dt: number;
		time: number;
	}): void;
}

const clientRoot = "../src/features/models";

async function loadClient() {
	const { createAnomalyModel } = (await import(
		`${clientRoot}/anomalies/createAnomalyModel.ts`
	)) as {
		createAnomalyModel: (
			species: SpeciesId,
			kit: unknown,
			color: number,
		) => PoseableModel;
	};
	const { ModelKit } = (await import(`${clientRoot}/modelKit.ts`)) as {
		ModelKit: new (materials: unknown) => unknown;
	};
	const materials = {
		get: () => new THREE.MeshStandardMaterial(),
		fresh: () => new THREE.MeshStandardMaterial(),
	};
	return { createAnomalyModel, kit: new ModelKit(materials) };
}

describe("modèles d'anomalies", () => {
	it.each([...SPECIES_IDS])(
		"%s reste à la hauteur donnée par le serveur",
		async (species) => {
			const { createAnomalyModel, kit } = await loadClient();
			const model = createAnomalyModel(species, kit, 0xd8442f);
			for (const state of ["idle", "chase", "special"]) {
				model.root.position.set(3, 4.4, -2);
				model.update({
					state,
					stateMs: 500,
					extra: 1,
					speed: 2,
					dt: 0.05,
					time: 1.3,
				});
				expect(model.root.position.toArray()).toEqual([3, 4.4, -2]);
			}
		},
	);
});
