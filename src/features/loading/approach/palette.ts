import type { MaterialOptions } from "../../world/MaterialLibrary";

export const STONE: MaterialOptions = {
	texture: "stoneBlocks",
	color: 0xa9a4c8,
};

export const TRIM: MaterialOptions = {
	texture: "stoneSmooth",
	color: 0x9a94bc,
};

export const ROOF: MaterialOptions = { texture: "slate", color: 0x645c8c };

export const DOOR_WOOD: MaterialOptions = {
	texture: "darkPlanks",
	color: 0x8a6a7a,
};

export const PATH: MaterialOptions = { texture: "cobble", color: 0xa6a2b4 };
export const LAWN: MaterialOptions = { texture: "soil", color: 0x5a6458 };
export const IRON: MaterialOptions = { texture: "iron", color: 0x2e2c3a };
export const BARK: MaterialOptions = { texture: "bark", color: 0x5e5468 };
export const GRAVE: MaterialOptions = { texture: "granite", color: 0xaaa8c0 };
export const MENHIR: MaterialOptions = { texture: "basalt", color: 0x8a86a0 };

export const MUSHROOM_STEM: MaterialOptions = {
	texture: "mushroomStem",
	color: 0xd8d2e0,
};

export const WARM_GLASS: MaterialOptions = { color: 0xffb25a, unlit: true };
export const VIOLET_GLASS: MaterialOptions = { color: 0xc08aff, unlit: true };
export const TEAL_GLASS: MaterialOptions = { color: 0x7affe0, unlit: true };
export const DARK_GLASS: MaterialOptions = { color: 0x120f22, roughness: 0.3 };
export const MULLION: MaterialOptions = { color: 0x1c1a26, roughness: 0.7 };
export const DOOR_GLOW: MaterialOptions = { color: 0xd9a6ff, unlit: true };
export const RUNE_GLOW: MaterialOptions = { color: 0xc89aff, unlit: true };
export const ORB_GLOW: MaterialOptions = { color: 0xe6d0ff, unlit: true };

export const GLOWING_CAPS: readonly MaterialOptions[] = [
	{
		texture: "mushroomSkin",
		color: 0x58e8c8,
		emissive: 0x22c8a0,
		emissiveIntensity: 1.1,
	},
	{
		texture: "mushroomSkin",
		color: 0xb48aff,
		emissive: 0x7a40e0,
		emissiveIntensity: 1.1,
	},
];

export const FLOATING_STONE: MaterialOptions = {
	texture: "stoneBlocks",
	color: 0xb0a6dc,
	emissive: 0x6a32c0,
	emissiveIntensity: 0.55,
};

export const CRYSTAL: MaterialOptions = {
	color: 0xc4a0ff,
	emissive: 0x8a4aff,
	emissiveIntensity: 1.3,
	roughness: 0.15,
	metalness: 0.1,
};

export const LIT_WINDOWS: readonly MaterialOptions[] = [
	VIOLET_GLASS,
	TEAL_GLASS,
	WARM_GLASS,
	VIOLET_GLASS,
];

export const SCENE_SURFACES = [
	STONE,
	TRIM,
	ROOF,
	DOOR_WOOD,
	PATH,
	LAWN,
	IRON,
	BARK,
	GRAVE,
	MENHIR,
	MUSHROOM_STEM,
	...GLOWING_CAPS,
].flatMap(({ texture }) => (texture ? [texture] : []));
