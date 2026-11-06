import { LEVEL_HEIGHT, SLAB_THICKNESS } from "../config/index.js";
import type { SeededRandom } from "../random.js";
import {
	type CornerTreatment,
	corridorPathVertices,
	lShapeVertices,
	outlineFromVertices,
	rectangleVertices,
	SQUARE,
} from "./shapes.js";
import type {
	CeilingStyle,
	FloorStyle,
	Level,
	OutlineEdge,
	RoomStyle,
	RoomType,
	WallStyle,
} from "./types.js";

export type ShapeFamily =
	| "rect"
	| "lshape"
	| "octagon"
	| "heptagon"
	| "apse"
	| "corridor"
	| "corridorL"
	| "corridorBend"
	| "corridor45";

export interface CeilingVariant {
	chance: number;
	height: readonly [number, number];
}

export interface RoomTypeDefinition {
	type: RoomType;
	names: readonly string[];
	width: readonly [number, number];
	depth: readonly [number, number];
	heightGround: readonly [number, number];
	heightUpper: readonly [number, number];
	tall?: CeilingVariant;
	low?: CeilingVariant;
	shapes: readonly (readonly [ShapeFamily, number])[];
	floors: readonly FloorStyle[];
	walls: readonly WallStyle[];
	ceilings: readonly CeilingStyle[];
	wainscotChance: number;
	singleDoor: boolean;
	allowUpper: boolean;
	allowGround: boolean;
	optional: boolean;
}

