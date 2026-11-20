import * as THREE from "three";
import {
	CINEMA_BODY_HEIGHT,
	CINEMA_HIP_RADIUS,
	CINEMA_LEG_ANGLES,
} from "../../../src/features/models/anomalies/dimensions";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import type { BuildKit, Surface } from "../kit";
import { mergeStaticParts } from "./parts";

type Point = [number, number, number];

const MAHOGANY: MaterialOptions = {
	texture: "woodRed",
	color: 0x8a4630,
	roughness: 0.45,
};

const BRASS: MaterialOptions = {
	texture: "brass",
	color: 0xc09a50,
	roughness: 0.32,
	metalness: 0.8,
};

const DARK_IRON: MaterialOptions = {
	color: 0x1e1a17,
	roughness: 0.5,
	metalness: 0.65,
};

const FILM: MaterialOptions = {
	color: 0x16110d,
	roughness: 0.22,
	metalness: 0.1,
};

const STEEL: MaterialOptions = {
	texture: "iron",
	color: 0xd0cac0,
	roughness: 0.35,
	metalness: 0.45,
};

const LEATHER: MaterialOptions = {
	texture: "leather",
	color: 0x3a2418,
	roughness: 0.7,
};

const BOX_WIDTH = 0.5;
const BOX_HEIGHT = 0.46;
const BOX_DEPTH = 0.64;
const BOX_BOTTOM = -0.18;

function at<T extends THREE.Object3D>(object: T, [x, y, z]: Point): T {
	object.position.set(x, y, z);

	return object;
}

function rod(
	kit: BuildKit,
	points: Point[],
	from: number,
	to: number,
	material: Surface,
	radial = 8,
): THREE.Mesh {
	return kit.tube(
		points,
		(t) => from + (to - from) * t,
		material,
		Math.max(4, points.length * 4),
		radial,
	);
}

function alongZ(mesh: THREE.Mesh): THREE.Mesh {
	mesh.rotation.x = Math.PI / 2;

	return mesh;
}

function alongX(mesh: THREE.Mesh): THREE.Mesh {
	mesh.rotation.z = Math.PI / 2;

	return mesh;
}

function cabinet(
	kit: BuildKit,
	body: THREE.Object3D,
	lamp: THREE.Material,
): void {
	const center = BOX_BOTTOM + BOX_HEIGHT / 2;
	const halfW = BOX_WIDTH / 2;
	const halfD = BOX_DEPTH / 2;

	body.add(
		at(kit.box(BOX_WIDTH, BOX_HEIGHT, BOX_DEPTH, MAHOGANY), [0, center, 0]),
	);

	for (const x of [-halfW, halfW]) {
		for (const z of [-halfD, halfD]) {
			body.add(
				at(kit.box(0.035, BOX_HEIGHT + 0.01, 0.035, BRASS), [x, center, z]),
			);
		}
	}

	for (const y of [BOX_BOTTOM, BOX_BOTTOM + BOX_HEIGHT]) {
		for (const z of [-halfD, halfD]) {
			body.add(at(kit.box(BOX_WIDTH + 0.03, 0.03, 0.035, BRASS), [0, y, z]));
		}

		for (const x of [-halfW, halfW]) {
			body.add(at(kit.box(0.035, 0.03, BOX_DEPTH + 0.03, BRASS), [x, y, 0]));
		}
	}

	for (const side of [-1, 1]) {
		const panel = kit.box(0.012, BOX_HEIGHT * 0.62, BOX_DEPTH * 0.7, LEATHER);

		body.add(at(panel, [side * (halfW + 0.006), center, -0.02]));

		for (let index = 0; index < 5; index += 1) {
			body.add(
				at(kit.sphere(0.011, BRASS, [1, 1, 1], 6), [
					side * (halfW + 0.012),
					center + BOX_HEIGHT * 0.33,
					-0.24 + index * 0.11,
				]),
			);
		}

		const window = alongX(kit.cylinder(0.05, 0.05, 0.02, lamp, 14));

		body.add(at(window, [side * (halfW + 0.012), center - 0.05, -0.17]));

		const rim = kit.mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 16), BRASS);

		rim.rotation.y = Math.PI / 2;

		body.add(at(rim, [side * (halfW + 0.02), center - 0.05, -0.17]));
	}
}

