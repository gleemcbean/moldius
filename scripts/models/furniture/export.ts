import { furnitureDefinition } from "@shared/manor/furnitureCatalog";
import { generateManor } from "@shared/manor/generateManor";
import type { FurnitureItem, Room } from "@shared/manor/types";
import { PUBLIC_MATCH_CONFIG } from "@shared/matchConfig";
import { SeededRandom } from "@shared/random";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
	FALLBACK_FURNITURE,
	FURNITURE_AXES,
	type FurnitureAxis,
	type FurnitureGroupData,
	type FurnitureRootData,
	type PaletteEntry,
} from "../../../src/features/world/furniture/furnitureFormat";
import { cleanSurface, exportMaterial } from "../exportMaterials";
import { attachMorphs } from "../morph";
import { FURNITURE_BUILDERS } from "./index";
import type { FurnitureBuilder, Part } from "./parts";
import { stoneSlab } from "./props";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const GEOMETRY_SAMPLES = 3;
const MORPH_STEP = 0.1;
const COPLANAR_SEPARATION = 0.00025;
const LAYOUT_SEEDS = 24;
const DEFAULT_TOP = 3;

type Reference = Record<FurnitureAxis, number>;

interface PartPlan {
	group: string;
	anim: Part["animation"];
	when: Part["when"];
	material: number;
	choices: number[] | null;
}

export interface FurnitureExport {
	stem: string;
	root: THREE.Group;
	notes: string[];
}

function separateCoplanarFaces(
	geometry: THREE.BufferGeometry,
	index: number,
): void {
	geometry.computeBoundingBox();
	const center = (geometry.boundingBox as THREE.Box3).getCenter(
		new THREE.Vector3(),
	);
	const scale = 1 + COPLANAR_SEPARATION * ((index % 5) + 1);
	geometry.translate(-center.x, -center.y, -center.z);
	geometry.scale(scale, scale, scale);
	geometry.translate(center.x, center.y, center.z);
}

function median(values: number[], fallback: number): number {
	if (values.length === 0) {
		return fallback;
	}
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}

interface LayoutStats {
	top: number;
	bottom: number;
	resized: Set<FurnitureAxis>;
}

const DIMENSIONS = ["width", "height", "depth"] as const;
const RESIZE_TOLERANCE = 1e-3;

function layoutStats(): Map<string, LayoutStats> {
	const samples = new Map<
		string,
		{ tops: number[]; bottoms: number[]; resized: Set<FurnitureAxis> }
	>();
	for (let seed = 1; seed <= LAYOUT_SEEDS; seed += 1) {
		const layout = generateManor(seed, {
			...PUBLIC_MATCH_CONFIG,
			pickupTotal: 0,
		});
		for (const item of layout.furniture) {
			const room = layout.rooms[item.roomId];
			const key = `${item.kind}:${item.variant}`;
			const entry = samples.get(key) ?? {
				tops: [],
				bottoms: [],
				resized: new Set<FurnitureAxis>(),
			};
			entry.tops.push(room.ceilingY - item.y);
			entry.bottoms.push(room.floorY - item.y);
			const variant = furnitureDefinition(item.kind).variants[item.variant];
			for (const axis of DIMENSIONS) {
				if (
					variant &&
					Math.abs(item[axis] - variant[axis]) > RESIZE_TOLERANCE
				) {
					entry.resized.add(axis);
				}
			}
			samples.set(key, entry);
		}
	}
	const result = new Map<string, LayoutStats>();
	for (const [key, { tops, bottoms, resized }] of samples) {
		result.set(key, {
			top: Number(median(tops, DEFAULT_TOP).toFixed(3)),
			bottom: Number(median(bottoms, 0).toFixed(3)),
			resized,
		});
	}
	return result;
}

function baseRoom(): Room {
	const layout = generateManor(7, { ...PUBLIC_MATCH_CONFIG, pickupTotal: 0 });
	return layout.rooms[0];
}

function build(
	builder: FurnitureBuilder,
	kind: string,
	variant: number,
	room: Room,
	reference: Reference,
	seed: number,
): Part[] {
	const item: FurnitureItem = {
		id: 0,
		kind,
		variant,
		roomId: room.id,
		level: room.level,
		x: 0,
		y: 0,
		z: 0,
		rotation: 0,
		width: reference.width,
		depth: reference.depth,
		height: reference.height,
		colliders: [],
		hideSpotId: null,
		valveId: null,
		parentId: null,
		seed,
	};
	const context: Room = {
		...room,
		floorY: reference.bottom,
		ceilingY: reference.top,
		height: reference.top - reference.bottom,
	};
	const parts = builder({ item, room: context, rng: new SeededRandom(seed) });
	parts.forEach((part, index) => {
		separateCoplanarFaces(part.geometry, index);
	});
	return parts;
}

