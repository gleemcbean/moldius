import * as THREE from "three";
import { placed } from "../geometryUtils";
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
	FIRE,
	type FurnitureBuilder,
	GLASS,
	IRON,
	lathe,
	type Part,
	pickCarved,
	pickWood,
	plane,
	STONE,
	sphere,
	texturedPlane,
	torus,
} from "./parts";
import { curvedLeaf } from "./plants";

const PIPE: MaterialOptions = {
	texture: "pipeMetal",
	roughness: 0.5,
	metalness: 0.55,
};
const PAINTINGS = [
	"paintingLandscape",
	"paintingPortrait",
	"paintingMushroom",
	"paintingStillLife",
	"paintingStorm",
	"paintingAbstract",
] as const;

function flameSheet(
	width: number,
	height: number,
	x: number,
	y: number,
	z: number,
	rotationY: number,
): Part {
	return {
		geometry: placed(
			new THREE.PlaneGeometry(width, height, 3, 6),
			x,
			y,
			z,
			rotationY,
			0,
		),
		material: FIRE,
	};
}

/** Plusieurs nappes de feu croisées : chacune ondule à son propre rythme. */
function flames(
	x: number,
	y: number,
	z: number,
	width: number,
	height: number,
): Part[] {
	return [
		flameSheet(width, height, x, y + height / 2, z, 0),
		flameSheet(
			width * 0.8,
			height * 0.85,
			x + width * 0.07,
			y + height * 0.42,
			z,
			Math.PI / 2,
		),
		flameSheet(
			width * 0.7,
			height * 0.75,
			x - width * 0.09,
			y + height * 0.37,
			z + 0.03,
			Math.PI / 4,
		),
		flameSheet(
			width * 0.6,
			height * 0.6,
			x + width * 0.11,
			y + height * 0.3,
			z - 0.03,
			-Math.PI / 4,
		),
	];
}

export const fireplace: FurnitureBuilder = ({ item, room, rng }) => {
	const { width, height, depth } = item;
	const stone: MaterialOptions = rng.chance(0.5) ? STONE : pickCarved(rng);
	const opening = width * 0.55;
	const pillar = (width - opening) / 2;
	const parts: Part[] = [
		box(
			stone,
			pillar,
			height - 0.15,
			depth,
			-width / 2 + pillar / 2,
			0,
			0,
			0,
			0.015,
		),
		box(
			stone,
			pillar,
			height - 0.15,
			depth,
			width / 2 - pillar / 2,
			0,
			0,
			0,
			0.015,
		),
		box(
			stone,
			width + 0.12,
			0.15,
			depth + 0.1,
			0,
			height - 0.15,
			0.03,
			0,
			0.02,
		),
		box(stone, opening, height * 0.35, depth, 0, height * 0.5, 0),
		box(DARK, opening, height * 0.5, 0.05, 0, 0, -depth / 2 + 0.05),
		box(
			{ texture: "stoneBlocks", color: 0xc8c0b0, roughness: 1 },
			width * 0.85,
			room.ceilingY - item.y - height,
			depth * 0.75,
			0,
			height,
			-depth * 0.1,
		),
		box(
			{ texture: "stoneFlags", roughness: 1 },
			width + 0.2,
			0.04,
			0.45,
			0,
			0,
			depth / 2 + 0.2,
		),
	];
	for (let index = 0; index < 3; index += 1) {
		const log = new THREE.CylinderGeometry(0.05, 0.05, opening * 0.7, 8);
		log.rotateZ(Math.PI / 2);
		log.rotateY((index - 1) * 0.3);
		log.translate(0, 0.07 + (index === 1 ? 0.07 : 0), (index - 1) * 0.06);
		parts.push({ geometry: log, material: { texture: "bark", roughness: 1 } });
	}
	parts.push(...flames(0, 0.08, 0, opening * 0.55, height * 0.35));
	parts.push(
		...flames(-opening * 0.15, 0.08, 0.05, opening * 0.3, height * 0.25),
	);
	return parts;
};

