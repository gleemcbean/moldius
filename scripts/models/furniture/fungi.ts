import type { SeededRandom } from "@shared/random";
import * as THREE from "three";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import {
	box,
	cylinder,
	type FurnitureBuilder,
	GLASS,
	lathe,
	type Part,
	pickWood,
	sphere,
	torus,
} from "./parts";
import { bentTube, pleated } from "./sculpt";

type Point = [number, number, number];

function bead(
	material: MaterialOptions,
	radius: number,
	x: number,
	y: number,
	z: number,
	stretch = 1,
): Part {
	const geometry = new THREE.OctahedronGeometry(radius, 0);

	geometry.scale(1, stretch, 1);
	geometry.translate(x, y, z);

	return { geometry, material };
}

export const MUSHROOM_STEM: MaterialOptions = {
	texture: "mushroomStem",
	roughness: 0.85,
};

export const MUSHROOM_GILLS: MaterialOptions = {
	texture: "gills",
	color: 0xd8c7a8,
	roughness: 0.9,
	side: THREE.DoubleSide,
};

export const SOIL: MaterialOptions = { texture: "soil", roughness: 1 };

export const MOSS: MaterialOptions = {
	texture: "soil",
	color: 0x4f7a3a,
	roughness: 1,
};

export const GLOWING_CAPS: readonly MaterialOptions[] = [
	{
		texture: "mushroomSkin",
		color: 0x58e8c8,
		emissive: 0x1fb898,
		emissiveIntensity: 0.9,
		roughness: 0.45,
		pulse: 0.45,
	},
	{
		texture: "mushroomSkin",
		color: 0x9ab0ff,
		emissive: 0x4a5cff,
		emissiveIntensity: 0.85,
		roughness: 0.45,
		pulse: 0.45,
	},
	{
		texture: "mushroomSkin",
		color: 0xd89aff,
		emissive: 0x9a40e0,
		emissiveIntensity: 0.85,
		roughness: 0.45,
		pulse: 0.45,
	},
];

export const EARTHY_CAPS: readonly MaterialOptions[] = [
	{ texture: "mushroomSkin", color: 0xc8322a, roughness: 0.5 },
	{ texture: "mushroomSkin", color: 0x8a5a32, roughness: 0.6 },
	{ texture: "mushroomSkin", color: 0xc89a4a, roughness: 0.6 },
	{ texture: "mushroomSkin", color: 0xe8e0cc, roughness: 0.6 },
];

const SPOT: MaterialOptions = { color: 0xfffaf0, roughness: 0.7 };

const BRACKET_CAPS: readonly MaterialOptions[] = [
	{ texture: "mushroomSkin", color: 0xb8823a, roughness: 0.75 },
	{ texture: "mushroomSkin", color: 0x9a5a2a, roughness: 0.75 },
	{ texture: "mushroomSkin", color: 0xe0d2b0, roughness: 0.7 },
	{
		texture: "mushroomSkin",
		color: 0x7ae0c0,
		emissive: 0x1f9878,
		emissiveIntensity: 0.6,
		roughness: 0.5,
		pulse: 0.4,
	},
];

const GLOW_DOT: MaterialOptions = { color: 0xd8fff0, unlit: true };

const DEW: MaterialOptions = { color: 0xa8fff0, unlit: true };

const FLESH: MaterialOptions = {
	texture: "mushroomSkin",
	color: 0xf2ece2,
	roughness: 0.62,
};

const SKIRT: MaterialOptions = {
	texture: "mushroomStem",
	color: 0xe2d4b8,
	roughness: 0.75,
	side: THREE.DoubleSide,
};

export const MYCELIUM_GLOW: MaterialOptions = {
	texture: "mushroomStem",
	color: 0xe8fff4,
	emissive: 0x58e8c8,
	emissiveIntensity: 0.55,
	roughness: 0.8,
	pulse: 0.5,
};

const GLOWING_GILLS: MaterialOptions = {
	texture: "gills",
	color: 0xd8fff0,
	emissive: 0x2ad8a8,
	emissiveIntensity: 0.75,
	roughness: 0.8,
	side: THREE.DoubleSide,
	pulse: 0.4,
};

