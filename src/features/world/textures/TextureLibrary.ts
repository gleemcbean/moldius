import { hashString } from "@shared/random";
import * as THREE from "three";
import { CREATURE_TEXTURES } from "./creatureTextures";
import { CURIO_TEXTURES } from "./curioTextures";
import { DECOR_TEXTURES } from "./decorTextures";
import { OBJECT_TEXTURES } from "./objectTextures";
import { OCCULT_TEXTURES } from "./occultTextures";
import { PixelPainter } from "./PixelPainter";
import { createReflections } from "./reflections";
import type { BakedSurface } from "./surface/bakeSurface";
import { pixelNormals, pixelReliefStrength } from "./surface/pixelRelief";
import { FINE_RECIPES, type FineRecipe, fineSize } from "./surface/recipes";
import {
	cachedSurface,
	prepareSurfaces,
	requestSurface,
} from "./surface/SurfaceBaker";
import { SURFACE_TEXTURES, type TextureRecipe } from "./surfaceTextures";

const TEXTURE_RECIPES: Record<string, TextureRecipe> = {
	...SURFACE_TEXTURES,
	...OBJECT_TEXTURES,
	...DECOR_TEXTURES,
	...CREATURE_TEXTURES,
	...CURIO_TEXTURES,
	...OCCULT_TEXTURES,
};

export interface SurfaceQuality {
	detail: number;
	parallax: number;
}

export const DEFAULT_SURFACE_QUALITY: SurfaceQuality = {
	detail: 1,
	parallax: 16,
};

export interface SurfaceMaps {
	map: THREE.Texture;
	normalMap: THREE.Texture | null;
	ormMap: THREE.Texture | null;
	fine: boolean;
	metallic: boolean;
	depth: number;
	parallax: boolean;
}

function wrapTexture(
	texture: THREE.Texture,
	name: string,
	tileX: number,
	tileY: number,
	anisotropy: number,
	fine: boolean,
): THREE.Texture {
	texture.magFilter = fine ? THREE.LinearFilter : THREE.NearestFilter;
	texture.minFilter = fine
		? THREE.LinearMipmapLinearFilter
		: THREE.NearestMipmapLinearFilter;
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.anisotropy = anisotropy;
	texture.repeat.set(1 / tileX, 1 / tileY);
	texture.name = name;
	return texture;
}

function dataTexture(
	data: Uint8Array,
	width: number,
	height: number,
	color: boolean,
): THREE.DataTexture {
	const texture = new THREE.DataTexture(
		data,
		width,
		height,
		THREE.RGBAFormat,
		THREE.UnsignedByteType,
	);
	texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
	texture.generateMipmaps = true;
	texture.needsUpdate = true;
	return texture;
}

function placeholder(
	width: number,
	height: number,
	fill: [number, number, number, number],
): Uint8Array {
	const data = new Uint8Array(width * height * 4);
	for (let index = 0; index < data.length; index += 4) {
		data[index] = fill[0];
		data[index + 1] = fill[1];
		data[index + 2] = fill[2];
		data[index + 3] = fill[3];
	}
	return data;
}

function fill(texture: THREE.Texture, data: Uint8Array): void {
	(texture.image as { data: Uint8Array }).data = data;
	texture.needsUpdate = true;
}

export class TextureLibrary {
	private readonly surfaces = new Map<string, SurfaceMaps>();
	private readonly baking = new Set<Promise<void>>();
	private ambientReflections: THREE.CubeTexture | null = null;
	private disposed = false;

	constructor(
		private readonly anisotropy: number,
		readonly quality: SurfaceQuality = DEFAULT_SURFACE_QUALITY,
	) {}

	get keys(): string[] {
		return [
			...new Set([
				...Object.keys(TEXTURE_RECIPES),
				...Object.keys(FINE_RECIPES),
			]),
		];
	}

	prepare(
		keys: readonly string[] = this.keys,
		progress?: (fraction: number) => void,
	): Promise<void> {
		return prepareSurfaces(keys, this.quality.detail, progress);
	}

