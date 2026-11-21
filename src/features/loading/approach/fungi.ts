import type { SeededRandom } from "@shared/random";
import * as THREE from "three";
import { meterCylinder, placed, scaleUv } from "../../world/geometryUtils";
import type { MaterialOptions } from "../../world/MaterialLibrary";
import { type Batch, mushroomCap } from "./geometry";
import {
	AMADOU_CAP,
	AMADOU_RIM,
	GLOWING_CAPS,
	GLOWING_PORES,
	GLOWING_RIM,
	GLOWING_SHELF,
	LACQUER_CAP,
	MUSHROOM_STEM,
	PALE_RIM,
	PORES,
	SULPHUR_CAP,
	SULPHUR_PORES,
	SULPHUR_RIM,
	TURKEY_TAIL_CAP,
} from "./palette";

export interface PolyporeStyle {
	cap: MaterialOptions;
	rim: MaterialOptions;
	pores: MaterialOptions;
	thickness: number;
	reach: number;
	size: number;
	shelves: readonly [number, number];
}

const AMADOU: PolyporeStyle = {
	cap: AMADOU_CAP,
	rim: AMADOU_RIM,
	pores: PORES,
	thickness: 0.55,
	reach: 0.8,
	size: 1,
	shelves: [1, 2],
};

const LACQUER: PolyporeStyle = {
	cap: LACQUER_CAP,
	rim: PALE_RIM,
	pores: PORES,
	thickness: 0.3,
	reach: 1,
	size: 0.9,
	shelves: [1, 3],
};

const SULPHUR: PolyporeStyle = {
	cap: SULPHUR_CAP,
	rim: SULPHUR_RIM,
	pores: SULPHUR_PORES,
	thickness: 0.24,
	reach: 1.1,
	size: 0.95,
	shelves: [2, 4],
};

const TURKEY_TAIL: PolyporeStyle = {
	cap: TURKEY_TAIL_CAP,
	rim: PALE_RIM,
	pores: PORES,
	thickness: 0.14,
	reach: 0.75,
	size: 0.6,
	shelves: [3, 5],
};

const GLOWING_SHELVES: PolyporeStyle = {
	cap: GLOWING_SHELF,
	rim: GLOWING_RIM,
	pores: GLOWING_PORES,
	thickness: 0.22,
	reach: 0.9,
	size: 0.7,
	shelves: [2, 4],
};

const POLYPORE_STYLES: readonly (readonly [PolyporeStyle, number])[] = [
	[AMADOU, 3],
	[LACQUER, 2],
	[SULPHUR, 2],
	[TURKEY_TAIL, 2],
	[GLOWING_SHELVES, 1.6],
];

export function pickPolypore(rng: SeededRandom): PolyporeStyle {
	return rng.weighted(POLYPORE_STYLES);
}

function shelfDome(
	radius: number,
	rings: number,
	underside: boolean,
): THREE.BufferGeometry {
	return scaleUv(
		new THREE.SphereGeometry(
			radius,
			9,
			rings,
			0,
			Math.PI,
			underside ? Math.PI / 2 : 0,
			Math.PI / 2,
		),
		Math.PI * radius,
		radius,
	);
}

export function polypore(
	batch: Batch,
	style: PolyporeStyle,
	center: THREE.Vector3,
	outward: THREE.Vector3,
	radius: number,
	tilt: number,
): void {
	const yaw = Math.atan2(outward.x, outward.z);
	const sink = radius * style.thickness * 0.05;

	const cap = shelfDome(radius, 3, false).scale(
		1,
		style.thickness,
		style.reach,
	);

	const rim = shelfDome(radius * 1.07, 2, false).scale(
		1,
		style.thickness * 0.32,
		style.reach * 1.04,
	);

	const pores = shelfDome(radius * 1.04, 2, true).scale(
		1,
		style.thickness * 0.28,
		style.reach * 1.02,
	);

	batch.add(style.cap, placed(cap, center.x, center.y, center.z, yaw, tilt));

	batch.add(
		style.rim,
		placed(rim, center.x, center.y - sink, center.z, yaw, tilt),
	);

	batch.add(
		style.pores,
		placed(pores, center.x, center.y - sink, center.z, yaw, tilt),
	);
}

export function mushroom(
	batch: Batch,
	cap: MaterialOptions,
	x: number,
	y: number,
	z: number,
	height: number,
): void {
	const capRadius = height * 0.42;

	batch.add(
		MUSHROOM_STEM,
		placed(
			meterCylinder(capRadius * 0.2, capRadius * 0.28, height, 6, true),
			x,
			y + height / 2,
			z,
		),
	);

	batch.add(cap, placed(mushroomCap(capRadius), x, y + height, z));
}

export function mushroomPatch(
	batch: Batch,
	rng: SeededRandom,
	x: number,
	z: number,
	size: number,
	caps: readonly MaterialOptions[] = GLOWING_CAPS,
): void {
	const cap = rng.pick(caps);
	const count = Math.round(4 + size * 5);

	for (let index = 0; index < count; index += 1) {
		const angle = rng.range(0, Math.PI * 2);
		const reach = Math.sqrt(rng.range(0, 1)) * size;

		mushroom(
			batch,
			cap,
			x + Math.cos(angle) * reach,
			0,
			z + Math.sin(angle) * reach * 0.7,
			rng.range(0.12, 0.45) * (index === 0 ? 1.8 : 1),
		);
	}
}
