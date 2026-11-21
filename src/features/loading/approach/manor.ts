import { SeededRandom } from "@shared/random";
import * as THREE from "three";
import type { ModelKit } from "../../models/modelKit";
import {
	meterBox,
	meterCircle,
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
import { Batch, box, fitted, gable, halfDisc, spire } from "./geometry";
import {
	CAMERA_TRAIL,
	DOOR_HALF_WIDTH,
	DOOR_HEIGHT,
	ENTRANCE_Z,
	FACADE_Z,
	MAIN_Z,
	START_Z,
	TOWER_WALL,
} from "./layout";
import {
	DARK_GLASS,
	DOOR_GLOW,
	DOOR_WOOD,
	IRON,
	LIT_WINDOWS,
	MULLION,
	ROOF,
	STONE,
	TRIM,
} from "./palette";

const MANOR_SEED = 1847;
const LIT_WINDOW_CHANCE = 0.55;
const MAIN_HALF_WIDTH = 19;
const MAIN_DEPTH = 16;
const MAIN_WALL = 16;
const MAIN_RISE = 10;
const WING_INNER_X = 19;
const WING_OUTER_X = 35;
const WING_DEPTH = 14;
const WING_WALL = 13;
const WING_RISE = 8;
const PORCH_HALF_WIDTH = 5.5;
const PORCH_WALL = 12;
const PORCH_RISE = 6.5;
const TOWER_HALF = 5;
const SPIRE_RADIUS = 4.3;
const SPIRE_HEIGHT = 14;
const ROSE_Y = 8.8;
const VIEW_X = 0.6;
const VIEW_Z = START_Z + CAMERA_TRAIL;

export interface ManorParts {
	walls: THREE.Group;
	details: THREE.Group;
	doors: THREE.Object3D[];
	lamps: THREE.Object3D[];
}

function roof(
	batch: Batch,
	x: number,
	z: number,
	span: number,
	length: number,
	rise: number,
	eaveY: number,
	overhang: number,
	alongZ = false,
): void {
	const run = span / 2 + overhang;
	const angle = Math.atan2(rise, span / 2);
	const slant = run / Math.cos(angle);
	const y = eaveY + rise - (run * Math.tan(angle)) / 2;
	const reach = length + overhang * 2;

	for (const side of [1, -1]) {
		batch.add(
			ROOF,
			alongZ
				? box(
						slant,
						0.3,
						reach,
						x + (side * run) / 2,
						y,
						z,
						0,
						0,
						-side * angle,
					)
				: box(reach, 0.3, slant, x, y, z + (side * run) / 2, 0, side * angle),
		);
	}
}

function finial(
	batch: Batch,
	x: number,
	y: number,
	z: number,
	height: number,
): void {
	batch.add(
		IRON,
		placed(meterSphere(height * 0.08, 8, 6), x, y + height * 0.1, z),
	);

	batch.add(
		IRON,
		placed(meterCylinder(0, height * 0.04, height, 5), x, y + height / 2, z),
	);

	batch.add(
		IRON,
		placed(meterSphere(height * 0.05, 8, 6), x, y + height * 0.42, z),
	);
}

function cresting(batch: Batch, from: THREE.Vector3, to: THREE.Vector3): void {
	const length = from.distanceTo(to);
	const spikes = Math.max(2, Math.round(length / 0.75));
	const alongZ = Math.abs(to.z - from.z) > Math.abs(to.x - from.x);
	const middle = from.clone().lerp(to, 0.5);

	batch.add(
		IRON,
		box(
			alongZ ? 0.07 : length,
			0.07,
			alongZ ? length : 0.07,
			middle.x,
			middle.y + 0.1,
			middle.z,
		),
	);

	for (let index = 0; index <= spikes; index += 1) {
		const at = from.clone().lerp(to, index / spikes);

		batch.add(
			IRON,
			placed(meterCylinder(0, 0.045, 0.75, 4), at.x, at.y + 0.42, at.z),
		);
	}
}

function pinnacle(
	walls: Batch,
	details: Batch,
	x: number,
	z: number,
	baseY: number,
	width: number,
	shaft: number,
	cap: number,
): void {
	const capBase = baseY + shaft + 0.11;

	walls.add(STONE, box(width, shaft, width, x, baseY + shaft / 2, z));
	walls.add(TRIM, box(width * 1.3, 0.22, width * 1.3, x, baseY + shaft, z));
	walls.add(ROOF, spire(width * 0.62 * Math.SQRT2, cap, 4, x, capBase, z));
	finial(details, x, capBase + cap, z, Math.max(0.8, cap * 0.35));
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

function roseWindow(
	batch: Batch,
	glass: MaterialOptions,
	x: number,
	y: number,
	z: number,
	radius: number,
): void {
	batch.add(glass, placed(meterCircle(radius, 24), x, y, z + 0.02));

	batch.add(
		TRIM,
		placed(meterTorus(radius + 0.14, 0.17, 6, 28), x, y, z + 0.08),
	);

	batch.add(
		MULLION,
		placed(meterTorus(radius * 0.36, 0.05, 4, 16), x, y, z + 0.05),
	);

	for (let index = 0; index < 8; index += 1) {
		const angle = (index / 8) * Math.PI * 2;
		const middle = radius * 0.68;

		batch.add(
			MULLION,
			box(
				0.07,
				radius * 0.64,
				0.04,
				x + Math.sin(angle) * middle,
				y + Math.cos(angle) * middle,
				z + 0.05,
				0,
				0,
				-angle,
			),
		);
	}
}

function buttress(walls: Batch, details: Batch, x: number, z: number): void {
	walls.add(STONE, box(1, 9.5, 1.4, x, 4.75, z + 0.7));
	walls.add(TRIM, box(1.15, 0.3, 1.55, x, 9.5, z + 0.7));
	walls.add(STONE, box(0.85, 6.5, 0.95, x, 12.75, z + 0.48));
	pinnacle(walls, details, x, z + 0.48, MAIN_WALL, 0.75, 1.5, 2.4);
}

function dormer(
	walls: Batch,
	details: Batch,
	rng: SeededRandom,
	x: number,
	frontZ: number,
	baseY: number,
): void {
	const width = 2.6;
	const height = 3.4;
	const depth = 4;
	const top = baseY + height;
	const centerZ = frontZ - depth / 2;

	walls.add(STONE, box(width, height, depth, x, baseY + height / 2, centerZ));
	walls.add(STONE, gable(width, 1.5, x, top, frontZ + 0.01, 0));
	roof(walls, x, centerZ + 0.2, width, depth, 1.5, top, 0.25, true);
	windowAt(details, windowGlass(rng), x, baseY + 2, frontZ, 0.95, 1.4);
	finial(details, x, top + 1.6, frontZ + 0.3, 1.3);
}

function chimney(
	walls: Batch,
	x: number,
	z: number,
	baseY: number,
	height: number,
): void {
	walls.add(STONE, box(1.6, height, 1.1, x, baseY + height / 2, z));
	walls.add(TRIM, box(1.9, 0.3, 1.4, x, baseY + height, z));

	for (const offset of [-0.4, 0.4]) {
		walls.add(
			TRIM,
			placed(
				meterCylinder(0.16, 0.19, 0.7, 8),
				x + offset,
				baseY + height + 0.5,
				z,
			),
		);
	}
}

function turret(
	walls: Batch,
	details: Batch,
	rng: SeededRandom,
	x: number,
	z: number,
	radius: number,
	wall: number,
	spireHeight: number,
): void {
	const facing = Math.atan2(VIEW_X - x, VIEW_Z - z);

	walls.add(
		STONE,
		placed(meterCylinder(radius, radius * 1.05, wall, 18), x, wall / 2, z),
	);

	walls.add(
		TRIM,
		placed(meterCylinder(radius * 1.12, radius * 1.15, 0.9, 18), x, 0.45, z),
	);

	walls.add(
		TRIM,
		placed(
			meterCylinder(radius * 1.18, radius * 1.02, 1.1, 18),
			x,
			wall - 0.75,
			z,
		),
	);

	walls.add(
		TRIM,
		placed(meterCylinder(radius * 1.22, radius * 1.22, 0.4, 18), x, wall, z),
	);

	walls.add(ROOF, spire(radius * 1.3, spireHeight, 18, x, wall + 0.2, z));

	finial(
		details,
		x,
		wall + 0.2 + spireHeight,
		z,
		Math.min(2.2, spireHeight * 0.16),
	);

	for (let y = 5; y < wall - 3; y += 4.6) {
		windowAt(
			details,
			windowGlass(rng),
			x + Math.sin(facing) * radius,
			y,
			z + Math.cos(facing) * radius,
			0.55,
			1.4,
			facing,
		);
	}
}

function lucarne(
	walls: Batch,
	details: Batch,
	yaw: number,
	baseY: number,
): void {
	const outward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
	const apothem = SPIRE_RADIUS * Math.cos(Math.PI / 8);
	const lift = 2.2;
	const width = 1.3;
	const height = 1.6;
	const depth = 1.8;
	const reach = apothem * (1 - (lift - height / 2) / SPIRE_HEIGHT) + 0.35;
	const top = baseY + lift + height / 2;
	const alongZ = Math.abs(outward.z) > 0.5;
	const center = outward.clone().multiplyScalar(reach - depth / 2);
	const front = outward.clone().multiplyScalar(reach);

	walls.add(
		STONE,
		box(
			alongZ ? width : depth,
			height,
			alongZ ? depth : width,
			center.x,
			baseY + lift,
			MAIN_Z + center.z,
		),
	);

	walls.add(STONE, gable(width, 0.9, front.x, top, MAIN_Z + front.z, yaw));

	roof(
		walls,
		center.x,
		MAIN_Z + center.z,
		width,
		depth,
		0.9,
		top,
		0.15,
		alongZ,
	);

	windowAt(
		details,
		DARK_GLASS,
		front.x,
		baseY + lift - 0.1,
		MAIN_Z + front.z,
		0.5,
		0.7,
		yaw,
	);

	finial(
		details,
		front.x + outward.x * 0.1,
		top + 0.95,
		MAIN_Z + front.z + outward.z * 0.1,
		0.8,
	);
}

function addMainBody(walls: Batch, details: Batch, rng: SeededRandom): void {
	const width = MAIN_HALF_WIDTH * 2;
	const ridge = MAIN_WALL + MAIN_RISE + 0.15;

	walls.add(STONE, box(width, MAIN_WALL, MAIN_DEPTH, 0, MAIN_WALL / 2, MAIN_Z));
	walls.add(TRIM, box(width + 0.6, 1, MAIN_DEPTH + 0.6, 0, 0.5, MAIN_Z));

	for (const y of [5.7, 10.7]) {
		walls.add(TRIM, box(width + 0.3, 0.3, MAIN_DEPTH + 0.3, 0, y, MAIN_Z));
	}

	walls.add(
		TRIM,
		box(width + 0.8, 0.5, MAIN_DEPTH + 0.8, 0, MAIN_WALL, MAIN_Z),
	);

	roof(walls, 0, MAIN_Z, MAIN_DEPTH, width, MAIN_RISE, MAIN_WALL, 0.8);

	for (const side of [-1, 1]) {
		walls.add(
			STONE,
			gable(
				MAIN_DEPTH,
				MAIN_RISE,
				side * MAIN_HALF_WIDTH,
				MAIN_WALL,
				MAIN_Z,
				(side * Math.PI) / 2,
			),
		);

		cresting(
			details,
			new THREE.Vector3(side * (TOWER_HALF + 0.6), ridge, MAIN_Z),
			new THREE.Vector3(side * (MAIN_HALF_WIDTH + 0.4), ridge, MAIN_Z),
		);

		finial(details, side * (MAIN_HALF_WIDTH + 0.5), ridge, MAIN_Z, 2);

		for (const [row, y] of [3.2, 8.2, 13].entries()) {
			for (const x of [7.8, 11.2, 14.6]) {
				windowAt(
					details,
					windowGlass(rng),
					side * x,
					y,
					FACADE_Z,
					row === 2 ? 1.2 : 1.3,
					row === 2 ? 1.8 : 2.4,
				);
			}
		}

		for (const x of [9.5, 12.9]) {
			buttress(walls, details, side * x, FACADE_Z);
		}

		for (const x of [7.3, 11.2]) {
			dormer(walls, details, rng, side * x, FACADE_Z - 1.2, MAIN_WALL + 0.6);
		}

		chimney(walls, side * 16, MAIN_Z - 3, ridge - 4.65, 7);
	}
}

function addWing(
	walls: Batch,
	details: Batch,
	rng: SeededRandom,
	side: number,
): void {
	const length = WING_OUTER_X - WING_INNER_X;
	const centerX = (side * (WING_INNER_X + WING_OUTER_X)) / 2;
	const frontZ = FACADE_Z - 1;
	const centerZ = frontZ - WING_DEPTH / 2;
	const ridge = WING_WALL + WING_RISE + 0.15;

	walls.add(
		STONE,
		box(length, WING_WALL, WING_DEPTH, centerX, WING_WALL / 2, centerZ),
	);

	walls.add(
		TRIM,
		box(length + 0.4, 0.9, WING_DEPTH + 0.6, centerX, 0.45, centerZ),
	);

	walls.add(
		TRIM,
		box(length + 0.2, 0.3, WING_DEPTH + 0.3, centerX, 6.6, centerZ),
	);

	walls.add(
		TRIM,
		box(length + 0.6, 0.45, WING_DEPTH + 0.8, centerX, WING_WALL, centerZ),
	);

	roof(walls, centerX, centerZ, WING_DEPTH, length, WING_RISE, WING_WALL, 0.6);

	walls.add(
		STONE,
		gable(
			WING_DEPTH,
			WING_RISE,
			side * WING_OUTER_X,
			WING_WALL,
			centerZ,
			(side * Math.PI) / 2,
		),
	);

	cresting(
		details,
		new THREE.Vector3(side * (WING_INNER_X + 1), ridge, centerZ),
		new THREE.Vector3(side * (WING_OUTER_X + 0.3), ridge, centerZ),
	);

	finial(details, side * (WING_OUTER_X + 0.4), ridge, centerZ, 1.8);

	for (const y of [3.2, 8.6]) {
		for (const x of [22.5, 26, 29.5]) {
			windowAt(details, windowGlass(rng), side * x, y, frontZ, 1.2, 2.2);
		}
	}

	dormer(walls, details, rng, side * 27.75, frontZ - 1.1, WING_WALL + 0.5);
	chimney(walls, side * 31.5, centerZ - 2.5, ridge - 3.65, 5.5);
}

function addTower(walls: Batch, details: Batch, rng: SeededRandom): void {
	const size = TOWER_HALF * 2;
	const front = MAIN_Z + TOWER_HALF;
	const spireBase = TOWER_WALL + 0.25;

	const faces: readonly [number, number, number][] = [
		[0, front, 0],
		[-TOWER_HALF, MAIN_Z, -Math.PI / 2],
		[TOWER_HALF, MAIN_Z, Math.PI / 2],
	];

	walls.add(STONE, box(size, TOWER_WALL, size, 0, TOWER_WALL / 2, MAIN_Z));
	walls.add(TRIM, box(size + 0.4, 0.4, size + 0.4, 0, 26.6, MAIN_Z));

	walls.add(
		TRIM,
		box(size + 0.5, 0.6, size + 0.5, 0, TOWER_WALL - 0.75, MAIN_Z),
	);

	walls.add(TRIM, box(size + 1, 0.5, size + 1, 0, TOWER_WALL, MAIN_Z));
	walls.add(ROOF, spire(SPIRE_RADIUS, SPIRE_HEIGHT, 8, 0, spireBase, MAIN_Z));
	finial(details, 0, spireBase + SPIRE_HEIGHT, MAIN_Z, 2.2);
	roseWindow(details, LIT_WINDOWS[2], 0, 24.6, front, 1.1);

	for (const [x, z, yaw] of faces) {
		const across = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

		for (const offset of [-2, 2]) {
			windowAt(
				details,
				rng.chance(0.4) ? rng.pick(LIT_WINDOWS) : DARK_GLASS,
				x + across.x * offset,
				29.4,
				z + across.z * offset,
				1.3,
				3.2,
				yaw,
			);
		}

		lucarne(walls, details, yaw, spireBase);
	}

	for (const sideX of [-1, 1]) {
		for (const sideZ of [-1, 1]) {
			pinnacle(
				walls,
				details,
				sideX * (TOWER_HALF - 0.45),
				MAIN_Z + sideZ * (TOWER_HALF - 0.45),
				TOWER_WALL + 0.25,
				1,
				2.4,
				3,
			);
		}
	}
}

function addPortal(details: Batch): void {
	const opening = scaleUv(
		new THREE.PlaneGeometry(DOOR_HALF_WIDTH * 2, DOOR_HEIGHT),
		DOOR_HALF_WIDTH * 2,
		DOOR_HEIGHT,
	);

	const mouldings: readonly [number, number, number][] = [
		[0.22, 0.24, 0.2],
		[0.72, 0.2, 0.12],
	];

	details.add(
		DOOR_GLOW,
		placed(opening, 0, DOOR_HEIGHT / 2, ENTRANCE_Z + 0.02),
	);

	details.add(
		DOOR_WOOD,
		placed(halfDisc(DOOR_HALF_WIDTH), 0, DOOR_HEIGHT, ENTRANCE_Z + 0.04),
	);

	for (const [inset, tube, forward] of mouldings) {
		const radius = DOOR_HALF_WIDTH + inset;

		details.add(
			TRIM,
			placed(
				meterTorus(radius, tube, 6, 20, Math.PI),
				0,
				DOOR_HEIGHT,
				ENTRANCE_Z + forward,
			),
		);

		for (const side of [-1, 1]) {
			details.add(
				TRIM,
				box(
					tube * 1.8,
					DOOR_HEIGHT,
					tube * 1.6,
					side * radius,
					DOOR_HEIGHT / 2,
					ENTRANCE_Z + forward,
				),
			);
		}
	}

	for (let step = 0; step < 3; step += 1) {
		const depth = 1.5 - step * 0.5;

		details.add(
			TRIM,
			box(
				6.4 - step * 0.9,
				0.18,
				depth,
				0,
				0.09 + step * 0.18,
				ENTRANCE_Z + depth / 2,
			),
		);
	}
}

function addPorch(walls: Batch, details: Batch, rng: SeededRandom): void {
	const width = PORCH_HALF_WIDTH * 2;
	const depth = ENTRANCE_Z - FACADE_Z + 0.4;
	const centerZ = ENTRANCE_Z - depth / 2;
	const apex = PORCH_WALL + PORCH_RISE + 0.15;

	walls.add(STONE, box(width, PORCH_WALL, depth, 0, PORCH_WALL / 2, centerZ));
	walls.add(TRIM, box(width + 0.4, 0.9, depth + 0.2, 0, 0.45, centerZ + 0.1));
	walls.add(TRIM, box(width + 0.3, 0.3, depth + 0.1, 0, 6.7, centerZ + 0.05));

	walls.add(
		TRIM,
		box(width + 0.6, 0.5, depth + 0.3, 0, PORCH_WALL, centerZ + 0.15),
	);

	walls.add(
		STONE,
		gable(width, PORCH_RISE, 0, PORCH_WALL, ENTRANCE_Z + 0.01, 0),
	);

	roof(
		walls,
		0,
		centerZ - 0.1,
		width,
		depth,
		PORCH_RISE,
		PORCH_WALL,
		0.5,
		true,
	);

	cresting(
		details,
		new THREE.Vector3(0, apex, ENTRANCE_Z + 0.3),
		new THREE.Vector3(0, apex, FACADE_Z),
	);

	finial(details, 0, apex, ENTRANCE_Z + 0.4, 2.4);
	roseWindow(details, LIT_WINDOWS[0], 0, ROSE_Y, ENTRANCE_Z, 1.5);
	addPortal(details);

	for (const side of [-1, 1]) {
		walls.add(STONE, box(1.3, 13, 1.3, side * 5.9, 6.5, ENTRANCE_Z - 0.4));
		pinnacle(walls, details, side * 5.9, ENTRANCE_Z - 0.4, 13, 1, 2, 3.4);
		windowAt(details, windowGlass(rng), side * 3.7, 3.2, ENTRANCE_Z, 0.7, 1.8);
		windowAt(details, windowGlass(rng), side * 3.7, 9, ENTRANCE_Z, 0.7, 2);

		windowAt(
			details,
			windowGlass(rng),
			side * PORCH_HALF_WIDTH,
			6,
			centerZ,
			0.9,
			2.4,
			(side * Math.PI) / 2,
		);
	}
}

function doorLeaf(materials: MaterialLibrary, side: number): THREE.Group {
	const pivot = new THREE.Group();
	const iron = materials.get(IRON);

	const leaf = new THREE.Mesh(
		meterBox(DOOR_HALF_WIDTH, DOOR_HEIGHT, 0.14),
		materials.get(DOOR_WOOD),
	);

	const ring = new THREE.Mesh(meterTorus(0.11, 0.025, 4, 10), iron);

	pivot.position.set(side * DOOR_HALF_WIDTH, 0, ENTRANCE_Z + 0.06);
	leaf.position.set((-side * DOOR_HALF_WIDTH) / 2, DOOR_HEIGHT / 2, 0);
	ring.position.set(-side * (DOOR_HALF_WIDTH - 0.22), DOOR_HEIGHT * 0.42, 0.09);
	pivot.add(leaf, ring);

	for (const height of [0.7, DOOR_HEIGHT / 2, DOOR_HEIGHT - 0.7]) {
		const strap = new THREE.Mesh(
			meterBox(DOOR_HALF_WIDTH * 0.8, 0.09, 0.03),
			iron,
		);

		strap.position.set(-side * DOOR_HALF_WIDTH * 0.42, height, 0.08);
		pivot.add(strap);
	}

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
	const doors: THREE.Object3D[] = [];
	const lamps: THREE.Object3D[] = [];

	addMainBody(walls, details, rng);
	addTower(walls, details, rng);
	addPorch(walls, details, rng);

	for (const side of [-1, 1]) {
		const lamp = fitted(kit.model("furniture/wallLantern"), 0.9);

		addWing(walls, details, rng, side);
		turret(walls, details, rng, side * WING_INNER_X, FACADE_Z, 3, 25, 13);

		turret(
			walls,
			details,
			rng,
			side * WING_OUTER_X,
			FACADE_Z - 1,
			2.2,
			17,
			9.5,
		);

		lamp.position.set(side * (DOOR_HALF_WIDTH + 1.2), 3.2, ENTRANCE_Z + 0.05);
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
