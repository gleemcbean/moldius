import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import type { MaterialOptions } from "../../src/features/world/MaterialLibrary";
import { textureFile } from "../../src/features/world/textures/textureKeys";
import { describeMaterial } from "./exportMaterials";

export interface TextureManifest {
	surfaces: Record<
		string,
		{
			category: string;
			fine: boolean;
			tile: number[];
			normal?: boolean;
			metallic?: boolean;
		}
	>;
}

export interface GlbReport {
	outPath: string;
	byteLength: number;
	nodes: string[];
	bbox: { min: number[]; max: number[] };
}

interface GltfJson {
	materials?: {
		extras?: { surface?: MaterialOptions };
		extensions?: Record<string, unknown>;
		pbrMetallicRoughness?: Record<string, unknown>;
		normalTexture?: unknown;
		occlusionTexture?: unknown;
		emissiveTexture?: unknown;
	}[];
	textures?: { sampler: number; source: number }[];
	images?: { uri: string; mimeType: string }[];
	samplers?: Record<string, number>[];
	extensionsUsed?: string[];
}

const NEAREST = 9728;
const LINEAR = 9729;
const NEAREST_MIPMAP_LINEAR = 9986;
const LINEAR_MIPMAP_LINEAR = 9987;
const REPEAT = 10497;
const MERGE_TOLERANCE = 1e-7;
const KEPT_ATTRIBUTES = new Set(["position", "normal", "uv"]);

class NodeFileReader {
	result: ArrayBuffer | string | null = null;
	onload: (() => void) | null = null;
	onloadend: (() => void) | null = null;

	readAsArrayBuffer(blob: Blob): void {
		void blob.arrayBuffer().then((buffer) => {
			this.result = buffer;
			this.onload?.();
			this.onloadend?.();
		});
	}

	readAsDataURL(blob: Blob): void {
		void blob.arrayBuffer().then((buffer) => {
			this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
			this.onload?.();
			this.onloadend?.();
		});
	}
}

const globals = globalThis as { FileReader?: unknown };
globals.FileReader ??= NodeFileReader;

function prepareGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
	for (const name of Object.keys(geometry.attributes)) {
		if (!KEPT_ATTRIBUTES.has(name) && !name.startsWith("uv")) {
			geometry.deleteAttribute(name);
		}
	}
	const position = geometry.getAttribute("position");
	if (!geometry.getAttribute("uv")) {
		geometry.setAttribute(
			"uv",
			new THREE.Float32BufferAttribute(new Float32Array(position.count * 2), 2),
		);
	}
	if (!geometry.getAttribute("normal")) {
		geometry.computeVertexNormals();
	}
	const normal = geometry.getAttribute("normal") as THREE.BufferAttribute;
	const vector = new THREE.Vector3();
	for (let index = 0; index < normal.count; index += 1) {
		vector.fromBufferAttribute(normal, index);
		const length = vector.length();
		if (length > 0 && Math.abs(length - 1) > 1e-4) {
			vector.divideScalar(length);
			normal.setXYZ(index, vector.x, vector.y, vector.z);
		}
	}
	return mergeVertices(geometry, MERGE_TOLERANCE);
}

export function prepareScene(root: THREE.Object3D): string[] {
	const names = new Set<string>();
	root.traverse((object) => {
		if (object.name && object !== root) {
			if (names.has(object.name)) {
				throw new Error(
					`Nom de nœud en double « ${object.name} » dans ${root.name}`,
				);
			}
			names.add(object.name);
		}
		const data = object.userData as Record<string, unknown>;
		if (!object.visible) {
			data.hidden = true;
		}
		const { x, y, z, order } = object.rotation;
		if (x !== 0 || y !== 0 || z !== 0 || order !== "XYZ") {
			data.euler = [x, y, z, order];
		}
		if (object.renderOrder !== 0) {
			data.renderOrder = object.renderOrder;
		}
		if (object instanceof THREE.Mesh) {
			object.geometry = prepareGeometry(object.geometry);
			object.material = Array.isArray(object.material)
				? object.material.map(describeMaterial)
				: describeMaterial(object.material);
		}
	});
	return [...names].sort();
}

function posix(value: string): string {
	return value.split(path.sep).join("/");
}

