import type { SeededRandom } from "@shared/random";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
	meterBox,
	meterCylinder,
} from "../../../src/features/world/geometryUtils";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import { GLOWING_CAPS, MOSS, smallMushroom } from "./fungi";
import {
	box,
	DARK,
	type FurnitureBuilder,
	lathe,
	type Part,
	type PartAnimation,
	part,
	STONE,
	sphere,
	texturedPlane,
	torus,
} from "./parts";

export const CRYSTAL_TINTS: readonly MaterialOptions[] = [
	{
		color: 0xb88aff,
		emissive: 0x7a3aff,
		emissiveIntensity: 1.1,
		roughness: 0.12,
		metalness: 0.1,
	},
	{
		color: 0x7ad8ff,
		emissive: 0x2a8aff,
		emissiveIntensity: 1.1,
		roughness: 0.12,
		metalness: 0.1,
	},
	{
		color: 0xff9ad8,
		emissive: 0xd83a9a,
		emissiveIntensity: 1,
		roughness: 0.12,
		metalness: 0.1,
	},
];

const RUNE_GLOW: MaterialOptions = { color: 0xc89aff, unlit: true };
const BASALT: MaterialOptions = { texture: "basalt", roughness: 0.9 };
const BARK: MaterialOptions = { texture: "bark", roughness: 1 };

const LEATHER_COLORS = [0x6a2a22, 0x2a3a5a, 0x3a5a2a, 0x5a3a1a, 0x4a2a5a];

function shardGeometry(radius: number, length: number): THREE.BufferGeometry {
	const tip = radius * 1.8;
	const prism = meterCylinder(radius, radius, length - tip * 2, 6);
	const top = meterCylinder(0, radius, tip, 6);
	const bottom = meterCylinder(radius, 0, tip, 6);

	prism.translate(0, tip + (length - tip * 2) / 2, 0);
	top.translate(0, length - tip / 2, 0);
	bottom.translate(0, tip / 2, 0);

	const merged = mergeGeometries([bottom, prism, top], false);

	if (!merged) {
		throw new Error("Impossible d'assembler le cristal");
	}

	return merged;
}

function shard(
	material: MaterialOptions,
	radius: number,
	length: number,
	origin: THREE.Vector3,
	direction: THREE.Vector3,
): Part {
	const geometry = shardGeometry(radius, length);

	const rotation = new THREE.Quaternion().setFromUnitVectors(
		new THREE.Vector3(0, 1, 0),
		direction.clone().normalize(),
	);

	geometry.applyQuaternion(rotation);
	geometry.translate(origin.x, origin.y, origin.z);

	return part(geometry, material);
}

function animated(parts: Part[], animation: PartAnimation): Part[] {
	return parts.map((piece) => ({ ...piece, animation }));
}

function runePedestal(radius: number, height: number): Part[] {
	return [
		lathe(
			STONE,
			[
				[radius, 0],
				[radius, 0.06],
				[radius * 0.78, 0.1],
				[radius * 0.62, height - 0.08],
				[radius * 0.8, height - 0.04],
				[radius * 0.8, height],
				[0.001, height],
			],
			0,
			0,
			0,
			8,
		),
		torus(RUNE_GLOW, radius * 0.7, 0.012, 0, height * 0.55, 0),
		torus(RUNE_GLOW, radius * 0.82, 0.01, 0, height + 0.005, 0),
	];
}

export const floatingCrystal: FurnitureBuilder = ({ item, rng }) => {
	const radius = Math.min(item.width, item.depth) / 2;
	const pedestalHeight = 0.45;
	const tint = rng.pick(CRYSTAL_TINTS);
	const crystalLength = item.height - pedestalHeight - 0.35;
	const center = pedestalHeight + 0.2 + crystalLength / 2;

	const crystal = shard(
		tint,
		radius * 0.28,
		crystalLength,
		new THREE.Vector3(0, center - crystalLength / 2, 0),
		new THREE.Vector3(0, 1, 0),
	);

	const orbiters: Part[] = [];

	for (let index = 0; index < 3; index += 1) {
		const angle = (index / 3) * Math.PI * 2;

		orbiters.push(
			shard(
				tint,
				radius * 0.07,
				radius * 0.45,
				new THREE.Vector3(
					Math.cos(angle) * radius * 0.75,
					center + rng.range(-0.15, 0.15),
					Math.sin(angle) * radius * 0.75,
				),
				new THREE.Vector3(rng.range(-0.3, 0.3), 1, rng.range(-0.3, 0.3)),
			),
		);
	}

	return [
		...runePedestal(radius, pedestalHeight),
		...animated([crystal], {
			kind: "float",
			pivot: [0, center, 0],
			axis: [0, 1, 0],
			speed: 1.2,
			amplitude: 0.06,
			phase: rng.range(0, Math.PI * 2),
		}),
		...animated(orbiters, {
			kind: "spin",
			pivot: [0, center, 0],
			axis: [0, 1, 0],
			speed: 0.8,
			amplitude: 0,
			phase: 0,
		}),
	];
};

