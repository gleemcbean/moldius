import type { FurnitureItem, Room } from "@shared/manor/types";
import type { SeededRandom } from "@shared/random";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { PartAnimation } from "../../../src/features/world/DecorAnimator";
import {
	type RoomBind,
	type RoomCondition,
	sacredFloor,
} from "../../../src/features/world/furniture/furnitureFormat";
import {
	CARVED_STONES,
	carvedForSeed,
	MARBLE,
	STONE,
} from "../../../src/features/world/furniture/stones";
import {
	meterBox,
	meterCylinder,
	meterLathe,
	meterSphere,
	meterTorus,
	placed,
	scaleUv,
} from "../../../src/features/world/geometryUtils";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import { isFineTexture } from "../../textures/surface/recipes";

export type { PartAnimation };

export type FurnitureSurface = MaterialOptions & { bind?: RoomBind };

export interface Part {
	geometry: THREE.BufferGeometry;
	material: FurnitureSurface;
	animation?: PartAnimation;
	when?: RoomCondition;
}

export { sacredFloor };

export interface FurnitureContext {
	item: FurnitureItem;
	room: Room;
	rng: SeededRandom;
}

export type FurnitureBuilder = (context: FurnitureContext) => Part[];

export const WOODS = [
	"woodDark",
	"woodMedium",
	"woodLight",
	"woodRed",
] as const;

export function pickWood(rng: SeededRandom): MaterialOptions {
	return { texture: rng.pick(WOODS), roughness: 0.82 };
}

export function roundedBox(
	width: number,
	height: number,
	depth: number,
	radius = 0.02,
	segments = 1,
): THREE.BufferGeometry {
	const geometry = new RoundedBoxGeometry(
		width,
		height,
		depth,
		segments,
		Math.min(radius, width / 2, height / 2, depth / 2),
	);
	const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
	const perFace = uv.count / 6;
	const faceSizes: [number, number][] = [
		[depth, height],
		[depth, height],
		[width, depth],
		[width, depth],
		[width, height],
		[width, height],
	];
	for (let face = 0; face < 6; face += 1) {
		const [su, sv] = faceSizes[face];
		for (let index = face * perFace; index < (face + 1) * perFace; index += 1) {
			uv.setXY(index, uv.getX(index) * su, uv.getY(index) * sv);
		}
	}
	uv.needsUpdate = true;
	return geometry;
}

export function part(
	geometry: THREE.BufferGeometry,
	material: FurnitureSurface,
): Part {
	return { geometry, material };
}

const BEVEL_THINNEST = 0.015;
const BEVEL_LARGEST = 0.01;

function edgeBevel(
	material: MaterialOptions,
	width: number,
	height: number,
	depth: number,
): number {
	if (
		!material.texture ||
		material.transparent ||
		!isFineTexture(material.texture)
	) {
		return 0;
	}
	const smallest = Math.min(width, height, depth);
	return smallest < BEVEL_THINNEST
		? 0
		: Math.min(BEVEL_LARGEST, smallest * 0.15);
}

function bevelledBox(
	material: MaterialOptions,
	width: number,
	height: number,
	depth: number,
	rounded: number,
): THREE.BufferGeometry {
	const radius =
		rounded > 0 ? rounded : edgeBevel(material, width, height, depth);
	return radius > 0
		? roundedBox(width, height, depth, radius)
		: meterBox(width, height, depth);
}

export function box(
	material: MaterialOptions,
	width: number,
	height: number,
	depth: number,
	x: number,
	y: number,
	z: number,
	rotationY = 0,
	rounded = 0,
): Part {
	return part(
		placed(
			bevelledBox(material, width, height, depth, rounded),
			x,
			y + height / 2,
			z,
			rotationY,
		),
		material,
	);
}

export function boxAt(
	material: MaterialOptions,
	width: number,
	height: number,
	depth: number,
	x: number,
	y: number,
	z: number,
	rx = 0,
	ry = 0,
	rz = 0,
): Part {
	return part(
		placed(bevelledBox(material, width, height, depth, 0), x, y, z, ry, rx, rz),
		material,
	);
}

export function cylinder(
	material: MaterialOptions,
	radiusTop: number,
	radiusBottom: number,
	height: number,
	x: number,
	y: number,
	z: number,
	segments = 16,
): Part {
	return part(
		placed(
			meterCylinder(radiusTop, radiusBottom, height, segments),
			x,
			y + height / 2,
			z,
		),
		material,
	);
}

export function cylinderBetween(
	material: MaterialOptions,
	from: THREE.Vector3,
	to: THREE.Vector3,
	radius: number,
	segments = 10,
): Part {
	const direction = new THREE.Vector3().subVectors(to, from);
	const length = direction.length();
	const geometry = meterCylinder(radius, radius, length, segments);
	const quaternion = new THREE.Quaternion().setFromUnitVectors(
		new THREE.Vector3(0, 1, 0),
		direction.normalize(),
	);
	const middle = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
	geometry.applyMatrix4(
		new THREE.Matrix4().compose(middle, quaternion, new THREE.Vector3(1, 1, 1)),
	);
	return part(geometry, material);
}

export function sphere(
	material: MaterialOptions,
	radius: number,
	x: number,
	y: number,
	z: number,
	scaleX = 1,
	scaleY = 1,
	scaleZ = 1,
	segments = 16,
): Part {
	const geometry = meterSphere(
		radius,
		segments,
		Math.max(8, Math.round(segments * 0.7)),
	);
	geometry.scale(scaleX, scaleY, scaleZ);
	return part(placed(geometry, x, y, z), material);
}

