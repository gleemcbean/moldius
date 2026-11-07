import { DOOR_ANIMATION_MS } from "@shared/config/index";
import {
	DOOR_THICKNESS,
	type DoorGeometry,
	doorGeometry,
} from "@shared/manor/doors";
import type { DoorSpec, ManorLayout, Opening } from "@shared/manor/types";
import { angleDifference } from "@shared/math";
import * as THREE from "three";
import type { ModelKit } from "../../models/modelKit";
import type { MaterialOptions } from "../../world/MaterialLibrary";

const DOOR_WOODS = [
	"woodDark",
	"woodRed",
	"woodMedium",
	"woodPainted",
] as const;

export interface DoorView {
	doorId: number;
	opening: Opening;
	geometry: DoorGeometry;
	pivot: THREE.Group;
	angle: number;
	targetOpen: boolean;
	predictedUntil: number;
}

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
	): THREE.Group {
		const pivot = new THREE.Group();
		const style = (opening.door as DoorSpec).style;
		const wood: MaterialOptions = {
			texture: DOOR_WOODS[style % DOOR_WOODS.length],
			roughness: 0.8,
		};
		const length = geometry.panelLength;
		const height = geometry.panelHeight;
		const slab = kit.box(length, height, DOOR_THICKNESS, wood);
		slab.position.set(length / 2, height / 2, 0);
		pivot.add(slab);
		const raised: MaterialOptions = { ...wood, color: 0xd0c4b4 };
		for (const side of [-1, 1]) {
			const rows = style === 2 ? 3 : 2;
			for (let row = 0; row < rows; row += 1) {
				const panelHeight = (height - 0.3) / rows - 0.08;
				const panel = kit.box(length - 0.22, panelHeight, 0.015, raised);
				panel.position.set(
					length / 2,
					0.15 + row * ((height - 0.3) / rows) + panelHeight / 2 + 0.04,
					side * (DOOR_THICKNESS / 2 + 0.006),
				);
				pivot.add(panel);
			}
			const knob = kit.sphere(
				0.03,
				{ texture: "brass", roughness: 0.35, metalness: 0.8 },
				[1, 1, 0.8],
				10,
			);
			knob.position.set(
				length - 0.09,
				1.0,
				side * (DOOR_THICKNESS / 2 + 0.035),
			);
			pivot.add(knob);
			const plate = kit.box(0.05, 0.16, 0.008, {
				texture: "brass",
				roughness: 0.35,
				metalness: 0.8,
			});
			plate.position.set(
				length - 0.09,
				1.0,
				side * (DOOR_THICKNESS / 2 + 0.004),
			);
			pivot.add(plate);
		}
		for (const y of [0.25, height - 0.25]) {
			const hinge = kit.cylinder(
				0.018,
				0.018,
				0.12,
				{ texture: "iron", roughness: 0.5, metalness: 0.6 },
				8,
			);
			hinge.position.set(0.0, y, 0);
			pivot.add(hinge);
		}
		return pivot;
	}

	setOpen(doorId: number, open: boolean, predictedUntil = 0): void {
		const door = this.doors.get(doorId);
		if (!door) {
			return;
		}
		door.targetOpen = open;
		door.predictedUntil = predictedUntil;
	}

	/** Sans animation : pour remettre une porte en place d'un coup. */
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
