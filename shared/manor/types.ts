import type { StakeKind } from "../config/items.js";
import type { MaterialId } from "../config/occult.js";
import type { Vec2, Vec3 } from "../math.js";

export type Level = 0 | 1 | 2 | 3;

export type RoomType =
	| "hall"
	| "salon"
	| "gallery"
	| "corridor"
	| "library"
	| "cellar"
	| "kitchen"
	| "toilets"
	| "bedroom"
	| "bathroom"
	| "study"
	| "greenhouse"
	| "alchemy"
	| "ritual"
	| "music"
	| "dining"
	| "workshop"
	| "chapel"
	| "sanctuary"
	| "reliquary"
	| "pact"
	| "closet"
	| "observatory"
	| "curiosities"
	| "nursery"
	| "laundry"
	| "crypt"
	| "ballroom"
	| "theater"
	| "armory"
	| "billiard"
	| "attic"
	| "undercroft"
	| "dungeon"
	| "pond"
	| "stairwell";

export interface LineEdge {
	kind: "line";
	a: Vec2;
	b: Vec2;
}

export interface ArcEdge {
	kind: "arc";
	a: Vec2;
	b: Vec2;
	center: Vec2;
	radius: number;
	startAngle: number;
	sweep: number;
}

export type OutlineEdge = LineEdge | ArcEdge;

export interface Bounds {
	minX: number;
	minZ: number;
	maxX: number;
	maxZ: number;
}

export type FloorStyle =
	| "oakPlanks"
	| "darkPlanks"
	| "parquet"
	| "stoneFlags"
	| "cobble"
	| "checkerTiles"
	| "mosaic"
	| "greenhouseTiles"
	| "redCarpet";

export type WallStyle =
	| "wallpaperGreen"
	| "wallpaperRed"
	| "wallpaperBlue"
	| "wallpaperOchre"
	| "wallpaperPurple"
	| "plaster"
	| "stoneBlocks"
	| "brick"
	| "woodPanels"
	| "tiles"
	| "greenhouseBrick"
	| "wallpaperNursery"
	| "wallpaperStars"
	| "wallpaperFloral"
	| "wallpaperTrellis"
	| "wallpaperStripes"
	| "wallpaperFleur"
	| "rubbleStone"
	| "mossyBrick";

export type CeilingStyle =
	| "plaster"
	| "beams"
	| "glass"
	| "vault"
	| "coffered"
	| "planks";

export interface RoomStyle {
	floor: FloorStyle;
	wall: WallStyle;
	wainscot: boolean;
	ceiling: CeilingStyle;
}

export interface StairSpec {
	origin: Vec2;
	forward: Vec2;
	right: Vec2;
	width: number;
	length: number;
	bottomLanding: number;
	run: number;
	stepCount: number;
	rise: number;
	topY: number;
}

export interface MezzanineSegment {
	a: Vec2;
	b: Vec2;
}

export type MezzanineShape =
	| "corner"
	| "gallery"
	| "diagonal"
	| "crescent"
	| "pier"
	| "horseshoe"
	| "bridge";

export interface MezzaninePodium {
	center: Vec2;
	rotation: number;
	width: number;
	depth: number;
}

export interface MezzanineSpec {
	shape: MezzanineShape;
	floorY: number;
	deck: Vec2[];
	deckEdges: number[];
	rails: MezzanineSegment[];
	posts: Vec2[];
	stair: StairSpec;
	stairPolygon: Vec2[];
	stairSide: MezzanineSegment;
	stairSideOuter: MezzanineSegment | null;
	stairEnd: MezzanineSegment;
	stairEdge: number;
	stairEdgeFrom: number;
	stairEdgeTo: number;
	corner: Vec2;
	clearCenter: Vec2;
	clearWidth: number;
	clearDepth: number;
	clearRotation: number;
	deckKeepClear: Vec2[] | null;
	podium: MezzaninePodium | null;
}

export interface EdgeOpeningSlot {
	openingId: number;
	from: number;
	to: number;
}

export interface Room {
	id: number;
	type: RoomType;
	name: string;
	nameIndex: number;
	level: Level;
	floorY: number;
	height: number;
	ceilingY: number;
	edges: OutlineEdge[];
	polygon: Vec2[];
	bounds: Bounds;
	labelPoint: Vec2;
	area: number;
	axisAngle: number;
	openingIds: number[];
	edgeOpenings: EdgeOpeningSlot[][];
	exteriorEdges: boolean[];
	style: RoomStyle;
	stair: StairSpec | null;
	mezzanine: MezzanineSpec | null;
	seed: number;
}

export type OpeningKind = "free" | "door" | "window";

export interface DoorSpec {
	id: number;
	hingeAtStart: boolean;
	swingIntoA: boolean;
	style: number;
	initiallyOpen: boolean;
}

export interface Opening {
	id: number;
	kind: OpeningKind;
	roomA: number;
	roomB: number;
	edgeA: number;
	edgeB: number;
	start: Vec2;
	end: Vec2;
	normal: Vec2;
	width: number;
	height: number;
	depth: number;
	floorY: number;
	level: Level;
	sill: number;
	door: DoorSpec | null;
}

export interface OrientedBox {
	cx: number;
	cz: number;
	hx: number;
	hz: number;
	rotation: number;
	yMin: number;
	yMax: number;
}

export interface FurnitureCollider extends OrientedBox {
	walkable: boolean;
	occludes: boolean;
}

export interface HideSpot {
	id: number;
	furnitureId: number;
	interior: Vec3;
	entry: Vec2;
	facing: number;
	label: string;
}

export interface LightSource {
	id: number;
	furnitureId: number | null;
	roomId: number;
	level: Level;
	position: Vec3;
	color: number;
	intensity: number;
	radius: number;
	kind: "candle" | "chandelier" | "fire" | "lamp" | "cauldron" | "moon";
}

export interface ValveStation {
	id: number;
	furnitureId: number;
	roomId: number;
	level: Level;
	valve: Vec3;
	spout: Vec3;
	jet: Vec2;
	floorY: number;
}

export interface FurnitureItem {
	id: number;
	kind: string;
	variant: number;
	roomId: number;
	level: Level;
	x: number;
	y: number;
	z: number;
	rotation: number;
	width: number;
	depth: number;
	height: number;
	colliders: FurnitureCollider[];
	hideSpotId: number | null;
	valveId: number | null;
	parentId: number | null;
	seed: number;
}

export type PickupSpot = "container" | "surface" | "floor";

export interface MaterialPickup {
	id: number;
	material: MaterialId;
	spot: PickupSpot;
	furnitureId: number | null;
	roomId: number;
	level: Level;
	x: number;
	y: number;
	z: number;
}

export interface Altar {
	id: number;
	furnitureId: number;
	roomId: number;
	level: Level;
	x: number;
	y: number;
	z: number;
}

export interface WalkieSpot {
	id: number;
	roomId: number;
	level: Level;
	x: number;
	y: number;
	z: number;
}

export type CameraSpot = WalkieSpot;

export interface StakeRoom {
	id: number;
	kind: StakeKind;
	furnitureId: number;
	roomId: number;
	level: Level;
	x: number;
	y: number;
	z: number;
}

export interface ManorLayout {
	seed: number;
	rooms: Room[];
	openings: Opening[];
	furniture: FurnitureItem[];
	hideSpots: HideSpot[];
	lights: LightSource[];
	valves: ValveStation[];
	pickups: MaterialPickup[];
	altars: Altar[];
	walkies: WalkieSpot[];
	cameras: CameraSpot[];
	stakes: StakeRoom[];
	bounds: Bounds;
	levels: Level[];
}
