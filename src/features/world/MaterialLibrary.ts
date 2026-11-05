import * as THREE from "three";
import type { TextureLibrary } from "./textures/TextureLibrary";

export interface MaterialOptions {
	texture?: string;
	color?: number;
	roughness?: number;
	metalness?: number;
	emissive?: number;
	emissiveIntensity?: number;
	transparent?: boolean;
	opacity?: number;
	side?: THREE.Side;
	alphaTest?: number;
	depthWrite?: boolean;
	unlit?: boolean;
	fixedRepeat?: boolean;
	fog?: boolean;
}

const PIXELS_PER_METER = "20.0";
const PIXEL_SHADE = "0.07";

function pixelate(material: THREE.MeshStandardMaterial): void {
	material.customProgramCacheKey = () => "moldius-pixel-1";
	material.onBeforeCompile = (shader) => {
		shader.vertexShader = shader.vertexShader
			.replace(
				"#include <common>",
				"#include <common>\nvarying vec3 vPixelLocal;\nvarying vec3 vPixelNormal;",
			)
			.replace(
				"#include <begin_vertex>",
				"#include <begin_vertex>\nvPixelLocal = position;\nvPixelNormal = normal;",
			);
		shader.fragmentShader = shader.fragmentShader
			.replace(
				"#include <common>",
				`#include <common>
varying vec3 vPixelLocal;
varying vec3 vPixelNormal;
uniform mat4 modelViewMatrix;
float pixelHash(vec3 point) {
	point = fract(point * 0.1031);
	point += dot(point, point.yzx + 33.33);
	return fract((point.x + point.y) * point.z);
}`,
			)
			.replace(
				"#include <color_fragment>",
				`#include <color_fragment>
vec3 pixelCell = floor((vPixelLocal - normalize(vPixelNormal) * (0.5 / ${PIXELS_PER_METER})) * ${PIXELS_PER_METER});
diffuseColor.rgb *= 1.0 + (pixelHash(pixelCell) - 0.5) * ${PIXEL_SHADE};`,
			)
			.replace(
				"#include <lights_fragment_begin>",
				THREE.ShaderChunk.lights_fragment_begin.replace(
					"vec3 geometryPosition = - vViewPosition;",
					`vec3 geometryPosition = (modelViewMatrix * vec4((pixelCell + 0.5) / ${PIXELS_PER_METER}, 1.0)).xyz;`,
				),
			);
	};
}

export class MaterialLibrary {
	private readonly materials = new Map<string, THREE.Material>();

	constructor(readonly textures: TextureLibrary) {}

	key(options: MaterialOptions): string {
		return JSON.stringify([
			options.texture ?? "",
			options.color ?? 0xffffff,
			options.roughness ?? 0.92,
			options.metalness ?? 0,
			options.emissive ?? 0,
			options.emissiveIntensity ?? 1,
			options.transparent ?? false,
			options.opacity ?? 1,
			options.side ?? THREE.FrontSide,
			options.alphaTest ?? 0,
			options.depthWrite ?? true,
			options.unlit ?? false,
			options.fixedRepeat ?? false,
			options.fog ?? true,
		]);
	}

	get(options: MaterialOptions): THREE.Material {
		const key = this.key(options);
		const existing = this.materials.get(key);
		if (existing) {
			return existing;
		}
		const material = this.create(options);
		material.name = key;
		this.materials.set(key, material);
		return material;
	}

	fresh(options: MaterialOptions): THREE.Material {
		return this.create(options);
	}

	private create(options: MaterialOptions): THREE.Material {
		let map: THREE.Texture | null = null;
		if (options.texture) {
			map = this.textures.get(options.texture);
			if (options.fixedRepeat) {
				map = map.clone();
				map.repeat.set(1, 1);
				map.needsUpdate = true;
			}
		}
		const shared = {
			map,
			color: new THREE.Color(options.color ?? 0xffffff),
			transparent: options.transparent ?? false,
			opacity: options.opacity ?? 1,
			side: options.side ?? THREE.FrontSide,
			alphaTest: options.alphaTest ?? 0,
			depthWrite: options.depthWrite ?? true,
			fog: options.fog ?? true,
		};
		if (options.unlit) {
			return new THREE.MeshBasicMaterial(shared);
		}
		const material = new THREE.MeshStandardMaterial({
			...shared,
			roughness: options.roughness ?? 0.92,
			metalness: options.metalness ?? 0,
			emissive: new THREE.Color(options.emissive ?? 0x000000),
			emissiveIntensity: options.emissiveIntensity ?? 1,
			emissiveMap: options.emissive && map ? map : null,
		});
		pixelate(material);
		return material;
	}

	all(): THREE.Material[] {
		return [...this.materials.values()];
	}

	dispose(): void {
		for (const material of this.materials.values()) {
			material.dispose();
		}
		this.materials.clear();
	}
}
