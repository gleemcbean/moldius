import { cauldronBrew } from "@shared/manor/brews";
import * as THREE from "three";
import {
	meterCircle,
	meterCylinder,
	meterSphere,
	placed,
} from "../geometryUtils";
import type { MaterialOptions } from "../MaterialLibrary";
import {
	BRASS,
	box,
	boxAt,
	CERAMIC,
	candle,
	carvedForSeed,
	cylinder,
	cylinderBetween,
	DARK,
	type FurnitureBuilder,
	GLASS,
	IRON,
	lathe,
	type Part,
	part,
	pickCarved,
	pickWood,
	sphere,
	texturedPlane,
	torus,
} from "./parts";
import {
	curvedLeaf,
	flowerHead,
	leafMaterial,
	leafyBush,
	potMaterial,
	stem,
} from "./plants";
import { bentTube, capsuleBetween, ellipsoid, extruded } from "./sculpt";

const POTION_COLORS = [0x6dff7a, 0xff4fd8, 0x4fa8ff, 0xffb84f, 0xd04040];

export const cauldron: FurnitureBuilder = ({ item }) => {
	const radius = item.width / 2;
	const height = item.height;
	const brew = cauldronBrew(item.seed);
	const parts: Part[] = [
		lathe(
			IRON,
			[
				[0.001, 0.08],
				[radius * 0.55, 0.08],
				[radius * 0.92, height * 0.35],
				[radius, height * 0.62],
				[radius * 0.88, height * 0.92],
				[radius * 0.95, height],
				[radius * 0.82, height],
				[radius * 0.8, height * 0.92],
				[radius * 0.88, height * 0.62],
				[radius * 0.8, height * 0.35],
				[0.001, 0.14],
			],
			0,
			0,
			0,
			24,
		),
		cylinder(
			{
				color: brew.liquid,
				emissive: brew.glow,
				emissiveIntensity: 0.7,
				roughness: 0.25,
			},
			radius * 0.84,
			radius * 0.84,
			0.02,
			0,
			height - 0.13,
			0,
			24,
		),
	];
	for (let index = 0; index < 3; index += 1) {
		const angle = (index / 3) * Math.PI * 2;
		parts.push(
			cylinder(
				IRON,
				0.05,
				0.035,
				0.16,
				Math.cos(angle) * radius * 0.6,
				0,
				Math.sin(angle) * radius * 0.6,
				8,
			),
		);
	}
	for (let index = 0; index < 4; index += 1) {
		parts.push(
			sphere(
				{
					color: brew.bubble,
					emissive: brew.glow,
					emissiveIntensity: 0.8,
					roughness: 0.2,
				},
				0.03 + index * 0.008,
				Math.cos(index * 2.1) * radius * 0.4,
				height - 0.11,
				Math.sin(index * 2.1) * radius * 0.4,
				1,
				0.6,
				1,
				8,
			),
		);
	}
	parts.push(
		torus(
			IRON,
			radius * 0.25,
			0.015,
			radius * 0.95,
			height * 0.75,
			0,
			0,
			Math.PI / 2,
		),
	);
	parts.push(
		torus(
			IRON,
			radius * 0.25,
			0.015,
			-radius * 0.95,
			height * 0.75,
			0,
			0,
			Math.PI / 2,
		),
	);
	return parts;
};

export const crate: FurnitureBuilder = ({ item, rng }) => {
	const wood: MaterialOptions = {
		texture: rng.pick(["woodLight", "woodMedium"] as const),
		roughness: 0.95,
	};
	const { width, height, depth } = item;
	const parts: Part[] = [box(wood, width, height, depth, 0, 0, 0, 0, 0.01)];
	for (const y of [0.02, height - 0.08]) {
		parts.push(
			box(
				{ ...wood, color: 0xb8a890 },
				width + 0.012,
				0.06,
				depth + 0.012,
				0,
				y,
				0,
			),
		);
	}
	parts.push(
		boxAt(
			{ ...wood, color: 0xb8a890 },
			Math.hypot(width, height) * 0.9,
			0.05,
			0.015,
			0,
			height / 2,
			depth / 2 + 0.006,
			0,
			0,
			Math.atan2(height, width),
		),
	);
	return parts;
};

export const barrel: FurnitureBuilder = ({ item }) => {
	const radius = item.width / 2;
	const height = item.height;
	const parts: Part[] = [
		lathe(
			{ texture: "woodMedium", roughness: 0.9 },
			[
				[0.001, 0],
				[radius * 0.82, 0],
				[radius, height * 0.5],
				[radius * 0.82, height],
			],
			0,
			0,
			0,
			20,
		),
		part(
			placed(meterCircle(radius * 0.82, 20), 0, height, 0, 0, -Math.PI / 2),
			{
				texture: "woodMedium",
				roughness: 0.9,
			},
		),
	];
	for (const t of [0.12, 0.38, 0.62, 0.88]) {
		const bulge = radius * (0.82 + 0.18 * Math.sin(t * Math.PI)) + 0.008;
		parts.push(torus(IRON, bulge, 0.012, 0, height * t, 0));
	}
	return parts;
};