export interface MushroomShape {
	x: number;
	z: number;
	height: number;
	stemRadius: number;
	capRadius: number;
	capHeight: number;
	lean: number;
	heading: number;
	cap: MaterialOptions;
	spotted: boolean;
	ringed: boolean;
	segments?: number;
}

function stemProfile(shape: MushroomShape): [number, number][] {
	const { height, stemRadius } = shape;

	return [
		[stemRadius * 1.4, 0],
		[stemRadius * 1.2, height * 0.06],
		[stemRadius, height * 0.25],
		[stemRadius * 0.86, height * 0.7],
		[stemRadius * 0.92, height * 0.97],
		[0.001, height],
	];
}

function capProfile(shape: MushroomShape): [number, number][] {
	const { capRadius, capHeight } = shape;

	return [
		[capRadius * 0.9, -capHeight * 0.16],
		[capRadius, capHeight * 0.05],
		[capRadius * 0.97, capHeight * 0.3],
		[capRadius * 0.83, capHeight * 0.62],
		[capRadius * 0.56, capHeight * 0.88],
		[capRadius * 0.25, capHeight * 0.99],
		[0.001, capHeight],
	];
}

function gillProfile(shape: MushroomShape): [number, number][] {
	const { capRadius, capHeight, stemRadius } = shape;

	return [
		[stemRadius * 0.9, -capHeight * 0.02],
		[capRadius * 0.55, -capHeight * 0.1],
		[capRadius * 0.9, -capHeight * 0.16],
	];
}

function capSpots(shape: MushroomShape, rng: SeededRandom): Part[] {
	const spots: Part[] = [];
	const count = Math.round(5 + shape.capRadius * 18);

	for (let index = 0; index < count; index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const reach = Math.sqrt(rng.range(0.02, 0.75));
		const radius = shape.capRadius * reach;
		const lift = shape.capHeight * (1 - reach * reach) * 0.98;
		const size = shape.capRadius * rng.range(0.05, 0.1);

		spots.push(
			sphere(
				SPOT,
				size,
				Math.cos(angle) * radius,
				shape.height + lift,
				Math.sin(angle) * radius,
				1,
				0.35,
				1,
				6,
			),
		);
	}

	return spots;
}

function leaned(parts: Part[], shape: MushroomShape): Part[] {
	const matrix = new THREE.Matrix4()
		.makeTranslation(shape.x, 0, shape.z)
		.multiply(new THREE.Matrix4().makeRotationY(shape.heading))
		.multiply(new THREE.Matrix4().makeRotationX(shape.lean));

	for (const part of parts) {
		part.geometry.applyMatrix4(matrix);
	}

	return parts;
}

export function mushroom(shape: MushroomShape, rng: SeededRandom): Part[] {
	const segments = shape.segments ?? 22;

	const parts: Part[] = [
		lathe(MUSHROOM_STEM, stemProfile(shape), 0, 0, 0, Math.ceil(segments / 2)),
		lathe(shape.cap, capProfile(shape), 0, shape.height, 0, segments),
		lathe(MUSHROOM_GILLS, gillProfile(shape), 0, shape.height, 0, segments),
	];

	if (shape.ringed) {
		parts.push(
			torus(
				MUSHROOM_STEM,
				shape.stemRadius * 1.25,
				shape.stemRadius * 0.22,
				0,
				shape.height * 0.78,
				0,
			),
		);
	}

	if (shape.spotted) {
		parts.push(...capSpots(shape, rng));
	}

	return leaned(parts, shape);
}

export function smallMushroom(
	rng: SeededRandom,
	x: number,
	z: number,
	height: number,
	cap: MaterialOptions,
): Part[] {
	const capRadius = height * rng.range(0.35, 0.55);

	return mushroom(
		{
			x,
			z,
			height,
			stemRadius: Math.max(0.008, capRadius * 0.22),
			capRadius,
			capHeight: capRadius * rng.range(0.45, 0.7),
			lean: rng.range(-0.25, 0.25),
			heading: rng.range(0, Math.PI * 2),
			cap,
			spotted: false,
			ringed: false,
			segments: 9,
		},
		rng,
	);
}

