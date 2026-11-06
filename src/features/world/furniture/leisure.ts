import * as THREE from "three";
import { meterLathe, placed } from "../geometryUtils";
import type { MaterialOptions } from "../MaterialLibrary";
import {
	BRASS,
	box,
	boxAt,
	cylinder,
	cylinderBetween,
	DARK,
	type FurnitureBuilder,
	IRON,
	lathe,
	type Part,
	type PartAnimation,
	part,
	pickStatuary,
	pickWood,
	sphere,
	torus,
} from "./parts";

const FELT: MaterialOptions = {
	texture: "velvetGreen",
	color: 0x3f8a4a,
	roughness: 1,
};
const VELVET: MaterialOptions = {
	wave: "cloth",
	texture: "velvetRed",
	roughness: 1,
};
const BALL_COLORS = [0xf2ecd8, 0xd8442f, 0xe0b326, 0x2a3a8a, 0x111111];

function tilted(
	material: MaterialOptions,
	profile: [number, number][],
	x: number,
	y: number,
	z: number,
	rotationY: number,
	rotationX: number,
	segments = 16,
): Part {
	return part(
		placed(
			meterLathe(
				profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
				segments,
			),
			x,
			y,
			z,
			rotationY,
			rotationX,
		),
		material,
	);
}

export const billiardTable: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, depth, height } = item;
	const parts: Part[] = [];
	for (const sx of [-1, 0, 1]) {
		for (const sz of [-1, 1]) {
			parts.push(
				lathe(
					wood,
					[
						[0.06, 0],
						[0.08, 0.08],
						[0.05, 0.25],
						[0.07, 0.42],
						[0.06, height - 0.3],
					],
					sx * (width / 2 - 0.18),
					0,
					sz * (depth / 2 - 0.16),
					10,
				),
			);
		}
	}
	parts.push(
		box(wood, width - 0.1, 0.22, depth - 0.1, 0, height - 0.36, 0, 0, 0.02),
		box(FELT, width - 0.2, 0.05, depth - 0.2, 0, height - 0.15, 0),
		box(wood, width, 0.1, 0.11, 0, height - 0.1, depth / 2 - 0.055, 0, 0.02),
		box(wood, width, 0.1, 0.11, 0, height - 0.1, -depth / 2 + 0.055, 0, 0.02),
		box(wood, 0.11, 0.1, depth - 0.2, width / 2 - 0.055, height - 0.1, 0),
		box(wood, 0.11, 0.1, depth - 0.2, -width / 2 + 0.055, height - 0.1, 0),
	);
	for (const sx of [-1, 0, 1]) {
		for (const sz of [-1, 1]) {
			parts.push(
				cylinder(
					DARK,
					0.055,
					0.055,
					0.012,
					sx * (width / 2 - 0.1),
					height - 0.098,
					sz * (depth / 2 - 0.1),
					10,
				),
			);
		}
	}
	for (let index = 0; index < 7; index += 1) {
		parts.push(
			sphere(
				{ color: BALL_COLORS[index % BALL_COLORS.length], roughness: 0.25 },
				0.028,
				(rng.next() - 0.5) * (width - 0.5),
				height - 0.1 + 0.028,
				(rng.next() - 0.5) * (depth - 0.5),
				1,
				1,
				1,
				10,
			),
		);
	}
	parts.push(
		cylinderBetween(
			{ texture: "woodLight", roughness: 0.6 },
			new THREE.Vector3(-width * 0.3, height - 0.065, depth * 0.1),
			new THREE.Vector3(width * 0.25, height - 0.07, -depth * 0.15),
			0.012,
			6,
		),
	);
	return parts;
};