export const pottedPlant: FurnitureBuilder = ({ item, rng }) => {
	const potRadius = Math.min(item.width, item.depth) * 0.32;
	const potHeight = Math.min(0.5, item.height * 0.3);
	const soilY = potHeight * 0.86;
	const parts: Part[] = [
		lathe(
			potMaterial(),
			[
				[0.001, 0],
				[potRadius * 0.72, 0],
				[potRadius * 0.95, potHeight * 0.8],
				[potRadius * 1.08, potHeight * 0.82],
				[potRadius * 1.1, potHeight],
				[potRadius * 0.94, potHeight],
				[potRadius * 0.9, soilY - 0.01],
				[0.001, soilY - 0.01],
			],
			0,
			0,
			0,
			16,
		),
		cylinder(
			{ texture: "soil", roughness: 1 },
			potRadius * 0.92,
			potRadius * 0.92,
			0.012,
			0,
			soilY - 0.012,
			0,
			16,
		),
	];
	const root = new THREE.Vector3(0, soilY, 0);
	if (item.variant === 1 || item.variant === 3) {
		const trunkHeight = item.height * (item.variant === 3 ? 0.5 : 0.56);
		parts.push(
			cylinder(
				{ texture: "bark", roughness: 1 },
				0.028,
				0.046,
				trunkHeight,
				0,
				soilY,
				0,
				8,
			),
		);
		const top = new THREE.Vector3(0, soilY + trunkHeight, 0);
		if (item.variant === 1) {
			const frond = leafMaterial(rng, "palmFrond");
			const count = 9;
			for (let index = 0; index < count; index += 1) {
				parts.push(
					curvedLeaf(
						frond,
						top,
						item.height * 0.27,
						item.height * (0.3 + rng.next() * 0.1),
						(index / count) * Math.PI * 2 + rng.next() * 0.3,
						0.32 + rng.next() * 0.3,
						0.75 + rng.next() * 0.35,
					),
				);
			}
			return parts;
		}
		const crown = Math.min(0.42, item.height * 0.2);
		parts.push(
			...leafyBush(
				leafMaterial(rng, "leafSprig"),
				{ texture: "foliageDark", roughness: 1 },
				top.clone().add(new THREE.Vector3(0, crown * 0.72, 0)),
				crown,
				rng,
				46,
				0.95,
			),
		);
		return parts;
	}
	const blade = leafMaterial(rng, "leafBlade");
	const count = item.variant === 2 ? 11 : 15;
	for (let index = 0; index < count; index += 1) {
		const inner = index % 3 === 0;
		parts.push(
			curvedLeaf(
				blade,
				root,
				0.07 + rng.next() * 0.04,
				(item.height - soilY) *
					(inner ? 0.86 + rng.next() * 0.14 : 0.55 + rng.next() * 0.26),
				(index / count) * Math.PI * 2 + rng.next() * 0.5,
				inner ? 0.06 + rng.next() * 0.1 : 0.22 + rng.next() * 0.22,
				inner ? 0.14 + rng.next() * 0.14 : 0.42 + rng.next() * 0.4,
			),
		);
	}
	if (item.variant === 2) {
		const stemMaterial: MaterialOptions = { color: 0x4d7a3a, roughness: 0.9 };
		const petal: MaterialOptions = {
			color: rng.pick([0xc8344a, 0xe0b83a, 0xd468b4]),
			roughness: 0.8,
		};
		const heart: MaterialOptions = { color: 0xf0d04a, roughness: 0.7 };
		for (let index = 0; index < 5; index += 1) {
			const angle = (index / 5) * Math.PI * 2 + rng.next() * 0.5;
			const spread = 0.04 + rng.next() * potRadius * 0.9;
			const head = new THREE.Vector3(
				Math.cos(angle) * spread,
				soilY + (item.height - soilY) * (0.72 + rng.next() * 0.26),
				Math.sin(angle) * spread,
			);
			parts.push(
				stem(stemMaterial, root, head),
				...flowerHead(petal, heart, head, 0.05 + rng.next() * 0.012),
			);
		}
	}
	return parts;
};

export const planterBed: FurnitureBuilder = ({ item, rng }) => {
	const { width, height, depth } = item;
	const parts: Part[] = [
		box(
			{ texture: "brick", roughness: 0.95 },
			width,
			height - 0.02,
			depth,
			0,
			0,
			0,
			0,
			0.015,
		),
		box(
			{ texture: "soil", roughness: 1 },
			width - 0.1,
			0.02,
			depth - 0.1,
			0,
			height - 0.03,
			0,
		),
	];
	const plants = Math.round(width / 0.3);
	for (let index = 0; index < plants; index += 1) {
		const x =
			-width / 2 + 0.15 + index * ((width - 0.3) / Math.max(1, plants - 1));
		const z = (rng.next() - 0.5) * (depth - 0.35);
		const size = 0.13 + rng.next() * 0.08;
		parts.push(
			...leafyBush(
				leafMaterial(rng, "leafSprig"),
				{ texture: "foliageDark", roughness: 1 },
				new THREE.Vector3(x, height + size * 0.85, z),
				size,
				rng,
				16,
				1.1,
			),
		);
		if (rng.chance(0.4)) {
			parts.push(
				sphere(
					{ color: rng.pick([0xc8344a, 0xf0b84a, 0x9a4ad8]), roughness: 0.8 },
					0.04,
					x,
					height + 0.3,
					z + 0.05,
					1,
					1,
					1,
					6,
				),
			);
		}
	}
	return parts;
};

export const pillar: FurnitureBuilder = ({ item, room }) => {
	const radius = item.width / 2 - 0.04;
	const height = item.height;
	const material = carvedForSeed(room.seed);
	return [
		box(material, item.width, 0.2, item.depth, 0, 0, 0, 0, 0.02),
		lathe(
			material,
			[
				[0.001, 0.2],
				[radius * 1.05, 0.2],
				[radius, 0.32],
				[radius * 0.9, height * 0.5],
				[radius, height - 0.32],
				[radius * 1.1, height - 0.22],
				[0.001, height - 0.22],
			],
			0,
			0,
			0,
			20,
		),
		box(material, item.width, 0.22, item.depth, 0, height - 0.22, 0, 0, 0.02),
	];
};

export const globe: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const radius = 0.24;
	const center = item.height - radius - 0.06;
	return [
		lathe(
			wood,
			[
				[0.001, 0],
				[0.22, 0],
				[0.2, 0.05],
				[0.04, 0.15],
				[0.05, center - 0.2],
				[0.001, center - 0.2],
			],
			0,
			0,
			0,
			12,
		),
		{
			...sphere(
				{ texture: "paintingLandscape", color: 0xc8b08a, roughness: 0.6 },
				radius,
				0,
				center,
				0,
				1,
				1,
				1,
				20,
			),
			animation: {
				kind: "spin",
				pivot: [0, center, 0],
				axis: [0.26, 0.97, 0],
				speed: 0.22,
				amplitude: 0,
				phase: rng.next() * Math.PI * 2,
			},
		},
		torus(BRASS, radius + 0.03, 0.012, 0, center, 0, 0.4, 0, Math.PI * 1.4),
	];
};

