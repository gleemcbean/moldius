import * as THREE from "three";
import { meterTorus, placed } from "../../../src/features/world/geometryUtils";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import {
	BRASS,
	box,
	boxAt,
	cylinder,
	cylinderBetween,
	DARK,
	type FurnitureBuilder,
	GLASS,
	IRON,
	LINEN,
	lathe,
	type Part,
	part,
	pickCarved,
	pickWood,
	plane,
	STONE,
	sphere,
	texturedPlane,
	torus,
} from "./parts";
import {
	bentTube,
	capsuleBetween,
	ellipsoid,
	extruded,
	pleated,
} from "./sculpt";

const PLATE: MaterialOptions = {
	texture: "armorPlate",
	roughness: 0.42,
	metalness: 0.25,
};
const SHEET: MaterialOptions = { texture: "sheetCloth", roughness: 1 };
const PALE_WOOD: MaterialOptions = { texture: "woodLight", roughness: 0.8 };
const DARK_WOOD: MaterialOptions = { texture: "woodDark", roughness: 0.8 };
const BONE: MaterialOptions = { texture: "bone", roughness: 0.8 };

function cutout(texture: string): MaterialOptions {
	return {
		texture,
		alphaTest: 0.5,
		side: THREE.DoubleSide,
		roughness: 0.7,
		fixedRepeat: true,
	};
}

function arc(
	material: MaterialOptions,
	radius: number,
	tube: number,
	sweep: number,
	x: number,
	y: number,
	z: number,
): Part {
	const geometry = meterTorus(radius, tube, 6, 18, sweep);
	geometry.rotateZ(-Math.PI / 2 - sweep / 2);
	geometry.rotateY(Math.PI / 2);
	return part(placed(geometry, x, y, z), material);
}

function tripod(
	material: MaterialOptions,
	top: number,
	spread: number,
	radius = 0.018,
): Part[] {
	return [0, 1, 2].map((index) => {
		const angle = (index / 3) * Math.PI * 2 + Math.PI / 6;
		return cylinderBetween(
			material,
			new THREE.Vector3(0, top, 0),
			new THREE.Vector3(Math.cos(angle) * spread, 0, Math.sin(angle) * spread),
			radius,
			6,
		);
	});
}

