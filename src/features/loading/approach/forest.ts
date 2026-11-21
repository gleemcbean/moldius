import { SeededRandom } from "@shared/random";
import * as THREE from "three";
import {
	meterCircle,
	meterCylinder,
	meterSphere,
	placed,
} from "../../world/geometryUtils";
import type {
	MaterialLibrary,
	MaterialOptions,
} from "../../world/MaterialLibrary";
import { mushroom, mushroomPatch, pickPolypore, polypore } from "./fungi";
import { Batch, taperedTube } from "./geometry";
import { giantCluster } from "./giants";
import {
	CAMERA_TRAIL,
	ENTRANCE_Z,
	FACADE_Z,
	FAIRY_RING,
	GATE_Z,
	GRAVEYARDS,
	MAIN_Z,
	MANOR_HALF_WIDTH,
	PORCH_Z,
	START_Z,
} from "./layout";
import {
	BARK,
	BASALT,
	DEADWOOD,
	EARTH,
	EARTHY_CAPS,
	GLOWING_CAPS,
	GRAVE,
	HEARTWOOD,
	LICHEN,
	MOSS,
} from "./palette";

type Detail = "near" | "mid" | "far";

interface Grove {
	rng: SeededRandom;
	wood: Batch;
	growth: Batch;
	glow: Batch;
}

interface Stem {
	points: THREE.Vector3[];
	radii: number[];
}

interface Plot {
	x: number;
	z: number;
	room: number;
}

const FOREST_SEED = 3301;
const CELL_SIZE = 30;
const COARSE_GIANT_DISTANCE = 24;
const WILD_TREES = 170;
const PLANTING_ATTEMPTS = 7000;
const LITTER_BRANCHES = 45;
const LITTER_ROCKS = 26;
const STRAY_PATCHES = 28;
const MIN_TWIG_RADIUS = 0.014;
const VIEW_X = 0.6;
const VIEW_START_Z = START_Z + CAMERA_TRAIL + 1;
const VIEW_END_Z = PORCH_Z + CAMERA_TRAIL;
const WIDE_VIEW = 1.3;
const UP = new THREE.Vector3(0, 1, 0);

const FRAMING_TREES: readonly [number, number, number][] = [
	[-6.8, 3.4, 13],
	[7.6, 2.9, 12],
	[-4.9, 7.4, 14],
	[5.8, 6.6, 12.5],
	[-10.2, 0.8, 15],
	[11.4, 0.4, 13.5],
	[-6.4, -4.6, 9.5],
	[7.4, -2.2, 8.5],
	[-13.5, -17.5, 11],
	[13.8, -15.5, 10.5],
];

const SNAGS: readonly [number, number, number][] = [
	[-4.2, -1.5, 5.2],
	[3.7, -8.2, 4.8],
	[-3.6, -14.6, 4.4],
	[12.4, -4, 6.5],
	[-15.5, -6, 7],
	[3.6, 4.4, 4.2],
];

const STUMPS: readonly [number, number][] = [
	[4.2, -4.6],
	[-3.5, -9.8],
	[3.5, -15.5],
	[-5.2, -19.2],
	[5.6, -20.4],
	[-3.8, 9.6],
];

const GIANTS: readonly [number, number, number, number][] = [
	[-15, -22, 12.5, 4.6],
	[18, -21, 10, 3.8],
	[-11, -2.6, 7.5, 3],
	[11.5, -8.5, 6.5, 2.6],
	[-22.5, -14, 8.5, 3.3],
	[5.2, 1, 3.8, 1.6],
	[-8.6, -24.2, 4.6, 2],
	[8.8, -24.6, 3.8, 1.7],
];

const LOGS: readonly [number, number, number, number][] = [
	[6.4, -0.6, 5.5, 0.35],
	[-6.2, 5.4, 6, -0.4],
	[-16, -12, 7, 1.2],
	[15.5, -9.5, 6.5, -0.9],
];

