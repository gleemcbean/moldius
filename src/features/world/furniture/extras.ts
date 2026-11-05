import * as THREE from "three";
import { meterTorus, placed } from "../geometryUtils";
import type { MaterialOptions } from "../MaterialLibrary";
import {
	BRASS,
	box,
	boxAt,
	CERAMIC,
	COPPER,
	candle,
	cylinder,
	cylinderBetween,
	DARK,
	type FurnitureBuilder,
	GLASS,
	IRON,
	LINEN,
	lathe,
	MARBLE,
	type Part,
	part,
	pickWood,
	plane,
	STONE,
	sphere,
	texturedPlane,
	torus,
} from "./parts";

const VELVETS = ["velvetRed", "velvetGreen", "velvetBlue"] as const;
const PAINTINGS = [
	"paintingPortrait",
	"paintingLandscape",
	"paintingStorm",
	"paintingStillLife",
] as const;
const WICKER: MaterialOptions = { texture: "wicker", roughness: 0.95 };
const BURLAP: MaterialOptions = { texture: "burlap", roughness: 1 };
const PAPER: MaterialOptions = { texture: "paper", roughness: 0.95 };
const LEATHER: MaterialOptions = { texture: "leather", roughness: 0.8 };
const BARK: MaterialOptions = { texture: "bark", roughness: 1 };
const PEWTER: MaterialOptions = {
	color: 0x8d8f8a,
	roughness: 0.45,
	metalness: 0.6,
};
const FEATHERS: MaterialOptions = { color: 0x15151a, roughness: 0.9 };
const BONE: MaterialOptions = { texture: "bone", roughness: 0.8 };
const MOSS: MaterialOptions = { color: 0x3f5a2c, roughness: 1 };
const WATER: MaterialOptions = {
	texture: "pondWater",
	roughness: 0.15,
	transparent: true,
	opacity: 0.85,
};

function v(x: number, y: number, z: number): THREE.Vector3 {
	return new THREE.Vector3(x, y, z);
}

function velvet(rng: { pick<T>(items: readonly T[]): T }): MaterialOptions {
	return { texture: rng.pick(VELVETS), roughness: 1 };
}

function legs(
	material: MaterialOptions,
	width: number,
	depth: number,
	height: number,
	radius = 0.022,
	inset = 0.04,
): Part[] {
	const parts: Part[] = [];
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			parts.push(
				cylinder(
					material,
					radius,
					radius * 0.8,
					height,
					sx * (width / 2 - inset),
					0,
					sz * (depth / 2 - inset),
					8,
				),
			);
		}
	}
	return parts;
}

function rocker(
	material: MaterialOptions,
	radius: number,
	sweep: number,
	x: number,
	y: number,
): Part {
	const geometry = meterTorus(radius, 0.02, 6, 18, sweep);
	geometry.rotateZ(-Math.PI / 2 - sweep / 2);
	geometry.rotateY(Math.PI / 2);
	return part(placed(geometry, x, y, 0), material);
}

function faceForward(piece: Part, y: number, z: number): Part {
	piece.geometry.translate(0, -y, -z);
	piece.geometry.rotateX(Math.PI / 2);
	piece.geometry.translate(0, y, z);
	return piece;
}

export const umbrellaStand: FurnitureBuilder = ({ item, rng }) => {
	const radius = item.width / 2 - 0.03;
	const parts: Part[] = [
		lathe(
			rng.chance(0.5) ? CERAMIC : COPPER,
			[
				[0.001, 0],
				[radius, 0],
				[radius * 0.92, item.height * 0.5],
				[radius, item.height * 0.62],
				[radius * 0.96, item.height * 0.65],
				[radius * 0.84, item.height * 0.65],
				[radius * 0.86, item.height * 0.6],
				[radius * 0.8, item.height * 0.5],
				[radius * 0.88, 0.03],
				[0.001, 0.03],
			],
			0,
			0,
			0,
			16,
		),
	];
	for (let index = 0; index < rng.int(1, 3); index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const top = v(
			Math.cos(angle) * 0.08,
			item.height + 0.25,
			Math.sin(angle) * 0.08,
		);
		parts.push(
			cylinderBetween(DARK, v(0, 0.05, 0), top, 0.012, 6),
			torus(DARK, 0.04, 0.008, top.x + 0.04, top.y, top.z, 0, 0, Math.PI),
		);
	}
	return parts;
};

export const stool: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const seat = item.height;
	const parts: Part[] = [
		cylinder(
			wood,
			item.width / 2,
			item.width / 2 - 0.02,
			0.05,
			0,
			seat - 0.05,
			0,
			16,
		),
	];
	for (let index = 0; index < 3; index += 1) {
		const angle = (index / 3) * Math.PI * 2;
		parts.push(
			cylinderBetween(
				wood,
				v(Math.cos(angle) * 0.1, seat - 0.05, Math.sin(angle) * 0.1),
				v(
					Math.cos(angle) * (item.width / 2 - 0.02),
					0,
					Math.sin(angle) * (item.width / 2 - 0.02),
				),
				0.02,
				6,
			),
		);
	}
	parts.push(torus(wood, item.width / 2 - 0.08, 0.012, 0, seat * 0.35, 0));
	return parts;
};

export const sideTable: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const top = item.height;
	return [
		cylinder(wood, item.width / 2, item.width / 2, 0.04, 0, top - 0.04, 0, 20),
		lathe(
			wood,
			[
				[0.03, 0.1],
				[0.05, 0.25],
				[0.025, 0.45],
				[0.045, top - 0.06],
				[0.03, top - 0.04],
			],
			0,
			0,
			0,
			10,
		),
		...[0, 1, 2].map((index) => {
			const angle = (index / 3) * Math.PI * 2;
			return cylinderBetween(
				wood,
				v(0, 0.12, 0),
				v(Math.cos(angle) * 0.22, 0.01, Math.sin(angle) * 0.22),
				0.02,
				6,
			);
		}),
	];
};

export const screen: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const cloth: MaterialOptions = {
		texture: rng.pick(["tapestry", "linen", "velvetRed"] as const),
		roughness: 1,
		side: THREE.DoubleSide,
	};
	const panels = 3;
	const panelWidth = item.width / panels;
	const parts: Part[] = [];
	for (let index = 0; index < panels; index += 1) {
		const angle = index === 1 ? 0 : index === 0 ? 0.45 : -0.45;
		const center = (index - 1) * panelWidth * 0.92;
		const z = index === 1 ? 0 : -0.1;
		const group: Part[] = [
			plane(
				cloth,
				panelWidth - 0.06,
				item.height - 0.2,
				0,
				item.height / 2 + 0.04,
				0,
			),
			boxAt(
				wood,
				0.035,
				item.height,
				0.035,
				-panelWidth / 2 + 0.02,
				item.height / 2,
				0,
			),
			boxAt(
				wood,
				0.035,
				item.height,
				0.035,
				panelWidth / 2 - 0.02,
				item.height / 2,
				0,
			),
			boxAt(wood, panelWidth, 0.04, 0.035, 0, item.height - 0.04, 0),
			boxAt(wood, panelWidth, 0.04, 0.035, 0, 0.12, 0),
		];
		const matrix = new THREE.Matrix4().compose(
			v(center, 0, z),
			new THREE.Quaternion().setFromAxisAngle(v(0, 1, 0), angle),
			v(1, 1, 1),
		);
		for (const piece of group) {
			piece.geometry.applyMatrix4(matrix);
			parts.push(piece);
		}
	}
	return parts;
};