export const armor: FurnitureBuilder = ({ rng }) => {
	const plate = PLATE;
	const strap: MaterialOptions = { texture: "tanLeather", roughness: 0.8 };
	const plume: MaterialOptions = {
		texture: rng.pick(["velvetRed", "velvetBlue", "velvetPurple"] as const),
		roughness: 1,
	};
	const parts: Part[] = [
		box(DARK_WOOD, 0.62, 0.1, 0.46, 0, 0, 0, 0, 0.02),
		cylinder(IRON, 0.012, 0.012, 1.45, 0, 0.1, -0.12, 6),
	];
	for (const side of [-1, 1]) {
		const x = side * 0.1;
		parts.push(
			ellipsoid(plate, [0.055, 0.035, 0.13], x, 0.135, 0.04, 0, 0, 0, 14),
			ellipsoid(plate, [0.05, 0.02, 0.05], x, 0.17, 0.11, 0, -0.5, 0, 10),
			lathe(
				plate,
				[
					[0.001, 0.15],
					[0.048, 0.15],
					[0.052, 0.22],
					[0.06, 0.36],
					[0.055, 0.46],
					[0.06, 0.5],
					[0.001, 0.5],
				],
				x,
				0,
				0.005,
				16,
			),
			ellipsoid(plate, [0.068, 0.06, 0.068], x, 0.53, 0.012, 0, 0, 0, 14),
			ellipsoid(
				plate,
				[0.06, 0.045, 0.025],
				x + side * 0.02,
				0.53,
				0.07,
				side * 0.4,
				0,
				0,
				10,
			),
			lathe(
				plate,
				[
					[0.001, 0.55],
					[0.06, 0.55],
					[0.068, 0.7],
					[0.078, 0.86],
					[0.001, 0.88],
				],
				x,
				0,
				0.005,
				16,
			),
			ellipsoid(
				plate,
				[0.09, 0.12, 0.025],
				x * 1.15,
				0.86,
				0.1,
				side * -0.12,
				-0.12,
				side * 0.08,
				14,
			),
		);
	}
	parts.push(
		pleated(
			plate,
			[
				[0.001, 0.82],
				[0.19, 0.82],
				[0.2, 0.86],
				[0.17, 0.98],
				[0.16, 1.04],
				[0.205, 1.2],
				[0.225, 1.33],
				[0.2, 1.42],
				[0.13, 1.48],
				[0.001, 1.49],
			],
			{ folds: 2, depth: () => 0.05, squash: 0.72, phase: Math.PI / 2 },
			0,
			0,
			0.01,
		),
		ellipsoid(plate, [0.03, 0.14, 0.03], 0, 1.27, 0.155, 0, -0.2, 0, 10),
		torus(strap, 0.168, 0.016, 0, 1.0, 0.01, Math.PI / 2, 0),
		box(BRASS, 0.05, 0.04, 0.02, 0, 0.98, 0.135, 0, 0.006),
		lathe(
			plate,
			[
				[0.001, 1.47],
				[0.12, 1.47],
				[0.11, 1.53],
				[0.07, 1.56],
				[0.001, 1.565],
			],
			0,
			0,
			0.005,
			18,
		),
	);
	for (const side of [-1, 1]) {
		const shoulder = new THREE.Vector3(side * 0.24, 1.4, 0.01);
		parts.push(
			ellipsoid(
				plate,
				[0.13, 0.085, 0.12],
				side * 0.22,
				1.42,
				0.01,
				0,
				0,
				side * -0.35,
				16,
			),
			ellipsoid(
				plate,
				[0.115, 0.06, 0.105],
				side * 0.25,
				1.36,
				0.01,
				0,
				0,
				side * -0.45,
				14,
			),
			ellipsoid(
				plate,
				[0.1, 0.045, 0.09],
				side * 0.27,
				1.31,
				0.01,
				0,
				0,
				side * -0.55,
				12,
			),
			capsuleBetween(
				plate,
				shoulder,
				new THREE.Vector3(side * 0.29, 1.12, 0.04),
				0.05,
				12,
			),
			ellipsoid(
				plate,
				[0.058, 0.058, 0.058],
				side * 0.29,
				1.1,
				0.045,
				0,
				0,
				0,
				12,
			),
			ellipsoid(
				plate,
				[0.05, 0.03, 0.045],
				side * 0.29,
				1.09,
				-0.01,
				0,
				-0.6,
				0,
				10,
			),
			capsuleBetween(
				plate,
				new THREE.Vector3(side * 0.29, 1.08, 0.06),
				new THREE.Vector3(side * 0.1, 0.96, 0.2),
				0.045,
				12,
			),
			ellipsoid(
				plate,
				[0.045, 0.06, 0.04],
				side * 0.07,
				0.95,
				0.22,
				0,
				0.3,
				side * 0.4,
				12,
			),
		);
	}
	parts.push(
		box(IRON, 0.05, 0.86, 0.008, 0, 0.12, 0.25, 0, 0.002),
		box(IRON, 0.035, 0.04, 0.008, 0, 0.12, 0.25, 0, 0.002),
		box(BRASS, 0.24, 0.025, 0.04, 0, 0.97, 0.24, 0, 0.008),
		capsuleBetween(
			{ texture: "tanLeather", color: 0x5a3a24, roughness: 0.8 },
			new THREE.Vector3(0, 1.0, 0.24),
			new THREE.Vector3(0, 1.13, 0.24),
			0.016,
			8,
		),
		sphere(BRASS, 0.026, 0, 1.15, 0.24, 1, 1, 1, 10),
		ellipsoid(plate, [0.13, 0.155, 0.14], 0, 1.72, 0.01, 0, 0, 0, 20),
		pleated(
			plate,
			[
				[0.001, -0.07],
				[0.11, -0.07],
				[0.135, 0.0],
				[0.13, 0.06],
				[0.001, 0.09],
			],
			{ folds: 1, depth: () => 0.0, squash: 0.85, segments: 24 },
			0,
			1.69,
			0.05,
		),
		box(DARK, 0.17, 0.014, 0.03, 0, 1.73, 0.135, 0, 0.004),
		ellipsoid(plate, [0.012, 0.11, 0.03], 0, 1.73, 0.15, 0, 0.1, 0, 8),
	);
	for (let index = 0; index < 5; index += 1) {
		parts.push(
			ellipsoid(
				DARK,
				[0.006, 0.006, 0.004],
				-0.04 + index * 0.02,
				1.655,
				0.142,
				0,
				0.3,
				0,
				6,
			),
		);
	}
	parts.push(
		pleated(
			plume,
			[
				[0.001, 0],
				[0.03, 0.03],
				[0.05, 0.12],
				[0.035, 0.25],
				[0.001, 0.3],
			],
			{ folds: 6, depth: (t) => 0.3 * t + 0.08, squash: 0.5 },
			0,
			0,
			0,
		),
	);
	const feather = parts[parts.length - 1];
	feather.geometry.applyMatrix4(
		new THREE.Matrix4().compose(
			new THREE.Vector3(0, 1.85, -0.02),
			new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.7, 0, 0)),
			new THREE.Vector3(1, 1, 1),
		),
	);
	return parts;
};