function wander(
	rng: SeededRandom,
	start: THREE.Vector3,
	direction: THREE.Vector3,
	length: number,
	steps: number,
	wobble: number,
	lift: number,
): THREE.Vector3[] {
	const heading = direction.clone().normalize();
	const points = [start.clone()];

	for (let index = 0; index < steps; index += 1) {
		heading.x += rng.range(-wobble, wobble);
		heading.y += rng.range(-wobble, wobble) + lift;
		heading.z += rng.range(-wobble, wobble);

		heading.normalize();
		points.push(points[index].clone().addScaledVector(heading, length / steps));
	}

	return points;
}

function tapered(
	points: readonly THREE.Vector3[],
	from: number,
	to: number,
): number[] {
	return points.map((_, index) =>
		THREE.MathUtils.lerp(from, to, index / (points.length - 1)),
	);
}

function stemLength(stem: Stem): number {
	let length = 0;

	for (let index = 1; index < stem.points.length; index += 1) {
		length += stem.points[index].distanceTo(stem.points[index - 1]);
	}

	return length;
}

function along(
	stem: Stem,
	t: number,
): { point: THREE.Vector3; radius: number; direction: THREE.Vector3 } {
	const scaled = THREE.MathUtils.clamp(t, 0, 1) * (stem.points.length - 1);
	const index = Math.min(stem.points.length - 2, Math.floor(scaled));
	const local = scaled - index;
	const from = stem.points[index];
	const to = stem.points[index + 1];

	return {
		point: from.clone().lerp(to, local),
		radius: THREE.MathUtils.lerp(
			stem.radii[index],
			stem.radii[index + 1],
			local,
		),
		direction: to.clone().sub(from).normalize(),
	};
}

function splay(
	rng: SeededRandom,
	direction: THREE.Vector3,
	angle: number,
): THREE.Vector3 {
	const side = new THREE.Vector3(
		rng.range(-1, 1),
		rng.range(-1, 1),
		rng.range(-1, 1),
	);

	side.addScaledVector(direction, -side.dot(direction));

	if (side.lengthSq() < 1e-4) {
		side.set(1, 0, 0);
	}

	side.normalize();

	return direction
		.clone()
		.multiplyScalar(Math.cos(angle))
		.addScaledVector(side, Math.sin(angle))
		.normalize();
}

function viewerYaw(x: number, z: number): number {
	const targetZ = THREE.MathUtils.clamp(z + 6, VIEW_END_Z, VIEW_START_Z);

	return Math.atan2(VIEW_X - x, targetZ - z);
}

function pathDistance(x: number, z: number): number {
	return Math.hypot(
		x - VIEW_X,
		z - THREE.MathUtils.clamp(z, VIEW_END_Z, VIEW_START_Z),
	);
}

function visible(x: number, z: number, margin: number): boolean {
	const depth = VIEW_START_Z - z;

	return depth > -margin && Math.abs(x - VIEW_X) < depth * WIDE_VIEW + margin;
}

function inClearing(x: number, z: number): boolean {
	if (Math.abs(x) < 3.6 && z > ENTRANCE_Z - 1) {
		return true;
	}

	if (z < FACADE_Z + 9 && Math.abs(x) < MANOR_HALF_WIDTH + 1) {
		return true;
	}

	if (Math.abs(z - GATE_Z) < 1 && Math.abs(x) < 27) {
		return true;
	}

	if (Math.hypot(x - FAIRY_RING.x, z - FAIRY_RING.z) < FAIRY_RING.radius + 2) {
		return true;
	}

	return GRAVEYARDS.some(
		(yard) =>
			x > yard.minX - 1.5 &&
			x < yard.maxX + 1.5 &&
			z > yard.minZ - 1.5 &&
			z < yard.maxZ + 1.5,
	);
}

function blocksWay(x: number, z: number): boolean {
	if (Math.abs(x) < 2.4 && z > ENTRANCE_Z - 1) {
		return true;
	}

	if (Math.abs(x) < 7 && z < ENTRANCE_Z + 0.6 && z > MAIN_Z) {
		return true;
	}

	return z < FACADE_Z + 0.5 && Math.abs(x) < MANOR_HALF_WIDTH;
}

