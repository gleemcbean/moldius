import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { ModelKit } from "../../src/features/models/modelKit.js";
import { MaterialLibrary } from "../../src/features/world/MaterialLibrary.js";
import type { BakedSurface } from "../../src/features/world/textures/surface/bakeSurface.js";
import {
	bakeRecipe,
	FINE_RECIPES,
	type FineRecipe,
} from "../../src/features/world/textures/surface/recipes.js";
import {
	type SurfaceMaps,
	TextureLibrary,
} from "../../src/features/world/textures/TextureLibrary.js";
import { installNodeCanvasShim } from "./nodeCanvasShim.js";

export type PlaceholderSlot =
	| "dyn_player_cap"
	| "dyn_wood_variant"
	| "dyn_velvet_variant"
	| "dyn_stone_variant"
	| "dyn_painting_variant"
	| "dyn_rug_variant"
	| "dyn_color_tint"
	| "dyn_grimoire_page_left"
	| "dyn_grimoire_page_right"
	| "dyn_grimoire_page_flip"
	| "dyn_camera_screen"
	| "dyn_camera_flash"
	| "dyn_altar_page_left"
	| "dyn_altar_page_right"
	| "dyn_walkie_display"
	| "dyn_lantern_glass"
	| "dyn_lantern_flame"
	| "dyn_stake_orb"
	| "dyn_veilleur_beam"
	| "dyn_anomaly_emissive";

export type PlaceholderSet = Record<
	PlaceholderSlot,
	THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
>;

function hexBytes(hex: number): [number, number, number] {
	return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function checkerTexture(
	name: string,
	width: number,
	height: number,
	cell: number,
	colorA: number,
	colorB: number,
	borderColor?: number,
	borderPx = 2,
	accentMark?: { x: number; y: number; w: number; h: number; color: number },
): THREE.DataTexture {
	const data = new Uint8Array(width * height * 4);
	const rgbA = hexBytes(colorA);
	const rgbB = hexBytes(colorB);
	const rgbBorder = borderColor !== undefined ? hexBytes(borderColor) : null;
	const rgbAccent = accentMark ? hexBytes(accentMark.color) : null;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const idx = (y * width + x) * 4;
			const isBorder =
				rgbBorder !== null &&
				(x < borderPx ||
					y < borderPx ||
					x >= width - borderPx ||
					y >= height - borderPx);
			const isAccent =
				accentMark !== undefined &&
				rgbAccent !== null &&
				x >= accentMark.x &&
				x < accentMark.x + accentMark.w &&
				y >= accentMark.y &&
				y < accentMark.y + accentMark.h;
			const check = ((Math.floor(x / cell) + Math.floor(y / cell)) & 1) === 0;
			const rgb = isBorder
				? rgbBorder
				: isAccent
					? rgbAccent
					: check
						? rgbA
						: rgbB;
			data[idx] = rgb[0];
			data[idx + 1] = rgb[1];
			data[idx + 2] = rgb[2];
			data[idx + 3] = 255;
		}
	}

	const texture = new THREE.DataTexture(
		data,
		width,
		height,
		THREE.RGBAFormat,
		THREE.UnsignedByteType,
	);
	texture.name = name;
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.magFilter = THREE.NearestFilter;
	texture.minFilter = THREE.NearestFilter;
	texture.generateMipmaps = false;
	texture.needsUpdate = true;
	return texture;
}

