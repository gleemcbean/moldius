import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { generateManor } from "../shared/manor/generateManor.js";
import type {
	FurnitureItem,
	ManorLayout,
	Room,
} from "../shared/manor/types.js";
import { PUBLIC_MATCH_CONFIG } from "../shared/matchConfig.js";
import { SeededRandom } from "../shared/random.js";
import {
	loadClientModels,
	meshCount,
	projectRoot,
} from "./helpers/modelAssets.js";

const features = `${projectRoot}/src/features`;

interface FurniturePieces {
	pieces: { geometry: THREE.BufferGeometry }[];
	animated: {
		animation: { pivot: [number, number, number] };
		pieces: { geometry: THREE.BufferGeometry }[];
	}[];
	scale: THREE.Vector3;
}

type Builder = (context: {
	item: FurnitureItem;
	room: Room;
	rng: SeededRandom;
}) => { geometry: THREE.BufferGeometry; when?: string }[];

const { furnitureParts, furnitureModelId } = (await import(
	`${features}/world/furniture/furnitureModels.ts`
)) as {
	furnitureParts: (item: FurnitureItem, room: Room) => FurniturePieces;
	furnitureModelId: (kind: string, variant: number) => string;
};
const { FURNITURE_BUILDERS } = (await import(
	`${projectRoot}/scripts/models/furniture/index.ts`
)) as { FURNITURE_BUILDERS: Record<string, Builder> };

function runtimeBox(item: FurnitureItem, room: Room): THREE.Box3 {
	const parts = furnitureParts(item, room);
	const box = new THREE.Box3();
	const scale = new THREE.Matrix4().makeScale(
		parts.scale.x,
		parts.scale.y,
		parts.scale.z,
	);
	for (const piece of parts.pieces) {
		piece.geometry.applyMatrix4(scale).computeBoundingBox();
		box.union(piece.geometry.boundingBox as THREE.Box3);
	}
	for (const { animation, pieces } of parts.animated) {
		for (const piece of pieces) {
			piece.geometry
				.translate(...animation.pivot)
				.applyMatrix4(scale)
				.computeBoundingBox();
			box.union(piece.geometry.boundingBox as THREE.Box3);
		}
	}
	return box;
}

function proceduralBox(item: FurnitureItem, room: Room): THREE.Box3 {
	const box = new THREE.Box3();
	const local = { ...item, y: 0 };
	const context = {
		...room,
		floorY: room.floorY - item.y,
		ceilingY: room.ceilingY - item.y,
	};
	for (const part of FURNITURE_BUILDERS[item.kind]({
		item: local,
		room: context,
		rng: new SeededRandom(item.seed),
	})) {
		if (part.when === "notGreenhouse" && room.type === "greenhouse") {
			continue;
		}
		part.geometry.computeBoundingBox();
		box.union(part.geometry.boundingBox as THREE.Box3);
	}
	return box;
}

const layouts: ManorLayout[] = [3, 11, 29].map((seed) =>
	generateManor(seed, { ...PUBLIC_MATCH_CONFIG, pickupTotal: 0 }),
);

describe("meubles chargés depuis les modèles", () => {
	it("épousent la hauteur de la pièce et la taille demandée", async () => {
		const { library } = await loadClientModels();
		const failures: string[] = [];
		let compared = 0;
		for (const layout of layouts) {
			for (const item of layout.furniture) {
				const template = library.template(
					furnitureModelId(item.kind, item.variant),
				);
				if (!FURNITURE_BUILDERS[item.kind] || template.userData.samples > 1) {
					continue;
				}
				compared += 1;
				const room = layout.rooms[item.roomId];
				const runtime = runtimeBox(item, room);
				const procedural = proceduralBox(item, room);
				const tolerance =
					0.08 + 0.12 * procedural.getSize(new THREE.Vector3()).length();
				const gaps = [
					runtime.min.y - procedural.min.y,
					runtime.max.y - procedural.max.y,
				];
				if (gaps.some((gap) => Math.abs(gap) > tolerance)) {
					failures.push(
						`${item.kind}#${item.variant} (${gaps.map((gap) => gap.toFixed(2)).join(", ")})`,
					);
				}
			}
		}
		expect(compared).toBeGreaterThan(200);
		expect(failures).toEqual([]);
	});

	it("construit toutes les pièces de plusieurs manoirs", async () => {
		const { materials } = await loadClientModels();
		const { ManorMeshBuilder } = (await import(
			`${features}/world/ManorMeshBuilder.ts`
		)) as {
			ManorMeshBuilder: new (
				layout: ManorLayout,
				materials: unknown,
			) => { buildRoom(room: Room): { group: THREE.Group } };
		};
		for (const layout of layouts) {
			const builder = new ManorMeshBuilder(layout, materials);
			for (const room of layout.rooms) {
				const { group } = builder.buildRoom(room);
				expect(meshCount(group)).toBeGreaterThan(0);
			}
		}
	});
});