function lensAssembly(
	kit: BuildKit,
	body: THREE.Object3D,
	lens: THREE.Material,
	eye: THREE.Material,
): void {
	const center = BOX_BOTTOM + BOX_HEIGHT / 2;
	const front = BOX_DEPTH / 2;

	body.add(
		at(alongZ(kit.cylinder(0.17, 0.17, 0.03, BRASS, 20)), [
			0,
			center,
			front + 0.015,
		]),
	);

	const bellows = kit.pleatedLathe(
		[
			[0.15, 0],
			[0.14, 0.05],
			[0.13, 0.1],
			[0.12, 0.15],
			[0.11, 0.2],
		],
		LEATHER,
		14,
		(radius) => 0.09 * (radius / 0.15),
		28,
	);

	bellows.rotation.x = Math.PI / 2;

	body.add(at(bellows, [0, center, front + 0.02]));

	const snout = kit.pivot("snout", 0, center, front + 0.2);

	body.add(snout);
	snout.add(at(alongZ(kit.cylinder(0.09, 0.1, 0.3, BRASS, 18)), [0, 0, 0.15]));

	for (const z of [0.05, 0.14, 0.23]) {
		const ring = kit.mesh(
			new THREE.TorusGeometry(0.1, 0.013, 6, 20),
			DARK_IRON,
		);

		snout.add(at(ring, [0, 0, z]));
	}

	const hood = kit.lathe(
		[
			[0.09, 0],
			[0.11, 0.05],
			[0.15, 0.1],
			[0.16, 0.11],
		],
		{ ...BRASS, side: THREE.DoubleSide },
		20,
	);

	hood.rotation.x = Math.PI / 2;

	snout.add(at(hood, [0, 0, 0.28]));

	const glass = kit.sphere(0.085, lens, [1, 1, 0.35], 18);

	snout.add(at(glass, [0, 0, 0.31]));
	snout.add(kit.anchor("lens", 0, 0, 0.4));

	for (const side of [-1, 1]) {
		const sight = kit.pivot(
			`sight_${side > 0 ? 0 : 1}`,
			side * 0.13,
			center + 0.17,
			front,
		);

		sight.add(
			at(alongZ(kit.cylinder(0.03, 0.035, 0.12, BRASS, 12)), [0, 0, 0.06]),
		);

		sight.add(at(kit.sphere(0.026, eye, [1, 1, 0.5], 10), [0, 0, 0.125]));

		body.add(sight);
	}
}

function reel(kit: BuildKit, name: string, position: Point): THREE.Group {
	const pivot = kit.pivot(name, ...position);
	const radius = 0.23;

	pivot.add(alongX(kit.cylinder(0.04, 0.04, 0.08, BRASS, 12)));

	for (const side of [-1, 1]) {
		const rim = kit.mesh(new THREE.TorusGeometry(radius, 0.016, 6, 28), BRASS);

		rim.rotation.y = Math.PI / 2;

		pivot.add(at(rim, [side * 0.03, 0, 0]));

		for (let spoke = 0; spoke < 5; spoke += 1) {
			const angle = (spoke / 5) * Math.PI * 2;
			const bar = kit.box(0.012, radius * 0.92, 0.026, STEEL);

			bar.position.set(
				side * 0.03,
				Math.sin(angle) * radius * 0.46,
				Math.cos(angle) * radius * 0.46,
			);

			bar.rotation.x = -angle + Math.PI / 2;

			pivot.add(bar);
		}
	}

	pivot.add(alongX(kit.cylinder(0.15, 0.15, 0.05, FILM, 22)));

	return pivot;
}

