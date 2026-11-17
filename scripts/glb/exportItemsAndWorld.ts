import path from "node:path";
import * as THREE from "three";
import { MATERIAL_IDS, OCCULT_IDS } from "../../shared/config/occult.js";
import { generateManor } from "../../shared/manor/generateManor.js";
import { PUBLIC_MATCH_CONFIG } from "../../shared/matchConfig.js";
import { AltarViews } from "../../src/features/engine/world/AltarViews.js";
import { DoorViews } from "../../src/features/engine/world/DoorViews.js";
import { GrimoireModel } from "../../src/features/grimoire/GrimoireModel.js";
import { createCameraModel } from "../../src/features/models/cameraModel.js";
import { LanternModel } from "../../src/features/models/LanternModel.js";
import {
	createMaterialModel,
	createOccultModel,
	disposeModel,
} from "../../src/features/models/occultModels.js";
import { createWalkieModel } from "../../src/features/models/walkieModel.js";
import { applyLanternPlaceholders } from "./exportEntities.js";
import {
	type ExportContext,
	exportObjectToGlb,
	type GlbReport,
} from "./placeholderMaterials.js";

function exportDoorStyle(
	ctx: ExportContext,
	style: number,
	name: string,
	outPath: string,
): Promise<GlbReport> {
	const layout = generateManor(7, { ...PUBLIC_MATCH_CONFIG, pickupTotal: 0 });
	const baseOpening = layout.openings.find((o) => o.door !== null);
	if (!baseOpening?.door) {
		throw new Error("Aucune porte trouvée dans le manoir généré");
	}
	const clonedOpening = {
		...baseOpening,
		door: { ...baseOpening.door, style, initiallyOpen: false },
	};
	const singleDoorLayout = {
		...layout,
		openings: [clonedOpening],
	};
	const views = new DoorViews(singleDoorLayout, ctx.kit);
	const door = views.doors.values().next().value;
	if (!door) {
		throw new Error("Impossible de construire la porte");
	}
	door.pivot.position.set(0, 0, 0);
	door.pivot.rotation.set(0, 0, 0);
	door.pivot.name = name;
	door.pivot.traverse((obj) => {
		if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material)) return;
		const mat = obj.material;
		if (
			mat instanceof THREE.MeshStandardMaterial &&
			mat.map?.name.startsWith("wood")
		) {
			obj.material = ctx.placeholders.dyn_wood_variant;
		}
	});
	return exportObjectToGlb(door.pivot, outPath).finally(() => {
		disposeModel(views.group);
	});
}

