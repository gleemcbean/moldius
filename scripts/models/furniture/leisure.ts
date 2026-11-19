import * as THREE from "three";
import {
	meterCircle,
	meterLathe,
	placed,
} from "../../../src/features/world/geometryUtils";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
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
import {
	bentTube,
	ellipsoid,
	hollowProfile,
	pleated,
	sculptedHead,
} from "./sculpt";

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
	const body = width * 0.78;
	const platter: PartAnimation = {
		kind: "spin",
		pivot: [0, cabinet, 0],
		axis: [0, 1, 0],
		speed: 3.4,
		amplitude: 0,
		phase: 0,
	};
	const horn: MaterialOptions = rng.chance(0.5)
		? BRASS
		: { texture: "copper", roughness: 0.4, metalness: 0.75 };
	const record: MaterialOptions = { color: 0x0e0d0c, roughness: 0.28 };
	const pillar = new THREE.Vector3(body * 0.32, cabinet, -body * 0.3);
	const parts: Part[] = [
		box(wood, body + 0.04, 0.05, body + 0.04, 0, 0, 0, 0, 0.012),
		box(wood, body, cabinet - 0.1, body, 0, 0.05, 0),
		box(wood, body + 0.035, 0.04, body + 0.035, 0, cabinet - 0.05, 0, 0, 0.012),
		box(wood, body + 0.01, 0.012, body + 0.01, 0, cabinet - 0.012, 0),
		box(
			{ ...wood, color: 0xd4c4b0 },
			body * 0.62,
			(cabinet - 0.1) * 0.56,
			0.014,
			0,
			0.05 + (cabinet - 0.1) * 0.2,
			body / 2 + 0.005,
			0,
			0.004,
		),
		sphere(
			BRASS,
			0.012,
			body * 0.25,
			0.05 + (cabinet - 0.1) * 0.48,
			body / 2 + 0.016,
			1,
			1,
			1,
			8,
		),
		{
			...cylinder(
				{ texture: "velvetGreen", color: 0x3a5a3a, roughness: 1 },
				width * 0.3,
				width * 0.3,
				0.012,
				0,
				cabinet,
				0,
				28,
			),
			animation: platter,
		},
		{
			...cylinder(
				record,
				width * 0.285,
				width * 0.285,
				0.006,
				0,
				cabinet + 0.012,
				0,
				32,
			),
			animation: platter,
		},
		{
			...cylinder(
				{ color: 0x8a2a1e, roughness: 0.7 },
				0.04,
				0.04,
				0.0025,
				0,
				cabinet + 0.0175,
				0,
				18,
			),
			animation: platter,
		},
		{
			...cylinder(BRASS, 0.004, 0.004, 0.03, 0, cabinet + 0.012, 0, 6),
			animation: platter,
		},
		cylinder(BRASS, 0.022, 0.03, 0.05, pillar.x, cabinet, pillar.z, 14),
		bentTube(
			BRASS,
			[
				[pillar.x, cabinet + 0.045, pillar.z],
				[pillar.x - 0.02, cabinet + 0.06, pillar.z + 0.08],
				[width * 0.12, cabinet + 0.05, width * 0.06],
				[width * 0.17, cabinet + 0.045, width * 0.16],
			],
			(t) => 0.011 - t * 0.003,
			16,
			8,
		),
		cylinder(
			BRASS,
			0.026,
			0.026,
			0.016,
			width * 0.17,
			cabinet + 0.032,
			width * 0.16,
			16,
		),
		cylinder(
			DARK,
			0.002,
			0.002,
			0.012,
			width * 0.17,
			cabinet + 0.02,
			width * 0.19,
			4,
		),
		bentTube(
			BRASS,
			[
				[width * 0.38, cabinet * 0.55, 0],
				[width * 0.44, cabinet * 0.55, 0],
				[width * 0.47, cabinet * 0.5, 0.03],
				[width * 0.48, cabinet * 0.42, 0.04],
			],
			0.007,
			10,
			6,
		),
		sphere(
			wood,
			0.016,
			width * 0.48,
			cabinet * 0.42 - 0.012,
			0.04,
			1,
			1.6,
			1,
			8,
		),
		bentTube(
			horn,
			[
				[pillar.x, cabinet + 0.02, pillar.z],
				[pillar.x - 0.01, cabinet + 0.12, pillar.z - 0.02],
				[pillar.x - 0.06, cabinet + 0.2, pillar.z - 0.02],
				[-width * 0.05, cabinet + 0.26, -width * 0.12],
			],
			(t) => 0.016 + t * 0.008,
			18,
			10,
		),
	];
	const bell = pleated(
		horn,
		hollowProfile(
			[
				[0.001, 0],
				[0.024, 0],
				[0.03, 0.06],
				[0.045, 0.14],
				[0.08, 0.22],
				[0.14, 0.28],
				[0.21, 0.315],
				[0.25, 0.322],
			],
			0.0035,
		),
		{ folds: 10, depth: (t) => 0.12 * t * t, segments: 60 },
		0,
		0,
		0,
	);
	bell.geometry.applyMatrix4(
		new THREE.Matrix4().compose(
			new THREE.Vector3(-width * 0.05, cabinet + 0.25, -width * 0.12),
			new THREE.Quaternion().setFromEuler(
				new THREE.Euler(1.05, 0, -0.18, "YXZ"),
			),
			new THREE.Vector3(1, 1, 1),
		),
	);
	parts.push(bell);
	return parts;
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
	const s = (height - plinth) / 1.5;
	const at = (value: number) => plinth + value * s;
	const die = plinth - 0.3;
	const parts: Part[] = [
		box(material, width, 0.1, width, 0, 0, 0, 0, 0.015),
		box(material, width * 0.93, 0.06, width * 0.93, 0, 0.1, 0, 0, 0.025),
		box(material, width * 0.8, die, width * 0.8, 0, 0.16, 0),
		box(
			material,
			width * 0.5,
			die * 0.45,
			0.012,
			0,
			0.16 + die * 0.28,
			width * 0.4 + 0.004,
			0,
			0.004,
		),
		box(
			material,
			width * 0.88,
			0.06,
			width * 0.88,
			0,
			plinth - 0.14,
			0,
			0,
			0.025,
		),
		box(
			material,
			width * 0.96,
			0.08,
			width * 0.96,
			0,
			plinth - 0.08,
			0,
			0,
			0.015,
		),
		pleated(
			material,
			[
				[0.001, 0],
				[0.3 * s, 0],
				[0.312 * s, 0.035 * s],
				[0.28 * s, 0.28 * s],
				[0.225 * s, 0.6 * s],
				[0.19 * s, 0.79 * s],
				[0.205 * s, 0.94 * s],
				[0.225 * s, 1.08 * s],
				[0.2 * s, 1.17 * s],
				[0.085 * s, 1.235 * s],
				[0.001, 1.25 * s],
			],
			{
				folds: 13,
				depth: (t) => 0.075 * (1 - t) ** 1.6 + 0.012,
				squash: 0.86,
				phase: rng.next() * 6,
			},
			0,
			plinth,
			0,
		),
		torus(material, 0.192 * s, 0.022 * s, 0, at(0.8), 0, Math.PI / 2, 0),
		bentTube(
			material,
			[
				[0.02 * s, at(0.79), 0.19 * s],
				[0.05 * s, at(0.62), 0.215 * s],
				[0.03 * s, at(0.45), 0.24 * s],
			],
			(t) => 0.014 * s * (1 - t * 0.3),
			12,
			6,
		),
		ellipsoid(
			material,
			[0.03 * s, 0.022 * s, 0.02 * s],
			0.03 * s,
			at(0.43),
			0.24 * s,
		),
		cylinder(material, 0.05 * s, 0.058 * s, 0.09 * s, 0, at(1.22), 0, 12),
		...sculptedHead(material, 0, at(1.38), 0.01 * s, s, { beard: true }),
		lathe(
			material,
			[
				[0.001, 0],
				[0.205 * s, 0],
				[0.215 * s, 0.012 * s],
				[0.19 * s, 0.024 * s],
				[0.001, 0.028 * s],
			],
			0,
			at(1.45),
			0,
			28,
		),
		bentTube(
			material,
			[
				[0, at(1.46), 0],
				[0.01 * s, at(1.62), -0.01 * s],
				[0.06 * s, at(1.78), -0.06 * s],
				[0.13 * s, at(1.84), -0.1 * s],
			],
			(t) => 0.118 * s * (1 - t) ** 1.15 + 0.004 * s,
			20,
			12,
		),
		bentTube(
			material,
			[
				[-0.19 * s, at(1.14), 0],
				[-0.27 * s, at(1.0), 0.06 * s],
				[-0.3 * s, at(0.9), 0.16 * s],
			],
			(t) => (0.062 + t * 0.03) * s,
			14,
			10,
		),
		ellipsoid(
			material,
			[0.035 * s, 0.045 * s, 0.04 * s],
			-0.3 * s,
			at(0.86),
			0.2 * s,
		),
		bentTube(
			material,
			[
				[0.19 * s, at(1.14), 0],
				[0.3 * s, at(1.04), 0.08 * s],
				[0.3 * s, at(1.2), 0.17 * s],
			],
			(t) => (0.062 + t * 0.028) * s,
			14,
			10,
		),
		ellipsoid(
			material,
			[0.035 * s, 0.04 * s, 0.045 * s],
			0.3 * s,
			at(1.26),
			0.21 * s,
		),
		sphere(material, 0.075 * s, 0.3 * s, at(1.36), 0.22 * s, 1, 1, 1, 16),
		cylinderBetween(
			material,
			new THREE.Vector3(-0.3 * s, plinth + 0.01, 0.2 * s),
			new THREE.Vector3(-0.3 * s, at(1.62), 0.2 * s),
			0.017 * s,
			10,
		),
		sphere(material, 0.045 * s, -0.3 * s, at(1.66), 0.2 * s, 1, 1, 1, 12),
		torus(
			material,
			0.06 * s,
			0.01 * s,
			-0.3 * s,
			at(1.74),
			0.2 * s,
			0,
			0,
			Math.PI * 1.4,
		),
	];
	return parts;
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