function soilMound(
	rng: SeededRandom,
	radiusX: number,
	radiusZ: number,
	height: number,
): Part {
	const mound = pleated(
		MOSS,
		[
			[radiusX, 0],
			[radiusX * 0.8, height * 0.5],
			[radiusX * 0.42, height],
			[0.001, height],
		],
		{
			folds: rng.int(5, 8),
			depth: (t) => 0.18 * (1 - t),
			phase: rng.range(0, 6),
			segments: 28,
		},
		0,
		0,
		0,
	);

	mound.geometry.scale(1, 1, radiusZ / radiusX);

	return mound;
}

function glowingRoots(
	rng: SeededRandom,
	radius: number,
	count: number,
): Part[] {
	const roots: Part[] = [];

	for (let index = 0; index < count; index += 1) {
		const angle = (index / count) * Math.PI * 2 + rng.range(-0.3, 0.3);
		const reach = radius * rng.range(0.9, 1.6);
		const bend = rng.range(-0.5, 0.5);
		const path: Point[] = [];

		for (let step = 0; step <= 4; step += 1) {
			const t = step / 4;
			const heading = angle + bend * t * t;
			const distance = reach * (0.35 + t * 0.65);

			path.push([
				Math.cos(heading) * distance,
				0.012 + Math.sin(t * Math.PI) * 0.02,
				Math.sin(heading) * distance,
			]);
		}

		roots.push(
			bentTube(MYCELIUM_GLOW, path, (t) => 0.012 * (1 - t * 0.7), 8, 4),
		);
	}

	return roots;
}

function clusterAround(
	rng: SeededRandom,
	radius: number,
	count: number,
	maxHeight: number,
	cap: MaterialOptions,
): Part[] {
	const parts: Part[] = [];

	for (let index = 0; index < count; index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const distance = radius * rng.range(0.55, 1);

		parts.push(
			...smallMushroom(
				rng,
				Math.cos(angle) * distance,
				Math.sin(angle) * distance,
				maxHeight * rng.range(0.4, 1),
				cap,
			),
		);
	}

	return parts;
}

interface OrganicShape {
	x: number;
	z: number;
	height: number;
	stemRadius: number;
	capRadius: number;
	capHeight: number;
	lean: number;
	heading: number;
	cap: MaterialOptions;
	skirt: boolean;
	spots: boolean;
	drips: number;
}

function stemPath(
	shape: OrganicShape,
	rng: SeededRandom,
): THREE.CatmullRomCurve3 {
	const wobble = rng.range(-1, 1) * shape.stemRadius * 0.7;
	const turn = new THREE.Matrix4().makeRotationY(shape.heading);

	const points = [
		[0, 0, 0],
		[shape.lean * 0.12 + wobble * 0.3, shape.height * 0.32, wobble * 0.2],
		[shape.lean * 0.5 + wobble * 0.4, shape.height * 0.68, -wobble * 0.25],
		[shape.lean, shape.height, 0],
	].map(([x, y, z]) =>
		new THREE.Vector3(x, y, z)
			.applyMatrix4(turn)
			.add(new THREE.Vector3(shape.x, 0, shape.z)),
	);

	return new THREE.CatmullRomCurve3(points);
}

function placeOnStem(
	piece: Part,
	curve: THREE.CatmullRomCurve3,
	t: number,
	tilt: number,
	heading: number,
): Part {
	const point = curve.getPointAt(t);

	piece.geometry.applyMatrix4(
		new THREE.Matrix4()
			.makeTranslation(point.x, point.y, point.z)
			.multiply(new THREE.Matrix4().makeRotationY(heading))
			.multiply(new THREE.Matrix4().makeRotationZ(-tilt)),
	);

	return piece;
}

