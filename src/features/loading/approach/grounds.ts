import { SeededRandom } from "@shared/random";
import * as THREE from "three";
import type { ModelKit } from "../../models/modelKit";
import {
	meterBox,
	meterCylinder,
	placed,
	scaleUv,
} from "../../world/geometryUtils";
import type {
	MaterialLibrary,
	MaterialOptions,
} from "../../world/MaterialLibrary";
import { Batch, box, fitted, mushroomCap, segment } from "./geometry";
import { FACADE_Z, GATE_Z, START_Z, TOWER_FRONT_Z } from "./layout";
import {
	BARK,
	GLOWING_CAPS,
	GRAVE,
	IRON,
	LAWN,
	MENHIR,
	MUSHROOM_STEM,
	PATH,
	RUNE_GLOW,
	TRIM,
} from "./palette";

const GROUNDS_SEED = 2207;
const MIST_COUNT = 16;
const MIST_COLOR = 0xa592e0;

const TREES: readonly [number, number, number][] = [
	[-6.5, -5, 7],
	[7.5, -3, 6],
	[-15, -13, 9],
	[16, -16, 8.5],
	[-22, -22, 10],
	[23, -25, 9],
	[-4.6, 9, 9],
	[11, 7, 6],
];

const MENHIRS: readonly [number, number, number][] = [
	[-2.6, -4, 2.3],
	[2.7, -6.5, 2.0],
	[-2.8, -11.5, 2.6],
	[2.9, -14, 2.2],
];

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
];

const FAIRY_RING = { x: 7.2, z: -10.5, radius: 2.1 };

export interface GroundParts {
	statics: THREE.Group[];
	gates: THREE.Object3D[];
	mist: THREE.Sprite[];
	glowSpots: THREE.Vector3[];
}

function deadTree(
	batch: Batch,
	rng: SeededRandom,
	x: number,
	z: number,
	height: number,
): void {
	const grow = (
		from: THREE.Vector3,
		direction: THREE.Vector3,
		length: number,
		radius: number,
		depth: number,
	) => {
		const to = from.clone().addScaledVector(direction, length);

		batch.add(BARK, segment(from, to, radius, radius * 0.62));

		if (depth === 0) {
			return;
		}

		const children = depth === 3 ? 3 : rng.int(2, 3);

		for (let index = 0; index < children; index += 1) {
			const azimuth = rng.range(0, Math.PI * 2);
			const tilt = rng.range(0.35, 0.85);
			const side = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));

			const next = direction
				.clone()
				.multiplyScalar(Math.cos(tilt))
				.addScaledVector(side, Math.sin(tilt))
				.normalize();

			const start = from.clone().lerp(to, rng.range(0.55, 1));

			grow(start, next, length * rng.range(0.5, 0.7), radius * 0.6, depth - 1);
		}
	};

	const lean = new THREE.Vector3(
		rng.range(-0.15, 0.15),
		1,
		rng.range(-0.15, 0.15),
	).normalize();

	grow(new THREE.Vector3(x, -0.2, z), lean, height * 0.55, height * 0.06, 3);
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

function menhir(
	stones: Batch,
	runes: Batch,
	rng: SeededRandom,
	x: number,
	z: number,
	height: number,
): void {
	const width = height * 0.32;
	const facing = Math.atan2(-x, 0.0001);
	const stone = meterBox(width, height, width * 0.7);
	const position = stone.getAttribute("position") as THREE.BufferAttribute;

	for (let index = 0; index < position.count; index += 1) {
		const rise = position.getY(index) / height + 0.5;
		const taper = 1 - rise * 0.35;

		position.setXYZ(
			index,
			position.getX(index) * taper,
			position.getY(index),
			position.getZ(index) * taper,
		);
	}

	stone.computeVertexNormals();

	stones.add(
		MENHIR,
		placed(stone, x, height / 2 - 0.1, z, facing, 0, rng.range(-0.08, 0.08)),
	);

	const face = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));

	for (let glyph = 0; glyph < 4; glyph += 1) {
		const y = height * (0.3 + glyph * 0.15);
		const inset = (width * 0.7 * (1 - (y / height) * 0.35)) / 2 + 0.01;

		for (let stroke = 0; stroke < 2; stroke += 1) {
			runes.add(
				RUNE_GLOW,
				placed(
					meterBox(0.035, rng.range(0.12, 0.2), 0.01),
					x + face.x * inset + rng.range(-0.05, 0.05),
					y,
					z + face.z * inset,
					facing,
					0,
					rng.pick([0, Math.PI / 4, -Math.PI / 4]),
				),
			);
		}
	}
}