function giant(
	grove: Grove,
	x: number,
	z: number,
	height: number,
	radius: number,
): void {
	giantCluster(
		{ solid: grove.wood, soft: grove.growth },
		grove.rng,
		x,
		z,
		height,
		radius,
		blocksWay,
		pathDistance(x, z) > COARSE_GIANT_DISTANCE,
	);
}

function inLawn(x: number, z: number): boolean {
	return z < GATE_Z && Math.abs(x) < 13 + (GATE_Z - z) * 0.35;
}

function lichen(grove: Grove, top: THREE.Vector3): void {
	const { rng } = grove;
	const strands = rng.int(3, 6);

	for (let index = 0; index < strands; index += 1) {
		const length = rng.range(0.25, 0.95);

		grove.growth.add(
			LICHEN,
			placed(
				meterCylinder(0.03, 0.005, length, 3, true),
				top.x + rng.range(-0.12, 0.12),
				top.y - length / 2,
				top.z + rng.range(-0.12, 0.12),
			),
		);
	}
}

function mossCushion(grove: Grove, at: THREE.Vector3, size: number): void {
	const { rng } = grove;

	grove.wood.add(
		MOSS,
		placed(
			meterSphere(size, 7, 4).scale(
				rng.range(1, 1.5),
				0.38,
				rng.range(0.8, 1.2),
			),
			at.x,
			at.y,
			at.z,
			rng.range(0, Math.PI),
		),
	);
}

function shelfCluster(
	grove: Grove,
	stem: Stem,
	t: number,
	yaw: number,
	scale: number,
): void {
	const { rng } = grove;
	const style = pickPolypore(rng);
	const span = stemLength(stem);
	const shelves = rng.int(style.shelves[0], style.shelves[1]);
	let lift = 0;
	let angle = yaw;
	let size = rng.range(0.7, 1.1) * scale;

	for (let index = 0; index < shelves; index += 1) {
		const spot = along(stem, t + lift / span);
		const outward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

		const radius = THREE.MathUtils.clamp(
			spot.radius * style.size * size,
			0.06,
			0.38,
		);

		const center = spot.point.addScaledVector(outward, spot.radius * 0.72);

		polypore(
			grove.growth,
			style,
			center,
			outward,
			radius,
			rng.range(-0.12, 0.1),
		);

		lift += radius * rng.range(0.45, 0.8);
		angle += rng.range(0.25, 0.55) * (rng.chance(0.5) ? 1 : -1);
		size *= rng.range(0.75, 0.95);
	}
}

function basePatch(
	grove: Grove,
	x: number,
	z: number,
	radius: number,
	yaw: number,
): void {
	const { rng } = grove;
	const reach = radius * 1.8 + 0.25;
	const angle = yaw + rng.range(-0.8, 0.8);
	const px = x + Math.sin(angle) * reach;
	const pz = z + Math.cos(angle) * reach;

	if (rng.chance(0.65)) {
		mushroomPatch(grove.glow, rng, px, pz, rng.range(0.3, 0.7));
	} else {
		mushroomPatch(
			grove.growth,
			rng,
			px,
			pz,
			rng.range(0.25, 0.55),
			EARTHY_CAPS,
		);
	}
}

function branch(
	grove: Grove,
	wood: MaterialOptions,
	start: THREE.Vector3,
	direction: THREE.Vector3,
	length: number,
	radius: number,
	depth: number,
	detail: Detail,
): void {
	const { rng } = grove;

	const points = wander(
		rng,
		start,
		direction,
		length,
		detail === "far" ? 2 : 3,
		0.24,
		depth > 0 ? 0.05 : -0.03,
	);

	const radii = tapered(points, radius, radius * 0.45);
	const stem = { points, radii };

	grove.wood.add(wood, taperedTube(points, radii, detail === "far" ? 4 : 5));

	if (depth === 0 || radius * 0.6 < MIN_TWIG_RADIUS) {
		if (detail !== "far" && rng.chance(detail === "near" ? 0.3 : 0.08)) {
			lichen(grove, along(stem, rng.range(0.4, 0.8)).point);
		}

		return;
	}

	const children = depth > 1 ? rng.int(2, 3) : rng.int(1, 3);

	for (let index = 0; index < children; index += 1) {
		const fork = along(stem, rng.range(0.4, 1));

		branch(
			grove,
			wood,
			fork.point,
			splay(rng, fork.direction, rng.range(0.35, 0.9)),
			length * rng.range(0.55, 0.75),
			fork.radius * 0.75,
			depth - 1,
			detail,
		);
	}
}

