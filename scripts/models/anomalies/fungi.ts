import * as THREE from "three";
import {
	ANT_GASTER_Z,
	ANT_HIP_HEIGHT,
	ANT_LEGS,
	type AntLeg,
} from "../../../src/features/models/anomalies/dimensions";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import type { BuildKit, Surface } from "../kit";
import { mergeStaticParts } from "./parts";

type Point = [number, number, number];

const CHITIN: MaterialOptions = {
	texture: "leather",
	color: 0x54321e,
	roughness: 0.18,
	metalness: 0.3,
};

const CHITIN_JOINT: MaterialOptions = {
	texture: "leather",
	color: 0x6a4428,
	roughness: 0.32,
	metalness: 0.15,
};

const MANDIBLE: MaterialOptions = {
	color: 0x140c08,
	roughness: 0.25,
	metalness: 0.15,
};

const MYCELIUM: MaterialOptions = {
	texture: "mushroomStem",
	color: 0xf0e8d8,
	roughness: 0.95,
};

const STALK: MaterialOptions = {
	texture: "mushroomStem",
	color: 0xd8823a,
	roughness: 0.55,
};

const BLIND_EYE: MaterialOptions = {
	color: 0xcfc8b8,
	roughness: 0.18,
	metalness: 0.05,
};

function segment(
	kit: BuildKit,
	points: Point[],
	from: number,
	to: number,
	material: Surface,
	bulge = 0,
	radial = 8,
): THREE.Mesh {
	return kit.tube(
		points,
		(t) => from + (to - from) * t + Math.sin(Math.PI * t) * bulge,
		material,
		Math.max(4, points.length * 4),
		radial,
	);
}

function at<T extends THREE.Object3D>(object: T, [x, y, z]: Point): T {
	object.position.set(x, y, z);

	return object;
}

function fuzz(
	kit: BuildKit,
	parent: THREE.Object3D,
	spots: readonly [number, number, number, number][],
): void {
	for (const [x, y, z, radius] of spots) {
		parent.add(
			at(kit.sphere(radius, MYCELIUM, [1.3, 0.35, 1.1], 8), [x, y, z]),
		);

		for (const [dx, dz] of [
			[0.8, 0.3],
			[-0.6, 0.7],
			[0.2, -0.9],
		] as const) {
			parent.add(
				at(kit.sphere(radius * 0.45, MYCELIUM, [1.2, 0.4, 1], 6), [
					x + dx * radius * 1.3,
					y - radius * 0.1,
					z + dz * radius * 1.3,
				]),
			);
		}
	}
}

function hyphae(
	kit: BuildKit,
	parent: THREE.Object3D,
	threads: readonly Point[][],
): void {
	for (const points of threads) {
		parent.add(segment(kit, points, 0.005, 0.003, MYCELIUM, 0, 4));
	}
}

function fruitingNubs(
	kit: BuildKit,
	parent: THREE.Object3D,
	tips: THREE.Material,
	nubs: readonly [Point, Point][],
): void {
	for (const [base, top] of nubs) {
		parent.add(segment(kit, [base, top], 0.018, 0.009, STALK, 0, 6));
		parent.add(at(kit.sphere(0.022, tips, [1, 1.5, 1], 8), top));
	}
}

function buildLeg(kit: BuildKit, leg: AntLeg, index: number): THREE.Group {
	const mount = kit.pivot(`hipMount_${index}`, leg.side * 0.1, -0.04, leg.z);
	const hip = kit.pivot(`hip_${index}`);
	const kneeAt: Point = [0.3, 0.18, 0];
	const ground = -(ANT_HIP_HEIGHT - 0.04);
	const out = leg.reach - kneeAt[0];

	mount.rotation.y = leg.side > 0 ? -leg.splay : Math.PI + leg.splay;

	mount.add(hip);

	hip.add(at(kit.sphere(0.045, CHITIN_JOINT, [1, 1, 1], 10), [0.02, 0, 0]));

	hip.add(
		segment(
			kit,
			[
				[0.02, 0, 0],
				[0.1, -0.03, 0],
			],
			0.04,
			0.034,
			CHITIN,
		),
	);

	hip.add(
		segment(
			kit,
			[[0.08, -0.02, 0], [0.2, 0.12, 0], kneeAt],
			0.044,
			0.032,
			CHITIN,
			0.014,
		),
	);

	const knee = at(kit.pivot(`knee_${index}`), kneeAt);

	hip.add(knee);
	knee.add(kit.sphere(0.034, CHITIN_JOINT, [1, 1, 1], 10));

	const ankle: Point = [out - 0.07, ground - kneeAt[1] + 0.07, 0];
	const toe: Point = [out + 0.05, ground - kneeAt[1] + 0.005, 0];

	knee.add(
		segment(
			kit,
			[[0, 0, 0], [out * 0.45, -0.25, 0], ankle],
			0.031,
			0.017,
			CHITIN,
			0.007,
		),
	);

	for (const t of [0.35, 0.55, 0.75]) {
		const spine = kit.cone(0.008, 0.06, MANDIBLE, 5);

		spine.position.set(ankle[0] * t, ankle[1] * t + 0.01, 0);

		spine.rotation.z = -0.9;

		knee.add(spine);
	}

	knee.add(at(kit.sphere(0.018, CHITIN_JOINT, [1, 1, 1], 8), ankle));
	knee.add(segment(kit, [ankle, toe], 0.013, 0.006, CHITIN, 0, 6));

	if (leg.pair !== 1) {
		knee.add(
			at(kit.sphere(0.03, MYCELIUM, [1.3, 0.6, 1.3], 6), [0.02, 0.01, 0]),
		);

		hip.add(
			segment(
				kit,
				[
					[0.06, 0, 0],
					[0.2, 0.16, 0.02],
					[0.32, 0.2, 0],
				],
				0.005,
				0.003,
				MYCELIUM,
				0,
				4,
			),
		);
	}

	return mount;
}

