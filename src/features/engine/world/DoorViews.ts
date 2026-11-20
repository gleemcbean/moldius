import { DOOR_ANIMATION_MS } from "@shared/config/index";
import { type DoorGeometry, doorGeometry } from "@shared/manor/doors";
import type { DoorSpec, ManorLayout, Opening } from "@shared/manor/types";
import { angleDifference } from "@shared/math";
import * as THREE from "three";
import type { ModelKit } from "../../models/modelKit";
import type { MaterialOptions } from "../../world/MaterialLibrary";

export const DOOR_WOODS = [
	"woodDark",
	"woodRed",
	"woodMedium",
	"woodPainted",
] as const;

export const DOOR_WOOD: MaterialOptions = { roughness: 0.8 };
export const DOOR_FIELD_COLOR = 0xd8ccbc;
export const DOOR_REFERENCE = { width: 0.992, height: 2.196 };

export interface DoorView {
	doorId: number;
	opening: Opening;
	geometry: DoorGeometry;
	pivot: THREE.Object3D;
	angle: number;
	targetOpen: boolean;
	predictedUntil: number;
}

const SHUT_TOLERANCE = 1e-3;

export class DoorViews {
	readonly group = new THREE.Group();
	readonly doors = new Map<number, DoorView>();

	constructor(layout: ManorLayout, kit: ModelKit) {
		for (const opening of layout.openings) {
			if (!opening.door) {
				continue;
			}

			const geometry = doorGeometry(opening);
			const pivot = this.buildDoor(kit, geometry, opening);

			pivot.position.set(geometry.hinge.x, geometry.floorY, geometry.hinge.z);

			const open = opening.door.initiallyOpen;
			const angle = open ? geometry.openAngle : geometry.closedAngle;

			pivot.rotation.y = -angle;

			this.group.add(pivot);

			this.doors.set(opening.door.id, {
				doorId: opening.door.id,
				opening,
				geometry,
				pivot,
				angle,
				targetOpen: open,
				predictedUntil: 0,
			});
		}
	}

	private buildDoor(
		kit: ModelKit,
		geometry: DoorGeometry,
		opening: Opening,
	): THREE.Object3D {
		const style = (opening.door as DoorSpec).style;

		const wood: MaterialOptions = {
			...DOOR_WOOD,
			texture: DOOR_WOODS[style % DOOR_WOODS.length],
		};

		const rig = kit.rig(style === 2 ? "world/door_3panel" : "world/door", {
			wood,
			field: { ...wood, color: DOOR_FIELD_COLOR },
		});

		rig.setMorphs({
			width: geometry.panelLength,
			height: geometry.panelHeight,
		});

		const pivot = new THREE.Group();

		pivot.add(rig.root);

		return pivot;
	}

	isShut(doorId: number): boolean {
		const door = this.doors.get(doorId);

		if (!door || door.targetOpen) {
			return false;
		}

		return (
			Math.abs(angleDifference(door.angle, door.geometry.closedAngle)) <
			SHUT_TOLERANCE
		);
	}

	cull(rooms: ArrayLike<number> | null): void {
		for (const door of this.doors.values()) {
			door.pivot.visible =
				rooms === null ||
				rooms[door.opening.roomA] === 1 ||
				rooms[door.opening.roomB] === 1;
		}
	}

	setOpen(doorId: number, open: boolean, predictedUntil = 0): void {
		const door = this.doors.get(doorId);

		if (!door) {
			return;
		}

		door.targetOpen = open;
		door.predictedUntil = predictedUntil;
	}

	snap(doorId: number): void {
		const door = this.doors.get(doorId);

		if (door) {
			door.angle = door.targetOpen
				? door.geometry.openAngle
				: door.geometry.closedAngle;

			door.pivot.rotation.y = -door.angle;
		}
	}

	update(dt: number): void {
		const step = (Math.PI / 2 / (DOOR_ANIMATION_MS / 1000)) * dt;

		for (const door of this.doors.values()) {
			const target = door.targetOpen
				? door.geometry.openAngle
				: door.geometry.closedAngle;

			const delta = angleDifference(door.angle, target);

			if (Math.abs(delta) < 1e-3) {
				continue;
			}

			door.angle += Math.sign(delta) * Math.min(Math.abs(delta), step);
			door.pivot.rotation.y = -door.angle;
		}
	}

	meshes(): THREE.Object3D[] {
		return [...this.doors.values()].map((door) => door.pivot);
	}
}
