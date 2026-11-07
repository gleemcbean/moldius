export type FurniturePlacement =
	| "wall"
	| "floor"
	| "surface"
	| "wallDecor"
	| "ceiling"
	| "corner";

export interface FurnitureVariant {
	width: number;
	depth: number;
	height: number;
}

export interface FurnitureLightSpec {
	offsetY: number;
	offsetZ: number;
	color: number;
	intensity: number;
	radius: number;
	kind: "candle" | "chandelier" | "fire" | "lamp" | "cauldron";
}

export interface FurnitureDefinition {
	kind: string;
	label: string;
	placement: FurniturePlacement;
	variants: readonly FurnitureVariant[];
	collides: boolean;
	walkableTop: boolean;
	occludes: boolean;
	hideable: boolean;
	surface: boolean;
	frontClearance: number;
	wallOffset: number;
	mountHeight?: readonly [number, number];
	light?: FurnitureLightSpec;
}

function variants(...entries: [number, number, number][]): FurnitureVariant[] {
	return entries.map(([width, depth, height]) => ({ width, depth, height }));
}

function define(
	kind: string,
	label: string,
	placement: FurniturePlacement,
	entries: FurnitureVariant[],
	options: Partial<
		Omit<FurnitureDefinition, "kind" | "label" | "placement" | "variants">
	> = {},
): FurnitureDefinition {
	return {
		kind,
		label,
		placement,
		variants: entries,
		collides:
			options.collides ?? (placement === "wall" || placement === "floor"),
		walkableTop: options.walkableTop ?? false,
		occludes: options.occludes ?? false,
		hideable: options.hideable ?? false,
		surface: options.surface ?? false,
		frontClearance: options.frontClearance ?? 0.55,
		wallOffset: options.wallOffset ?? 0.02,
		...(options.mountHeight ? { mountHeight: options.mountHeight } : {}),
		...(options.light ? { light: options.light } : {}),
	};
}

const CANDLE_LIGHT: FurnitureLightSpec = {
	offsetY: 0,
	offsetZ: 0,
	color: 0xffa04a,
	intensity: 0.55,
	radius: 4.5,
	kind: "candle",
};