export const harp: FurnitureBuilder = ({ item, rng }) => {
	const wood: MaterialOptions = {
		texture: rng.chance(0.5) ? "woodRed" : "woodMedium",
		roughness: 0.6,
	};
	const gilt: MaterialOptions = {
		texture: "brass",
		roughness: 0.35,
		metalness: 0.85,
	};
	const height = item.height;
	const depth = item.depth;
	const back = -depth * 0.36;
	const front = depth * 0.4;
	const neck: [number, number, number][] = [
		[0, height * 0.97, back + 0.02],
		[0, height * 0.88, back + depth * 0.22],
		[0, height * 0.9, back + depth * 0.45],
		[0, height * 0.8, front - 0.02],
		[0, height * 0.72, front + 0.03],
	];
	const neckCurve = new THREE.CatmullRomCurve3(
		neck.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
	);
	const boardFoot = new THREE.Vector3(0, 0.16, back + 0.08);
	const boardTop = new THREE.Vector3(0, height * 0.7, front);
	const soundbox = meterCylinder(
		0.03,
		0.11,
		boardFoot.distanceTo(boardTop),
		16,
	);
	soundbox.scale(1, 1, 0.75);
	soundbox.applyMatrix4(
		new THREE.Matrix4().compose(
			boardFoot.clone().add(boardTop).multiplyScalar(0.5),
			new THREE.Quaternion().setFromUnitVectors(
				new THREE.Vector3(0, 1, 0),
				boardTop.clone().sub(boardFoot).normalize(),
			),
			new THREE.Vector3(1, 1, 1),
		),
	);
	const parts: Part[] = [
		box(wood, 0.26, 0.08, depth * 0.9, 0, 0.04, -depth * 0.02, 0, 0.02),
		box(gilt, 0.28, 0.04, depth * 0.92, 0, 0, -depth * 0.02, 0, 0.01),
		part(soundbox, wood),
		lathe(
			wood,
			[
				[0.001, 0.12],
				[0.05, 0.12],
				[0.055, 0.16],
				[0.038, 0.2],
				[0.03, height * 0.5],
				[0.026, height * 0.85],
				[0.045, height * 0.9],
				[0.06, height * 0.95],
				[0.05, height * 0.99],
				[0.001, height * 1.01],
			],
			0,
			0,
			back,
			18,
		),
		torus(gilt, 0.045, 0.008, 0, height * 0.905, back),
		sphere(gilt, 0.03, 0, height * 1.01, back, 1, 1, 1, 10),
		bentTube(wood, neck, (t) => 0.03 - t * 0.008, 24, 10),
		sphere(gilt, 0.024, 0, height * 0.72, front + 0.03, 1, 1, 1, 10),
	];
	const strings = 22;
	for (let index = 0; index < strings; index += 1) {
		const t = (index + 0.5) / strings;
		const low = boardFoot.clone().lerp(boardTop, 0.04 + t * 0.92);
		const high = neckCurve.getPointAt(0.12 + t * 0.78);
		const colour =
			index % 7 === 0 ? 0xa82a22 : index % 7 === 4 ? 0x2a3a8a : 0xe8e0c0;
		parts.push(
			cylinderBetween(
				{ color: colour, roughness: 0.4, metalness: 0.2 },
				low.add(new THREE.Vector3(0, 0, 0.02)),
				high.add(new THREE.Vector3(0, -0.02, 0)),
				0.0022,
				4,
			),
		);
	}
	return parts;
};

function bassOutline(scale: number): THREE.Shape {
	const shape = new THREE.Shape();
	const s = scale;
	shape.moveTo(0, -0.62 * s);
	shape.bezierCurveTo(
		0.22 * s,
		-0.62 * s,
		0.33 * s,
		-0.5 * s,
		0.33 * s,
		-0.3 * s,
	);
	shape.bezierCurveTo(
		0.33 * s,
		-0.14 * s,
		0.24 * s,
		-0.08 * s,
		0.2 * s,
		-0.04 * s,
	);
	shape.bezierCurveTo(0.17 * s, 0.0, 0.19 * s, 0.06 * s, 0.24 * s, 0.1 * s);
	shape.bezierCurveTo(
		0.29 * s,
		0.16 * s,
		0.27 * s,
		0.34 * s,
		0.17 * s,
		0.42 * s,
	);
	shape.bezierCurveTo(0.1 * s, 0.47 * s, 0.04 * s, 0.5 * s, 0, 0.5 * s);
	shape.bezierCurveTo(
		-0.04 * s,
		0.5 * s,
		-0.1 * s,
		0.47 * s,
		-0.17 * s,
		0.42 * s,
	);
	shape.bezierCurveTo(
		-0.27 * s,
		0.34 * s,
		-0.29 * s,
		0.16 * s,
		-0.24 * s,
		0.1 * s,
	);
	shape.bezierCurveTo(-0.19 * s, 0.06 * s, -0.17 * s, 0.0, -0.2 * s, -0.04 * s);
	shape.bezierCurveTo(
		-0.24 * s,
		-0.08 * s,
		-0.33 * s,
		-0.14 * s,
		-0.33 * s,
		-0.3 * s,
	);
	shape.bezierCurveTo(-0.33 * s, -0.5 * s, -0.22 * s, -0.62 * s, 0, -0.62 * s);
	return shape;
}