export const torchere: FurnitureBuilder = ({ item }) => {
	const top = item.height - 0.25;
	return [
		lathe(
			IRON,
			[
				[0.001, 0],
				[0.17, 0],
				[0.15, 0.03],
				[0.04, 0.1],
				[0.025, top],
				[0.1, top + 0.03],
				[0.11, top + 0.06],
				[0.001, top + 0.05],
			],
			0,
			0,
			0,
			12,
		),
		...[0, 1, 2].map((index) => {
			const angle = (index / 3) * Math.PI * 2;
			return cylinderBetween(
				IRON,
				v(0, 0.35, 0),
				v(Math.cos(angle) * 0.16, 0.01, Math.sin(angle) * 0.16),
				0.012,
				6,
			);
		}),
		...candle(0, top + 0.05, 0, 0.14, 0.035),
	];
};

export const harpsichord: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, depth, height } = item;
	const body = 0.28;
	const parts: Part[] = [
		box(
			wood,
			width,
			body,
			depth * 0.55,
			0,
			height - body - 0.15,
			-depth * 0.2,
			0,
			0.02,
		),
		box(
			wood,
			width * 0.55,
			body,
			depth * 0.4,
			width * 0.2,
			height - body - 0.15,
			depth * 0.25,
			0,
			0.02,
		),
		box(
			{ color: 0xe8dcc0, roughness: 0.4 },
			width * 0.4,
			0.03,
			0.14,
			-width * 0.25,
			height - 0.18,
			depth / 2 - 0.12,
		),
		box(
			DARK,
			width * 0.4,
			0.012,
			0.06,
			-width * 0.25,
			height - 0.15,
			depth / 2 - 0.16,
		),
		boxAt(
			wood,
			width * 0.95,
			0.5,
			0.02,
			0,
			height + 0.05,
			-depth / 2 + 0.06,
			-0.35,
		),
		texturedPlane(
			{ texture: "paintingLandscape", roughness: 0.8 },
			width * 0.85,
			0.42,
			0,
			height + 0.05,
			-depth / 2 + 0.075,
			0,
			-0.35,
		),
	];
	parts.push(
		...legs(wood, width, depth * 0.85, height - body - 0.15, 0.03, 0.08),
	);
	return parts;
};

export const chaiseLongue: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const fabric = velvet(rng);
	const { width, depth } = item;
	const seat = 0.42;
	return [
		box(fabric, width, 0.16, depth, 0, seat - 0.16, 0, 0, 0.04),
		boxAt(
			fabric,
			0.22,
			0.5,
			depth,
			-width / 2 + 0.11,
			seat + 0.18,
			0,
			0,
			0,
			-0.35,
		),
		box(
			fabric,
			width * 0.6,
			0.32,
			0.14,
			-width * 0.15,
			seat,
			-depth / 2 + 0.07,
			0,
			0.05,
		),
		sphere(fabric, 0.11, -width / 2 + 0.28, seat + 0.1, 0, 1.4, 0.8, 0.9, 10),
		...legs(wood, width, depth, seat - 0.16, 0.025, 0.06),
	];
};

export const rockingChair: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, depth, height } = item;
	const seat = 0.45;
	const parts: Part[] = [
		box(wood, width - 0.06, 0.04, depth * 0.6, 0, seat, 0.05),
		boxAt(
			wood,
			width - 0.08,
			height - seat - 0.05,
			0.03,
			0,
			(height + seat) / 2,
			-depth * 0.25,
			-0.18,
		),
	];
	for (const side of [-1, 1]) {
		const x = side * (width / 2 - 0.04);
		parts.push(
			rocker(wood, depth * 0.9, 0.75, x, depth * 0.9 + 0.02),
			cylinderBetween(
				wood,
				v(x, 0.06, depth * 0.3),
				v(x, seat, depth * 0.3),
				0.02,
				6,
			),
			cylinderBetween(
				wood,
				v(x, 0.06, -depth * 0.25),
				v(x, height, -depth * 0.38),
				0.022,
				6,
			),
			cylinderBetween(
				wood,
				v(x, seat + 0.22, depth * 0.3),
				v(x, seat + 0.22, -depth * 0.25),
				0.018,
				6,
			),
		);
	}
	for (let index = -2; index <= 2; index += 1) {
		parts.push(
			cylinderBetween(
				wood,
				v(index * 0.09, seat + 0.05, -depth * 0.22),
				v(index * 0.09, height - 0.08, -depth * 0.35),
				0.01,
				5,
			),
		);
	}
	return parts;
};

export const ottoman: FurnitureBuilder = ({ item, rng }) => {
	const fabric = velvet(rng);
	return [
		cylinder(
			fabric,
			item.width / 2,
			item.width / 2 - 0.02,
			item.height - 0.06,
			0,
			0.06,
			0,
			18,
		),
		sphere(
			fabric,
			item.width / 2 - 0.02,
			0,
			item.height - 0.02,
			0,
			1,
			0.12,
			1,
			18,
		),
		sphere(BRASS, 0.025, 0, item.height + 0.035, 0, 1, 0.6, 1, 8),
		...legs(
			{ texture: "woodDark", roughness: 0.8 },
			item.width * 0.8,
			item.width * 0.8,
			0.07,
			0.02,
			0.02,
		),
	];
};

export const timpani: FurnitureBuilder = ({ item }) => {
	const radius = item.width / 2 - 0.04;
	const top = item.height - 0.08;
	return [
		lathe(
			COPPER,
			[
				[0.05, top * 0.45],
				[radius * 0.6, top * 0.55],
				[radius, top * 0.85],
				[radius + 0.01, top],
			],
			0,
			0,
			0,
			20,
		),
		cylinder(
			{ color: 0xd8ccb0, roughness: 0.9 },
			radius,
			radius,
			0.01,
			0,
			top,
			0,
			24,
		),
		torus(IRON, radius + 0.01, 0.012, 0, top + 0.005, 0),
		...[0, 1, 2].map((index) => {
			const angle = (index / 3) * Math.PI * 2;
			return cylinderBetween(
				IRON,
				v(0, top * 0.5, 0),
				v(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
				0.014,
				6,
			);
		}),
		cylinderBetween(
			DARK,
			v(radius * 0.5, top + 0.02, 0.05),
			v(radius * 0.2, top + 0.02, 0.3),
			0.01,
			5,
		),
		sphere(LINEN, 0.025, radius * 0.5, top + 0.02, 0.05),
	];
};

export const easel: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	return [
		cylinderBetween(
			wood,
			v(-width * 0.4, 0, depth * 0.12),
			v(0, height, -0.03),
			0.02,
			6,
		),
		cylinderBetween(
			wood,
			v(width * 0.4, 0, depth * 0.12),
			v(0, height, -0.03),
			0.02,
			6,
		),
		cylinderBetween(
			wood,
			v(0, 0, -depth * 0.5),
			v(0, height * 0.95, -0.02),
			0.018,
			6,
		),
		boxAt(wood, width * 0.85, 0.04, 0.08, 0, height * 0.42, depth * 0.17),
		boxAt(
			{ color: 0xe8dfca, roughness: 0.9 },
			width * 0.7,
			height * 0.4,
			0.025,
			0,
			height * 0.64,
			depth * 0.12,
			-0.15,
		),
		texturedPlane(
			{ texture: rng.pick(PAINTINGS), roughness: 0.85 },
			width * 0.62,
			height * 0.34,
			0,
			height * 0.64,
			depth * 0.12 + 0.016,
			0,
			-0.15,
		),
	];
};