function organicMushroom(shape: OrganicShape, rng: SeededRandom): Part[] {
	const curve = stemPath(shape, rng);
	const tilt = Math.atan2(shape.lean, shape.height) * 0.8;
	const radius = shape.stemRadius;

	const path = curve
		.getPoints(6)
		.map((point): Point => [point.x, point.y, point.z]);

	const parts: Part[] = [
		bentTube(
			FLESH,
			path,
			(t) => radius * (0.82 + 0.2 * (1 - t) + 1.0 * Math.exp(-t * 9)),
			14,
			10,
		),
	];

	const capProfileShape = capProfile({
		...shape,
		spotted: false,
		ringed: false,
	});

	parts.push(
		placeOnStem(
			pleated(
				shape.cap,
				capProfileShape,
				{
					folds: rng.int(6, 9),
					depth: (t) => 0.08 * (1 - t) * (1 - t),
					phase: rng.range(0, 6),
					segments: 30,
				},
				0,
				0,
				0,
			),
			curve,
			1,
			tilt,
			shape.heading,
		),
		placeOnStem(
			lathe(
				GLOWING_GILLS,
				[
					[radius * 0.9, -shape.capHeight * 0.02],
					[shape.capRadius * 0.55, -shape.capHeight * 0.1],
					[shape.capRadius * 0.9, -shape.capHeight * 0.16],
				],
				0,
				0,
				0,
				30,
			),
			curve,
			1,
			tilt,
			shape.heading,
		),
	);

	if (shape.skirt) {
		parts.push(
			placeOnStem(
				pleated(
					SKIRT,
					[
						[radius * 1.02, 0],
						[radius * 1.7, -shape.height * 0.04],
						[radius * 2.2, -shape.height * 0.09],
					],
					{ folds: 11, depth: (t) => 0.14 * (1 - t), segments: 22 },
					0,
					0,
					0,
				),
				curve,
				0.74,
				tilt * 0.7,
				shape.heading,
			),
		);
	}

	if (shape.spots) {
		for (const spot of capSpots(
			{ ...shape, height: 0, x: 0, z: 0, spotted: true, ringed: false },
			rng,
		)) {
			parts.push(placeOnStem(spot, curve, 1, tilt, shape.heading));
		}
	}

	for (let index = 0; index < shape.drips; index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const reach = shape.capRadius * rng.range(0.75, 0.92);
		const drop = rng.range(0.02, 0.08);

		parts.push(
			placeOnStem(
				bead(
					DEW,
					rng.range(0.008, 0.014),
					Math.cos(angle) * reach,
					-shape.capHeight * 0.16 - drop,
					Math.sin(angle) * reach,
					1.4,
				),
				curve,
				1,
				tilt,
				shape.heading,
			),
		);
	}

	return parts;
}

export const giantMushroom: FurnitureBuilder = ({ item, rng }) => {
	const cap = rng.pick(GLOWING_CAPS);
	const footprint = Math.min(item.width, item.depth) / 2;

	const parts: Part[] = [
		soilMound(rng, footprint * 0.95, footprint * 0.85, 0.14),
		...glowingRoots(rng, footprint, rng.int(6, 9)),
	];

	if (item.variant === 0) {
		const capRadius = footprint * 1.18;
		const capHeight = capRadius * 0.6;

		parts.push(
			...organicMushroom(
				{
					x: 0,
					z: 0,
					height: item.height - capHeight,
					stemRadius: capRadius * 0.23,
					capRadius,
					capHeight,
					lean: rng.range(0.18, 0.32) * (rng.chance(0.5) ? 1 : -1),
					heading: rng.range(0, Math.PI * 2),
					cap,
					skirt: true,
					spots: true,
					drips: rng.int(3, 6),
				},
				rng,
			),
			...clusterAround(rng, footprint * 0.78, rng.int(4, 6), 0.32, cap),
		);

		return parts;
	}

	const stems = [
		{ x: -0.25, z: 0.1, scale: 1 },
		{ x: 0.35, z: -0.15, scale: 0.74 },
		{ x: 0.05, z: 0.38, scale: 0.55 },
	];

	for (const stem of stems) {
		const capRadius = footprint * 0.72 * stem.scale;
		const capHeight = capRadius * 0.62;

		parts.push(
			...organicMushroom(
				{
					x: stem.x * item.width,
					z: stem.z * item.depth,
					height: (item.height - capHeight) * stem.scale,
					stemRadius: capRadius * 0.2,
					capRadius,
					capHeight,
					lean: rng.range(0.08, 0.28) * capRadius * 2,
					heading: Math.atan2(stem.z, stem.x) + rng.range(-0.4, 0.4),
					cap,
					skirt: stem.scale > 0.7,
					spots: rng.chance(0.5),
					drips: rng.int(1, 3),
				},
				rng,
			),
		);
	}

	parts.push(...clusterAround(rng, footprint * 0.85, rng.int(4, 7), 0.28, cap));

	return parts;
};