function roots(
	grove: Grove,
	wood: MaterialOptions,
	base: THREE.Vector3,
	radius: number,
	count: number,
): void {
	const { rng } = grove;
	const offset = rng.range(0, Math.PI * 2);

	for (let index = 0; index < count; index += 1) {
		const angle = offset + (index / count) * Math.PI * 2 + rng.range(-0.3, 0.3);
		const out = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
		const reach = radius * rng.range(2.2, 3.4);
		const rise = radius * rng.range(0.9, 1.6);

		const points = [
			base
				.clone()
				.setY(rise)
				.addScaledVector(out, radius * 0.3),
			base
				.clone()
				.setY(rise * 0.4)
				.addScaledVector(out, radius * 1.2),
			base
				.clone()
				.setY(0.02)
				.addScaledVector(out, reach * 0.7),
			base.clone().setY(-0.2).addScaledVector(out, reach),
		];

		grove.wood.add(
			wood,
			taperedTube(
				points,
				[radius * 0.6, radius * 0.4, radius * 0.2, radius * 0.08],
				5,
			),
		);
	}
}

function splinters(
	grove: Grove,
	wood: MaterialOptions,
	top: THREE.Vector3,
	radius: number,
): void {
	const { rng } = grove;
	const count = rng.int(3, 5);
	const offset = rng.range(0, Math.PI * 2);

	grove.wood.add(
		HEARTWOOD,
		placed(
			meterCircle(radius * 0.92, 10).rotateX(-Math.PI / 2),
			top.x,
			top.y - radius * 0.3,
			top.z,
		),
	);

	for (let index = 0; index < count; index += 1) {
		const angle = offset + (index / count) * Math.PI * 2 + rng.range(-0.3, 0.3);
		const height = radius * rng.range(0.6, 1.9);
		const lean = rng.range(0.08, 0.3);

		grove.wood.add(
			wood,
			placed(
				meterCylinder(0, radius * rng.range(0.22, 0.4), height, 4).rotateY(
					rng.range(0, Math.PI),
				),
				top.x + Math.cos(angle) * radius * 0.62,
				top.y + height / 2 - radius * 0.35,
				top.z + Math.sin(angle) * radius * 0.62,
				0,
				Math.sin(angle) * lean,
				-Math.cos(angle) * lean,
			),
		);
	}
}

function trunkGrowth(
	grove: Grove,
	trunk: Stem,
	x: number,
	z: number,
	clusters: number,
	reach: number,
	scale: number,
): void {
	const { rng } = grove;
	const yaw = viewerYaw(x, z);

	for (let index = 0; index < clusters; index += 1) {
		shelfCluster(
			grove,
			trunk,
			rng.range(0.04, reach),
			yaw + rng.range(-1.5, 1.5),
			scale,
		);
	}

	if (rng.chance(0.5)) {
		mossCushion(
			grove,
			trunk.points[0].clone().setY(0.15),
			trunk.radii[0] * 1.1,
		);
	}

	if (rng.chance(0.6)) {
		basePatch(grove, x, z, trunk.radii[0], yaw);
	}
}