export const bust: FurnitureBuilder = ({ item, rng }) => {
	const material = rng.chance(0.5) ? MARBLE : STONE;
	const plinth = item.height - 0.55;
	return [
		box(material, item.width, 0.08, item.width, 0, 0, 0),
		cylinder(
			material,
			item.width * 0.32,
			item.width * 0.36,
			plinth - 0.16,
			0,
			0.08,
			0,
			14,
		),
		box(material, item.width, 0.08, item.width, 0, plinth - 0.08, 0),
		lathe(
			material,
			[
				[0.001, 0],
				[0.17, 0],
				[0.2, 0.08],
				[0.19, 0.2],
				[0.07, 0.28],
				[0.001, 0.29],
			],
			0,
			plinth,
			0,
			14,
		),
		cylinder(material, 0.055, 0.065, 0.08, 0, plinth + 0.26, 0, 10),
		sphere(material, 0.11, 0, plinth + 0.43, 0.01, 0.9, 1.15, 1, 14),
		sphere(material, 0.03, 0, plinth + 0.42, 0.11, 0.8, 1, 0.9, 6),
	];
};

export const urn: FurnitureBuilder = ({ item, rng }) => {
	const material = rng.pick([STONE, MARBLE, BRASS, CERAMIC]);
	const r = item.width / 2;
	const h = item.height;
	return [
		lathe(
			material,
			[
				[0.001, 0],
				[r * 0.6, 0],
				[r * 0.4, h * 0.12],
				[r * 0.95, h * 0.45],
				[r * 0.75, h * 0.75],
				[r * 0.45, h * 0.82],
				[r * 0.6, h * 0.9],
				[r * 0.45, h * 0.94],
				[0.001, h],
			],
			0,
			0,
			0,
			18,
		),
		torus(material, r * 0.3, 0.02, r * 0.75, h * 0.7, 0, 0, Math.PI / 2),
		torus(material, r * 0.3, 0.02, -r * 0.75, h * 0.7, 0, 0, Math.PI / 2),
	];
};

export const birdbath: FurnitureBuilder = ({ item }) => {
	const r = item.width / 2;
	const h = item.height;
	return [
		lathe(
			STONE,
			[
				[0.001, 0],
				[r * 0.55, 0],
				[r * 0.5, 0.06],
				[r * 0.2, 0.12],
				[r * 0.15, h - 0.2],
				[r * 0.3, h - 0.14],
				[r, h - 0.04],
				[r * 0.96, h],
				[r * 0.85, h - 0.05],
				[0.001, h - 0.1],
			],
			0,
			0,
			0,
			20,
		),
		cylinder(WATER, r * 0.84, r * 0.84, 0.005, 0, h - 0.045, 0, 20),
		sphere(MOSS, r * 0.3, r * 0.3, 0.1, 0.05, 1, 0.3, 1, 8),
	];
};

export const gardenLantern: FurnitureBuilder = ({ item }) => {
	const h = item.height;
	return [
		box(STONE, item.width, 0.1, item.width, 0, 0, 0),
		cylinder(STONE, 0.06, 0.08, h - 0.55, 0, 0.1, 0, 10),
		box(STONE, item.width * 0.85, 0.06, item.width * 0.85, 0, h - 0.45, 0),
		box(GLASS, item.width * 0.6, 0.25, item.width * 0.6, 0, h - 0.39, 0),
		...[-1, 1].flatMap((sx) =>
			[-1, 1].map((sz) =>
				box(
					STONE,
					0.04,
					0.25,
					0.04,
					sx * item.width * 0.3,
					h - 0.39,
					sz * item.width * 0.3,
				),
			),
		),
		lathe(
			STONE,
			[
				[0.001, 0.17],
				[item.width * 0.6, 0.02],
				[item.width * 0.55, 0],
				[0.001, 0],
			],
			0,
			h - 0.14,
			0,
			4,
		),
		...candle(0, h - 0.39, 0, 0.1, 0.03),
	];
};

export const logBasket: FurnitureBuilder = ({ item, rng }) => {
	const { width, depth, height } = item;
	const parts: Part[] = [
		box(WICKER, width, height * 0.65, depth, 0, 0, 0, 0, 0.04),
	];
	for (let index = 0; index < 5; index += 1) {
		const y = height * 0.6 + (index % 2) * 0.07;
		const x = rng.range(-width * 0.3, width * 0.3);
		parts.push(
			cylinderBetween(
				BARK,
				v(x - 0.05, y, -depth / 2 + 0.04),
				v(x + 0.05, y + rng.range(-0.03, 0.03), depth / 2 - 0.04),
				rng.range(0.04, 0.06),
				7,
			),
		);
	}
	parts.push(
		torus(WICKER, width * 0.3, 0.012, 0, height * 0.65, 0, 0, 0, Math.PI),
	);
	return parts;
};

export const grainSacks: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [];
	const count = rng.int(2, 3);
	for (let index = 0; index < count; index += 1) {
		const x = (index - (count - 1) / 2) * (item.width / count);
		const scale = rng.range(0.85, 1.05);
		parts.push(
			sphere(
				BURLAP,
				0.2 * scale,
				x,
				0.2 * scale,
				rng.range(-0.08, 0.08),
				1,
				1.3,
				0.9,
				12,
			),
			sphere(BURLAP, 0.07 * scale, x, 0.47 * scale, 0, 1, 0.8, 1, 8),
			torus(LINEN, 0.05 * scale, 0.01, x, 0.42 * scale, 0),
		);
	}
	return parts;
};

export const milkChurns: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [];
	for (const side of [-1, 1]) {
		const x = side * item.width * 0.24;
		const h = item.height * rng.range(0.88, 1);
		parts.push(
			lathe(
				PEWTER,
				[
					[0.001, 0],
					[0.11, 0],
					[0.12, h * 0.55],
					[0.06, h * 0.78],
					[0.06, h * 0.92],
					[0.075, h * 0.95],
					[0.001, h],
				],
				x,
				0,
				0,
				14,
			),
			torus(PEWTER, 0.04, 0.008, x + 0.1, h * 0.65, 0, 0, Math.PI / 2),
		);
	}
	return parts;
};