export const displayCase: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const { width, height, depth } = item;
	const caseBottom = 0.78;
	const caseHeight = height - caseBottom - 0.08;
	const parts: Part[] = [
		box(wood, width, caseBottom, depth, 0, 0, 0, 0, 0.01),
		box(wood, width + 0.04, 0.08, depth + 0.04, 0, height - 0.08, 0, 0, 0.01),
		texturedPlane(
			{ texture: "curiosityShelves", roughness: 0.9 },
			width - 0.06,
			caseHeight,
			0,
			caseBottom + caseHeight / 2,
			-depth / 2 + 0.03,
		),
		plane(
			GLASS,
			width - 0.06,
			caseHeight,
			0,
			caseBottom + caseHeight / 2,
			depth / 2 - 0.01,
		),
	];
	for (const x of [-1, 1]) {
		for (const z of [-1, 1]) {
			parts.push(
				box(
					wood,
					0.04,
					caseHeight,
					0.04,
					(x * (width - 0.04)) / 2,
					caseBottom,
					(z * (depth - 0.04)) / 2,
				),
			);
		}
		parts.push(
			plane(
				GLASS,
				depth - 0.06,
				caseHeight,
				(x * (width - 0.02)) / 2,
				caseBottom + caseHeight / 2,
				0,
				Math.PI / 2,
			),
		);
	}
	parts.push(
		box(
			{ ...GLASS, opacity: 0.5 },
			width - 0.08,
			0.012,
			depth - 0.08,
			0,
			caseBottom + caseHeight * 0.5,
			0,
		),
	);
	return parts;
};

export const boneShelf: FurnitureBuilder = ({ item }) => {
	const { width, height, depth } = item;
	const parts: Part[] = [
		texturedPlane(
			{ texture: "ossuary", roughness: 1 },
			width - 0.12,
			height - 0.12,
			0,
			height / 2,
			-depth / 2 + 0.06,
		),
		box(STONE, 0.08, height, depth, -width / 2 + 0.04, 0, 0),
		box(STONE, 0.08, height, depth, width / 2 - 0.04, 0, 0),
		box(STONE, width, 0.1, depth, 0, height - 0.1, 0),
		box(STONE, width, 0.1, depth, 0, 0, 0),
	];
	for (let index = 1; index < 4; index += 1) {
		parts.push(
			box(
				STONE,
				width - 0.16,
				0.04,
				depth - 0.1,
				0,
				(height / 4) * index,
				-0.05,
			),
		);
	}
	for (const x of [-0.3, 0.05, 0.32]) {
		if (Math.abs(x) < width / 2 - 0.15) {
			parts.push(sphere(BONE, 0.075, x, 0.17, 0.02, 1, 0.9, 1.1, 10));
		}
	}
	return parts;
};

export const telescope: FurnitureBuilder = ({ item }) => {
	const top = item.height * 0.6;
	const pivot = new THREE.Vector3(0, top + 0.1, 0);
	const aim = new THREE.Vector3(0, 0.55, 0.84).normalize();
	const front = pivot.clone().addScaledVector(aim, 0.55);
	const back = pivot.clone().addScaledVector(aim, -0.42);
	return [
		...tripod(DARK_WOOD, top, 0.36, 0.02),
		cylinder(BRASS, 0.045, 0.06, 0.12, 0, top - 0.04, 0, 10),
		sphere(BRASS, 0.05, pivot.x, pivot.y, pivot.z, 1, 1, 1, 10),
		cylinderBetween(BRASS, back, front, 0.065, 14),
		cylinderBetween(
			BRASS,
			front.clone().addScaledVector(aim, -0.06),
			front,
			0.08,
			14,
		),
		cylinderBetween(
			DARK,
			back,
			back.clone().addScaledVector(aim, -0.1),
			0.022,
			8,
		),
	];
};

export const orrery: FurnitureBuilder = ({ item, rng }) => {
	const wood = pickWood(rng);
	const center = item.height - 0.35;
	const parts: Part[] = [
		lathe(
			wood,
			[
				[0.001, 0],
				[0.24, 0],
				[0.22, 0.06],
				[0.06, 0.16],
				[0.05, center - 0.1],
				[0.001, center - 0.1],
			],
			0,
			0,
			0,
			12,
		),
		sphere(
			{ color: 0xf0b848, roughness: 0.4, emissive: 0x6a3a08 },
			0.075,
			0,
			center,
			0,
			1,
			1,
			1,
			12,
		),
	];
	const planets = [0x6a8ac8, 0xc86a3a, 0x8ab87a, 0xd8c8a0];
	[0.18, 0.27, 0.36].forEach((radius, index) => {
		const tilt = 0.25 * (index - 1);
		parts.push(torus(BRASS, radius, 0.006, 0, center, 0, Math.PI / 2 + tilt));
		const angle = rng.range(0, Math.PI * 2);
		const point = new THREE.Vector3(
			Math.cos(angle) * radius,
			Math.sin(angle) * radius * Math.sin(tilt),
			Math.sin(angle) * radius,
		);
		parts.push({
			...sphere(
				{ color: planets[index], roughness: 0.5 },
				0.03 + index * 0.008,
				point.x,
				center + point.y,
				point.z,
				1,
				1,
				1,
				10,
			),
			animation: {
				kind: "spin",
				pivot: [0, center, 0],
				axis: [Math.sin(tilt), Math.cos(tilt), 0],
				speed: 0.5 - index * 0.13,
				amplitude: 0,
				phase: 0,
			},
		});
	});
	return parts;
};