function signature(parts: Part[]): string {
	let hash = 0;
	let count = 0;
	for (const part of parts) {
		const array = part.geometry.getAttribute("position").array;
		count += array.length;
		for (let index = 0; index < array.length; index += 3) {
			hash = (hash * 31 + Math.round(array[index] * 1e4)) | 0;
		}
	}
	return `${parts.length}:${count}:${hash}`;
}

class Palette {
	readonly entries: PaletteEntry[] = [];
	private readonly keys = new Map<string, number>();

	index(material: Part["material"]): number {
		const entry: PaletteEntry = { surface: cleanSurface(material) };
		if (material.bind) {
			entry.bind = material.bind;
		}
		const key = JSON.stringify(entry);
		let index = this.keys.get(key);
		if (index === undefined) {
			index = this.entries.length;
			this.entries.push(entry);
			this.keys.set(key, index);
		}
		return index;
	}
}

function animKey(animation: Part["animation"]): string {
	return animation
		? JSON.stringify([
				animation.kind,
				animation.pivot,
				animation.axis,
				animation.speed,
				animation.amplitude,
				animation.phase,
			])
		: "";
}

function plan(
	parts: Part[],
	palette: Palette,
	sequences: number[][] | null,
): PartPlan[] {
	return parts.map((part, index) => {
		const choices =
			sequences && new Set(sequences[index]).size > 1 ? sequences[index] : null;
		const material = palette.index(part.material);
		return {
			group: `${animKey(part.animation)}|${part.when ?? ""}|${choices ? choices.join(",") : material}`,
			anim: part.animation,
			when: part.when,
			material,
			choices,
		};
	});
}

function assemble(
	name: string,
	parts: Part[],
	plans: PartPlan[],
	palette: Palette,
): THREE.Group {
	const sample = new THREE.Group();
	sample.name = name;
	const containers = new Map<string, THREE.Object3D>();
	const merged = new Map<
		string,
		{ plan: PartPlan; geometries: THREE.BufferGeometry[] }
	>();
	let animations = 0;
	let conditions = 0;
	plans.forEach((entry, index) => {
		const part = parts[index];
		const containerKey = `${animKey(entry.anim)}|${entry.when ?? ""}`;
		if (!containers.has(containerKey)) {
			let container: THREE.Object3D = sample;
			if (entry.when) {
				const group = new THREE.Group();
				group.name = `${name}_when_${conditions}`;
				conditions += 1;
				(group.userData as FurnitureGroupData).when = entry.when;
				sample.add(group);
				container = group;
			}
			if (entry.anim) {
				const group = new THREE.Group();
				group.name = `${name}_anim_${animations}`;
				animations += 1;
				group.position.fromArray(entry.anim.pivot);
				(group.userData as FurnitureGroupData).anim = { ...entry.anim };
				container.add(group);
				container = group;
			}
			containers.set(containerKey, container);
		}
		const geometry = part.geometry;
		if (entry.anim) {
			const [px, py, pz] = entry.anim.pivot;
			geometry.translate(-px, -py, -pz);
		}
		if (!geometry.index) {
			const count = geometry.getAttribute("position").count;
			geometry.setIndex(Array.from({ length: count }, (_, vertex) => vertex));
		}
		for (const attribute of Object.keys(geometry.attributes)) {
			if (
				attribute !== "position" &&
				attribute !== "normal" &&
				attribute !== "uv"
			) {
				geometry.deleteAttribute(attribute);
			}
		}
		if (!geometry.getAttribute("uv")) {
			geometry.setAttribute(
				"uv",
				new THREE.Float32BufferAttribute(
					new Float32Array(geometry.getAttribute("position").count * 2),
					2,
				),
			);
		}
		if (!geometry.getAttribute("normal")) {
			geometry.computeVertexNormals();
		}
		const bucket = merged.get(entry.group) ?? { plan: entry, geometries: [] };
		bucket.geometries.push(geometry);
		merged.set(entry.group, bucket);
	});
	for (const [key, { plan: entry, geometries }] of merged) {
		const geometry =
			geometries.length === 1
				? geometries[0]
				: (mergeGeometries(geometries, false) as THREE.BufferGeometry);
		const mesh = new THREE.Mesh(
			geometry,
			exportMaterial(palette.entries[entry.material].surface),
		);
		mesh.userData = entry.choices
			? { choices: entry.choices }
			: { material: entry.material };
		const containerKey = key.slice(0, key.lastIndexOf("|"));
		(containers.get(containerKey) ?? sample).add(mesh);
	}
	return sample;
}

function pivots(sample: THREE.Object3D): THREE.Vector3[] {
	const list: THREE.Vector3[] = [];
	sample.traverse((object) => {
		if ((object.userData as FurnitureGroupData).anim) {
			list.push(object.position.clone());
		}
	});
	return list;
}

