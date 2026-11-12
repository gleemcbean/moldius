export const BREW_EFFECTS = [
	"nausea",
	"feather",
	"haste",
	"sluggish",
	"vigor",
] as const;

export type BrewEffect = (typeof BREW_EFFECTS)[number];

export function isBrewEffect(value: unknown): value is BrewEffect {
	return (
		typeof value === "string" &&
		(BREW_EFFECTS as readonly string[]).includes(value)
	);
}

export const BREW_DURATION_MS: Record<BrewEffect, number> = {
	nausea: 15_000,
	feather: 20_000,
	haste: 20_000,
	sluggish: 12_000,
	vigor: 20_000,
};

export const BREW_SPEED_FACTOR: Record<BrewEffect, number> = {
	nausea: 1,
	feather: 1,
	haste: 1.35,
	sluggish: 0.6,
	vigor: 1,
};

export const BREW_GRAVITY_FACTOR: Record<BrewEffect, number> = {
	nausea: 1,
	feather: 0.5,
	haste: 1,
	sluggish: 1,
	vigor: 1,
};

export interface CauldronBrew {
	liquid: number;
	glow: number;
	bubble: number;
	light: number;
	effect: BrewEffect;
}

export const CAULDRON_BREWS: readonly CauldronBrew[] = [
	{
		liquid: 0x2a7a2a,
		glow: 0x3aff5a,
		bubble: 0x4aaa3a,
		light: 0x6dff7a,
		effect: "nausea",
	},
	{
		liquid: 0x4a2a7a,
		glow: 0x9a5aff,
		bubble: 0x7a4ac0,
		light: 0xb08cff,
		effect: "feather",
	},
	{
		liquid: 0x6a1414,
		glow: 0xff3a2a,
		bubble: 0x9a2a22,
		light: 0xff6a5a,
		effect: "vigor",
	},
	{
		liquid: 0x1a4a7a,
		glow: 0x3aa8ff,
		bubble: 0x3a7ac0,
		light: 0x7ac8ff,
		effect: "haste",
	},
	{
		liquid: 0x7a4a14,
		glow: 0xffa03a,
		bubble: 0xc07a2a,
		light: 0xffb468,
		effect: "sluggish",
	},
	{
		liquid: 0x6a7a14,
		glow: 0xd8ff3a,
		bubble: 0x9ab02a,
		light: 0xd8f06a,
		effect: "nausea",
	},
	{
		liquid: 0x7a2a60,
		glow: 0xff4fd8,
		bubble: 0xc04aa0,
		light: 0xff8ce6,
		effect: "feather",
	},
];

export function cauldronBrew(seed: number): CauldronBrew {
	return CAULDRON_BREWS[Math.abs(Math.floor(seed)) % CAULDRON_BREWS.length];
}
