import { DAIS_STEP_RISE, DAIS_STEP_RUN } from "@shared/config/index";
import * as THREE from "three";
import type { MaterialOptions } from "../MaterialLibrary";
import {
	BRASS,
	box,
	boxAt,
	carvedForSeed,
	cylinder,
	cylinderBetween,
	type FurnitureBuilder,
	IRON,
	LINEN,
	lathe,
	type Part,
	pickCarved,
	pickWood,
	sphere,
} from "./parts";
import { leafMaterial, leafyBush, potMaterial } from "./plants";

function turnedLeg(
	material: MaterialOptions,
	x: number,
	z: number,
	height: number,
	radius = 0.035,
): Part {
	return lathe(
		material,
		[
			[0.001, 0],
			[radius * 0.9, 0],
			[radius * 1.1, height * 0.08],
			[radius * 0.7, height * 0.2],
			[radius * 1.25, height * 0.45],
			[radius * 0.75, height * 0.7],
			[radius, height * 0.92],
			[radius, height],
			[0.001, height],
		],
		x,
		0,
		z,
		10,
	);
}

const TRIM_WOOD: MaterialOptions = { texture: "woodDark", roughness: 0.8 };

function fabricFor(rng: { pick<T>(items: readonly T[]): T }): MaterialOptions {
	return {
		texture: rng.pick([
			"velvetRed",
			"velvetGreen",
			"velvetBlue",
			"velvetPurple",
		] as const),
		roughness: 1,
	};
}

export const table: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const round = Math.abs(width - depth) < 0.01;
	const parts: Part[] = [];
	if (round) {
		parts.push(
			cylinder(wood, width / 2, width / 2, 0.05, 0, height - 0.05, 0, 28),
		);
		parts.push(
			lathe(
				wood,
				[
					[0.001, 0],
					[width * 0.28, 0],
					[width * 0.3, 0.04],
					[0.06, 0.15],
					[0.05, height * 0.6],
					[0.08, height - 0.06],
					[0.001, height - 0.05],
				],
				0,
				0,
				0,
				16,
			),
		);
		return parts;
	}
	parts.push(box(wood, width, 0.055, depth, 0, height - 0.055, 0, 0, 0.012));
	parts.push(box(wood, width - 0.14, 0.09, depth - 0.14, 0, height - 0.14, 0));
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			parts.push(
				turnedLeg(
					wood,
					sx * (width / 2 - 0.08),
					sz * (depth / 2 - 0.08),
					height - 0.05,
				),
			);
		}
	}
	return parts;
};

export const desk: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const parts: Part[] = [
		box(wood, width, 0.05, depth, 0, height - 0.05, 0, 0, 0.012),
	];
	for (const side of [-1, 1]) {
		parts.push(
			box(
				wood,
				0.42,
				height - 0.05,
				depth - 0.06,
				side * (width / 2 - 0.23),
				0,
				0,
				0,
				0.015,
			),
		);
		for (let drawer = 0; drawer < 3; drawer += 1) {
			const y = 0.06 + drawer * ((height - 0.15) / 3);
			parts.push(
				box(
					{ ...wood, color: 0xd8cfc0 },
					0.36,
					(height - 0.15) / 3 - 0.03,
					0.015,
					side * (width / 2 - 0.23),
					y,
					-depth / 2 + 0.02,
				),
			);
			parts.push(
				sphere(
					BRASS,
					0.012,
					side * (width / 2 - 0.23),
					y + 0.09,
					-depth / 2 + 0.005,
				),
			);
		}
	}
	parts.push(
		box(
			{ texture: "leather", color: 0x4a6a3a, roughness: 0.8 },
			width * 0.55,
			0.006,
			depth * 0.6,
			0,
			height,
			0,
		),
	);
	return parts;
};

export const chair: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const fabric = fabricFor(rng);
	const { width, depth, height } = item;
	const seat = 0.46;
	const parts: Part[] = [
		box(fabric, width, 0.07, depth, 0, seat - 0.07, 0.02, 0, 0.02),
	];
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			parts.push(
				cylinder(
					wood,
					0.022,
					0.018,
					seat - 0.07,
					sx * (width / 2 - 0.04),
					0,
					sz * (depth / 2 - 0.04) + 0.02,
					8,
				),
			);
		}
		parts.push(
			boxAt(
				wood,
				0.035,
				height - seat + 0.04,
				0.035,
				sx * (width / 2 - 0.04),
				(height + seat) / 2,
				-depth / 2 + 0.05,
				-0.1,
			),
		);
	}
	parts.push(
		boxAt(
			item.variant === 1 ? fabric : wood,
			width - 0.06,
			0.32,
			0.03,
			0,
			height - 0.2,
			-depth / 2 + 0.06,
			-0.1,
		),
	);
	if (item.variant === 2) {
		for (let index = -1; index <= 1; index += 1) {
			parts.push(
				boxAt(
					wood,
					0.025,
					height - seat - 0.1,
					0.02,
					index * 0.11,
					(height + seat) / 2 - 0.05,
					-depth / 2 + 0.055,
					-0.1,
				),
			);
		}
	}
	return parts;
};

