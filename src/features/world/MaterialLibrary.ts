import * as THREE from "three";
import type { SurfaceMaps, TextureLibrary } from "./textures/TextureLibrary";

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
	pulse?: number;
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
	relief?: number;
}

function applyPulse(material: THREE.MeshStandardMaterial, pulse: number): void {
	const previous = material.onBeforeCompile.bind(material);
	const previousKey = material.customProgramCacheKey.bind(material);

	material.customProgramCacheKey = () => `${previousKey()}-pulse`;

	material.onBeforeCompile = (shader, renderer) => {
		previous(shader, renderer);

		shader.uniforms.uDecorTime = decorTime;
		shader.uniforms.uPulse = { value: pulse };

		shader.vertexShader = shader.vertexShader
			.replace(
				"#include <common>",
				"#include <common>\nvarying vec3 vPulseWorld;",
			)
			.replace(
				"#include <begin_vertex>",
				`#include <begin_vertex>
	#ifdef USE_INSTANCING
	vPulseWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
	#else
	vPulseWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
	#endif`,
			);

		shader.fragmentShader = shader.fragmentShader
			.replace(
				"#include <common>",
				"#include <common>\nuniform float uDecorTime;\nuniform float uPulse;\nvarying vec3 vPulseWorld;",
			)
			.replace(
				"#include <emissivemap_fragment>",
				`#include <emissivemap_fragment>
	float pulseWave = 0.5 + 0.5 * sin(uDecorTime * 1.3 + vPulseWorld.x * 0.9 + vPulseWorld.z * 0.7 + vPulseWorld.y * 1.7);
	totalEmissiveRadiance *= 1.0 - uPulse * pulseWave;`,
			);
	};
}

const METAL_SHEEN = 0.9;
const GLOSS_SHEEN = 0.6;
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

const RELIEF_PARS = `
uniform float reliefDepth;
uniform float reliefSteps;
vec2 reliefOffset( vec2 uv ) {
	vec3 eye = - vViewPosition;
	vec3 q0 = dFdx( eye );
	vec3 q1 = dFdy( eye );
	vec2 st0 = dFdx( uv );
	vec2 st1 = dFdy( uv );
	vec3 surfaceNormal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		surfaceNormal *= gl_FrontFacing ? 1.0 : - 1.0;
	#endif
	vec3 q1perp = cross( q1, surfaceNormal );
	vec3 q0perp = cross( surfaceNormal, q0 );
	vec3 tangent = q1perp * st0.x + q0perp * st1.x;
	vec3 bitangent = q1perp * st0.y + q0perp * st1.y;
	float det = dot( q0, q1perp );
	vec3 view = normalize( vViewPosition );
	float facing = dot( view, surfaceNormal );
	if ( abs( det ) < 1e-14 || facing < 0.02 ) {
		return vec2( 0.0 );
	}
	vec2 span = - vec2( dot( tangent, view ), dot( bitangent, view ) ) / ( max( facing, 0.3 ) * det ) * reliefDepth;
	float layers = floor( mix( reliefSteps, max( 4.0, reliefSteps * 0.3 ), facing ) );
	float layerDepth = 1.0 / layers;
	vec2 delta = span * layerDepth;
	vec2 shift = vec2( 0.0 );
	float depth = 0.0;
	float surface = 1.0 - textureGrad( normalMap, uv, st0, st1 ).a;
	for ( int step = 0; step < 64; step ++ ) {
		if ( float( step ) >= layers || depth >= surface ) {
			break;
		}
		shift += delta;
		depth += layerDepth;
		surface = 1.0 - textureGrad( normalMap, uv + shift, st0, st1 ).a;
	}
	vec2 previous = shift - delta;
	float after = surface - depth;
	float before = ( 1.0 - textureGrad( normalMap, uv + previous, st0, st1 ).a ) - depth + layerDepth;
	float blend = after / min( after - before, - 1e-5 );
	return mix( shift, previous, clamp( blend, 0.0, 1.0 ) );
}`;