export const stove: FurnitureBuilder = ({ item, room }) => {
	const { width, height, depth } = item;
	return [
		box(IRON, width, height - 0.05, depth, 0, 0.05, 0, 0, 0.02),
		box(
			{ ...IRON, color: 0x2a2a2a },
			width + 0.04,
			0.04,
			depth + 0.04,
			0,
			height - 0.04,
			0,
		),
		box(
			{
				color: 0x2a1205,
				emissive: 0xff6a20,
				emissiveIntensity: 1.4,
				roughness: 0.6,
			},
			width * 0.3,
			height * 0.28,
			0.01,
			-width * 0.2,
			height * 0.3,
			depth / 2 + 0.005,
		),
		box(
			BRASS,
			width * 0.34,
			0.03,
			0.03,
			-width * 0.2,
			height * 0.62,
			depth / 2 + 0.02,
		),
		cylinder(
			IRON,
			0.08,
			0.08,
			room.ceilingY - item.y - height,
			width * 0.3,
			height,
			-depth * 0.25,
			12,
		),
		cylinder(IRON, 0.13, 0.13, 0.02, width * 0.15, height, depth * 0.1, 14),
		cylinder(
			COPPER,
			0.12,
			0.11,
			0.16,
			width * 0.15,
			height + 0.02,
			depth * 0.1,
			14,
		),
	];
};

export const sink: FurnitureBuilder = ({ item }) => {
	const { width, height, depth } = item;
	return [
		lathe(
			CERAMIC,
			[
				[0.001, 0],
				[0.12, 0],
				[0.08, 0.1],
				[0.07, height - 0.25],
				[0.1, height - 0.2],
				[0.001, height - 0.2],
			],
			0,
			0,
			0,
			14,
		),
		box(CERAMIC, width, 0.16, depth, 0, height - 0.16, 0, 0, 0.05),
		box(
			{ color: 0x2a3a3a, roughness: 0.3, metalness: 0.4 },
			width - 0.12,
			0.01,
			depth - 0.14,
			0,
			height - 0.005,
			0.02,
		),
		cylinderBetween(
			BRASS,
			new THREE.Vector3(0, height, -depth / 2 + 0.06),
			new THREE.Vector3(0, height + 0.22, -depth / 2 + 0.06),
			0.015,
		),
		cylinderBetween(
			BRASS,
			new THREE.Vector3(0, height + 0.22, -depth / 2 + 0.06),
			new THREE.Vector3(0, height + 0.2, -depth / 2 + 0.2),
			0.013,
		),
		sphere(BRASS, 0.025, -0.08, height + 0.04, -depth / 2 + 0.06),
		sphere(BRASS, 0.025, 0.08, height + 0.04, -depth / 2 + 0.06),
	];
};

export const toilet: FurnitureBuilder = ({ item }) => {
	const { width, depth, height } = item;
	return [
		lathe(
			CERAMIC,
			[
				[0.001, 0],
				[0.13, 0],
				[0.11, 0.2],
				[0.19, 0.38],
				[0.2, 0.42],
				[0.001, 0.42],
			],
			0,
			0,
			0.08,
			16,
		),
		box(
			{ texture: "woodMedium", roughness: 0.7 },
			width * 0.9,
			0.03,
			0.42,
			0,
			0.42,
			0.08,
			0,
			0.02,
		),
		box(CERAMIC, width, height - 0.45, 0.2, 0, 0.45, -depth / 2 + 0.1, 0, 0.03),
		cylinderBetween(
			PIPE,
			new THREE.Vector3(width * 0.3, height, -depth / 2 + 0.05),
			new THREE.Vector3(width * 0.3, height + 0.9, -depth / 2 + 0.05),
			0.018,
		),
		box(BRASS, 0.08, 0.02, 0.03, width * 0.3, height - 0.12, -depth / 2 + 0.21),
	];
};

