import {
	ALTAR_INTERACT_RANGE,
	DOOR_INTERACT_RANGE,
	HIDE_INTERACT_RANGE,
	PICKUP_INTERACT_RANGE,
	STAKE_INTERACT_RANGE,
	VALVE_INTERACT_RANGE,
} from "@shared/config/index";
import { doorPanelBox } from "@shared/manor/doors";
import type { ManorLayout } from "@shared/manor/types";
import type { CollisionWorld } from "@shared/physics/collisionWorld";
import { lineOfSight, segmentHitsBox } from "@shared/physics/lineOfSight";
import type { InteractionKind } from "@shared/protocol/game";
import * as THREE from "three";
import { currentMessages } from "../../../i18n";
import {
	HIDEABLE_KINDS,
	type HideableKind,
} from "../../../i18n/sections/world";
import type { ClientWorldState } from "../state/ClientWorldState";
import type { DoorViews } from "../world/DoorViews";
import type { GadgetViews } from "../world/GadgetViews";
import type { PickupViews } from "../world/PickupViews";

export interface InteractionTarget {
	kind: InteractionKind | "altar";
	id: number;
	label: string;
}

function isHideableKind(kind: string): kind is HideableKind {
	return (HIDEABLE_KINDS as readonly string[]).includes(kind);
}

function angleTo(
	eye: THREE.Vector3,
	forward: THREE.Vector3,
	point: THREE.Vector3,
): number {
	const direction = new THREE.Vector3().subVectors(point, eye).normalize();
	return Math.acos(Math.min(1, Math.max(-1, direction.dot(forward))));
}

export class InteractionFinder {
	constructor(
		private readonly layout: ManorLayout,
		private readonly world: CollisionWorld,
		private readonly doors: DoorViews,
		private readonly state: ClientWorldState,
		private readonly pickups: PickupViews,
		private readonly walkies: GadgetViews,
		private readonly cameras: GadgetViews,
		private readonly tutorial: boolean,
	) {}