function deadTree(
	grove: Grove,
	x: number,
	z: number,
	height: number,
	detail: Detail,
): void {
	const { rng } = grove;
	const wood = rng.chance(0.3) ? DEADWOOD : BARK;
	const radius = height * rng.range(0.032, 0.046);

	const lean = new THREE.Vector3(
		rng.range(-0.16, 0.16),
		1,
		rng.range(-0.16, 0.16),
	).normalize();

	const points = wander(
		rng,
		new THREE.Vector3(x, -0.3, z),
		lean,
		height * rng.range(0.48, 0.62),
		detail === "far" ? 3 : 5,
		0.07,
		0.01,
	);

	const radii = tapered(points, radius, radius * 0.6);

	radii[0] *= 1.3;

	const trunk = { points, radii };
	const depth = detail === "near" ? 3 : 2;
	const limbs = rng.int(2, 4);

	grove.wood.add(wood, taperedTube(points, radii, detail === "far" ? 5 : 7));

	for (let index = 0; index < limbs; index += 1) {
		const leader = index === 0;
		const fork = along(trunk, leader ? 1 : rng.range(0.72, 0.98));

		branch(
			grove,
			wood,
			fork.point,
			splay(rng, lean, leader ? rng.range(0.1, 0.3) : rng.range(0.4, 0.9)),
			height * (leader ? rng.range(0.32, 0.42) : rng.range(0.26, 0.38)),
			fork.radius * (leader ? 0.95 : 0.75),
			depth,
			detail,
		);
	}

	if (detail === "far") {
		return;
	}

	roots(grove, wood, points[0], radius, detail === "near" ? rng.int(4, 6) : 3);

	for (let index = rng.int(1, 3); index > 0; index -= 1) {
		const fork = along(trunk, rng.range(0.3, 0.7));

		branch(
			grove,
			wood,
			fork.point,
			splay(rng, lean, rng.range(1.1, 1.6)),
			rng.range(0.5, 1.6),
			fork.radius * 0.4,
			0,
			detail,
		);
	}

	trunkGrowth(
		grove,
		trunk,
		x,
		z,
		detail === "near" ? rng.int(2, 4) : rng.int(1, 2),
		0.6,
		1,
	);
}

function snag(
	grove: Grove,
	x: number,
	z: number,
	height: number,
	detail: Detail,
): void {
	const { rng } = grove;
	const wood = rng.chance(0.5) ? DEADWOOD : BARK;
	const radius = rng.range(0.22, 0.4);

	const lean = new THREE.Vector3(
		rng.range(-0.1, 0.1),
		1,
		rng.range(-0.1, 0.1),
	).normalize();

	const points = wander(
		rng,
		new THREE.Vector3(x, -0.3, z),
		lean,
		height,
		4,
		0.05,
		0,
	);

	const radii = tapered(points, radius * 1.25, radius * 0.8);
	const trunk = { points, radii };

	grove.wood.add(wood, taperedTube(points, radii, 7));
	splinters(grove, wood, points[points.length - 1], radii[radii.length - 1]);

	if (detail === "far") {
		return;
	}

	roots(grove, wood, points[0], radius, rng.int(3, 5));

	for (let index = rng.int(1, 2); index > 0; index -= 1) {
		const fork = along(trunk, rng.range(0.4, 0.85));

		branch(
			grove,
			wood,
			fork.point,
			splay(rng, lean, rng.range(0.9, 1.4)),
			rng.range(0.4, 1.2),
			fork.radius * 0.35,
			0,
			detail,
		);
	}

	trunkGrowth(
		grove,
		trunk,
		x,
		z,
		detail === "near" ? rng.int(3, 5) : rng.int(1, 3),
		0.85,
		1.1,
	);
}