function bellMushroom(
	rng: SeededRandom,
	x: number,
	z: number,
	height: number,
	cap: MaterialOptions,
): Part[] {
	const lean = rng.range(-0.25, 0.25);
	const heading = rng.range(0, Math.PI * 2);

	const top: Point = [
		x + Math.cos(heading) * lean * height,
		height,
		z + Math.sin(heading) * lean * height,
	];

	const bell = height * rng.range(0.22, 0.3);

	return [
		bentTube(
			FLESH,
			[
				[x, 0, z],
				[x + (top[0] - x) * 0.4, height * 0.5, z + (top[2] - z) * 0.4],
				top,
			],
			(t) => 0.006 * (1.2 - t * 0.4),
			6,
			4,
		),
		lathe(
			cap,
			[
				[bell * 0.62, -bell * 0.15],
				[bell * 0.55, bell * 0.3],
				[bell * 0.32, bell * 0.8],
				[0.001, bell],
			],
			top[0],
			top[1] - bell * 0.1,
			top[2],
			8,
		),
	];
}

export const mushroomPatch: FurnitureBuilder = ({ item, rng }) => {
	const glowing = rng.chance(0.65);
	const cap = glowing ? rng.pick(GLOWING_CAPS) : rng.pick(EARTHY_CAPS);
	const parts: Part[] = [soilMound(rng, item.width / 2, item.depth / 2, 0.035)];
	const count = rng.int(6, 10);

	for (let index = 0; index < count; index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const reach = Math.sqrt(rng.range(0, 1)) * 0.75;
		const x = Math.cos(angle) * reach * (item.width / 2);
		const z = Math.sin(angle) * reach * (item.depth / 2);
		const height = item.height * rng.range(0.35, 0.95);

		parts.push(
			...(glowing && rng.chance(0.5)
				? bellMushroom(rng, x, z, height, cap)
				: smallMushroom(rng, x, z, height, cap)),
		);
	}

	for (let index = 0; index < rng.int(2, 5); index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const reach = rng.range(0.2, 0.7);

		parts.push(
			sphere(
				FLESH,
				rng.range(0.012, 0.022),
				Math.cos(angle) * reach * (item.width / 2),
				0.025,
				Math.sin(angle) * reach * (item.depth / 2),
				1,
				0.8,
				1,
				8,
			),
		);
	}

	if (glowing) {
		parts.push(
			...glowingRoots(rng, Math.min(item.width, item.depth) * 0.35, 3),
		);
	}

	return parts;
};

export const mushroomRing: FurnitureBuilder = ({ item, rng }) => {
	const radius = Math.min(item.width, item.depth) / 2 - 0.2;

	const ring = lathe(
		{ ...MOSS, color: 0x5a8a44 },
		[
			[radius + 0.3, 0],
			[radius, 0.02],
			[radius - 0.3, 0],
		],
		0,
		0.002,
		0,
		40,
	);

	const parts: Part[] = [ring];
	const cap = rng.pick(GLOWING_CAPS);
	const count = Math.round(radius * 11);

	for (let index = 0; index < count; index += 1) {
		const angle = (index / count) * Math.PI * 2 + rng.range(-0.08, 0.08);
		const distance = radius + rng.range(-0.14, 0.14);

		parts.push(
			...smallMushroom(
				rng,
				Math.cos(angle) * distance,
				Math.sin(angle) * distance,
				item.height * rng.range(0.55, 1),
				cap,
			),
		);

		if (rng.chance(0.45)) {
			parts.push(
				sphere(
					GLOW_DOT,
					0.02,
					Math.cos(angle + 0.12) * radius,
					rng.range(0.3, 0.8),
					Math.sin(angle + 0.12) * radius,
					1,
					1,
					1,
					6,
				),
			);
		}
	}

	return parts;
};

