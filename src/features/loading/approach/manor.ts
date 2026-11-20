import { SeededRandom } from "@shared/random";
import * as THREE from "three";
import type { ModelKit } from "../../models/modelKit";
import {
	meterBox,
	meterCylinder,
	meterSphere,
	meterTorus,
	placed,
	scaleUv,
} from "../../world/geometryUtils";
import type {
	MaterialLibrary,
	MaterialOptions,
} from "../../world/MaterialLibrary";
import {
	Batch,
	box,
	fitted,
	gable,
	halfDisc,
	pyramid,
	twistedSpire,
} from "./geometry";
import {
	FACADE_Z,
	MAIN_DEPTH,
	MAIN_Z,
	SIGIL_CENTER,
	SPIRE_TIP,
	TOWER_FRONT_Z,
	TOWER_Z,
	TURRET_X,
	WING_X,
} from "./layout";
import {
	DARK_GLASS,
	DOOR_GLOW,
	DOOR_WOOD,
	IRON,
	LIT_WINDOWS,
	MULLION,
	ORB_GLOW,
	ROOF,
	STONE,
	TRIM,
} from "./palette";

const MANOR_SEED = 1847;
const LIT_WINDOW_CHANCE = 0.6;

export interface ManorParts {
	walls: THREE.Group;
	details: THREE.Group;
	doors: THREE.Object3D[];
	lamps: THREE.Object3D[];
}

function roof(
	batch: Batch,
	width: number,
	depth: number,
	rise: number,
	eaveY: number,
	centerZ: number,
	overhang: number,
): void {
	const run = depth / 2 + overhang;
	const angle = Math.atan2(rise, depth / 2);
	const drop = run * Math.tan(angle);

	for (const side of [1, -1]) {
		batch.add(
			ROOF,
			box(
				width + overhang * 2,
				0.28,
				run / Math.cos(angle),
				0,
				eaveY + rise - drop / 2,
				centerZ + (side * run) / 2,
				0,
				side * angle,
			),
		);
	}
}

function windowAt(
	batch: Batch,
	glass: MaterialOptions,
	x: number,
	y: number,
	z: number,
	width: number,
	height: number,
	rotationY = 0,
): void {
	const pane = scaleUv(new THREE.PlaneGeometry(width, height), width, height);
	const arch = halfDisc(width / 2).translate(0, height / 2, 0);

	const outward = new THREE.Vector3(
		Math.sin(rotationY),
		0,
		Math.cos(rotationY),
	);

	const at = (forward: number) => ({
		x: x + outward.x * forward,
		z: z + outward.z * forward,
	});

	const glassAt = at(0.02);
	const barAt = at(0.05);
	const sillAt = at(0.12);
	const ringAt = at(0.06);

	batch.add(glass, placed(pane, glassAt.x, y, glassAt.z, rotationY));
	batch.add(glass, placed(arch, glassAt.x, y, glassAt.z, rotationY));

	batch.add(
		MULLION,
		box(
			0.07,
			height + width / 2,
			0.04,
			barAt.x,
			y + width / 4,
			barAt.z,
			rotationY,
		),
	);

	batch.add(
		MULLION,
		box(width, 0.07, 0.04, barAt.x, y + height * 0.12, barAt.z, rotationY),
	);

	batch.add(
		TRIM,
		box(
			width + 0.36,
			0.16,
			0.26,
			sillAt.x,
			y - height / 2 - 0.08,
			sillAt.z,
			rotationY,
		),
	);

	batch.add(
		TRIM,
		placed(
			meterTorus(width / 2 + 0.1, 0.09, 4, 12, Math.PI),
			ringAt.x,
			y + height / 2,
			ringAt.z,
			rotationY,
		),
	);

	for (const side of [-1, 1]) {
		const offset = side * (width / 2 + 0.1);

		batch.add(
			TRIM,
			box(
				0.18,
				height,
				0.14,
				ringAt.x + Math.cos(rotationY) * offset,
				y,
				ringAt.z - Math.sin(rotationY) * offset,
				rotationY,
			),
		);
	}
}

