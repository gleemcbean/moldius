import type { SeededRandom } from "@shared/random";
import * as THREE from "three";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import { EARTHY_CAPS, MOSS, smallMushroom } from "./fungi";
import {
	boxAt,
	cylinder,
	DARK,
	type FurnitureBuilder,
	lathe,
	type Part,
	part,
	pickWood,
	STONE,
} from "./parts";

const RUBBLE_STONES: readonly MaterialOptions[] = [
	{ texture: "stoneBlocks", roughness: 0.95 },
	{ texture: "rubbleStone", roughness: 1 },
	{ texture: "granite", color: 0xb8b4ac, roughness: 0.95 },
	{ texture: "limestone", roughness: 0.95 },
];

const BARK: MaterialOptions = { texture: "bark", roughness: 1 };

const DUST: MaterialOptions = {
	texture: "soil",
	color: 0x8a8278,
	roughness: 1,
	depthWrite: false,
};

function stoneChunk(
	rng: SeededRandom,
	material: MaterialOptions,
	size: number,
	x: number,
	y: number,
	z: number,
): Part {
	return boxAt(
		material,
		size * rng.range(0.8, 1.4),
		size * rng.range(0.55, 0.9),
		size * rng.range(0.7, 1.2),
		x,
		y,
		z,
		rng.range(-0.5, 0.5),
		rng.range(0, Math.PI),
		rng.range(-0.5, 0.5),
	);
}

function dustPatch(width: number, depth: number): Part {
	const geometry = new THREE.CircleGeometry(0.5, 20);

	geometry.rotateX(-Math.PI / 2);
	geometry.scale(width, 1, depth);
	geometry.translate(0, 0.004, 0);

	return part(geometry, DUST);
}

export const rubblePile: FurnitureBuilder = ({ item, rng }) => {
	const material = rng.pick(RUBBLE_STONES);
	const parts: Part[] = [dustPatch(item.width * 1.1, item.depth * 1.1)];
	const count = Math.round(item.width * item.depth * 12);

	for (let index = 0; index < count; index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const reach = Math.sqrt(rng.range(0, 1));
		const x = Math.cos(angle) * reach * (item.width / 2 - 0.12);
		const z = Math.sin(angle) * reach * (item.depth / 2 - 0.12);
		const crest = item.height * (1 - reach * 0.85);
		const size = rng.range(0.16, 0.34) * (1.2 - reach * 0.5);

		parts.push(
			stoneChunk(
				rng,
				material,
				size,
				x,
				Math.max(size * 0.3, crest - size * 0.5),
				z,
			),
		);
	}

	if (rng.chance(0.6)) {
		parts.push(
			boxAt(
				pickWood(rng),
				item.width * 0.8,
				0.08,
				0.14,
				0,
				item.height * 0.55,
				rng.range(-0.15, 0.15),
				rng.range(-0.2, 0.2),
				rng.range(0, Math.PI),
				rng.range(0.1, 0.35),
			),
		);
	}

	return parts;
};

export const floorDebris: FurnitureBuilder = ({ item, rng }) => {
	const material = rng.pick(RUBBLE_STONES);
	const parts: Part[] = [dustPatch(item.width, item.depth)];
	const count = rng.int(8, 15);

	for (let index = 0; index < count; index += 1) {
		const size = rng.range(0.04, 0.11);

		parts.push(
			stoneChunk(
				rng,
				material,
				size,
				rng.range(-item.width / 2 + 0.08, item.width / 2 - 0.08),
				size * 0.3,
				rng.range(-item.depth / 2 + 0.08, item.depth / 2 - 0.08),
			),
		);
	}

	return parts;
};

function columnShaft(radius: number, height: number): [number, number][] {
	return [
		[radius * 1.35, 0],
		[radius * 1.35, 0.12],
		[radius * 1.15, 0.18],
		[radius * 1.05, 0.26],
		[radius, 0.34],
		[radius * 0.97, height],
		[0.001, height],
	];
}

function brokenTop(
	rng: SeededRandom,
	material: MaterialOptions,
	radius: number,
	height: number,
): Part[] {
	const parts: Part[] = [];
	const shards = rng.int(3, 5);

	for (let index = 0; index < shards; index += 1) {
		const angle = (index / shards) * Math.PI * 2 + rng.range(-0.3, 0.3);
		const size = radius * rng.range(0.45, 0.75);

		parts.push(
			boxAt(
				material,
				size,
				rng.range(0.08, 0.28),
				size,
				Math.cos(angle) * radius * 0.45,
				height + rng.range(0, 0.08),
				Math.sin(angle) * radius * 0.45,
				rng.range(-0.25, 0.25),
				angle,
				rng.range(-0.25, 0.25),
			),
		);
	}

	return parts;
}