export const butterChurn: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const h = item.height;
	return [
		lathe(
			wood,
			[
				[0.001, 0],
				[0.17, 0],
				[0.13, h * 0.6],
				[0.11, h * 0.62],
				[0.001, h * 0.62],
			],
			0,
			0,
			0,
			14,
		),
		torus(IRON, 0.165, 0.01, 0, 0.1, 0),
		torus(IRON, 0.14, 0.01, 0, h * 0.5, 0),
		cylinder(wood, 0.015, 0.015, h * 0.45, 0, h * 0.55, 0, 6),
		cylinder(wood, 0.06, 0.06, 0.02, 0, h * 0.62, 0, 10),
	];
};

export const pillory: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height } = item;
	const parts: Part[] = [
		box(wood, 0.12, height, 0.12, 0, 0, 0),
		box(wood, 0.5, 0.08, 0.5, 0, 0, 0),
		box(wood, width, 0.24, 0.1, 0, height - 0.38, 0.04),
	];
	for (const x of [-width * 0.3, 0, width * 0.3]) {
		const size = x === 0 ? 0.13 : 0.08;
		parts.push(plane(DARK, size, size, x, height - 0.26, 0.091));
	}
	parts.push(
		boxAt(IRON, 0.05, 0.08, 0.02, width / 2 - 0.08, height - 0.27, 0.1),
		boxAt(wood, width, 0.02, 0.11, 0, height - 0.26, 0.04),
	);
	return parts;
};

export const dollhouse: FurnitureBuilder = ({ item, rng }) => {
	const wood: MaterialOptions = { texture: "woodPainted", roughness: 0.8 };
	const { width, depth, height } = item;
	const body = height * 0.68;
	const parts: Part[] = [
		box(pickWood(rng), width + 0.06, 0.04, depth + 0.06, 0, 0, 0),
		box(wood, width, body, depth, 0, 0.04, 0),
		boxAt(
			{ texture: "woodRed", roughness: 0.8 },
			width * 0.6,
			0.03,
			depth + 0.04,
			-width * 0.2,
			body + 0.04 + height * 0.12,
			0,
			0,
			0,
			0.6,
		),
		boxAt(
			{ texture: "woodRed", roughness: 0.8 },
			width * 0.6,
			0.03,
			depth + 0.04,
			width * 0.2,
			body + 0.04 + height * 0.12,
			0,
			0,
			0,
			-0.6,
		),
	];
	for (let row = 0; row < 2; row += 1) {
		for (let column = 0; column < 3; column += 1) {
			const lit = rng.chance(0.25);
			parts.push(
				plane(
					lit ? { color: 0xffb060, unlit: true } : DARK,
					0.09,
					0.11,
					(column - 1) * width * 0.3,
					0.04 + body * (0.3 + row * 0.42),
					depth / 2 + 0.002,
				),
			);
		}
	}
	parts.push(plane(DARK, 0.1, 0.16, 0, 0.12, depth / 2 + 0.003));
	return parts;
};

export const wheelchair: FurnitureBuilder = ({ item, rng }) => {
	const fabric: MaterialOptions = {
		texture: rng.pick(["leather", "velvetRed", "linen"] as const),
		roughness: 0.9,
	};
	const { width, depth, height } = item;
	const seat = 0.5;
	const parts: Part[] = [
		box(fabric, width - 0.2, 0.06, depth * 0.5, 0, seat - 0.06, 0.02),
		boxAt(
			fabric,
			width - 0.22,
			height - seat,
			0.05,
			0,
			(height + seat) / 2,
			-depth * 0.22,
			-0.12,
		),
	];
	for (const side of [-1, 1]) {
		const x = side * (width / 2 - 0.04);
		parts.push(
			torus(IRON, 0.3, 0.018, x, 0.31, -0.02, 0, Math.PI / 2),
			torus(IRON, 0.26, 0.008, x * 0.96, 0.31, -0.02, 0, Math.PI / 2),
			cylinderBetween(
				IRON,
				v(x * 0.92, 0.31, -0.32),
				v(x * 0.92, 0.31, 0.28),
				0.01,
				5,
			),
			cylinderBetween(
				IRON,
				v(x * 0.92, 0.01, -0.02),
				v(x * 0.92, 0.61, -0.02),
				0.01,
				5,
			),
			torus(
				IRON,
				0.07,
				0.015,
				side * (width / 2 - 0.12),
				0.07,
				depth / 2 - 0.1,
				0,
				Math.PI / 2,
			),
			cylinderBetween(
				IRON,
				v(side * (width / 2 - 0.12), 0.07, depth / 2 - 0.1),
				v(side * (width / 2 - 0.12), seat, depth * 0.2),
				0.012,
				6,
			),
			cylinderBetween(
				IRON,
				v(side * (width / 2 - 0.14), height, -depth * 0.28),
				v(side * (width / 2 - 0.14), height + 0.06, -depth * 0.4),
				0.014,
				6,
			),
		);
	}
	return parts;
};

export const ironingBoard: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, depth, height } = item;
	return [
		box(LINEN, width, 0.03, depth, 0, height - 0.03, 0, 0, 0.012),
		cylinderBetween(
			wood,
			v(-width * 0.3, 0, -depth * 0.35),
			v(width * 0.2, height - 0.03, 0),
			0.02,
			6,
		),
		cylinderBetween(
			wood,
			v(width * 0.2, 0, -depth * 0.35),
			v(-width * 0.3, height - 0.03, 0),
			0.02,
			6,
		),
		cylinderBetween(
			wood,
			v(-width * 0.3, 0, depth * 0.35),
			v(width * 0.2, height - 0.03, 0),
			0.02,
			6,
		),
		cylinderBetween(
			wood,
			v(width * 0.2, 0, depth * 0.35),
			v(-width * 0.3, height - 0.03, 0),
			0.02,
			6,
		),
		box(IRON, 0.22, 0.08, 0.12, width * 0.35, height, 0, 0, 0.03),
		boxAt(DARK, 0.12, 0.03, 0.03, width * 0.35, height + 0.12, 0),
		cylinderBetween(
			DARK,
			v(width * 0.3, height + 0.08, 0),
			v(width * 0.3, height + 0.12, 0),
			0.008,
			5,
		),
		cylinderBetween(
			DARK,
			v(width * 0.4, height + 0.08, 0),
			v(width * 0.4, height + 0.12, 0),
			0.008,
			5,
		),
	];
};