function reels(kit: BuildKit, body: THREE.Object3D): void {
	const top = BOX_BOTTOM + BOX_HEIGHT;
	const front: Point = [0, top + 0.27, 0.18];
	const rear: Point = [0, top + 0.3, -0.22];

	for (const [x, y, z] of [front, rear]) {
		body.add(
			rod(
				kit,
				[
					[0.05, top, z * 0.7],
					[0.05, y, z],
				],
				0.014,
				0.012,
				BRASS,
			),
		);

		body.add(
			rod(
				kit,
				[
					[-0.05, top, z * 0.7],
					[-0.05, y, z],
				],
				0.014,
				0.012,
				BRASS,
			),
		);

		body.add(at(alongX(kit.cylinder(0.012, 0.012, 0.11, BRASS, 6)), [x, y, z]));
	}

	body.add(reel(kit, "reel_0", front));
	body.add(reel(kit, "reel_1", rear));

	body.add(
		rod(
			kit,
			[
				[0, front[1] - 0.13, front[2] + 0.06],
				[0, top + 0.08, 0.27],
				[0, top - 0.02, 0.3],
			],
			0.009,
			0.009,
			FILM,
			5,
		),
	);

	body.add(
		rod(
			kit,
			[
				[0, top - 0.02, -0.3],
				[0, top + 0.1, -0.31],
				[0, rear[1] - 0.12, rear[2] - 0.08],
			],
			0.009,
			0.009,
			FILM,
			5,
		),
	);
}

function lampHouse(
	kit: BuildKit,
	body: THREE.Object3D,
	lamp: THREE.Material,
): void {
	const back = -BOX_DEPTH / 2;
	const center = BOX_BOTTOM + BOX_HEIGHT / 2;

	body.add(
		at(kit.cylinder(0.11, 0.11, 0.34, BRASS, 18), [
			0,
			center + 0.04,
			back - 0.08,
		]),
	);

	body.add(
		at(kit.cone(0.13, 0.12, DARK_IRON, 16), [0, center + 0.27, back - 0.08]),
	);

	body.add(
		at(kit.cylinder(0.035, 0.035, 0.14, DARK_IRON, 10), [
			0,
			center + 0.38,
			back - 0.08,
		]),
	);

	body.add(kit.anchor("chimney", 0, center + 0.46, back - 0.08));

	for (let slit = 0; slit < 6; slit += 1) {
		const angle = Math.PI * (0.2 + (slit / 5) * 0.6) + Math.PI;
		const vent = kit.box(0.02, 0.16, 0.012, lamp);

		vent.position.set(
			Math.cos(angle) * 0.112,
			center + 0.04,
			back - 0.08 + Math.sin(angle) * 0.112,
		);

		vent.rotation.y = -angle + Math.PI / 2;

		body.add(vent);
	}
}

function crank(kit: BuildKit, body: THREE.Object3D): void {
	const pivot = kit.pivot(
		"crank",
		BOX_WIDTH / 2 + 0.04,
		BOX_BOTTOM + BOX_HEIGHT * 0.45,
		0.08,
	);

	pivot.add(alongX(kit.cylinder(0.03, 0.03, 0.05, BRASS, 10)));
	pivot.add(at(kit.box(0.025, 0.19, 0.025, BRASS), [0.03, 0.085, 0]));

	const handle = alongX(kit.cylinder(0.018, 0.018, 0.1, MAHOGANY, 8));

	pivot.add(at(handle, [0.08, 0.17, 0]));
	body.add(pivot);
}

function marquee(
	kit: BuildKit,
	body: THREE.Object3D,
	bulbs: THREE.Material,
): void {
	const top = BOX_BOTTOM + BOX_HEIGHT;
	const front = BOX_DEPTH / 2;

	body.add(
		at(kit.box(BOX_WIDTH * 0.8, 0.07, 0.02, BRASS), [
			0,
			top + 0.04,
			front + 0.01,
		]),
	);

	for (let index = 0; index < 6; index += 1) {
		body.add(
			at(kit.sphere(0.017, bulbs, [1, 1, 1], 8), [
				-0.17 + index * 0.068,
				top + 0.04,
				front + 0.025,
			]),
		);
	}
}

function filmTail(kit: BuildKit, body: THREE.Object3D): void {
	const bottom = BOX_BOTTOM;

	body.add(
		rod(
			kit,
			[
				[0.06, bottom, 0.22],
				[0.09, bottom - 0.25, 0.3],
				[0.03, bottom - 0.5, 0.22],
				[0.08, bottom - 0.68, 0.32],
			],
			0.014,
			0.01,
			FILM,
			5,
		),
	);
}