export const cello: FurnitureBuilder = ({ item }) => {
	const wood: MaterialOptions = { texture: "woodRed", roughness: 0.45 };
	const ebony: MaterialOptions = { color: 0x16120f, roughness: 0.35 };
	const height = item.height;
	const scale = Math.min(item.width / 0.66, height / 1.95);
	const center = height * 0.4;
	const ribs = 0.19 * scale;
	const front = ribs / 2;
	const neckTop = height * 0.93;
	const parts: Part[] = [
		extruded(wood, bassOutline(scale), ribs, 0.02 * scale, 0, center, 0),
		extruded(
			{ ...wood, color: 0xc49a7a },
			bassOutline(scale * 0.985),
			0.006,
			0.002,
			0,
			center,
			front + 0.001,
		),
		capsuleBetween(
			wood,
			new THREE.Vector3(0, center + 0.48 * scale, front - 0.03),
			new THREE.Vector3(0, neckTop - 0.06, front - 0.01),
			0.032 * scale,
			10,
		),
		box(ebony, 0.055 * scale, 0.012, (neckTop - center) * 0.92, 0, 0, 0),
		box(
			wood,
			0.05 * scale,
			0.12 * scale,
			0.07 * scale,
			0,
			neckTop - 0.06,
			front - 0.035,
		),
		torus(
			wood,
			0.035 * scale,
			0.014 * scale,
			0,
			neckTop + 0.06 * scale + 0.02,
			front - 0.03,
			0,
			Math.PI / 2,
		),
		torus(
			wood,
			0.018 * scale,
			0.01 * scale,
			0,
			neckTop + 0.06 * scale + 0.02,
			front - 0.03,
			0,
			Math.PI / 2,
		),
		sphere(
			wood,
			0.012 * scale,
			0,
			neckTop + 0.06 * scale + 0.02,
			front - 0.03,
			1,
			1,
			1,
			8,
		),
		extruded(
			{ texture: "woodLight", roughness: 0.6 },
			bridgeShape(scale),
			0.008,
			0.001,
			0,
			center - 0.08 * scale,
			front + 0.004,
		),
		extruded(
			ebony,
			tailpieceShape(scale),
			0.012,
			0.003,
			0,
			center - 0.36 * scale,
			front + 0.012,
		),
		cylinderBetween(
			IRON,
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(0, center - 0.6 * scale, 0),
			0.01,
			8,
		),
	];
	const fingerboard = parts[3];
	fingerboard.geometry.applyMatrix4(
		new THREE.Matrix4().compose(
			new THREE.Vector3(
				0,
				(neckTop + center) / 2 + 0.05 * scale,
				front + 0.022,
			),
			new THREE.Quaternion().setFromEuler(
				new THREE.Euler(Math.PI / 2 - 0.02, 0, 0),
			),
			new THREE.Vector3(1, 1, 1),
		),
	);
	for (const side of [-1, 1]) {
		parts.push(
			ellipsoid(
				DARK,
				[0.008 * scale, 0.07 * scale, 0.0015],
				side * 0.11 * scale,
				center - 0.06 * scale,
				front + 0.0035,
				0,
				0,
				side * 0.08,
				8,
			),
			ellipsoid(
				DARK,
				[0.012 * scale, 0.012 * scale, 0.0015],
				side * 0.115 * scale,
				center + 0.015 * scale,
				front + 0.0035,
				0,
				0,
				0,
				8,
			),
			ellipsoid(
				DARK,
				[0.012 * scale, 0.012 * scale, 0.0015],
				side * 0.105 * scale,
				center - 0.135 * scale,
				front + 0.0035,
				0,
				0,
				0,
				8,
			),
		);
		for (const step of [0, 1]) {
			const y = neckTop - 0.02 - step * 0.045 * scale;
			parts.push(
				cylinderBetween(
					BRASS,
					new THREE.Vector3(side * 0.025 * scale, y, front - 0.035),
					new THREE.Vector3(side * 0.07 * scale, y, front - 0.035),
					0.006,
					6,
				),
				ellipsoid(
					BRASS,
					[0.008, 0.016, 0.004],
					side * 0.075 * scale,
					y,
					front - 0.035,
					0,
					0,
					0,
					8,
				),
			);
		}
	}
	for (let index = 0; index < 4; index += 1) {
		const x = (index - 1.5) * 0.011 * scale;
		parts.push(
			cylinderBetween(
				{ color: 0xd8d0b8, roughness: 0.3, metalness: 0.5 },
				new THREE.Vector3(x * 1.6, center - 0.33 * scale, front + 0.024),
				new THREE.Vector3(x, neckTop - 0.03, front + 0.034),
				0.0012 + (3 - index) * 0.0003,
				4,
			),
		);
	}
	return parts;
};

function bridgeShape(scale: number): THREE.Shape {
	const shape = new THREE.Shape();
	const s = scale;
	shape.moveTo(-0.06 * s, 0);
	shape.lineTo(-0.035 * s, 0);
	shape.quadraticCurveTo(0, 0.04 * s, 0.035 * s, 0);
	shape.lineTo(0.06 * s, 0);
	shape.lineTo(0.05 * s, 0.08 * s);
	shape.quadraticCurveTo(0, 0.095 * s, -0.05 * s, 0.08 * s);
	shape.closePath();
	return shape;
}

function tailpieceShape(scale: number): THREE.Shape {
	const shape = new THREE.Shape();
	const s = scale;
	shape.moveTo(-0.015 * s, 0);
	shape.lineTo(0.015 * s, 0);
	shape.lineTo(0.045 * s, 0.22 * s);
	shape.quadraticCurveTo(0, 0.24 * s, -0.045 * s, 0.22 * s);
	shape.closePath();
	return shape;
}

export const musicStand: FurnitureBuilder = ({ item }) => [
	cylinder(IRON, 0.18, 0.18, 0.02, 0, 0, 0, 3),
	cylinder(IRON, 0.012, 0.012, item.height - 0.2, 0, 0, 0, 6),
	boxAt(IRON, 0.45, 0.32, 0.01, 0, item.height - 0.1, 0.03, -0.35),
	boxAt(
		{ texture: "paper", roughness: 1 },
		0.36,
		0.26,
		0.005,
		0,
		item.height - 0.09,
		0.04,
		-0.35,
	),
];