function linkTextures(
	json: GltfJson,
	outPath: string,
	textureRoot: string,
	manifest: TextureManifest,
): void {
	const base = posix(path.relative(path.dirname(outPath), textureRoot));
	const images = new Map<string, number>();
	const textures = new Map<string, number>();
	const samplers = new Map<boolean, number>();
	let transformed = false;
	const samplerFor = (fine: boolean) => {
		let index = samplers.get(fine);
		if (index === undefined) {
			json.samplers ??= [];
			index = json.samplers.length;
			json.samplers.push({
				magFilter: fine ? LINEAR : NEAREST,
				minFilter: fine ? LINEAR_MIPMAP_LINEAR : NEAREST_MIPMAP_LINEAR,
				wrapS: REPEAT,
				wrapT: REPEAT,
			});
			samplers.set(fine, index);
		}
		return index;
	};
	const textureFor = (file: string, fine: boolean) => {
		const id = `${file}|${fine}`;
		let index = textures.get(id);
		if (index === undefined) {
			let image = images.get(file);
			if (image === undefined) {
				json.images ??= [];
				image = json.images.length;
				json.images.push({ uri: `${base}/${file}`, mimeType: "image/png" });
				images.set(file, image);
			}
			json.textures ??= [];
			index = json.textures.length;
			json.textures.push({ sampler: samplerFor(fine), source: image });
			textures.set(id, index);
		}
		return index;
	};
	for (const material of json.materials ?? []) {
		const surface = material.extras?.surface;
		const key = surface?.texture;
		if (!surface || !key) {
			continue;
		}
		const info = manifest.surfaces[key];
		if (!info) {
			throw new Error(`Texture absente du manifeste : ${key}`);
		}
		const [tileX, tileY] = surface.fixedRepeat ? [1, 1] : info.tile;
		const reference = (file: string) => {
			const ref: Record<string, unknown> = {
				index: textureFor(file, info.fine),
			};
			if (tileX !== 1 || tileY !== 1) {
				ref.extensions = {
					KHR_texture_transform: { scale: [1 / tileX, 1 / tileY] },
				};
				transformed = true;
			}
			return ref;
		};
		material.pbrMetallicRoughness ??= {};
		material.pbrMetallicRoughness.baseColorTexture = reference(
			textureFile(info.category, key, "albedo"),
		);
		if (surface.unlit) {
			continue;
		}
		const relief = surface.relief ?? 1;
		if ((info.fine || info.normal) && relief > 0) {
			material.normalTexture = {
				...reference(textureFile(info.category, key, "normal")),
				scale: relief,
			};
		}
		if (info.fine) {
			material.pbrMetallicRoughness.metallicRoughnessTexture = reference(
				textureFile(info.category, key, "orm"),
			);
			material.occlusionTexture = reference(
				textureFile(info.category, key, "orm"),
			);
		}
		if (surface.emissive) {
			material.emissiveTexture = reference(
				textureFile(info.category, key, "albedo"),
			);
		}
	}
	if (transformed) {
		json.extensionsUsed = [
			...new Set([...(json.extensionsUsed ?? []), "KHR_texture_transform"]),
		];
	}
}

function rewriteJson(
	glb: ArrayBuffer,
	edit: (json: GltfJson) => void,
): Uint8Array {
	const view = new DataView(glb);
	const jsonLength = view.getUint32(12, true);
	const json = JSON.parse(
		new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)),
	) as GltfJson;
	edit(json);
	const rest = new Uint8Array(glb, 20 + jsonLength);
	let text = JSON.stringify(json);
	while (new TextEncoder().encode(text).length % 4 !== 0) {
		text += " ";
	}
	const encoded = new TextEncoder().encode(text);
	const out = new Uint8Array(20 + encoded.length + rest.length);
	const outView = new DataView(out.buffer);
	outView.setUint32(0, 0x46546c67, true);
	outView.setUint32(4, 2, true);
	outView.setUint32(8, out.length, true);
	outView.setUint32(12, encoded.length, true);
	outView.setUint32(16, 0x4e4f534a, true);
	out.set(encoded, 20);
	out.set(rest, 20 + encoded.length);
	return out;
}

export async function writeGlb(
	root: THREE.Object3D,
	outPath: string,
	textureRoot: string,
	manifest: TextureManifest,
): Promise<GlbReport> {
	const nodes = prepareScene(root);
	root.updateMatrixWorld(true);
	const box = new THREE.Box3().setFromObject(root);
	const round = (vector: THREE.Vector3) =>
		vector.toArray().map((value) => Number(value.toFixed(4)));
	const glb = (await new GLTFExporter().parseAsync(root, {
		binary: true,
		onlyVisible: false,
	})) as ArrayBuffer;
	const bytes = rewriteJson(glb, (json) =>
		linkTextures(json, outPath, textureRoot, manifest),
	);
	await mkdir(path.dirname(outPath), { recursive: true });
	await writeFile(outPath, bytes);
	return {
		outPath,
		byteLength: bytes.byteLength,
		nodes,
		bbox: box.isEmpty()
			? { min: [0, 0, 0], max: [0, 0, 0] }
			: { min: round(box.min), max: round(box.max) },
	};
}
