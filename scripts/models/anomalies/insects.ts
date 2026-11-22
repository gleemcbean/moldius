import * as THREE from "three";
import {
	PHALENE_BODY,
	PHALENE_STINGER,
} from "../../../src/features/models/anomalies/dimensions";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import type { BuildKit, Surface } from "../kit";
import { mergeStaticParts, SOCKET } from "./parts";

type Outline = [number, number][];

const SPAN = 1.22;

const FUR: MaterialOptions = {
	texture: "fur",
	color: 0x7a6650,
	roughness: 0.95,
};

const DARK_FUR: MaterialOptions = {
	texture: "fur",
	color: 0x2c241e,
	roughness: 0.95,
};

const GOLD_FUR: MaterialOptions = {
	texture: "fur",
	color: 0xd9a443,
	roughness: 0.9,
};

const SKULL: MaterialOptions = { color: 0xe8dcbc, roughness: 0.7 };
const CHITIN: MaterialOptions = { color: 0x3a2a20, roughness: 0.55 };
const NEEDLE: MaterialOptions = { color: 0xd8c8a0, roughness: 0.35 };

const FORE_WING: MaterialOptions = {
	color: 0x9a8268,
	roughness: 0.95,
	side: THREE.DoubleSide,
};

const FORE_MOTTLE: MaterialOptions = {
	color: 0x4a3a2e,
	roughness: 0.95,
	side: THREE.DoubleSide,
};

const FORE_FRINGE: MaterialOptions = {
	color: 0xe0cca8,
	roughness: 0.95,
	side: THREE.DoubleSide,
};

const HIND_WING: MaterialOptions = {
	color: 0xd69a32,
	roughness: 0.9,
	side: THREE.DoubleSide,
};

const HIND_BAND: MaterialOptions = {
	color: 0x231a14,
	roughness: 0.95,
	side: THREE.DoubleSide,
};

const PUPIL: MaterialOptions = { ...SOCKET, side: THREE.DoubleSide };

const GLINT: MaterialOptions = {
	color: 0xfff6e0,
	unlit: true,
	side: THREE.DoubleSide,
};

const FORE_OUTLINE: Outline = [
	[0, 0.1],
	[0.25, 0.16],
	[0.55, 0.18],
	[0.85, 0.13],
	[1.02, 0.03],
	[0.98, -0.07],
	[0.82, -0.17],
	[0.56, -0.23],
	[0.3, -0.21],
	[0.1, -0.12],
	[0, -0.04],
];

const FORE_MOTTLE_OUTLINE: Outline = [
	[0.12, 0.06],
	[0.32, 0.1],
	[0.48, 0.06],
	[0.6, 0.11],
	[0.74, 0.06],
	[0.84, 0.0],
	[0.74, -0.08],
	[0.62, -0.06],
	[0.5, -0.14],
	[0.36, -0.1],
	[0.22, -0.15],
	[0.12, -0.08],
];

const FORE_FRINGE_OUTLINE: Outline = [
	[0.82, 0.11],
	[0.96, 0.03],
	[0.93, -0.06],
	[0.8, -0.14],
	[0.86, -0.05],
	[0.88, 0.03],
];

const HIND_OUTLINE: Outline = [
	[0, 0.02],
	[0.2, 0.04],
	[0.45, 0.0],
	[0.62, -0.1],
	[0.66, -0.25],
	[0.57, -0.38],
	[0.39, -0.45],
	[0.2, -0.41],
	[0.06, -0.28],
	[0, -0.12],
];

const HIND_BAND_OUTLINE: Outline = [
	[0.5, -0.06],
	[0.62, -0.12],
	[0.66, -0.25],
	[0.57, -0.38],
	[0.39, -0.45],
	[0.2, -0.41],
	[0.22, -0.36],
	[0.38, -0.39],
	[0.52, -0.33],
	[0.58, -0.22],
	[0.56, -0.12],
];

const ABDOMEN: [number, number, number, number][] = [
	[0.15, -0.04, 0, 0],
	[0.14, -0.17, -0.015, 1],
	[0.125, -0.29, -0.03, 0],
	[0.1, -0.39, -0.045, 1],
	[0.075, -0.47, -0.06, 0],
];

const LEGS: [number, number, number][] = [
	[1, 0.09, 0.35],
	[-1, 0.09, 0.35],
	[1, 0, 0],
	[-1, 0, 0],
	[1, -0.08, -0.35],
	[-1, -0.08, -0.35],
];

function mirror(geometry: THREE.BufferGeometry): void {
	geometry.scale(-1, 1, 1);

	const index = geometry.getIndex();

	if (!index) {
		return;
	}

	for (let corner = 0; corner < index.count; corner += 3) {
		const second = index.getX(corner + 1);

		index.setX(corner + 1, index.getX(corner + 2));
		index.setX(corner + 2, second);
	}

	index.needsUpdate = true;
}