export const grandPiano: FurnitureBuilder = ({ item }) => {
	const black: MaterialOptions = {
		color: 0x141414,
		roughness: 0.55,
		metalness: 0,
	};
	const { width, depth, height } = item;
	const shape = new THREE.Shape();
	shape.moveTo(-width / 2, depth / 2);
	shape.lineTo(width / 2, depth / 2);
	shape.lineTo(width / 2, -depth * 0.1);
	shape.quadraticCurveTo(width / 2, -depth / 2, 0, -depth / 2);
	shape.quadraticCurveTo(-width / 2, -depth / 2, -width / 2, 0);
	shape.lineTo(-width / 2, depth / 2);
	const lidShape = new THREE.Shape();
	lidShape.moveTo(-width / 2, depth / 2 - 0.28);
	lidShape.lineTo(width / 2, depth / 2 - 0.28);
	lidShape.lineTo(width / 2, -depth * 0.1);
	lidShape.quadraticCurveTo(width / 2, -depth / 2, 0, -depth / 2);
	lidShape.quadraticCurveTo(-width / 2, -depth / 2, -width / 2, 0);
	lidShape.closePath();
	const body = new THREE.ExtrudeGeometry(shape, {
		depth: 0.32,
		bevelEnabled: true,
		bevelSize: 0.015,
		bevelThickness: 0.015,
		bevelSegments: 2,
	});
	body.rotateX(Math.PI / 2);
	body.translate(0, height - 0.32 + 0.32, 0);
	const lidAngle = 0.45;
	const lid = new THREE.ShapeGeometry(lidShape);
	lid.rotateX(Math.PI / 2);
	lid.translate(-width / 2, 0, 0);
	lid.rotateZ(-lidAngle);
	lid.translate(width / 2, height + 0.02, 0);
	const propX = -width * 0.12;
	const parts: Part[] = [
		{ geometry: body, material: black },
		{ geometry: lid, material: { ...black, side: THREE.DoubleSide } },
		cylinderBetween(
			black,
			new THREE.Vector3(propX, height, -depth * 0.05),
			new THREE.Vector3(
				propX,
				height + 0.02 + (width / 2 - propX) * Math.tan(lidAngle),
				-depth * 0.05,
			),
			0.012,
			6,
		),
		box(black, width * 0.92, 0.08, 0.24, 0, height - 0.38, depth / 2 + 0.08),
		box(
			{ color: 0xf0ece0, roughness: 0.4 },
			width * 0.9,
			0.03,
			0.16,
			0,
			height - 0.3,
			depth / 2 + 0.08,
		),
		box(black, width * 0.9, 0.05, 0.05, 0, height - 0.3, depth / 2 + 0.18),
	];
	for (let key = 0; key < 24; key += 1) {
		if (key % 7 === 2 || key % 7 === 6) {
			continue;
		}
		parts.push(
			box(
				DARK,
				0.018,
				0.02,
				0.09,
				-width * 0.43 + key * ((width * 0.86) / 24),
				height - 0.27,
				depth / 2 + 0.06,
			),
		);
	}
	for (const [x, z] of [
		[-width / 2 + 0.12, depth / 2 - 0.12],
		[width / 2 - 0.12, depth / 2 - 0.12],
		[0, -depth / 2 + 0.25],
	] as const) {
		parts.push(
			lathe(
				black,
				[
					[0.001, 0],
					[0.05, 0],
					[0.07, height * 0.3],
					[0.05, height - 0.32],
					[0.001, height - 0.32],
				],
				x,
				0,
				z,
				10,
			),
		);
	}
	return parts;
};

export const uprightPiano: FurnitureBuilder = ({ item, rng }) => {
	const wood = rng.chance(0.5)
		? { color: 0x141414, roughness: 0.25 }
		: pickWood(rng);
	const { width, height, depth } = item;
	const parts: Part[] = [
		box(wood, width, height, depth * 0.6, 0, 0, -depth * 0.2, 0, 0.02),
		box(wood, width, 0.1, depth, 0, 0.65, 0),
		box(
			{ color: 0xf0ece0, roughness: 0.4 },
			width * 0.9,
			0.03,
			0.18,
			0,
			0.75,
			depth * 0.3,
		),
		box(
			wood,
			width * 0.08,
			0.7,
			depth * 0.35,
			-width / 2 + 0.05,
			0,
			depth * 0.3,
		),
		box(
			wood,
			width * 0.08,
			0.7,
			depth * 0.35,
			width / 2 - 0.05,
			0,
			depth * 0.3,
		),
		...candle(-width * 0.35, height, 0, 0.14),
	];
	for (let key = 0; key < 26; key += 1) {
		if (key % 7 === 2 || key % 7 === 6) {
			continue;
		}
		parts.push(
			box(
				DARK,
				0.018,
				0.02,
				0.09,
				-width * 0.43 + key * ((width * 0.86) / 26),
				0.78,
				depth * 0.27,
			),
		);
	}
	return parts;
};

function anvilProfile(width: number): THREE.Shape {
	const half = width / 2;
	const shape = new THREE.Shape();
	shape.moveTo(-half * 0.42, 0);
	shape.lineTo(half * 0.5, 0);
	shape.quadraticCurveTo(half * 0.32, 0.04, half * 0.28, 0.1);
	shape.lineTo(half * 0.26, 0.18);
	shape.quadraticCurveTo(half * 0.5, 0.2, half * 0.62, 0.26);
	shape.lineTo(half * 0.62, 0.32);
	shape.lineTo(-half * 0.36, 0.32);
	shape.quadraticCurveTo(-half * 0.36, 0.22, -half * 0.22, 0.18);
	shape.lineTo(-half * 0.24, 0.1);
	shape.quadraticCurveTo(-half * 0.28, 0.04, -half * 0.42, 0);
	return shape;
}

export const anvil: FurnitureBuilder = ({ item, rng }) => {
	const stump: MaterialOptions = { texture: "bark", roughness: 1 };
	const top = 0.46;
	const width = item.width;
	const parts: Part[] = [
		lathe(
			stump,
			[
				[0.001, 0],
				[0.22, 0],
				[0.24, 0.03],
				[0.21, 0.12],
				[0.2, top - 0.02],
				[0.19, top],
				[0.001, top],
			],
			0,
			0,
			0,
			18,
		),
		cylinder(
			{ texture: "woodLight", roughness: 0.9 },
			0.188,
			0.188,
			0.004,
			0,
			top - 0.002,
			0,
			18,
		),
		torus(IRON, 0.205, 0.008, 0, 0.1, 0),
		torus(IRON, 0.2, 0.008, 0, top - 0.06, 0),
		extruded(IRON, anvilProfile(width), 0.13, 0.008, 0, top, 0),
		box(IRON, width * 0.45, 0.02, 0.11, width * 0.07, top + 0.31, 0, 0, 0.006),
		lathe(
			IRON,
			[
				[0.001, 0],
				[0.062, 0],
				[0.055, 0.06],
				[0.035, 0.16],
				[0.014, 0.24],
				[0.001, 0.26],
			],
			0,
			0,
			0,
			14,
		),
		box(DARK, 0.022, 0.006, 0.022, width * 0.24, top + 0.325, 0),
	];
	const horn = parts[6];
	horn.geometry.applyMatrix4(
		new THREE.Matrix4().compose(
			new THREE.Vector3(-width * 0.18, top + 0.285, 0),
			new THREE.Quaternion().setFromEuler(
				new THREE.Euler(0, 0, Math.PI / 2 + 0.05),
			),
			new THREE.Vector3(1, 0.85, 1),
		),
	);
	if (rng.chance(0.7)) {
		parts.push(
			capsuleBetween(
				{ texture: "woodLight", roughness: 0.8 },
				new THREE.Vector3(width * 0.05, top + 0.355, 0.03),
				new THREE.Vector3(width * 0.05 + 0.28, top + 0.36, 0.14),
				0.013,
				8,
			),
			boxAt(IRON, 0.1, 0.04, 0.04, width * 0.05, top + 0.355, 0.03, 0, -0.38),
		);
	}
	return parts;
};