export const secretary: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, depth, height } = item;
	const desk = 0.78;
	const parts: Part[] = [
		box(wood, width, desk, depth, 0, 0, 0, 0, 0.01),
		boxAt(wood, width, 0.03, depth * 0.55, 0, desk + 0.12, depth * 0.1, -0.7),
		box(
			wood,
			width,
			height - desk - 0.08,
			depth * 0.55,
			0,
			desk,
			-depth * 0.22,
			0,
			0.01,
		),
		box(wood, width + 0.04, 0.08, depth * 0.6, 0, height - 0.08, -depth * 0.2),
		plane(
			GLASS,
			width - 0.1,
			height - desk - 0.2,
			0,
			(height + desk) / 2,
			depth * 0.06 + 0.002,
		),
		texturedPlane(
			{ texture: "books", roughness: 0.9 },
			width - 0.12,
			height - desk - 0.24,
			0,
			(height + desk) / 2,
			depth * 0.05,
		),
	];
	for (const y of [0.18, 0.44, 0.66]) {
		parts.push(
			boxAt(wood, width - 0.06, 0.2, 0.01, 0, y, depth / 2 + 0.004),
			sphere(BRASS, 0.016, 0, y, depth / 2 + 0.02, 1, 1, 0.6, 8),
		);
	}
	return parts;
};

export const vanity: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, depth, height } = item;
	const top = 0.76;
	const parts: Part[] = [
		box(wood, width, 0.05, depth, 0, top - 0.05, 0, 0, 0.01),
		box(wood, width * 0.3, top - 0.22, depth - 0.04, -width * 0.35, 0.17, 0),
		box(wood, width * 0.3, top - 0.22, depth - 0.04, width * 0.35, 0.17, 0),
		...legs(wood, width, depth, 0.17, 0.02, 0.05),
	];
	const mirrorHeight = height - top - 0.05;
	parts.push(
		boxAt(
			wood,
			width * 0.62,
			mirrorHeight,
			0.03,
			0,
			top + mirrorHeight / 2,
			-depth / 2 + 0.03,
		),
		plane(
			{ texture: "mirror", roughness: 0.05, metalness: 0.9 },
			width * 0.52,
			mirrorHeight - 0.1,
			0,
			top + mirrorHeight / 2,
			-depth / 2 + 0.047,
		),
		...candle(-width * 0.38, top, depth * 0.1, 0.12, 0.022),
		lathe(
			GLASS,
			[
				[0.001, 0],
				[0.035, 0.02],
				[0.03, 0.09],
				[0.012, 0.12],
				[0.001, 0.12],
			],
			width * 0.3,
			top,
			0.05,
			10,
		),
	);
	return parts;
};

export const washstand: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, depth, height } = item;
	return [
		box(MARBLE, width, 0.04, depth, 0, height - 0.04, 0, 0, 0.01),
		box(wood, width - 0.04, height - 0.24, depth - 0.04, 0, 0.2, 0),
		...legs(wood, width, depth, 0.2, 0.022, 0.04),
		boxAt(wood, width - 0.04, 0.12, 0.03, 0, height + 0.06, -depth / 2 + 0.02),
		lathe(
			CERAMIC,
			[
				[0.001, 0],
				[0.08, 0],
				[0.18, 0.09],
				[0.17, 0.1],
				[0.07, 0.015],
			],
			0,
			height,
			0.02,
			18,
		),
		lathe(
			CERAMIC,
			[
				[0.001, 0],
				[0.06, 0],
				[0.08, 0.12],
				[0.04, 0.22],
				[0.05, 0.26],
			],
			width * 0.32,
			height,
			-0.05,
			12,
		),
		torus(
			CERAMIC,
			0.045,
			0.01,
			width * 0.32 + 0.07,
			height + 0.15,
			-0.05,
			0,
			Math.PI / 2,
			Math.PI,
		),
	];
};

export const woodpile: FurnitureBuilder = ({ item, rng }) => {
	const { width, depth, height } = item;
	const parts: Part[] = [];
	const radius = 0.065;
	const rows = Math.floor(height / (radius * 1.8));
	for (let row = 0; row < rows; row += 1) {
		const count = Math.floor(width / (radius * 2.05)) - (row % 2);
		for (let index = 0; index < count; index += 1) {
			const x =
				-width / 2 + radius + (row % 2) * radius + index * radius * 2.05;
			const r = radius * rng.range(0.8, 1);
			parts.push(
				cylinderBetween(
					BARK,
					v(x, r + row * radius * 1.75, -depth / 2 + 0.03),
					v(
						x + rng.range(-0.02, 0.02),
						r + row * radius * 1.75,
						depth / 2 - 0.03,
					),
					r,
					7,
				),
			);
		}
	}
	return parts;
};

export const throne: FurnitureBuilder = ({ item, rng }) => {
	const wood: MaterialOptions = { texture: "woodDark", roughness: 0.7 };
	const fabric = velvet(rng);
	const { width, depth, height } = item;
	const seat = 0.5;
	return [
		box(wood, width, seat - 0.08, depth, 0, 0, 0, 0, 0.02),
		box(fabric, width - 0.14, 0.08, depth - 0.1, 0, seat - 0.08, 0.03, 0, 0.03),
		box(
			wood,
			width,
			height - seat,
			0.12,
			0,
			seat - 0.08,
			-depth / 2 + 0.06,
			0,
			0.02,
		),
		box(
			fabric,
			width - 0.2,
			height - seat - 0.25,
			0.03,
			0,
			seat + 0.05,
			-depth / 2 + 0.13,
		),
		box(wood, 0.1, 0.3, depth - 0.1, -width / 2 + 0.05, seat, 0.03),
		box(wood, 0.1, 0.3, depth - 0.1, width / 2 - 0.05, seat, 0.03),
		sphere(
			BRASS,
			0.05,
			-width / 2 + 0.06,
			height - 0.02,
			-depth / 2 + 0.06,
			1,
			1,
			1,
			10,
		),
		sphere(
			BRASS,
			0.05,
			width / 2 - 0.06,
			height - 0.02,
			-depth / 2 + 0.06,
			1,
			1,
			1,
			10,
		),
		lathe(
			BRASS,
			[
				[0.001, 0],
				[0.07, 0.02],
				[0.05, 0.1],
				[0.001, 0.16],
			],
			0,
			height - 0.04,
			-depth / 2 + 0.06,
			8,
		),
	];
};

export const spiceRack: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, depth, height } = item;
	const parts: Part[] = [box(wood, width, height, 0.02, 0, 0, 0.01)];
	for (const y of [0.04, height * 0.52]) {
		parts.push(
			box(wood, width, 0.02, depth, 0, y, depth / 2),
			boxAt(wood, width, 0.03, 0.01, 0, y + 0.07, depth - 0.005),
		);
		const count = Math.floor(width / 0.09);
		for (let index = 0; index < count; index += 1) {
			const x = -width / 2 + 0.05 + index * 0.09;
			parts.push(
				cylinder(
					rng.chance(0.5) ? GLASS : CERAMIC,
					0.025,
					0.025,
					0.1,
					x,
					y + 0.02,
					depth / 2,
					8,
				),
				cylinder(
					{
						color: rng.pick([0x7a3a1c, 0x9a7a2a, 0x3a5a2a, 0x5a2a1a]),
						roughness: 1,
					},
					0.022,
					0.022,
					0.06,
					x,
					y + 0.025,
					depth / 2,
					8,
				),
				cylinder(wood, 0.027, 0.027, 0.015, x, y + 0.12, depth / 2, 8),
			);
		}
	}
	return parts;
};