export const crystalCluster: FurnitureBuilder = ({ item, rng }) => {
	const tint = rng.pick(CRYSTAL_TINTS);

	const parts: Part[] = [
		sphere(
			BASALT,
			0.5,
			0,
			0.02,
			0,
			item.width * 0.9,
			0.35,
			item.depth * 0.9,
			12,
		),
	];

	const count = rng.int(6, 10);

	for (let index = 0; index < count; index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const reach = rng.range(0, 0.35);
		const tilt = rng.range(0.1, 0.7) * (index === 0 ? 0.2 : 1);

		const direction = new THREE.Vector3(
			Math.cos(angle) * Math.sin(tilt),
			Math.cos(tilt),
			Math.sin(angle) * Math.sin(tilt),
		);

		const length = item.height * (index === 0 ? 0.95 : rng.range(0.3, 0.75));

		parts.push(
			shard(
				tint,
				length * rng.range(0.08, 0.12),
				length,
				new THREE.Vector3(
					Math.cos(angle) * reach * item.width * 0.5,
					0.04,
					Math.sin(angle) * reach * item.depth * 0.5,
				),
				direction,
			),
		);
	}

	return parts;
};

export const floatingBooks: FurnitureBuilder = ({ item, rng }) => {
	const center = item.height * 0.72;
	const radius = Math.min(item.width, item.depth) / 2 - 0.2;
	const books: Part[] = [];
	const pages: Part[] = [];
	const count = rng.int(6, 9);

	for (let index = 0; index < count; index += 1) {
		const angle = (index / count) * Math.PI * 2;
		const x = Math.cos(angle) * radius;
		const z = Math.sin(angle) * radius;
		const y = center + rng.range(-0.25, 0.25);

		const cover: MaterialOptions = {
			texture: "tanLeather",
			color: rng.pick(LEATHER_COLORS),
			roughness: 0.7,
		};

		const tilt = rng.range(-0.6, 0.6);

		books.push(
			part(
				meterBox(0.2, 0.05, 0.28)
					.rotateZ(tilt)
					.rotateY(-angle)
					.translate(x, y, z),
				cover,
			),
			part(
				meterBox(0.18, 0.04, 0.27)
					.rotateZ(tilt)
					.rotateY(-angle)
					.translate(x + 0.012, y, z),
				{ texture: "pageEdges", roughness: 0.9 },
			),
		);
	}

	for (let index = 0; index < 5; index += 1) {
		const angle = rng.range(0, Math.PI * 2);

		pages.push(
			texturedPlane(
				{ texture: "paper", side: THREE.DoubleSide, roughness: 0.95 },
				0.16,
				0.22,
				Math.cos(angle) * radius * 0.55,
				center + rng.range(-0.4, 0.4),
				Math.sin(angle) * radius * 0.55,
				angle,
				rng.range(-0.8, 0.8),
			),
		);
	}

	return [
		...animated(books, {
			kind: "spin",
			pivot: [0, center, 0],
			axis: [0, 1, 0],
			speed: 0.35,
			amplitude: 0,
			phase: rng.range(0, Math.PI * 2),
		}),
		...animated(pages, {
			kind: "float",
			pivot: [0, center, 0],
			axis: [0, 1, 0],
			speed: -1.1,
			amplitude: 0.12,
			phase: rng.range(0, Math.PI * 2),
		}),
	];
};

function taperedStone(
	width: number,
	height: number,
	depth: number,
	rng: SeededRandom,
): THREE.BufferGeometry {
	const geometry = meterBox(width, height, depth);
	const position = geometry.getAttribute("position") as THREE.BufferAttribute;
	const lean = rng.range(-0.08, 0.08);

	for (let index = 0; index < position.count; index += 1) {
		const y = position.getY(index);
		const rise = (y + height / 2) / height;
		const taper = 1 - rise * 0.38;

		position.setXYZ(
			index,
			position.getX(index) * taper + lean * rise,
			y + height / 2,
			position.getZ(index) * taper,
		);
	}

	geometry.computeVertexNormals();

	return geometry;
}

function runeStroke(
	x: number,
	y: number,
	z: number,
	length: number,
	angle: number,
): Part {
	return part(
		meterBox(0.022, length, 0.006).rotateZ(angle).translate(x, y, z),
		RUNE_GLOW,
	);
}

