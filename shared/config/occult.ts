export const MATERIAL_IDS = [
	"amethyst",
	"ruby",
	"jade",
	"mirror",
	"brass",
	"bone",
] as const;

export type MaterialId = (typeof MATERIAL_IDS)[number];

export const MATERIAL_COLORS: Record<MaterialId, number> = {
	amethyst: 0x9b5de5,
	ruby: 0xe0263c,
	jade: 0x2fbf71,
	mirror: 0xbfd8e6,
	brass: 0xd4a437,
	bone: 0xe8e0c8,
};

export const OCCULT_IDS = [
	"pendulum",
	"blackMirror",
	"boneBell",
	"rubySeal",
	"jadeEye",
	"censer",
] as const;

export type OccultId = (typeof OCCULT_IDS)[number];

export type OccultRecipe = Partial<Record<MaterialId, number>>;

export const OCCULT_RECIPES: Record<OccultId, OccultRecipe> = {
	pendulum: { amethyst: 2, brass: 1 },
	blackMirror: { mirror: 2, bone: 1 },
	boneBell: { bone: 2, brass: 1 },
	rubySeal: { ruby: 2, jade: 1 },
	jadeEye: { jade: 2, mirror: 1 },
	censer: { brass: 1, ruby: 1, amethyst: 1 },
};

export const OCCULT_CONSUMED_ON_CAPTURE = true;
export const PICKUP_INTERACT_RANGE = 2.3;
export const PICKUP_RESPAWN_MS = 90_000;
export const PICKUP_PER_ROOM = 0.45;
export const PICKUP_MIN_PER_LEVEL = 3;
export const PICKUP_CONTAINER_KINDS: readonly string[] = [
	"chest",
	"crate",
	"smallBox",
];
export const PICKUP_MAX_SURFACE_HEIGHT = 1;
export const ALTAR_INTERACT_RANGE = 2.7;
export const ALTAR_MAX_PER_LEVEL = 3;
export const ALTAR_ROOMS_PER_ALTAR = 8;
