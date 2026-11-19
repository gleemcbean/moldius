import type * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SPECIES_IDS, type SpeciesId } from "../shared/config/species.js";
import { loadClientModels, projectRoot } from "./helpers/modelAssets.js";

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
	preparePortrait(): void;
	dispose(): void;
}

async function loadClient() {
	const { kit } = await loadClientModels();
	const { createAnomalyModel } = (await import(
		`${projectRoot}/src/features/models/anomalies/createAnomalyModel.ts`
	)) as {
		createAnomalyModel: (
			species: SpeciesId,
			kit: unknown,
			color: number,
		) => PoseableModel;
	};
	return { createAnomalyModel, kit };
}

describe("modèles d'anomalies", () => {
	it.each([...SPECIES_IDS])(
		"%s reste à la hauteur donnée par le serveur",
		async (species) => {
			const { createAnomalyModel, kit } = await loadClient();
			const model = createAnomalyModel(species, kit, 0xd8442f);
			for (const state of [
				"idle",
				"chase",
				"special",
				"windup",
				"recover",
				"search",
			]) {
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
			model.preparePortrait();
			model.dispose();
		},
	);

	it.each([...SPECIES_IDS])(
		"%s ne partage pas sa géométrie déformée entre deux instances",
		async (species) => {
			const { createAnomalyModel, kit } = await loadClient();
			const first = createAnomalyModel(species, kit, 0xd8442f);
			const second = createAnomalyModel(species, kit, 0xd8442f);
			const pose = {
				state: "windup",
				stateMs: 400,
				extra: 0.6,
				speed: 2,
				dt: 0.05,
				time: 2.1,
			};
			first.update(pose);
			const snapshot: number[] = [];
			second.root.traverse((object) => {
				const geometry = (object as THREE.Mesh).geometry;
				if (geometry) {
					snapshot.push(...Array.from(geometry.getAttribute("position").array));
				}
			});
			first.update({ ...pose, time: 5.7 });
			const after: number[] = [];
			second.root.traverse((object) => {
				const geometry = (object as THREE.Mesh).geometry;
				if (geometry) {
					after.push(...Array.from(geometry.getAttribute("position").array));
				}
			});
			expect(after).toEqual(snapshot);
		},
	);
});
