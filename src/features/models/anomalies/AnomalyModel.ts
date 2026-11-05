import type { AnomalyState } from "@shared/protocol/game";
import * as THREE from "three";
import type { ModelKit } from "../modelKit";

export interface AnomalyPoseInput {
	state: AnomalyState;
	stateMs: number;
	extra: number;
	speed: number;
	dt: number;
	time: number;
	clearance?: readonly number[];
}

export interface GlowSpec {
	color: number;
	intensity: number;
	radius: number;
	offset: THREE.Vector3;
}

export interface EmitterSpec {
	anchor: THREE.Object3D;
	rate: number;
	color: number;
	speed: number;
	up?: number;
	life?: number;
	size?: number;
	gravity?: number;
	spread?: number;
}

export abstract class AnomalyModel {
	readonly root = new THREE.Group();
	glow: GlowSpec | null = null;
	readonly emitters: EmitterSpec[] = [];
	protected walkPhase = Math.random() * Math.PI * 2;
	private readonly owned: THREE.Material[] = [];

	constructor(protected readonly kit: ModelKit) {}

	abstract update(input: AnomalyPoseInput): void;

	preparePortrait(): void {}

	protected advanceWalk(input: AnomalyPoseInput, stride: number): number {
		this.walkPhase += input.dt * (1.5 + input.speed * stride);
		return this.walkPhase;
	}

	protected windup(input: AnomalyPoseInput, duration: number): number {
		if (input.state !== "windup") {
			return 0;
		}
		return Math.min(1, input.stateMs / duration);
	}

	protected strike(input: AnomalyPoseInput, duration = 260): number {
		if (input.state !== "recover") {
			return 0;
		}
		return Math.max(0, 1 - input.stateMs / duration);
	}

	protected follow(
		anchor: THREE.Object3D,
		target: THREE.Vector3,
	): THREE.Vector3 {
		anchor.getWorldPosition(target);
		return this.root.worldToLocal(target);
	}

	protected own<T extends THREE.Material>(material: T): T {
		this.owned.push(material);
		return material;
	}

	dispose(): void {
		this.root.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
			}
		});
		for (const material of this.owned) {
			material.dispose();
		}
	}
}

export function easeOut(t: number): number {
	return 1 - (1 - t) * (1 - t);
}