const RELIEF_CHUNKS: [string, string, string][] = [
	[
		"#include <map_fragment>",
		"vMapUv",
		"vec2 reliefShift = reliefOffset( vNormalMapUv );\n",
	],
	["#include <normal_fragment_maps>", "vNormalMapUv", ""],
	["#include <roughnessmap_fragment>", "vRoughnessMapUv", ""],
	["#include <metalnessmap_fragment>", "vMetalnessMapUv", ""],
	["#include <aomap_fragment>", "vAoMapUv", ""],
	["#include <emissivemap_fragment>", "vEmissiveMapUv", ""],
];

function shiftedChunk(include: string, varying: string): string {
	const name = include.slice("#include <".length, -1);

	return THREE.ShaderChunk[name as keyof typeof THREE.ShaderChunk].replaceAll(
		varying,
		`( ${varying} + reliefShift )`,
	);
}

function addRelief(
	material: THREE.MeshStandardMaterial,
	depth: number,
	steps: number,
): void {
	const previous = material.onBeforeCompile.bind(material);
	const previousKey = material.customProgramCacheKey.bind(material);

	material.customProgramCacheKey = () => `${previousKey()}-relief-1`;

	material.onBeforeCompile = (shader, renderer) => {
		previous(shader, renderer);

		shader.uniforms.reliefDepth = { value: depth };
		shader.uniforms.reliefSteps = { value: steps };

		let fragment = shader.fragmentShader.replace(
			"#include <normalmap_pars_fragment>",
			`#include <normalmap_pars_fragment>${RELIEF_PARS}`,
		);

		for (const [include, varying, prefix] of RELIEF_CHUNKS) {
			fragment = fragment.replace(
				include,
				`${prefix}${shiftedChunk(include, varying)}`,
			);
		}

		shader.fragmentShader = fragment;
	};
}

const SHEEN_ONLY = THREE.ShaderChunk.lights_fragment_maps.replace(
	"iblIrradiance += getIBLIrradiance( geometryNormal );",
	"",
);

function addSheen(material: THREE.MeshStandardMaterial): void {
	const previous = material.onBeforeCompile.bind(material);
	const previousKey = material.customProgramCacheKey.bind(material);

	material.customProgramCacheKey = () => `${previousKey()}-sheen-1`;

	material.onBeforeCompile = (shader, renderer) => {
		previous(shader, renderer);

		shader.fragmentShader = shader.fragmentShader.replace(
			"#include <lights_fragment_maps>",
			SHEEN_ONLY,
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
			options.relief ?? 1,
			options.pulse ?? 0,
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
		const surface: SurfaceMaps | null = options.texture
			? this.textures.surface(options.texture, options.fixedRepeat)
			: null;

		const map = surface?.map ?? null;

		const shared = {
			map,
			color: new THREE.Color(options.color ?? 0xffffff),
			transparent: options.transparent ?? false,
			opacity: options.opacity ?? 1,
			side: options.side ?? THREE.FrontSide,
			alphaTest: options.alphaTest ?? 0,
			depthWrite: options.depthWrite ?? true,
			fog: options.fog ?? true,
			forceSinglePass: true,
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

		const relief = options.relief ?? 1;

		if (surface?.normalMap && relief > 0) {
			material.normalMap = surface.normalMap;

			material.normalScale.set(relief, relief);
		}

		if (surface?.fine) {
			material.roughness = 1;
			material.roughnessMap = surface.ormMap;
			material.aoMap = surface.ormMap;

			if (surface.metallic) {
				material.metalnessMap = surface.ormMap;
				material.metalness = options.metalness ?? 1;
			}

			const steps = this.textures.quality.parallax;

			if (surface.parallax && steps > 0 && relief > 0 && !options.transparent) {
				addRelief(material, surface.depth * relief, steps);
			}

			const reflections = this.textures.reflections();

			if (reflections) {
				material.envMap = reflections;
				material.envMapIntensity = surface.metallic ? METAL_SHEEN : GLOSS_SHEEN;

				addSheen(material);
			}
		} else {
			pixelate(material);
		}

		if (options.wave) {
			applyWave(material, options.wave);
		}

		if (options.pulse && options.emissive) {
			applyPulse(material, options.pulse);
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
