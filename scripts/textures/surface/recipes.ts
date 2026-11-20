import { hashString, SeededRandom } from "@shared/random";
import { FINE_ARCHITECTURE } from "./architecture";
import { type BakedSurface, bakeField } from "./bakeSurface";
import { FINE_MATERIALS } from "./materials";
import { SurfaceField } from "./SurfaceField";

export interface FineRecipe {
	size: [number, number];
	tile: [number, number];
	depth: number;
	parallax: boolean;
	metallic?: boolean;
	paint: (field: SurfaceField, rng: SeededRandom) => void;
}

export const FINE_RECIPES: Record<string, FineRecipe> = {
	...FINE_ARCHITECTURE,
	...FINE_MATERIALS,
};

export function isFineTexture(key: string): boolean {
	return key in FINE_RECIPES;
}

export function fineSize(recipe: FineRecipe, detail: number): [number, number] {
	return [
		Math.max(16, Math.round(recipe.size[0] * detail)),
		Math.max(16, Math.round(recipe.size[1] * detail)),
	];
}

export function bakeRecipe(key: string, detail: number): BakedSurface {
	const recipe = FINE_RECIPES[key];

	if (!recipe) {
		throw new Error(`Matière inconnue : ${key}`);
	}

	const [width, height] = fineSize(recipe, detail);
	const seed = hashString(key);
	const field = new SurfaceField(width, height, seed);

	recipe.paint(field, new SeededRandom(seed));

	return bakeField(field, recipe.tile[0], recipe.tile[1], recipe.depth);
}