export const mushroomBed: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, depth, height } = item;
	const trayHeight = 0.24;
	const trayBottom = height - 0.38;
	const parts: Part[] = [];

	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			parts.push(
				box(
					wood,
					0.06,
					trayBottom,
					0.06,
					sx * (width / 2 - 0.05),
					0,
					sz * (depth / 2 - 0.05),
				),
			);
		}
	}

	parts.push(
		box(wood, width, 0.03, depth, 0, trayBottom, 0),
		box(wood, width, trayHeight, 0.03, 0, trayBottom, depth / 2 - 0.015),
		box(wood, width, trayHeight, 0.03, 0, trayBottom, -depth / 2 + 0.015),
		box(wood, 0.03, trayHeight, depth, width / 2 - 0.015, trayBottom, 0),
		box(wood, 0.03, trayHeight, depth, -width / 2 + 0.015, trayBottom, 0),
		box(SOIL, width - 0.06, trayHeight - 0.05, depth - 0.06, 0, trayBottom, 0),
	);

	const soilTop = trayBottom + trayHeight - 0.05;
	const cap = rng.pick(EARTHY_CAPS);
	const count = Math.round(width * depth * 9);

	for (let index = 0; index < count; index += 1) {
		const mushrooms = smallMushroom(
			rng,
			rng.range(-width / 2 + 0.1, width / 2 - 0.1),
			rng.range(-depth / 2 + 0.1, depth / 2 - 0.1),
			rng.range(0.08, 0.2),
			cap,
		);

		for (const part of mushrooms) {
			part.geometry.translate(0, soilTop, 0);
		}

		parts.push(...mushrooms);
	}

	return parts;
};

export const bracketFungus: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [];
	const cap = rng.pick(BRACKET_CAPS);
	const rim = { ...cap, color: 0xf0e6cc };
	const shelves = rng.int(3, 6);

	for (let index = 0; index < shelves; index += 1) {
		const radius = rng.range(0.08, Math.min(0.2, item.width / 4));
		const x = rng.range(-item.width / 2 + radius, item.width / 2 - radius);
		const y = rng.range(radius * 0.4, item.height - radius * 0.4);

		parts.push(
			sphere(cap, radius, x, y, 0, 1, 0.17, item.depth / radius, 16),
			sphere(
				rim,
				radius * 1.04,
				x,
				y - radius * 0.03,
				0,
				1,
				0.07,
				(item.depth * 1.04) / radius,
				16,
			),
			sphere(
				MUSHROOM_GILLS,
				radius * 0.94,
				x,
				y - radius * 0.06,
				0,
				1,
				0.12,
				(item.depth * 0.94) / radius,
				16,
			),
		);
	}

	return parts;
};

export const sporeSac: FurnitureBuilder = ({ item, rng }) => {
	const sacRadius = Math.min(item.width, item.depth) / 2 - 0.05;
	const sacY = sacRadius * 1.3;

	const membrane: MaterialOptions = {
		color: 0xb8ff7a,
		emissive: 0x6ad83a,
		emissiveIntensity: 0.7,
		transparent: true,
		opacity: 0.55,
		roughness: 0.3,
		depthWrite: false,
	};

	const parts: Part[] = [
		cylinder(
			MUSHROOM_STEM,
			0.025,
			0.04,
			item.height - sacY * 1.6,
			0,
			sacY * 1.6,
			0,
			6,
		),
		sphere(membrane, sacRadius, 0, sacY, 0, 1, 1.3, 1, 18),
		sphere(GLOW_DOT, sacRadius * 0.45, 0, sacY, 0, 1, 1.2, 1, 10),
	];

	const filaments = rng.int(3, 6);

	for (let index = 0; index < filaments; index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const length = rng.range(0.12, 0.3);

		parts.push(
			cylinder(
				MUSHROOM_STEM,
				0.006,
				0.003,
				length,
				Math.cos(angle) * sacRadius * 0.4,
				sacY - sacRadius * 1.2 - length,
				Math.sin(angle) * sacRadius * 0.4,
				4,
			),
		);
	}

	return parts;
};