	surface(key: string): SurfaceMaps {
		const existing = this.surfaces.get(key);
		if (existing) {
			return existing;
		}
		const fine = FINE_RECIPES[key];
		const created = fine ? this.fineSurface(key, fine) : this.pixelSurface(key);
		this.surfaces.set(key, created);
		return created;
	}

	private fineSurface(key: string, recipe: FineRecipe): SurfaceMaps {
		const detail = this.quality.detail;
		const ready = cachedSurface(key, detail);
		const [width, height] = ready
			? [ready.width, ready.height]
			: fineSize(recipe, detail);
		const [tileX, tileY] = recipe.tile;
		const layer = (data: Uint8Array, suffix: string, color: boolean) =>
			wrapTexture(
				dataTexture(data, width, height, color),
				`${key}${suffix}`,
				tileX,
				tileY,
				this.anisotropy,
				true,
			);
		const surface: SurfaceMaps = {
			map: layer(
				ready?.albedo ?? placeholder(width, height, [128, 120, 110, 255]),
				"",
				true,
			),
			normalMap: layer(
				ready?.normal ?? placeholder(width, height, [128, 128, 255, 255]),
				":normal",
				false,
			),
			ormMap: layer(
				ready?.orm ?? placeholder(width, height, [255, 210, 0, 255]),
				":orm",
				false,
			),
			fine: true,
			metallic: recipe.metallic === true,
			depth: recipe.depth,
			parallax: recipe.parallax,
		};
		if (!ready) {
			const task = requestSurface(key, detail)
				.then((baked: BakedSurface) => {
					if (this.disposed) {
						return;
					}
					fill(surface.map, baked.albedo);
					fill(surface.normalMap as THREE.Texture, baked.normal);
					fill(surface.ormMap as THREE.Texture, baked.orm);
				})
				.finally(() => this.baking.delete(task));
			this.baking.add(task);
		}
		return surface;
	}

	settled(): Promise<void> {
		return Promise.all([...this.baking]).then(() => undefined);
	}

	private pixelSurface(key: string): SurfaceMaps {
		const recipe = TEXTURE_RECIPES[key];
		if (!recipe) {
			throw new Error(`Texture inconnue : ${key}`);
		}
		const [width, height] = recipe.size;
		const painter = new PixelPainter(width, height, hashString(key));
		recipe.draw(painter);
		const map = new THREE.CanvasTexture(painter.commit());
		map.colorSpace = THREE.SRGBColorSpace;
		const [tileX, tileY] = Array.isArray(recipe.tile)
			? recipe.tile
			: [recipe.tile, recipe.tile];
		wrapTexture(map, key, tileX, tileY, this.anisotropy, false);
		const strength = pixelReliefStrength(key);
		const normalMap =
			strength > 0
				? wrapTexture(
						dataTexture(
							pixelNormals(painter.data.data, width, height, strength),
							width,
							height,
							false,
						),
						`${key}:normal`,
						tileX,
						tileY,
						this.anisotropy,
						false,
					)
				: null;
		return {
			map,
			normalMap,
			ormMap: null,
			fine: false,
			metallic: false,
			depth: 0,
			parallax: false,
		};
	}

	reflections(): THREE.CubeTexture | null {
		if (!this.ambientReflections && typeof document !== "undefined") {
			this.ambientReflections = createReflections();
		}
		return this.ambientReflections;
	}

	build(key: string): THREE.Texture {
		return this.surface(key).map;
	}

	get(key: string): THREE.Texture {
		return this.surface(key).map;
	}

	all(): THREE.Texture[] {
		return [...this.surfaces.values()].flatMap((surface) =>
			[surface.map, surface.normalMap, surface.ormMap].filter(
				(texture): texture is THREE.Texture => texture !== null,
			),
		);
	}

	dispose(): void {
		this.disposed = true;
		for (const texture of this.all()) {
			texture.dispose();
		}
		this.ambientReflections?.dispose();
		this.ambientReflections = null;
		this.surfaces.clear();
	}
}
