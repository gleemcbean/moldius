import { inflateSync } from "node:zlib";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { describe, expect, it } from "vitest";
import { exportEntities } from "../scripts/glb/exportEntities.js";
import { exportFurnitureModels } from "../scripts/glb/exportFurniture.js";
import { exportItemsAndWorld } from "../scripts/glb/exportItemsAndWorld.js";
import { installNodeCanvasShim } from "../scripts/glb/nodeCanvasShim.js";
import {
	createExportContext,
	createPlaceholderSet,
	exportObjectToGlb,
} from "../scripts/glb/placeholderMaterials.js";
import { bakeRecipe } from "../src/features/world/textures/surface/recipes.js";

function parseGlb(buffer: ArrayBuffer): {
	json: {
		images?: { bufferView: number; mimeType: string }[];
		bufferViews?: { byteOffset?: number; byteLength: number }[];
	};
	bin: Uint8Array;
} {
	const view = new DataView(buffer);
	const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 4));
	expect(magic).toBe("glTF");
	const jsonLength = view.getUint32(12, true);
	const jsonText = new TextDecoder().decode(
		new Uint8Array(buffer, 20, jsonLength),
	);
	const binHeaderOffset = 20 + jsonLength;
	const binLength = view.getUint32(binHeaderOffset, true);
	const bin = new Uint8Array(buffer, binHeaderOffset + 8, binLength);
	return { json: JSON.parse(jsonText), bin };
}

function decodePngRgba(png: Uint8Array): {
	width: number;
	height: number;
	rgba: Uint8Array;
} {
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	let offset = 8;
	let width = 0;
	let height = 0;
	const idatParts: Uint8Array[] = [];
	while (offset < png.length) {
		const length = view.getUint32(offset, false);
		const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
		const data = png.subarray(offset + 8, offset + 8 + length);
		if (type === "IHDR") {
			const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
			width = dv.getUint32(0, false);
			height = dv.getUint32(4, false);
		} else if (type === "IDAT") {
			idatParts.push(data);
		} else if (type === "IEND") {
			break;
		}
		offset += 12 + length;
	}
	const raw = inflateSync(Buffer.concat(idatParts));
	const stride = width * 4;
	const rgba = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y += 1) {
		expect(raw[y * (stride + 1)]).toBe(0);
		rgba.set(
			raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)),
			y * stride,
		);
	}
	return { width, height, rgba };
}