export const bathtub: FurnitureBuilder = ({ item }) => {
	const { width, height, depth } = item;
	const enamel: MaterialOptions = { texture: "ceramic", roughness: 0.25 };
	const wall = 0.07;
	const rim = 0.018;
	const parts: Part[] = [
		box(enamel, width, 0.07, depth, 0, 0.12, 0, 0, rim),
		box(
			{ color: 0x6f8f92, roughness: 0.18, metalness: 0.05 },
			width - wall,
			0.012,
			depth - wall,
			0,
			height - 0.14,
			0,
		),
	];
	for (const side of [-1, 1]) {
		parts.push(
			box(
				enamel,
				width,
				height - 0.12,
				wall,
				0,
				0.12,
				side * (depth - wall) * 0.5,
				0,
				rim,
			),
			box(
				enamel,
				wall,
				height - 0.12,
				depth,
				side * (width - wall) * 0.5,
				0.12,
				0,
				0,
				rim,
			),
		);
	}
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			parts.push(
				sphere(
					BRASS,
					0.05,
					sx * (width / 2 - 0.15),
					0.07,
					sz * (depth / 2 - 0.12),
					1,
					1.3,
					1,
					10,
				),
			);
		}
	}
	parts.push(
		cylinderBetween(
			BRASS,
			new THREE.Vector3(-width / 2 + 0.06, height - 0.1, 0),
			new THREE.Vector3(-width / 2 + 0.06, height + 0.25, 0),
			0.02,
		),
	);
	parts.push(
		cylinderBetween(
			BRASS,
			new THREE.Vector3(-width / 2 + 0.06, height + 0.25, 0),
			new THREE.Vector3(-width / 2 + 0.2, height + 0.2, 0),
			0.016,
		),
	);
	return parts;
};

function valveWheel(x: number, y: number, z: number, radius: number): Part[] {
	const parts: Part[] = [
		torus(
			{ texture: "iron", color: 0xa02a1e, roughness: 0.5, metalness: 0.4 },
			radius,
			0.018,
			x,
			y,
			z,
			0,
		),
	];
	for (let index = 0; index < 4; index += 1) {
		const angle = (index / 4) * Math.PI;
		parts.push(
			cylinderBetween(
				IRON,
				new THREE.Vector3(
					x - Math.cos(angle) * radius,
					y - Math.sin(angle) * radius,
					z,
				),
				new THREE.Vector3(
					x + Math.cos(angle) * radius,
					y + Math.sin(angle) * radius,
					z,
				),
				0.01,
			),
		);
	}
	parts.push(
		cylinderBetween(
			IRON,
			new THREE.Vector3(x, y, z - 0.12),
			new THREE.Vector3(x, y, z + 0.02),
			0.025,
		),
	);
	return parts;
}

export const valveStation: FurnitureBuilder = ({ item, room }) => {
	const { width, depth } = item;
	const back = -depth / 2 + 0.18;
	const top = room.ceilingY - item.y;
	const green: MaterialOptions = {
		texture: "copper",
		color: 0x7fa88a,
		roughness: 0.5,
		metalness: 0.5,
	};
	const parts: Part[] = [
		cylinder(green, 0.14, 0.14, top, -width / 2 + 0.2, 0, back, 16),
		cylinder(green, 0.17, 0.17, 0.08, -width / 2 + 0.2, 0.4, back, 16),
		cylinder(green, 0.17, 0.17, 0.08, -width / 2 + 0.2, 1.9, back, 16),
		cylinderBetween(
			green,
			new THREE.Vector3(-width / 2 + 0.2, 2.55, back),
			new THREE.Vector3(width / 2 - 0.15, 2.55, back),
			0.1,
		),
		sphere(green, 0.12, width / 2 - 0.15, 2.55, back),
		cylinderBetween(
			green,
			new THREE.Vector3(width / 2 - 0.15, 2.55, back),
			new THREE.Vector3(width / 2 - 0.15, 0.8, back),
			0.09,
		),
		cylinderBetween(
			green,
			new THREE.Vector3(width / 2 - 0.15, 1.15, back),
			new THREE.Vector3(width / 2 - 0.3, 1.15, -depth / 2 + 0.3),
			0.06,
		),
		cylinderBetween(
			green,
			new THREE.Vector3(0, 2.55, back),
			new THREE.Vector3(0, 2.4, depth / 2 + 0.25),
			0.07,
		),
		lathe(
			BRASS,
			[
				[0.001, 0.12],
				[0.07, 0.12],
				[0.1, 0.02],
				[0.12, 0],
				[0.001, 0],
			],
			0,
			2.25,
			depth / 2 + 0.25,
			14,
		),
		box(
			{ texture: "iron", color: 0x3a4a3a, roughness: 0.7, metalness: 0.4 },
			0.7,
			0.02,
			0.7,
			0,
			0,
			depth / 2 + 0.25,
		),
		cylinder(
			{ color: 0x0a1208, roughness: 1 },
			0.25,
			0.25,
			0.021,
			0,
			0,
			depth / 2 + 0.25,
			18,
		),
		box(
			{ texture: "iron", color: 0xd8d0b0, roughness: 0.6 },
			0.22,
			0.22,
			0.02,
			width / 2 - 0.15,
			1.6,
			back + 0.11,
		),
	];
	parts.push(...valveWheel(width / 2 - 0.3, 1.15, -depth / 2 + 0.42, 0.13));
	parts.push(
		sphere(
			{
				color: 0x6dff7a,
				emissive: 0x3aff5a,
				emissiveIntensity: 0.5,
				roughness: 0.4,
			},
			0.03,
			width / 2 - 0.15,
			1.6,
			back + 0.13,
		),
	);
	return parts;
};