export function createPlaceholderSet(): PlaceholderSet {
	return {
		dyn_player_cap: new THREE.MeshStandardMaterial({
			name: "dyn_player_cap",
			map: checkerTexture(
				"placeholder_player_cap",
				64,
				32,
				4,
				0xffffff,
				0xd8d8d8,
				0xb8b8b8,
				2,
			),
			roughness: 0.6,
		}),
		dyn_wood_variant: new THREE.MeshStandardMaterial({
			name: "dyn_wood_variant",
			map: checkerTexture(
				"placeholder_wood_variant",
				64,
				64,
				8,
				0xa87c52,
				0x8f6640,
				0x6b4a2b,
				2,
			),
			roughness: 0.82,
		}),
		dyn_velvet_variant: new THREE.MeshStandardMaterial({
			name: "dyn_velvet_variant",
			map: checkerTexture(
				"placeholder_velvet_variant",
				64,
				64,
				4,
				0xc4c4c4,
				0xa8a8a8,
			),
			roughness: 0.95,
		}),
		dyn_stone_variant: new THREE.MeshStandardMaterial({
			name: "dyn_stone_variant",
			map: checkerTexture(
				"placeholder_stone_variant",
				64,
				64,
				8,
				0xa2a29d,
				0x868680,
				0x6b6b66,
				2,
			),
			roughness: 0.85,
		}),
		dyn_painting_variant: new THREE.MeshStandardMaterial({
			name: "dyn_painting_variant",
			map: checkerTexture(
				"placeholder_painting_variant",
				32,
				40,
				8,
				0xff00ff,
				0x161616,
				0x7a5a24,
				2,
			),
			roughness: 0.85,
		}),
		dyn_rug_variant: new THREE.MeshStandardMaterial({
			name: "dyn_rug_variant",
			map: checkerTexture(
				"placeholder_rug_variant",
				48,
				64,
				6,
				0xb84848,
				0x8a3232,
				0xd4b25c,
				3,
			),
			roughness: 0.95,
		}),
		dyn_color_tint: new THREE.MeshStandardMaterial({
			name: "dyn_color_tint",
			map: checkerTexture(
				"placeholder_color_tint",
				16,
				16,
				4,
				0xf5f5f5,
				0xe0e0e0,
			),
			roughness: 0.75,
		}),
		dyn_grimoire_page_left: new THREE.MeshStandardMaterial({
			name: "dyn_grimoire_page_left",
			map: checkerTexture(
				"placeholder_grimoire_page_left",
				128,
				160,
				8,
				0xeadab4,
				0xd8c69e,
				0x9c865a,
				3,
				{
					x: 12,
					y: 14,
					w: 20,
					h: 20,
					color: 0x3b6cb8,
				},
			),
			roughness: 0.95,
		}),
		dyn_grimoire_page_right: new THREE.MeshStandardMaterial({
			name: "dyn_grimoire_page_right",
			map: checkerTexture(
				"placeholder_grimoire_page_right",
				128,
				160,
				8,
				0xeadab4,
				0xd8c69e,
				0x9c865a,
				3,
				{
					x: 96,
					y: 14,
					w: 20,
					h: 20,
					color: 0xb83b3b,
				},
			),
			roughness: 0.95,
		}),
		dyn_grimoire_page_flip: new THREE.MeshStandardMaterial({
			name: "dyn_grimoire_page_flip",
			map: checkerTexture(
				"placeholder_grimoire_page_flip",
				128,
				160,
				8,
				0xeadab4,
				0xd8c69e,
				0x3ba88f,
				3,
			),
			roughness: 0.95,
		}),
		dyn_camera_screen: new THREE.MeshBasicMaterial({
			name: "dyn_camera_screen",
			map: checkerTexture(
				"placeholder_camera_screen",
				64,
				64,
				8,
				0x20352c,
				0x12201a,
				0x62b88a,
				2,
			),
		}),
		dyn_camera_flash: new THREE.MeshBasicMaterial({
			name: "dyn_camera_flash",
			color: 0xe6edf5,
		}),
		dyn_altar_page_left: new THREE.MeshStandardMaterial({
			name: "dyn_altar_page_left",
			map: checkerTexture(
				"placeholder_altar_page_left",
				96,
				128,
				8,
				0xe6d6ac,
				0xd2c094,
				0x1bb5a5,
				3,
			),
			roughness: 0.95,
			emissive: 0x5c4d28,
			emissiveIntensity: 0.45,
		}),
		dyn_altar_page_right: new THREE.MeshStandardMaterial({
			name: "dyn_altar_page_right",
			map: checkerTexture(
				"placeholder_altar_page_right",
				96,
				128,
				8,
				0xe6d6ac,
				0xd2c094,
				0x1bb5a5,
				3,
				{
					x: 34,
					y: 48,
					w: 28,
					h: 28,
					color: 0x1bb5a5,
				},
			),
			roughness: 0.95,
			emissive: 0x5c4d28,
			emissiveIntensity: 0.45,
		}),
		dyn_walkie_display: new THREE.MeshStandardMaterial({
			name: "dyn_walkie_display",
			map: checkerTexture(
				"placeholder_walkie_display",
				32,
				16,
				4,
				0x9fdc8a,
				0x5ca84c,
				0x243b20,
				1,
			),
			roughness: 0.3,
			emissive: 0x6fbf5a,
			emissiveIntensity: 0.8,
		}),
		dyn_lantern_glass: new THREE.MeshStandardMaterial({
			name: "dyn_lantern_glass",
			color: 0xffe6b0,
			roughness: 0.1,
			transparent: true,
			opacity: 0.25,
			depthWrite: false,
			side: THREE.DoubleSide,
		}),
		dyn_lantern_flame: new THREE.MeshBasicMaterial({
			name: "dyn_lantern_flame",
			map: checkerTexture(
				"placeholder_lantern_flame",
				16,
				24,
				4,
				0xffd05c,
				0xff8a24,
			),
			transparent: true,
			alphaTest: 0.15,
			side: THREE.DoubleSide,
			depthWrite: false,
		}),
		dyn_stake_orb: new THREE.MeshBasicMaterial({
			name: "dyn_stake_orb",
			color: 0xff00ff,
		}),
		dyn_veilleur_beam: new THREE.MeshBasicMaterial({
			name: "dyn_veilleur_beam",
			color: 0xd8e4ff,
			transparent: true,
			opacity: 0.22,
			side: THREE.DoubleSide,
			depthWrite: false,
		}),
		dyn_anomaly_emissive: new THREE.MeshBasicMaterial({
			name: "dyn_anomaly_emissive",
			color: 0xff6a2a,
		}),
	};
}

