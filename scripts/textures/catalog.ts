import { hashString } from "@shared/random";
import { CREATURE_TEXTURES } from "./creatureTextures";
import { CURIO_TEXTURES } from "./curioTextures";
import { DECOR_TEXTURES } from "./decorTextures";
import { OBJECT_TEXTURES } from "./objectTextures";
import { OCCULT_TEXTURES } from "./occultTextures";
import { type PixelData, PixelPainter } from "./PixelPainter";
import { altarPage, beamFade } from "./special";
import { SURFACE_TEXTURES, type TextureRecipe } from "./surfaceTextures";

export const PIXEL_RECIPES: Record<string, TextureRecipe> = {
	...SURFACE_TEXTURES,
	...OBJECT_TEXTURES,
	...DECOR_TEXTURES,
	...CREATURE_TEXTURES,
	...CURIO_TEXTURES,
	...OCCULT_TEXTURES,
};

export function paintPixelRecipe(key: string): PixelData {
	const recipe = PIXEL_RECIPES[key];

	if (!recipe) {
		throw new Error(`Texture inconnue : ${key}`);
	}

	const [width, height] = recipe.size;
	const painter = new PixelPainter(width, height, hashString(key));

	recipe.draw(painter);

	return painter.data;
}

export function pixelTile(recipe: TextureRecipe): [number, number] {
	return Array.isArray(recipe.tile) ? recipe.tile : [recipe.tile, recipe.tile];
}

export const SPECIAL_TEXTURES: Record<
	string,
	{ paint: () => PixelData; color: boolean }
> = {
	beamFade: { paint: beamFade, color: false },
	altarPageLeft: { paint: () => altarPage("altar--1", false), color: true },
	altarPageRight: { paint: () => altarPage("altar-1", true), color: true },
};