export const hangingPots: FurnitureBuilder = ({ item, rng }) => {
	const { width, height } = item;
	const parts: Part[] = [
		cylinderBetween(
			IRON,
			v(-width / 2, height - 0.04, 0.08),
			v(width / 2, height - 0.04, 0.08),
			0.012,
			6,
		),
	];
	for (const x of [-width / 2 + 0.02, width / 2 - 0.02]) {
		parts.push(box(IRON, 0.03, 0.06, 0.1, x, height - 0.07, 0.04));
	}
	const count = Math.max(3, Math.floor(width / 0.22));
	for (let index = 0; index < count; index += 1) {
		const x = -width / 2 + (index + 0.5) * (width / count);
		const r = rng.range(0.06, 0.1);
		const drop = rng.range(0.12, 0.2);
		const metal = rng.chance(0.6) ? COPPER : IRON;
		parts.push(
			torus(IRON, 0.02, 0.005, x, height - 0.06, 0.08, 0, Math.PI / 2),
			cylinderBetween(
				metal,
				v(x, height - 0.08, 0.08),
				v(x, height - drop, 0.08),
				0.008,
				5,
			),
			lathe(
				metal,
				[
					[0.001, 0],
					[r, 0],
					[r, r * 0.9],
					[r * 1.05, r],
				],
				x,
				height - drop - r * 1.1 - 0.02,
				0.08,
				14,
			),
		);
	}
	return parts;
};

export const wallClock: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const r = item.width / 2;
	const center = item.height / 2;
	const parts: Part[] = [
		lathe(
			wood,
			[
				[0.001, 0],
				[r, 0],
				[r, 0.05],
				[r * 0.85, 0.06],
			],
			0,
			center,
			0,
			24,
		),
		lathe(
			{ color: 0xe6dcc0, roughness: 0.6 },
			[
				[r * 0.82, 0.061],
				[0.001, 0.061],
			],
			0,
			center,
			0,
			24,
		),
	].map((piece) => faceForward(piece, center, 0));
	for (let index = 0; index < 12; index += 1) {
		const angle = (index / 12) * Math.PI * 2;
		parts.push(
			boxAt(
				DARK,
				0.012,
				index % 3 === 0 ? 0.04 : 0.02,
				0.004,
				Math.sin(angle) * r * 0.7,
				center + Math.cos(angle) * r * 0.7,
				0.064,
				0,
				0,
				-angle,
			),
		);
	}
	const hour = rng.range(0, Math.PI * 2);
	const minute = rng.range(0, Math.PI * 2);
	parts.push(
		boxAt(
			DARK,
			0.014,
			r * 0.45,
			0.004,
			Math.sin(hour) * r * 0.22,
			center + Math.cos(hour) * r * 0.22,
			0.068,
			0,
			0,
			-hour,
		),
		boxAt(
			DARK,
			0.009,
			r * 0.65,
			0.004,
			Math.sin(minute) * r * 0.32,
			center + Math.cos(minute) * r * 0.32,
			0.07,
			0,
			0,
			-minute,
		),
		sphere(BRASS, 0.012, 0, center, 0.072, 1, 1, 0.5, 8),
	);
	return parts;
};

export const antlers: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height } = item;
	const base = height * 0.35;
	const parts: Part[] = [
		boxAt(wood, 0.28, 0.34, 0.03, 0, base, 0.015),
		sphere(BONE, 0.07, 0, base + 0.02, 0.09, 1, 0.8, 1.3, 10),
	];
	for (const side of [-1, 1]) {
		const root = v(side * 0.05, base + 0.08, 0.12);
		const tip = v(side * width * 0.45, height - 0.02, 0.18);
		parts.push(cylinderBetween(BONE, root, tip, 0.016, 6));
		for (let index = 1; index <= 3; index += 1) {
			const t = index / 4;
			const from = root.clone().lerp(tip, t);
			parts.push(
				cylinderBetween(
					BONE,
					from,
					from.clone().add(v(side * -0.04, 0.12 + rng.range(0, 0.05), 0.04)),
					0.009,
					5,
				),
			);
		}
	}
	return parts;
};

export const crucifix: FurnitureBuilder = ({ item, rng }) => {
	const material = rng.chance(0.5)
		? { texture: "woodDark", roughness: 0.7 }
		: BRASS;
	const { width, height } = item;
	return [
		box(material, 0.07, height, 0.04, 0, 0, 0.02),
		box(material, width, 0.07, 0.04, 0, height * 0.66, 0.02),
		boxAt(DARK, 0.004, 0.004, 0.004, 0, height * 0.66, 0.042),
	];
};

export const ovalPortrait: FurnitureBuilder = ({ item, rng }) => {
	const rx = item.width / 2;
	const ry = item.height / 2;
	const frameMaterial = rng.chance(0.6)
		? BRASS
		: { texture: "woodDark", roughness: 0.6 };
	const ring = torus(frameMaterial, 1, 0.08, 0, 0, 0.03, 0);
	ring.geometry.scale(rx * 0.95, ry * 0.95, 0.4);
	ring.geometry.translate(0, ry, 0);
	const canvas = new THREE.CircleGeometry(1, 28);
	canvas.scale(rx * 0.9, ry * 0.9, 1);
	canvas.translate(0, ry, 0.025);
	return [
		ring,
		{
			geometry: canvas,
			material: {
				texture: rng.pick(["paintingPortrait", "paintingMushroom"] as const),
				roughness: 0.85,
				fixedRepeat: true,
			},
		},
	];
};

export const oldMap: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height } = item;
	return [
		texturedPlane(
			{ texture: rng.chance(0.5) ? "starChart" : "paper", roughness: 0.95 },
			width - 0.08,
			height - 0.1,
			0,
			height / 2,
			0.01,
		),
		cylinderBetween(
			wood,
			v(-width / 2, height - 0.03, 0.025),
			v(width / 2, height - 0.03, 0.025),
			0.025,
			8,
		),
		cylinderBetween(
			wood,
			v(-width / 2, 0.03, 0.025),
			v(width / 2, 0.03, 0.025),
			0.025,
			8,
		),
	];
};

export const keyRack: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height } = item;
	const parts: Part[] = [box(wood, width, height, 0.025, 0, 0, 0.012, 0, 0.01)];
	const count = Math.floor(width / 0.07);
	for (let index = 0; index < count; index += 1) {
		const x = -width / 2 + 0.05 + index * 0.07;
		parts.push(
			cylinderBetween(
				BRASS,
				v(x, height * 0.7, 0.025),
				v(x, height * 0.72, 0.06),
				0.005,
				5,
			),
		);
		if (rng.chance(0.7)) {
			parts.push(
				torus(
					rng.chance(0.5) ? BRASS : IRON,
					0.014,
					0.003,
					x,
					height * 0.66,
					0.05,
					0,
					0,
				),
				boxAt(IRON, 0.008, 0.07, 0.004, x, height * 0.6, 0.05),
				boxAt(IRON, 0.02, 0.01, 0.004, x + 0.008, height * 0.57, 0.05),
			);
		}
	}
	return parts;
};