const BAKED_SURFACE_CACHE = new Map<string, BakedSurface>();

function makeDataTex(
	data: Uint8Array,
	width: number,
	height: number,
	color: boolean,
	name: string,
	tileX: number,
	tileY: number,
): THREE.DataTexture {
	const tex = new THREE.DataTexture(
		data,
		width,
		height,
		THREE.RGBAFormat,
		THREE.UnsignedByteType,
	);
	tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
	tex.magFilter = THREE.LinearFilter;
	tex.minFilter = THREE.LinearMipmapLinearFilter;
	tex.wrapS = THREE.RepeatWrapping;
	tex.wrapT = THREE.RepeatWrapping;
	tex.repeat.set(1 / tileX, 1 / tileY);
	tex.name = name;
	tex.generateMipmaps = true;
	tex.needsUpdate = true;
	return tex;
}

class ExportTextureLibrary extends TextureLibrary {
	private readonly exportSurfaces = new Map<string, SurfaceMaps>();

	override surface(key: string): SurfaceMaps {
		const recipe: FineRecipe | undefined = FINE_RECIPES[key];
		if (!recipe) {
			return super.surface(key);
		}
		const existing = this.exportSurfaces.get(key);
		if (existing) {
			return existing;
		}
		let baked = BAKED_SURFACE_CACHE.get(key);
		if (!baked) {
			baked = bakeRecipe(key, 1);
			BAKED_SURFACE_CACHE.set(key, baked);
		}
		const [tileX, tileY] = recipe.tile;
		const created: SurfaceMaps = {
			map: makeDataTex(
				baked.albedo,
				baked.width,
				baked.height,
				true,
				key,
				tileX,
				tileY,
			),
			normalMap: makeDataTex(
				baked.normal,
				baked.width,
				baked.height,
				false,
				`${key}:normal`,
				tileX,
				tileY,
			),
			ormMap: makeDataTex(
				baked.orm,
				baked.width,
				baked.height,
				false,
				`${key}:orm`,
				tileX,
				tileY,
			),
			fine: true,
			metallic: recipe.metallic === true,
			depth: recipe.depth,
			parallax: recipe.parallax,
		};
		this.exportSurfaces.set(key, created);
		return created;
	}

	override all(): THREE.Texture[] {
		const list = super.all();
		for (const s of this.exportSurfaces.values()) {
			if (s.map) list.push(s.map);
			if (s.normalMap) list.push(s.normalMap);
			if (s.ormMap) list.push(s.ormMap);
		}
		return list;
	}

	override reflections(): THREE.CubeTexture | null {
		return null;
	}
}

export interface ExportContext {
	textures: TextureLibrary;
	materials: MaterialLibrary;
	kit: ModelKit;
	placeholders: PlaceholderSet;
	dispose: () => void;
}

export async function createExportContext(): Promise<ExportContext> {
	installNodeCanvasShim();
	const textures = new ExportTextureLibrary(1, { detail: 1, parallax: 0 });
	const materials = new MaterialLibrary(textures);
	const kit = new ModelKit(materials);
	const placeholders = createPlaceholderSet();
	return {
		textures,
		materials,
		kit,
		placeholders,
		dispose: () => {
			for (const mat of Object.values(placeholders)) {
				mat.map?.dispose();
				mat.dispose();
			}
			materials.dispose();
			textures.dispose();
		},
	};
}

