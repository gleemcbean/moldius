import { rotate2, type Vec2 } from "../math.js";
import type { DoorSpec, Opening, OrientedBox } from "./types.js";

export const DOOR_THICKNESS = 0.07;
export const DOOR_FRAME_WIDTH = 0.05;
export const DOOR_CLEARANCE = 0.004;

export interface DoorGeometry {
	hinge: Vec2;
	closedAngle: number;
	openAngle: number;
	panelLength: number;
	panelHeight: number;
	floorY: number;
	center: Vec2;
	alongOpening: Vec2;
}

export function doorGeometry(opening: Opening): DoorGeometry {
	const along = {
		x: (opening.end.x - opening.start.x) / opening.width,
		z: (opening.end.z - opening.start.z) / opening.width,
	};
	const halfDepth = opening.depth / 2;
	const middle = {
		x: (opening.start.x + opening.end.x) / 2 + opening.normal.x * halfDepth,
		z: (opening.start.z + opening.end.z) / 2 + opening.normal.z * halfDepth,
	};
	const door = opening.door as DoorSpec;
	const panelLength = opening.width - DOOR_FRAME_WIDTH * 2 - DOOR_CLEARANCE * 2;
	const hingeSign = door.hingeAtStart ? -1 : 1;
	const hinge = {
		x: middle.x + along.x * hingeSign * (panelLength / 2),
		z: middle.z + along.z * hingeSign * (panelLength / 2),
	};
	const towardFree = { x: -along.x * hingeSign, z: -along.z * hingeSign };
	const closedAngle = Math.atan2(towardFree.z, towardFree.x);
	const swingNormal = door.swingIntoA
		? { x: -opening.normal.x, z: -opening.normal.z }
		: opening.normal;
	const openAngle = Math.atan2(swingNormal.z, swingNormal.x);
	return {
		hinge,
		closedAngle,
		openAngle,
		panelLength,
		panelHeight: opening.height - DOOR_FRAME_WIDTH - DOOR_CLEARANCE,
		floorY: opening.floorY,
		center: middle,
		alongOpening: along,
	};
}

export function doorPanelBox(
	geometry: DoorGeometry,
	angle: number,
): OrientedBox {
	const direction = { x: Math.cos(angle), z: Math.sin(angle) };
	const half = geometry.panelLength / 2;
	return {
		cx: geometry.hinge.x + direction.x * half,
		cz: geometry.hinge.z + direction.z * half,
		hx: half,
		hz: DOOR_THICKNESS / 2,
		rotation: angle,
		yMin: geometry.floorY,
		yMax: geometry.floorY + geometry.panelHeight,
	};
}

export function doorHandlePoint(geometry: DoorGeometry, angle: number): Vec2 {
	const offset = rotate2({ x: geometry.panelLength - 0.12, z: 0 }, angle);
	return { x: geometry.hinge.x + offset.x, z: geometry.hinge.z + offset.z };
}
