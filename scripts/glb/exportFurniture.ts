import path from "node:path";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
	type FurnitureVariant,
	furnitureDefinition,
} from "../../shared/manor/furnitureCatalog.js";
import { generateManor } from "../../shared/manor/generateManor.js";
import type { FurnitureItem, Room } from "../../shared/manor/types.js";
import { PUBLIC_MATCH_CONFIG } from "../../shared/matchConfig.js";
import { SeededRandom } from "../../shared/random.js";
import { FURNITURE_BUILDERS } from "../../src/features/world/furniture/index.js";
import type {
	Part,
	PartAnimation,
} from "../../src/features/world/furniture/parts.js";
import { GeometryBucket } from "../../src/features/world/GeometryBucket.js";
import type { MaterialOptions } from "../../src/features/world/MaterialLibrary.js";
import {
	type ExportContext,
	exportObjectToGlb,
	type GlbReport,
	type PlaceholderSlot,
} from "./placeholderMaterials.js";

const CEILING_SWING_KINDS = new Set([
	"chandelier",
	"hangingCage",
	"hangingLantern",
	"hangingChains",
	"hangingPots",
	"hangingFern",
]);

const ROCKING_KINDS = new Set(["rockingChair", "rockingHorse"]);

const COPLANAR_SEPARATION = 0.00025;

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

class ShiftedPickRandom extends SeededRandom {
	constructor(
		seed: number,
		private readonly shift: number,
	) {
		super(seed);
	}

	override pick<T>(items: readonly T[]): T {
		if (items.length === 0) {
			throw new Error("Cannot pick from an empty list");
		}
		const idx = Math.floor(this.next() * items.length);
		return items[(idx + this.shift) % items.length] as T;
	}
}

function classifyDynamicSlot(mat: MaterialOptions): PlaceholderSlot {
	const tex = mat.texture ?? "";
	if (tex.startsWith("painting")) return "dyn_painting_variant";
	if (tex.startsWith("wood")) return "dyn_wood_variant";
	if (tex.startsWith("rug")) return "dyn_rug_variant";
	if (
		tex.startsWith("velvet") ||
		tex.startsWith("cloth") ||
		tex === "linen" ||
		tex === "tapestry"
	) {
		return "dyn_velvet_variant";
	}
	if (
		tex.startsWith("marble") ||
		tex.startsWith("stone") ||
		tex === "granite" ||
		tex === "basalt" ||
		tex === "slate" ||
		tex === "limestone" ||
		tex === "sandstone" ||
		tex === "terracotta"
	) {
		return "dyn_stone_variant";
	}
	return "dyn_color_tint";
}

function makeItem(
	kind: string,
	variantIndex: number,
	variant: FurnitureVariant,
	room: Room,
	seed: number,
): FurnitureItem {
	return {
		id: 0,
		kind,
		variant: variantIndex,
		roomId: room.id,
		level: room.level,
		x: 0,
		y: 0,
		z: 0,
		rotation: 0,
		width: variant.width,
		depth: variant.depth,
		height: variant.height,
		colliders: [],
		hideSpotId: null,
		valveId: null,
		parentId: null,
		seed,
	};
}

function isDistinctShape(
	candidate: FurnitureVariant,
	accepted: readonly FurnitureVariant[],
): boolean {
	const candRound = Math.abs(candidate.width - candidate.depth) < 0.01;
	for (const prev of accepted) {
		const prevRound = Math.abs(prev.width - prev.depth) < 0.01;
		if (candRound !== prevRound) return true;
		const aspectCand = candidate.width / Math.max(0.01, candidate.depth);
		const aspectPrev = prev.width / Math.max(0.01, prev.depth);
		const aspectDiff =
			Math.abs(aspectCand - aspectPrev) / Math.max(aspectCand, aspectPrev);
		const hRatioCand = candidate.height / Math.max(0.01, candidate.width);
		const hRatioPrev = prev.height / Math.max(0.01, prev.width);
		const hDiff =
			Math.abs(hRatioCand - hRatioPrev) / Math.max(hRatioCand, hRatioPrev);
		if (aspectDiff <= 0.35 && hDiff <= 0.35) {
			return false;
		}
	}
	return true;
}

function selectVariants(
	kind: string,
): { fileStem: string; index: number; variant: FurnitureVariant }[] {
	try {
		const def = furnitureDefinition(kind);
		const kept: {
			fileStem: string;
			index: number;
			variant: FurnitureVariant;
		}[] = [];
		const acceptedDims: FurnitureVariant[] = [];
		def.variants.forEach((variant, index) => {
			if (index === 0 || isDistinctShape(variant, acceptedDims)) {
				acceptedDims.push(variant);
				const isRoundTable =
					kind === "table" && Math.abs(variant.width - variant.depth) < 0.01;
				const fileStem =
					index === 0
						? kind
						: isRoundTable && !kept.some((k) => k.fileStem === `${kind}_round`)
							? `${kind}_round`
							: `${kind}_v${index}`;
				kept.push({ fileStem, index, variant });
			}
		});
		return kept;
	} catch {
		return [
			{ fileStem: kind, index: 0, variant: { width: 1, depth: 1, height: 1 } },
		];
	}
}

function prepareGeo(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
	const g = geometry;
	if (!g.index) {
		const count = g.getAttribute("position").count;
		g.setIndex(Array.from({ length: count }, (_, v) => v));
	}
	for (const name of Object.keys(g.attributes)) {
		if (name !== "position" && name !== "normal" && name !== "uv") {
			g.deleteAttribute(name);
		}
	}
	if (!g.getAttribute("uv")) {
		g.setAttribute(
			"uv",
			new THREE.Float32BufferAttribute(
				new Float32Array(g.getAttribute("position").count * 2),
				2,
			),
		);
	}
	if (!g.getAttribute("normal")) {
		g.computeVertexNormals();
	}
	return g;
}

