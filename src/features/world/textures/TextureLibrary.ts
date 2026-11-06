import { hashString } from "@shared/random";
import * as THREE from "three";
import { CREATURE_TEXTURES } from "./creatureTextures";
import { CURIO_TEXTURES } from "./curioTextures";
import { DECOR_TEXTURES } from "./decorTextures";
import { OBJECT_TEXTURES } from "./objectTextures";
import { OCCULT_TEXTURES } from "./occultTextures";
import { PixelPainter } from "./PixelPainter";
import { SURFACE_TEXTURES, type TextureRecipe } from "./surfaceTextures";

export const TEXTURE_RECIPES: Record<string, TextureRecipe> = {
	...SURFACE_TEXTURES,
	...OBJECT_TEXTURES,
	...DECOR_TEXTURES,
	...CREATURE_TEXTURES,
	...CURIO_TEXTURES,
	...OCCULT_TEXTURES,
};

export type TextureKey = keyof typeof TEXTURE_RECIPES & string;

export class TextureLibrary {
	private readonly textures = new Map<string, THREE.Texture>();

	constructor(private readonly anisotropy: number) {}

	get keys(): string[] {
		return Object.keys(TEXTURE_RECIPES);
	}

	build(key: string): THREE.Texture {
		const existing = this.textures.get(key);
		if (existing) {
			return existing;
		}
		const recipe = TEXTURE_RECIPES[key];
		if (!recipe) {
			throw new Error(`Texture inconnue : ${key}`);
		}
		const painter = new PixelPainter(
			recipe.size[0],
			recipe.size[1],
			hashString(key),
		);
		recipe.draw(painter);
		const texture = new THREE.CanvasTexture(painter.commit());
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.magFilter = THREE.NearestFilter;
		texture.minFilter = THREE.NearestMipmapLinearFilter;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.anisotropy = this.anisotropy;
		const [tileX, tileY] = Array.isArray(recipe.tile)
			? recipe.tile
			: [recipe.tile, recipe.tile];
		texture.repeat.set(1 / tileX, 1 / tileY);
		texture.name = key;
		this.textures.set(key, texture);
		return texture;
	}

	get(key: string): THREE.Texture {
		return this.build(key);
	}

	all(): THREE.Texture[] {
		return [...this.textures.values()];
	}

	dispose(): void {
		for (const texture of this.textures.values()) {
			texture.dispose();
		}
		this.textures.clear();
	}
}