function buildHead(kit: BuildKit, tips: THREE.Material): THREE.Group {
	const head = kit.pivot("head", 0, 0.02, 0.1);
	const skull = kit.sphere(0.17, CHITIN, [1.2, 0.92, 1.1], 18);

	skull.position.z = 0.1;

	head.add(skull);

	for (const side of [-1, 1]) {
		head.add(
			at(kit.sphere(0.11, CHITIN, [1, 0.9, 1], 12), [side * 0.08, 0.06, 0.02]),
		);

		const eye = kit.sphere(0.055, BLIND_EYE, [0.55, 1, 1.15], 12);

		head.add(at(eye, [side * 0.175, 0.03, 0.13]));

		head.add(
			at(kit.sphere(0.03, MYCELIUM, [0.6, 1, 1], 8), [side * 0.19, 0.06, 0.1]),
		);

		const mandible = kit.pivot(
			`mandible_${side > 0 ? 0 : 1}`,
			side * 0.07,
			-0.06,
			0.25,
		);

		mandible.add(
			segment(
				kit,
				[
					[0, 0, 0],
					[side * 0.04, -0.01, 0.1],
					[-side * 0.03, -0.02, 0.2],
				],
				0.03,
				0.006,
				MANDIBLE,
			),
		);

		for (const t of [0.35, 0.6, 0.82]) {
			const tooth = kit.cone(0.012, 0.035, MANDIBLE, 5);

			tooth.position.set(side * 0.02 * (1 - t), -0.01, 0.2 * t);

			tooth.rotation.z = side * Math.PI * 0.5;

			mandible.add(tooth);
		}

		head.add(mandible);

		const antenna = kit.pivot(
			`antenna_${side > 0 ? 0 : 1}`,
			side * 0.06,
			0.09,
			0.2,
		);

		const scapeEnd: Point = [side * 0.1, 0.19, 0.17];

		antenna.add(
			segment(
				kit,
				[[0, 0, 0], [side * 0.05, 0.12, 0.08], scapeEnd],
				0.016,
				0.011,
				CHITIN,
			),
		);

		const flagellum = at(kit.pivot(`flagellum_${side > 0 ? 0 : 1}`), scapeEnd);

		flagellum.add(kit.sphere(0.016, CHITIN_JOINT, [1, 1, 1], 8));

		const tip: Point = [side * 0.08, -0.05, 0.34];

		flagellum.add(
			segment(
				kit,
				[[0, 0, 0], [side * 0.05, 0.03, 0.18], tip],
				0.011,
				0.009,
				CHITIN,
			),
		);

		for (const t of [0.25, 0.45, 0.65, 0.85]) {
			flagellum.add(
				at(kit.sphere(0.012, CHITIN_JOINT, [1, 1, 1], 6), [
					side * 0.08 * t,
					0.03 * Math.sin(Math.PI * t) - 0.05 * t,
					0.34 * t,
				]),
			);
		}

		flagellum.add(at(kit.sphere(0.02, CHITIN, [1, 1, 1.5], 8), tip));
		antenna.add(flagellum);
		head.add(antenna);
	}

	const stalk = kit.pivot("stalk", 0, 0.13, -0.02);
	const club: Point = [0.04, 1.02, 0.12];

	stalk.add(
		segment(
			kit,
			[[0, 0, 0], [0.03, 0.3, -0.1], [-0.04, 0.68, -0.04], club],
			0.04,
			0.018,
			STALK,
			0.004,
			10,
		),
	);

	stalk.add(at(kit.sphere(0.07, MYCELIUM, [1.3, 0.6, 1.3], 10), [0, 0.01, 0]));

	const clubPivot = at(kit.pivot("club"), club);

	clubPivot.rotation.x = 0.35;

	clubPivot.add(at(kit.capsule(0.05, 0.16, tips, 12), [0, 0.11, 0]));

	for (let index = 0; index < 18; index += 1) {
		const angle = index * 2.4;
		const height = 0.03 + (index / 18) * 0.18;

		clubPivot.add(
			at(kit.sphere(0.014, STALK, [1, 1, 1], 6), [
				Math.cos(angle) * 0.052,
				height,
				Math.sin(angle) * 0.052,
			]),
		);
	}

	stalk.add(clubPivot);
	head.add(stalk);

	fruitingNubs(kit, head, tips, [
		[
			[0.1, 0.1, 0.04],
			[0.16, 0.22, 0],
		],
		[
			[-0.12, 0.08, 0.02],
			[-0.2, 0.17, -0.04],
		],
	]);

	return head;
}

