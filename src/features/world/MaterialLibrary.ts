import * as THREE from "three";
import type { TextureLibrary } from "./textures/TextureLibrary";

export type MaterialWave = "flame" | "fire" | "foliage" | "cloth";

export const decorTime = { value: 0 };

const WAVE_SHADERS: Record<MaterialWave, string> = {
	flame: `
	float waveH = clamp(uv.y, 0.0, 1.0);
	float wavePhase = position.x * 5.3 + position.z * 7.1;
	transformed.x += sin(uDecorTime * 9.0 + wavePhase) * 0.012 * waveH;
	transformed.z += cos(uDecorTime * 7.0 + wavePhase) * 0.012 * waveH;
	transformed.y += sin(uDecorTime * 13.0 + wavePhase) * 0.012 * waveH;`,
	fire: `
	float waveH = clamp(uv.y, 0.0, 1.0);
	float wavePhase = position.x * 4.1 + position.z * 3.3;
	float waveA = sin(uDecorTime * 6.5 + wavePhase + waveH * 5.0);
	float waveB = sin(uDecorTime * 14.0 + wavePhase * 1.7 - waveH * 7.0);
	transformed.x += (waveA * 0.075 + waveB * 0.03) * waveH;
	transformed.z += (waveB * 0.05) * waveH;
	transformed.y += (sin(uDecorTime * 9.0 + wavePhase * 2.3) * 0.5 + 0.2) * 0.14 * waveH;`,
	foliage: `
	float waveH = clamp(uv.y, 0.0, 1.0);
	float wavePhase = position.x * 1.4 + position.z * 1.9 + position.y * 0.7;
	float waveSway = sin(uDecorTime * 1.3 + wavePhase) + sin(uDecorTime * 3.1 + wavePhase * 2.0) * 0.3;
	transformed.x += waveSway * 0.03 * waveH;
	transformed.z += cos(uDecorTime * 1.05 + wavePhase) * 0.024 * waveH;`,
	cloth: `
	float waveCloth = sin(uDecorTime * 1.1 + position.x * 1.6 + position.z * 1.6 + position.y * 1.2);
	transformed += normal * waveCloth * 0.016;`,
};

function applyWave(material: THREE.Material, wave: MaterialWave): void {
	const previous = material.onBeforeCompile.bind(material);
	const previousKey = material.customProgramCacheKey.bind(material);
	material.customProgramCacheKey = () => `${previousKey()}-wave-${wave}`;
	material.onBeforeCompile = (shader, renderer) => {
		previous(shader, renderer);
		shader.uniforms.uDecorTime = decorTime;
		shader.vertexShader = shader.vertexShader
			.replace(
				"#include <common>",
				"#include <common>\nuniform float uDecorTime;",
			)
			.replace(
				"#include <begin_vertex>",
				`#include <begin_vertex>${WAVE_SHADERS[wave]}`,
			);
	};
}

export interface MaterialOptions {
	wave?: MaterialWave;
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

const PIXELS_PER_METER = "28.0";
const PIXEL_SHADE = "0.04";

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
			options.wave ?? "",
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
			const basic = new THREE.MeshBasicMaterial(shared);
			if (options.wave) {
				applyWave(basic, options.wave);
			}
			return basic;
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
		if (options.wave) {
			applyWave(material, options.wave);
		}
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
