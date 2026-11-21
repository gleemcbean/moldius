import { SeededRandom } from "@shared/random";
import * as THREE from "three";
import type { ModelKit } from "../../models/modelKit";
import {
	meterBox,
	meterCylinder,
	placed,
	scaleUv,
} from "../../world/geometryUtils";
import type { MaterialLibrary } from "../../world/MaterialLibrary";
import { buildForest } from "./forest";
import { mushroom, mushroomPatch } from "./fungi";
import { Batch, box, fitted } from "./geometry";
import {
	ENTRANCE_Z,
	FACADE_Z,
	FAIRY_RING,
	GATE_Z,
	GRAVEYARDS,
	START_Z,
} from "./layout";
import { GLOWING_CAPS, GRAVE, IRON, LAWN, PATH, TRIM } from "./palette";

const GROUNDS_SEED = 2207;
const MIST_COUNT = 16;
const MIST_COLOR = 0xa592e0;

const MUSHROOM_PATCHES: readonly [number, number, number][] = [
	[-3.2, -18.8, 1.2],
	[3.4, -19.2, 1.3],
	[-8.5, -20.5, 1.6],
	[9.2, -20.2, 1.5],
	[-6, -4.2, 0.9],
	[7, -2.4, 0.8],
	[-14.5, -12.3, 1.1],
	[2.2, 1.2, 0.6],
	[-2.1, -8.3, 0.7],
	[-4.6, -22.2, 0.8],
	[4.8, -22.4, 0.9],
	[-16.5, -25.5, 1.4],
	[17.5, -26, 1.3],
];

export interface GroundParts {
	statics: THREE.Group[];
	gates: THREE.Object3D[];
	mist: THREE.Sprite[];
	glowSpots: THREE.Vector3[];
}

function tombstone(
	batch: Batch,
	rng: SeededRandom,
	x: number,
	z: number,
): void {
	const width = rng.range(0.5, 0.75);
	const height = rng.range(0.55, 0.9);
	const tilt = rng.range(-0.12, 0.12);
	const turn = rng.range(-0.25, 0.25);
	const slab = meterBox(width, height, 0.14).translate(0, height / 2, 0);

	const top = new THREE.CylinderGeometry(
		width / 2,
		width / 2,
		0.14,
		12,
		1,
		false,
		0,
		Math.PI,
	);

	scaleUv(top, width * 1.6, 0.14);

	top
		.rotateX(Math.PI / 2)
		.rotateZ(Math.PI / 2)
		.translate(0, height, 0);

	for (const geometry of [slab, top]) {
		batch.add(GRAVE, placed(geometry, x, -0.05, z, turn, 0, tilt));
	}
}

function fairyRing(batch: Batch, rng: SeededRandom): void {
	const cap = GLOWING_CAPS[0];
	const count = 22;

	for (let index = 0; index < count; index += 1) {
		const angle = (index / count) * Math.PI * 2 + rng.range(-0.06, 0.06);
		const reach = FAIRY_RING.radius + rng.range(-0.15, 0.15);

		mushroom(
			batch,
			cap,
			FAIRY_RING.x + Math.cos(angle) * reach,
			0,
			FAIRY_RING.z + Math.sin(angle) * reach,
			rng.range(0.12, 0.26),
		);
	}
}

function facadeMushrooms(batch: Batch, rng: SeededRandom): void {
	for (const side of [-1, 1]) {
		for (let x = 7; x <= 15.5; x += 1.4) {
			mushroom(
				batch,
				GLOWING_CAPS[1],
				side * (x + rng.range(-0.3, 0.3)),
				0,
				FACADE_Z + 1.9 + rng.range(-0.2, 0.2),
				rng.range(0.18, 0.5),
			);
		}

		for (let z = ENTRANCE_Z - 1.5; z > FACADE_Z + 0.5; z -= 1.3) {
			mushroom(
				batch,
				GLOWING_CAPS[1],
				side * (6.8 + rng.range(-0.2, 0.2)),
				0,
				z + rng.range(-0.3, 0.3),
				rng.range(0.18, 0.45),
			);
		}
	}
}