function stump(grove: Grove, x: number, z: number): void {
	const { rng } = grove;
	const wood = rng.chance(0.5) ? DEADWOOD : BARK;
	const radius = rng.range(0.3, 0.55);
	const height = rng.range(0.5, 1.4);

	const points = [
		new THREE.Vector3(x, -0.2, z),
		new THREE.Vector3(
			x + rng.range(-0.05, 0.05),
			height * 0.5,
			z + rng.range(-0.05, 0.05),
		),
		new THREE.Vector3(
			x + rng.range(-0.08, 0.08),
			height,
			z + rng.range(-0.08, 0.08),
		),
	];

	const radii = [radius * 1.25, radius * 1.05, radius];
	const trunk = { points, radii };

	grove.wood.add(wood, taperedTube(points, radii, 8));
	splinters(grove, wood, points[2], radius);
	roots(grove, wood, points[0], radius, rng.int(4, 5));

	mossCushion(
		grove,
		points[2].clone().setY(height - radius * 0.28),
		radius * 0.5,
	);

	trunkGrowth(grove, trunk, x, z, rng.int(1, 3), 0.75, 1.2);
}

function fallenLog(
	grove: Grove,
	x: number,
	z: number,
	length: number,
	angle: number,
): void {
	const { rng } = grove;
	const wood = rng.chance(0.6) ? DEADWOOD : BARK;
	const radius = rng.range(0.25, 0.45);
	const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
	const side = new THREE.Vector3(-direction.z, 0, direction.x);

	const start = new THREE.Vector3(x, radius * 0.72, z).addScaledVector(
		direction,
		-length / 2,
	);

	const points = Array.from({ length: 5 }, (_, index) =>
		start
			.clone()
			.addScaledVector(direction, (length * index) / 4)
			.addScaledVector(side, rng.range(-0.12, 0.12))
			.setY(radius * 0.72 + rng.range(-0.04, 0.04)),
	);

	const radii = tapered(points, radius, radius * 0.78);
	const log = { points, radii };
	const yaw = Math.atan2(direction.x, direction.z);
	const end = points[points.length - 1];

	grove.wood.add(wood, taperedTube(points, radii, 8));

	grove.wood.add(
		HEARTWOOD,
		placed(
			meterCircle(radii[radii.length - 1] * 0.96, 12),
			end.x,
			end.y,
			end.z,
			yaw,
		),
	);

	grove.wood.add(
		EARTH,
		placed(
			meterSphere(radius * 1.9, 9, 6).scale(1, 1, 0.3),
			start.x - direction.x * 0.15,
			radius * 1.3,
			start.z - direction.z * 0.15,
			yaw,
		),
	);

	for (let index = 0; index < 7; index += 1) {
		const spread = -0.5 + (index / 6) * (Math.PI + 1) + rng.range(-0.15, 0.15);
		const reach = radius * rng.range(2.6, 3.6);

		const out = side
			.clone()
			.multiplyScalar(Math.cos(spread))
			.addScaledVector(UP, Math.sin(spread));

		const rootPoints = wander(
			rng,
			start.clone().addScaledVector(direction, -0.1),
			out.addScaledVector(direction, -0.35).normalize(),
			reach,
			3,
			0.3,
			0,
		);

		grove.wood.add(
			wood,
			taperedTube(
				rootPoints,
				tapered(rootPoints, radius * 0.3, radius * 0.04),
				5,
			),
		);
	}

	for (let index = rng.int(1, 2); index > 0; index -= 1) {
		const fork = along(log, rng.range(0.35, 0.9));

		branch(
			grove,
			wood,
			fork.point,
			splay(rng, UP, rng.range(0.3, 0.7)),
			rng.range(0.4, 1.1),
			fork.radius * 0.35,
			0,
			"near",
		);
	}

	const facing =
		side.dot(new THREE.Vector3(VIEW_X - x, 0, VIEW_START_Z - z)) > 0 ? 1 : -1;

	const shelfYaw = Math.atan2(side.x * facing, side.z * facing);

	for (let index = rng.int(2, 4); index > 0; index -= 1) {
		const t = rng.range(0.15, 0.85);
		const spot = along(log, t);
		const style = pickPolypore(rng);
		const shelves = rng.int(style.shelves[0], style.shelves[1]);

		for (let shelf = 0; shelf < shelves; shelf += 1) {
			const turn = shelfYaw + rng.range(-0.3, 0.3);
			const outward = new THREE.Vector3(Math.sin(turn), 0, Math.cos(turn));

			const center = spot.point
				.clone()
				.addScaledVector(outward, spot.radius * 0.72)
				.addScaledVector(direction, rng.range(-0.35, 0.35));

			center.y += rng.range(-0.25, 0.35) * spot.radius;

			polypore(
				grove.growth,
				style,
				center,
				outward,
				THREE.MathUtils.clamp(
					spot.radius * rng.range(0.5, 0.9) * style.size,
					0.05,
					0.35,
				),
				rng.range(-0.1, 0.1),
			);
		}
	}

	for (let index = rng.int(2, 3); index > 0; index -= 1) {
		const spot = along(log, rng.range(0.1, 0.9));

		mossCushion(
			grove,
			spot.point.clone().setY(spot.point.y + spot.radius * 0.85),
			spot.radius * 0.6,
		);
	}

	for (let index = rng.int(2, 4); index > 0; index -= 1) {
		const spot = along(log, rng.range(0.2, 0.8));

		mushroom(
			grove.glow,
			rng.pick(GLOWING_CAPS),
			spot.point.x + rng.range(-0.1, 0.1),
			spot.point.y + spot.radius * 0.82,
			spot.point.z + rng.range(-0.1, 0.1),
			rng.range(0.1, 0.22),
		);
	}

	const patch = along(log, rng.range(0.3, 0.7)).point.addScaledVector(
		side,
		facing * (radius + 0.45),
	);

	mushroomPatch(grove.glow, rng, patch.x, patch.z, rng.range(0.35, 0.6));
}