export const chessTable: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height } = item;
	const parts: Part[] = [
		lathe(
			wood,
			[
				[0.22, 0],
				[0.22, 0.04],
				[0.06, 0.1],
				[0.05, 0.4],
				[0.08, height - 0.08],
				[0.001, height - 0.05],
			],
			0,
			0,
			0,
			12,
		),
		box(wood, width, 0.05, width, 0, height - 0.05, 0, 0, 0.015),
	];
	const board = width * 0.72;
	const cell = board / 8;
	const light: MaterialOptions = { texture: "woodLight", roughness: 0.5 };
	const dark: MaterialOptions = { texture: "woodDark", roughness: 0.5 };
	for (let row = 0; row < 8; row += 1) {
		for (let column = 0; column < 8; column += 1) {
			parts.push(
				box(
					(row + column) % 2 === 0 ? light : dark,
					cell,
					0.006,
					cell,
					-board / 2 + (column + 0.5) * cell,
					height,
					-board / 2 + (row + 0.5) * cell,
				),
			);
		}
	}
	for (let index = 0; index < 10; index += 1) {
		const white = index % 2 === 0;
		const tall = index < 2;
		parts.push(
			lathe(
				{ color: white ? 0xe8e0c8 : 0x1a1410, roughness: 0.4 },
				[
					[0.018, 0],
					[0.012, 0.015],
					[0.007, tall ? 0.05 : 0.025],
					[0.011, tall ? 0.06 : 0.032],
					[0.001, tall ? 0.075 : 0.042],
				],
				-board / 2 + (rng.int(0, 7) + 0.5) * cell,
				height + 0.006,
				-board / 2 + ((white ? rng.int(0, 2) : rng.int(5, 7)) + 0.5) * cell,
				8,
			),
		);
	}
	return parts;
};

export const gramophone: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height } = item;
	const cabinet = height * 0.62;
	const platter: PartAnimation = {
		kind: "spin",
		pivot: [0, cabinet, 0],
		axis: [0, 1, 0],
		speed: 3.4,
		amplitude: 0,
		phase: 0,
	};
	return [
		box(wood, width * 0.8, cabinet, width * 0.8, 0, 0, 0, 0, 0.02),
		{
			...cylinder(DARK, width * 0.3, width * 0.3, 0.02, 0, cabinet, 0, 20),
			animation: platter,
		},
		{
			...box(BRASS, 0.05, 0.004, 0.03, width * 0.16, cabinet + 0.02, 0),
			animation: platter,
		},
		cylinder(BRASS, 0.012, 0.012, 0.06, width * 0.25, cabinet, -width * 0.2, 6),
		cylinderBetween(
			BRASS,
			new THREE.Vector3(width * 0.25, cabinet + 0.06, -width * 0.2),
			new THREE.Vector3(0, cabinet + 0.035, 0.03),
			0.008,
			6,
		),
		tilted(
			BRASS,
			[
				[0.02, 0],
				[0.03, 0.12],
				[0.07, 0.24],
				[0.17, 0.34],
				[0.24, 0.38],
			],
			-width * 0.1,
			cabinet + 0.04,
			-width * 0.15,
			0.4,
			0.9,
			18,
		),
	];
};

export const weaponRack: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height } = item;
	const parts: Part[] = [
		box(wood, width, height * 0.9, 0.05, 0, 0.05, -0.12, 0, 0.01),
		box(wood, width + 0.06, 0.08, 0.3, 0, 0, 0, 0, 0.01),
		box(wood, width, 0.05, 0.12, 0, height * 0.62, -0.05),
		box(wood, width, 0.05, 0.12, 0, height * 0.25, -0.05),
	];
	const slots = Math.max(3, Math.round(width / 0.22));
	for (let index = 0; index < slots; index += 1) {
		const x = -width / 2 + (index + 0.5) * (width / slots);
		const spear = index % 3 === 1;
		if (spear) {
			parts.push(
				cylinderBetween(
					wood,
					new THREE.Vector3(x, 0.08, 0.02),
					new THREE.Vector3(x, height - 0.25, -0.03),
					0.016,
					6,
				),
				boxAt(IRON, 0.05, 0.22, 0.01, x, height - 0.15, -0.035, 0, 0, 0),
			);
			continue;
		}
		const tip = height * (0.72 + rng.next() * 0.12);
		parts.push(
			boxAt(IRON, 0.035, tip - 0.32, 0.008, x, 0.32 + (tip - 0.32) / 2, 0),
			boxAt(BRASS, 0.16, 0.025, 0.03, x, 0.3, 0),
			boxAt(
				{ texture: "leather", roughness: 0.9 },
				0.028,
				0.18,
				0.028,
				x,
				0.2,
				0,
			),
			sphere(BRASS, 0.02, x, 0.1, 0, 1, 1, 1, 8),
		);
	}
	return parts;
};