export const pipeRun: FurnitureBuilder = ({ item, room }) => {
	const { width } = item;
	const top = room.ceilingY - item.y;
	const bottom = room.floorY - item.y;
	const z = 0.12;
	const parts: Part[] = [];
	if (item.variant === 1) {
		for (const x of [-width / 4, width / 4]) {
			parts.push(cylinder(PIPE, 0.07, 0.07, top - bottom, x, bottom, z, 12));
			parts.push(cylinder(PIPE, 0.095, 0.095, 0.05, x, bottom + 1.2, z, 12));
		}
		parts.push(
			cylinderBetween(
				PIPE,
				new THREE.Vector3(-width / 4, 0.1, z),
				new THREE.Vector3(width / 4, 0.1, z),
				0.05,
			),
		);
		parts.push(...valveWheel(0, 0.1, z + 0.12, 0.1));
		return parts;
	}
	const radius = item.variant === 2 ? 0.045 : 0.075;
	const rows = item.variant === 2 ? [0.1, 0.24] : [0.2];
	for (const y of rows) {
		parts.push(
			cylinderBetween(
				PIPE,
				new THREE.Vector3(-width / 2 + 0.1, y, z),
				new THREE.Vector3(width / 2 - 0.1, y, z),
				radius,
			),
		);
		for (const x of [-width / 2 + 0.1, width / 2 - 0.1]) {
			parts.push(sphere(PIPE, radius * 1.15, x, y, z, 1, 1, 1, 10));
			parts.push(
				cylinderBetween(
					PIPE,
					new THREE.Vector3(x, y, z),
					new THREE.Vector3(x, top, z),
					radius,
				),
			);
		}
		for (let x = -width / 2 + 0.6; x < width / 2 - 0.4; x += 0.8) {
			parts.push(
				cylinderBetween(
					PIPE,
					new THREE.Vector3(x - 0.03, y, z),
					new THREE.Vector3(x + 0.03, y, z),
					radius * 1.35,
				),
			);
			parts.push(box(IRON, 0.04, 0.08, z, x, y + radius, z / 2));
		}
	}
	if (item.variant === 0) {
		parts.push(...valveWheel(0, 0.2, z + 0.1, 0.08));
	}
	return parts;
};

export const electricMeter: FurnitureBuilder = ({ item, room }) => {
	const { width, height } = item;
	const top = room.ceilingY - item.y;
	return [
		box(
			{ texture: "woodDark", roughness: 0.9 },
			width + 0.08,
			height + 0.08,
			0.03,
			0,
			-0.04,
			0.015,
		),
		box(
			{ texture: "iron", color: 0x2a2a2a, roughness: 0.6 },
			width,
			height,
			0.14,
			0,
			0,
			0.1,
			0,
			0.02,
		),
		cylinder(
			{ ...GLASS, opacity: 0.5 },
			0.09,
			0.09,
			0.02,
			0,
			height * 0.6,
			0.18,
			18,
		),
		texturedPlane(
			{ texture: "ceramic", roughness: 0.4 },
			0.15,
			0.15,
			0,
			height * 0.6,
			0.173,
		),
		boxAt(DARK, 0.005, 0.07, 0.004, 0.01, height * 0.62, 0.176, 0, 0, 0.7),
		box(BRASS, 0.06, 0.03, 0.02, -width * 0.25, height * 0.2, 0.18),
		box(BRASS, 0.06, 0.03, 0.02, width * 0.25, height * 0.2, 0.18),
		cylinder(
			{ color: 0x1a1a1a, roughness: 0.6 },
			0.012,
			0.012,
			top - height,
			-0.05,
			height,
			0.06,
			6,
		),
		cylinder(
			{ color: 0x5a1a1a, roughness: 0.6 },
			0.012,
			0.012,
			top - height,
			0.05,
			height,
			0.06,
			6,
		),
	];
};

