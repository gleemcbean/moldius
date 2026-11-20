import type { MaterialOptions } from "../MaterialLibrary";

export const STONE: MaterialOptions = {
	texture: "stoneSmooth",
	roughness: 0.95,
};

export const MARBLE: MaterialOptions = { texture: "marble", roughness: 0.5 };

export const CARVED_STONES: readonly MaterialOptions[] = [
	MARBLE,
	{ texture: "marbleBlack", roughness: 0.3 },
	{ texture: "marbleRose", roughness: 0.42 },
	{ texture: "marbleGreen", roughness: 0.36 },
	{ texture: "marbleGold", roughness: 0.44 },
	STONE,
	{ texture: "limestone", roughness: 0.98 },
	{ texture: "sandstone", roughness: 1 },
	{ texture: "granite", roughness: 0.7 },
	{ texture: "basalt", roughness: 0.85 },
	{ texture: "slate", roughness: 0.8 },
];

export function carvedForSeed(seed: number): MaterialOptions {
	return CARVED_STONES[Math.abs(seed) % CARVED_STONES.length];
}
