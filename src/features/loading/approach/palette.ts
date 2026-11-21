import * as THREE from "three";
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
export const BARK: MaterialOptions = { texture: "bark", color: 0x6e6478 };
export const DEADWOOD: MaterialOptions = { texture: "bark", color: 0xa49eb4 };

export const HEARTWOOD: MaterialOptions = {
	texture: "woodLight",
	color: 0x9c8c80,
};

export const MOSS: MaterialOptions = { texture: "soil", color: 0x52703e };
export const EARTH: MaterialOptions = { texture: "soil", color: 0x5e5048 };
export const LICHEN: MaterialOptions = { color: 0x8a987e, roughness: 1 };
export const GRAVE: MaterialOptions = { texture: "granite", color: 0xaaa8c0 };
export const BASALT: MaterialOptions = { texture: "basalt", color: 0x8a86a0 };

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

export const EARTHY_CAPS: readonly MaterialOptions[] = [
	{ texture: "mushroomSkin", color: 0xc8924a },
	{ texture: "mushroomSkin", color: 0x8a5a36 },
	{ texture: "mushroomSkin", color: 0xe2d6c0 },
];

export const AMADOU_CAP: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0x6e6462,
};

export const AMADOU_RIM: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0xd8c8a6,
};

export const LACQUER_CAP: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0x7a3222,
	roughness: 0.45,
};

export const SULPHUR_CAP: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0xe8822a,
};

export const SULPHUR_RIM: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0xf6c63c,
};

export const TURKEY_TAIL_CAP: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0x4e4a62,
};

export const PALE_RIM: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0xf0e8d6,
};

export const PORES: MaterialOptions = {
	texture: "mushroomStem",
	color: 0xe2d8c2,
};

export const SULPHUR_PORES: MaterialOptions = {
	texture: "mushroomStem",
	color: 0xf2d860,
};

export const GLOWING_SHELF: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0x7ae0c0,
	emissive: 0x1f9878,
	emissiveIntensity: 0.4,
};

export const GLOWING_RIM: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0xc8fff0,
	emissive: 0x3ad8a8,
	emissiveIntensity: 0.6,
};

export const GLOWING_PORES: MaterialOptions = {
	texture: "mushroomStem",
	color: 0xd8fff0,
	emissive: 0x2ad8a8,
	emissiveIntensity: 0.55,
};

export const GIANT_STEM: MaterialOptions = {
	texture: "mushroomStem",
	color: 0xe0d4bc,
};

export const GIANT_SKIRT: MaterialOptions = {
	texture: "mushroomStem",
	color: 0xece0ca,
	side: THREE.DoubleSide,
};

export const GILLS: MaterialOptions = { texture: "gills", color: 0xe8dcc2 };

export const GILL_BLADES: MaterialOptions = {
	color: 0xdccdb2,
	roughness: 1,
	side: THREE.DoubleSide,
};

export const TEAL_GILLS: MaterialOptions = {
	texture: "gills",
	color: 0xc0ffe8,
	emissive: 0x2ad8a8,
	emissiveIntensity: 0.42,
};

export const TEAL_BLADES: MaterialOptions = {
	color: 0xb8ffe4,
	emissive: 0x24c898,
	emissiveIntensity: 0.4,
	side: THREE.DoubleSide,
};

export const VIOLET_GILLS: MaterialOptions = {
	texture: "gills",
	color: 0xe2ccff,
	emissive: 0x8a4ae8,
	emissiveIntensity: 0.45,
};

export const VIOLET_BLADES: MaterialOptions = {
	color: 0xd8c0ff,
	emissive: 0x7a3ad8,
	emissiveIntensity: 0.42,
	side: THREE.DoubleSide,
};

export const BLUE_CAP: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0x3e52b0,
};

export const BLUE_BLOTCH: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0x1a1f52,
};

export const MAROON_CAP: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0x7e2e58,
};

export const LILAC_SPOT: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0xd2a8d0,
};

export const OCHRE_CAP: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0xa8703a,
};

export const CREAM_WART: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0xf0e2c8,
};

export const TEAL_CAP: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0x2c6c5c,
};

export const VIOLET_CAP: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0x4c2c78,
};

export const CHANTERELLE: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0xf0a63a,
};

export const MOREL_CAP: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0x5a4232,
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
	HEARTWOOD,
	GRAVE,
	BASALT,
	MUSHROOM_STEM,
	AMADOU_CAP,
	GILLS,
].flatMap(({ texture }) => (texture ? [texture] : []));