export const crib: FurnitureBuilder = ({ item }) => {
	const { width, height, depth } = item;
	const railHeight = height - 0.3;
	const parts: Part[] = [];
	for (const x of [-1, 1]) {
		for (const z of [-1, 1]) {
			parts.push(
				cylinder(
					PALE_WOOD,
					0.03,
					0.03,
					height,
					(x * (width - 0.06)) / 2,
					0,
					(z * (depth - 0.06)) / 2,
					8,
				),
			);
			parts.push(
				sphere(
					PALE_WOOD,
					0.04,
					(x * (width - 0.06)) / 2,
					height,
					(z * (depth - 0.06)) / 2,
					1,
					1,
					1,
					8,
				),
			);
		}
		parts.push(
			texturedPlane(
				cutout("spindles"),
				depth - 0.1,
				railHeight,
				(x * (width - 0.06)) / 2,
				0.3 + railHeight / 2,
				0,
				Math.PI / 2,
			),
		);
	}
	for (const z of [-1, 1]) {
		parts.push(
			texturedPlane(
				cutout("spindles"),
				width - 0.1,
				railHeight,
				0,
				0.3 + railHeight / 2,
				(z * (depth - 0.06)) / 2,
			),
		);
	}
	parts.push(box(LINEN, width - 0.1, 0.12, depth - 0.1, 0, 0.3, 0));
	parts.push(
		box(
			{ texture: "velvetBlue", roughness: 1 },
			width - 0.12,
			0.04,
			depth * 0.55,
			0,
			0.42,
			depth * 0.18,
			0,
			0.015,
		),
	);
	parts.push(
		box(LINEN, width * 0.45, 0.06, 0.18, 0, 0.42, -depth / 2 + 0.17, 0, 0.03),
	);
	return parts;
};

export const rockingHorse: FurnitureBuilder = ({ rng }) => {
	const paint: MaterialOptions = { texture: "horsePaint", roughness: 0.6 };
	const mane: MaterialOptions = {
		texture: "fur",
		color: rng.pick([0x4a2a14, 0x2a1a12, 0xd8c8a8]),
		roughness: 1,
	};
	const saddle: MaterialOptions = { texture: "velvetRed", roughness: 1 };
	const leather: MaterialOptions = {
		texture: "tanLeather",
		color: 0x6a3a22,
		roughness: 0.8,
	};
	const eye: MaterialOptions = { color: 0x0a0806, roughness: 0.15 };
	const parts: Part[] = [
		arc(DARK_WOOD, 0.75, 0.025, 1.25, -0.15, 0.78, 0),
		arc(DARK_WOOD, 0.75, 0.025, 1.25, 0.15, 0.78, 0),
		box(DARK_WOOD, 0.34, 0.02, 0.05, 0, 0.055, -0.3, 0, 0.006),
		box(DARK_WOOD, 0.34, 0.02, 0.05, 0, 0.032, 0, 0, 0.006),
		box(DARK_WOOD, 0.34, 0.02, 0.05, 0, 0.055, 0.3, 0, 0.006),
		ellipsoid(paint, [0.12, 0.13, 0.29], 0, 0.5, -0.02, 0, 0.06, 0, 20),
		bentTube(
			paint,
			[
				[0, 0.54, 0.2],
				[0, 0.66, 0.29],
				[0, 0.76, 0.34],
			],
			(t) => 0.085 - t * 0.03,
			14,
			14,
		),
		ellipsoid(paint, [0.058, 0.07, 0.11], 0, 0.79, 0.39, 0, 0.55, 0, 16),
		ellipsoid(paint, [0.045, 0.045, 0.06], 0, 0.74, 0.47, 0, 0.55, 0, 12),
		ellipsoid(DARK, [0.01, 0.008, 0.006], -0.022, 0.735, 0.515, 0, 0, 0, 6),
		ellipsoid(DARK, [0.01, 0.008, 0.006], 0.022, 0.735, 0.515, 0, 0, 0, 6),
		capsuleBetween(
			DARK_WOOD,
			new THREE.Vector3(-0.1, 0.8, 0.36),
			new THREE.Vector3(0.1, 0.8, 0.36),
			0.012,
			8,
		),
		ellipsoid(saddle, [0.13, 0.04, 0.13], 0, 0.62, -0.05, 0, -0.06, 0, 16),
		ellipsoid(saddle, [0.06, 0.035, 0.05], 0, 0.645, -0.15, 0, 0, 0, 10),
		bentTube(
			mane,
			[
				[0, 0.6, 0.15],
				[0, 0.73, 0.24],
				[0, 0.85, 0.3],
				[0, 0.88, 0.36],
			],
			(t) => 0.03 - t * 0.008,
			16,
			8,
		),
		bentTube(
			mane,
			[
				[0, 0.55, -0.3],
				[0, 0.52, -0.38],
				[0, 0.42, -0.42],
				[0, 0.32, -0.4],
			],
			(t) => 0.04 - t * 0.02,
			14,
			8,
		),
		bentTube(
			leather,
			[
				[-0.04, 0.745, 0.47],
				[-0.08, 0.72, 0.3],
				[-0.1, 0.66, 0.06],
			],
			0.005,
			10,
			4,
		),
		bentTube(
			leather,
			[
				[0.04, 0.745, 0.47],
				[0.08, 0.72, 0.3],
				[0.1, 0.66, 0.06],
			],
			0.005,
			10,
			4,
		),
	];
	for (const side of [-1, 1]) {
		parts.push(
			ellipsoid(eye, [0.012, 0.012, 0.01], side * 0.045, 0.83, 0.4, 0, 0, 0, 8),
			ellipsoid(
				paint,
				[0.014, 0.035, 0.01],
				side * 0.03,
				0.88,
				0.34,
				0,
				-0.3,
				side * -0.3,
				8,
			),
			torus(
				BRASS,
				0.025,
				0.004,
				side * 0.13,
				0.48,
				-0.04,
				0,
				Math.PI / 2,
				Math.PI * 1.6,
			),
			capsuleBetween(
				leather,
				new THREE.Vector3(side * 0.125, 0.63, -0.04),
				new THREE.Vector3(side * 0.13, 0.5, -0.04),
				0.004,
				4,
			),
		);
		for (const end of [-1, 1]) {
			const hipZ = end * 0.2;
			const footZ = end * 0.34;
			parts.push(
				capsuleBetween(
					paint,
					new THREE.Vector3(side * 0.075, 0.45, hipZ),
					new THREE.Vector3(side * 0.13, 0.22, hipZ + end * 0.08),
					0.033,
					10,
				),
				capsuleBetween(
					paint,
					new THREE.Vector3(side * 0.13, 0.22, hipZ + end * 0.08),
					new THREE.Vector3(side * 0.15, 0.09, footZ),
					0.026,
					10,
				),
				ellipsoid(
					DARK,
					[0.03, 0.022, 0.035],
					side * 0.15,
					0.075,
					footZ + end * 0.01,
					0,
					0,
					0,
					10,
				),
			);
		}
	}
	return parts;
};