export const shieldDisplay: FurnitureBuilder = ({ item }) => {
	const { width, height } = item;
	const radius = Math.min(width, height) * 0.32;
	const center = height / 2;
	const parts: Part[] = [];
	for (const side of [-1, 1]) {
		const from = new THREE.Vector3(side * width * 0.42, 0.05, 0.03);
		const to = new THREE.Vector3(-side * width * 0.42, height - 0.05, 0.03);
		parts.push(
			cylinderBetween(IRON, from, to, 0.012, 6),
			sphere(BRASS, 0.025, from.x, from.y, from.z, 1, 1, 1, 8),
		);
	}
	parts.push(
		part(
			placed(
				new THREE.CylinderGeometry(radius, radius * 0.92, 0.04, 20),
				0,
				center,
				0.07,
				0,
				Math.PI / 2,
			),
			{ texture: "woodRed", color: 0x7a2a22, roughness: 0.8 },
		),
		torus(IRON, radius, 0.018, 0, center, 0.09, 0, 0),
		sphere(BRASS, radius * 0.25, 0, center, 0.1, 1, 1, 0.5, 12),
	);
	return parts;
};

export const statue: FurnitureBuilder = ({ item, rng }) => {
	const material = pickStatuary(rng);
	const { width, height } = item;
	const plinth = Math.min(0.85, height * 0.36);
	const figure = height - plinth;
	return [
		box(material, width, 0.12, width, 0, 0, 0, 0, 0.02),
		box(material, width * 0.82, plinth - 0.2, width * 0.82, 0, 0.12, 0),
		box(
			material,
			width * 0.92,
			0.08,
			width * 0.92,
			0,
			plinth - 0.08,
			0,
			0,
			0.02,
		),
		lathe(
			material,
			[
				[0.001, 0],
				[0.3, 0],
				[0.24, figure * 0.3],
				[0.17, figure * 0.62],
				[0.15, figure * 0.72],
				[0.07, figure * 0.78],
				[0.001, figure * 0.79],
			],
			0,
			plinth,
			0,
			16,
		),
		sphere(material, 0.11, 0, plinth + figure * 0.86, 0.02, 1, 1.15, 1, 14),
		tilted(
			material,
			[
				[0.13, 0],
				[0.08, 0.1],
				[0.001, 0.22],
			],
			0,
			plinth + figure * 0.92,
			0.02,
			0,
			0,
			12,
		),
		cylinderBetween(
			material,
			new THREE.Vector3(-0.16, plinth + figure * 0.7, 0.02),
			new THREE.Vector3(-0.2, plinth + figure * 0.48, 0.18),
			0.045,
			8,
		),
		cylinderBetween(
			material,
			new THREE.Vector3(0.16, plinth + figure * 0.7, 0.02),
			new THREE.Vector3(0.24, plinth + figure * 0.9, 0.14),
			0.045,
			8,
		),
		sphere(material, 0.07, 0.25, plinth + figure * 0.96, 0.15, 1, 1, 1, 10),
	];
};

export const theaterSeats: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, depth } = item;
	const count = Math.max(2, Math.round(width / 0.6));
	const seat = width / count;
	const parts: Part[] = [
		box(IRON, width - 0.1, 0.04, 0.06, 0, 0.02, -depth * 0.1),
	];
	for (let index = 0; index <= count; index += 1) {
		const x = -width / 2 + index * seat;
		parts.push(
			box(wood, 0.06, 0.62, depth * 0.8, x, 0, -depth * 0.05),
			box(wood, 0.08, 0.04, depth * 0.7, x, 0.62, 0),
		);
	}
	for (let index = 0; index < count; index += 1) {
		const x = -width / 2 + (index + 0.5) * seat;
		parts.push(
			box(VELVET, seat - 0.1, 0.12, depth * 0.5, x, 0.36, 0.06, 0, 0.03),
			boxAt(
				VELVET,
				seat - 0.1,
				0.62,
				0.1,
				x,
				0.78,
				-depth / 2 + 0.12,
				-0.12,
				0,
				0,
			),
			boxAt(wood, seat - 0.06, 0.66, 0.03, x, 0.78, -depth / 2 + 0.05, -0.12),
		);
	}
	return parts;
};