const COAT_CLOTHS = [
	"linen",
	"burlap",
	"velvetBlue",
	"velvetGreen",
	"velvetPurple",
] as const;
const COAT_TINTS = [0x3a3a4a, 0x5a4232, 0x2e3a2a, 0x6a5a48, 0x4a2a2a];

function hookPath(
	angle: number,
	y: number,
	reach: number,
): [number, number, number][] {
	const along = (distance: number, lift: number): [number, number, number] => [
		Math.cos(angle) * distance,
		y + lift,
		Math.sin(angle) * distance,
	];
	return [
		along(0.02, 0),
		along(reach * 0.55, 0.012),
		along(reach * 0.95, 0.05),
		along(reach, 0.1),
	];
}

export const coatRack: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { height } = item;
	const top = height - 0.06;
	const parts: Part[] = [
		lathe(
			wood,
			[
				[0.001, 0.12],
				[0.052, 0.12],
				[0.058, 0.15],
				[0.042, 0.18],
				[0.034, 0.21],
				[0.046, 0.25],
				[0.031, 0.29],
				[0.027, height * 0.5],
				[0.025, top - 0.2],
				[0.036, top - 0.17],
				[0.025, top - 0.14],
				[0.023, top - 0.03],
				[0.04, top - 0.01],
				[0.034, top + 0.02],
				[0.012, top + 0.045],
				[0.016, top + 0.06],
				[0.001, top + 0.075],
			],
			0,
			0,
			0,
			20,
		),
	];
	for (let index = 0; index < 4; index += 1) {
		const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
		const out = (distance: number, lift: number): [number, number, number] => [
			Math.cos(angle) * distance,
			lift,
			Math.sin(angle) * distance,
		];
		parts.push(
			bentTube(
				wood,
				[out(0.02, 0.2), out(0.12, 0.13), out(0.21, 0.05), out(0.27, 0.025)],
				(t) => 0.024 - t * 0.008,
				14,
				8,
			),
			sphere(wood, 0.024, ...out(0.275, 0.022), 1, 0.8, 1, 10),
		);
	}
	const hooks: { angle: number; y: number; tip: THREE.Vector3 }[] = [];
	for (const [tier, y, reach, count] of [
		[0, top - 0.09, 0.16, 4],
		[1, top - 0.3, 0.13, 4],
	] as const) {
		for (let index = 0; index < count; index += 1) {
			const angle = (index / count) * Math.PI * 2 + tier * (Math.PI / count);
			const path = hookPath(angle, y, reach);
			parts.push(
				bentTube(
					tier === 0 ? BRASS : wood,
					path,
					tier === 0 ? 0.008 : 0.011,
					12,
					6,
				),
				sphere(
					tier === 0 ? BRASS : wood,
					tier === 0 ? 0.016 : 0.019,
					...path[3],
					1,
					1,
					1,
					8,
				),
			);
			hooks.push({ angle, y, tip: new THREE.Vector3(...path[3]) });
		}
	}
	const lower = hooks.filter((hook) => hook.y < top - 0.2);
	const upper = hooks.filter((hook) => hook.y > top - 0.2);
	if (rng.chance(0.8)) {
		const hook = rng.pick(lower);
		const cloth: MaterialOptions = {
			texture: rng.pick(COAT_CLOTHS),
			color: rng.pick(COAT_TINTS),
			roughness: 1,
		};
		const length = rng.range(0.85, 1.05);
		const radial = hook.angle;
		const center = new THREE.Vector3(
			Math.cos(radial) * 0.19,
			hook.tip.y + 0.03,
			Math.sin(radial) * 0.19,
		);
		const turn = -radial + Math.PI / 2;
		parts.push(
			pleated(
				cloth,
				[
					[0.001, -length],
					[0.23, -length],
					[0.245, -length + 0.03],
					[0.2, -length * 0.5],
					[0.175, -0.2],
					[0.165, -0.12],
					[0.12, -0.05],
					[0.05, -0.01],
					[0.001, 0],
				],
				{
					folds: 9,
					depth: (t) => 0.11 * (1 - t) ** 1.4 + 0.015,
					squash: 0.42,
					phase: rng.next() * 6,
					sway: 0.03,
				},
				center.x,
				center.y,
				center.z,
				turn,
			),
			transformedTorus(
				cloth,
				0.06,
				0.022,
				center.x,
				center.y - 0.035,
				center.z,
				turn,
			),
		);
		for (const side of [-1, 1]) {
			const sideways = new THREE.Vector3(
				Math.cos(radial + Math.PI / 2),
				0,
				Math.sin(radial + Math.PI / 2),
			).multiplyScalar(side * 0.155);
			const shoulder = center
				.clone()
				.add(sideways)
				.add(new THREE.Vector3(0, -0.13, 0));
			parts.push(
				bentTube(
					cloth,
					[
						[shoulder.x, shoulder.y, shoulder.z],
						[
							shoulder.x + sideways.x * 0.12,
							shoulder.y - 0.28,
							shoulder.z + sideways.z * 0.12,
						],
						[
							shoulder.x + sideways.x * 0.05,
							shoulder.y - 0.55,
							shoulder.z + sideways.z * 0.05,
						],
					],
					(t) => 0.04 + t * 0.012,
					12,
					8,
				),
			);
		}
	}
	if (rng.chance(0.6)) {
		const hook = rng.pick(upper);
		const felt: MaterialOptions = {
			texture: "velvetPurple",
			color: rng.pick([0x2e2a2e, 0x3a2e24, 0x24262e]),
			roughness: 1,
		};
		const lean = new THREE.Vector3(
			Math.cos(hook.angle),
			0,
			Math.sin(hook.angle),
		);
		const base = hook.tip
			.clone()
			.add(lean.clone().multiplyScalar(0.03))
			.add(new THREE.Vector3(0, -0.05, 0));
		const hat = lathe(
			felt,
			[
				[0.001, 0],
				[0.118, 0],
				[0.128, 0.008],
				[0.12, 0.014],
				[0.075, 0.014],
				[0.071, 0.03],
				[0.073, 0.12],
				[0.077, 0.145],
				[0.07, 0.152],
				[0.001, 0.152],
			],
			0,
			0,
			0,
			24,
		);
		placed(hat.geometry, 0, 0, 0, -hook.angle, 0, -0.35);
		placed(hat.geometry, base.x, base.y, base.z);
		const band = torus(
			{ texture: "velvetRed", color: 0x5a2020, roughness: 1 },
			0.0735,
			0.007,
			0,
			0.035,
			0,
		);
		placed(band.geometry, 0, 0, 0, -hook.angle, 0, -0.35);
		placed(band.geometry, base.x, base.y, base.z);
		parts.push(hat, band);
	}
	if (rng.chance(0.45)) {
		const angle = rng.next() * Math.PI * 2;
		const foot = new THREE.Vector3(
			Math.cos(angle) * 0.2,
			0,
			Math.sin(angle) * 0.2,
		);
		const shade: MaterialOptions = {
			texture: "velvetBlue",
			color: 0x1c1c22,
			roughness: 0.9,
		};
		const umbrella = pleated(
			shade,
			[
				[0.001, 0.08],
				[0.012, 0.1],
				[0.05, 0.24],
				[0.047, 0.62],
				[0.014, 0.7],
				[0.001, 0.71],
			],
			{ folds: 8, depth: () => 0.22, segments: 32 },
			0,
			0,
			0,
		);
		const tilt = new THREE.Matrix4().makeRotationAxis(
			new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)),
			-0.16,
		);
		const shaft = cylinder(DARK, 0.006, 0.006, 0.9, 0, 0, 0, 6);
		const handle = bentTube(
			wood,
			[
				[0, 0.88, 0],
				[0, 0.95, 0],
				[0.03, 0.99, 0],
				[0.055, 0.96, 0],
			],
			0.011,
			10,
			6,
		);
		for (const piece of [umbrella, shaft, handle]) {
			piece.geometry.applyMatrix4(tilt);
			piece.geometry.translate(foot.x, foot.y, foot.z);
			parts.push(piece);
		}
	}
	return parts;
};

function transformedTorus(
	material: MaterialOptions,
	radius: number,
	tube: number,
	x: number,
	y: number,
	z: number,
	rotationY: number,
): Part {
	const ring = torus(material, radius, tube, 0, 0, 0);
	ring.geometry.scale(1, 1, 0.55);
	placed(ring.geometry, x, y, z, rotationY);
	return ring;
}

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
				part(placed(meterCircle(radius * 0.86, 14), x, y, length / 2 + 0.002), {
					texture: "woodDark",
					roughness: 0.9,
				}),
				part(
					placed(
						meterCircle(radius * 0.86, 14),
						x,
						y,
						-length / 2 - 0.002,
						Math.PI,
					),
					{
						texture: "woodDark",
						roughness: 0.9,
					},
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