export const rug: FurnitureBuilder = ({ item, rng }) => {
	const round = item.variant === 2;
	const key = round
		? "rugRound"
		: item.variant === 3
			? "rugRunner"
			: rng.pick(["rugPersian", "rugBlue", "rugGreen"] as const);
	return [
		texturedPlane(
			{
				texture: key,
				roughness: 1,
				transparent: round,
				alphaTest: round ? 0.5 : 0,
			},
			item.width,
			item.depth,
			0,
			0.012,
			0,
			0,
			-Math.PI / 2,
		),
	];
};

export const ritualCircle: FurnitureBuilder = ({ item }) => [
	texturedPlane(
		{
			texture: "ritualCircle",
			transparent: true,
			alphaTest: 0.3,
			roughness: 0.9,
			emissive: 0x6a0a10,
			emissiveIntensity: 0.6,
			depthWrite: false,
		},
		item.width,
		item.depth,
		0,
		0.015,
		0,
		0,
		-Math.PI / 2,
	),
];

export const broom: FurnitureBuilder = ({ item }) => [
	cylinderBetween(
		{ texture: "woodLight" },
		new THREE.Vector3(0, 0.3, 0),
		new THREE.Vector3(0, item.height, -0.1),
		0.016,
	),
	lathe(
		{ texture: "burlap", color: 0xc8a860, roughness: 1 },
		[
			[0.03, 0.34],
			[0.12, 0.05],
			[0.14, 0],
			[0.001, 0],
		],
		0,
		0,
		0.02,
		10,
	),
];

export const bucket: FurnitureBuilder = ({ item }) => [
	lathe(
		{ texture: "woodMedium", roughness: 0.9 },
		[
			[0.001, 0],
			[item.width * 0.38, 0],
			[item.width * 0.5, item.height],
			[item.width * 0.46, item.height],
			[item.width * 0.34, 0.03],
			[0.001, 0.03],
		],
		0,
		0,
		0,
		14,
	),
	torus(IRON, item.width * 0.44, 0.008, 0, item.height * 0.8, 0),
	torus(IRON, item.width * 0.3, 0.006, 0, item.height, 0, 0, 0, Math.PI),
];

export const floorBall: FurnitureBuilder = ({ item, rng }) => [
	sphere(
		{
			color: rng.pick([0xc83a2a, 0x2a6ac8, 0xd8b82a, 0x3a9a4a]),
			roughness: 0.6,
		},
		item.height / 2,
		0,
		item.height / 2,
		0,
		1,
		1,
		1,
		14,
	),
];

export const smallBox: FurnitureBuilder = ({ item, rng }) => [
	box(
		{
			texture: "woodLight",
			color: rng.pick([0xc84a3a, 0x3a6ac8, 0xd8c84a, 0x6a3ac8, 0x3ac87a]),
			roughness: 0.7,
		},
		item.width,
		item.height,
		item.depth,
		0,
		0,
		0,
		rng.next(),
		0.01,
	),
];

export const bookPile: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [];
	let y = 0;
	while (y < item.height) {
		const thickness = 0.04 + rng.next() * 0.04;
		parts.push(
			box(
				{
					texture: "leather",
					color: rng.pick([0xc84a3a, 0x3a5ac8, 0x4a8a3a, 0xc8a84a, 0xffffff]),
					roughness: 0.8,
				},
				item.width * (0.7 + rng.next() * 0.3),
				thickness,
				item.depth * (0.7 + rng.next() * 0.3),
				0,
				y,
				0,
				(rng.next() - 0.5) * 0.8,
			),
		);
		y += thickness;
	}
	return parts;
};

export const vialCluster: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [];
	for (let index = 0; index < 6; index += 1) {
		const color = rng.pick(POTION_COLORS);
		const x = (rng.next() - 0.5) * item.width * 0.8;
		const z = (rng.next() - 0.5) * item.depth * 0.8;
		const height = 0.08 + rng.next() * 0.12;
		if (rng.chance(0.2)) {
			const fallen = new THREE.CylinderGeometry(0.025, 0.03, height, 8);
			fallen.rotateZ(Math.PI / 2);
			fallen.translate(x, 0.03, z);
			parts.push({
				geometry: fallen,
				material: { ...GLASS, color, opacity: 0.7 },
			});
			continue;
		}
		parts.push(
			cylinder(
				{
					...GLASS,
					color,
					opacity: 0.7,
					emissive: color,
					emissiveIntensity: 0.2,
				},
				0.022,
				0.032,
				height,
				x,
				0,
				z,
				8,
			),
		);
		parts.push(
			cylinder({ texture: "woodLight" }, 0.012, 0.012, 0.02, x, height, z, 6),
		);
	}
	return parts;
};

export const floorCandles: FurnitureBuilder = ({ rng }) => {
	const parts: Part[] = [];
	for (let index = 0; index < 4; index += 1) {
		const angle = index * 1.6 + rng.next();
		parts.push(
			...candle(
				Math.cos(angle) * 0.14,
				0,
				Math.sin(angle) * 0.14,
				0.08 + rng.next() * 0.16,
				0.03,
			),
		);
	}
	return parts;
};

export const candleProp: FurnitureBuilder = ({ item }) => {
	if (item.variant === 1) {
		return [
			lathe(
				BRASS,
				[
					[0.001, 0],
					[0.06, 0],
					[0.02, 0.05],
					[0.015, 0.2],
					[0.001, 0.2],
				],
				0,
				0,
				0,
				10,
			),
			cylinderBetween(
				BRASS,
				new THREE.Vector3(-0.12, 0.2, 0),
				new THREE.Vector3(0.12, 0.2, 0),
				0.008,
			),
			...candle(-0.12, 0.2, 0, 0.12, 0.016),
			...candle(0.12, 0.2, 0, 0.12, 0.016),
			...candle(0, 0.2, 0, 0.16, 0.016),
		];
	}
	return [
		cylinder(BRASS, 0.045, 0.05, 0.015, 0, 0, 0, 10),
		...candle(0, 0.015, 0, 0.14, 0.022),
	];
};