export const dressForm: FurnitureBuilder = ({ rng }) => {
	const fabric: MaterialOptions = rng.chance(0.5)
		? { texture: "linen", color: 0xd0c0a8, roughness: 1 }
		: { texture: "velvetRed", roughness: 1 };
	return [
		...tripod(DARK_WOOD, 0.3, 0.22),
		cylinder(DARK_WOOD, 0.02, 0.02, 0.7, 0, 0.28, 0, 8),
		lathe(
			fabric,
			[
				[0.001, 0],
				[0.15, 0.02],
				[0.17, 0.14],
				[0.13, 0.32],
				[0.18, 0.5],
				[0.16, 0.6],
				[0.06, 0.66],
				[0.001, 0.67],
			],
			0,
			0.95,
			0,
			16,
		),
		cylinder(DARK_WOOD, 0.035, 0.03, 0.06, 0, 1.6, 0, 10),
	];
};

export const sheetedFurniture: FurnitureBuilder = ({ item }) => {
	const { width, height, depth } = item;
	if (item.variant === 2) {
		return [
			box(SHEET, width, height, depth, 0, 0, 0, 0, 0.14),
			box(SHEET, width + 0.08, 0.22, depth + 0.08, 0, 0, 0, 0, 0.05),
		];
	}
	const seat = height * 0.55;
	return [
		box(SHEET, width, seat, depth, 0, 0, 0, 0, 0.12),
		box(
			SHEET,
			width,
			height,
			depth * 0.32,
			0,
			0,
			-depth / 2 + depth * 0.16,
			0,
			0.13,
		),
		box(SHEET, 0.2, height * 0.75, depth, -width / 2 + 0.1, 0, 0, 0, 0.09),
		box(SHEET, 0.2, height * 0.75, depth, width / 2 - 0.1, 0, 0, 0, 0.09),
		box(SHEET, width + 0.08, 0.2, depth + 0.08, 0, 0, 0, 0, 0.05),
	];
};

export const dryingLine: FurnitureBuilder = ({ item, rng }) => {
	const { width, height } = item;
	const half = width / 2 - 0.06;
	const parts: Part[] = [];
	for (const x of [-half, half]) {
		parts.push(cylinder(DARK_WOOD, 0.035, 0.04, height, x, 0, 0, 8));
		parts.push(box(DARK_WOOD, 0.08, 0.06, 0.4, x, 0, 0));
	}
	parts.push(
		cylinderBetween(
			{ color: 0x8a7a5a, roughness: 1 },
			new THREE.Vector3(-half, height - 0.08, 0),
			new THREE.Vector3(half, height - 0.08, 0),
			0.008,
			5,
		),
	);
	const sheets = width > 2 ? 2 : 1;
	const sheetWidth = (width - 0.3) / sheets - 0.04;
	for (let index = 0; index < sheets; index += 1) {
		const x = -width / 2 + 0.15 + sheetWidth / 2 + index * (sheetWidth + 0.08);
		parts.push(
			texturedPlane(
				cutout("sheetHanging"),
				sheetWidth,
				1.45,
				x,
				height - 0.08 - 0.725,
				(rng.next() - 0.5) * 0.06,
				(rng.next() - 0.5) * 0.12,
			),
		);
	}
	return parts;
};

