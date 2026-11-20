import type { FurnitureItem, Room } from "@shared/manor/types";
import * as THREE from "three";
import { modelLibrary } from "../../models/ModelLibrary";
import type { PartAnimation } from "../DecorAnimator";
import type { MaterialOptions } from "../MaterialLibrary";
import {
	FALLBACK_FURNITURE,
	type FurnitureAxis,
	type FurnitureGroupData,
	type FurnitureMeshData,
	type FurnitureRootData,
	type PaletteEntry,
	type RoomCondition,
	sacredFloor,
} from "./furnitureFormat";
import { carvedForSeed } from "./stones";

export interface FurniturePiece {
	material: MaterialOptions;
	geometry: THREE.BufferGeometry;
}

export interface FurnitureParts {
	pieces: FurniturePiece[];
	animated: { animation: PartAnimation; pieces: FurniturePiece[] }[];
	scale: THREE.Vector3;
}

function resolveEntry(entry: PaletteEntry, room: Room): MaterialOptions {
	switch (entry.bind) {
		case "roomCarved":
			return carvedForSeed(room.seed);
		case "roomFloor":
			return { texture: room.style.floor, roughness: 0.85 };
		case "sacredFloor":
			return sacredFloor(room.type);
		default:
			return entry.surface;
	}
}

function conditionHolds(condition: RoomCondition, room: Room): boolean {
	switch (condition) {
		case "notGreenhouse":
			return room.type !== "greenhouse";
	}
}

export function furnitureModelId(kind: string, variant: number): string {
	const exact = `furniture/${variant === 0 ? kind : `${kind}_v${variant}`}`;

	if (modelLibrary.exists(exact)) {
		return exact;
	}

	const base = `furniture/${kind}`;

	return modelLibrary.exists(base) ? base : `furniture/${FALLBACK_FURNITURE}`;
}

export function furnitureModelIds(items: readonly FurnitureItem[]): string[] {
	return [
		...new Set(items.map((item) => furnitureModelId(item.kind, item.variant))),
	];
}

function pick(seed: number, count: number): number {
	return count <= 1 ? 0 : Math.abs(Math.trunc(seed)) % count;
}

function bake(
	mesh: THREE.Mesh,
	offsets: Partial<Record<FurnitureAxis, number>>,
): THREE.BufferGeometry {
	const source = mesh.geometry;
	const geometry = new THREE.BufferGeometry();

	const position = (
		source.getAttribute("position") as THREE.BufferAttribute
	).clone();

	const normal = (
		source.getAttribute("normal") as THREE.BufferAttribute
	).clone();

	geometry.setAttribute("position", position);
	geometry.setAttribute("normal", normal);

	const uv = source.getAttribute("uv");

	if (uv) {
		geometry.setAttribute("uv", (uv as THREE.BufferAttribute).clone());
	}

	if (source.index) {
		geometry.setIndex(source.index.clone());
	}

	const dictionary = mesh.morphTargetDictionary ?? {};
	let morphed = false;

	for (const [name, index] of Object.entries(dictionary)) {
		const offset = offsets[name as FurnitureAxis] ?? 0;

		if (offset === 0) {
			continue;
		}

		morphed = true;

		const positions = source.morphAttributes.position?.[index];
		const normals = source.morphAttributes.normal?.[index];

		if (positions) {
			for (let value = 0; value < position.array.length; value += 1) {
				position.array[value] += positions.array[value] * offset;
			}
		}

		if (normals) {
			for (let value = 0; value < normal.array.length; value += 1) {
				normal.array[value] += normals.array[value] * offset;
			}
		}
	}

	if (morphed) {
		const vector = new THREE.Vector3();

		for (let vertex = 0; vertex < normal.count; vertex += 1) {
			vector.fromBufferAttribute(normal, vertex).normalize();
			normal.setXYZ(vertex, vector.x, vector.y, vector.z);
		}
	}

	return geometry;
}

export function furnitureParts(
	item: FurnitureItem,
	room: Room,
): FurnitureParts {
	const template = modelLibrary.template(
		furnitureModelId(item.kind, item.variant),
	);

	const data = template.userData as FurnitureRootData;

	const values: Record<FurnitureAxis, number> = {
		width: item.width,
		height: item.height,
		depth: item.depth,
		top: room.ceilingY - item.y,
		bottom: room.floorY - item.y,
	};

	const offsets: Partial<Record<FurnitureAxis, number>> = {};

	for (const axis of data.morphs) {
		offsets[axis] = values[axis] - data.reference[axis];
	}

	const morphs = new Set(data.morphs);

	const ratio = (axis: FurnitureAxis) =>
		morphs.has(axis) ? 1 : values[axis] / Math.max(0.01, data.reference[axis]);

	const scale = new THREE.Vector3(
		ratio("width"),
		ratio("height"),
		ratio("depth"),
	);

	const choice = pick(item.seed, 8);

	const sample = template.getObjectByName(
		`sample_${pick(item.seed, data.samples)}`,
	);

	const result: FurnitureParts = { pieces: [], animated: [], scale };

	if (!sample) {
		return result;
	}

	const materialOf = (mesh: THREE.Mesh) => {
		const meshData = mesh.userData as FurnitureMeshData;

		const index = meshData.choices
			? meshData.choices[choice % meshData.choices.length]
			: (meshData.material ?? 0);

		return resolveEntry(data.palette[index], room);
	};

	const collect = (parent: THREE.Object3D, target: FurniturePiece[]) => {
		for (const child of parent.children) {
			if (child instanceof THREE.Mesh) {
				target.push({
					material: materialOf(child),
					geometry: bake(child, offsets),
				});

				continue;
			}

			const group = child.userData as FurnitureGroupData;

			if (group.when && !conditionHolds(group.when, room)) {
				continue;
			}

			if (group.anim) {
				const pivot = new THREE.Vector3(...group.anim.pivot);

				for (const [axis, delta] of Object.entries(
					group.anim.pivotMorph ?? {},
				)) {
					pivot.addScaledVector(
						new THREE.Vector3(...delta),
						offsets[axis as FurnitureAxis] ?? 0,
					);
				}

				const pieces: FurniturePiece[] = [];

				collect(child, pieces);

				result.animated.push({
					animation: {
						kind: group.anim.kind,
						pivot: pivot.toArray(),
						axis: group.anim.axis,
						speed: group.anim.speed,
						amplitude: group.anim.amplitude,
						phase: group.anim.phase,
					},
					pieces,
				});

				continue;
			}

			collect(child, target);
		}
	};

	collect(sample, result.pieces);

	return result;
}
