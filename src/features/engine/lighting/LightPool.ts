import { EYE_HEIGHT_STANDING } from "@shared/config/index";
import { floorsSeenFromEye, levelForHeight } from "@shared/manor/levels";
import type { Level, LightSource, Room } from "@shared/manor/types";
import * as THREE from "three";

export interface DynamicLight {
	id: string;
	position: THREE.Vector3;
	color: number;
	intensity: number;
	radius: number;
	priority: number;
	flicker: number;
	level?: Level;
	spansFloors?: boolean;
}

interface Slot {
	light: THREE.PointLight;
	sourceId: string | null;
	weight: number;
}

const KIND_FLICKER: Record<LightSource["kind"], number> = {
	candle: 0.26,
	chandelier: 0.14,
	fire: 0.3,
	lamp: 0.06,
	cauldron: 0.12,
	moon: 0,
};

const INTENSITY_SCALE = 4.2;
const SPANNING_LIGHT_REACH = 5;

export class LightPool {
	private readonly slots: Slot[] = [];
	private readonly staticLights: DynamicLight[];
	private readonly scratch = new THREE.Vector3();
	private time = 0;
	reduceFlicker = false;

	constructor(
		scene: THREE.Scene,
		size: number,
		sources: LightSource[],
		rooms: readonly Room[] = [],
	) {
		const spanning = new Set(
			rooms
				.filter((room) => room.type === "stairwell" || room.mezzanine)
				.map((room) => room.id),
		);
		for (let index = 0; index < size; index += 1) {
			const light = new THREE.PointLight(0xffffff, 0, 6, 2);
			light.visible = true;
			scene.add(light);
			this.slots.push({ light, sourceId: null, weight: 0 });
		}
		this.staticLights = sources.map((source) => ({
			id: `static-${source.id}`,
			position: new THREE.Vector3(
				source.position.x,
				source.position.y,
				source.position.z,
			),
			color: source.color,
			intensity: source.intensity * INTENSITY_SCALE,
			radius: source.radius,
			priority: source.kind === "moon" ? 0.7 : 1,
			flicker: KIND_FLICKER[source.kind],
			level: source.level,
			spansFloors: spanning.has(source.roomId),
		}));
	}

	update(
		camera: THREE.Vector3,
		dynamicLights: DynamicLight[],
		dt: number,
	): void {
		this.time += dt;
		const candidates = [...dynamicLights, ...this.staticLights]
			.map((light) => ({ light, score: this.score(light, camera) }))
			.filter((entry) => entry.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, this.slots.length);
		const wanted = new Map(
			candidates.map((entry) => [entry.light.id, entry.light]),
		);
		for (const slot of this.slots) {
			if (slot.sourceId && !wanted.has(slot.sourceId)) {
				slot.weight = Math.max(0, slot.weight - dt * 3);
				if (slot.weight === 0) {
					slot.sourceId = null;
				}
			}
		}
		for (const [id, light] of wanted) {
			let slot = this.slots.find((candidate) => candidate.sourceId === id);
			if (!slot) {
				slot = this.slots.find((candidate) => candidate.sourceId === null);
				if (!slot) {
					continue;
				}
				slot.sourceId = id;
				slot.weight = 0;
				slot.light.position.copy(light.position);
			}
			slot.weight = Math.min(1, slot.weight + dt * 3);
			this.apply(slot, light);
		}
		for (const slot of this.slots) {
			if (!slot.sourceId) {
				slot.light.intensity = 0;
			}
		}
	}

	private onOtherFloor(light: DynamicLight, camera: THREE.Vector3): boolean {
		const { lowest, highest } = floorsSeenFromEye(
			camera.y,
			EYE_HEIGHT_STANDING,
		);
		const level = light.level ?? levelForHeight(light.position.y - 1);
		if (level >= lowest && level <= highest) {
			return false;
		}
		return (
			!light.spansFloors ||
			Math.hypot(light.position.x - camera.x, light.position.z - camera.z) >
				light.radius + SPANNING_LIGHT_REACH
		);
	}

	private score(light: DynamicLight, camera: THREE.Vector3): number {
		if (this.onOtherFloor(light, camera)) {
			return 0;
		}
		const distance = this.scratch.copy(light.position).distanceTo(camera);
		const verticalPenalty =
			Math.abs(light.position.y - camera.y) > 3.2 ? 0.25 : 1;
		if (distance > light.radius + 22) {
			return 0;
		}
		return (
			(light.priority * verticalPenalty * light.intensity) /
			(1 + distance * distance * 0.08)
		);
	}

	private apply(slot: Slot, light: DynamicLight): void {
		const flickerAmount = this.reduceFlicker
			? light.flicker * 0.25
			: light.flicker;
		const seed = light.position.x * 3.1 + light.position.z * 1.7;
		const flicker =
			1 -
			flickerAmount *
				(0.5 +
					0.5 *
						Math.sin(this.time * 13 + seed) *
						Math.sin(this.time * 7.3 + seed * 2));
		slot.light.position.copy(light.position);
		slot.light.color.setHex(light.color);
		slot.light.distance = light.radius;
		slot.light.intensity = light.intensity * flicker * slot.weight;
	}

	dispose(scene: THREE.Scene): void {
		for (const slot of this.slots) {
			scene.remove(slot.light);
			slot.light.dispose();
		}
	}
}