export const window: FurnitureBuilder = ({ item, room, rng }) => {
	const { width, height } = item;
	const wood: MaterialOptions = { texture: "woodDark", roughness: 0.8 };
	const parts: Part[] = [];
	if (item.variant === 3) {
		const radius = width / 2;
		parts.push(torus(wood, radius, 0.06, 0, radius, 0.03, 0));
		parts.push({
			geometry: new THREE.CircleGeometry(radius - 0.03, 20).translate(
				0,
				radius,
				0.005,
			),
			material: { texture: "windowNight", fixedRepeat: true, roughness: 1 },
		});
		parts.push(boxAt(wood, width - 0.1, 0.04, 0.04, 0, radius, 0.04));
		parts.push(boxAt(wood, 0.04, width - 0.1, 0.04, 0, radius, 0.04));
		return parts;
	}
	const lancet = item.variant === 4;
	parts.push(
		texturedPlane(
			{ texture: "windowNight", roughness: 1 },
			width - 0.08,
			height - 0.08,
			0,
			height / 2,
			0.006,
		),
	);
	parts.push(box(wood, width + 0.1, 0.07, 0.08, 0, height - 0.035, 0.04));
	parts.push(box(wood, 0.07, height, 0.08, -width / 2 - 0.015, 0, 0.04));
	parts.push(box(wood, 0.07, height, 0.08, width / 2 + 0.015, 0, 0.04));
	parts.push(box(wood, width + 0.2, 0.06, 0.2, 0, -0.06, 0.08, 0, 0.012));
	const columns = lancet ? 2 : 2;
	const rows = lancet ? 4 : height > 1.4 ? 3 : 2;
	for (let index = 1; index < columns; index += 1) {
		parts.push(
			box(
				wood,
				0.035,
				height,
				0.04,
				-width / 2 + (width / columns) * index,
				0,
				0.03,
			),
		);
	}
	for (let index = 1; index < rows; index += 1) {
		parts.push(box(wood, width, 0.03, 0.04, 0, (height / rows) * index, 0.03));
	}
	if (lancet) {
		const colors = [0x8a1a2a, 0x1a3a8a, 0xc9a22a, 0x2a6a3a];
		for (let row = 0; row < rows; row += 1) {
			for (let column = 0; column < columns; column += 1) {
				parts.push(
					plane(
						{
							color: colors[(row + column) % colors.length],
							emissive: colors[(row + column) % colors.length],
							emissiveIntensity: 0.18,
							transparent: true,
							opacity: 0.55,
							roughness: 0.3,
							depthWrite: false,
						},
						width / columns - 0.04,
						height / rows - 0.04,
						-width / 2 + (width / columns) * (column + 0.5),
						(height / rows) * (row + 0.5),
						0.018,
					),
				);
			}
		}
	} else {
		parts.push(plane(GLASS, width - 0.06, height - 0.06, 0, height / 2, 0.02));
	}
	if (item.variant <= 1 && room.type !== "greenhouse") {
		const curtain: MaterialOptions = {
			texture: rng.pick([
				"velvetRed",
				"velvetGreen",
				"velvetBlue",
				"velvetPurple",
			] as const),
			roughness: 1,
			side: THREE.DoubleSide,
		};
		const bottom = room.floorY - item.y + 0.05;
		const curtainHeight = height + 0.3 - bottom;
		for (const side of [-1, 1]) {
			parts.push(
				box(
					curtain,
					0.28,
					curtainHeight,
					0.06,
					side * (width / 2 + 0.16),
					bottom,
					0.12,
					0,
					0.03,
				),
			);
			parts.push(
				box(
					{ texture: "brass", roughness: 0.4 },
					0.3,
					0.04,
					0.08,
					side * (width / 2 + 0.16),
					height * 0.45,
					0.14,
				),
			);
		}
		parts.push(
			cylinderBetween(
				BRASS,
				new THREE.Vector3(-width / 2 - 0.35, height + 0.3, 0.12),
				new THREE.Vector3(width / 2 + 0.35, height + 0.3, 0.12),
				0.018,
			),
		);
	}
	return parts;
};