export const books: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [];
	let x = -item.width / 2;
	while (x < item.width / 2 - 0.04) {
		const thickness = 0.04 + rng.next() * 0.03;
		const height = item.height * (0.75 + rng.next() * 0.25);
		parts.push(
			box(
				{
					texture: "leather",
					color: rng.pick([0xc84a3a, 0x3a5ac8, 0x4a8a3a, 0xc8a84a]),
					roughness: 0.8,
				},
				thickness,
				height,
				item.depth * 0.85,
				x + thickness / 2,
				0,
				0,
				0,
				0.004,
			),
		);
		x += thickness + 0.004;
	}
	return parts;
};

export const openBook: FurnitureBuilder = ({ item }) => [
	boxAt(
		{ texture: "leather", roughness: 0.8 },
		item.width,
		0.015,
		item.depth,
		0,
		0.0075,
		0,
	),
	boxAt(
		{ texture: "paper", roughness: 1 },
		item.width / 2 - 0.01,
		0.03,
		item.depth - 0.02,
		-item.width / 4,
		0.025,
		0,
		0,
		0,
		0.08,
	),
	boxAt(
		{ texture: "paper", roughness: 1 },
		item.width / 2 - 0.01,
		0.03,
		item.depth - 0.02,
		item.width / 4,
		0.025,
		0,
		0,
		0,
		-0.08,
	),
];

export const potions: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [];
	for (let index = 0; index < 4; index += 1) {
		const color = rng.pick(POTION_COLORS);
		const x = -item.width / 2 + 0.06 + index * ((item.width - 0.12) / 3);
		const radius = 0.035 + rng.next() * 0.02;
		parts.push(
			sphere(
				{
					...GLASS,
					color,
					opacity: 0.75,
					emissive: color,
					emissiveIntensity: 0.25,
				},
				radius,
				x,
				radius,
				(rng.next() - 0.5) * 0.08,
				1,
				1,
				1,
				10,
			),
		);
		parts.push(cylinder(GLASS, 0.012, 0.014, 0.06, x, radius * 1.7, 0, 6));
		parts.push(
			cylinder(
				{ texture: "woodLight" },
				0.014,
				0.014,
				0.015,
				x,
				radius * 1.7 + 0.06,
				0,
				6,
			),
		);
	}
	return parts;
};

export const jar: FurnitureBuilder = ({ item, rng }) => [
	cylinder({ ...GLASS, opacity: 0.45 }, 0.07, 0.07, item.height, 0, 0, 0, 12),
	cylinder(
		{ color: rng.pick([0x8a6a3a, 0x5a8a3a, 0xa83a2a]), roughness: 1 },
		0.06,
		0.06,
		item.height * 0.6,
		0,
		0.005,
		0,
		12,
	),
	cylinder(
		{ texture: "burlap", roughness: 1 },
		0.08,
		0.08,
		0.03,
		0,
		item.height,
		0,
		12,
	),
];

export const plateSet: FurnitureBuilder = ({ item }) => [
	cylinder(CERAMIC, 0.12, 0.09, 0.02, 0, 0, 0, 16),
	cylinder(BRASS, 0.008, 0.008, 0.005, item.width * 0.4, 0, 0, 4),
	boxAt(BRASS, 0.015, 0.005, 0.16, item.width * 0.38, 0.003, 0),
	boxAt(BRASS, 0.015, 0.005, 0.16, -item.width * 0.38, 0.003, 0),
	cylinder(
		{ ...GLASS, color: 0x8a1a2a, opacity: 0.6 },
		0.03,
		0.025,
		0.12,
		item.width * 0.3,
		0,
		-0.1,
		10,
	),
];

function socket(
	x: number,
	y: number,
	z: number,
	centerX: number,
	centerY: number,
	width: number,
	height: number,
	depth: number,
): number {
	const distance = Math.hypot((x - centerX) / width, (y - centerY) / height);
	return distance < 1 && z > 0.04 ? (1 - distance * distance) * depth : 0;
}

function skullShell(scale: number): THREE.BufferGeometry {
	const radius = 0.08;
	const geometry = meterSphere(radius, 48, 36);
	geometry.rotateY(-Math.PI / 2);
	const position = geometry.getAttribute("position") as THREE.BufferAttribute;
	const unit = new THREE.Vector3();
	for (let index = 0; index < position.count; index += 1) {
		unit.fromBufferAttribute(position, index).divideScalar(radius);
		const lower = Math.max(0, -unit.y);
		const front = Math.max(0, unit.z);
		let x = unit.x * 0.07 * (1 - lower * front * 0.38);
		let y = unit.y * 0.075;
		let z = unit.z * 0.094 - 0.008;
		if (unit.y < -0.35) {
			y = -0.35 * 0.075 + (unit.y + 0.35) * 0.075 * 0.45;
		}
		if (front > 0.2) {
			z = Math.min(z, 0.086 - lower * 0.022);
		}
		z -= socket(x, y, z, -0.029, 0.006, 0.021, 0.018, 0.024);
		z -= socket(x, y, z, 0.029, 0.006, 0.021, 0.018, 0.024);
		z -= socket(x, y, z, 0, -0.027, 0.009, 0.015, 0.02);
		const cheek = Math.exp(
			-(
				((Math.abs(x) - 0.054) / 0.016) ** 2 +
				((y + 0.012) / 0.02) ** 2 +
				((z - 0.045) / 0.03) ** 2
			),
		);
		x += Math.sign(x) * cheek * 0.007;
		position.setXYZ(index, x * scale, y * scale, z * scale);
	}
	geometry.computeVertexNormals();
	return geometry;
}