export function lathe(
	material: MaterialOptions,
	profile: [number, number][],
	x: number,
	y: number,
	z: number,
	segments = 20,
): Part {
	const points = profile.map(
		([radius, height]) => new THREE.Vector2(radius, height),
	);
	return part(placed(meterLathe(points, segments), x, y, z), material);
}

export function torus(
	material: MaterialOptions,
	radius: number,
	tube: number,
	x: number,
	y: number,
	z: number,
	rx = Math.PI / 2,
	ry = 0,
	arc = Math.PI * 2,
): Part {
	return part(
		placed(meterTorus(radius, tube, 8, 24, arc), x, y, z, ry, rx),
		material,
	);
}

export function plane(
	material: MaterialOptions,
	width: number,
	height: number,
	x: number,
	y: number,
	z: number,
	rotationY = 0,
	rotationX = 0,
): Part {
	const geometry = scaleUv(
		new THREE.PlaneGeometry(width, height),
		width,
		height,
	);
	return part(placed(geometry, x, y, z, rotationY, rotationX), material);
}

export function texturedPlane(
	material: MaterialOptions,
	width: number,
	height: number,
	x: number,
	y: number,
	z: number,
	rotationY = 0,
	rotationX = 0,
): Part {
	return part(
		placed(
			new THREE.PlaneGeometry(width, height),
			x,
			y,
			z,
			rotationY,
			rotationX,
		),
		{
			...material,
			fixedRepeat: true,
		},
	);
}

export const FLAME: MaterialOptions = {
	texture: "flame",
	unlit: true,
	transparent: true,
	alphaTest: 0.2,
	side: THREE.DoubleSide,
	fixedRepeat: true,
	depthWrite: false,
	wave: "flame",
};

export const FIRE: MaterialOptions = { ...FLAME, wave: "fire" };
export const WAX: MaterialOptions = { texture: "wax", roughness: 0.6 };
export const IRON: MaterialOptions = {
	texture: "iron",
	roughness: 0.55,
	metalness: 0.6,
};
export const BRASS: MaterialOptions = {
	texture: "brass",
	roughness: 0.4,
	metalness: 0.75,
};
export const COPPER: MaterialOptions = {
	texture: "copper",
	roughness: 0.45,
	metalness: 0.7,
};
export const GLASS: MaterialOptions = {
	color: 0x9ab8a8,
	roughness: 0.08,
	metalness: 0.1,
	transparent: true,
	opacity: 0.32,
	depthWrite: false,
};
export const CERAMIC: MaterialOptions = { texture: "ceramic", roughness: 0.35 };
export { carvedForSeed, MARBLE, STONE };

const CAST_STATUARY: readonly MaterialOptions[] = [
	{ texture: "copper", color: 0x7fb098, roughness: 0.55, metalness: 0.45 },
	{ texture: "brass", color: 0x8a6c3e, roughness: 0.5, metalness: 0.5 },
	{ texture: "iron", color: 0x6a6a70, roughness: 0.6, metalness: 0.4 },
	{ texture: "terracotta", roughness: 0.95 },
];

export function pickCarved(rng: {
	pick<T>(items: readonly T[]): T;
}): MaterialOptions {
	return rng.pick(CARVED_STONES);
}

export function pickStatuary(rng: {
	pick<T>(items: readonly T[]): T;
}): MaterialOptions {
	return rng.pick([...CARVED_STONES, ...CAST_STATUARY]);
}

export const LINEN: MaterialOptions = { texture: "linen", roughness: 0.95 };
export const DARK: MaterialOptions = { color: 0x0b0907, roughness: 1 };

function positionHash(x: number, z: number, salt: number): number {
	const value = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
	return value - Math.floor(value);
}

export function candle(
	x: number,
	y: number,
	z: number,
	height = 0.16,
	radius = 0.025,
): Part[] {
	const crater = radius * 0.22;
	const parts: Part[] = [
		lathe(
			WAX,
			[
				[0.001, 0],
				[radius * 1.1, 0],
				[radius * 1.07, height * 0.45],
				[radius, height * 0.9],
				[radius * 1.03, height],
				[radius * 0.8, height - crater * 0.6],
				[radius * 0.3, height - crater],
				[0.001, height - crater],
			],
			x,
			y,
			z,
			14,
		),
		cylinder(DARK, 0.0012, 0.0016, 0.014, x, y + height - crater, z, 5),
		texturedPlane(FLAME, 0.05, 0.09, x, y + height + 0.045, z),
		texturedPlane(FLAME, 0.05, 0.09, x, y + height + 0.045, z, Math.PI / 2),
	];
	const drips = 1 + Math.floor(positionHash(x, z, 1) * 3);
	for (let index = 0; index < drips; index += 1) {
		const angle = positionHash(x, z, index + 2) * Math.PI * 2;
		const length = 1.6 + positionHash(x, z, index + 7) * 2.2;
		parts.push(
			sphere(
				WAX,
				radius * 0.2,
				x + Math.cos(angle) * radius * 1.02,
				y + height - radius * (0.35 + length * 0.18),
				z + Math.sin(angle) * radius * 1.02,
				0.9,
				length,
				0.9,
				8,
			),
		);
	}
	return parts;
}