export const washtub: FurnitureBuilder = ({ item }) => {
	const radius = item.width / 2 - 0.02;
	return [
		lathe(
			{ texture: "woodMedium", roughness: 0.9 },
			[
				[0.001, 0],
				[radius * 0.88, 0],
				[radius, item.height],
				[radius - 0.03, item.height],
				[radius * 0.85, 0.05],
				[0.001, 0.05],
			],
			0,
			0,
			0,
			18,
		),
		torus(IRON, radius * 0.92, 0.012, 0, 0.12, 0),
		torus(IRON, radius * 0.98, 0.012, 0, item.height - 0.1, 0),
		cylinder(
			{ color: 0x4a5a52, roughness: 0.15 },
			radius - 0.05,
			radius - 0.05,
			0.01,
			0,
			item.height - 0.12,
			0,
			18,
		),
		boxAt(
			{ texture: "woodLight", roughness: 0.9 },
			0.32,
			0.55,
			0.03,
			0.12,
			item.height,
			0.05,
			-0.35,
		),
	];
};

export const laundryBasket: FurnitureBuilder = ({ item }) => {
	const width = item.width / 2;
	return [
		lathe(
			{ texture: "wicker", roughness: 1 },
			[
				[0.001, 0],
				[width * 0.85, 0],
				[width, item.height * 0.75],
				[width - 0.02, item.height * 0.75],
				[width * 0.82, 0.03],
				[0.001, 0.03],
			],
			0,
			0,
			0,
			14,
		),
		sphere(SHEET, width * 0.85, 0, item.height * 0.72, 0, 1, 0.42, 0.85, 12),
		torus(
			{ texture: "wicker", roughness: 1 },
			0.07,
			0.012,
			-width + 0.02,
			item.height * 0.7,
			0,
			0,
			Math.PI / 2,
			Math.PI,
		),
		torus(
			{ texture: "wicker", roughness: 1 },
			0.07,
			0.012,
			width - 0.02,
			item.height * 0.7,
			0,
			0,
			Math.PI / 2,
			Math.PI,
		),
	];
};

export const sarcophagus: FurnitureBuilder = ({ item, rng }) => {
	const material = pickCarved(rng);
	const { width, height, depth } = item;
	const lidHeight = 0.16;
	const shift = rng.chance(0.4) ? 0.12 : 0;
	return [
		box(material, width * 0.94, 0.12, depth * 0.96, 0, 0, 0),
		box(
			material,
			width * 0.88,
			height - lidHeight - 0.12,
			depth * 0.9,
			0,
			0.12,
			0,
			0,
			0.02,
		),
		box(
			material,
			width,
			lidHeight,
			depth,
			shift * 0.4,
			height - lidHeight,
			shift,
			shift * 0.6,
			0.03,
		),
		texturedPlane(
			{ texture: "sarcophagusLid", roughness: 0.95 },
			width * 0.9,
			depth * 0.94,
			shift * 0.4,
			height + 0.003,
			shift,
			shift * 0.6,
			-Math.PI / 2,
		),
	];
};

export const birdcage: FurnitureBuilder = () => {
	const cageBottom = 1.12;
	return [
		lathe(
			DARK_WOOD,
			[
				[0.001, 0],
				[0.22, 0],
				[0.2, 0.05],
				[0.04, 0.1],
				[0.001, 0.1],
			],
			0,
			0,
			0,
			12,
		),
		cylinder(BRASS, 0.018, 0.018, 1.55, 0, 0.08, 0, 8),
		cylinderBetween(
			BRASS,
			new THREE.Vector3(0, 1.6, 0),
			new THREE.Vector3(0, 1.62, 0.02),
			0.012,
		),
		cylinder(BRASS, 0.2, 0.2, 0.02, 0, cageBottom, 0, 16),
		lathe(
			cutout("cageBars"),
			[
				[0.2, 0],
				[0.2, 0.34],
				[0.13, 0.45],
				[0.03, 0.5],
			],
			0,
			cageBottom,
			0,
			16,
		),
		cylinderBetween(
			BRASS,
			new THREE.Vector3(-0.17, cageBottom + 0.16, 0),
			new THREE.Vector3(0.17, cageBottom + 0.16, 0),
			0.005,
		),
		sphere(
			{ color: 0x2a2a30, roughness: 1 },
			0.045,
			0.02,
			cageBottom + 0.05,
			0.03,
			1.3,
			0.6,
			1,
			8,
		),
	];
};