export async function exportItemsAndWorld(
	ctx: ExportContext,
	baseOutDir: string,
): Promise<GlbReport[]> {
	const reports: GlbReport[] = [];

	// 1. Tools
	const lantern = new LanternModel(ctx.kit, 1, null);
	lantern.update(0.016, true);
	applyLanternPlaceholders(lantern.root, ctx.placeholders);
	lantern.root.name = "lantern";
	reports.push(
		await exportObjectToGlb(
			lantern.root,
			path.join(baseOutDir, "tools", "lantern.glb"),
		),
	);
	disposeModel(lantern.root);

	const cam = createCameraModel(
		ctx.kit,
		ctx.placeholders.dyn_camera_screen.map,
	);
	cam.screen.material = ctx.placeholders.dyn_camera_screen;
	cam.flash.material = ctx.placeholders.dyn_camera_flash;
	cam.root.name = "camera";
	reports.push(
		await exportObjectToGlb(
			cam.root,
			path.join(baseOutDir, "tools", "camera.glb"),
		),
	);
	disposeModel(cam.root);

	const walkie = createWalkieModel(ctx.kit);
	walkie.name = "walkie";
	walkie.traverse((obj) => {
		if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material)) return;
		const mat = obj.material;
		if (
			mat instanceof THREE.MeshStandardMaterial &&
			mat.emissive.getHex() === 0x6fbf5a
		) {
			obj.material = ctx.placeholders.dyn_walkie_display;
		}
	});
	reports.push(
		await exportObjectToGlb(
			walkie,
			path.join(baseOutDir, "tools", "walkie.glb"),
		),
	);
	disposeModel(walkie);

	const grimoire = new GrimoireModel(ctx.kit);
	const leftTex = ctx.placeholders.dyn_grimoire_page_left.map;
	const rightTex = ctx.placeholders.dyn_grimoire_page_right.map;
	if (!leftTex || !rightTex) {
		throw new Error("Placeholder pages missing for grimoire");
	}
	grimoire.setPages(leftTex, rightTex);
	grimoire.root.name = "grimoire";
	grimoire.root.traverse((obj) => {
		if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material)) return;
		const mat = obj.material;
		if (mat instanceof THREE.MeshStandardMaterial) {
			if (mat.map === leftTex) {
				obj.material = ctx.placeholders.dyn_grimoire_page_left;
				obj.name = "page_left";
			} else if (mat.map === rightTex) {
				obj.material = ctx.placeholders.dyn_grimoire_page_right;
				obj.name = "page_right";
			}
		}
	});
	reports.push(
		await exportObjectToGlb(
			grimoire.root,
			path.join(baseOutDir, "tools", "grimoire.glb"),
		),
	);
	grimoire.dispose();
	disposeModel(grimoire.root);

	// 2. Occult objects
	for (const id of OCCULT_IDS) {
		const model = createOccultModel(ctx.kit, id);
		model.name = id;
		reports.push(
			await exportObjectToGlb(
				model,
				path.join(baseOutDir, "occult", `${id}.glb`),
			),
		);
		disposeModel(model);
	}

	// 3. Pickups (materials)
	for (const id of MATERIAL_IDS) {
		const model = createMaterialModel(ctx.kit, id);
		model.name = id;
		reports.push(
			await exportObjectToGlb(
				model,
				path.join(baseOutDir, "pickups", `${id}.glb`),
			),
		);
		disposeModel(model);
	}

	// 4. World objects: doors, altar book, stake orb
	reports.push(
		await exportDoorStyle(
			ctx,
			0,
			"door",
			path.join(baseOutDir, "world", "door.glb"),
		),
	);
	reports.push(
		await exportDoorStyle(
			ctx,
			2,
			"door_3panel",
			path.join(baseOutDir, "world", "door_3panel.glb"),
		),
	);

	const layout = generateManor(7, { ...PUBLIC_MATCH_CONFIG, pickupTotal: 0 });
	const singleAltar = layout.altars[0];
	if (singleAltar) {
		const altarViews = new AltarViews(
			{ ...layout, altars: [singleAltar] },
			ctx.kit,
		);
		const book = altarViews.group.children[0];
		if (book) {
			book.position.set(0, 0, 0);
			book.name = "altar_book";
			let pageIdx = 0;
			book.traverse((obj) => {
				if (!(obj instanceof THREE.Mesh) || Array.isArray(obj.material)) return;
				const mat = obj.material;
				if (
					mat instanceof THREE.MeshStandardMaterial &&
					mat.map instanceof THREE.CanvasTexture
				) {
					obj.material =
						pageIdx === 0
							? ctx.placeholders.dyn_altar_page_left
							: ctx.placeholders.dyn_altar_page_right;
					obj.name = pageIdx === 0 ? "altar_page_left" : "altar_page_right";
					pageIdx += 1;
				}
			});
			reports.push(
				await exportObjectToGlb(
					book,
					path.join(baseOutDir, "world", "altar_book.glb"),
				),
			);
		}
		altarViews.dispose();
	}

	const orbGeo = new THREE.SphereGeometry(0.09, 12, 10);
	const orbMesh = new THREE.Mesh(orbGeo, ctx.placeholders.dyn_stake_orb);
	orbMesh.name = "stake_orb";
	reports.push(
		await exportObjectToGlb(
			orbMesh,
			path.join(baseOutDir, "world", "stake_orb.glb"),
		),
	);
	orbGeo.dispose();

	return reports;
}