export const mirror: FurnitureBuilder = ({ item }) => {
	const { width, height } = item;
	const frame: MaterialOptions = {
		texture: "brass",
		roughness: 0.45,
		metalness: 0.7,
	};
	return [
		box(frame, width + 0.1, height + 0.1, 0.04, 0, -0.05, 0.02, 0, 0.015),
		texturedPlane(
			{ texture: "mirror", roughness: 0.1, metalness: 0.9 },
			width,
			height,
			0,
			height / 2,
			0.042,
		),
	];
};

export const painting: FurnitureBuilder = ({ item, rng }) => {
	const { width, height } = item;
	const frame: MaterialOptions = rng.chance(0.5)
		? { texture: "brass", roughness: 0.5, metalness: 0.6 }
		: { texture: "woodDark", roughness: 0.7 };
	return [
		box(frame, width + 0.1, height + 0.1, 0.05, 0, -0.05, 0.025, 0, 0.015),
		texturedPlane(
			{ texture: rng.pick(PAINTINGS), roughness: 0.85 },
			width,
			height,
			0,
			height / 2,
			0.052,
		),
	];
};

export const tapestry: FurnitureBuilder = ({ item }) => {
	const { width, height } = item;
	return [
		{
			geometry: placed(
				new THREE.PlaneGeometry(width, height, 6, 8),
				0,
				height / 2,
				0.03,
				0,
				0,
			),
			material: {
				texture: "tapestry",
				roughness: 1,
				side: THREE.DoubleSide,
				fixedRepeat: true,
				wave: "cloth",
			},
		},
		cylinderBetween(
			BRASS,
			new THREE.Vector3(-width / 2 - 0.08, height + 0.02, 0.04),
			new THREE.Vector3(width / 2 + 0.08, height + 0.02, 0.04),
			0.016,
		),
	];
};

export const sconce: FurnitureBuilder = () => [
	box(BRASS, 0.1, 0.18, 0.02, 0, 0.02, 0.01, 0, 0.01),
	cylinderBetween(
		BRASS,
		new THREE.Vector3(0, 0.08, 0.02),
		new THREE.Vector3(0, 0.14, 0.16),
		0.012,
	),
	cylinder(BRASS, 0.04, 0.025, 0.03, 0, 0.13, 0.16, 10),
	...candle(0, 0.16, 0.16, 0.12, 0.018),
];

export const chandelier: FurnitureBuilder = ({ item }) => {
	const { width, height } = item;
	const radius = width / 2 - 0.08;
	const parts: Part[] = [
		cylinderBetween(
			IRON,
			new THREE.Vector3(0, height, 0),
			new THREE.Vector3(0, 0.25, 0),
			0.012,
		),
		torus(IRON, radius, 0.02, 0, 0.15, 0),
		lathe(
			IRON,
			[
				[0.001, 0.05],
				[0.08, 0.1],
				[0.05, 0.3],
				[0.001, 0.35],
			],
			0,
			0,
			0,
			10,
		),
	];
	const arms = width > 1.2 ? 8 : 6;
	for (let index = 0; index < arms; index += 1) {
		const angle = (index / arms) * Math.PI * 2;
		const x = Math.cos(angle) * radius;
		const z = Math.sin(angle) * radius;
		parts.push(
			cylinderBetween(
				IRON,
				new THREE.Vector3(0, 0.25, 0),
				new THREE.Vector3(x, 0.15, z),
				0.01,
			),
		);
		parts.push(cylinder(BRASS, 0.035, 0.025, 0.03, x, 0.15, z, 8));
		parts.push(...candle(x, 0.18, z, 0.12, 0.018));
	}
	return parts;
};