describe("modèles du joueur et des objets", () => {
	it("anime le champignon dans toutes ses postures", async () => {
		const { kit } = await loadClientModels();
		const { MushroomModel } = (await import(
			`${features}/models/MushroomModel.ts`
		)) as {
			MushroomModel: new (
				kit: unknown,
				color: number,
				pattern?: string,
				tint?: number | null,
			) => {
				root: THREE.Object3D;
				update(dt: number, pose: Record<string, unknown>): void;
				setGhost(ghostly: boolean): void;
				lanternLightPosition: THREE.Vector3;
			};
		};
		const model = new MushroomModel(kit, 0x3f7fd6, "stars", 0x6affd8);
		for (const emote of [
			null,
			"wave",
			"dance",
			"bow",
			"point",
			"laugh",
			"panic",
		]) {
			for (const heldObject of [null, "pendulum", "censer"]) {
				model.update(0.05, {
					speed: 3,
					crouch: 0.4,
					grounded: true,
					sprinting: true,
					lanternOpen: true,
					grimoireOpen: emote === "bow",
					dead: false,
					talking: 0.5,
					camera: 2,
					walkie: true,
					heldObject,
					emote,
					emoteTime: 0.7,
				});
			}
		}
		model.setGhost(true);
		model.setGhost(false);
		expect(Number.isFinite(model.lanternLightPosition.y)).toBe(true);
	});

	it("assemble outils, portes et objets occultes", async () => {
		const { kit } = await loadClientModels();
		const { LanternModel } = (await import(
			`${features}/models/LanternModel.ts`
		)) as {
			LanternModel: new (
				kit: unknown,
				scale: number,
				tint: number | null,
			) => { root: THREE.Object3D; update(dt: number, open: boolean): number };
		};
		const lantern = new LanternModel(kit, 0.9, 0xff4a2a);
		expect(lantern.update(0.5, true)).toBeGreaterThan(0);
		const { GrimoireModel } = (await import(
			`${features}/grimoire/GrimoireModel.ts`
		)) as {
			GrimoireModel: new (
				kit: unknown,
			) => {
				flipTo(
					left: THREE.Texture,
					right: THREE.Texture,
					direction: 1 | -1,
				): void;
				update(dt: number): void;
				flipping: boolean;
			};
		};
		const grimoire = new GrimoireModel(kit);
		grimoire.flipTo(new THREE.Texture(), new THREE.Texture(), 1);
		expect(grimoire.flipping).toBe(true);
		grimoire.update(1);
		expect(grimoire.flipping).toBe(false);
		const { DoorViews } = (await import(
			`${features}/engine/world/DoorViews.ts`
		)) as {
			DoorViews: new (
				layout: ManorLayout,
				kit: unknown,
			) => { doors: Map<number, { pivot: THREE.Object3D }> };
		};
		const doors = new DoorViews(layouts[0], kit);
		expect(doors.doors.size).toBeGreaterThan(0);
		for (const door of doors.doors.values()) {
			door.pivot.traverse((object) => {
				const mesh = object as THREE.Mesh;
				if (mesh.isMesh && mesh.morphTargetInfluences) {
					expect(mesh.morphTargetInfluences.every(Number.isFinite)).toBe(true);
				}
			});
		}
		const { createOccultModel, createMaterialModel } = (await import(
			`${features}/models/occultModels.ts`
		)) as {
			createOccultModel: (kit: unknown, id: string) => THREE.Group;
			createMaterialModel: (kit: unknown, id: string) => THREE.Group;
		};
		for (const id of [
			"pendulum",
			"blackMirror",
			"runeSkull",
			"athame",
			"jadeEye",
			"censer",
		]) {
			expect(meshCount(createOccultModel(kit, id))).toBeGreaterThan(0);
		}
		for (const id of ["amethyst", "ruby", "jade", "mirror", "brass", "bone"]) {
			expect(meshCount(createMaterialModel(kit, id))).toBeGreaterThan(0);
		}
	});
});