export const barometer: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height } = item;
	return [
		box(wood, width * 0.5, height * 0.65, 0.03, 0, 0, 0.015, 0, 0.01),
		cylinder(wood, width / 2, width / 2, 0.03, 0, 0, 0, 20),
		texturedPlane(
			{ texture: "paper", roughness: 0.8 },
			width * 0.3,
			height * 0.5,
			0,
			height * 0.35,
			0.032,
		),
		cylinder(GLASS, 0.008, 0.008, height * 0.5, 0, height * 0.1, 0.04, 6),
		cylinder(
			{ color: 0x8a1a12, roughness: 0.4 },
			0.006,
			0.006,
			height * 0.3,
			0,
			height * 0.1,
			0.04,
			6,
		),
	].map((piece, index) => {
		if (index === 1) {
			faceForward(piece, 0, 0).geometry.translate(0, height * 0.78, 0);
		}
		return piece;
	});
};

export const hangingCage: FurnitureBuilder = ({ item, rng }) => {
	const { width, height } = item;
	const cageHeight = Math.min(0.8, height * 0.55);
	const bottom = height - cageHeight - rng.range(0.2, 0.5);
	const r = width / 2 - 0.05;
	const parts: Part[] = [
		cylinder(IRON, r, r, 0.03, 0, bottom, 0, 14),
		lathe(
			IRON,
			[
				[r, 0],
				[r * 0.6, cageHeight * 0.2],
				[0.03, cageHeight * 0.3],
			],
			0,
			bottom + cageHeight,
			0,
			12,
		),
		cylinder(
			IRON,
			0.01,
			0.01,
			height - bottom - cageHeight - 0.2,
			0,
			bottom + cageHeight + 0.2,
			0,
			5,
		),
	];
	for (let index = 0; index < 12; index += 1) {
		const angle = (index / 12) * Math.PI * 2;
		parts.push(
			cylinder(
				IRON,
				0.008,
				0.008,
				cageHeight,
				Math.cos(angle) * r,
				bottom,
				Math.sin(angle) * r,
				4,
			),
		);
	}
	parts.push(torus(IRON, r, 0.01, 0, bottom + cageHeight * 0.5, 0));
	if (rng.chance(0.5)) {
		parts.push(sphere(BONE, 0.1, 0, bottom + 0.1, 0, 1, 0.9, 1.1, 10));
	}
	return parts;
};

export const hangingLantern: FurnitureBuilder = ({ item }) => {
	const { height } = item;
	const body = 0.3;
	const bottom = height - 0.55 - body;
	return [
		cylinder(
			IRON,
			0.008,
			0.008,
			height - bottom - body,
			0,
			bottom + body,
			0,
			5,
		),
		box(IRON, 0.2, 0.02, 0.2, 0, bottom, 0),
		box(GLASS, 0.17, body - 0.06, 0.17, 0, bottom + 0.02, 0),
		...[-1, 1].flatMap((sx) =>
			[-1, 1].map((sz) =>
				cylinder(
					IRON,
					0.008,
					0.008,
					body - 0.04,
					sx * 0.09,
					bottom + 0.02,
					sz * 0.09,
					4,
				),
			),
		),
		lathe(
			IRON,
			[
				[0.13, 0],
				[0.04, 0.1],
				[0.001, 0.12],
			],
			0,
			bottom + body - 0.04,
			0,
			4,
		),
		...candle(0, bottom + 0.02, 0, 0.1, 0.022),
	];
};

export const meatHooks: FurnitureBuilder = ({ item, rng }) => {
	const { width, height } = item;
	const parts: Part[] = [
		cylinderBetween(
			IRON,
			v(-width / 2, height - 0.08, 0),
			v(width / 2, height - 0.08, 0),
			0.02,
			6,
		),
	];
	for (const x of [-width / 2 + 0.05, width / 2 - 0.05]) {
		parts.push(cylinder(IRON, 0.01, 0.01, 0.08, x, height - 0.08, 0, 5));
	}
	for (let index = 0; index < 4; index += 1) {
		const x = -width / 2 + 0.12 + index * ((width - 0.24) / 3);
		const drop = rng.range(0.2, 0.35);
		parts.push(
			cylinder(IRON, 0.006, 0.006, drop, x, height - 0.08 - drop, 0, 4),
			torus(
				IRON,
				0.035,
				0.006,
				x + 0.035,
				height - 0.08 - drop,
				0,
				Math.PI,
				0,
				Math.PI,
			),
		);
		if (rng.chance(0.3)) {
			parts.push(
				sphere(
					{ color: 0x5a1e1a, roughness: 0.6 },
					0.08,
					x,
					height - 0.2 - drop,
					0,
					0.8,
					1.4,
					0.7,
					8,
				),
			);
		}
	}
	return parts;
};

export const teaSet: FurnitureBuilder = ({ item, rng }) => {
	const china: MaterialOptions = rng.chance(0.5) ? CERAMIC : PEWTER;
	const parts: Part[] = [
		cylinder(china, item.width * 0.42, item.width * 0.4, 0.01, 0, 0, 0, 20),
		lathe(
			china,
			[
				[0.001, 0],
				[0.05, 0],
				[0.07, 0.06],
				[0.05, 0.11],
				[0.02, 0.13],
				[0.001, 0.14],
			],
			-0.06,
			0.01,
			0,
			14,
		),
		cylinderBetween(china, v(-0.0, 0.06, 0), v(0.03, 0.1, 0), 0.008, 5),
		torus(china, 0.03, 0.007, -0.13, 0.08, 0, 0, Math.PI / 2, Math.PI),
	];
	for (const [x, z] of [
		[0.1, 0.06],
		[0.12, -0.07],
	]) {
		parts.push(
			cylinder(china, 0.045, 0.04, 0.006, x, 0.01, z, 12),
			lathe(
				china,
				[
					[0.001, 0],
					[0.022, 0],
					[0.032, 0.045],
				],
				x,
				0.016,
				z,
				12,
			),
		);
	}
	return parts;
};

export const hourglass: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const h = item.height;
	const sand: MaterialOptions = { color: 0xc8a868, roughness: 1 };
	const parts: Part[] = [
		cylinder(wood, 0.07, 0.07, 0.02, 0, 0, 0, 12),
		cylinder(wood, 0.07, 0.07, 0.02, 0, h - 0.02, 0, 12),
		lathe(
			GLASS,
			[
				[0.001, 0.02],
				[0.05, 0.04],
				[0.008, h / 2],
				[0.05, h - 0.04],
				[0.001, h - 0.02],
			],
			0,
			0,
			0,
			14,
		),
		lathe(
			sand,
			[
				[0.001, 0.02],
				[0.04, 0.03],
				[0.001, 0.02 + h * 0.15],
			],
			0,
			0,
			0,
			10,
		),
		lathe(
			sand,
			[
				[0.001, h / 2 + 0.02],
				[0.032, h / 2 + 0.06],
				[0.04, h * 0.7],
				[0.001, h * 0.7],
			],
			0,
			0,
			0,
			10,
		),
	];
	for (let index = 0; index < 3; index += 1) {
		const angle = (index / 3) * Math.PI * 2;
		parts.push(
			cylinder(
				wood,
				0.007,
				0.007,
				h - 0.04,
				Math.cos(angle) * 0.06,
				0.02,
				Math.sin(angle) * 0.06,
				5,
			),
		);
	}
	return parts;
};

