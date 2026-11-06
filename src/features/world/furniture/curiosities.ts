import * as THREE from "three";
import { meterTorus, placed } from "../geometryUtils";
import type { MaterialOptions } from "../MaterialLibrary";
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

export const armor: FurnitureBuilder = () => [
	box(DARK_WOOD, 0.6, 0.12, 0.45, 0, 0, 0, 0, 0.02),
	box(PLATE, 0.15, 0.08, 0.24, -0.1, 0.12, 0.03, 0, 0.03),
	box(PLATE, 0.15, 0.08, 0.24, 0.1, 0.12, 0.03, 0, 0.03),
	box(PLATE, 0.13, 0.62, 0.15, -0.1, 0.2, 0, 0, 0.05),
	box(PLATE, 0.13, 0.62, 0.15, 0.1, 0.2, 0, 0, 0.05),
	cylinder(PLATE, 0.2, 0.25, 0.16, 0, 0.8, 0, 14),
	box(PLATE, 0.42, 0.55, 0.28, 0, 0.94, 0, 0, 0.1),
	sphere(PLATE, 0.1, -0.25, 1.44, 0, 1.1, 0.8, 1, 10),
	sphere(PLATE, 0.1, 0.25, 1.44, 0, 1.1, 0.8, 1, 10),
	box(PLATE, 0.1, 0.52, 0.12, -0.27, 0.9, 0.02, 0, 0.04),
	box(PLATE, 0.1, 0.52, 0.12, 0.27, 0.9, 0.02, 0, 0.04),
	sphere(PLATE, 0.135, 0, 1.68, 0, 1, 1.15, 1, 14),
	boxAt(DARK, 0.15, 0.022, 0.02, 0, 1.68, 0.13),
	sphere({ color: 0x8a1a1a, roughness: 1 }, 0.05, 0, 1.87, -0.04, 1, 2, 1.6, 8),
	cylinderBetween(
		DARK_WOOD,
		new THREE.Vector3(0.34, 0.12, 0.12),
		new THREE.Vector3(0.34, 1.98, 0.12),
		0.016,
		6,
	),
	boxAt(IRON, 0.02, 0.22, 0.14, 0.34, 1.84, 0.18),
];

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

export const rockingHorse: FurnitureBuilder = () => {
	const paint: MaterialOptions = { texture: "horsePaint", roughness: 0.6 };
	const mane: MaterialOptions = { color: 0x4a2a14, roughness: 1 };
	const parts: Part[] = [
		arc(DARK_WOOD, 0.75, 0.025, 1.25, -0.15, 0.78, 0),
		arc(DARK_WOOD, 0.75, 0.025, 1.25, 0.15, 0.78, 0),
		box(paint, 0.24, 0.24, 0.6, 0, 0.36, 0, 0, 0.09),
		boxAt(paint, 0.16, 0.3, 0.16, 0, 0.66, 0.3, -0.5),
		box(paint, 0.15, 0.17, 0.3, 0, 0.7, 0.43, 0, 0.06),
		boxAt(mane, 0.05, 0.3, 0.12, 0, 0.72, 0.24, -0.5),
		sphere(DARK, 0.018, -0.07, 0.8, 0.45, 1, 1, 1, 6),
		sphere(DARK, 0.018, 0.07, 0.8, 0.45, 1, 1, 1, 6),
		sphere(mane, 0.06, 0, 0.5, -0.33, 1, 1.4, 1, 8),
		box(
			{ texture: "velvetRed", roughness: 1 },
			0.26,
			0.04,
			0.22,
			0,
			0.6,
			-0.02,
			0,
			0.015,
		),
	];
	for (const x of [-0.1, 0.1]) {
		for (const z of [-0.22, 0.22]) {
			parts.push(
				cylinderBetween(
					paint,
					new THREE.Vector3(x, 0.4, z),
					new THREE.Vector3(x * 1.5, 0.08, z * 1.3),
					0.03,
					8,
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
		: { texture: "clothPale", roughness: 1, fixedRepeat: true };
	return [
		cylinder(dress, 0.035, 0.07, 0.14, 0, 0, 0, 10),
		part(placed(new THREE.SphereGeometry(0.05, 14, 10), 0, 0.19, 0), {
			texture: "dollFace",
			roughness: 0.4,
			fixedRepeat: true,
		}),
		sphere(
			{ color: 0xf0e2d4, roughness: 0.4 },
			0.018,
			-0.05,
			0.11,
			0.02,
			1,
			1,
			1,
			6,
		),
		sphere(
			{ color: 0xf0e2d4, roughness: 0.4 },
			0.018,
			0.05,
			0.11,
			0.02,
			1,
			1,
			1,
			6,
		),
	];
};

export const trophyHead: FurnitureBuilder = () => [
	box(DARK_WOOD, 0.4, 0.5, 0.04, 0, 0, 0.02, 0, 0.015),
	cylinderBetween(
		{ texture: "fur", roughness: 1 },
		new THREE.Vector3(0, 0.25, 0.04),
		new THREE.Vector3(0, 0.28, 0.22),
		0.09,
		10,
	),
	sphere(
		{ texture: "fur", roughness: 1 },
		0.12,
		0,
		0.3,
		0.28,
		1,
		0.9,
		1.25,
		12,
	),
	sphere(
		{ color: 0x3a2a1e, roughness: 0.8 },
		0.06,
		0,
		0.26,
		0.42,
		1,
		0.8,
		1.1,
		10,
	),
	sphere(
		{ color: 0x0a0806, roughness: 0.15 },
		0.018,
		-0.07,
		0.35,
		0.36,
		1,
		1,
		1,
		6,
	),
	sphere(
		{ color: 0x0a0806, roughness: 0.15 },
		0.018,
		0.07,
		0.35,
		0.36,
		1,
		1,
		1,
		6,
	),
	cylinderBetween(
		BONE,
		new THREE.Vector3(-0.06, 0.39, 0.27),
		new THREE.Vector3(-0.24, 0.66, 0.2),
		0.014,
		6,
	),
	cylinderBetween(
		BONE,
		new THREE.Vector3(0.06, 0.39, 0.27),
		new THREE.Vector3(0.24, 0.66, 0.2),
		0.014,
		6,
	),
	cylinderBetween(
		BONE,
		new THREE.Vector3(-0.15, 0.52, 0.24),
		new THREE.Vector3(-0.08, 0.7, 0.24),
		0.01,
		6,
	),
	cylinderBetween(
		BONE,
		new THREE.Vector3(0.15, 0.52, 0.24),
		new THREE.Vector3(0.08, 0.7, 0.24),
		0.01,
		6,
	),
];

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