export const bellJar: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [
		cylinder(DARK_WOOD, 0.1, 0.11, 0.035, 0, 0, 0, 14),
		lathe(
			{ ...GLASS, opacity: 0.28, side: THREE.DoubleSide },
			[
				[0.085, 0.035],
				[0.085, item.height - 0.08],
				[0.06, item.height - 0.03],
				[0.001, item.height - 0.015],
			],
			0,
			0,
			0,
			14,
		),
	];
	if (rng.chance(0.5)) {
		parts.push(
			cylinder(
				{ texture: "stem", roughness: 0.9 },
				0.012,
				0.016,
				0.1,
				0,
				0.035,
				0,
				8,
			),
		);
		parts.push(
			sphere(
				{ color: 0xc83a2a, roughness: 0.6 },
				0.045,
				0,
				0.14,
				0,
				1,
				0.6,
				1,
				10,
			),
		);
	} else {
		parts.push(
			sphere(
				{ texture: "eyeball", roughness: 0.25, fixedRepeat: true },
				0.045,
				0,
				0.09,
				0,
				1,
				1,
				1,
				12,
			),
		);
	}
	return parts;
};

export const doll: FurnitureBuilder = ({ rng }) => {
	const dress: MaterialOptions = rng.chance(0.5)
		? { texture: "velvetRed", roughness: 1 }
		: {
				texture: rng.pick(["velvetBlue", "velvetGreen", "clothPale"] as const),
				roughness: 1,
			};
	const porcelain: MaterialOptions = { color: 0xf0e2d4, roughness: 0.35 };
	const lace: MaterialOptions = {
		texture: "linen",
		color: 0xf4efe4,
		roughness: 1,
	};
	const hair: MaterialOptions = {
		texture: "fur",
		color: rng.pick([0x6a3a1a, 0xc8a050, 0x2a1a12, 0x8a2a14]),
		roughness: 1,
	};
	const parts: Part[] = [
		pleated(
			dress,
			[
				[0.001, 0],
				[0.085, 0],
				[0.09, 0.012],
				[0.07, 0.06],
				[0.045, 0.105],
				[0.038, 0.12],
				[0.001, 0.122],
			],
			{
				folds: 10,
				depth: (t) => 0.12 * (1 - t) + 0.02,
				phase: rng.next() * 6,
				segments: 36,
			},
			0,
			0,
			0,
		),
		pleated(
			lace,
			[
				[0.001, 0],
				[0.088, 0],
				[0.092, 0.008],
				[0.001, 0.009],
			],
			{ folds: 22, depth: () => 0.05, segments: 44 },
			0,
			0.002,
			0,
		),
		lathe(
			dress,
			[
				[0.001, 0.115],
				[0.04, 0.115],
				[0.042, 0.15],
				[0.046, 0.18],
				[0.035, 0.205],
				[0.001, 0.21],
			],
			0,
			0,
			0,
			18,
		),
		torus(lace, 0.026, 0.009, 0, 0.207, 0),
		cylinder(porcelain, 0.014, 0.016, 0.02, 0, 0.205, 0, 10),
		part(placed(new THREE.SphereGeometry(0.062, 20, 14), 0, 0.27, 0), {
			texture: "dollFace",
			roughness: 0.35,
			fixedRepeat: true,
		}),
		pleated(
			hair,
			[
				[0.001, -0.035],
				[0.062, -0.035],
				[0.068, 0.0],
				[0.064, 0.035],
				[0.04, 0.062],
				[0.001, 0.07],
			],
			{ folds: 12, depth: (t) => 0.08 * (1 - t) + 0.02, segments: 30 },
			0,
			0.275,
			-0.012,
		),
		ellipsoid(
			{ texture: "velvetRed", roughness: 1 },
			[0.022, 0.014, 0.008],
			-0.03,
			0.335,
			0.0,
			0.4,
			0,
			0.5,
			8,
		),
		ellipsoid(
			{ texture: "velvetRed", roughness: 1 },
			[0.022, 0.014, 0.008],
			0.03,
			0.335,
			0.0,
			-0.4,
			0,
			-0.5,
			8,
		),
		sphere(
			{ texture: "velvetRed", roughness: 1 },
			0.008,
			0,
			0.335,
			0.004,
			1,
			1,
			1,
			6,
		),
	];
	for (const side of [-1, 1]) {
		parts.push(
			capsuleBetween(
				dress,
				new THREE.Vector3(side * 0.04, 0.19, 0),
				new THREE.Vector3(side * 0.07, 0.13, 0.03),
				0.016,
				8,
			),
			sphere(porcelain, 0.014, side * 0.073, 0.115, 0.04, 1, 1.2, 0.9, 8),
			sphere(lace, 0.019, side * 0.066, 0.135, 0.032, 1, 0.6, 1, 8),
			capsuleBetween(
				porcelain,
				new THREE.Vector3(side * 0.025, 0.02, 0.04),
				new THREE.Vector3(side * 0.028, 0.02, 0.11),
				0.014,
				8,
			),
			ellipsoid(
				{ color: 0x1a1210, roughness: 0.4 },
				[0.017, 0.013, 0.024],
				side * 0.028,
				0.018,
				0.125,
				0,
				0,
				0,
				8,
			),
		);
	}
	return parts;
};

