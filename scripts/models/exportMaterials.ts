import * as THREE from "three";
import type { MaterialOptions } from "../../src/features/world/MaterialLibrary";
import { FINE_RECIPES } from "../textures/surface/recipes";

const SURFACE_FIELDS: (keyof MaterialOptions)[] = [
	"texture",
	"color",
	"roughness",
	"metalness",
	"emissive",
	"emissiveIntensity",
	"transparent",
	"opacity",
	"side",
	"alphaTest",
	"depthWrite",
	"unlit",
	"fixedRepeat",
	"fog",
	"wave",
	"relief",
	"pulse",
];

export function cleanSurface(options: MaterialOptions): MaterialOptions {
	const clean: Record<string, unknown> = {};

	for (const field of SURFACE_FIELDS) {
		if (options[field] !== undefined) {
			clean[field] = options[field];
		}
	}

	return clean as MaterialOptions;
}

export function surfaceKey(options: MaterialOptions): string {
	return JSON.stringify(cleanSurface(options));
}

function readableName(options: MaterialOptions): string {
	const color = (options.color ?? 0xffffff).toString(16).padStart(6, "0");

	return `${options.texture ?? "color"}_${color}`;
}

const cache = new Map<string, THREE.Material>();

function createMaterial(options: MaterialOptions): THREE.Material {
	const shared = {
		color: new THREE.Color(options.color ?? 0xffffff),
		transparent: options.transparent ?? false,
		opacity: options.opacity ?? 1,
		side: options.side ?? THREE.FrontSide,
		alphaTest: options.alphaTest ?? 0,
		depthWrite: options.depthWrite ?? true,
	};

	if (options.unlit) {
		return new THREE.MeshBasicMaterial(shared);
	}

	const fine = options.texture ? FINE_RECIPES[options.texture] : undefined;

	return new THREE.MeshStandardMaterial({
		...shared,
		roughness: fine ? 1 : (options.roughness ?? 0.92),
		metalness: fine?.metallic
			? (options.metalness ?? 1)
			: (options.metalness ?? 0),
		emissive: new THREE.Color(options.emissive ?? 0x000000),
		emissiveIntensity: options.emissiveIntensity ?? 1,
	});
}

export function exportMaterial(options: MaterialOptions): THREE.Material {
	const surface = cleanSurface(options);
	const key = JSON.stringify(surface);
	let material = cache.get(key);

	if (!material) {
		material = createMaterial(surface);
		material.name = readableName(surface);
		material.userData = { surface };

		cache.set(key, material);
	}

	return material;
}

export function describeMaterial(material: THREE.Material): THREE.Material {
	if (material.userData.surface) {
		return material;
	}

	const options: MaterialOptions = {};

	if (
		material instanceof THREE.MeshBasicMaterial ||
		material instanceof THREE.MeshStandardMaterial
	) {
		options.color = material.color.getHex();

		if (material.transparent) {
			options.transparent = true;
			options.opacity = material.opacity;
		}

		if (material.side !== THREE.FrontSide) {
			options.side = material.side;
		}

		if (!material.depthWrite) {
			options.depthWrite = false;
		}

		if (material.alphaTest > 0) {
			options.alphaTest = material.alphaTest;
		}

		if (!material.fog) {
			options.fog = false;
		}
	}

	if (material instanceof THREE.MeshBasicMaterial) {
		options.unlit = true;
	}

	if (material instanceof THREE.MeshStandardMaterial) {
		options.roughness = material.roughness;
		options.metalness = material.metalness;

		if (material.emissive.getHex() !== 0) {
			options.emissive = material.emissive.getHex();
			options.emissiveIntensity = material.emissiveIntensity;
		}
	}

	return exportMaterial(options);
}
