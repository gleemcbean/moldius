import type { PartAnimation } from "../DecorAnimator";
import type { MaterialOptions } from "../MaterialLibrary";

export type RoomBind = "roomCarved" | "roomFloor" | "sacredFloor";
export type RoomCondition = "notGreenhouse";
export type FurnitureAxis = "width" | "height" | "depth" | "top" | "bottom";

export const FURNITURE_AXES: readonly FurnitureAxis[] = [
	"width",
	"height",
	"depth",
	"top",
	"bottom",
];

export const FALLBACK_FURNITURE = "stoneSlab";

export interface PaletteEntry {
	surface: MaterialOptions;
	bind?: RoomBind;
}

export interface FurnitureRootData {
	reference: Record<FurnitureAxis, number>;
	morphs: FurnitureAxis[];
	samples: number;
	palette: PaletteEntry[];
}

export interface FurnitureMeshData {
	material?: number;
	choices?: number[];
}

export interface FurnitureGroupData {
	anim?: PartAnimation & {
		pivotMorph?: Partial<Record<FurnitureAxis, [number, number, number]>>;
	};
	when?: RoomCondition;
}

export function sacredFloor(type: string): MaterialOptions {
	return type === "chapel" || type === "ritual"
		? { texture: "stoneFlags", roughness: 0.95 }
		: { texture: "parquet", roughness: 0.85 };
}
