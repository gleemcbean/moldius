import type { MaterialOptions } from "../MaterialLibrary";
import {
	BRASS,
	boxAt,
	candle,
	cylinder,
	type FurnitureBuilder,
	IRON,
	lathe,
	MARBLE,
	STONE,
	sphere,
	torus,
} from "./parts";

const DARK_STONE: MaterialOptions = { ...STONE, color: 0x5a5660 };
const OLD_WOOD: MaterialOptions = { texture: "woodDark", roughness: 0.8 };
const SANCTUARY_GLOW: MaterialOptions = {
	color: 0x8fe3a4,
	emissive: 0x4fd07a,
	emissiveIntensity: 1.6,
	roughness: 0.4,
};
const RELIC_GLOW: MaterialOptions = {
	color: 0xffd98a,
	emissive: 0xffb030,
	emissiveIntensity: 1.5,
	roughness: 0.3,
};
const BLOOD: MaterialOptions = {
	color: 0x7a0f1c,
	emissive: 0xff2438,
	emissiveIntensity: 1.3,
	roughness: 0.25,
};

function plinth(width: number, depth: number, material: MaterialOptions) {
	return [
		boxAt(material, width, 0.1, depth, 0, 0.05, 0),
		boxAt(material, width * 0.82, 0.1, depth * 0.82, 0, 0.15, 0),
	];
}

export const stakeSanctuary: FurnitureBuilder = ({ item }) => {
	const steps = 0.2;
	const bowl = item.height - 0.14;
	return [
		...plinth(item.width, item.depth, MARBLE),
		lathe(
			MARBLE,
			[
				[0.001, steps],
				[0.16, steps],
				[0.09, steps + 0.1],
				[0.06, bowl - 0.16],
				[0.1, bowl - 0.08],
				[0.26, bowl],
				[0.27, bowl + 0.02],
				[0.001, bowl + 0.02],
			],
			0,
			0,
			0,
			18,
		),
		cylinder(SANCTUARY_GLOW, 0.22, 0.22, 0.012, 0, bowl + 0.024, 0, 18),
		torus(BRASS, 0.265, 0.012, 0, bowl + 0.02, 0),
		...candle(-item.width * 0.32, steps, item.depth * 0.3, 0.2),
		...candle(item.width * 0.32, steps, item.depth * 0.3, 0.14),
		...candle(0, steps, -item.depth * 0.34, 0.24),
	];
};

export const stakeReliquary: FurnitureBuilder = ({ item }) => {
	const top = 0.2;
	const width = item.width * 0.62;
	const depth = item.depth * 0.5;
	const height = 0.34;
	return [
		...plinth(item.width, item.depth, DARK_STONE),
		boxAt(OLD_WOOD, width, height, depth, 0, top + height / 2, 0),
		boxAt(OLD_WOOD, width, 0.1, depth, 0, top + height + 0.05, 0),
		boxAt(BRASS, width + 0.02, 0.03, depth + 0.02, 0, top + height, 0),
		...[-1, 1].map((side) =>
			boxAt(
				BRASS,
				0.04,
				height + 0.1,
				depth + 0.02,
				(side * width) / 3,
				top + height / 2 + 0.05,
				0,
			),
		),
		boxAt(BRASS, 0.09, 0.11, 0.02, 0, top + height - 0.03, depth / 2 + 0.008),
		sphere(RELIC_GLOW, 0.1, 0, top + height + 0.24, 0),
		torus(IRON, 0.13, 0.008, 0, top + height + 0.24, 0),
	];
};

export const stakePact: FurnitureBuilder = ({ item }) => {
	const top = item.height - 0.08;
	const width = item.width * 0.74;
	const depth = item.depth * 0.66;
	return [
		...plinth(item.width, item.depth, DARK_STONE),
		boxAt(
			DARK_STONE,
			width * 0.7,
			top - 0.2,
			depth * 0.7,
			0,
			(top + 0.2) / 2,
			0,
		),
		boxAt(DARK_STONE, width, 0.08, depth, 0, top + 0.04, 0),
		cylinder(BLOOD, 0.16, 0.16, 0.012, 0, top + 0.085, 0, 18),
		torus(IRON, 0.17, 0.012, 0, top + 0.085, 0),
		boxAt(IRON, 0.03, 0.26, 0.012, 0, top + 0.21, -depth * 0.3, 0.2),
		boxAt(IRON, 0.1, 0.018, 0.018, 0, top + 0.27, -depth * 0.3 + 0.012, 0.2),
		...candle(-width * 0.42, top + 0.08, depth * 0.34, 0.09),
		...candle(width * 0.42, top + 0.08, depth * 0.34, 0.12),
	];
};