export const fungusJar: FurnitureBuilder = ({ item, rng }) => {
	const radius = item.width / 2 - 0.01;
	const cap = rng.pick(GLOWING_CAPS);

	const parts: Part[] = [
		cylinder(SOIL, radius * 0.92, radius * 0.92, 0.05, 0, 0.005, 0, 12),
		cylinder(GLASS, radius, radius, item.height - 0.05, 0, 0, 0, 16),
		cylinder(
			{ texture: "woodLight", roughness: 0.9 },
			radius * 0.8,
			radius * 0.85,
			0.05,
			0,
			item.height - 0.05,
			0,
			12,
		),
	];

	const mushrooms = mushroom(
		{
			x: 0,
			z: 0,
			height: item.height * 0.42,
			stemRadius: radius * 0.14,
			capRadius: radius * 0.62,
			capHeight: radius * 0.4,
			lean: 0,
			heading: 0,
			cap,
			spotted: false,
			ringed: false,
			segments: 10,
		},
		rng,
	);

	for (const part of mushrooms) {
		part.geometry.translate(0, 0.05, 0);
	}

	parts.push(...mushrooms);

	return parts;
};

function veinBranch(
	rng: SeededRandom,
	parts: Part[],
	from: THREE.Vector3,
	angle: number,
	length: number,
	thickness: number,
	depth: number,
	width: number,
	height: number,
): void {
	const steps = 4;
	const path: Point[] = [[from.x, from.y, from.z]];
	const point = from.clone();
	let heading = angle;

	for (let step = 0; step < steps; step += 1) {
		heading += rng.range(-0.35, 0.35);

		point.x = Math.max(
			-width / 2,
			Math.min(width / 2, point.x + Math.sin(heading) * (length / steps)),
		);

		point.y = Math.max(
			0.01,
			Math.min(height, point.y + Math.cos(heading) * (length / steps)),
		);

		point.z = 0.01 + rng.range(0, 0.012);

		path.push([point.x, point.y, point.z]);
	}

	parts.push(
		bentTube(MYCELIUM_GLOW, path, (t) => thickness * (1 - t * 0.6), 6, 3),
	);

	if (depth <= 0) {
		parts.push(bead(DEW, thickness * 1.6, point.x, point.y, point.z + 0.005));

		return;
	}

	parts.push(bead(GLOW_DOT, thickness * 1.3, point.x, point.y, point.z));

	for (const turn of [-0.6, 0.55]) {
		veinBranch(
			rng,
			parts,
			point.clone(),
			heading + turn + rng.range(-0.2, 0.2),
			length * rng.range(0.55, 0.75),
			thickness * 0.68,
			depth - 1,
			width,
			height,
		);
	}
}

export const myceliumVeins: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [];
	const roots = rng.int(2, 4);

	for (let index = 0; index < roots; index += 1) {
		const x = (index / Math.max(1, roots - 1) - 0.5) * item.width * 0.6;
		const start = new THREE.Vector3(x + rng.range(-0.1, 0.1), 0.02, 0.012);

		veinBranch(
			rng,
			parts,
			start,
			rng.range(-0.4, 0.4),
			item.height * rng.range(0.35, 0.5),
			0.011,
			2,
			item.width,
			item.height,
		);

		parts.push(
			sphere(
				MOSS,
				rng.range(0.06, 0.1),
				start.x,
				0.02,
				0.01,
				1.4,
				0.5,
				0.35,
				10,
			),
		);
	}

	const cap = rng.pick(GLOWING_CAPS);

	for (let index = 0; index < rng.int(2, 4); index += 1) {
		parts.push(
			...smallMushroom(
				rng,
				rng.range(-item.width / 3, item.width / 3),
				item.depth * 0.5,
				rng.range(0.05, 0.1),
				cap,
			),
		);
	}

	return parts;
};