export const brokenColumn: FurnitureBuilder = ({ item, rng }) => {
	const radius = Math.min(item.width, item.depth) / 2 - 0.12;
	const material = STONE;

	if (item.variant === 0) {
		const stump = item.height * rng.range(0.75, 0.92);

		return [
			lathe(material, columnShaft(radius, stump), 0, 0, 0, 18),
			...brokenTop(rng, material, radius, stump),
			stoneChunk(rng, material, 0.22, radius * 1.6, 0.08, radius * 0.4),
		];
	}

	const stump = item.height * 0.55;
	const stumpX = -item.width / 2 + radius * 1.4;
	const shaft = lathe(material, columnShaft(radius, stump), 0, 0, 0, 18);

	shaft.geometry.translate(stumpX, 0, 0);

	const drumLength = item.width - radius * 3.2;
	const drum = cylinder(material, radius, radius, drumLength, 0, 0, 0, 18);

	drum.geometry.translate(0, -drumLength / 2, 0);
	drum.geometry.rotateZ(Math.PI / 2);
	drum.geometry.rotateY(rng.range(-0.15, 0.15));
	drum.geometry.translate(stumpX + radius * 1.6 + drumLength / 2, radius, 0);

	return [
		shaft,
		drum,
		...brokenTop(rng, material, radius, stump),
		stoneChunk(rng, material, 0.2, item.width / 2 - 0.2, 0.06, radius),
	];
};

export const fallenBeam: FurnitureBuilder = ({ item, rng }) => {
	const wood = { ...pickWood(rng), color: 0x8a7a68 };
	const length = item.width * 1.02;
	const rise = Math.asin(Math.min(0.95, (item.height - 0.2) / length));

	const parts: Part[] = [
		boxAt(
			wood,
			length,
			item.depth * 0.6,
			item.depth * 0.6,
			0,
			(Math.sin(rise) * length) / 2 + 0.1,
			0,
			0,
			0,
			rise,
		),
		boxAt(
			wood,
			length * 0.45,
			0.08,
			0.22,
			rng.range(-0.3, 0.3),
			0.05,
			item.depth * 0.25,
			0,
			rng.range(-0.4, 0.4),
			0.06,
		),
	];

	const material = rng.pick(RUBBLE_STONES);

	for (let index = 0; index < 6; index += 1) {
		parts.push(
			stoneChunk(
				rng,
				material,
				rng.range(0.08, 0.18),
				rng.range(-item.width / 2, -item.width / 6),
				0.05,
				rng.range(-item.depth / 2, item.depth / 2),
			),
		);
	}

	return parts;
};

function rootPath(
	rng: SeededRandom,
	start: THREE.Vector3,
	reach: number,
	sideways: number,
): THREE.Vector3[] {
	const points = [start.clone()];
	let current = start.clone();

	for (let step = 1; step <= 5; step += 1) {
		current = current
			.clone()
			.add(
				new THREE.Vector3(
					sideways * (reach / 5) + rng.range(-0.08, 0.08),
					-(reach / 5) * rng.range(0.6, 1),
					rng.range(-0.02, 0.03),
				),
			);

		current.y = Math.max(0.02, current.y);
		current.z = Math.min(0.2, Math.max(0.03, current.z));

		points.push(current);
	}

	return points;
}

function taperedRoot(points: THREE.Vector3[], thickness: number): Part[] {
	const pieces: Part[] = [];
	const segments = points.length - 1;

	for (let index = 0; index < segments; index += 1) {
		const curve = new THREE.CatmullRomCurve3([
			points[index],
			points[index + 1],
		]);

		const radius = thickness * (1 - (index / segments) * 0.8);

		pieces.push(part(new THREE.TubeGeometry(curve, 2, radius, 6, false), BARK));
	}

	return pieces;
}

export const wallRoots: FurnitureBuilder = ({ item, rng }) => {
	const crack = new THREE.CircleGeometry(0.5, 9);

	crack.scale(item.width * 0.42, item.height * 0.28, 1);
	crack.translate(0, item.height * 0.72, 0.004);

	const parts: Part[] = [part(crack, DARK)];
	const roots = rng.int(6, 9);
	const origin = new THREE.Vector3(0, item.height * 0.72, 0.04);

	for (let index = 0; index < roots; index += 1) {
		const spread = (index / (roots - 1) - 0.5) * 2;

		const start = origin
			.clone()
			.add(
				new THREE.Vector3(
					spread * item.width * 0.15,
					rng.range(-0.12, 0.12),
					0,
				),
			);

		const path = rootPath(
			rng,
			start,
			item.height * rng.range(0.55, 0.9),
			spread * rng.range(0.3, 0.8),
		);

		parts.push(...taperedRoot(path, rng.range(0.045, 0.085)));
	}

	const cap = rng.pick(EARTHY_CAPS);

	for (let index = 0; index < 3; index += 1) {
		const mushrooms = smallMushroom(
			rng,
			rng.range(-item.width / 3, item.width / 3),
			item.depth * 0.6,
			rng.range(0.06, 0.14),
			cap,
		);

		parts.push(...mushrooms);
	}

	parts.push(
		boxAt(
			MOSS,
			item.width * 0.6,
			0.015,
			item.depth * 0.8,
			0,
			0.008,
			item.depth * 0.45,
		),
	);

	return parts;
};