function buildAssembly(
	parts: { part: Part; slot: PlaceholderSlot | null }[],
	ctx: ExportContext,
	target: THREE.Group,
	pivotOffset?: [number, number, number],
): void {
	const staticBucket = new GeometryBucket(ctx.materials);
	const dynamicBuckets = new Map<PlaceholderSlot, THREE.BufferGeometry[]>();

	for (const { part, slot } of parts) {
		if (pivotOffset) {
			part.geometry.translate(
				-pivotOffset[0],
				-pivotOffset[1],
				-pivotOffset[2],
			);
		}
		if (slot) {
			const list = dynamicBuckets.get(slot);
			const prepared = prepareGeo(part.geometry);
			if (list) list.push(prepared);
			else dynamicBuckets.set(slot, [prepared]);
		} else {
			staticBucket.add(part.material, part.geometry);
		}
	}

	for (const mesh of staticBucket.toMeshes()) {
		target.add(mesh);
	}

	for (const [slot, geometries] of dynamicBuckets) {
		const merged =
			geometries.length === 1
				? geometries[0]
				: mergeGeometries(geometries, false);
		if (geometries.length > 1) {
			for (const g of geometries) g.dispose();
		}
		if (!merged) continue;
		const mesh = new THREE.Mesh(merged, ctx.placeholders[slot]);
		mesh.name = slot;
		target.add(mesh);
	}
}

function disposeGroupGeometries(root: THREE.Object3D): void {
	root.traverse((obj) => {
		if (obj instanceof THREE.Mesh) {
			obj.geometry.dispose();
		}
	});
}

export async function exportFurnitureModels(
	ctx: ExportContext,
	outDir: string,
	onlyKinds?: readonly string[],
): Promise<GlbReport[]> {
	const layout = generateManor(7, { ...PUBLIC_MATCH_CONFIG, pickupTotal: 0 });
	const room = layout.rooms[0];
	const kinds = onlyKinds ? [...onlyKinds] : Object.keys(FURNITURE_BUILDERS);
	const reports: GlbReport[] = [];

	for (const kind of kinds) {
		const builder = FURNITURE_BUILDERS[kind];
		if (!builder) continue;
		const variants = selectVariants(kind);

		for (const { fileStem, index: variantIndex, variant } of variants) {
			const itemA = makeItem(kind, variantIndex, variant, room, 1);
			const itemB = makeItem(kind, variantIndex, variant, room, 2);
			const partsA = builder({
				item: itemA,
				room,
				rng: new ShiftedPickRandom(1, 0),
			});
			const partsB = builder({
				item: itemB,
				room,
				rng: new ShiftedPickRandom(1, 1),
			});
			const canDiff = partsA.length === partsB.length;

			const tagged: { part: Part; slot: PlaceholderSlot | null }[] = partsA.map(
				(part: Part, idx: number) => {
					separateCoplanarFaces(part.geometry, idx);
					let slot: PlaceholderSlot | null = null;
					if (canDiff) {
						const other = partsB[idx];
						if (
							part.material.texture !== other.material.texture ||
							part.material.color !== other.material.color
						) {
							slot = classifyDynamicSlot(part.material);
						}
					}
					return { part, slot };
				},
			);

			if (!canDiff) {
				for (const piece of partsB) {
					piece.geometry.dispose();
				}
			} else {
				for (const piece of partsB) {
					piece.geometry.dispose();
				}
			}

			const root = new THREE.Group();
			root.name = fileStem;

			const wholePivot: PartAnimation | null = CEILING_SWING_KINDS.has(kind)
				? {
						kind: "swing",
						pivot: [0, variant.height, 0],
						axis: [1, 0, 0],
						speed: 1,
						amplitude: 0.04,
						phase: 0,
					}
				: ROCKING_KINDS.has(kind)
					? {
							kind: "swing",
							pivot: [0, 0, 0],
							axis: [1, 0, 0],
							speed: 1,
							amplitude: 0.04,
							phase: 0,
						}
					: null;

			if (wholePivot) {
				const holder = new THREE.Group();
				holder.name = `anim_${wholePivot.kind}_0`;
				holder.position.set(...wholePivot.pivot);
				buildAssembly(tagged, ctx, holder, wholePivot.pivot);
				root.add(holder);
			} else {
				const staticTagged: typeof tagged = [];
				const animatedMap = new Map<
					string,
					{ anim: PartAnimation; list: typeof tagged }
				>();
				for (const entry of tagged) {
					if (entry.part.animation) {
						const anim = entry.part.animation;
						const key = `${anim.kind}:${anim.pivot.join(",")}:${anim.axis.join(",")}`;
						const bucket = animatedMap.get(key);
						if (bucket) bucket.list.push(entry);
						else animatedMap.set(key, { anim, list: [entry] });
					} else {
						staticTagged.push(entry);
					}
				}
				buildAssembly(staticTagged, ctx, root);
				let animIdx = 0;
				for (const { anim, list } of animatedMap.values()) {
					const holder = new THREE.Group();
					holder.name = `anim_${anim.kind}_${animIdx++}`;
					holder.position.set(...anim.pivot);
					buildAssembly(list, ctx, holder, anim.pivot);
					root.add(holder);
				}
			}

			const report = await exportObjectToGlb(
				root,
				path.join(outDir, `${fileStem}.glb`),
			);
			reports.push(report);
			disposeGroupGeometries(root);
		}
	}

	return reports;
}