function plaqueShape(): THREE.Shape {
	const shape = new THREE.Shape();
	shape.moveTo(-0.17, 0.5);
	shape.quadraticCurveTo(0, 0.56, 0.17, 0.5);
	shape.quadraticCurveTo(0.2, 0.3, 0.17, 0.12);
	shape.quadraticCurveTo(0.12, 0.02, 0, -0.02);
	shape.quadraticCurveTo(-0.12, 0.02, -0.17, 0.12);
	shape.quadraticCurveTo(-0.2, 0.3, -0.17, 0.5);
	return shape;
}

export const trophyHead: FurnitureBuilder = ({ rng }) => {
	const fur: MaterialOptions = { texture: "fur", roughness: 1 };
	const muzzle: MaterialOptions = {
		texture: "fur",
		color: 0x6a5040,
		roughness: 1,
	};
	const antlerMaterial: MaterialOptions = { ...BONE, color: 0xd8c8a8 };
	const eye: MaterialOptions = { color: 0x0a0806, roughness: 0.12 };
	const parts: Part[] = [
		extruded(DARK_WOOD, plaqueShape(), 0.045, 0.01, 0, 0, 0.022),
		bentTube(
			fur,
			[
				[0, 0.24, 0.04],
				[0, 0.27, 0.12],
				[0, 0.32, 0.2],
			],
			(t) => 0.1 - t * 0.025,
			12,
			14,
		),
		bentTube(
			fur,
			[
				[0, 0.33, 0.2],
				[0, 0.34, 0.27],
				[0, 0.31, 0.35],
				[0, 0.27, 0.42],
			],
			(t) => 0.075 - t * 0.04,
			16,
			14,
		),
		ellipsoid(muzzle, [0.042, 0.034, 0.04], 0, 0.265, 0.43, 0, 0.2, 0, 12),
		ellipsoid(
			{ color: 0x14100e, roughness: 0.3 },
			[0.026, 0.016, 0.012],
			0,
			0.276,
			0.465,
			0,
			-0.3,
			0,
			8,
		),
		ellipsoid(fur, [0.05, 0.03, 0.04], 0, 0.245, 0.36, 0, 0.2, 0, 10),
	];
	for (const side of [-1, 1]) {
		parts.push(
			ellipsoid(
				eye,
				[0.014, 0.014, 0.012],
				side * 0.062,
				0.355,
				0.31,
				0,
				0,
				0,
				10,
			),
			ellipsoid(
				fur,
				[0.022, 0.06, 0.012],
				side * 0.085,
				0.4,
				0.24,
				side * 0.5,
				0.3,
				side * -0.9,
				10,
			),
		);
		const sx = side;
		const beam: [number, number, number][] = [
			[sx * 0.045, 0.39, 0.25],
			[sx * 0.11, 0.48, 0.24],
			[sx * 0.2, 0.58, 0.2],
			[sx * 0.24, 0.72, 0.16],
			[sx * 0.22, 0.84, 0.12],
		];
		parts.push(bentTube(antlerMaterial, beam, (t) => 0.016 - t * 0.011, 18, 8));
		for (const [at, reach, lift] of [
			[1, 0.07, 0.1],
			[2, 0.09, 0.14],
			[3, 0.06, 0.12],
		] as const) {
			const [bx, by, bz] = beam[at];
			const spread = rng.range(0.8, 1.2);
			parts.push(
				bentTube(
					antlerMaterial,
					[
						[bx, by, bz],
						[bx - sx * reach * 0.2, by + lift * 0.5 * spread, bz + reach * 0.5],
						[bx - sx * reach * 0.1, by + lift * spread, bz + reach * 0.75],
					],
					(t) => 0.011 - t * 0.008,
					10,
					6,
				),
			);
		}
	}
	return parts;
};

export const specimenFrame: FurnitureBuilder = ({ item }) => [
	box(
		DARK_WOOD,
		item.width + 0.06,
		item.height + 0.06,
		0.05,
		0,
		-0.03,
		0.025,
		0,
		0.01,
	),
	texturedPlane(
		{ texture: "specimens", roughness: 0.9 },
		item.width,
		item.height,
		0,
		item.height / 2,
		0.052,
	),
	plane(
		{ ...GLASS, opacity: 0.18 },
		item.width,
		item.height,
		0,
		item.height / 2,
		0.058,
	),
];

export const starChart: FurnitureBuilder = ({ item }) => [
	texturedPlane(
		{ texture: "starChart", roughness: 0.95 },
		item.width,
		item.height,
		0,
		item.height / 2,
		0.012,
	),
	cylinderBetween(
		DARK_WOOD,
		new THREE.Vector3(-item.width / 2 - 0.04, item.height, 0.02),
		new THREE.Vector3(item.width / 2 + 0.04, item.height, 0.02),
		0.018,
		8,
	),
	cylinderBetween(
		DARK_WOOD,
		new THREE.Vector3(-item.width / 2 - 0.04, 0, 0.02),
		new THREE.Vector3(item.width / 2 + 0.04, 0, 0.02),
		0.018,
		8,
	),
];