	find(
		eye: THREE.Vector3,
		forward: THREE.Vector3,
		feet: THREE.Vector3,
		hiddenSpot: number,
		serverTime: number,
	): InteractionTarget | null {
		const labels = currentMessages().game.interaction;
		if (hiddenSpot >= 0) {
			const spot = this.layout.hideSpots[hiddenSpot];
			return {
				kind: "unhide",
				id: hiddenSpot,
				label: spot
					? labels.leave(this.placeName(spot.furnitureId))
					: labels.leaveShort,
			};
		}
		const candidates: { target: InteractionTarget; score: number }[] = [];
		const reach = eye.clone().addScaledVector(forward, DOOR_INTERACT_RANGE);
		for (const door of this.doors.doors.values()) {
			const center = new THREE.Vector3(
				door.geometry.center.x,
				door.geometry.floorY + 1.1,
				door.geometry.center.z,
			);
			const distance = center.distanceTo(eye);
			if (distance > DOOR_INTERACT_RANGE + 0.8) {
				continue;
			}
			const box = doorPanelBox(door.geometry, door.angle);
			const hit = segmentHitsBox(eye, reach, {
				...box,
				hz: Math.max(box.hz, 0.08),
			});
			const angle = angleTo(eye, forward, center);
			if (hit || (angle < 0.42 && distance <= DOOR_INTERACT_RANGE)) {
				const open = this.state.doors.get(door.doorId)?.open ?? door.targetOpen;
				candidates.push({
					target: {
						kind: "door",
						id: door.doorId,
						label: open ? labels.closeDoor : labels.openDoor,
					},
					score: distance + angle * 2 - (hit ? 1 : 0),
				});
			}
		}
		for (const spot of this.layout.hideSpots) {
			const entryDistance = Math.hypot(
				spot.entry.x - feet.x,
				spot.entry.z - feet.z,
			);
			if (entryDistance > HIDE_INTERACT_RANGE + 0.3) {
				continue;
			}
			const furniture = this.layout.furniture[spot.furnitureId];
			const occupied = [...this.state.players.values()].some(
				(player) =>
					player.latest?.hideSpot === spot.id &&
					player.id !== this.state.selfId,
			);
			const center = new THREE.Vector3(
				furniture.x,
				furniture.y + furniture.height * 0.55,
				furniture.z,
			);
			const angle = angleTo(eye, forward, center);
			if (angle < 0.6 && !occupied) {
				candidates.push({
					target: {
						kind: "hide",
						id: spot.id,
						label: labels.hide(this.placeName(spot.furnitureId)),
					},
					score: entryDistance + angle * 2,
				});
			}
		}
		for (const valve of this.layout.valves) {
			const point = new THREE.Vector3(
				valve.valve.x,
				valve.valve.y,
				valve.valve.z,
			);
			const distance = point.distanceTo(eye);
			if (distance > VALVE_INTERACT_RANGE + 0.3) {
				continue;
			}
			const angle = angleTo(eye, forward, point);
			if (angle < 0.55) {
				const state = this.state.valves.get(valve.id);
				const cooling = state && serverTime < state.cooldownUntil;
				const active = state && serverTime < state.activeUntil;
				const label = active
					? labels.valveActive
					: cooling
						? labels.valveResting
						: labels.openValve;
				candidates.push({
					target: { kind: "valve", id: valve.id, label },
					score: distance + angle * 2,
				});
			}
		}
		for (const pickup of this.layout.pickups) {
			if (!this.pickups.isAvailable(pickup.id)) {
				continue;
			}
			const point = new THREE.Vector3(pickup.x, pickup.y + 0.05, pickup.z);
			const distance = point.distanceTo(eye);
			if (distance > PICKUP_INTERACT_RANGE) {
				continue;
			}
			const angle = angleTo(eye, forward, point);
			if (angle < 0.5 && this.clearLine(eye, point)) {
				const kind =
					pickup.furnitureId !== null && pickup.spot === "container"
						? this.layout.furniture[pickup.furnitureId]?.kind
						: null;
				candidates.push({
					target: {
						kind: "pickup",
						id: pickup.id,
						label:
							kind === "chest" || kind === "crate" || kind === "smallBox"
								? labels.search[kind]
								: this.tutorial
									? labels.pickUpAny
									: labels.pickUp(
											currentMessages().grimoire.materials[pickup.material],
										),
					},
					score: distance + angle * 2 - 0.5,
				});
			}
		}
		for (const spot of this.layout.walkies) {
			if (!this.walkies.isAvailable(spot.id) || this.state.selfHasWalkie) {
				continue;
			}
			const point = new THREE.Vector3(spot.x, spot.y + 0.1, spot.z);
			const distance = point.distanceTo(eye);
			if (distance > PICKUP_INTERACT_RANGE) {
				continue;
			}
			const angle = angleTo(eye, forward, point);
			if (angle < 0.5 && this.clearLine(eye, point)) {
				candidates.push({
					target: { kind: "walkie", id: spot.id, label: labels.takeWalkie },
					score: distance + angle * 2 - 0.5,
				});
			}
		}
		for (const spot of this.layout.cameras) {
			if (!this.cameras.isAvailable(spot.id) || this.state.selfHasCamera) {
				continue;
			}
			const point = new THREE.Vector3(spot.x, spot.y + 0.08, spot.z);
			const distance = point.distanceTo(eye);
			if (distance > PICKUP_INTERACT_RANGE) {
				continue;
			}
			const angle = angleTo(eye, forward, point);
			if (angle < 0.5 && this.clearLine(eye, point)) {
				candidates.push({
					target: { kind: "camera", id: spot.id, label: labels.takeCamera },
					score: distance + angle * 2 - 0.5,
				});
			}
		}
		for (const stake of this.layout.stakes) {
			const point = new THREE.Vector3(stake.x, stake.y + 0.9, stake.z);
			const distance = point.distanceTo(eye);
			if (distance > STAKE_INTERACT_RANGE) {
				continue;
			}
			const angle = angleTo(eye, forward, point);
			if (angle < 0.7 && this.clearLine(eye, point)) {
				const state = this.state.stakes.get(stake.id);
				const resting = state !== undefined && serverTime < state.cooldownUntil;
				candidates.push({
					target: {
						kind: "stake",
						id: stake.id,
						label: resting ? labels.stakeResting : labels.stakes[stake.kind],
					},
					score: distance + angle * 2,
				});
			}
		}
		for (const altar of this.layout.altars) {
			const point = new THREE.Vector3(altar.x, altar.y + 0.85, altar.z);
			const distance = point.distanceTo(eye);
			if (distance > ALTAR_INTERACT_RANGE) {
				continue;
			}
			const angle = angleTo(eye, forward, point);
			if (angle < 0.7 && this.clearLine(eye, point)) {
				candidates.push({
					target: { kind: "altar", id: altar.id, label: labels.useAltar },
					score: distance + angle * 2,
				});
			}
		}
		candidates.sort((a, b) => a.score - b.score);
		return candidates[0]?.target ?? null;
	}

	private clearLine(eye: THREE.Vector3, point: THREE.Vector3): boolean {
		return lineOfSight(this.world, eye, point, {
			ignoreFurniture: true,
			blockGlass: true,
		});
	}

	private placeName(furnitureId: number): string {
		const world = currentMessages().world;
		const kind = this.layout.furniture[furnitureId]?.kind ?? "";
		return isHideableKind(kind) ? world.furniture[kind] : world.hidingPlace;
	}
}