function leg(kit: BuildKit, index: number, angle: number): THREE.Group {
	const mount = kit.pivot(
		`legMount_${index}`,
		Math.cos(angle) * CINEMA_HIP_RADIUS,
		BOX_BOTTOM,
		Math.sin(angle) * CINEMA_HIP_RADIUS,
	);

	const hip = kit.pivot(`leg_${index}`);
	const ground = -(CINEMA_BODY_HEIGHT + BOX_BOTTOM);
	const kneeAt: Point = [0.36, -0.22, 0];

	mount.rotation.y = -angle;

	mount.add(hip);

	hip.add(kit.sphere(0.05, BRASS, [1, 1, 1], 10));

	hip.add(
		rod(kit, [[0, 0, 0], [0.16, -0.02, 0], kneeAt], 0.046, 0.036, MAHOGANY, 10),
	);

	for (const t of [0.3, 0.7]) {
		const ring = kit.mesh(
			new THREE.TorusGeometry(0.044, 0.01, 5, 14).rotateY(Math.PI / 2),
			BRASS,
		);

		ring.position.set(kneeAt[0] * t, kneeAt[1] * t * t, 0);

		ring.rotation.z = -0.5;

		hip.add(ring);
	}

	const knee = at(kit.pivot(`shin_${index}`), kneeAt);

	hip.add(knee);
	knee.add(kit.sphere(0.046, BRASS, [1, 1, 1], 10));
	knee.add(at(kit.box(0.08, 0.02, 0.012, BRASS), [0, 0.05, 0]));

	const ankle: Point = [0.2, ground - kneeAt[1] + 0.08, 0];

	knee.add(
		rod(
			kit,
			[
				[0, 0, 0],
				[0.12, ground * 0.45, 0],
			],
			0.03,
			0.027,
			BRASS,
			10,
		),
	);

	knee.add(rod(kit, [[0.12, ground * 0.45, 0], ankle], 0.022, 0.018, BRASS, 8));

	knee.add(
		at(
			kit.mesh(
				new THREE.TorusGeometry(0.03, 0.008, 5, 12).rotateX(Math.PI / 2),
				DARK_IRON,
			),
			[0.12, ground * 0.45, 0],
		),
	);

	const spike = kit.cone(0.024, 0.1, DARK_IRON, 6);

	spike.rotation.x = Math.PI;

	knee.add(at(spike, [ankle[0], ankle[1] - 0.05, 0]));

	for (const toe of [-0.6, 0, 0.6]) {
		const claw = rod(
			kit,
			[
				[ankle[0], ankle[1] + 0.01, 0],
				[
					ankle[0] + Math.cos(toe) * 0.07,
					ankle[1] - 0.04,
					Math.sin(toe) * 0.07,
				],
				[ankle[0] + Math.cos(toe) * 0.1, ankle[1] - 0.075, Math.sin(toe) * 0.1],
			],
			0.009,
			0.004,
			BRASS,
			5,
		);

		knee.add(claw);
	}

	return mount;
}

export function buildCinematographe(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();

	root.name = "cinematographe";

	const lens = kit.owned("lens", { color: 0xfff0c8, unlit: true });
	const eye = kit.owned("eye", { color: 0x8a2a18, unlit: true });
	const lamp = kit.owned("lamp", { color: 0xffa050, unlit: true });
	const bulbs = kit.owned("bulbs", { color: 0xffd890, unlit: true });
	const body = kit.pivot("body", 0, CINEMA_BODY_HEIGHT, 0);

	root.add(body);

	cabinet(kit, body, lamp);
	lensAssembly(kit, body, lens, eye);
	reels(kit, body);
	lampHouse(kit, body, lamp);
	crank(kit, body);
	marquee(kit, body, bulbs);
	filmTail(kit, body);

	CINEMA_LEG_ANGLES.forEach((angle, index) => {
		body.add(leg(kit, index, angle));
	});

	mergeStaticParts(root);

	return root;
}