export const armchair: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const fabric = fabricFor(rng);
	const { width, height, depth } = item;
	return [
		box(fabric, width - 0.1, 0.22, depth - 0.12, 0, 0.18, 0.04, 0, 0.06),
		box(fabric, width - 0.06, 0.6, 0.2, 0, 0.2, -depth / 2 + 0.1, 0, 0.07),
		box(
			fabric,
			width + 0.04,
			height - 0.6,
			0.22,
			0,
			0.6,
			-depth / 2 + 0.09,
			0,
			0.09,
		),
		box(
			fabric,
			0.14,
			0.42,
			depth - 0.15,
			-width / 2 + 0.07,
			0.2,
			0.06,
			0,
			0.06,
		),
		box(fabric, 0.14, 0.42, depth - 0.15, width / 2 - 0.07, 0.2, 0.06, 0, 0.06),
		box(wood, width - 0.06, 0.07, depth - 0.1, 0, 0.12, 0, 0, 0.012),
		...[-1, 1].flatMap((sx) =>
			[-1, 1].map((sz) =>
				cylinder(
					wood,
					0.03,
					0.018,
					0.13,
					sx * (width / 2 - 0.08),
					0,
					sz * (depth / 2 - 0.09),
					8,
				),
			),
		),
	];
};

export const sofa: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const fabric = fabricFor(rng);
	const { width, height, depth } = item;
	const parts: Part[] = [
		box(wood, width - 0.04, 0.07, depth - 0.1, 0, 0.11, 0, 0, 0.012),
		box(fabric, width - 0.3, 0.2, depth - 0.25, 0, 0.18, 0.08, 0, 0.06),
		box(
			fabric,
			width - 0.06,
			height - 0.18,
			0.24,
			0,
			0.18,
			-depth / 2 + 0.12,
			0,
			0.08,
		),
	];
	for (const side of [-1, 1]) {
		parts.push(
			box(
				fabric,
				0.16,
				0.5,
				depth - 0.1,
				side * (width / 2 - 0.08),
				0.18,
				0.04,
				0,
				0.07,
			),
		);
		for (const end of [-1, 1]) {
			parts.push(
				cylinder(
					wood,
					0.032,
					0.02,
					0.12,
					side * (width / 2 - 0.09),
					0,
					end * (depth / 2 - 0.1),
					8,
				),
			);
		}
	}
	const cushions = Math.round(width / 0.7);
	for (let index = 0; index < cushions; index += 1) {
		const x = -width / 2 + 0.15 + ((width - 0.3) / cushions) * (index + 0.5);
		parts.push(
			box(
				fabric,
				(width - 0.3) / cushions - 0.02,
				0.08,
				depth - 0.3,
				x,
				0.38,
				0.1,
				0,
				0.035,
			),
		);
	}
	return parts;
};

export const bench: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const parts: Part[] = [
		box(wood, width, 0.06, depth, 0, height - 0.06, 0, 0, 0.012),
	];
	for (const side of [-1, 1]) {
		parts.push(
			box(
				wood,
				0.06,
				height - 0.06,
				depth - 0.06,
				side * (width / 2 - 0.12),
				0,
				0,
			),
		);
	}
	parts.push(box(wood, width - 0.3, 0.05, 0.04, 0, 0.12, 0));
	return parts;
};

export const pew: FurnitureBuilder = ({ item }) => {
	const wood: MaterialOptions = { texture: "woodDark", roughness: 0.85 };
	const { width, height, depth } = item;
	const parts: Part[] = [
		box(wood, width, 0.06, depth * 0.62, 0, 0.42, 0.05),
		boxAt(
			wood,
			width,
			height - 0.42,
			0.05,
			0,
			(height + 0.42) / 2,
			-depth / 2 + 0.06,
			-0.12,
		),
		box(wood, width, 0.05, 0.12, 0, height - 0.05, -depth / 2 + 0.03, 0, 0.01),
	];
	for (const side of [-1, 1]) {
		parts.push(
			box(wood, 0.06, height, depth, side * (width / 2 - 0.03), 0, 0, 0, 0.015),
		);
	}
	return parts;
};