function flat(geometry: THREE.BufferGeometry, side: number, lift: number) {
	geometry.rotateX(-Math.PI / 2);

	if (side < 0) {
		mirror(geometry);
	}

	geometry.translate(0, lift, 0);

	return geometry;
}

function sheet(
	kit: BuildKit,
	outline: Outline,
	material: Surface,
	side: number,
	lift: number,
): THREE.Mesh {
	const shape = new THREE.Shape(
		outline.map(([x, z]) => new THREE.Vector2(x * SPAN, -z * SPAN)),
	);

	return kit.mesh(
		flat(new THREE.ShapeGeometry(shape, 6), side, lift),
		material,
	);
}

function disc(
	kit: BuildKit,
	radius: number,
	inner: number,
	material: Surface,
	center: [number, number],
	side: number,
	lift: number,
): THREE.Mesh {
	const geometry =
		inner > 0
			? new THREE.RingGeometry(inner * SPAN, radius * SPAN, 28)
			: new THREE.CircleGeometry(radius * SPAN, 28);

	flat(geometry, side, lift);

	geometry.translate(center[0] * side * SPAN, 0, center[1] * SPAN);

	return kit.mesh(geometry, material);
}

function faces(
	build: (lift: number) => THREE.Mesh[],
	depth: number,
): THREE.Mesh[] {
	return [...build(depth), ...build(-depth)];
}

function eyespot(
	kit: BuildKit,
	center: [number, number],
	radius: number,
	ocelli: THREE.Material,
	side: number,
	depth: number,
): THREE.Mesh[] {
	return faces(
		(lift) => [
			disc(kit, radius, radius * 0.74, HIND_BAND, center, side, lift),
			disc(kit, radius * 0.74, radius * 0.42, ocelli, center, side, lift * 1.5),
			disc(kit, radius * 0.42, 0, PUPIL, center, side, lift * 1.5),
			disc(
				kit,
				radius * 0.12,
				0,
				GLINT,
				[center[0] - radius * 0.14, center[1] + radius * 0.16],
				side,
				lift * 2,
			),
		],
		depth,
	);
}

function foreWing(
	kit: BuildKit,
	side: number,
	ocelli: THREE.Material,
): THREE.Mesh[] {
	return [
		sheet(kit, FORE_OUTLINE, FORE_WING, side, 0),
		...faces(
			(lift) => [
				sheet(kit, FORE_MOTTLE_OUTLINE, FORE_MOTTLE, side, lift),
				sheet(kit, FORE_FRINGE_OUTLINE, FORE_FRINGE, side, lift),
			],
			0.003,
		),
		...eyespot(kit, [0.66, -0.03], 0.085, ocelli, side, 0.004),
	];
}

function hindWing(
	kit: BuildKit,
	side: number,
	ocelli: THREE.Material,
): THREE.Mesh[] {
	return [
		sheet(kit, HIND_OUTLINE, HIND_WING, side, 0),
		...faces(
			(lift) => [sheet(kit, HIND_BAND_OUTLINE, HIND_BAND, side, lift)],
			0.003,
		),
		...eyespot(kit, [0.36, -0.2], 0.13, ocelli, side, 0.004),
	];
}

function antenna(kit: BuildKit, side: number): THREE.Group {
	const pivot = kit.pivot(
		`antenna_${side > 0 ? 0 : 1}`,
		side * 0.04,
		0.08,
		0.05,
	);

	const points: [number, number, number][] = [
		[0, 0, 0],
		[side * 0.05, 0.12, 0.07],
		[side * 0.13, 0.25, 0.07],
		[side * 0.22, 0.32, -0.01],
	];

	pivot.add(kit.tube(points, (t) => 0.012 - t * 0.007, CHITIN, 16, 5));

	const curve = new THREE.CatmullRomCurve3(
		points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
	);

	for (let index = 1; index <= 9; index += 1) {
		const t = 0.12 + (index / 9) * 0.82;
		const at = curve.getPointAt(t);
		const tangent = curve.getTangentAt(t);
		const length = 0.075 * (1 - t * 0.55);

		for (const flank of [-1, 1]) {
			const across = new THREE.Vector3(0, 0, flank)
				.addScaledVector(tangent, -0.35)
				.normalize();

			const barb = kit.cone(0.006, length, CHITIN, 4);

			barb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), across);
			barb.position.copy(at).addScaledVector(across, length / 2);

			pivot.add(barb);
		}
	}

	return pivot;
}