function windowGlass(rng: SeededRandom): MaterialOptions {
	return rng.chance(LIT_WINDOW_CHANCE) ? rng.pick(LIT_WINDOWS) : DARK_GLASS;
}

function glowingOrb(
	batch: Batch,
	radius: number,
	x: number,
	y: number,
	z: number,
): void {
	batch.add(ORB_GLOW, placed(meterSphere(radius, 12, 8), x, y, z));
}

function addMainBody(walls: Batch): void {
	walls.add(STONE, box(18, 10, MAIN_DEPTH, 0, 5, MAIN_Z));
	walls.add(TRIM, box(18.4, 0.8, MAIN_DEPTH + 0.4, 0, 0.4, MAIN_Z));
	walls.add(TRIM, box(18.5, 0.35, MAIN_DEPTH + 0.5, 0, 9.9, MAIN_Z));
	roof(walls, 18, MAIN_DEPTH, 4.6, 10, MAIN_Z, 0.6);
}

function addSide(
	walls: Batch,
	details: Batch,
	rng: SeededRandom,
	side: number,
): void {
	const wingX = side * WING_X;
	const wingZ = MAIN_Z - 1;
	const turretX = side * TURRET_X;

	walls.add(
		STONE,
		gable(MAIN_DEPTH, 4.6, side * 9, 10, MAIN_Z, side * (Math.PI / 2)),
	);

	walls.add(STONE, box(8, 7.5, 8, wingX, 3.75, wingZ));
	walls.add(TRIM, box(8.4, 0.7, 8.4, wingX, 0.35, wingZ));
	walls.add(TRIM, box(8.5, 0.3, 8.5, wingX, 7.4, wingZ));
	walls.add(ROOF, pyramid(4.6, 4.6, 3.6, wingX, 7.5 + 1.8, wingZ));
	glowingOrb(details, 0.22, wingX, 11.3, wingZ);

	walls.add(
		STONE,
		placed(meterCylinder(1.5, 1.6, 13, 14), turretX, 6.5, FACADE_Z),
	);

	walls.add(
		TRIM,
		placed(meterCylinder(1.8, 1.8, 0.35, 14), turretX, 13, FACADE_Z),
	);

	walls.add(
		ROOF,
		twistedSpire(1.95, 6.4, 0.35 * side, turretX, 16.2, FACADE_Z),
	);

	details.add(
		IRON,
		placed(meterCylinder(0.03, 0.05, 1.2, 6), turretX, 19.9, FACADE_Z),
	);

	glowingOrb(details, 0.28, turretX, 20.7, FACADE_Z);

	walls.add(STONE, box(1.1, 3.6, 1.1, side * 5.5, 13.4, MAIN_Z - 1.5));
	walls.add(TRIM, box(1.4, 0.3, 1.4, side * 5.5, 15.3, MAIN_Z - 1.5));

	for (const row of [2.4, 6.4]) {
		for (const x of [4.2, 6.5]) {
			windowAt(details, windowGlass(rng), side * x, row, FACADE_Z, 1.05, 1.9);
		}
	}

	for (const row of [2.3, 5.2]) {
		for (const x of [11.2, 14.8]) {
			windowAt(details, windowGlass(rng), side * x, row, wingZ + 4, 1.0, 1.7);
		}
	}

	windowAt(
		details,
		side > 0 ? LIT_WINDOWS[0] : LIT_WINDOWS[1],
		turretX,
		8.4,
		FACADE_Z + 1.62,
		0.4,
		1.1,
	);
}

