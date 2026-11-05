import { rotate2 } from "../../math.js";
import {
	furnitureDefinition,
	LOW_WALKABLE_MAX_HEIGHT,
} from "../furnitureCatalog.js";
import type { FurnitureCollider, FurnitureItem } from "../types.js";

const SOLID_KINDS = new Set([
	"cabinet",
	"dresser",
	"nightstand",
	"fileCabinet",
	"chest",
	"bed",
	"kitchenCounter",
	"stove",
	"sink",
	"bathtub",
	"workbench",
	"crate",
	"barrel",
	"altar",
	"planterBed",
	"sofa",
	"armchair",
	"pew",
	"desk",
	"cauldron",
	"pottingTable",
	"alchemyTable",
	"grandPiano",
	"estrade",
	"valveStation",
	"sarcophagus",
	"washtub",
	"sheetedFurniture",
	"boneShelf",
	"billiardTable",
	"barrelStack",
	"theaterSeats",
	"harpsichord",
	"chaiseLongue",
	"woodpile",
	"throne",
	"grainSacks",
	"secretary",
]);

interface LocalBox {
	x: number;
	z: number;
	width: number;
	depth: number;
	yMin: number;
	yMax: number;
	walkable: boolean;
}

export function buildFurnitureColliders(
	item: FurnitureItem,
	roomCeilingY: number,
): FurnitureCollider[] {
	const definition = furnitureDefinition(item.kind);
	if (!definition.collides) {
		return [];
	}
	const occludes = definition.occludes || SOLID_KINDS.has(item.kind);
	return localBoxes(item, roomCeilingY).map((box) => {
		const center = rotate2({ x: box.x, z: box.z }, item.rotation);
		return {
			cx: item.x + center.x,
			cz: item.z + center.z,
			hx: box.width / 2,
			hz: box.depth / 2,
			rotation: item.rotation,
			yMin: item.y + box.yMin,
			yMax: item.y + box.yMax,
			walkable: box.walkable,
			occludes,
		};
	});
}

function localBoxes(item: FurnitureItem, roomCeilingY: number): LocalBox[] {
	const { width, depth, height } = item;
	const definition = furnitureDefinition(item.kind);
	const walkable = definition.walkableTop && height <= LOW_WALKABLE_MAX_HEIGHT;
	const full: LocalBox = {
		x: 0,
		z: 0,
		width,
		depth,
		yMin: 0,
		yMax: height,
		walkable,
	};

	switch (item.kind) {
		case "bed":
			return bedBoxes(item);
		case "fireplace":
		case "pillar":
			return [{ ...full, yMax: roomCeilingY - item.y, walkable: false }];
		case "chair":
			return [
				{
					x: 0,
					z: 0.03,
					width: width * 0.92,
					depth: depth * 0.85,
					yMin: 0,
					yMax: 0.48,
					walkable: true,
				},
			];
		case "pond":
			return [];
		case "flowerPot":
			return [
				{
					x: 0,
					z: 0,
					width: width * 0.7,
					depth: depth * 0.7,
					yMin: 0,
					yMax: 0.3,
					walkable: false,
				},
			];
		case "pottedPlant":
			return [
				{
					x: 0,
					z: 0,
					width: width * 0.62,
					depth: depth * 0.62,
					yMin: 0,
					yMax: 0.55,
					walkable: false,
				},
			];
		case "floorLamp":
		case "candelabra":
			return [
				{
					x: 0,
					z: 0,
					width: 0.32,
					depth: 0.32,
					yMin: 0,
					yMax: height,
					walkable: false,
				},
			];
		case "harp":
		case "cello":
		case "musicStand":
		case "globe":
		case "lectern":
		case "telescope":
		case "orrery":
		case "dressForm":
		case "birdcage":
		case "rockingHorse":
		case "gramophone":
		case "spinningWheel":
		case "coatRack":
			return [
				{
					x: 0,
					z: 0,
					width: width * 0.75,
					depth: depth * 0.75,
					yMin: 0,
					yMax: height,
					walkable: false,
				},
			];
		case "valveStation":
			return [
				{
					x: 0,
					z: -depth / 2 + 0.2,
					width,
					depth: 0.4,
					yMin: 0,
					yMax: height,
					walkable: false,
				},
			];
		case "toolRack":
		case "displayCase":
		case "armor":
		case "weaponRack":
		case "statue":
		case "standingCoffin":
			return [{ ...full, walkable: false }];
		case "stageCurtain":
			return [
				{
					x: 0,
					z: -depth / 2 + 0.1,
					width,
					depth: 0.2,
					yMin: 0,
					yMax: height,
					walkable: false,
				},
			];
		case "dryingLine":
			return [
				{
					x: -width / 2 + 0.06,
					z: 0,
					width: 0.12,
					depth: 0.3,
					yMin: 0,
					yMax: height,
					walkable: false,
				},
				{
					x: width / 2 - 0.06,
					z: 0,
					width: 0.12,
					depth: 0.3,
					yMin: 0,
					yMax: height,
					walkable: false,
				},
				{
					x: 0,
					z: 0,
					width: width - 0.24,
					depth: 0.08,
					yMin: 0.35,
					yMax: height,
					walkable: false,
				},
			];
		default:
			return [full];
	}
}

function bedBoxes(item: FurnitureItem): LocalBox[] {
	const { width, depth, height } = item;
	const mattressHeight = 0.6;
	const boxes: LocalBox[] = [
		{
			x: 0,
			z: 0.07,
			width,
			depth: depth - 0.14,
			yMin: 0,
			yMax: mattressHeight,
			walkable: true,
		},
		{
			x: 0,
			z: -depth / 2 + 0.07,
			width,
			depth: 0.14,
			yMin: 0,
			yMax: Math.min(height, 1.3),
			walkable: false,
		},
	];
	if (item.variant === 2) {
		const postX = width / 2 - 0.06;
		const postZ = depth / 2 - 0.06;
		boxes.push(
			{
				x: -postX,
				z: postZ,
				width: 0.12,
				depth: 0.12,
				yMin: 0,
				yMax: height,
				walkable: false,
			},
			{
				x: postX,
				z: postZ,
				width: 0.12,
				depth: 0.12,
				yMin: 0,
				yMax: height,
				walkable: false,
			},
			{
				x: -postX,
				z: -postZ,
				width: 0.12,
				depth: 0.12,
				yMin: 0,
				yMax: height,
				walkable: false,
			},
			{
				x: postX,
				z: -postZ,
				width: 0.12,
				depth: 0.12,
				yMin: 0,
				yMax: height,
				walkable: false,
			},
		);
	}
	return boxes;
}