export function buildCordyceps(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();

	root.name = "cordyceps";

	const tips = kit.owned("tips", {
		texture: "mushroomStem",
		color: 0xffa040,
		emissive: 0xff7a1a,
		emissiveIntensity: 0.9,
		roughness: 0.4,
	});

	const body = kit.pivot("body", 0, ANT_HIP_HEIGHT, 0);

	root.add(body);

	const thorax = kit.capsule(0.11, 0.36, CHITIN, 16);

	thorax.rotation.x = Math.PI / 2;

	thorax.scale.set(1, 1, 0.9);

	body.add(thorax);
	body.add(at(kit.sphere(0.14, CHITIN, [0.85, 0.82, 1], 16), [0, 0.04, 0.17]));

	for (const side of [-1, 1]) {
		const spine = kit.cone(0.016, 0.09, CHITIN, 6);

		spine.position.set(side * 0.04, 0.12, -0.17);
		spine.rotation.set(-0.6, 0, side * 0.3);

		body.add(spine);
	}

	body.add(
		at(kit.sphere(0.055, CHITIN_JOINT, [0.9, 1.35, 0.8], 10), [0, 0.04, -0.3]),
	);

	const gaster = kit.pivot("gaster", 0, 0.02, -0.36);

	gaster.rotation.x = 0.22;

	body.add(gaster);

	gaster.add(
		at(kit.sphere(0.3, CHITIN, [0.95, 0.82, 1.3], 20), [
			0,
			0,
			ANT_GASTER_Z + 0.06,
		]),
	);

	for (const [z, radius, glowing] of [
		[-0.12, 0.24, false],
		[-0.3, 0.29, true],
		[-0.5, 0.28, true],
		[-0.66, 0.2, false],
	] as const) {
		const band = kit.mesh(
			new THREE.TorusGeometry(radius, glowing ? 0.011 : 0.016, 6, 28).scale(
				0.95,
				0.82,
				1,
			),
			glowing ? tips : CHITIN_JOINT,
		);

		band.position.z = z;

		gaster.add(band);
	}

	fuzz(kit, gaster, [
		[0.12, 0.21, -0.3, 0.06],
		[-0.16, 0.17, -0.45, 0.055],
		[0.05, 0.24, -0.52, 0.05],
		[-0.21, -0.03, -0.22, 0.045],
		[0.22, 0.03, -0.56, 0.05],
	]);

	hyphae(kit, gaster, [
		[
			[0.12, 0.22, -0.28],
			[0.02, 0.27, -0.38],
			[-0.12, 0.2, -0.46],
		],
		[
			[0.05, 0.25, -0.5],
			[0.17, 0.2, -0.58],
			[0.22, 0.05, -0.6],
		],
		[
			[-0.2, 0.0, -0.24],
			[-0.22, 0.12, -0.36],
			[-0.15, 0.18, -0.46],
		],
	]);

	fruitingNubs(kit, gaster, tips, [
		[
			[0.1, 0.22, -0.3],
			[0.16, 0.38, -0.36],
		],
		[
			[-0.08, 0.24, -0.5],
			[-0.14, 0.4, -0.58],
		],
		[
			[0.18, 0.12, -0.48],
			[0.3, 0.22, -0.52],
		],
		[
			[-0.2, 0.1, -0.24],
			[-0.32, 0.2, -0.22],
		],
		[
			[0, 0.2, -0.66],
			[0.02, 0.32, -0.78],
		],
	]);

	const neck = kit.pivot("neck", 0, 0.04, 0.3);

	body.add(neck);

	neck.add(
		segment(
			kit,
			[
				[0, 0, -0.04],
				[0, 0.01, 0.06],
			],
			0.05,
			0.06,
			CHITIN_JOINT,
		),
	);

	neck.add(buildHead(kit, tips));

	fuzz(kit, body, [
		[0.08, 0.1, 0.05, 0.06],
		[-0.09, 0.08, -0.1, 0.05],
		[0, 0.12, 0.2, 0.05],
	]);

	fruitingNubs(kit, body, tips, [
		[
			[0.06, 0.1, -0.05],
			[0.12, 0.26, -0.1],
		],
		[
			[-0.05, 0.11, 0.08],
			[-0.1, 0.24, 0.12],
		],
	]);

	ANT_LEGS.forEach((leg, index) => {
		body.add(buildLeg(kit, leg, index));
	});

	mergeStaticParts(root);

	return root;
}