export const stageCurtain: FurnitureBuilder = ({ item, rng }) => {
	const { width, height, depth } = item;
	const parts: Part[] = [
		cylinderBetween(
			BRASS,
			new THREE.Vector3(-width / 2, height - 0.12, -depth / 2 + 0.12),
			new THREE.Vector3(width / 2, height - 0.12, -depth / 2 + 0.12),
			0.03,
			8,
		),
		box(VELVET, width, 0.45, 0.08, 0, height - 0.5, -depth / 2 + 0.2),
		box(
			{ texture: "velvetRed", color: 0x5a1a1a, roughness: 1 },
			width - 0.2,
			height - 0.6,
			0.03,
			0,
			0,
			-depth / 2 + 0.02,
		),
	];
	const gap = 0.35 + rng.next() * 0.35;
	const folds = Math.round(width / 0.16);
	for (let index = 0; index < folds; index += 1) {
		const t = (index + 0.5) / folds;
		const x = -width / 2 + t * width;
		if (Math.abs(x) < gap) {
			continue;
		}
		const gather = 1 - Math.abs(x) / (width / 2);
		parts.push(
			cylinder(
				VELVET,
				0.07,
				0.09 + gather * 0.05,
				height - 0.55,
				x,
				0,
				-depth / 2 + 0.12 + (index % 2) * 0.05,
				8,
			),
		);
	}
	for (const side of [-1, 1]) {
		parts.push(
			torus(
				{ color: 0xc89a3a, roughness: 0.6 },
				0.12,
				0.025,
				side * (gap + width * 0.12),
				height * 0.42,
				-depth / 2 + 0.2,
			),
		);
	}
	return parts;
};

export const spinningWheel: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const radius = Math.min(height * 0.32, 0.32);
	const hub = new THREE.Vector3(width * 0.12, height - radius - 0.06, 0);
	const wheelSpin: PartAnimation = {
		kind: "spin",
		pivot: [hub.x, hub.y, hub.z],
		axis: [0, 0, 1],
		speed: 0.5,
		amplitude: 0,
		phase: rng.next() * Math.PI * 2,
	};
	const parts: Part[] = [
		box(wood, width * 0.85, 0.06, depth * 0.45, 0, 0.32, 0, 0, 0.01),
		{
			...torus(wood, radius, 0.022, hub.x, hub.y, hub.z, 0, 0),
			animation: wheelSpin,
		},
	];
	for (const [x, z] of [
		[-width * 0.36, -depth * 0.18],
		[-width * 0.36, depth * 0.18],
		[width * 0.36, 0],
	] as const) {
		parts.push(
			cylinderBetween(
				wood,
				new THREE.Vector3(x, 0, z),
				new THREE.Vector3(x * 0.9, 0.34, z * 0.7),
				0.022,
				6,
			),
		);
	}
	for (let index = 0; index < 8; index += 1) {
		const angle = (index / 8) * Math.PI * 2;
		parts.push({
			...cylinderBetween(
				wood,
				hub,
				new THREE.Vector3(
					hub.x + Math.cos(angle) * radius,
					hub.y + Math.sin(angle) * radius,
					hub.z,
				),
				0.008,
				5,
			),
			animation: wheelSpin,
		});
	}
	for (const z of [-0.06, 0.06]) {
		parts.push(
			cylinderBetween(
				wood,
				new THREE.Vector3(hub.x, 0.36, z),
				new THREE.Vector3(hub.x, hub.y, z),
				0.018,
				6,
			),
		);
	}
	parts.push(
		cylinderBetween(
			wood,
			new THREE.Vector3(-width * 0.3, 0.36, 0),
			new THREE.Vector3(-width * 0.38, height * 0.9, 0),
			0.014,
			6,
		),
		sphere(
			{ texture: "linen", color: 0xd8c8a0, roughness: 1 },
			0.07,
			-width * 0.38,
			height * 0.82,
			0,
			0.8,
			1.4,
			0.8,
			10,
		),
	);
	return parts;
};

export const coatRack: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { height } = item;
	const parts: Part[] = [
		cylinder(wood, 0.03, 0.035, height, 0, 0, 0, 10),
		sphere(wood, 0.045, 0, height, 0, 1, 1, 1, 10),
	];
	for (let index = 0; index < 4; index += 1) {
		const angle = (index / 4) * Math.PI * 2 + 0.4;
		parts.push(
			cylinderBetween(
				wood,
				new THREE.Vector3(0, 0.25, 0),
				new THREE.Vector3(Math.cos(angle) * 0.26, 0, Math.sin(angle) * 0.26),
				0.02,
				6,
			),
			cylinderBetween(
				BRASS,
				new THREE.Vector3(0, height - 0.12, 0),
				new THREE.Vector3(
					Math.cos(angle) * 0.16,
					height - 0.04,
					Math.sin(angle) * 0.16,
				),
				0.01,
				5,
			),
		);
	}
	if (rng.chance(0.75)) {
		parts.push(
			boxAt(
				{
					texture: "linen",
					color: rng.pick([0x2a2a3a, 0x3a2a1e, 0x1e2a1e]),
					roughness: 1,
				},
				0.36,
				0.95,
				0.14,
				0.1,
				height - 0.6,
				0.08,
				0.08,
				0.5,
				0,
			),
		);
	}
	if (rng.chance(0.6)) {
		parts.push(
			cylinder(DARK, 0.11, 0.11, 0.015, -0.06, height - 0.02, -0.1, 14),
			cylinder(DARK, 0.07, 0.075, 0.12, -0.06, height - 0.005, -0.1, 14),
		);
	}
	return parts;
};