function fallenBranch(grove: Grove, x: number, z: number): void {
	const { rng } = grove;
	const radius = rng.range(0.035, 0.08);
	const angle = rng.range(0, Math.PI * 2);
	const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
	const wood = rng.chance(0.5) ? DEADWOOD : BARK;

	const points = wander(
		rng,
		new THREE.Vector3(x, 0, z),
		direction,
		rng.range(1, 2.8),
		3,
		0.14,
		0,
	).map((point) => point.setY(radius * 0.7));

	const stem = { points, radii: tapered(points, radius, radius * 0.5) };
	const fork = along(stem, rng.range(0.3, 0.7));

	const twig = [
		fork.point,
		fork.point
			.clone()
			.addScaledVector(
				splay(rng, fork.direction, rng.range(0.5, 0.9)).setY(0).normalize(),
				rng.range(0.4, 0.9),
			)
			.setY(radius * 0.5),
	];

	grove.wood.add(wood, taperedTube(points, stem.radii, 4));

	grove.wood.add(
		wood,
		taperedTube(twig, [fork.radius * 0.6, fork.radius * 0.3], 4),
	);
}

function rock(grove: Grove, x: number, z: number, size: number): void {
	const { rng } = grove;

	const geometry = meterSphere(size, 6, 4).scale(
		rng.range(0.9, 1.4),
		rng.range(0.45, 0.75),
		rng.range(0.8, 1.2),
	);

	grove.wood.add(
		rng.chance(0.5) ? GRAVE : BASALT,
		placed(
			geometry,
			x,
			size * 0.12,
			z,
			rng.range(0, Math.PI),
			rng.range(-0.2, 0.2),
			rng.range(-0.2, 0.2),
		),
	);
}

function plantFeatures(grove: Grove): void {
	for (const [x, z, height] of FRAMING_TREES) {
		deadTree(grove, x, z, height, "near");
	}

	for (const [x, z, height] of SNAGS) {
		snag(grove, x, z, height, "near");
	}

	for (const [x, z] of STUMPS) {
		stump(grove, x, z);
	}

	for (const [x, z, length, angle] of LOGS) {
		fallenLog(grove, x, z, length, angle);
	}

	for (const [x, z, height, radius] of GIANTS) {
		giant(grove, x, z, height, radius);
	}
}

