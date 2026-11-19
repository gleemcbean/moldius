import * as THREE from "three";
import {
	CORE_HEIGHT,
	FLAME,
	FLAME_HEIGHT,
	GLASS,
	HANDLE_Y,
} from "../../../src/features/models/LanternModel";
import {
	meterCylinder,
	meterLathe,
	meterSphere,
	meterTorus,
} from "../../../src/features/world/geometryUtils";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import { type BuildKit, PartList } from "../kit";

const BRASS: MaterialOptions = {
	texture: "brass",
	roughness: 0.38,
	metalness: 0.8,
};
const IRON: MaterialOptions = {
	texture: "iron",
	roughness: 0.55,
	metalness: 0.55,
	side: THREE.DoubleSide,
};
const WAX: MaterialOptions = { texture: "wax", roughness: 0.6 };
const GRIP: MaterialOptions = { texture: "woodDark", roughness: 0.6 };
const SOOT: MaterialOptions = { color: 0x0d0b09, roughness: 1 };

const SEGMENTS = 36;
const GLASS_RADIUS = 0.058;
const GLASS_BULGE = 0.066;
const GUARD_GAP = 0.0035;
const SHUTTER_RADIUS = 0.072;
const GLASS_BOTTOM = 0.03;
const GLASS_TOP = 0.19;
const GUARD_WIRES = 6;
const BAIL_RADIUS = 0.076;
const BAIL_Y = 0.2225;
const CANDLE_TOP = 0.0845;

function glassRadiusAt(y: number): number {
	const t = (y - GLASS_BOTTOM) / (GLASS_TOP - GLASS_BOTTOM);
	return GLASS_RADIUS + (GLASS_BULGE - GLASS_RADIUS) * Math.sin(Math.PI * t);
}

function lathe(
	profile: [number, number][],
	segments = SEGMENTS,
): THREE.BufferGeometry {
	return meterLathe(
		profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
		segments,
	);
}

function at(
	geometry: THREE.BufferGeometry,
	x: number,
	y: number,
	z: number,
	rotationX = 0,
	rotationY = 0,
	rotationZ = 0,
): THREE.BufferGeometry {
	geometry.applyMatrix4(
		new THREE.Matrix4().compose(
			new THREE.Vector3(x, y, z),
			new THREE.Quaternion().setFromEuler(
				new THREE.Euler(rotationX, rotationY, rotationZ, "YXZ"),
			),
			new THREE.Vector3(1, 1, 1),
		),
	);
	return geometry;
}

function guardWire(angle: number): THREE.BufferGeometry {
	const points: THREE.Vector3[] = [];
	for (let step = 0; step <= 8; step += 1) {
		const y =
			GLASS_BOTTOM + 0.004 + ((GLASS_TOP - GLASS_BOTTOM - 0.008) * step) / 8;
		const radius = glassRadiusAt(y) + GUARD_GAP;
		points.push(
			new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius),
		);
	}
	return new THREE.TubeGeometry(
		new THREE.CatmullRomCurve3(points),
		20,
		0.0017,
		6,
		false,
	);
}