describe("export GLB — shim PNG et textures exactes", () => {
	it("préserve au pixel près DataTexture (flipY=false) et CanvasTexture (flipY=true)", async () => {
		installNodeCanvasShim();

		// 1) DataTexture 2x2 non-symétrique verticalement
		const dataPixels = new Uint8Array([
			255,
			0,
			0,
			255, // top-left rouge
			0,
			255,
			0,
			255, // top-right vert
			0,
			0,
			255,
			255, // bottom-left bleu
			255,
			255,
			0,
			255, // bottom-right jaune
		]);
		const dataTex = new THREE.DataTexture(dataPixels, 2, 2, THREE.RGBAFormat);
		dataTex.colorSpace = THREE.SRGBColorSpace;
		dataTex.needsUpdate = true;

		// 2) CanvasTexture 2x2 non-symétrique verticalement
		const canvas = document.createElement("canvas");
		canvas.width = 2;
		canvas.height = 2;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas 2d context missing");
		const imgData = ctx.createImageData(2, 2);
		imgData.data.set([
			10,
			20,
			30,
			255, // top-left
			40,
			50,
			60,
			255, // top-right
			70,
			80,
			90,
			255, // bottom-left
			100,
			110,
			120,
			255, // bottom-right
		]);
		ctx.putImageData(imgData, 0, 0);
		const canvasTex = new THREE.CanvasTexture(canvas);
		canvasTex.colorSpace = THREE.SRGBColorSpace;

		const ormPixels = new Uint8Array([
			200, 128, 0, 255, 210, 140, 0, 255, 220, 160, 0, 255, 230, 180, 0, 255,
		]);
		const ormTex = new THREE.DataTexture(ormPixels, 2, 2, THREE.RGBAFormat);
		ormTex.needsUpdate = true;

		const group = new THREE.Group();
		group.add(
			new THREE.Mesh(
				new THREE.BoxGeometry(1, 1, 1),
				new THREE.MeshStandardMaterial({
					map: dataTex,
					roughnessMap: ormTex,
					aoMap: ormTex,
				}),
			),
			new THREE.Mesh(
				new THREE.BoxGeometry(1, 1, 1),
				new THREE.MeshStandardMaterial({ map: canvasTex }),
			),
		);

		const glb = (await new GLTFExporter().parseAsync(group, {
			binary: true,
		})) as ArrayBuffer;
		const { json, bin } = parseGlb(glb);
		const images = json.images ?? [];
		const bufferViews = json.bufferViews ?? [];
		expect(images.length).toBe(4);

		const decoded = images.map((img) => {
			const bv = bufferViews[img.bufferView];
			return Array.from(
				decodePngRgba(
					bin.subarray(
						bv.byteOffset ?? 0,
						(bv.byteOffset ?? 0) + bv.byteLength,
					),
				).rgba,
			);
		});
		expect(decoded).toContainEqual(Array.from(dataPixels));
		expect(decoded).toContainEqual(Array.from(ormPixels));
		expect(decoded).toContainEqual([
			70, 80, 90, 255, 100, 110, 120, 255, 10, 20, 30, 255, 40, 50, 60, 255,
		]);
	});

	it("prepare les textures natives au pixel près et crée tous les placeholders dyn_*", async () => {
		const ctx = await createExportContext();
		try {
			const wood = ctx.textures.surface("woodDark");
			const expected = bakeRecipe("woodDark", 1);
			const actualData = (wood.map.image as { data: Uint8Array }).data;
			expect(
				Buffer.compare(Buffer.from(actualData), Buffer.from(expected.albedo)),
			).toBe(0);

			const placeholders = createPlaceholderSet();
			expect(placeholders.dyn_player_cap.name).toBe("dyn_player_cap");
			expect(placeholders.dyn_painting_variant.map).toBeTruthy();

			const probe = new THREE.Mesh(
				new THREE.BoxGeometry(1, 1, 1),
				ctx.materials.get({ texture: "woodDark", roughness: 0.8 }),
			);
			const outFile = `${process.cwd()}/.tmp-test-probe.glb`;
			const report = await exportObjectToGlb(probe, outFile);
			expect(report.byteLength).toBeGreaterThan(100);
			const { readFileSync, unlinkSync } = await import("node:fs");
			const raw = readFileSync(outFile);
			unlinkSync(outFile);
			const { json, bin } = parseGlb(
				raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
			);
			const images = json.images ?? [];
			const bufferViews = json.bufferViews ?? [];
			const decodedBuffers = images.map((img) => {
				const bv = bufferViews[img.bufferView];
				return Buffer.from(
					decodePngRgba(
						bin.subarray(
							bv.byteOffset ?? 0,
							(bv.byteOffset ?? 0) + bv.byteLength,
						),
					).rgba,
				);
			});
			expect(
				decodedBuffers.some(
					(b) => Buffer.compare(b, Buffer.from(expected.albedo)) === 0,
				),
			).toBe(true);
			expect(
				decodedBuffers.some(
					(b) => Buffer.compare(b, Buffer.from(expected.normal)) === 0,
				),
			).toBe(true);
		} finally {
			ctx.dispose();
		}
	});

	it("exporte les meubles avec variantes de forme et placeholders dyn_*", async () => {
		const { rmSync, existsSync } = await import("node:fs");
		const outDir = `${process.cwd()}/.tmp-test-furniture`;
		const ctx = await createExportContext();
		try {
			const reports = await exportFurnitureModels(ctx, outDir, [
				"table",
				"painting",
				"chandelier",
			]);
			expect(existsSync(`${outDir}/table.glb`)).toBe(true);
			expect(reports.some((r) => r.outPath.includes("table_"))).toBe(true);
			const tableReport = reports.find((r) => r.outPath.endsWith("table.glb"));
			expect(tableReport).toBeDefined();
			expect(tableReport?.dynamicMaterials).toContain("dyn_wood_variant");

			const paintingReport = reports.find((r) =>
				r.outPath.endsWith("painting.glb"),
			);
			expect(paintingReport).toBeDefined();
			expect(paintingReport?.dynamicMaterials).toContain(
				"dyn_painting_variant",
			);

			const chandelierReport = reports.find((r) =>
				r.outPath.endsWith("chandelier.glb"),
			);
			expect(chandelierReport).toBeDefined();
			expect(
				chandelierReport?.pivots.some((p) => p.startsWith("anim_swing")),
			).toBe(true);
		} finally {
			ctx.dispose();
			rmSync(outDir, { recursive: true, force: true });
		}
	});

	it("exporte les anomalies et modèles joueur avec pivots et placeholders dyn_*", async () => {
		const { rmSync, existsSync } = await import("node:fs");
		const outDir = `${process.cwd()}/.tmp-test-entities`;
		const ctx = await createExportContext();
		try {
			const reports = await exportEntities(ctx, outDir, [
				"murmure",
				"veilleur",
				"double",
			]);
			expect(existsSync(`${outDir}/anomalies/murmure.glb`)).toBe(true);
			expect(existsSync(`${outDir}/anomalies/veilleur.glb`)).toBe(true);
			expect(existsSync(`${outDir}/anomalies/double.glb`)).toBe(true);
			expect(existsSync(`${outDir}/player/mushroom.glb`)).toBe(true);
			expect(existsSync(`${outDir}/player/first_person_body.glb`)).toBe(true);
			expect(existsSync(`${outDir}/player/first_person_arms.glb`)).toBe(true);

			const doubleReport = reports.find((r) =>
				r.outPath.endsWith("double.glb"),
			);
			expect(doubleReport?.dynamicMaterials).toContain("dyn_player_cap");
			expect(doubleReport?.pivots).toContain("cap");
			expect(doubleReport?.pivots).toContain("hips");

			const veilleurReport = reports.find((r) =>
				r.outPath.endsWith("veilleur.glb"),
			);
			expect(veilleurReport?.dynamicMaterials).toContain("dyn_veilleur_beam");

			const mushroomReport = reports.find((r) =>
				r.outPath.endsWith("mushroom.glb"),
			);
			expect(mushroomReport?.dynamicMaterials).toContain("dyn_player_cap");
			expect(mushroomReport?.dynamicMaterials).toContain("dyn_lantern_glass");
			expect(mushroomReport?.dynamicMaterials).toContain("dyn_lantern_flame");
			expect(mushroomReport?.pivots).toContain("hips");
			expect(mushroomReport?.pivots).toContain("cap");
		} finally {
			ctx.dispose();
			rmSync(outDir, { recursive: true, force: true });
		}
	});

	it("exporte outils, occultes, pickups et objets monde avec placeholders dyn_*", async () => {
		const { rmSync, existsSync } = await import("node:fs");
		const outDir = `${process.cwd()}/.tmp-test-items`;
		const ctx = await createExportContext();
		try {
			const reports = await exportItemsAndWorld(ctx, outDir);
			for (const rel of [
				"tools/lantern.glb",
				"tools/camera.glb",
				"tools/walkie.glb",
				"tools/grimoire.glb",
				"occult/athame.glb",
				"pickups/amethyst.glb",
				"world/door.glb",
				"world/door_3panel.glb",
				"world/altar_book.glb",
				"world/stake_orb.glb",
			]) {
				expect(existsSync(`${outDir}/${rel}`), rel).toBe(true);
			}
			const grimoire = reports.find((r) => r.outPath.endsWith("grimoire.glb"));
			expect(grimoire?.dynamicMaterials).toContain("dyn_grimoire_page_left");
			expect(grimoire?.dynamicMaterials).toContain("dyn_grimoire_page_right");

			const cam = reports.find((r) => r.outPath.endsWith("camera.glb"));
			expect(cam?.dynamicMaterials).toContain("dyn_camera_screen");
			expect(cam?.dynamicMaterials).toContain("dyn_camera_flash");

			const altar = reports.find((r) => r.outPath.endsWith("altar_book.glb"));
			expect(altar?.dynamicMaterials).toContain("dyn_altar_page_left");
			expect(altar?.dynamicMaterials).toContain("dyn_altar_page_right");

			const door = reports.find((r) => r.outPath.endsWith("door.glb"));
			expect(door?.dynamicMaterials).toContain("dyn_wood_variant");
		} finally {
			ctx.dispose();
			rmSync(outDir, { recursive: true, force: true });
		}
	});
});