function exportVariant(
	kind: string,
	builder: FurnitureBuilder,
	variant: number,
	size: { width: number; height: number; depth: number },
	stats: LayoutStats,
	room: Room,
	stem: string,
): FurnitureExport {
	const reference: Reference = {
		...size,
		top: stats.top,
		bottom: stats.bottom,
	};
	const axes = FURNITURE_AXES.filter(
		(axis) => axis === "top" || axis === "bottom" || stats.resized.has(axis),
	);
	const notes: string[] = [];
	const builds = SEEDS.map((seed) =>
		build(builder, kind, variant, room, reference, seed),
	);
	const signatures = builds.map(signature);
	const distinct: number[] = [];
	signatures.forEach((value, index) => {
		if (!signatures.slice(0, index).includes(value)) {
			distinct.push(index);
		}
	});
	const geometrySeeds = distinct.slice(0, GEOMETRY_SAMPLES);
	const palette = new Palette();
	const varied = geometrySeeds.length > 1;
	const sequences = varied
		? null
		: builds[0].map((_, index) =>
				builds.map((parts) => palette.index(parts[index].material)),
			);
	const root = new THREE.Group();
	root.name = stem;
	const morphs = new Set<FurnitureAxis>(axes);
	geometrySeeds.forEach((seedIndex, sampleIndex) => {
		const seed = SEEDS[seedIndex];
		const plans = plan(builds[seedIndex], palette, sequences);
		const name = `sample_${sampleIndex}`;
		const sample = assemble(name, builds[seedIndex], plans, palette);
		const perturbed = (axis: FurnitureAxis, delta: number) => {
			const shifted = { ...reference };
			shifted[axis] += axis === "bottom" ? -delta : delta;
			const parts = build(builder, kind, variant, room, shifted, seed);
			if (parts.length !== plans.length) {
				return new THREE.Group();
			}
			return assemble(name, parts, plans, palette);
		};
		const pivotBase = pivots(sample);
		for (const axis of axes) {
			const moved = pivots(perturbed(axis, MORPH_STEP));
			if (moved.length !== pivotBase.length) {
				continue;
			}
			let index = 0;
			sample.traverse((object) => {
				const data = object.userData as FurnitureGroupData;
				if (!data.anim) {
					return;
				}
				const delta = moved[index]
					.clone()
					.sub(pivotBase[index])
					.divideScalar(axis === "bottom" ? -MORPH_STEP : MORPH_STEP);
				index += 1;
				if (delta.lengthSq() > 1e-12) {
					data.anim.pivotMorph = {
						...data.anim.pivotMorph,
						[axis]: delta.toArray(),
					};
				}
			});
		}
		const result = attachMorphs(
			sample,
			axes.map((axis) => ({
				name: axis,
				step: axis === "bottom" ? -MORPH_STEP : MORPH_STEP,
				build: (delta: number) => perturbed(axis, Math.abs(delta)),
			})),
		);
		for (const axis of result.mismatched) {
			morphs.delete(axis as FurnitureAxis);
		}
		if (result.nonLinear.length > 0) {
			notes.push(`non linéaire : ${result.nonLinear.join(", ")}`);
		}
		root.add(sample);
	});
	const mismatched = axes.filter((axis) => !morphs.has(axis));
	if (mismatched.length > 0) {
		notes.push(`sans morph : ${mismatched.join(", ")}`);
	}
	const data: FurnitureRootData & { kind: string; variant: number } = {
		kind,
		variant,
		reference,
		morphs: FURNITURE_AXES.filter((axis) => morphs.has(axis)),
		samples: geometrySeeds.length,
		palette: palette.entries,
	};
	root.userData = data;
	return { stem, root, notes };
}

export function* exportFurniture(
	onlyKinds?: readonly string[],
): Generator<FurnitureExport> {
	const room = baseRoom();
	const stats = layoutStats();
	const fallback: LayoutStats = {
		top: DEFAULT_TOP,
		bottom: 0,
		resized: new Set(),
	};
	const kinds = onlyKinds ?? Object.keys(FURNITURE_BUILDERS);
	for (const kind of kinds) {
		const builder = FURNITURE_BUILDERS[kind];
		if (!builder) {
			continue;
		}
		const definition = furnitureDefinition(kind);
		for (const [variant, size] of definition.variants.entries()) {
			yield exportVariant(
				kind,
				builder,
				variant,
				size,
				stats.get(`${kind}:${variant}`) ?? fallback,
				room,
				variant === 0 ? kind : `${kind}_v${variant}`,
			);
		}
	}
	if (!onlyKinds) {
		yield exportVariant(
			FALLBACK_FURNITURE,
			stoneSlab,
			0,
			{ width: 1, height: 0.5, depth: 1 },
			{ ...fallback, resized: new Set(DIMENSIONS) },
			room,
			FALLBACK_FURNITURE,
		);
	}
}
