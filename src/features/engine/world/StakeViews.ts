import { STAKE_COLORS } from "@shared/config/index";
import type { ManorLayout } from "@shared/manor/types";
import * as THREE from "three";
import type { DynamicLight } from "../lighting/LightPool";
import type { ClientWorldState } from "../state/ClientWorldState";

const VISIBLE_RANGE = 30;
const ORB_RADIUS = 0.09;

export class StakeViews {
	readonly group = new THREE.Group();
	private readonly geometry = new THREE.SphereGeometry(ORB_RADIUS, 12, 10);
	private readonly orbs: {
		id: number;
		mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
		light: DynamicLight;
		y: number;
		color: THREE.Color;
	}[] = [];
	private time = 0;

	constructor(
		layout: ManorLayout,
		private readonly state: ClientWorldState,
	) {
		for (const stake of layout.stakes) {
			const furniture = layout.furniture[stake.furnitureId];
			const y = stake.y + (furniture?.height ?? 1) + 0.55;
			const color = new THREE.Color(STAKE_COLORS[stake.kind]);
			const mesh = new THREE.Mesh(
				this.geometry,
				new THREE.MeshBasicMaterial({ color, fog: false }),
			);
			mesh.position.set(stake.x, y, stake.z);
			this.group.add(mesh);
			this.orbs.push({
				id: stake.id,
				mesh,
				y,
				color,
				light: {
					id: `stake-${stake.id}`,
					position: mesh.position,
					color: STAKE_COLORS[stake.kind],
					intensity: 0,
					radius: 5,
					priority: 3,
					flicker: 0.1,
				},
			});
		}
	}

	update(
		dt: number,
		eye: THREE.Vector3,
		serverNow: number,
		lights: DynamicLight[],
	): void {
		this.time += dt;
		for (const orb of this.orbs) {
			const near =
				orb.mesh.position.distanceToSquared(eye) <
				VISIBLE_RANGE * VISIBLE_RANGE;
			orb.mesh.visible = near;
			if (!near) {
				continue;
			}
			const stake = this.state.stakes.get(orb.id);
			const active = stake !== undefined && serverNow < stake.activeUntil;
			const ready = stake === undefined || serverNow >= stake.cooldownUntil;
			orb.mesh.position.y = orb.y + Math.sin(this.time * 1.5 + orb.id) * 0.05;
			const scale = active
				? 1.5 + Math.sin(this.time * 7) * 0.2
				: ready
					? 1
					: 0.45;
			orb.mesh.scale.setScalar(scale);
			orb.mesh.material.color
				.copy(orb.color)
				.multiplyScalar(ready || active ? 1 : 0.25);
			if (ready || active) {
				orb.light.intensity = active ? 7 : 2.2;
				lights.push(orb.light);
			}
		}
	}

	dispose(): void {
		this.geometry.dispose();
		for (const orb of this.orbs) {
			orb.mesh.material.dispose();
		}
	}
}