export const runeStone: FurnitureBuilder = ({ item, rng }) => {
	const parts: Part[] = [
		part(taperedStone(item.width, item.height, item.depth, rng), BASALT),
		sphere(MOSS, 0.5, 0, 0, 0, item.width * 1.4, 0.12, item.depth * 1.6, 12),
	];

	const glyphs = rng.int(3, 5);

	for (let index = 0; index < glyphs; index += 1) {
		const y = item.height * (0.25 + (index / glyphs) * 0.55);
		const face = (item.depth / 2) * (1 - (y / item.height) * 0.38) + 0.004;
		const strokes = rng.int(2, 3);

		for (let stroke = 0; stroke < strokes; stroke += 1) {
			parts.push(
				runeStroke(
					rng.range(-0.05, 0.05),
					y + rng.range(-0.03, 0.03),
					face,
					rng.range(0.07, 0.13),
					rng.pick([0, Math.PI / 4, -Math.PI / 4, Math.PI / 2]),
				),
			);
		}
	}

	return parts;
};

function archCurve(
	width: number,
	height: number,
): THREE.CurvePath<THREE.Vector3> {
	const halfWidth = width / 2;
	const springing = height - halfWidth;
	const path = new THREE.CurvePath<THREE.Vector3>();

	path.add(
		new THREE.LineCurve3(
			new THREE.Vector3(-halfWidth, 0, 0),
			new THREE.Vector3(-halfWidth, springing, 0),
		),
	);

	path.add(
		new THREE.QuadraticBezierCurve3(
			new THREE.Vector3(-halfWidth, springing, 0),
			new THREE.Vector3(-halfWidth, height + halfWidth * 0.35, 0),
			new THREE.Vector3(0, height, 0),
		),
	);

	path.add(
		new THREE.QuadraticBezierCurve3(
			new THREE.Vector3(0, height, 0),
			new THREE.Vector3(halfWidth, height + halfWidth * 0.35, 0),
			new THREE.Vector3(halfWidth, springing, 0),
		),
	);

	path.add(
		new THREE.LineCurve3(
			new THREE.Vector3(halfWidth, springing, 0),
			new THREE.Vector3(halfWidth, 0, 0),
		),
	);

	return path;
}

function vineAround(
	path: THREE.CurvePath<THREE.Vector3>,
	turns: number,
	offset: number,
	phase: number,
): THREE.CatmullRomCurve3 {
	const points: THREE.Vector3[] = [];
	const samples = 60;

	for (let index = 0; index <= samples; index += 1) {
		const t = index / samples;
		const angle = phase + t * turns * Math.PI * 2;
		const point = path.getPointAt(t);

		points.push(
			new THREE.Vector3(
				point.x + Math.cos(angle) * offset,
				point.y + Math.sin(angle) * offset * 0.5,
				point.z + Math.sin(angle) * offset,
			),
		);
	}

	return new THREE.CatmullRomCurve3(points);
}

export const fairyPortal: FurnitureBuilder = ({ item, rng }) => {
	const archWidth = item.width - 0.25;
	const archHeight = item.height - 0.12;
	const frontZ = 0.05;
	const path = archCurve(archWidth, archHeight);

	const parts: Part[] = [
		box(
			DARK,
			archWidth,
			archHeight - archWidth * 0.2,
			0.02,
			0,
			0,
			-item.depth / 2 + 0.03,
		),
		part(new THREE.TubeGeometry(path, 40, 0.09, 7, false), BARK),
	];

	for (let index = 0; index < 2; index += 1) {
		parts.push(
			part(
				new THREE.TubeGeometry(
					vineAround(path, rng.range(5, 8), 0.1, index * Math.PI),
					80,
					0.025,
					4,
					false,
				),
				{ ...BARK, color: 0x6a8a4a },
			),
		);
	}

	const membrane = new THREE.CircleGeometry(0.5, 32);

	membrane.scale(archWidth - 0.15, archHeight - 0.1, 1);
	membrane.translate(0, (archHeight - 0.1) / 2, frontZ - 0.04);

	parts.push(
		part(membrane, {
			color: 0x8a5ad8,
			unlit: true,
			transparent: true,
			opacity: 0.55,
			depthWrite: false,
			side: THREE.DoubleSide,
		}),
	);

	const swirlCenter = archHeight * 0.48;

	parts.push(
		...animated(
			[
				texturedPlane(
					{
						texture: "occultCircle",
						color: 0xe0c0ff,
						transparent: true,
						alphaTest: 0.2,
						unlit: true,
						depthWrite: false,
						side: THREE.DoubleSide,
					},
					archWidth * 0.8,
					archWidth * 0.8,
					0,
					swirlCenter,
					frontZ - 0.02,
				),
			],
			{
				kind: "spin",
				pivot: [0, swirlCenter, frontZ - 0.02],
				axis: [0, 0, 1],
				speed: 0.6,
				amplitude: 0,
				phase: 0,
			},
		),
	);

	const cap = rng.pick(GLOWING_CAPS);

	for (const side of [-1, 1]) {
		for (let index = 0; index < 3; index += 1) {
			parts.push(
				...smallMushroom(
					rng,
					side * (archWidth / 2 + rng.range(-0.05, 0.12)),
					rng.range(0, item.depth / 2),
					rng.range(0.08, 0.2),
					cap,
				),
			);
		}
	}

	return parts;
};