export const skull: FurnitureBuilder = ({ item }) => {
	const bone: MaterialOptions = { texture: "bone", roughness: 0.75 };
	const hollow: MaterialOptions = { color: 0x120d0a, roughness: 1 };
	const s = item.height / 0.2;
	const lift = 0.082 * s;
	const parts: Part[] = [
		part(placed(skullShell(s), 0, lift, 0), bone),
		ellipsoid(
			hollow,
			[0.016 * s, 0.014 * s, 0.012 * s],
			-0.029 * s,
			lift + 0.006 * s,
			0.058 * s,
			0,
			0,
			0,
			10,
		),
		ellipsoid(
			hollow,
			[0.016 * s, 0.014 * s, 0.012 * s],
			0.029 * s,
			lift + 0.006 * s,
			0.058 * s,
			0,
			0,
			0,
			10,
		),
		ellipsoid(
			hollow,
			[0.007 * s, 0.012 * s, 0.008 * s],
			0,
			lift - 0.027 * s,
			0.07 * s,
			0,
			0,
			0,
			8,
		),
		bentTube(
			bone,
			[
				[-0.05 * s, lift - 0.03 * s, 0.0],
				[-0.046 * s, lift - 0.066 * s, 0.035 * s],
				[-0.026 * s, lift - 0.075 * s, 0.068 * s],
				[0, lift - 0.078 * s, 0.078 * s],
				[0.026 * s, lift - 0.075 * s, 0.068 * s],
				[0.046 * s, lift - 0.066 * s, 0.035 * s],
				[0.05 * s, lift - 0.03 * s, 0.0],
			],
			(t) => (0.0075 + Math.sin(t * Math.PI) * 0.003) * s,
			32,
			8,
		),
	];
	for (const [y, depth] of [
		[-0.052, 0.07],
		[-0.063, 0.066],
	] as const) {
		for (let index = 0; index < 8; index += 1) {
			const angle = ((index - 3.5) / 3.5) * 0.9;
			parts.push(
				ellipsoid(
					bone,
					[0.0048 * s, 0.0062 * s, 0.0042 * s],
					Math.sin(angle) * 0.034 * s,
					lift + y * s,
					(Math.cos(angle) * depth - 0.006) * s,
					angle,
					0,
					0,
					6,
				),
			);
		}
	}
	return parts;
};

export const vase: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [
		lathe(
			{ ...CERAMIC, color: rng.pick([0xffffff, 0x8ab0c8, 0xc89a6a]) },
			[
				[0.001, 0],
				[0.06, 0],
				[0.1, 0.12],
				[0.05, 0.25],
				[0.07, 0.3],
				[0.001, 0.28],
			],
			0,
			0,
			0,
			14,
		),
	];
	for (let index = 0; index < 5; index += 1) {
		const angle = index * 1.25;
		const top = new THREE.Vector3(
			Math.cos(angle) * 0.08,
			item.height,
			Math.sin(angle) * 0.08,
		);
		parts.push(
			cylinderBetween(
				{ color: 0x3a6a2a },
				new THREE.Vector3(0, 0.25, 0),
				top,
				0.006,
				4,
			),
		);
		parts.push(
			sphere(
				{
					color: rng.pick([0xd8344a, 0xf0d04a, 0xe8e8e8, 0x9a4ad8]),
					roughness: 0.8,
				},
				0.035,
				top.x,
				top.y,
				top.z,
				1,
				0.8,
				1,
				8,
			),
		);
	}
	return parts;
};

export const inkwell: FurnitureBuilder = () => [
	cylinder(
		{ ...GLASS, color: 0x101018, opacity: 0.9 },
		0.04,
		0.05,
		0.05,
		0,
		0,
		0,
		10,
	),
	cylinderBetween(
		{ color: 0xf0f0e8, roughness: 1 },
		new THREE.Vector3(0.01, 0.03, 0),
		new THREE.Vector3(0.05, 0.22, -0.03),
		0.008,
		4,
	),
	boxAt(
		{ color: 0xf0f0e8, roughness: 1, side: THREE.DoubleSide },
		0.002,
		0.12,
		0.03,
		0.04,
		0.17,
		-0.025,
		0,
		0,
		-0.2,
	),
];

export const alembic: FurnitureBuilder = ({ item }) => [
	sphere(
		{ ...GLASS, color: 0xa0d0a0, opacity: 0.45 },
		0.09,
		-item.width * 0.25,
		0.09,
		0,
		1,
		1,
		1,
		14,
	),
	cylinderBetween(
		{ ...GLASS, opacity: 0.45 },
		new THREE.Vector3(-item.width * 0.25, 0.17, 0),
		new THREE.Vector3(-item.width * 0.25, 0.32, 0),
		0.02,
	),
	cylinderBetween(
		{ ...GLASS, opacity: 0.45 },
		new THREE.Vector3(-item.width * 0.25, 0.32, 0),
		new THREE.Vector3(item.width * 0.3, 0.12, 0),
		0.012,
	),
	cylinder(
		{ ...GLASS, color: 0xd0a0d0, opacity: 0.5 },
		0.04,
		0.05,
		0.12,
		item.width * 0.32,
		0,
		0,
		10,
	),
	cylinder(IRON, 0.07, 0.07, 0.03, -item.width * 0.25, -0.0, 0, 10),
];

export const cobweb: FurnitureBuilder = ({ item }) => {
	if (item.variant === 2) {
		const parts: Part[] = [];
		for (let index = 0; index < 3; index += 1) {
			parts.push(
				texturedPlane(
					{
						texture: "cobweb",
						transparent: true,
						alphaTest: 0.2,
						side: THREE.DoubleSide,
						depthWrite: false,
						roughness: 1,
					},
					item.width,
					item.height,
					0,
					item.height / 2,
					0,
					(index * Math.PI) / 3,
				),
			);
		}
		return parts;
	}
	const size = item.width;
	const top = item.height;
	const geometry = new THREE.BufferGeometry();
	const along = size * 0.7;
	const vertices = new Float32Array([
		0,
		top - size,
		0,
		along,
		top,
		along,
		-along,
		top,
		along,
		0,
		top,
		0,
		along,
		top,
		along,
		-along,
		top,
		along,
	]);
	const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
	geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
	geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
	geometry.computeVertexNormals();
	return [
		{
			geometry,
			material: {
				texture: "cobweb",
				transparent: true,
				alphaTest: 0.2,
				side: THREE.DoubleSide,
				depthWrite: false,
				roughness: 1,
				fixedRepeat: true,
			},
		},
	];
};

export const stoneSlab: FurnitureBuilder = ({ item, rng }) => [
	box(pickCarved(rng), item.width, item.height, item.depth, 0, 0, 0),
];