export const barrelStack: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const radius = Math.min(height / 3.4, 0.36);
	const length = depth - 0.1;
	const profile: [number, number][] = [
		[radius * 0.86, 0],
		[radius, length * 0.25],
		[radius * 1.04, length * 0.5],
		[radius, length * 0.75],
		[radius * 0.86, length],
	];
	const parts: Part[] = [box(wood, width, 0.12, depth * 0.7, 0, 0, 0)];
	const bottomCount = Math.max(2, Math.floor(width / (radius * 2.05)));
	const rows: [number, number][] = [
		[bottomCount, 0.12 + radius],
		[bottomCount - 1, 0.12 + radius + radius * 1.73],
	];
	if (bottomCount >= 3) {
		rows.push([bottomCount - 2, 0.12 + radius + radius * 3.46]);
	}
	for (const [count, y] of rows) {
		if (count <= 0 || y + radius > height + 0.05) {
			continue;
		}
		for (let index = 0; index < count; index += 1) {
			const x = (index - (count - 1) / 2) * radius * 2.02;
			parts.push(
				tilted(
					{ ...wood, color: 0xb89a7a },
					profile,
					x,
					y,
					-length / 2,
					0,
					Math.PI / 2,
					14,
				),
				part(
					placed(
						new THREE.CircleGeometry(radius * 0.86, 14),
						x,
						y,
						length / 2 + 0.002,
					),
					{ texture: "woodDark", roughness: 0.9 },
				),
				torus(IRON, radius * 1.01, 0.012, x, y, -length * 0.25, 0, 0),
				torus(IRON, radius * 1.01, 0.012, x, y, length * 0.25, 0, 0),
			);
		}
	}
	return parts;
};

export const standingCoffin: FurnitureBuilder = ({ item, rng }) => {
	const wood: MaterialOptions = {
		texture: rng.pick(["woodDark", "woodRed"] as const),
		color: 0x7a6a5a,
		roughness: 0.85,
	};
	const lining: MaterialOptions = {
		texture: "velvetRed",
		color: 0x7a3a3a,
		roughness: 1,
	};
	const { width, height, depth } = item;
	const panel = 0.04;
	const shoulder = height * 0.72;
	const foot = width * 0.62;
	const parts: Part[] = [
		box(
			lining,
			width - panel * 2,
			height - panel * 2,
			panel,
			0,
			panel,
			-depth / 2 + panel / 2,
		),
		box(wood, width, panel, depth, 0, 0, 0),
		box(wood, width * 0.7, panel, depth, 0, height - panel, 0),
	];
	const sides: [number, number, number, number][] = [
		[foot / 2, 0, width / 2, shoulder],
		[width / 2, shoulder, width * 0.35, height],
	];
	for (const side of [-1, 1]) {
		for (const [x1, y1, x2, y2] of sides) {
			const length = Math.hypot(x2 - x1, y2 - y1);
			const angle = Math.atan2(x2 - x1, y2 - y1);
			parts.push(
				boxAt(
					wood,
					panel,
					length,
					depth,
					side * ((x1 + x2) / 2 - panel / 2),
					(y1 + y2) / 2,
					0,
					0,
					0,
					-side * angle,
				),
			);
		}
	}
	const open = 0.5 + rng.next() * 0.15;
	const hingeX = -width / 2;
	const front = depth / 2 + 0.01;
	const lidWidth = width - 0.04;
	const centerX = hingeX + Math.cos(open) * (lidWidth / 2);
	const centerZ = front + Math.sin(open) * (lidWidth / 2);
	parts.push(
		boxAt(
			wood,
			lidWidth,
			height - 0.06,
			0.035,
			centerX,
			height / 2,
			centerZ,
			0,
			-open,
		),
		boxAt(
			BRASS,
			0.04,
			0.5,
			0.012,
			centerX + Math.sin(open) * 0.02,
			height * 0.62,
			centerZ + 0.02,
			0,
			-open,
		),
		boxAt(
			BRASS,
			0.24,
			0.04,
			0.012,
			centerX + Math.sin(open) * 0.02,
			height * 0.7,
			centerZ + 0.02,
			0,
			-open,
		),
	);
	return parts;
};