const DEFINITIONS: FurnitureDefinition[] = [
	define(
		"wardrobe",
		"Armoire",
		"wall",
		variants([1.3, 0.7, 2.15], [1.6, 0.72, 2.3], [1.1, 0.66, 2.05]),
		{
			occludes: true,
			hideable: true,
			frontClearance: 1.0,
		},
	),
	define(
		"lockers",
		"Casiers",
		"wall",
		variants([1.5, 0.6, 2.0], [1.05, 0.6, 1.95]),
		{
			occludes: true,
			hideable: true,
			frontClearance: 1.0,
		},
	),
	define("confessional", "Confessionnal", "wall", variants([1.3, 0.95, 2.25]), {
		occludes: true,
		hideable: true,
		frontClearance: 1.0,
	}),
	define(
		"bookcase",
		"Bibliothèque",
		"wall",
		variants(
			[1.2, 0.42, 2.3],
			[1.8, 0.42, 2.5],
			[1.0, 0.4, 2.1],
			[2.2, 0.45, 2.6],
		),
		{
			occludes: true,
		},
	),
	define(
		"shelf",
		"Étagère",
		"wall",
		variants([1.2, 0.38, 1.8], [1.6, 0.38, 1.9], [0.9, 0.35, 1.6]),
		{
			occludes: true,
		},
	),
	define(
		"potionShelf",
		"Étagère de mage",
		"wall",
		variants([1.4, 0.4, 1.9], [1.0, 0.38, 1.7]),
		{
			occludes: true,
		},
	),
	define(
		"cabinet",
		"Buffet",
		"wall",
		variants([1.6, 0.52, 0.95], [2.0, 0.55, 1.0], [1.2, 0.5, 0.9]),
		{
			walkableTop: true,
			surface: true,
		},
	),
	define(
		"dresser",
		"Commode",
		"wall",
		variants([1.1, 0.5, 0.85], [1.4, 0.52, 0.88]),
		{
			walkableTop: true,
			surface: true,
		},
	),
	define(
		"nightstand",
		"Chevet",
		"wall",
		variants([0.5, 0.42, 0.6], [0.55, 0.45, 0.65]),
		{
			walkableTop: true,
			surface: true,
			frontClearance: 0.3,
		},
	),
	define(
		"fileCabinet",
		"Classeur à tiroirs",
		"wall",
		variants([0.6, 0.62, 1.35], [0.9, 0.62, 1.3]),
		{
			surface: true,
		},
	),
	define(
		"chest",
		"Coffre",
		"wall",
		variants([0.95, 0.55, 0.55], [1.2, 0.6, 0.6]),
		{
			walkableTop: true,
		},
	),
	define(
		"trunk",
		"Malle",
		"wall",
		variants([1.2, 0.7, 0.78], [1.05, 0.64, 0.74]),
		{
			hideable: true,
			frontClearance: 0.9,
		},
	),
	define(
		"curtainAlcove",
		"Rideaux",
		"wall",
		variants([1.3, 0.55, 2.4], [1.1, 0.5, 2.3]),
		{
			occludes: true,
			hideable: true,
			frontClearance: 1.0,
		},
	),
	define(
		"cask",
		"Grand tonneau",
		"wall",
		variants([1.35, 1.7, 1.5], [1.2, 1.5, 1.36]),
		{
			occludes: true,
			hideable: true,
			frontClearance: 1.0,
		},
	),
	define(
		"fireplace",
		"Cheminée",
		"wall",
		variants([1.9, 0.6, 1.35], [2.3, 0.7, 1.5]),
		{
			occludes: true,
			surface: false,
			frontClearance: 0.9,
			light: {
				offsetY: 0.45,
				offsetZ: 0.15,
				color: 0xff7a2a,
				intensity: 2.4,
				radius: 7.5,
				kind: "fire",
			},
		},
	),
	define(
		"bed",
		"Lit",
		"wall",
		variants([1.05, 2.05, 0.95], [1.6, 2.15, 1.1], [1.75, 2.25, 2.25]),
		{
			walkableTop: true,
			frontClearance: 0.4,
		},
	),
	define(
		"kitchenCounter",
		"Plan de travail",
		"wall",
		variants([1.8, 0.65, 0.92], [2.4, 0.65, 0.92]),
		{
			walkableTop: true,
			surface: true,
		},
	),
	define("stove", "Cuisinière", "wall", variants([1.3, 0.75, 0.95]), {
		light: {
			offsetY: 0.35,
			offsetZ: 0.3,
			color: 0xff6a20,
			intensity: 1.0,
			radius: 4.5,
			kind: "fire",
		},
	}),
	define(
		"sink",
		"Lavabo",
		"wall",
		variants([0.8, 0.55, 0.9], [0.65, 0.5, 0.88]),
	),
	define("toilet", "Toilette", "wall", variants([0.5, 0.75, 0.85])),
	define("bathtub", "Baignoire", "wall", variants([1.75, 0.82, 0.62])),
	define("uprightPiano", "Piano droit", "wall", variants([1.55, 0.62, 1.3]), {
		occludes: true,
	}),
	define(
		"workbench",
		"Établi",
		"wall",
		variants([2.0, 0.8, 0.92], [1.6, 0.75, 0.9]),
		{
			walkableTop: true,
			surface: true,
		},
	),
	define("toolRack", "Râtelier", "wall", variants([1.4, 0.25, 1.9]), {
		frontClearance: 0.4,
	}),
	define(
		"wineRack",
		"Casier à bouteilles",
		"wall",
		variants([1.6, 0.45, 1.95], [1.2, 0.45, 1.8]),
		{
			occludes: true,
		},
	),
	define(
		"valveStation",
		"Vanne d'eau verte",
		"wall",
		variants([1.4, 0.5, 2.9]),
		{
			frontClearance: 1.4,
		},
	),
	define(
		"grandfatherClock",
		"Horloge comtoise",
		"wall",
		variants([0.55, 0.38, 2.1]),
		{
			occludes: true,
		},
	),
	define(
		"pottingTable",
		"Table de rempotage",
		"wall",
		variants([1.6, 0.7, 0.85]),
		{
			walkableTop: true,
			surface: false,
		},
	),

	define(
		"table",
		"Table",
		"floor",
		variants(
			[1.4, 0.85, 0.78],
			[2.0, 1.0, 0.78],
			[0.9, 0.9, 0.75],
			[3.2, 1.1, 0.78],
		),
		{
			walkableTop: true,
			surface: true,
		},
	),
	define(
		"desk",
		"Bureau",
		"floor",
		variants([1.5, 0.78, 0.78], [1.8, 0.85, 0.8]),
		{
			walkableTop: true,
			surface: true,
		},
	),
	define(
		"chair",
		"Chaise",
		"floor",
		variants([0.48, 0.5, 0.95], [0.5, 0.52, 1.05], [0.46, 0.48, 0.9]),
	),
	define(
		"armchair",
		"Fauteuil",
		"floor",
		variants([0.85, 0.85, 1.05], [0.9, 0.85, 1.15]),
	),
	define(
		"sofa",
		"Canapé",
		"floor",
		variants([2.0, 0.9, 0.95], [1.6, 0.85, 0.9]),
	),
	define(
		"bench",
		"Banc",
		"floor",
		variants([1.5, 0.42, 0.46], [2.0, 0.45, 0.46]),
		{
			walkableTop: true,
		},
	),
	define(
		"pew",
		"Banc d'église",
		"floor",
		variants([2.6, 0.6, 0.95], [2.2, 0.6, 0.95]),
	),
	define(
		"cauldron",
		"Chaudron",
		"floor",
		variants([1.0, 1.0, 0.85], [1.3, 1.3, 0.95]),
		{
			walkableTop: true,
			light: {
				offsetY: 0.05,
				offsetZ: 0,
				color: 0x6dff7a,
				intensity: 0.55,
				radius: 3.5,
				kind: "cauldron",
			},
		},
	),
	define("stakeSanctuary", "Sanctuaire", "floor", variants([1.0, 0.7, 1.05]), {
		frontClearance: 0.7,
		light: {
			offsetY: 0.95,
			offsetZ: 0,
			color: 0x8fe3a4,
			intensity: 0.6,
			radius: 4,
			kind: "candle",
		},
	}),
	define(
		"stakeReliquary",
		"Reliquaire",
		"floor",
		variants([0.95, 0.75, 0.95]),
		{
			frontClearance: 0.7,
			light: {
				offsetY: 0.95,
				offsetZ: 0,
				color: 0xffc857,
				intensity: 0.6,
				radius: 4,
				kind: "candle",
			},
		},
	),
	define("stakePact", "Autel du pacte", "floor", variants([0.95, 0.75, 0.9]), {
		frontClearance: 0.7,
		light: {
			offsetY: 0.9,
			offsetZ: 0,
			color: 0xff4d5e,
			intensity: 0.6,
			radius: 4,
			kind: "candle",
		},
	}),
	define(
		"occultAltar",
		"Autel occulte",
		"floor",
		variants([0.95, 0.7, 0.72], [0.8, 0.6, 0.68]),
		{
			frontClearance: 0.6,
			light: {
				offsetY: 0.5,
				offsetZ: 0,
				color: 0x9ff0e4,
				intensity: 0.55,
				radius: 3.5,
				kind: "candle",
			},
		},
	),
	define(
		"crate",
		"Caisse",
		"floor",
		variants([0.6, 0.6, 0.6], [0.8, 0.8, 0.75], [0.9, 0.6, 0.55]),
		{
			walkableTop: true,
		},
	),
	define(
		"barrel",
		"Tonneau",
		"floor",
		variants([0.7, 0.7, 0.95], [0.6, 0.6, 0.8]),
		{
			walkableTop: true,
		},
	),
	define(
		"pottedPlant",
		"Plante en pot",
		"floor",
		variants(
			[0.6, 0.6, 1.0],
			[0.8, 0.8, 1.8],
			[0.5, 0.5, 0.8],
			[1.0, 1.0, 2.3],
		),
	),
	define(
		"palmTree",
		"Palmier",
		"floor",
		variants([0.9, 0.9, 3.1], [0.8, 0.8, 2.6]),
	),
	define(
		"ivyWall",
		"Lierre",
		"wall",
		variants([1.6, 0.12, 2.2], [2.4, 0.12, 2.6], [1.1, 0.12, 1.7]),
		{ collides: false, mountHeight: [0.5, 0.9] },
	),
	define("railVine", "Plante retombante", "wall", variants([1.6, 0.2, 1.1]), {
		collides: false,
	}),
	define("climbingVine", "Liane", "floor", variants([0.46, 0.46, 3]), {
		collides: false,
	}),
	define(
		"hangingFern",
		"Fougère suspendue",
		"ceiling",
		variants([0.9, 0.9, 1.6]),
		{
			collides: false,
		},
	),
	define(
		"planterBed",
		"Jardinière",
		"floor",
		variants([2.2, 0.9, 0.55], [1.6, 0.9, 0.55]),
	),
	define("floorLamp", "Lampe à pied", "floor", variants([0.45, 0.45, 1.7]), {
		light: {
			offsetY: 0,
			offsetZ: 0,
			color: 0xffb46a,
			intensity: 0.9,
			radius: 5.5,
			kind: "lamp",
		},
	}),
	define(
		"candelabra",
		"Chandelier sur pied",
		"floor",
		variants([0.5, 0.5, 1.45], [0.55, 0.55, 1.6]),
		{
			light: { ...CANDLE_LIGHT, intensity: 0.85, radius: 5.5 },
		},
	),
	define(
		"pillar",
		"Pilier",
		"floor",
		variants([0.6, 0.6, 1], [0.75, 0.75, 1]),
		{ occludes: true },
	),
	define("globe", "Globe", "floor", variants([0.6, 0.6, 1.1])),
	define("harp", "Harpe", "floor", variants([0.7, 1.0, 1.7])),
	define("cello", "Contrebasse", "floor", variants([0.6, 0.5, 1.85])),
	define("musicStand", "Pupitre", "floor", variants([0.5, 0.4, 1.3])),
	define("grandPiano", "Piano à queue", "floor", variants([1.5, 2.0, 1.0]), {
		occludes: false,
	}),
	define(
		"estrade",
		"Estrade",
		"floor",
		variants([2.4, 1.8, 0.3], [3.2, 2.2, 0.3], [2.0, 2.0, 0.22]),
		{
			walkableTop: true,
		},
	),
	define(
		"dais",
		"Gradins",
		"floor",
		variants([5, 4, 0.54], [6, 4.5, 0.72], [4.5, 3.5, 0.36]),
		{
			walkableTop: true,
		},
	),
	define("altar", "Autel", "floor", variants([1.6, 0.8, 1.0]), {
		surface: true,
	}),
	define("lectern", "Lutrin", "floor", variants([0.6, 0.5, 1.25])),
	define(
		"alchemyTable",
		"Table d'alchimie",
		"floor",
		variants([1.8, 0.9, 0.85], [1.4, 0.8, 0.85]),
		{
			walkableTop: true,
			surface: true,
		},
	),
	define("anvil", "Enclume", "floor", variants([0.75, 0.4, 0.8])),
	define("armor", "Armure", "wall", variants([0.75, 0.55, 2.0]), {
		occludes: true,
		frontClearance: 0.6,
		wallOffset: 0.12,
	}),
	define(
		"displayCase",
		"Vitrine",
		"wall",
		variants([1.2, 0.5, 1.95], [0.9, 0.45, 1.8]),
		{
			frontClearance: 0.8,
		},
	),
	define(
		"boneShelf",
		"Ossuaire",
		"wall",
		variants([1.5, 0.45, 2.0], [1.1, 0.45, 1.8]),
		{
			occludes: true,
			frontClearance: 0.7,
		},
	),
	define("telescope", "Télescope", "floor", variants([0.9, 0.9, 1.75])),
	define("orrery", "Planétaire", "floor", variants([0.9, 0.9, 1.25])),
	define("crib", "Berceau", "floor", variants([0.75, 1.15, 0.95])),
	define(
		"rockingHorse",
		"Cheval à bascule",
		"floor",
		variants([0.42, 1.0, 0.8]),
	),
	define(
		"dressForm",
		"Mannequin de couture",
		"floor",
		variants([0.5, 0.42, 1.68]),
	),
	define(
		"sheetedFurniture",
		"Meuble sous drap",
		"floor",
		variants([1.7, 0.9, 1.0], [0.95, 0.9, 1.1], [1.1, 0.65, 1.9]),
	),
	define(
		"dryingLine",
		"Linge étendu",
		"floor",
		variants([2.3, 0.45, 1.95], [1.7, 0.45, 1.9]),
		{
			occludes: true,
			frontClearance: 0.7,
		},
	),
	define("washtub", "Baquet", "floor", variants([0.85, 0.85, 0.55])),
	define(
		"laundryBasket",
		"Panier à linge",
		"floor",
		variants([0.6, 0.45, 0.48]),
		{},
	),
	define(
		"sarcophagus",
		"Sarcophage",
		"floor",
		variants([0.95, 2.15, 0.95], [0.85, 1.95, 0.9]),
		{
			walkableTop: true,
		},
	),
	define("birdcage", "Cage à oiseaux", "floor", variants([0.55, 0.55, 1.75])),
	define(
		"rug",
		"Tapis",
		"floor",
		variants(
			[3.0, 2.0, 0.02],
			[2.4, 1.6, 0.02],
			[2.2, 2.2, 0.02],
			[1.0, 3.6, 0.02],
		),
		{
			collides: false,
		},
	),
	define(
		"ritualCircle",
		"Cercle rituel",
		"floor",
		variants([4.0, 4.0, 0.01], [3.2, 3.2, 0.01]),
		{
			collides: false,
		},
	),
	define("broom", "Balai", "floor", variants([0.35, 0.25, 1.45]), {
		collides: false,
	}),
	define("bucket", "Seau", "floor", variants([0.35, 0.35, 0.35]), {
		collides: false,
	}),
	define(
		"floorBall",
		"Boule",
		"floor",
		variants([0.3, 0.3, 0.3], [0.22, 0.22, 0.22]),
		{
			collides: false,
		},
	),
	define(
		"smallBox",
		"Boîte",
		"floor",
		variants([0.4, 0.3, 0.25], [0.3, 0.3, 0.3], [0.5, 0.35, 0.2]),
		{
			collides: false,
		},
	),
	define(
		"bookPile",
		"Pile de livres",
		"floor",
		variants([0.4, 0.3, 0.45], [0.35, 0.28, 0.3]),
		{},
	),
	define("vialCluster", "Fioles", "floor", variants([0.45, 0.35, 0.3]), {
		collides: false,
	}),
	define("floorCandles", "Bougies au sol", "floor", variants([0.5, 0.5, 0.3]), {
		collides: false,
		light: { ...CANDLE_LIGHT, intensity: 0.5, radius: 3.8 },
	}),

	define(
		"candle",
		"Bougie",
		"surface",
		variants([0.12, 0.12, 0.3], [0.32, 0.12, 0.42]),
		{
			collides: false,
			light: CANDLE_LIGHT,
		},
	),
	define(
		"books",
		"Livres",
		"surface",
		variants([0.35, 0.25, 0.25], [0.5, 0.25, 0.22]),
	),
	define("openBook", "Livre ouvert", "surface", variants([0.42, 0.3, 0.06])),
	define(
		"potions",
		"Potions",
		"surface",
		variants([0.4, 0.25, 0.28], [0.3, 0.2, 0.22]),
	),
	define("jar", "Bocal", "surface", variants([0.18, 0.18, 0.24])),
	define("plateSet", "Couvert", "surface", variants([0.4, 0.3, 0.06])),
	define("skull", "Crâne", "surface", variants([0.2, 0.24, 0.2])),
	define("vase", "Vase fleuri", "surface", variants([0.22, 0.22, 0.5])),
	define("inkwell", "Encrier", "surface", variants([0.2, 0.15, 0.22])),
	define("alembic", "Alambic", "surface", variants([0.45, 0.25, 0.5])),
	define("bellJar", "Cloche de verre", "surface", variants([0.22, 0.22, 0.34])),
	define("doll", "Poupée", "surface", variants([0.2, 0.16, 0.34])),

	define(
		"painting",
		"Tableau",
		"wallDecor",
		variants(
			[0.6, 0.05, 0.8],
			[1.2, 0.05, 0.8],
			[1.4, 0.05, 1.1],
			[0.4, 0.05, 0.5],
		),
		{
			mountHeight: [1.35, 1.75],
		},
	),
	define(
		"mirror",
		"Miroir",
		"wallDecor",
		variants([0.6, 0.05, 1.0], [0.7, 0.05, 0.7], [0.5, 0.05, 1.4]),
		{
			mountHeight: [1.0, 1.5],
		},
	),
	define(
		"window",
		"Fenêtre",
		"wallDecor",
		variants(
			[1.0, 0.1, 1.9],
			[1.1, 0.1, 2.1],
			[1.0, 0.1, 1.0],
			[0.8, 0.1, 0.8],
			[0.7, 0.1, 2.3],
		),
		{
			mountHeight: [0.7, 1.0],
		},
	),
	define(
		"electricMeter",
		"Compteur électrique",
		"wallDecor",
		variants([0.45, 0.16, 0.6]),
		{
			mountHeight: [1.4, 1.6],
		},
	),
	define(
		"pipeRun",
		"Canalisations",
		"wallDecor",
		variants([2.4, 0.25, 0.4], [1.6, 0.3, 0.4], [3.2, 0.22, 0.3]),
		{
			mountHeight: [2.1, 2.45],
		},
	),
	define("sconce", "Applique", "wallDecor", variants([0.25, 0.2, 0.4]), {
		mountHeight: [1.75, 1.95],
		light: {
			...CANDLE_LIGHT,
			intensity: 0.6,
			radius: 4.5,
			offsetY: 0.2,
			offsetZ: 0.12,
		},
	}),
	define(
		"tapestry",
		"Tapisserie",
		"wallDecor",
		variants([1.2, 0.04, 1.8], [0.9, 0.04, 1.5]),
		{
			mountHeight: [0.9, 1.1],
		},
	),
	define(
		"wallShelf",
		"Étagère murale",
		"wallDecor",
		variants([0.9, 0.25, 0.4]),
		{
			mountHeight: [1.55, 1.75],
		},
	),
	define(
		"hangingHerbs",
		"Herbes séchées",
		"wallDecor",
		variants([1.0, 0.2, 0.6]),
		{
			mountHeight: [1.9, 2.1],
		},
	),
	define("trophyHead", "Trophée", "wallDecor", variants([0.7, 0.5, 0.75]), {
		mountHeight: [1.75, 1.95],
	}),
	define(
		"specimenFrame",
		"Planche entomologique",
		"wallDecor",
		variants([0.6, 0.05, 0.45]),
		{
			mountHeight: [1.3, 1.6],
		},
	),
	define(
		"starChart",
		"Carte céleste",
		"wallDecor",
		variants([1.1, 0.03, 0.8], [0.8, 0.03, 1.1]),
		{
			mountHeight: [1.2, 1.4],
		},
	),

	define(
		"billiardTable",
		"Table de billard",
		"floor",
		variants([2.6, 1.45, 0.86], [2.3, 1.3, 0.86]),
		{ frontClearance: 1.0 },
	),
	define("chessTable", "Table d'échecs", "floor", variants([0.8, 0.8, 0.75])),
	define("gramophone", "Gramophone", "floor", variants([0.55, 0.55, 1.15])),
	define(
		"weaponRack",
		"Râtelier d'armes",
		"wall",
		variants([1.4, 0.38, 1.95], [1.0, 0.36, 1.85]),
	),
	define(
		"shieldDisplay",
		"Panoplie",
		"wallDecor",
		variants([1.0, 0.12, 1.0], [0.8, 0.1, 0.8]),
		{ mountHeight: [1.5, 1.8] },
	),
	define(
		"statue",
		"Statue",
		"floor",
		variants([0.9, 0.9, 2.3], [0.8, 0.8, 1.9]),
		{
			occludes: true,
		},
	),
	define(
		"theaterSeats",
		"Rangée de fauteuils",
		"floor",
		variants([2.4, 0.75, 1.0], [1.8, 0.75, 1.0]),
	),
	define(
		"stageCurtain",
		"Rideau de scène",
		"wall",
		variants([3.0, 0.35, 3.6], [2.4, 0.35, 3.2]),
		{ occludes: true, frontClearance: 0.4 },
	),
	define("spinningWheel", "Rouet", "floor", variants([0.9, 0.5, 1.0])),
	define("coatRack", "Portemanteau", "floor", variants([0.55, 0.55, 1.85])),
	define(
		"barrelStack",
		"Pile de tonneaux",
		"wall",
		variants([2.0, 0.95, 1.55], [1.4, 0.95, 1.05]),
		{ occludes: true },
	),
	define(
		"standingCoffin",
		"Cercueil dressé",
		"wall",
		variants([0.8, 0.55, 2.05]),
		{ occludes: true, hideable: true, frontClearance: 1.0 },
	),
	define(
		"chandelier",
		"Lustre",
		"ceiling",
		variants([1.0, 1.0, 0.9], [1.4, 1.4, 1.1]),
		{
			light: {
				offsetY: -0.6,
				offsetZ: 0,
				color: 0xffb25a,
				intensity: 1.6,
				radius: 8,
				kind: "chandelier",
			},
		},
	),
	define(
		"cellBars",
		"Cellule grillagée",
		"wall",
		variants([2.2, 1.4, 2.4], [1.6, 1.2, 2.3]),
		{ frontClearance: 0.8 },
	),
	define(
		"hangingChains",
		"Chaînes pendantes",
		"ceiling",
		variants([0.8, 0.8, 1.2], [0.6, 0.6, 0.9]),
	),
	define(
		"wallLantern",
		"Lanterne murale",
		"wallDecor",
		variants([0.26, 0.3, 0.5]),
		{
			mountHeight: [1.8, 2.0],
			light: {
				...CANDLE_LIGHT,
				color: 0xff9a3c,
				intensity: 0.7,
				radius: 5,
				offsetY: 0.2,
				offsetZ: 0.18,
			},
		},
	),
	define(
		"bloodStain",
		"Tache de sang",
		"floor",
		variants([1.2, 1.0, 0.01], [0.8, 0.6, 0.01], [1.6, 0.9, 0.01]),
		{ collides: false },
	),
	define(
		"pond",
		"Bassin",
		"floor",
		variants([3.6, 2.4, 0.15], [2.8, 2.0, 0.15], [4.2, 2.8, 0.15]),
		{ frontClearance: 0.8 },
	),
	define(
		"flowerPot",
		"Pot de fleurs",
		"floor",
		variants([0.32, 0.32, 0.5], [0.4, 0.4, 0.6], [0.26, 0.26, 0.42]),
	),
	define(
		"umbrellaStand",
		"Porte-parapluies",
		"floor",
		variants([0.32, 0.32, 0.62]),
		{},
	),
	define(
		"stool",
		"Tabouret",
		"floor",
		variants([0.38, 0.38, 0.5], [0.34, 0.34, 0.7]),
	),
	define(
		"sideTable",
		"Guéridon",
		"floor",
		variants([0.6, 0.6, 0.72], [0.5, 0.5, 0.66]),
		{
			surface: true,
		},
	),
	define(
		"screen",
		"Paravent",
		"floor",
		variants([1.5, 0.45, 1.75], [1.2, 0.4, 1.6]),
		{
			occludes: true,
		},
	),
	define(
		"torchere",
		"Torchère",
		"floor",
		variants([0.4, 0.4, 1.65], [0.36, 0.36, 1.35]),
		{
			light: { ...CANDLE_LIGHT, offsetY: -0.02, intensity: 0.55, radius: 4.2 },
		},
	),
	define("harpsichord", "Clavecin", "floor", variants([1.6, 0.85, 0.95]), {
		frontClearance: 0.8,
	}),
	define(
		"chaiseLongue",
		"Méridienne",
		"floor",
		variants([1.8, 0.72, 0.85], [1.5, 0.7, 0.8]),
	),
	define(
		"rockingChair",
		"Fauteuil à bascule",
		"floor",
		variants([0.62, 0.85, 1.1]),
	),
	define(
		"ottoman",
		"Pouf",
		"floor",
		variants([0.55, 0.55, 0.42], [0.7, 0.7, 0.4]),
		{
			walkableTop: true,
		},
	),
	define(
		"timpani",
		"Timbales",
		"floor",
		variants([0.75, 0.75, 0.85], [0.6, 0.6, 0.8]),
	),
	define("easel", "Chevalet", "floor", variants([0.75, 0.6, 1.75])),
	define(
		"bust",
		"Buste sur colonne",
		"floor",
		variants([0.45, 0.45, 1.65], [0.4, 0.4, 1.45]),
	),
	define(
		"urn",
		"Urne",
		"floor",
		variants([0.45, 0.45, 0.9], [0.35, 0.35, 0.65]),
	),
	define("birdbath", "Vasque", "floor", variants([0.65, 0.65, 0.85])),
	define(
		"gardenLantern",
		"Lanterne de pierre",
		"floor",
		variants([0.4, 0.4, 1.3]),
		{
			light: {
				...CANDLE_LIGHT,
				offsetY: -0.32,
				intensity: 0.45,
				radius: 3.8,
				kind: "lamp",
			},
		},
	),
	define(
		"logBasket",
		"Panier à bûches",
		"floor",
		variants([0.55, 0.4, 0.5]),
		{},
	),
	define(
		"grainSacks",
		"Sacs de grain",
		"floor",
		variants([0.9, 0.5, 0.55], [0.6, 0.45, 0.55]),
	),
	define(
		"milkChurns",
		"Bidons de lait",
		"floor",
		variants([0.55, 0.3, 0.62]),
		{},
	),
	define("butterChurn", "Baratte", "floor", variants([0.38, 0.38, 1.0]), {}),
	define("pillory", "Pilori", "floor", variants([1.2, 0.5, 1.6])),
	define("dollhouse", "Maison de poupée", "floor", variants([0.85, 0.5, 0.95])),
	define("wheelchair", "Fauteuil roulant", "floor", variants([0.7, 0.9, 1.0])),
	define(
		"ironingBoard",
		"Planche à repasser",
		"floor",
		variants([1.3, 0.4, 0.85]),
	),

	define(
		"secretary",
		"Secrétaire",
		"wall",
		variants([1.0, 0.55, 2.0], [0.85, 0.5, 1.85]),
		{
			occludes: true,
		},
	),
	define("vanity", "Coiffeuse", "wall", variants([1.1, 0.5, 1.55])),
	define(
		"washstand",
		"Table de toilette",
		"wall",
		variants([0.75, 0.48, 0.82]),
	),
	define(
		"woodpile",
		"Tas de bûches",
		"wall",
		variants([1.4, 0.5, 0.75], [1.0, 0.45, 1.0]),
	),
	define("throne", "Trône", "wall", variants([0.95, 0.8, 1.9])),

	define(
		"spiceRack",
		"Étagère à épices",
		"wallDecor",
		variants([0.8, 0.14, 0.42]),
		{
			mountHeight: [1.4, 1.6],
		},
	),
	define(
		"hangingPots",
		"Casseroles suspendues",
		"wallDecor",
		variants([1.0, 0.2, 0.55], [0.7, 0.2, 0.5]),
		{
			mountHeight: [1.45, 1.65],
		},
	),
	define(
		"wallClock",
		"Horloge murale",
		"wallDecor",
		variants([0.42, 0.08, 0.42], [0.32, 0.08, 0.32]),
		{
			mountHeight: [1.7, 1.95],
		},
	),
	define("antlers", "Bois de cerf", "wallDecor", variants([0.8, 0.25, 0.55]), {
		mountHeight: [1.8, 2.0],
	}),
	define(
		"crucifix",
		"Crucifix",
		"wallDecor",
		variants([0.4, 0.05, 0.65], [0.3, 0.05, 0.48]),
		{
			mountHeight: [1.5, 1.75],
		},
	),
	define(
		"ovalPortrait",
		"Portrait ovale",
		"wallDecor",
		variants([0.5, 0.06, 0.68], [0.4, 0.06, 0.55]),
		{
			mountHeight: [1.35, 1.7],
		},
	),
	define(
		"oldMap",
		"Carte ancienne",
		"wallDecor",
		variants([1.2, 0.06, 0.8], [0.9, 0.06, 0.65]),
		{
			mountHeight: [1.2, 1.45],
		},
	),
	define(
		"keyRack",
		"Tableau à clés",
		"wallDecor",
		variants([0.5, 0.07, 0.32]),
		{
			mountHeight: [1.35, 1.55],
		},
	),
	define("barometer", "Baromètre", "wallDecor", variants([0.24, 0.06, 0.8]), {
		mountHeight: [1.2, 1.4],
	}),

	define(
		"hangingCage",
		"Cage suspendue",
		"ceiling",
		variants([0.6, 0.6, 1.6], [0.5, 0.5, 1.3]),
	),
	define(
		"hangingLantern",
		"Lanterne suspendue",
		"ceiling",
		variants([0.3, 0.3, 1.0]),
		{
			light: {
				...CANDLE_LIGHT,
				offsetY: -0.75,
				intensity: 0.6,
				radius: 4.5,
				kind: "lamp",
			},
		},
	),
	define("meatHooks", "Crochets", "ceiling", variants([1.0, 0.3, 0.8])),

	define("teaSet", "Service à thé", "surface", variants([0.36, 0.3, 0.16])),
	define("hourglass", "Sablier", "surface", variants([0.16, 0.16, 0.26])),
	define(
		"crystalBall",
		"Boule de cristal",
		"surface",
		variants([0.2, 0.2, 0.26]),
	),
	define("mortar", "Mortier", "surface", variants([0.2, 0.2, 0.16])),
	define("scrolls", "Parchemins", "surface", variants([0.4, 0.3, 0.1])),
	define("mantelClock", "Pendulette", "surface", variants([0.28, 0.14, 0.32])),
	define("oilLamp", "Lampe à huile", "surface", variants([0.16, 0.16, 0.28]), {
		light: {
			...CANDLE_LIGHT,
			offsetY: -0.15,
			intensity: 0.45,
			radius: 3.6,
			kind: "lamp",
		},
	}),
	define(
		"stuffedRaven",
		"Corbeau empaillé",
		"surface",
		variants([0.24, 0.3, 0.32]),
	),
	define("leatherTomes", "Grimoires", "surface", variants([0.3, 0.22, 0.3])),
	define(
		"cobweb",
		"Toile d'araignée",
		"corner",
		variants([0.7, 0.7, 0.7], [1.0, 1.0, 0.9], [0.5, 0.5, 1.2]),
	),
];

export const FURNITURE: Record<string, FurnitureDefinition> =
	Object.fromEntries(
		DEFINITIONS.map((definition) => [definition.kind, definition]),
	);

export function furnitureDefinition(kind: string): FurnitureDefinition {
	const definition = FURNITURE[kind];
	if (!definition) {
		throw new Error(`Unknown furniture kind ${kind}`);
	}
	return definition;
}

export const DOMESTIC_KINDS = new Set([
	"rug",
	"bed",
	"wardrobe",
	"sofa",
	"armchair",
	"dresser",
	"nightstand",
	"cabinet",
	"chair",
	"table",
	"desk",
	"bookcase",
	"fireplace",
	"chandelier",
	"grandfatherClock",
	"uprightPiano",
	"grandPiano",
	"bathtub",
	"toilet",
]);

export const LOW_WALKABLE_MAX_HEIGHT = 1.05;