export function buildLantern(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "lantern";
	const parts = new PartList();

	parts.add(
		BRASS,
		lathe([
			[0.001, 0],
			[0.074, 0],
			[0.079, 0.0025],
			[0.0805, 0.007],
			[0.078, 0.011],
			[0.072, 0.013],
			[0.0745, 0.0165],
			[0.0745, 0.0225],
			[0.071, 0.025],
			[0.0665, 0.027],
			[0.0665, GLASS_BOTTOM],
			[0.001, GLASS_BOTTOM],
		]),
	);
	parts.add(
		BRASS,
		at(meterTorus(0.0752, 0.0016, 6, SEGMENTS), 0, 0.0132, 0, Math.PI / 2),
	);
	for (let index = 0; index < 18; index += 1) {
		const angle = (index / 18) * Math.PI * 2;
		parts.add(
			SOOT,
			at(
				meterSphere(0.0021, 8, 6).scale(0.5, 1.5, 1),
				Math.cos(angle) * 0.0742,
				0.0196,
				Math.sin(angle) * 0.0742,
				0,
				-angle,
			),
		);
	}

	parts.add(
		BRASS,
		lathe(
			[
				[0.001, GLASS_BOTTOM],
				[0.021, GLASS_BOTTOM],
				[0.0235, GLASS_BOTTOM + 0.0055],
				[0.0205, GLASS_BOTTOM + 0.0075],
				[0.0175, GLASS_BOTTOM + 0.0045],
				[0.001, GLASS_BOTTOM + 0.0045],
			],
			24,
		),
	);
	parts.add(
		WAX,
		lathe(
			[
				[0.001, GLASS_BOTTOM + 0.004],
				[0.0145, GLASS_BOTTOM + 0.004],
				[0.0148, 0.072],
				[0.015, 0.082],
				[0.0136, CANDLE_TOP],
				[0.0105, 0.0832],
				[0.004, 0.0816],
				[0.001, 0.0815],
			],
			24,
		),
	);
	for (const [angle, length, drop] of [
		[0.4, 0.016, 0.075],
		[2.3, 0.011, 0.078],
		[4.1, 0.022, 0.071],
	] as const) {
		parts.add(
			WAX,
			at(
				meterSphere(0.0042, 10, 8).scale(1, length / 0.0084, 0.8),
				Math.cos(angle) * 0.0147,
				drop,
				Math.sin(angle) * 0.0147,
				0,
				-angle,
			),
		);
	}
	parts.add(
		SOOT,
		at(meterCylinder(0.0011, 0.0013, 0.011, 6), 0.0008, 0.0868, 0, 0, 0, 0.18),
	);

	const glass = lathe(
		Array.from({ length: 9 }, (_, step) => {
			const y = GLASS_BOTTOM + ((GLASS_TOP - GLASS_BOTTOM) * step) / 8;
			return [glassRadiusAt(y), y] as [number, number];
		}),
	);
	const glassMesh = kit.named("glass", kit.mesh(glass, GLASS));
	glassMesh.renderOrder = 1;
	root.add(glassMesh);

	for (let index = 0; index < GUARD_WIRES; index += 1) {
		parts.add(
			BRASS,
			guardWire((index / GUARD_WIRES) * Math.PI * 2 + Math.PI / GUARD_WIRES),
		);
	}
	for (const y of [0.07, 0.15]) {
		parts.add(
			BRASS,
			at(
				meterTorus(glassRadiusAt(y) + GUARD_GAP, 0.0017, 6, SEGMENTS),
				0,
				y,
				0,
				Math.PI / 2,
			),
		);
	}
	for (const y of [GLASS_BOTTOM + 0.003, GLASS_TOP - 0.002]) {
		parts.add(
			BRASS,
			at(
				meterTorus(GLASS_RADIUS + 0.0035, 0.0034, 8, SEGMENTS),
				0,
				y,
				0,
				Math.PI / 2,
			),
		);
	}

	const roofY = GLASS_TOP;
	parts.add(
		BRASS,
		lathe([
			[0.001, roofY],
			[0.074, roofY],
			[0.0805, roofY + 0.003],
			[0.0815, roofY + 0.008],
			[0.0775, roofY + 0.0115],
			[0.0705, roofY + 0.0155],
			[0.0565, roofY + 0.028],
			[0.0548, roofY + 0.0315],
			[0.0525, roofY + 0.032],
			[0.04, roofY + 0.0425],
			[0.03, roofY + 0.05],
			[0.0262, roofY + 0.054],
			[0.0242, roofY + 0.058],
			[0.001, roofY + 0.058],
		]),
	);
	for (let index = 0; index < 14; index += 1) {
		const angle = (index / 14) * Math.PI * 2;
		parts.add(
			SOOT,
			at(
				meterSphere(0.0024, 8, 6).scale(0.45, 0.9, 1.6),
				Math.cos(angle) * 0.0617,
				roofY + 0.0222,
				Math.sin(angle) * 0.0617,
				0,
				-angle,
				0.72,
			),
		);
	}
	parts.add(
		BRASS,
		at(meterCylinder(0.0165, 0.0185, 0.024, 20), 0, roofY + 0.07, 0),
	);
	parts.add(
		BRASS,
		at(meterTorus(0.0178, 0.0018, 6, 20), 0, roofY + 0.0815, 0, Math.PI / 2),
	);
	for (let index = 0; index < 3; index += 1) {
		const angle = (index / 3) * Math.PI * 2;
		parts.add(
			BRASS,
			at(
				meterCylinder(0.0015, 0.0015, 0.008, 6),
				Math.cos(angle) * 0.0155,
				roofY + 0.0855,
				Math.sin(angle) * 0.0155,
			),
		);
	}
	parts.add(
		BRASS,
		lathe(
			[
				[0.001, roofY + 0.0885],
				[0.0305, roofY + 0.0885],
				[0.031, roofY + 0.0905],
				[0.0255, roofY + 0.0945],
				[0.012, roofY + 0.1005],
				[0.004, roofY + 0.1025],
				[0.001, roofY + 0.1025],
			],
			24,
		),
	);
	parts.add(
		SOOT,
		at(meterCylinder(0.0128, 0.0128, 0.001, 20), 0, roofY + 0.0822, 0),
	);

	parts.add(
		BRASS,
		at(meterTorus(BAIL_RADIUS, 0.0028, 8, 40, Math.PI), 0, BAIL_Y, 0),
	);
	for (const side of [-1, 1]) {
		parts.add(
			BRASS,
			at(
				meterCylinder(0.0085, 0.0085, 0.004, 16),
				side * (BAIL_RADIUS - 0.002),
				BAIL_Y,
				0,
				0,
				0,
				Math.PI / 2,
			),
		);
		parts.add(
			BRASS,
			at(meterSphere(0.0032, 10, 8), side * (BAIL_RADIUS + 0.0012), BAIL_Y, 0),
		);
		parts.add(
			BRASS,
			at(
				meterCylinder(0.0024, 0.0024, 0.026, 8),
				side * (BAIL_RADIUS - 0.014),
				BAIL_Y,
				0,
				0,
				0,
				Math.PI / 2,
			),
		);
		parts.add(
			BRASS,
			at(
				meterCylinder(0.0018, 0.0018, 0.03, 6),
				side * (BAIL_RADIUS - 0.006),
				BAIL_Y - 0.014,
				0,
				0,
				0,
				side * 0.5,
			),
		);
	}
	parts.add(
		GRIP,
		at(
			lathe(
				[
					[0.001, -0.021],
					[0.0058, -0.021],
					[0.0072, -0.016],
					[0.0079, -0.006],
					[0.0079, 0.006],
					[0.0072, 0.016],
					[0.0058, 0.021],
					[0.001, 0.021],
				],
				16,
			),
			0,
			BAIL_Y + BAIL_RADIUS - 0.0015,
			0,
			0,
			0,
			Math.PI / 2,
		),
	);
	parts.add(
		BRASS,
		at(meterTorus(0.014, 0.0033, 8, 20), 0, BAIL_Y + BAIL_RADIUS + 0.0115, 0),
	);
	parts.build(kit, root);

	const shutterHeight = GLASS_TOP - GLASS_BOTTOM;
	const shutter = kit.pivot("shutter", 0, GLASS_TOP, 0);
	const sleeve = new PartList();
	sleeve.add(
		IRON,
		at(
			new THREE.CylinderGeometry(
				SHUTTER_RADIUS,
				SHUTTER_RADIUS,
				shutterHeight,
				SEGMENTS,
				1,
				true,
			),
			0,
			-shutterHeight / 2,
			0,
		),
	);
	sleeve.add(
		BRASS,
		at(
			meterTorus(SHUTTER_RADIUS, 0.0032, 6, SEGMENTS),
			0,
			-shutterHeight,
			0,
			Math.PI / 2,
		),
	);
	sleeve.add(
		BRASS,
		at(
			meterTorus(SHUTTER_RADIUS, 0.0026, 6, SEGMENTS),
			0,
			-0.004,
			0,
			Math.PI / 2,
		),
	);
	for (let row = 0; row < 4; row += 1) {
		for (let column = 0; column < 12; column += 1) {
			const angle = (column / 12) * Math.PI * 2 + (row % 2) * (Math.PI / 12);
			sleeve.add(
				SOOT,
				at(
					meterSphere(0.0026, 8, 6).scale(0.35, 1, 1),
					Math.cos(angle) * (SHUTTER_RADIUS + 0.0002),
					-0.03 - row * 0.032,
					Math.sin(angle) * (SHUTTER_RADIUS + 0.0002),
					0,
					-angle,
				),
			);
		}
	}
	sleeve.build(kit, shutter);
	root.add(shutter);

	[0, Math.PI / 3, (Math.PI * 2) / 3].forEach((rotation, index) => {
		const flame = kit.named(
			`flame_${index}`,
			kit.mesh(new THREE.PlaneGeometry(0.04, 0.075), FLAME),
		);
		flame.position.y = FLAME_HEIGHT;
		flame.rotation.y = rotation;
		root.add(flame);
	});
	const core = kit.named(
		"core",
		kit.sphere(0.015, { color: 0xffe8a0, unlit: true }, [1, 1.6, 1], 8),
	);
	core.position.y = CORE_HEIGHT;
	root.add(core);
	root.add(kit.anchor("handle", 0, HANDLE_Y, 0));
	root.add(kit.anchor("light", 0, FLAME_HEIGHT, 0));
	return root;
}