export const crystalBall: FurnitureBuilder = () => [
	lathe(
		BRASS,
		[
			[0.001, 0],
			[0.08, 0],
			[0.06, 0.03],
			[0.04, 0.06],
			[0.07, 0.08],
			[0.001, 0.08],
		],
		0,
		0,
		0,
		14,
	),
	sphere(
		{
			color: 0x8a7ad0,
			roughness: 0.05,
			transparent: true,
			opacity: 0.55,
			emissive: 0x4a3a9a,
			emissiveIntensity: 0.6,
			depthWrite: false,
		},
		0.09,
		0,
		0.16,
		0,
		1,
		1,
		1,
		18,
	),
	sphere({ color: 0xc8b8ff, unlit: true }, 0.025, 0, 0.16, 0, 1, 1, 1, 8),
];

export const mortar: FurnitureBuilder = ({ rng }) => {
	const material = rng.chance(0.5) ? STONE : MARBLE;
	return [
		lathe(
			material,
			[
				[0.001, 0],
				[0.06, 0],
				[0.08, 0.05],
				[0.085, 0.08],
				[0.06, 0.08],
				[0.05, 0.03],
				[0.001, 0.025],
			],
			0,
			0,
			0,
			14,
		),
		cylinderBetween(material, v(0, 0.03, 0), v(0.07, 0.15, 0.02), 0.014, 6),
		sphere({ color: 0x5a6a3a, roughness: 1 }, 0.045, 0, 0.035, 0, 1, 0.3, 1, 8),
	];
};

export const scrolls: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [];
	for (let index = 0; index < rng.int(3, 5); index += 1) {
		const angle = rng.range(-0.5, 0.5);
		const length = rng.range(item.width * 0.6, item.width * 0.9);
		const z = rng.range(-item.depth * 0.3, item.depth * 0.3);
		const y = 0.025 + (index > 2 ? 0.045 : 0);
		const half = v(
			Math.cos(angle) * length * 0.5,
			0,
			Math.sin(angle) * length * 0.5,
		);
		parts.push(
			cylinderBetween(
				PAPER,
				v(-half.x, y, z - half.z),
				v(half.x, y, z + half.z),
				rng.range(0.018, 0.026),
				8,
			),
		);
		if (rng.chance(0.5)) {
			parts.push(
				sphere(
					{ color: 0x8a1a12, roughness: 0.6 },
					0.012,
					0,
					y + 0.02,
					z,
					1,
					0.5,
					1,
					6,
				),
			);
		}
	}
	return parts;
};

export const mantelClock: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, depth, height } = item;
	return [
		box(wood, width, 0.03, depth, 0, 0, 0, 0, 0.01),
		box(wood, width * 0.8, height * 0.6, depth * 0.8, 0, 0.03, 0, 0, 0.02),
		sphere(wood, width * 0.4, 0, height * 0.62, 0, 1, 0.7, depth / width, 14),
		cylinder(
			{ color: 0xe6dcc0, roughness: 0.6 },
			width * 0.22,
			width * 0.22,
			0.005,
			0,
			height * 0.45,
			depth * 0.4,
			18,
		),
		boxAt(
			DARK,
			0.008,
			width * 0.16,
			0.004,
			0,
			height * 0.45 + width * 0.05,
			depth * 0.43,
		),
		boxAt(
			DARK,
			0.008,
			width * 0.12,
			0.004,
			width * 0.04,
			height * 0.45,
			depth * 0.43,
			0,
			0,
			1.2,
		),
		sphere(BRASS, 0.018, 0, height * 0.95, 0, 1, 1, 1, 8),
	].map((piece, index) =>
		index === 3
			? faceForward(piece, height * 0.45 + 0.0025, depth * 0.4)
			: piece,
	);
};

export const oilLamp: FurnitureBuilder = ({ rng }) => [
	lathe(
		rng.chance(0.5) ? BRASS : COPPER,
		[
			[0.001, 0],
			[0.06, 0],
			[0.07, 0.04],
			[0.04, 0.07],
			[0.015, 0.09],
			[0.001, 0.09],
		],
		0,
		0,
		0,
		14,
	),
	lathe(
		{ ...GLASS, emissive: 0xffa040, emissiveIntensity: 0.5 },
		[
			[0.015, 0],
			[0.045, 0.05],
			[0.025, 0.14],
			[0.03, 0.16],
		],
		0,
		0.09,
		0,
		14,
	),
	...candle(0, 0.09, 0, 0.02, 0.008),
	torus(BRASS, 0.025, 0.006, 0.08, 0.04, 0, 0, Math.PI / 2, Math.PI * 1.4),
];

export const stuffedRaven: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	return [
		box(wood, item.width, 0.03, item.depth, 0, 0, 0, 0, 0.008),
		cylinderBetween(wood, v(0, 0.03, 0), v(0.02, 0.12, 0), 0.012, 5),
		cylinderBetween(wood, v(-0.08, 0.12, 0), v(0.1, 0.13, 0), 0.012, 5),
		sphere(FEATHERS, 0.06, 0, 0.19, 0, 0.9, 1, 1.5, 10),
		sphere(FEATHERS, 0.038, 0, 0.26, 0.06, 1, 1, 1, 10),
		lathe(
			{ color: 0x1a1a1a, roughness: 0.4 },
			[
				[0.012, 0],
				[0.001, 0.05],
			],
			0,
			0.255,
			0.09,
			6,
		),
		sphere(
			{ color: 0xc8a020, unlit: true },
			0.007,
			0.022,
			0.27,
			0.08,
			1,
			1,
			1,
			6,
		),
		sphere(
			{ color: 0xc8a020, unlit: true },
			0.007,
			-0.022,
			0.27,
			0.08,
			1,
			1,
			1,
			6,
		),
		boxAt(FEATHERS, 0.06, 0.012, 0.12, 0, 0.17, -0.12, 0.4),
	].map((piece, index) =>
		index === 5 ? faceForward(piece, 0.255, 0.09) : piece,
	);
};

export const leatherTomes: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [];
	let y = 0;
	for (let index = 0; index < rng.int(2, 4); index += 1) {
		const thickness = rng.range(0.04, 0.07);
		parts.push(
			box(
				{
					...LEATHER,
					color: rng.pick([0x6a2a1a, 0x2a3a5a, 0x3a4a2a, 0x5a4a2a]),
				},
				item.width * rng.range(0.75, 0.95),
				thickness,
				item.depth * rng.range(0.75, 0.95),
				rng.range(-0.02, 0.02),
				y,
				rng.range(-0.02, 0.02),
				rng.range(-0.3, 0.3),
				0.006,
			),
		);
		y += thickness;
	}
	parts.push(...candle(item.width * 0.25, y, 0, 0.08, 0.018));
	return parts;
};