export const altar: FurnitureBuilder = ({ item, rng }) => {
	const material = pickCarved(rng);
	const { width, height, depth } = item;
	return [
		box(material, width, height - 0.08, depth * 0.85, 0, 0, 0, 0, 0.02),
		box(
			material,
			width + 0.08,
			0.08,
			depth + 0.05,
			0,
			height - 0.08,
			0,
			0,
			0.015,
		),
		box(
			{ texture: "velvetRed", roughness: 1 },
			width * 0.4,
			0.005,
			depth + 0.07,
			0,
			height,
			0,
		),
		box(
			{ texture: "velvetRed", roughness: 1 },
			width * 0.4,
			height * 0.6,
			0.01,
			0,
			height * 0.4,
			depth / 2 + 0.03,
		),
	];
};

export const lectern: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	return [
		box(wood, width * 0.7, 0.06, depth * 0.7, 0, 0, 0, 0, 0.015),
		cylinder(wood, 0.05, 0.07, height - 0.15, 0, 0.06, 0, 10),
		boxAt(wood, width, 0.04, depth, 0, height - 0.06, 0, 0.45),
		boxAt(
			{ texture: "paper", roughness: 0.95 },
			width * 0.85,
			0.02,
			depth * 0.75,
			0,
			height - 0.03,
			0.01,
			0.45,
		),
	];
};

export const alchemyTable: FurnitureBuilder = (context) => {
	const parts = table(context);
	const { item, rng } = context;
	parts.push(
		box(
			{ texture: "stoneSmooth", color: 0x8a8a7a, roughness: 0.7 },
			item.width * 0.9,
			0.01,
			item.depth * 0.85,
			0,
			item.height,
			0,
		),
	);
	parts.push(
		cylinder(IRON, 0.12, 0.14, 0.05, item.width * 0.25, item.height, 0, 12),
	);
	parts.push(
		sphere(
			{
				color: 0x3a8a2a,
				emissive: 0x3aff5a,
				emissiveIntensity: 0.4,
				roughness: 0.3,
			},
			0.06,
			item.width * 0.25,
			item.height + 0.08,
			0,
		),
	);
	if (rng.chance(0.6)) {
		parts.push(
			cylinderBetween(
				BRASS,
				new THREE.Vector3(-item.width * 0.3, item.height + 0.02, -0.15),
				new THREE.Vector3(-item.width * 0.3, item.height + 0.45, -0.15),
				0.012,
			),
		);
	}
	return parts;
};

export const workbench: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const parts: Part[] = [
		box(wood, width, 0.08, depth, 0, height - 0.08, 0, 0, 0.012),
	];
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			parts.push(
				box(
					wood,
					0.08,
					height - 0.08,
					0.08,
					sx * (width / 2 - 0.08),
					0,
					sz * (depth / 2 - 0.08),
				),
			);
		}
	}
	parts.push(box(wood, width - 0.16, 0.03, depth - 0.12, 0, 0.18, 0));
	parts.push(
		box(IRON, 0.16, 0.12, 0.1, width / 2 - 0.2, height, depth / 2 - 0.08),
	);
	parts.push(
		box(
			{ texture: "burlap", roughness: 1 },
			0.5,
			0.15,
			depth * 0.5,
			-width / 4,
			0.21,
			0,
		),
	);
	return parts;
};

export const kitchenCounter: FurnitureBuilder = ({ item }) => {
	const wood: MaterialOptions = { texture: "woodPainted", roughness: 0.8 };
	const { width, height, depth } = item;
	const parts: Part[] = [
		box(wood, width, height - 0.05, depth - 0.03, 0, 0, -0.015, 0, 0.01),
		box(
			{ texture: "marble", roughness: 0.4 },
			width + 0.02,
			0.05,
			depth + 0.02,
			0,
			height - 0.05,
			0,
		),
	];
	const doors = Math.round(width / 0.6);
	for (let index = 0; index < doors; index += 1) {
		const x = -width / 2 + (width / doors) * (index + 0.5);
		parts.push(
			box(
				{ ...wood, color: 0xdcd4c4 },
				width / doors - 0.04,
				height - 0.2,
				0.015,
				x,
				0.1,
				depth / 2 - 0.02,
			),
		);
		parts.push(box(BRASS, 0.08, 0.015, 0.02, x, height - 0.2, depth / 2));
	}
	return parts;
};