export const ROOM_TYPES: Record<RoomType, RoomTypeDefinition> = {
	hall: {
		type: "hall",
		names: ["Grand hall", "Vestibule", "Hall des échos", "Rotonde"],
		width: [8, 12],
		depth: [7, 10.5],
		heightGround: [3.6, 4.0],
		heightUpper: [3.0, 3.4],
		tall: { chance: 0.3, height: [5.3, 6.0] },
		shapes: [
			["rect", 2],
			["octagon", 2],
			["heptagon", 1],
			["lshape", 1.2],
		],
		floors: ["stoneFlags", "checkerTiles", "parquet"],
		walls: [
			"wallpaperGreen",
			"wallpaperRed",
			"woodPanels",
			"stoneBlocks",
			"wallpaperFleur",
			"wallpaperTrellis",
		],
		ceilings: ["coffered", "beams", "vault"],
		wainscotChance: 0.6,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: false,
	},
	salon: {
		type: "salon",
		names: ["Salon", "Petit salon", "Fumoir", "Boudoir"],
		width: [5.5, 8.5],
		depth: [5, 7.5],
		heightGround: [3.1, 3.7],
		heightUpper: [2.8, 3.2],
		shapes: [
			["rect", 2],
			["heptagon", 0.8],
			["lshape", 0.8],
		],
		floors: ["parquet", "oakPlanks", "redCarpet"],
		walls: [
			"wallpaperRed",
			"wallpaperBlue",
			"wallpaperOchre",
			"wallpaperPurple",
			"wallpaperFloral",
			"wallpaperStripes",
		],
		ceilings: ["plaster", "coffered"],
		wainscotChance: 0.7,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: false,
	},
	gallery: {
		type: "gallery",
		names: ["Galerie des portraits", "Galerie", "Galerie des ancêtres"],
		width: [4, 5],
		depth: [9, 13],
		heightGround: [3.3, 3.8],
		heightUpper: [2.9, 3.3],
		shapes: [
			["rect", 2],
			["heptagon", 1],
			["octagon", 1],
		],
		floors: ["parquet", "redCarpet", "darkPlanks"],
		walls: [
			"wallpaperRed",
			"wallpaperGreen",
			"woodPanels",
			"wallpaperFleur",
			"wallpaperStripes",
		],
		ceilings: ["coffered", "vault"],
		wainscotChance: 0.8,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: false,
	},
	corridor: {
		type: "corridor",
		names: ["Couloir", "Passage", "Corridor", "Couloir étroit"],
		width: [1.8, 2.5],
		depth: [5, 12],
		heightGround: [2.8, 3.3],
		heightUpper: [2.6, 3.0],
		low: { chance: 0.22, height: [2.4, 2.55] },
		shapes: [
			["corridor", 3],
			["corridorL", 1.4],
			["corridorBend", 1.2],
			["corridor45", 1.2],
		],
		floors: ["oakPlanks", "darkPlanks", "stoneFlags", "redCarpet"],
		walls: [
			"wallpaperGreen",
			"wallpaperRed",
			"plaster",
			"woodPanels",
			"wallpaperOchre",
			"wallpaperTrellis",
			"wallpaperFloral",
		],
		ceilings: ["plaster", "beams", "planks"],
		wainscotChance: 0.5,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: false,
	},
	library: {
		type: "library",
		names: ["Bibliothèque", "Bibliothèque interdite"],
		width: [7, 10.5],
		depth: [6.5, 9.5],
		heightGround: [3.5, 4.0],
		heightUpper: [3.0, 3.4],
		tall: { chance: 0.3, height: [5.2, 5.9] },
		shapes: [
			["rect", 1.5],
			["octagon", 1.5],
			["heptagon", 1],
			["lshape", 1],
		],
		floors: ["parquet", "darkPlanks"],
		walls: ["woodPanels", "wallpaperGreen", "wallpaperTrellis"],
		ceilings: ["coffered", "beams"],
		wainscotChance: 0.9,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	cellar: {
		type: "cellar",
		names: ["Cave", "Cave à vin", "Cellier"],
		width: [5.5, 8.5],
		depth: [5, 8],
		heightGround: [2.9, 3.4],
		heightUpper: [2.7, 3.0],
		shapes: [
			["rect", 2],
			["lshape", 1],
			["heptagon", 0.6],
		],
		floors: ["stoneFlags", "cobble"],
		walls: ["stoneBlocks", "brick", "rubbleStone", "mossyBrick"],
		ceilings: ["vault"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	kitchen: {
		type: "kitchen",
		names: ["Cuisine", "Office", "Grande cuisine"],
		width: [5.5, 8],
		depth: [5, 7],
		heightGround: [3.0, 3.6],
		heightUpper: [2.8, 3.1],
		shapes: [
			["rect", 2],
			["lshape", 1],
		],
		floors: ["checkerTiles", "stoneFlags"],
		walls: ["tiles", "brick", "plaster", "wallpaperTrellis"],
		ceilings: ["beams", "planks"],
		wainscotChance: 0.2,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	toilets: {
		type: "toilets",
		names: ["Toilettes", "Cabinet d'aisance"],
		width: [1.75, 2.25],
		depth: [2.0, 2.5],
		heightGround: [2.7, 3.0],
		heightUpper: [2.6, 2.9],
		low: { chance: 0.25, height: [2.4, 2.5] },
		shapes: [["rect", 1]],
		floors: ["checkerTiles", "mosaic"],
		walls: ["tiles", "plaster"],
		ceilings: ["plaster"],
		wainscotChance: 0,
		singleDoor: true,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	bedroom: {
		type: "bedroom",
		names: ["Chambre", "Chambre d'amis", "Chambre du mage", "Chambre bleue"],
		width: [4.5, 7],
		depth: [4.5, 6.5],
		heightGround: [3.0, 3.5],
		heightUpper: [2.7, 3.2],
		shapes: [
			["rect", 2.5],
			["heptagon", 0.6],
			["lshape", 0.8],
		],
		floors: ["oakPlanks", "parquet"],
		walls: [
			"wallpaperRed",
			"wallpaperBlue",
			"wallpaperPurple",
			"wallpaperOchre",
			"wallpaperFloral",
			"wallpaperStripes",
		],
		ceilings: ["plaster", "coffered", "beams"],
		wainscotChance: 0.6,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	bathroom: {
		type: "bathroom",
		names: ["Salle de bain", "Salle d'eau"],
		width: [3.5, 5],
		depth: [3.5, 5],
		heightGround: [2.9, 3.3],
		heightUpper: [2.7, 3.0],
		shapes: [
			["rect", 2],
			["heptagon", 0.6],
		],
		floors: ["mosaic", "checkerTiles"],
		walls: ["tiles", "wallpaperBlue"],
		ceilings: ["plaster"],
		wainscotChance: 0.3,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	study: {
		type: "study",
		names: ["Bureau", "Cabinet de travail", "Bureau du maître"],
		width: [4.5, 6.5],
		depth: [4.5, 6],
		heightGround: [3.1, 3.6],
		heightUpper: [2.8, 3.2],
		shapes: [
			["rect", 2],
			["heptagon", 1],
		],
		floors: ["darkPlanks", "parquet"],
		walls: ["woodPanels", "wallpaperGreen", "wallpaperOchre", "wallpaperFleur"],
		ceilings: ["coffered", "plaster"],
		wainscotChance: 0.8,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	greenhouse: {
		type: "greenhouse",
		names: ["Serre", "Jardin d'hiver", "Orangerie"],
		width: [7, 10],
		depth: [6.5, 9.5],
		heightGround: [3.6, 4.0],
		heightUpper: [3.1, 3.4],
		tall: { chance: 0.35, height: [5.1, 5.8] },
		shapes: [
			["rect", 1],
			["octagon", 1.5],
			["apse", 1],
		],
		floors: ["greenhouseTiles"],
		walls: ["greenhouseBrick", "mossyBrick"],
		ceilings: ["glass"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	alchemy: {
		type: "alchemy",
		names: ["Laboratoire d'alchimie", "Officine", "Distillerie"],
		width: [5.5, 8],
		depth: [5.5, 8],
		heightGround: [3.2, 3.8],
		heightUpper: [2.9, 3.3],
		shapes: [
			["octagon", 2],
			["rect", 1],
			["heptagon", 1],
		],
		floors: ["stoneFlags", "darkPlanks"],
		walls: ["stoneBlocks", "brick", "plaster", "rubbleStone"],
		ceilings: ["beams", "vault"],
		wainscotChance: 0.1,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	ritual: {
		type: "ritual",
		names: ["Salle des rituels", "Sanctuaire", "Cercle intérieur"],
		width: [6.5, 9],
		depth: [6.5, 9],
		heightGround: [3.4, 3.95],
		heightUpper: [3.0, 3.4],
		shapes: [
			["octagon", 3],
			["heptagon", 1],
		],
		floors: ["stoneFlags", "mosaic"],
		walls: ["stoneBlocks", "wallpaperPurple", "rubbleStone"],
		ceilings: ["vault"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	music: {
		type: "music",
		names: ["Salon de musique", "Salle de musique"],
		width: [6, 9],
		depth: [6, 8],
		heightGround: [3.4, 3.9],
		heightUpper: [3.0, 3.4],
		shapes: [
			["rect", 1],
			["heptagon", 1],
			["apse", 1],
		],
		floors: ["parquet"],
		walls: ["wallpaperOchre", "wallpaperRed", "woodPanels", "wallpaperStripes"],
		ceilings: ["coffered", "plaster"],
		wainscotChance: 0.8,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	dining: {
		type: "dining",
		names: ["Salle à manger", "Salle des banquets"],
		width: [6.5, 10],
		depth: [5.5, 7.5],
		heightGround: [3.3, 3.9],
		heightUpper: [2.9, 3.3],
		shapes: [
			["rect", 2],
			["octagon", 1],
		],
		floors: ["parquet", "oakPlanks"],
		walls: [
			"wallpaperRed",
			"woodPanels",
			"wallpaperGreen",
			"wallpaperFleur",
			"wallpaperFloral",
		],
		ceilings: ["coffered", "beams"],
		wainscotChance: 0.8,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	workshop: {
		type: "workshop",
		names: ["Atelier", "Atelier de l'artificier", "Forge"],
		width: [5.5, 8],
		depth: [5, 7],
		heightGround: [3.1, 3.7],
		heightUpper: [2.8, 3.1],
		shapes: [
			["rect", 2],
			["lshape", 1],
		],
		floors: ["darkPlanks", "stoneFlags"],
		walls: ["brick", "plaster"],
		ceilings: ["beams", "planks"],
		wainscotChance: 0.1,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	chapel: {
		type: "chapel",
		names: ["Chapelle", "Oratoire"],
		width: [6, 8],
		depth: [9, 12.5],
		heightGround: [3.7, 4.0],
		heightUpper: [3.2, 3.4],
		tall: { chance: 0.45, height: [5.4, 6.0] },
		shapes: [["apse", 1]],
		floors: ["stoneFlags", "mosaic"],
		walls: ["stoneBlocks", "plaster", "rubbleStone"],
		ceilings: ["vault"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	closet: {
		type: "closet",
		names: ["Débarras", "Placard à balais"],
		width: [1.5, 2.0],
		depth: [1.5, 2.25],
		heightGround: [2.7, 2.95],
		heightUpper: [2.6, 2.8],
		low: { chance: 0.35, height: [2.4, 2.5] },
		shapes: [["rect", 1]],
		floors: ["darkPlanks"],
		walls: ["plaster", "woodPanels"],
		ceilings: ["planks"],
		wainscotChance: 0,
		singleDoor: true,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	observatory: {
		type: "observatory",
		names: ["Observatoire", "Salle des astres"],
		width: [6, 8],
		depth: [6, 8],
		heightGround: [3.4, 3.8],
		heightUpper: [3.1, 3.4],
		shapes: [
			["octagon", 2],
			["rect", 1],
		],
		floors: ["parquet", "mosaic"],
		walls: ["wallpaperStars", "woodPanels"],
		ceilings: ["glass"],
		wainscotChance: 0.6,
		singleDoor: false,
		allowUpper: true,
		allowGround: false,
		optional: true,
	},
	curiosities: {
		type: "curiosities",
		names: ["Cabinet de curiosités", "Salle des trophées"],
		width: [6, 8.5],
		depth: [5.5, 7.5],
		heightGround: [3.2, 3.7],
		heightUpper: [2.9, 3.2],
		shapes: [
			["rect", 2],
			["heptagon", 1],
			["lshape", 0.8],
		],
		floors: ["parquet", "checkerTiles", "darkPlanks"],
		walls: [
			"wallpaperGreen",
			"wallpaperOchre",
			"woodPanels",
			"wallpaperTrellis",
		],
		ceilings: ["coffered", "beams"],
		wainscotChance: 0.7,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	nursery: {
		type: "nursery",
		names: ["Nursery", "Chambre d'enfant", "Salle de jeux"],
		width: [4.5, 6.5],
		depth: [4.5, 6],
		heightGround: [3.0, 3.4],
		heightUpper: [2.8, 3.1],
		shapes: [
			["rect", 2],
			["heptagon", 0.6],
		],
		floors: ["oakPlanks", "parquet"],
		walls: ["wallpaperNursery"],
		ceilings: ["plaster", "beams"],
		wainscotChance: 0.6,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	laundry: {
		type: "laundry",
		names: ["Buanderie", "Lingerie"],
		width: [4.5, 6.5],
		depth: [4, 6],
		heightGround: [2.9, 3.3],
		heightUpper: [2.7, 3.0],
		shapes: [
			["rect", 2],
			["lshape", 0.6],
		],
		floors: ["stoneFlags", "checkerTiles"],
		walls: ["tiles", "plaster", "brick"],
		ceilings: ["beams", "planks"],
		wainscotChance: 0.2,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	crypt: {
		type: "crypt",
		names: ["Crypte", "Caveau familial"],
		width: [5.5, 8],
		depth: [7, 10],
		heightGround: [3.0, 3.5],
		heightUpper: [3.0, 3.2],
		shapes: [
			["apse", 1],
			["rect", 1],
		],
		floors: ["stoneFlags", "cobble"],
		walls: ["stoneBlocks", "rubbleStone", "mossyBrick"],
		ceilings: ["vault"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	dungeon: {
		type: "dungeon",
		names: ["Cachot", "Oubliettes", "Geôle"],
		width: [6, 9],
		depth: [6, 8.5],
		heightGround: [3.4, 3.9],
		heightUpper: [3.2, 3.5],
		shapes: [
			["rect", 2],
			["lshape", 0.8],
		],
		floors: ["stoneFlags", "cobble"],
		walls: ["stoneBlocks", "rubbleStone", "mossyBrick"],
		ceilings: ["vault"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	pond: {
		type: "pond",
		names: ["Salle du lac", "Bassin d'agrément", "Jardin du bassin"],
		width: [8, 11],
		depth: [7.5, 10],
		heightGround: [3.6, 4.0],
		heightUpper: [3.2, 3.6],
		tall: { chance: 0.3, height: [5.0, 5.6] },
		shapes: [
			["rect", 2],
			["octagon", 1.2],
			["apse", 0.8],
		],
		floors: ["mosaic", "stoneFlags", "greenhouseTiles"],
		walls: [
			"greenhouseBrick",
			"plaster",
			"wallpaperGreen",
			"tiles",
			"mossyBrick",
			"wallpaperTrellis",
		],
		ceilings: ["glass", "vault", "beams"],
		wainscotChance: 0.3,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	ballroom: {
		type: "ballroom",
		names: ["Salle de bal", "Grand salon de bal", "Salle des fêtes"],
		width: [10, 14],
		depth: [9, 12.5],
		heightGround: [5.5, 6.0],
		heightUpper: [5.2, 5.8],
		shapes: [
			["rect", 2],
			["octagon", 2],
			["apse", 1],
		],
		floors: ["parquet", "checkerTiles", "mosaic"],
		walls: [
			"wallpaperRed",
			"wallpaperOchre",
			"wallpaperPurple",
			"woodPanels",
			"wallpaperFleur",
			"wallpaperStripes",
		],
		ceilings: ["coffered", "vault", "beams"],
		wainscotChance: 0.7,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	theater: {
		type: "theater",
		names: ["Petit théâtre", "Salle de spectacle", "Théâtre de marionnettes"],
		width: [8, 11],
		depth: [10, 13],
		heightGround: [5.3, 6.0],
		heightUpper: [5.1, 5.6],
		shapes: [
			["rect", 2],
			["apse", 1.4],
		],
		floors: ["redCarpet", "darkPlanks", "parquet"],
		walls: [
			"wallpaperRed",
			"wallpaperPurple",
			"woodPanels",
			"wallpaperStripes",
		],
		ceilings: ["coffered", "vault"],
		wainscotChance: 0.6,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	armory: {
		type: "armory",
		names: ["Armurerie", "Salle d'armes", "Arsenal"],
		width: [5.5, 8],
		depth: [5, 7.5],
		heightGround: [3.2, 3.8],
		heightUpper: [2.9, 3.3],
		shapes: [
			["rect", 2],
			["lshape", 0.8],
			["octagon", 0.6],
		],
		floors: ["stoneFlags", "cobble", "darkPlanks"],
		walls: ["stoneBlocks", "woodPanels", "brick", "rubbleStone"],
		ceilings: ["beams", "vault"],
		wainscotChance: 0.2,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	billiard: {
		type: "billiard",
		names: ["Salle de billard", "Salon de jeu", "Cercle de jeu"],
		width: [6, 8.5],
		depth: [5.5, 7.5],
		heightGround: [3.2, 3.7],
		heightUpper: [2.9, 3.3],
		shapes: [
			["rect", 2],
			["heptagon", 0.6],
			["lshape", 0.6],
		],
		floors: ["parquet", "redCarpet", "darkPlanks"],
		walls: [
			"wallpaperGreen",
			"woodPanels",
			"wallpaperBlue",
			"wallpaperStripes",
			"wallpaperTrellis",
		],
		ceilings: ["coffered", "beams", "plaster"],
		wainscotChance: 0.8,
		singleDoor: false,
		allowUpper: true,
		allowGround: true,
		optional: true,
	},
	attic: {
		type: "attic",
		names: ["Grenier", "Combles", "Mansarde"],
		width: [6, 10],
		depth: [5, 8],
		heightGround: [2.4, 2.6],
		heightUpper: [2.4, 2.6],
		shapes: [
			["rect", 2],
			["lshape", 1],
		],
		floors: ["oakPlanks", "darkPlanks"],
		walls: ["woodPanels", "plaster", "brick"],
		ceilings: ["beams", "planks"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: true,
		allowGround: false,
		optional: true,
	},
	undercroft: {
		type: "undercroft",
		names: ["Souterrain", "Cave voûtée", "Galerie basse"],
		width: [5, 8],
		depth: [6, 10],
		heightGround: [2.4, 2.65],
		heightUpper: [2.4, 2.6],
		shapes: [
			["rect", 2],
			["apse", 0.8],
			["lshape", 0.8],
		],
		floors: ["cobble", "stoneFlags"],
		walls: ["stoneBlocks", "brick", "rubbleStone", "mossyBrick"],
		ceilings: ["vault", "beams"],
		wainscotChance: 0,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: true,
	},
	stairwell: {
		type: "stairwell",
		names: ["Escalier", "Cage d'escalier"],
		width: [2.6, 2.6],
		depth: [7.4, 7.4],
		heightGround: [LEVEL_HEIGHT + 3, LEVEL_HEIGHT + 3],
		heightUpper: [3, 3],
		shapes: [["rect", 1]],
		floors: ["darkPlanks"],
		walls: ["plaster", "woodPanels", "stoneBlocks"],
		ceilings: ["plaster"],
		wainscotChance: 0.5,
		singleDoor: false,
		allowUpper: false,
		allowGround: true,
		optional: false,
	},
};

export const OPTIONAL_ROOM_TYPES: RoomType[] = (
	Object.keys(ROOM_TYPES) as RoomType[]
).filter((type) => ROOM_TYPES[type].optional);

export const MAX_CEILING = LEVEL_HEIGHT - SLAB_THICKNESS;

export interface RoomShape {
	edges: OutlineEdge[];
	family: ShapeFamily;
}

function snap(value: number, step = 0.25): number {
	return Math.round(value / step) * step;
}

function randomCorner(
	rng: SeededRandom,
	maxSize: number,
	weights = [0.5, 0.28, 0.22],
): CornerTreatment {
	if (maxSize < 0.75) {
		return SQUARE;
	}
	const kind = rng.weighted([
		["square", weights[0]],
		["chamfer", weights[1]],
		["round", weights[2]],
	] as const);
	if (kind === "square") {
		return SQUARE;
	}
	const size = snap(rng.range(0.75, Math.min(maxSize, 2.25)));
	return { kind, size: Math.max(0.75, size) };
}

export function createRoomShape(
	definition: RoomTypeDefinition,
	rng: SeededRandom,
	sizeFactor: number,
): RoomShape {
	const family = rng.weighted(definition.shapes);
	const width = snap(
		rng.range(definition.width[0], definition.width[1]) * sizeFactor,
	);
	const depth = snap(
		rng.range(definition.depth[0], definition.depth[1]) * sizeFactor,
	);
	const minSide = Math.min(width, depth);

	switch (family) {
		case "rect": {
			const maxCorner = minSide / 2 - 1.1;
			const corners = [0, 1, 2, 3].map(() =>
				randomCorner(rng, maxCorner, [0.62, 0.2, 0.18]),
			);
			return {
				family,
				edges: outlineFromVertices(rectangleVertices(width, depth), corners),
			};
		}
		case "octagon": {
			const size = snap(Math.max(1.25, Math.min(minSide * 0.28, 2.5)));
			const chamfer: CornerTreatment = { kind: "chamfer", size };
			return {
				family,
				edges: outlineFromVertices(rectangleVertices(width, depth), [
					chamfer,
					chamfer,
					chamfer,
					chamfer,
				]),
			};
		}
		case "heptagon": {
			const size = snap(Math.max(1.25, Math.min(minSide * 0.26, 2.25)));
			const chamfer: CornerTreatment = { kind: "chamfer", size };
			const squareIndex = rng.int(0, 3);
			const corners = [0, 1, 2, 3].map((index) =>
				index === squareIndex ? SQUARE : chamfer,
			);
			return {
				family,
				edges: outlineFromVertices(rectangleVertices(width, depth), corners),
			};
		}
		case "lshape": {
			const notchWidth = snap(width * rng.range(0.32, 0.45));
			const notchDepth = snap(depth * rng.range(0.32, 0.45));
			const vertices = lShapeVertices(width, depth, notchWidth, notchDepth);
			const maxConvex =
				Math.min(width - notchWidth, depth - notchDepth) / 2 - 0.9;
			const inner: CornerTreatment = rng.chance(0.35)
				? { kind: "round", size: snap(rng.range(0.75, 1.25)) }
				: SQUARE;
			const corners = [
				randomCorner(rng, maxConvex),
				randomCorner(rng, maxConvex),
				randomCorner(rng, Math.min(notchDepth, maxConvex)),
				inner,
				randomCorner(rng, Math.min(notchWidth, maxConvex)),
				randomCorner(rng, maxConvex),
			];
			return { family, edges: outlineFromVertices(vertices, corners) };
		}
		case "apse": {
			const apseRadius = width / 2;
			const round: CornerTreatment = { kind: "round", size: apseRadius };
			const entryCorners = [0, 1].map(() =>
				randomCorner(rng, Math.min(1.25, width / 2 - 1.2), [0.7, 0.3, 0]),
			);
			return {
				family,
				edges: outlineFromVertices(
					rectangleVertices(width, Math.max(depth, width * 1.1)),
					[entryCorners[0], entryCorners[1], round, round],
				),
			};
		}
		case "corridor": {
			return {
				family,
				edges: outlineFromVertices(rectangleVertices(width, depth), [
					SQUARE,
					SQUARE,
					SQUARE,
					SQUARE,
				]),
			};
		}
		case "corridorL": {
			const armA = snap(Math.max(depth * 0.6, width + 2.5));
			const armB = snap(Math.max(depth * 0.55, width + 2.5));
			const vertices = lShapeVertices(armA, armB, armA - width, armB - width);
			return {
				family,
				edges: outlineFromVertices(vertices, [
					SQUARE,
					SQUARE,
					SQUARE,
					SQUARE,
					SQUARE,
					SQUARE,
				]),
			};
		}
		case "corridorBend": {
			const innerRadius = snap(rng.range(0.75, 1.5));
			const outerRadius = innerRadius + width;
			const armA = snap(Math.max(depth * 0.55, outerRadius + 2));
			const armB = snap(Math.max(depth * 0.5, outerRadius + 2));
			const vertices = lShapeVertices(armA, armB, armA - width, armB - width);
			return {
				family,
				edges: outlineFromVertices(vertices, [
					{ kind: "round", size: outerRadius },
					SQUARE,
					SQUARE,
					{ kind: "round", size: innerRadius },
					SQUARE,
					SQUARE,
				]),
			};
		}
		case "corridor45": {
			const first = snap(rng.range(3, Math.max(3.5, depth * 0.55)));
			const second = snap(rng.range(3, Math.max(3.5, depth * 0.55)));
			const turn = rng.chance(0.5) ? 1 : -1;
			const diagonal = Math.SQRT1_2 * second;
			const path = [
				{ x: 0, z: 0 },
				{ x: first, z: 0 },
				{ x: first + diagonal, z: diagonal * turn },
			];
			const polygon = corridorPathVertices(path, width);
			return {
				family,
				edges: outlineFromVertices(
					polygon,
					polygon.map(() => SQUARE),
				),
			};
		}
	}
}

/**
 * Contour d'une grande salle à mezzanine : mêmes familles que les autres salles
 * (pans coupés, arrondis, abside, équerre), à l'échelle d'une grande salle.
 */
export function createGrandRoomShape(
	rng: SeededRandom,
	width: number,
	depth: number,
	plain: boolean,
): RoomShape {
	const family = plain
		? "rect"
		: rng.weighted([
				["rect", 3],
				["octagon", 2],
				["heptagon", 2],
				["apse", 2],
				["lshape", 1.5],
			] as const);
	switch (family) {
		case "rect": {
			const corners = [0, 1, 2, 3].map(() =>
				plain ? SQUARE : randomCorner(rng, 3, [0.3, 0.35, 0.35]),
			);
			return {
				family,
				edges: outlineFromVertices(rectangleVertices(width, depth), corners),
			};
		}
		case "octagon":
		case "heptagon": {
			const chamfer: CornerTreatment = {
				kind: "chamfer",
				size: snap(rng.range(2, 3)),
			};
			const squareIndex = family === "heptagon" ? rng.int(0, 3) : -1;
			return {
				family,
				edges: outlineFromVertices(
					rectangleVertices(width, depth),
					[0, 1, 2, 3].map((index) =>
						index === squareIndex ? SQUARE : chamfer,
					),
				),
			};
		}
		case "apse": {
			const narrow = snap(Math.min(width, depth + 1));
			const long = snap(Math.max(depth + 4, narrow * 1.25));
			const round: CornerTreatment = { kind: "round", size: narrow / 2 };
			return {
				family,
				edges: outlineFromVertices(rectangleVertices(narrow, long), [
					randomCorner(rng, 1.25, [0.6, 0.4, 0]),
					randomCorner(rng, 1.25, [0.6, 0.4, 0]),
					round,
					round,
				]),
			};
		}
		case "lshape": {
			const wide = snap(width * 1.15);
			const deep = snap(depth * 1.15);
			const notchWidth = snap(wide * rng.range(0.25, 0.33));
			const notchDepth = snap(deep * rng.range(0.25, 0.33));
			const inner: CornerTreatment = rng.chance(0.5)
				? { kind: "round", size: snap(rng.range(1, 2)) }
				: SQUARE;
			return {
				family,
				edges: outlineFromVertices(
					lShapeVertices(wide, deep, notchWidth, notchDepth),
					[
						randomCorner(rng, 2.5, [0.4, 0.3, 0.3]),
						randomCorner(rng, 2.5, [0.4, 0.3, 0.3]),
						SQUARE,
						inner,
						SQUARE,
						randomCorner(rng, 2.5, [0.4, 0.3, 0.3]),
					],
				),
			};
		}
	}
}

export function pickRoomStyle(
	definition: RoomTypeDefinition,
	rng: SeededRandom,
): RoomStyle {
	const wall = rng.pick(definition.walls);
	const paneled =
		wall !== "stoneBlocks" &&
		wall !== "brick" &&
		wall !== "tiles" &&
		wall !== "greenhouseBrick";
	return {
		floor: rng.pick(definition.floors),
		wall,
		wainscot:
			paneled && wall !== "woodPanels" && rng.chance(definition.wainscotChance),
		ceiling: rng.pick(definition.ceilings),
	};
}

export function pickRoomHeight(
	definition: RoomTypeDefinition,
	level: Level,
	rng: SeededRandom,
): number {
	if (definition.type === "stairwell") {
		return definition.heightGround[0];
	}
	const roll = rng.next();
	const variant =
		definition.tall && roll < definition.tall.chance
			? definition.tall.height
			: definition.low && roll > 1 - definition.low.chance
				? definition.low.height
				: level === 0
					? definition.heightGround
					: definition.heightUpper;
	return Math.round(rng.range(variant[0], variant[1]) * 20) / 20;
}

export function spansLevelAbove(type: RoomType, height: number): boolean {
	return type === "stairwell" || height > MAX_CEILING;
}
