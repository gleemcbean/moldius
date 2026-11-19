import type { MaterialOptions } from "../MaterialLibrary";
import {
	BRASS,
	boxAt,
	candle,
	cylinder,
	type FurnitureBuilder,
	lathe,
	texturedPlane,
} from "./parts";

const DARK_WOOD: MaterialOptions = { texture: "woodDark", roughness: 0.75 };
const RED_WOOD: MaterialOptions = { texture: "woodRed", roughness: 0.7 };
const VIOLET: MaterialOptions = {
	texture: "velvetPurple",
	color: 0xd8a0ff,
	roughness: 0.9,
};
const GOLD_CLOTH: MaterialOptions = {
	texture: "linen",
	color: 0xe8b82c,
	roughness: 0.75,
};
const CIRCLE: MaterialOptions = {
	texture: "occultCircle",
	transparent: true,
	alphaTest: 0.05,
	roughness: 1,
	emissive: 0x2ee6d6,
	emissiveIntensity: 0.9,
	depthWrite: false,
};
export const OCCULT_CIRCLE_SIZE = 2.2;
const SLOPE = 0.42;

export const occultAltar: FurnitureBuilder = ({ item }) => {
	const top = item.height;
	const width = item.width * 0.74;
	const depth = item.depth * 0.68;
	const slopeDrop = Math.sin(SLOPE) * depth * 0.5;
	const deskY = top - slopeDrop - 0.03;
	const sin = Math.sin(SLOPE);
	const cos = Math.cos(SLOPE);
	const onDesk = (along: number, lift: number) => ({
		y: deskY - along * sin + lift * cos,
		z: along * cos + lift * sin,
	});
	const edge = onDesk(depth * 0.48, 0.03);
	const cloth = onDesk(0, 0.03);
	const clothTip = onDesk(depth * 0.5, 0.0);
	const foot = Math.min(item.width, item.depth) * 0.36;
	const neck = deskY - 0.07;
	return [
		texturedPlane(
			CIRCLE,
			OCCULT_CIRCLE_SIZE,
			OCCULT_CIRCLE_SIZE,
			0,
			0.025,
			0,
			0,
			-Math.PI / 2,
		),
		lathe(
			DARK_WOOD,
			[
				[0.001, 0],
				[foot, 0],
				[foot, 0.035],
				[foot * 0.86, 0.05],
				[foot * 0.84, 0.085],
				[foot * 0.55, 0.125],
				[foot * 0.34, 0.17],
				[0.078, 0.215],
				[0.096, 0.245],
				[0.066, 0.285],
				[0.052, 0.36],
				[0.046, neck - 0.055],
				[0.066, neck - 0.03],
				[0.05, neck - 0.012],
				[0.072, neck],
				[0.11, neck + 0.045],
				[0.001, neck + 0.045],
			],
			0,
			0,
			0,
			16,
		),
		cylinder(BRASS, foot * 0.87, foot * 0.87, 0.012, 0, 0.052, 0, 18),
		cylinder(BRASS, 0.1, 0.1, 0.012, 0, 0.233, 0, 14),
		...[-1, 1].flatMap((side) =>
			[-1, 1].map((end) =>
				boxAt(
					RED_WOOD,
					0.05,
					0.05,
					0.09,
					side * foot * 0.66,
					0.018,
					end * foot * 0.66,
					0,
				),
			),
		),
		boxAt(DARK_WOOD, width, 0.035, depth, 0, deskY, 0, SLOPE),
		boxAt(BRASS, width + 0.02, 0.022, 0.03, 0, edge.y, edge.z, SLOPE),
		boxAt(RED_WOOD, 0.03, 0.05, depth, -width / 2, deskY + 0.012, 0, SLOPE),
		boxAt(RED_WOOD, 0.03, 0.05, depth, width / 2, deskY + 0.012, 0, SLOPE),
		boxAt(
			VIOLET,
			width * 0.56,
			0.008,
			depth * 0.98,
			0,
			cloth.y - 0.008,
			cloth.z,
			SLOPE,
		),
		boxAt(
			GOLD_CLOTH,
			width * 0.1,
			0.01,
			depth * 0.99,
			0,
			cloth.y - 0.004,
			cloth.z,
			SLOPE,
		),
		boxAt(
			VIOLET,
			width * 0.56,
			0.11,
			0.012,
			0,
			clothTip.y - 0.055,
			clothTip.z + 0.012,
		),
		boxAt(
			GOLD_CLOTH,
			width * 0.58,
			0.03,
			0.016,
			0,
			clothTip.y - 0.11,
			clothTip.z + 0.012,
		),
		boxAt(
			GOLD_CLOTH,
			width * 0.1,
			0.11,
			0.016,
			0,
			clothTip.y - 0.055,
			clothTip.z + 0.014,
		),
		...candle(-foot * 0.9, 0, foot * 0.9, 0.16),
		...candle(foot * 0.9, 0, foot * 0.9, 0.11),
	];
};