function readableMaterialName(material: THREE.Material): string {
	if (material.name.startsWith("dyn_")) {
		return material.name;
	}
	if (material.name.startsWith("[")) {
		try {
			const parsed = JSON.parse(material.name) as unknown[];
			const tex = typeof parsed[0] === "string" && parsed[0] ? parsed[0] : "";
			const color =
				typeof parsed[1] === "number"
					? parsed[1].toString(16).padStart(6, "0")
					: "ffffff";
			return tex ? `mat_${tex}_${color}` : `mat_color_${color}`;
		} catch {
			return material.name;
		}
	}
	return material.name || "mat_default";
}

function sanitizeGeometry(geometry: THREE.BufferGeometry): void {
	for (const attrName of Object.keys(geometry.attributes)) {
		if (attrName !== "position" && attrName !== "normal" && attrName !== "uv") {
			geometry.deleteAttribute(attrName);
		}
	}
	const pos = geometry.getAttribute("position");
	if (pos && !geometry.getAttribute("uv")) {
		geometry.setAttribute(
			"uv",
			new THREE.Float32BufferAttribute(new Float32Array(pos.count * 2), 2),
		);
	}
	if (pos && !geometry.getAttribute("normal")) {
		geometry.computeVertexNormals();
	}
}

function sanitizeMaterial(material: THREE.Material): THREE.Material {
	if (material instanceof THREE.ShaderMaterial) {
		const color =
			material.uniforms?.color?.value instanceof THREE.Color
				? material.uniforms.color.value.clone()
				: new THREE.Color(0xa58a6a);
		return new THREE.MeshStandardMaterial({
			name: material.name || "dyn_fp_arm_skin",
			color,
			roughness: 0.85,
		});
	}
	if (material instanceof THREE.MeshStandardMaterial) {
		material.envMap = null;
	}
	material.name = readableMaterialName(material);
	return material;
}

export function sanitizeSceneForGlb(root: THREE.Object3D): {
	dynamicMaterials: string[];
	pivots: string[];
	bbox: { min: [number, number, number]; max: [number, number, number] };
} {
	const dynamicMaterials = new Set<string>();
	const pivots = new Set<string>();
	root.updateMatrixWorld(true);
	root.traverse((obj) => {
		if (obj !== root && obj.name) {
			pivots.add(obj.name);
		}
		if (obj instanceof THREE.Mesh) {
			sanitizeGeometry(obj.geometry);
			if (Array.isArray(obj.material)) {
				obj.material = obj.material.map((m) => sanitizeMaterial(m));
				for (const m of obj.material) {
					if (m.name.startsWith("dyn_")) dynamicMaterials.add(m.name);
				}
			} else if (obj.material) {
				obj.material = sanitizeMaterial(obj.material);
				if (obj.material.name.startsWith("dyn_")) {
					dynamicMaterials.add(obj.material.name);
				}
			}
		}
	});
	const box = new THREE.Box3().setFromObject(root);
	const min: [number, number, number] = box.isEmpty()
		? [0, 0, 0]
		: [
				Number(box.min.x.toFixed(4)),
				Number(box.min.y.toFixed(4)),
				Number(box.min.z.toFixed(4)),
			];
	const max: [number, number, number] = box.isEmpty()
		? [0, 0, 0]
		: [
				Number(box.max.x.toFixed(4)),
				Number(box.max.y.toFixed(4)),
				Number(box.max.z.toFixed(4)),
			];
	return {
		dynamicMaterials: [...dynamicMaterials].sort(),
		pivots: [...pivots].sort(),
		bbox: { min, max },
	};
}

export interface GlbReport {
	outPath: string;
	byteLength: number;
	dynamicMaterials: string[];
	pivots: string[];
	bbox: { min: [number, number, number]; max: [number, number, number] };
}

export async function exportObjectToGlb(
	root: THREE.Object3D,
	outPath: string,
): Promise<GlbReport> {
	const info = sanitizeSceneForGlb(root);
	const exporter = new GLTFExporter();
	const glb = (await exporter.parseAsync(root, {
		binary: true,
		onlyVisible: true,
	})) as ArrayBuffer;
	await mkdir(path.dirname(outPath), { recursive: true });
	const bytes = new Uint8Array(glb);
	await writeFile(outPath, bytes);
	return {
		outPath,
		byteLength: bytes.byteLength,
		...info,
	};
}