function proboscis(kit: BuildKit): THREE.Group {
	const pivot = kit.pivot("proboscis", 0, -0.075, 0.09);
	const coil: [number, number, number][] = [];

	for (let step = 0; step <= 30; step += 1) {
		const t = step / 30;
		const angle = t * Math.PI * 3.2;
		const radius = 0.055 * (1 - t * 0.75);

		coil.push([0, -radius * Math.sin(angle), radius * (1 - Math.cos(angle))]);
	}

	pivot.add(
		kit.named(
			"coil",
			kit.tube(coil, (t) => 0.011 - t * 0.005, CHITIN, 40, 5),
		),
	);

	const needle = new THREE.ConeGeometry(0.014, PHALENE_STINGER, 6)
		.translate(0, PHALENE_STINGER / 2, 0)
		.rotateX(Math.PI / 2);

	const stinger = kit.named("stinger", kit.mesh(needle, NEEDLE));

	stinger.scale.set(1, 1, 0.05);

	stinger.visible = false;

	pivot.add(stinger);

	return pivot;
}

function head(kit: BuildKit, facets: THREE.Material): THREE.Group {
	const pivot = kit.pivot("head", 0, 0.02, 0.24);

	pivot.add(kit.sphere(0.12, FUR, [1, 0.95, 0.9], 14));

	for (const side of [-1, 1]) {
		const eye = kit.sphere(0.058, facets, [1, 1.1, 1], 14);

		eye.position.set(side * 0.078, 0.025, 0.055);

		pivot.add(eye, antenna(kit, side));
	}

	const ruff = kit.sphere(0.13, GOLD_FUR, [1.15, 0.75, 0.55], 12);

	ruff.position.set(0, -0.03, -0.07);

	pivot.add(ruff, proboscis(kit));
	pivot.add(kit.anchor("gaze", 0, 0.03, 0.14));

	return pivot;
}

function thorax(kit: BuildKit, body: THREE.Object3D): void {
	body.add(kit.sphere(0.17, FUR, [1, 0.9, 1.15], 16));

	const mark = kit.sphere(0.105, SKULL, [0.8, 0.3, 0.9], 12);

	mark.position.set(0, 0.13, -0.01);

	body.add(mark);

	for (const side of [-1, 1]) {
		const socket = kit.sphere(0.028, SOCKET, [1, 0.5, 1.1], 8);

		socket.position.set(side * 0.036, 0.155, 0.028);

		body.add(socket);
	}

	const jaw = kit.sphere(0.03, SOCKET, [1.3, 0.4, 0.7], 8);

	jaw.position.set(0, 0.153, -0.048);

	body.add(jaw);
}

function abdomen(kit: BuildKit): THREE.Group {
	const pivot = kit.pivot("abdomen", 0, -0.02, -0.17);

	for (const [radius, z, y, band] of ABDOMEN) {
		const segment = kit.sphere(
			radius,
			band ? DARK_FUR : GOLD_FUR,
			[1, 0.88, 0.85],
			14,
		);

		segment.position.set(0, y, z);

		pivot.add(segment);
	}

	const tip = kit.cone(0.05, 0.12, DARK_FUR, 8);

	tip.rotation.x = -Math.PI / 2;

	tip.position.set(0, -0.07, -0.56);

	pivot.add(tip);

	return pivot;
}

function legs(kit: BuildKit, body: THREE.Object3D): void {
	LEGS.forEach(([side, z, splay], index) => {
		const pivot = kit.pivot(`leg_${index}`, side * 0.07, -0.11, z);

		pivot.add(
			kit.tube(
				[
					[0, 0, 0],
					[side * 0.08, -0.05, splay * 0.08],
					[side * 0.1, -0.13, splay * 0.1 - 0.04],
					[side * 0.07, -0.2, splay * 0.08 - 0.09],
				],
				(t) => 0.011 - t * 0.006,
				DARK_FUR,
				12,
				5,
			),
		);

		body.add(pivot);
	});
}

export function buildPhalene(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();

	root.name = "phalene";

	const ocelli = kit.owned("ocelli", {
		color: 0x7fe6ff,
		unlit: true,
		side: THREE.DoubleSide,
	});

	const facets = kit.owned("facets", {
		color: 0x140a1c,
		roughness: 0.12,
		metalness: 0.45,
		emissive: 0x6a3aff,
		emissiveIntensity: 0.3,
	});

	const body = kit.pivot("body", 0, PHALENE_BODY, 0);

	root.add(body);
	thorax(kit, body);
	body.add(head(kit, facets), abdomen(kit));
	legs(kit, body);

	([1, -1] as const).forEach((side, index) => {
		const fore = kit.pivot(`wing_${index}`, side * 0.12, 0.06, 0.05);
		const hind = kit.pivot(`wing_${index + 2}`, side * 0.11, 0.02, -0.05);

		fore.add(...foreWing(kit, side, ocelli));
		fore.add(kit.anchor(`dust_${index}`, side * 0.55, -0.02, -0.05));
		hind.add(...hindWing(kit, side, ocelli));
		body.add(fore, hind);
	});

	mergeStaticParts(root);

	return root;
}
