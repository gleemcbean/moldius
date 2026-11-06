import * as THREE from "three";
import { meterTorus, scaleUv } from "../geometryUtils";
import type { MaterialOptions } from "../MaterialLibrary";
import {
	cylinder,
	type FurnitureBuilder,
	lathe,
	type Part,
	STONE,
	sphere,
} from "./parts";
import {
	curvedLeaf,
	flowerHead,
	leafMaterial,
	potMaterial,
	stem,
} from "./plants";

const SOIL: MaterialOptions = { texture: "soil", roughness: 1 };
const STEM: MaterialOptions = { color: 0x4d8a3a, roughness: 0.9 };
const LILY_PAD: MaterialOptions = {
	color: 0x3f7a35,
	roughness: 0.8,
	side: THREE.DoubleSide,
};
const FLOWER_COLORS = [
	0xd8344a, 0xf2c94c, 0x9b59d0, 0xf5f0e6, 0xe86fa0, 0x4f7fd8, 0xf08a3c,
];

function flatEllipse(
	radiusX: number,
	radiusZ: number,
	y: number,
	material: MaterialOptions,
	segments = 40,
): Part {
	const geometry = scaleUv(
		new THREE.CircleGeometry(radiusX, segments),
		radiusX * 2,
		radiusX * 2,
	);
	geometry.rotateX(-Math.PI / 2);
	geometry.scale(1, 1, radiusZ / radiusX);
	geometry.translate(0, y, 0);
	return { geometry, material };
}

const POND_WATER_LEVEL = 0.13;

export const pond: FurnitureBuilder = ({ item, rng }) => {
	const radiusX = item.width / 2;
	const radiusZ = item.depth / 2;
	const ratio = radiusZ / radiusX;
	const rim = meterTorus(radiusX - 0.11, 0.09, 6, 48);
	rim.rotateX(Math.PI / 2);
	rim.scale(1, 0.7, ratio);
	rim.translate(0, 0.05, 0);
	const parts: Part[] = [
		{ geometry: rim, material: STONE },
		flatEllipse(radiusX - 0.12, radiusZ - 0.12, 0.006, {
			color: 0x0d1916,
			roughness: 1,
		}),
		flatEllipse(radiusX - 0.14, radiusZ - 0.14, POND_WATER_LEVEL, {
			texture: "pondWater",
			transparent: true,
			opacity: 0.86,
			roughness: 0.05,
			metalness: 0.25,
		}),
	];
	const rocks = Math.round((radiusX + radiusZ) * 6);
	for (let index = 0; index < rocks; index += 1) {
		const angle = (index / rocks) * Math.PI * 2 + rng.range(-0.08, 0.08);
		const size = rng.range(0.06, 0.11);
		parts.push(
			sphere(
				STONE,
				size,
				Math.cos(angle) * (radiusX - 0.06),
				0.08,
				Math.sin(angle) * (radiusZ - 0.1),
				rng.range(1, 1.5),
				0.55,
				rng.range(1, 1.4),
				8,
			),
		);
	}
	const pads = rng.int(3, 6);
	for (let index = 0; index < pads; index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const distance = rng.range(0.2, 0.75);
		const x = Math.cos(angle) * (radiusX - 0.4) * distance;
		const z = Math.sin(angle) * (radiusZ - 0.4) * distance;
		const radius = rng.range(0.1, 0.2);
		const pad = new THREE.CircleGeometry(radius, 12, 0.3, Math.PI * 2 - 0.3);
		pad.rotateX(-Math.PI / 2);
		pad.rotateY(rng.range(0, Math.PI * 2));
		pad.translate(x, POND_WATER_LEVEL + 0.005, z);
		parts.push({ geometry: pad, material: LILY_PAD });
		if (rng.chance(0.35)) {
			parts.push(
				sphere(
					{ color: 0xf1a6c4, roughness: 0.7 },
					0.05,
					x,
					POND_WATER_LEVEL + 0.03,
					z,
					1,
					0.7,
					1,
					8,
				),
			);
		}
	}
	return parts;
};

export const flowerPot: FurnitureBuilder = ({ item, rng }) => {
	const radius = Math.min(item.width, item.depth) * 0.42;
	const potHeight = item.height * 0.45;
	const soilY = potHeight * 0.86;
	const parts: Part[] = [
		lathe(
			potMaterial(),
			[
				[0.001, 0],
				[radius * 0.7, 0],
				[radius * 0.95, potHeight * 0.82],
				[radius * 1.08, potHeight * 0.85],
				[radius * 1.08, potHeight],
				[radius * 0.92, potHeight],
				[radius * 0.88, soilY - 0.01],
				[0.001, soilY - 0.01],
			],
			0,
			0,
			0,
			14,
		),
		cylinder(SOIL, radius * 0.9, radius * 0.9, 0.01, 0, soilY - 0.01, 0, 14),
	];
	const petals: MaterialOptions = {
		color: rng.pick(FLOWER_COLORS),
		roughness: 0.7,
	};
	const heart: MaterialOptions = { color: 0xf6d24a, roughness: 0.7 };
	const root = new THREE.Vector3(0, soilY, 0);
	const stems = rng.int(3, 6);
	for (let index = 0; index < stems; index += 1) {
		const angle = (index / stems) * Math.PI * 2 + rng.range(-0.3, 0.3);
		const lean = rng.range(0.02, radius * 0.9);
		const top = new THREE.Vector3(
			Math.cos(angle) * lean,
			rng.range(item.height * 0.75, item.height - 0.04),
			Math.sin(angle) * lean,
		);
		parts.push(
			stem(STEM, root, top, 0.007),
			...flowerHead(petals, heart, top, rng.range(0.034, 0.046)),
		);
	}
	const blade = leafMaterial(rng, "leafBlade");
	const blades = 7;
	for (let index = 0; index < blades; index += 1) {
		parts.push(
			curvedLeaf(
				blade,
				root,
				0.05,
				(item.height - soilY) * rng.range(0.42, 0.62),
				(index / blades) * Math.PI * 2 + rng.range(-0.3, 0.3),
				rng.range(0.25, 0.5),
				rng.range(0.55, 0.9),
			),
		);
	}
	return parts;
};