function glowingMushroom(
	batch: Batch,
	cap: MaterialOptions,
	x: number,
	z: number,
	height: number,
): void {
	const capRadius = height * 0.42;

	batch.add(
		MUSHROOM_STEM,
		placed(
			meterCylinder(capRadius * 0.2, capRadius * 0.28, height, 7),
			x,
			height / 2,
			z,
		),
	);

	batch.add(cap, placed(mushroomCap(capRadius), x, height, z));
}

function mushroomPatch(
	batch: Batch,
	rng: SeededRandom,
	x: number,
	z: number,
	size: number,
): void {
	const cap = rng.pick(GLOWING_CAPS);
	const count = Math.round(4 + size * 5);

	for (let index = 0; index < count; index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const reach = Math.sqrt(rng.range(0, 1)) * size;

		glowingMushroom(
			batch,
			cap,
			x + Math.cos(angle) * reach,
			z + Math.sin(angle) * reach * 0.7,
			rng.range(0.12, 0.45) * (index === 0 ? 1.8 : 1),
		);
	}
}

function fairyRing(batch: Batch, rng: SeededRandom): void {
	const cap = GLOWING_CAPS[0];
	const count = 22;

	for (let index = 0; index < count; index += 1) {
		const angle = (index / count) * Math.PI * 2 + rng.range(-0.06, 0.06);
		const reach = FAIRY_RING.radius + rng.range(-0.15, 0.15);

		glowingMushroom(
			batch,
			cap,
			FAIRY_RING.x + Math.cos(angle) * reach,
			FAIRY_RING.z + Math.sin(angle) * reach,
			rng.range(0.12, 0.26),
		);
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

	const pathDepth = START_Z + 6 - TOWER_FRONT_Z;
	const pathZ = (START_Z + 6 + TOWER_FRONT_Z) / 2;

	ground.add(PATH, box(2.6, 0.06, pathDepth, 0, 0.03, pathZ));

	for (const side of [-1, 1]) {
		ground.add(TRIM, box(0.2, 0.12, pathDepth, side * 1.4, 0.06, pathZ));
	}

	const gates = [-1, 1].flatMap((side) =>
		fenceAndGate(scenery, materials, kit, side),
	);

	for (const [x, z, height] of TREES) {
		deadTree(scenery, rng, x, z, height);
	}

	for (let index = 0; index < 7; index += 1) {
		tombstone(scenery, rng, rng.range(-12, -5), rng.range(-15, -7));
	}

	for (let index = 0; index < 4; index += 1) {
		tombstone(scenery, rng, rng.range(5, 10), rng.range(-12, -7));
	}

	for (const [x, z, height] of MENHIRS) {
		menhir(scenery, glow, rng, x, z, height);
	}

	for (const [x, z, size] of MUSHROOM_PATCHES) {
		mushroomPatch(glow, rng, x, z, size);
	}

	fairyRing(glow, rng);

	for (let x = -8; x <= 8; x += 1.6) {
		glowingMushroom(
			glow,
			GLOWING_CAPS[1],
			x + rng.range(-0.3, 0.3),
			FACADE_Z + 0.6,
			rng.range(0.18, 0.5),
		);
	}

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
		],
		gates,
		mist: mistSprites(rng, mistTexture),
		glowSpots,
	};
}