function fenceAndGate(
	fence: Batch,
	materials: MaterialLibrary,
	kit: ModelKit,
	side: number,
): THREE.Object3D[] {
	fence.add(TRIM, box(0.7, 2.4, 0.7, side * 1.9, 1.2, GATE_Z));
	fence.add(TRIM, box(0.9, 0.2, 0.9, side * 1.9, 2.5, GATE_Z));

	for (let x = 2.5; x < 26; x += 0.55) {
		fence.add(IRON, box(0.05, 1.5, 0.05, side * x, 0.75, GATE_Z));

		fence.add(
			IRON,
			placed(meterCylinder(0, 0.06, 0.2, 5), side * x, 1.6, GATE_Z),
		);
	}

	for (const height of [0.3, 1.3]) {
		fence.add(IRON, box(23.6, 0.06, 0.06, side * 14.2, height, GATE_Z));
	}

	const gate = new THREE.Group();
	const iron = materials.get(IRON);

	for (let x = 0.15; x < 1.5; x += 0.22) {
		gate.add(
			new THREE.Mesh(
				meterBox(0.05, 1.9, 0.05).translate(-side * x, 0.95, 0),
				iron,
			),
		);
	}

	for (const height of [0.35, 1.6]) {
		gate.add(
			new THREE.Mesh(
				meterBox(1.5, 0.06, 0.06).translate(-side * 0.78, height, 0),
				iron,
			),
		);
	}

	gate.position.set(side * 1.55, 0, GATE_Z);

	gate.rotation.y = side * -1.5;

	const urn = fitted(kit.model("furniture/urn"), 0.8);

	urn.position.set(side * 1.9, 2.6, GATE_Z);

	return [gate, urn];
}

function mistSprites(
	rng: SeededRandom,
	texture: THREE.Texture,
): THREE.Sprite[] {
	const sprites: THREE.Sprite[] = [];

	for (let index = 0; index < MIST_COUNT; index += 1) {
		const sprite = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: texture,
				color: MIST_COLOR,
				transparent: true,
				opacity: rng.range(0.07, 0.15),
				depthWrite: false,
			}),
		);

		const scale = rng.range(7, 14);

		sprite.scale.set(scale, scale * 0.35, 1);

		sprite.position.set(
			rng.range(-20, 20),
			rng.range(0.3, 1.1),
			rng.range(-24, 6),
		);

		sprite.userData.drift = rng.range(-0.25, 0.25);

		sprites.push(sprite);
	}

	return sprites;
}

export function buildGrounds(
	materials: MaterialLibrary,
	kit: ModelKit,
	mistTexture: THREE.Texture,
): GroundParts {
	const rng = new SeededRandom(GROUNDS_SEED);
	const ground = new Batch();
	const scenery = new Batch();
	const glow = new Batch();
	const lawn = scaleUv(new THREE.PlaneGeometry(240, 240), 240, 240);

	lawn.rotateX(-Math.PI / 2);
	ground.add(LAWN, lawn);

	const pathDepth = START_Z + 6 - ENTRANCE_Z;
	const pathZ = (START_Z + 6 + ENTRANCE_Z) / 2;

	ground.add(PATH, box(2.6, 0.06, pathDepth, 0, 0.03, pathZ));

	for (const side of [-1, 1]) {
		ground.add(TRIM, box(0.2, 0.12, pathDepth, side * 1.4, 0.06, pathZ));
	}

	const gates = [-1, 1].flatMap((side) =>
		fenceAndGate(scenery, materials, kit, side),
	);

	for (const yard of GRAVEYARDS) {
		for (let index = 0; index < yard.stones; index += 1) {
			tombstone(
				scenery,
				rng,
				rng.range(yard.minX, yard.maxX),
				rng.range(yard.minZ, yard.maxZ),
			);
		}
	}

	for (const [x, z, size] of MUSHROOM_PATCHES) {
		mushroomPatch(glow, rng, x, z, size);
	}

	fairyRing(glow, rng);
	facadeMushrooms(glow, rng);

	const glowSpots = [
		new THREE.Vector3(-3.2, 0.6, -18.8),
		new THREE.Vector3(3.4, 0.6, -19.2),
		new THREE.Vector3(FAIRY_RING.x, 0.5, FAIRY_RING.z),
	];

	return {
		statics: [
			ground.build(materials, false, true),
			scenery.build(materials, true, true),
			glow.build(materials, false, false),
			...buildForest(materials),
		],
		gates,
		mist: mistSprites(rng, mistTexture),
		glowSpots,
	};
}
