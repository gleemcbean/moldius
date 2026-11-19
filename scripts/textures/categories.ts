export type TextureCategory =
	| "architecture"
	| "materials"
	| "fabrics"
	| "decor"
	| "plants"
	| "creatures"
	| "caps"
	| "occult"
	| "effects";

const GROUPS: Record<Exclude<TextureCategory, "caps">, readonly string[]> = {
	architecture: [
		"oakPlanks",
		"darkPlanks",
		"parquet",
		"stoneFlags",
		"cobble",
		"checkerTiles",
		"tiles",
		"mosaic",
		"greenhouseTiles",
		"stoneBlocks",
		"vaultStone",
		"rubbleStone",
		"brick",
		"mossyBrick",
		"greenhouseBrick",
		"plaster",
		"ceilingPlaster",
		"woodPanels",
		"wainscot",
		"coffer",
		"redCarpet",
		"wallpaperGreen",
		"wallpaperRed",
		"wallpaperBlue",
		"wallpaperOchre",
		"wallpaperPurple",
		"wallpaperFloral",
		"wallpaperTrellis",
		"wallpaperStripes",
		"wallpaperFleur",
		"wallpaperNursery",
		"wallpaperStars",
		"skyNight",
		"windowNight",
	],
	materials: [
		"woodDark",
		"woodMedium",
		"woodLight",
		"woodRed",
		"woodPainted",
		"bark",
		"iron",
		"brass",
		"copper",
		"pipeMetal",
		"stoneSmooth",
		"marble",
		"marbleBlack",
		"marbleRose",
		"marbleGreen",
		"marbleGold",
		"limestone",
		"granite",
		"basalt",
		"sandstone",
		"slate",
		"terracotta",
		"ceramic",
		"leather",
		"wax",
		"soil",
		"pageEdges",
	],
	fabrics: [
		"velvetRed",
		"velvetGreen",
		"velvetBlue",
		"velvetPurple",
		"linen",
		"burlap",
		"tapestry",
		"clothPale",
		"sheetCloth",
		"sheetHanging",
		"rugPersian",
		"rugBlue",
		"rugGreen",
		"rugRound",
		"rugRunner",
	],
	decor: [
		"books",
		"paper",
		"mirror",
		"cobweb",
		"paintingLandscape",
		"paintingPortrait",
		"paintingMushroom",
		"paintingStillLife",
		"paintingStorm",
		"paintingAbstract",
		"curiosityShelves",
		"ossuary",
		"starChart",
		"specimens",
		"wicker",
		"horsePaint",
		"dollFace",
		"sarcophagusLid",
		"cageBars",
		"spindles",
		"armorPlate",
		"bone",
		"fur",
		"eyeball",
		"stem",
	],
	plants: [
		"leafBlade",
		"palmFrond",
		"leafSprig",
		"foliage",
		"foliageDark",
		"foliageWarm",
		"mossDrape",
	],
	creatures: [
		"mushroomSkin",
		"mushroomStem",
		"gills",
		"tanLeather",
		"iris",
		"curtainPale",
		"paperPages",
	],
	occult: [
		"ritualCircle",
		"archivistCircle",
		"occultCircle",
		"occultPentacle",
		"occultIris",
		"altarPageLeft",
		"altarPageRight",
	],
	effects: [
		"flame",
		"flameNeutral",
		"slime",
		"bloodStain",
		"bloodSmear",
		"pondWater",
		"beamFade",
	],
};

const CATEGORIES = new Map<string, TextureCategory>(
	Object.entries(GROUPS).flatMap(([category, keys]) =>
		keys.map((key): [string, TextureCategory] => [
			key,
			category as TextureCategory,
		]),
	),
);

export function textureCategory(key: string): TextureCategory {
	if (key.startsWith("cap-")) {
		return "caps";
	}
	const category = CATEGORIES.get(key);
	if (!category) {
		throw new Error(`Texture sans catégorie : ${key}`);
	}
	return category;
}
