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
	const width = item.width;
	const depth = item.depth;
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
		boxAt(RED_WOOD, width * 0.72, 0.06, depth * 0.78, 0, 0.03, 0),
		boxAt(DARK_WOOD, width * 0.52, 0.06, depth * 0.56, 0, 0.09, 0),
		lathe(
			DARK_WOOD,
			[
				[0.075, 0.12],
				[0.055, 0.2],
				[0.085, 0.27],
				[0.05, 0.36],
				[0.042, deskY - 0.16],
				[0.075, deskY - 0.1],
				[0.11, deskY - 0.02],
			],
			0,
			0,
			0,
			12,
		),
		cylinder(BRASS, 0.09, 0.09, 0.012, 0, 0.28, 0, 12),
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
			0.2,
			0.012,
			0,
			clothTip.y - 0.1,
			clothTip.z + 0.012,
		),
		boxAt(
			GOLD_CLOTH,
			width * 0.58,
			0.035,
			0.016,
			0,
			clothTip.y - 0.2,
			clothTip.z + 0.012,
		),
		boxAt(
			GOLD_CLOTH,
			width * 0.1,
			0.2,
			0.016,
			0,
			clothTip.y - 0.1,
			clothTip.z + 0.014,
		),
		...candle(-width * 0.3, 0.06, depth * 0.3, 0.12),
		...candle(width * 0.3, 0.06, depth * 0.3, 0.09),
	];
};