function addTower(walls: Batch, details: Batch): void {
	walls.add(STONE, box(5, 18, 5, 0, 9, TOWER_Z));
	walls.add(TRIM, box(5.4, 0.8, 5.4, 0, 0.4, TOWER_Z));
	walls.add(TRIM, box(5.7, 0.45, 5.7, 0, 18, TOWER_Z));
	walls.add(ROOF, twistedSpire(3.6, 10.5, 0.5, 0, 18 + 5.25, TOWER_Z));
	details.add(IRON, placed(meterCylinder(0.04, 0.07, 2, 6), 0, 29, TOWER_Z));
	glowingOrb(details, 0.4, SPIRE_TIP.x, SPIRE_TIP.y, SPIRE_TIP.z);

	windowAt(details, LIT_WINDOWS[0], 0, 7.4, TOWER_FRONT_Z, 1.2, 2.2);
	windowAt(details, LIT_WINDOWS[1], 0, 11.4, TOWER_FRONT_Z, 1.0, 1.8);

	const sigilBacking = new THREE.CircleGeometry(1.15, 24);

	scaleUv(sigilBacking, 2.3, 2.3);

	details.add(
		DARK_GLASS,
		placed(sigilBacking, SIGIL_CENTER.x, SIGIL_CENTER.y, TOWER_FRONT_Z + 0.02),
	);

	details.add(
		TRIM,
		placed(
			meterTorus(1.22, 0.13, 4, 24),
			SIGIL_CENTER.x,
			SIGIL_CENTER.y,
			TOWER_FRONT_Z + 0.05,
		),
	);
}

function addPorch(details: Batch): void {
	details.add(TRIM, box(0.4, 3.2, 0.3, -1.2, 1.6, TOWER_FRONT_Z + 0.12));
	details.add(TRIM, box(0.4, 3.2, 0.3, 1.2, 1.6, TOWER_FRONT_Z + 0.12));

	details.add(
		TRIM,
		placed(meterTorus(1.2, 0.2, 6, 16, Math.PI), 0, 3.2, TOWER_FRONT_Z + 0.12),
	);

	details.add(DOOR_WOOD, placed(halfDisc(1.0), 0, 3.2, TOWER_FRONT_Z + 0.04));

	const opening = scaleUv(new THREE.PlaneGeometry(2, 3.2), 2, 3.2);

	details.add(DOOR_GLOW, placed(opening, 0, 1.6, TOWER_FRONT_Z + 0.02));

	for (let step = 0; step < 3; step += 1) {
		const depth = 1.4 - step * 0.45;

		details.add(
			TRIM,
			box(
				3.8 - step * 0.45,
				0.18,
				depth,
				0,
				0.09 + step * 0.18,
				TOWER_FRONT_Z + depth / 2,
			),
		);
	}
}

function doorLeaf(materials: MaterialLibrary, side: number): THREE.Group {
	const pivot = new THREE.Group();

	const leaf = new THREE.Mesh(
		meterBox(1.0, 3.2, 0.12),
		materials.get(DOOR_WOOD),
	);

	const ring = new THREE.Mesh(
		meterTorus(0.09, 0.02, 4, 10),
		materials.get(IRON),
	);

	pivot.position.set(side * 1.0, 0, TOWER_FRONT_Z + 0.06);
	leaf.position.set(-side * 0.5, 1.6, 0);
	ring.position.set(-side * 0.82, 1.4, 0.08);
	pivot.add(leaf, ring);

	pivot.userData.side = side;

	return pivot;
}

export function buildManor(
	materials: MaterialLibrary,
	kit: ModelKit,
): ManorParts {
	const rng = new SeededRandom(MANOR_SEED);
	const walls = new Batch();
	const details = new Batch();

	addMainBody(walls);

	for (const side of [-1, 1]) {
		addSide(walls, details, rng, side);
	}

	addTower(walls, details);
	addPorch(details);

	const doors: THREE.Object3D[] = [];
	const lamps: THREE.Object3D[] = [];

	for (const side of [-1, 1]) {
		const lamp = fitted(kit.model("furniture/wallLantern"), 0.75);

		lamp.position.set(side * 1.85, 2.4, TOWER_FRONT_Z + 0.05);
		doors.push(doorLeaf(materials, side));
		lamps.push(lamp);
	}

	return {
		walls: walls.build(materials, true, false),
		details: details.build(materials, false, true),
		doors,
		lamps,
	};
}