export const hangingMycelium: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [];
	const strands = rng.int(10, 16);
	const top = item.height;

	parts.push(
		sphere(
			MOSS,
			Math.min(item.width, item.depth) * 0.32,
			0,
			top - 0.02,
			0,
			1,
			0.22,
			1,
			14,
		),
		sphere(
			MYCELIUM_GLOW,
			Math.min(item.width, item.depth) * 0.22,
			0,
			top - 0.04,
			0,
			1,
			0.3,
			1,
			12,
		),
	);

	for (let index = 0; index < strands; index += 1) {
		const angle = rng.range(0, Math.PI * 2);

		const reach =
			Math.sqrt(rng.range(0, 1)) * Math.min(item.width, item.depth) * 0.4;

		const x = Math.cos(angle) * reach;
		const z = Math.sin(angle) * reach;
		const length = item.height * rng.range(0.35, 0.95);
		const sway = rng.range(-0.06, 0.06);

		const path: Point[] = [
			[x, top, z],
			[x + sway * 0.4, top - length * 0.5, z - sway * 0.3],
			[x + sway, top - length, z + sway * 0.5],
		];

		parts.push(
			bentTube(MYCELIUM_GLOW, path, (t) => 0.004 * (1 - t * 0.5), 6, 3),
		);

		for (let drop = 1; drop <= rng.int(1, 3); drop += 1) {
			const t = rng.range(0.3, 0.85);

			parts.push(
				bead(
					DEW,
					rng.range(0.006, 0.011),
					x + sway * t,
					top - length * t,
					z + sway * t * 0.4,
					1.3,
				),
			);
		}

		parts.push(
			bead(
				DEW,
				rng.range(0.012, 0.018),
				x + sway,
				top - length - 0.01,
				z + sway * 0.5,
				1.5,
			),
		);
	}

	return parts;
};

export const wallMushrooms: FurnitureBuilder = ({ item, rng }) => {
	const cap = rng.pick(GLOWING_CAPS);

	const parts: Part[] = [
		sphere(
			MOSS,
			item.width * 0.42,
			0,
			item.height * 0.4,
			0,
			1,
			0.75,
			(item.depth * 0.6) / (item.width * 0.42),
			14,
		),
	];

	const count = rng.int(4, 7);

	for (let index = 0; index < count; index += 1) {
		const x = rng.range(-item.width * 0.36, item.width * 0.36);
		const y = rng.range(item.height * 0.1, item.height * 0.6);
		const reach = item.depth * rng.range(0.45, 0.9);
		const rise = rng.range(0.06, 0.18);
		const tip: Point = [x + rng.range(-0.04, 0.04), y + rise, reach];
		const capRadius = rng.range(0.035, 0.07);

		parts.push(
			bentTube(
				FLESH,
				[[x, y, 0.01], [x, y + rise * 0.25, reach * 0.6], tip],
				(t) => capRadius * 0.24 * (1.3 - t * 0.4),
				8,
				5,
			),
			lathe(
				cap,
				[
					[capRadius, -capRadius * 0.12],
					[capRadius * 0.95, capRadius * 0.2],
					[capRadius * 0.6, capRadius * 0.5],
					[0.001, capRadius * 0.6],
				],
				tip[0],
				tip[1],
				tip[2],
				12,
			),
			lathe(
				GLOWING_GILLS,
				[
					[capRadius * 0.2, -capRadius * 0.02],
					[capRadius * 0.9, -capRadius * 0.12],
				],
				tip[0],
				tip[1],
				tip[2],
				12,
			),
		);
	}

	return parts;
};

export const mossCarpet: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [
		soilMound(rng, item.width / 2, item.depth / 2, item.height * 0.6),
	];

	const cap = rng.pick(GLOWING_CAPS);

	for (let index = 0; index < rng.int(6, 12); index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const reach = Math.sqrt(rng.range(0.05, 1)) * 0.7;

		parts.push(
			...bellMushroom(
				rng,
				Math.cos(angle) * reach * (item.width / 2),
				Math.sin(angle) * reach * (item.depth / 2),
				rng.range(0.04, 0.09),
				cap,
			),
		);
	}

	for (let index = 0; index < rng.int(8, 14); index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const reach = Math.sqrt(rng.range(0, 1)) * 0.8;

		parts.push(
			bead(
				GLOW_DOT,
				rng.range(0.004, 0.008),
				Math.cos(angle) * reach * (item.width / 2),
				item.height * 0.65,
				Math.sin(angle) * reach * (item.depth / 2),
			),
		);
	}

	parts.push(...glowingRoots(rng, Math.min(item.width, item.depth) * 0.4, 4));

	return parts;
};