export const pottingTable: FurnitureBuilder = (context) => {
	const parts = workbench(context);
	const { item, rng } = context;
	for (let index = 0; index < 4; index += 1) {
		const x = -item.width / 2 + 0.2 + index * ((item.width - 0.4) / 3);
		parts.push(
			cylinder(potMaterial(), 0.08, 0.06, 0.13, x, item.height, 0, 10),
		);
		parts.push(
			...leafyBush(
				leafMaterial(rng, "leafSprig"),
				{ texture: "foliageDark", roughness: 1 },
				new THREE.Vector3(x, item.height + 0.2, 0),
				0.1,
				rng,
				12,
				0.9,
			),
		);
	}
	return parts;
};

export const dais: FurnitureBuilder = ({ item, room, rng }) => {
	const surface = rng.chance(0.5)
		? carvedForSeed(room.seed)
		: { texture: room.style.floor, roughness: 0.85 };
	const nosing = rng.chance(0.5) ? TRIM_WOOD : BRASS;
	const tiers = Math.round(item.height / DAIS_STEP_RISE);
	const parts: Part[] = [];
	for (let tier = 0; tier < tiers; tier += 1) {
		const width = item.width - tier * DAIS_STEP_RUN * 2;
		const depth = item.depth - tier * DAIS_STEP_RUN * 2;
		parts.push(
			box(surface, width, DAIS_STEP_RISE, depth, 0, tier * DAIS_STEP_RISE, 0),
			box(
				nosing,
				width + 0.02,
				0.025,
				depth + 0.02,
				0,
				(tier + 1) * DAIS_STEP_RISE - 0.03,
				0,
			),
		);
	}
	return parts;
};

export const estrade: FurnitureBuilder = ({ item, room }) => {
	const material: MaterialOptions =
		room.type === "chapel" || room.type === "ritual"
			? { texture: "stoneFlags", roughness: 0.95 }
			: { texture: "parquet", roughness: 0.85 };
	const { width, height, depth } = item;
	return [
		box(material, width, height, depth, 0, 0, 0, 0, 0.015),
		box(
			{ texture: "woodDark", roughness: 0.8 },
			width + 0.04,
			0.05,
			depth + 0.04,
			0,
			height - 0.04,
			0,
		),
	];
};

export const bed: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const fabric = fabricFor(rng);
	const { width, depth, height } = item;
	const parts: Part[] = [
		box(wood, width, 0.3, depth - 0.1, 0, 0.08, 0.05, 0, 0.02),
		box(LINEN, width - 0.06, 0.2, depth - 0.2, 0, 0.36, 0.06, 0, 0.06),
		box(
			fabric,
			width - 0.02,
			0.06,
			depth * 0.62,
			0,
			0.53,
			depth * 0.17,
			0,
			0.03,
		),
		boxAt(fabric, width - 0.02, 0.32, 0.03, 0, 0.42, depth / 2 - 0.02, 0.05),
		box(
			wood,
			width + 0.04,
			Math.min(height, 1.3),
			0.12,
			0,
			0,
			-depth / 2 + 0.06,
			0,
			0.03,
		),
		box(wood, width + 0.04, 0.55, 0.08, 0, 0, depth / 2 - 0.04, 0, 0.02),
	];
	const pillows = width > 1.3 ? 2 : 1;
	for (let index = 0; index < pillows; index += 1) {
		const x = pillows === 1 ? 0 : (index - 0.5) * width * 0.48;
		parts.push(
			box(
				LINEN,
				width / pillows - 0.12,
				0.12,
				0.34,
				x,
				0.56,
				-depth / 2 + 0.32,
				0,
				0.05,
			),
		);
	}
	if (item.variant === 2) {
		for (const sx of [-1, 1]) {
			for (const sz of [-1, 1]) {
				parts.push(
					cylinder(
						wood,
						0.04,
						0.05,
						height,
						sx * (width / 2 - 0.04),
						0,
						sz * (depth / 2 - 0.06),
						10,
					),
				);
			}
		}
		parts.push(box(wood, width, 0.1, depth, 0, height - 0.1, 0));
		parts.push(
			box(
				{ ...fabric, side: THREE.DoubleSide },
				width + 0.02,
				0.35,
				depth + 0.02,
				0,
				height - 0.45,
				0,
			),
		);
		for (const sx of [-1, 1]) {
			parts.push(
				boxAt(
					{ ...fabric, side: THREE.DoubleSide },
					0.02,
					height - 0.6,
					0.4,
					sx * (width / 2 + 0.005),
					(height - 0.45) / 2 + 0.15,
					-depth / 2 + 0.25,
				),
			);
		}
	}
	return parts;
};
