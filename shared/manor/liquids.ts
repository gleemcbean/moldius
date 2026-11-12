import { rotate2 } from "../math.js";
import { type CauldronBrew, cauldronBrew } from "./brews.js";
import type { FurnitureItem } from "./types.js";

export type LiquidKind =
	| "cauldron"
	| "washtub"
	| "birdbath"
	| "bathtub"
	| "pond";

export interface BasinShape {
	width: number;
	depth: number;
	floorY: number;
	surfaceY: number;
}

function roundOpening(radius: number): { width: number; depth: number } {
	const side = radius * Math.SQRT2;
	return { width: side, depth: side };
}

export function basinShape(
	item: Pick<FurnitureItem, "kind" | "width" | "depth" | "height">,
): BasinShape | null {
	const { width, depth, height } = item;
	switch (item.kind) {
		case "cauldron":
			return {
				...roundOpening(width * 0.4),
				floorY: 0.14,
				surfaceY: height - 0.13,
			};
		case "washtub":
			return {
				...roundOpening(width / 2 - 0.07),
				floorY: 0.05,
				surfaceY: height - 0.12,
			};
		case "birdbath":
			return {
				...roundOpening(width * 0.42),
				floorY: height - 0.1,
				surfaceY: height - 0.045,
			};
		case "bathtub":
			return {
				width: width - 0.14,
				depth: depth - 0.14,
				floorY: 0.19,
				surfaceY: height - 0.14,
			};
		default:
			return null;
	}
}

export interface LiquidVolume {
	itemId: number;
	kind: LiquidKind;
	x: number;
	z: number;
	rotation: number;
	halfWidth: number;
	halfDepth: number;
	elliptic: boolean;
	floorY: number;
	surfaceY: number;
	brew: CauldronBrew | null;
}

const POND_INSET = 0.15;
const POND_SURFACE = 0.13;

export function liquidVolumes(
	furniture: readonly FurnitureItem[],
): LiquidVolume[] {
	const volumes: LiquidVolume[] = [];
	for (const item of furniture) {
		const base = {
			itemId: item.id,
			x: item.x,
			z: item.z,
			rotation: item.rotation,
		};
		if (item.kind === "pond") {
			volumes.push({
				...base,
				kind: "pond",
				halfWidth: item.width / 2 - POND_INSET,
				halfDepth: item.depth / 2 - POND_INSET,
				elliptic: true,
				floorY: item.y,
				surfaceY: item.y + POND_SURFACE,
				brew: null,
			});
			continue;
		}
		const shape = basinShape(item);
		if (!shape) {
			continue;
		}
		volumes.push({
			...base,
			kind: item.kind as LiquidKind,
			halfWidth: shape.width / 2,
			halfDepth: shape.depth / 2,
			elliptic: false,
			floorY: item.y + shape.floorY,
			surfaceY: item.y + shape.surfaceY,
			brew: item.kind === "cauldron" ? cauldronBrew(item.seed) : null,
		});
	}
	return volumes;
}

export function liquidAt(
	volumes: readonly LiquidVolume[],
	position: { x: number; y: number; z: number },
): LiquidVolume | null {
	for (const volume of volumes) {
		if (
			position.y < volume.floorY - 0.3 ||
			position.y > volume.surfaceY - 0.01
		) {
			continue;
		}
		const local = rotate2(
			{ x: position.x - volume.x, z: position.z - volume.z },
			-volume.rotation,
		);
		const inside = volume.elliptic
			? (local.x / volume.halfWidth) ** 2 + (local.z / volume.halfDepth) ** 2 <=
				1
			: Math.abs(local.x) <= volume.halfWidth &&
				Math.abs(local.z) <= volume.halfDepth;
		if (inside) {
			return volume;
		}
	}
	return null;
}