function plantWilds(grove: Grove): void {
	const { rng } = grove;

	const taken: Plot[] = [
		...FRAMING_TREES.map(([x, z]) => ({ x, z, room: 0 })),
		...SNAGS.map(([x, z]) => ({ x, z, room: 0 })),
		...STUMPS.map(([x, z]) => ({ x, z, room: 0 })),
		...LOGS.map(([x, z]) => ({ x, z, room: 0 })),
		...GIANTS.map(([x, z, , radius]) => ({ x, z, room: radius * 0.8 })),
	];

	let planted = 0;

	for (
		let attempt = 0;
		attempt < PLANTING_ATTEMPTS && planted < WILD_TREES;
		attempt += 1
	) {
		const x = rng.range(-75, 75);
		const z = rng.range(-95, VIEW_START_Z);

		if (!visible(x, z, 6) || inClearing(x, z) || inLawn(x, z)) {
			continue;
		}

		const distance = pathDistance(x, z);
		const spacing = distance < 20 ? 4.2 : distance < 40 ? 5.2 : 6.5;

		if (
			taken.some(
				(spot) => Math.hypot(spot.x - x, spot.z - z) < spacing + spot.room,
			)
		) {
			continue;
		}

		const detail: Detail =
			distance < 12 ? "near" : distance < 30 ? "mid" : "far";

		const roll = rng.next();
		const giantHeight = detail === "far" ? rng.range(9, 16) : rng.range(5, 10);
		const giantRadius = giantHeight * rng.range(0.32, 0.44);
		const towering = roll < (detail === "far" ? 0.16 : 0.1);

		taken.push({ x, z, room: towering ? giantRadius * 0.8 : 0 });

		planted += 1;

		if (towering) {
			giant(grove, x, z, giantHeight, giantRadius);
		} else if (detail === "far") {
			if (roll < 0.9) {
				deadTree(grove, x, z, rng.range(11, 21), detail);
			} else {
				snag(grove, x, z, rng.range(5, 9), detail);
			}
		} else if (roll < 0.68) {
			deadTree(grove, x, z, rng.range(8, 15), detail);
		} else if (roll < 0.82) {
			snag(grove, x, z, rng.range(3, 8), detail);
		} else if (roll < 0.91) {
			stump(grove, x, z);
		} else {
			fallenLog(grove, x, z, rng.range(3.5, 7), rng.range(0, Math.PI));
		}
	}
}

function scatterLitter(grove: Grove): void {
	const { rng } = grove;

	const spot = (reach: number): { x: number; z: number } | null => {
		for (let attempt = 0; attempt < 40; attempt += 1) {
			const x = rng.range(-reach, reach);
			const z = rng.range(ENTRANCE_Z + 1, VIEW_START_Z - 1);

			if (visible(x, z, 0) && !inClearing(x, z) && pathDistance(x, z) < reach) {
				return { x, z };
			}
		}

		return null;
	};

	for (let index = 0; index < LITTER_BRANCHES; index += 1) {
		const at = spot(22);

		if (at) {
			fallenBranch(grove, at.x, at.z);
		}
	}

	for (let index = 0; index < LITTER_ROCKS; index += 1) {
		const at = spot(22);

		if (at) {
			rock(grove, at.x, at.z, rng.range(0.12, 0.45));
		}
	}

	for (let index = 0; index < STRAY_PATCHES; index += 1) {
		const at = spot(26);
		const glowing = rng.chance(0.6);

		if (at) {
			mushroomPatch(
				glowing ? grove.glow : grove.growth,
				rng,
				at.x,
				at.z,
				rng.range(0.25, 0.7),
				glowing ? GLOWING_CAPS : EARTHY_CAPS,
			);
		}
	}
}

export function buildForest(materials: MaterialLibrary): THREE.Group[] {
	const grove: Grove = {
		rng: new SeededRandom(FOREST_SEED),
		wood: new Batch(CELL_SIZE),
		growth: new Batch(CELL_SIZE),
		glow: new Batch(CELL_SIZE),
	};

	plantFeatures(grove);
	plantWilds(grove);
	scatterLitter(grove);

	return [
		grove.wood.build(materials, true, true),
		grove.growth.build(materials, false, true),
		grove.glow.build(materials, false, false),
	];
}