export const floorLamp: FurnitureBuilder = ({ item, rng }) => {
	const shade: MaterialOptions = {
		texture: rng.pick(["velvetRed", "linen", "velvetGreen"] as const),
		roughness: 1,
		emissive: 0xffb46a,
		emissiveIntensity: 0.35,
		side: THREE.DoubleSide,
	};
	return [
		lathe(
			BRASS,
			[
				[0.001, 0],
				[0.18, 0],
				[0.16, 0.04],
				[0.03, 0.08],
				[0.001, 0.08],
			],
			0,
			0,
			0,
			16,
		),
		cylinder(BRASS, 0.015, 0.02, item.height - 0.35, 0, 0.08, 0, 8),
		lathe(
			shade,
			[
				[0.12, 0],
				[0.2, 0],
				[0.13, 0.3],
				[0.09, 0.3],
			],
			0,
			item.height - 0.35,
			0,
			18,
		),
		sphere(
			{
				color: 0xfff0c0,
				emissive: 0xffd080,
				emissiveIntensity: 1.5,
				roughness: 0.3,
			},
			0.04,
			0,
			item.height - 0.25,
			0,
		),
	];
};

export const candelabra: FurnitureBuilder = ({ item }) => {
	const height = item.height - 0.2;
	const parts: Part[] = [
		lathe(
			BRASS,
			[
				[0.001, 0],
				[0.2, 0],
				[0.18, 0.05],
				[0.05, 0.12],
				[0.04, height * 0.5],
				[0.06, height * 0.55],
				[0.03, height],
				[0.001, height],
			],
			0,
			0,
			0,
			14,
		),
	];
	for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
		const x = Math.cos(angle) * 0.18;
		const z = Math.sin(angle) * 0.18;
		parts.push(
			cylinderBetween(
				BRASS,
				new THREE.Vector3(0, height - 0.1, 0),
				new THREE.Vector3(x, height, z),
				0.012,
			),
		);
		parts.push(...candle(x, height, z, 0.16));
	}
	parts.push(...candle(0, height, 0, 0.2));
	return parts;
};

export const wallShelf: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const parts: Part[] = [
		box(wood, item.width, 0.03, item.depth, 0, 0.12, item.depth / 2),
	];
	for (const side of [-1, 1]) {
		parts.push(
			boxAt(
				IRON,
				0.02,
				0.12,
				0.02,
				side * (item.width / 2 - 0.1),
				0.06,
				0.06,
				0.7,
			),
		);
	}
	for (let x = -item.width / 2 + 0.1; x < item.width / 2 - 0.05; x += 0.16) {
		parts.push(
			cylinder(
				rng.chance(0.5) ? CERAMIC : { ...GLASS, color: 0x8a6a3a, opacity: 0.7 },
				0.045,
				0.05,
				0.14 + rng.next() * 0.08,
				x,
				0.15,
				item.depth / 2,
				10,
			),
		);
	}
	return parts;
};

export const hangingHerbs: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [
		cylinderBetween(
			{ texture: "woodMedium" },
			new THREE.Vector3(-item.width / 2, item.height, 0.12),
			new THREE.Vector3(item.width / 2, item.height, 0.12),
			0.02,
		),
	];
	for (let x = -item.width / 2 + 0.1; x < item.width / 2 - 0.05; x += 0.14) {
		const length = 0.24 + rng.next() * 0.22;
		const root = new THREE.Vector3(x, item.height - 0.015, 0.12);
		const herb: MaterialOptions = {
			texture: "leafBlade",
			color: rng.pick([0xc4b060, 0x9aa858, 0xb09a58] as const),
			roughness: 1,
			alphaTest: 0.5,
			side: THREE.DoubleSide,
		};
		for (let leaf = 0; leaf < 6; leaf += 1) {
			parts.push(
				curvedLeaf(
					herb,
					root,
					0.05,
					length * (0.75 + rng.next() * 0.25),
					(leaf / 6) * Math.PI * 2 + rng.next() * 0.4,
					Math.PI - 0.1 - rng.next() * 0.2,
					0.12 + rng.next() * 0.2,
				),
			);
		}
		parts.push(
			cylinder(BRASS, 0.012, 0.012, 0.02, x, item.height - 0.03, 0.12, 6),
		);
	}
	return parts;
};
