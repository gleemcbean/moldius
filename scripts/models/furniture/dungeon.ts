import * as THREE from "three";
import { meterTorus, placed } from "../geometryUtils";
import type { MaterialOptions } from "../MaterialLibrary";
import {
	box,
	boxAt,
	candle,
	cylinder,
	cylinderBetween,
	type FurnitureBuilder,
	GLASS,
	IRON,
	lathe,
	type Part,
	part,
	plane,
	sphere,
	texturedPlane,
} from "./parts";

const BAR_SPACING = 0.13;
const STRAW: MaterialOptions = { color: 0x8a7638, roughness: 1 };
const BONE: MaterialOptions = { color: 0xd8ceb0, roughness: 0.8 };

function link(x: number, y: number, z: number, turned: boolean): Part {
	return part(
		placed(meterTorus(0.026, 0.007, 4, 8), x, y, z, turned ? Math.PI / 2 : 0),
		IRON,
	);
}

export const cellBars: FurnitureBuilder = ({ item, rng }) => {
	const { width, depth, height } = item;
	const front = depth / 2 - 0.03;
	const back = -depth / 2;
	const barHeight = height - 0.06;
	const parts: Part[] = [];
	const frontCount = Math.max(4, Math.round(width / BAR_SPACING));
	for (let index = 0; index <= frontCount; index += 1) {
		const x = -width / 2 + (index * width) / frontCount;
		parts.push(cylinder(IRON, 0.012, 0.012, barHeight, x, 0.03, front, 6));
	}
	const sideCount = Math.max(3, Math.round(depth / BAR_SPACING));
	for (const side of [-1, 1]) {
		for (let index = 0; index < sideCount; index += 1) {
			const z = back + (index * (front - back)) / sideCount;
			parts.push(
				cylinder(IRON, 0.012, 0.012, barHeight, (side * width) / 2, 0.03, z, 6),
			);
		}
	}
	for (const y of [0.04, height * 0.48, height - 0.05]) {
		parts.push(boxAt(IRON, width + 0.03, 0.04, 0.025, 0, y, front));
		for (const side of [-1, 1]) {
			parts.push(
				boxAt(
					IRON,
					0.025,
					0.04,
					front - back,
					(side * width) / 2,
					y,
					(front + back) / 2,
				),
			);
		}
	}
	const doorWidth = Math.min(0.75, width * 0.4);
	const doorX = rng.range(
		-width / 2 + doorWidth / 2 + 0.15,
		width / 2 - doorWidth / 2 - 0.15,
	);
	for (const edge of [-1, 1]) {
		parts.push(
			boxAt(
				IRON,
				0.035,
				height * 0.86,
				0.035,
				doorX + (edge * doorWidth) / 2,
				height * 0.45,
				front + 0.02,
			),
		);
	}
	parts.push(
		boxAt(IRON, doorWidth, 0.035, 0.035, doorX, height * 0.88, front + 0.02),
		box(
			IRON,
			0.09,
			0.13,
			0.05,
			doorX + doorWidth / 2 - 0.08,
			height * 0.42,
			front + 0.04,
		),
		plane(
			STRAW,
			width * 0.7,
			(front - back) * 0.6,
			rng.range(-0.2, 0.2),
			0.012,
			back + (front - back) * 0.4,
			rng.range(-0.3, 0.3),
			-Math.PI / 2,
		),
	);
	const shackleX = rng.range(-width / 4, width / 4);
	for (let index = 0; index < 5; index += 1) {
		parts.push(
			link(shackleX, 1.45 - index * 0.05, back + 0.04, index % 2 === 1),
		);
	}
	parts.push(
		part(
			placed(meterTorus(0.06, 0.012, 6, 12), shackleX, 1.15, back + 0.05),
			IRON,
		),
	);
	if (rng.chance(0.6)) {
		parts.push(
			sphere(
				BONE,
				0.09,
				rng.range(-width / 3, width / 3),
				0.08,
				back + 0.3,
				1,
				0.9,
				1.1,
				10,
			),
		);
	}
	return parts;
};

export const hangingChains: FurnitureBuilder = ({ item, rng }) => {
	const { width, depth, height } = item;
	const parts: Part[] = [];
	const count = rng.int(2, 4);
	for (let chain = 0; chain < count; chain += 1) {
		const x = rng.range(-width / 2 + 0.1, width / 2 - 0.1);
		const z = rng.range(-depth / 2 + 0.1, depth / 2 - 0.1);
		const length = rng.range(height * 0.45, height - 0.05);
		parts.push(cylinder(IRON, 0.045, 0.045, 0.02, x, height - 0.02, z, 8));
		const links = Math.floor(length / 0.048);
		const turn = rng.range(0, Math.PI);
		for (let index = 0; index < links; index += 1) {
			parts.push(
				part(
					placed(
						meterTorus(0.026, 0.007, 4, 8),
						x,
						height - 0.05 - index * 0.048,
						z,
						turn + (index % 2 === 1 ? Math.PI / 2 : 0),
					),
					IRON,
				),
			);
		}
		const end = height - 0.05 - links * 0.048;
		if (rng.chance(0.5)) {
			parts.push(
				part(
					placed(meterTorus(0.06, 0.011, 6, 14), x, end - 0.04, z, turn),
					IRON,
				),
			);
		} else {
			parts.push(
				cylinderBetween(
					IRON,
					new THREE.Vector3(x, end, z),
					new THREE.Vector3(x, end - 0.12, z),
					0.01,
					6,
				),
				part(
					placed(
						meterTorus(0.045, 0.01, 6, 12, Math.PI * 1.3),
						x + 0.04,
						end - 0.15,
						z,
						turn,
					),
					IRON,
				),
			);
		}
	}
	return parts;
};

export const wallLantern: FurnitureBuilder = () => {
	const center = 0.18;
	const parts: Part[] = [
		box(IRON, 0.08, 0.16, 0.02, 0, 0.22, 0.01),
		cylinderBetween(
			IRON,
			new THREE.Vector3(0, 0.33, 0.02),
			new THREE.Vector3(0, 0.42, center),
			0.012,
		),
		box(IRON, 0.15, 0.015, 0.15, 0, 0.12, center),
		box(GLASS, 0.12, 0.19, 0.12, 0, 0.135, center),
		lathe(
			IRON,
			[
				[0.001, 0.42],
				[0.04, 0.4],
				[0.1, 0.33],
				[0.085, 0.325],
				[0.001, 0.33],
			],
			0,
			0,
			center,
			8,
		),
		...candle(0, 0.135, center, 0.08, 0.018),
	];
	for (const sx of [-1, 1]) {
		for (const sz of [-1, 1]) {
			parts.push(
				cylinder(
					IRON,
					0.008,
					0.008,
					0.2,
					sx * 0.065,
					0.13,
					center + sz * 0.065,
					6,
				),
			);
		}
	}
	return parts;
};

export const bloodStain: FurnitureBuilder = ({ item, rng }) => [
	texturedPlane(
		{
			texture: rng.pick(["bloodStain", "bloodSmear"] as const),
			transparent: true,
			alphaTest: 0.3,
			depthWrite: false,
			roughness: 0.35,
		},
		item.width,
		item.depth,
		0,
		0.008,
		0,
		0,
		-Math.PI / 2,
	),
];
