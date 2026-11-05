import { SPECIES } from "@shared/config/species";
import type { CollisionWorld } from "@shared/physics/collisionWorld";
import { lineOfSight } from "@shared/physics/lineOfSight";
import * as THREE from "three";
import { soundBank } from "../../audio/soundBank";
import type { AnomalyRenderInfo } from "../entities/AnomalyViews";

const HUNTING_STATES = new Set([
	"chase",
	"windup",
	"extract",
	"special",
	"recover",
]);
const MAX_SNAPSHOT_AGE_MS = 650;

export class SpottedDetector {
	intensity = 0;
	private readonly frustum = new THREE.Frustum();
	private readonly matrix = new THREE.Matrix4();
	private wasSpotted = false;
	private lastSting = -Infinity;

	constructor(private readonly world: CollisionWorld) {}

	update(
		dt: number,
		camera: THREE.PerspectiveCamera,
		selfId: string,
		infos: AnomalyRenderInfo[],
		snapshotAge: number,
		now: number,
	): number {
		this.matrix.multiplyMatrices(
			camera.projectionMatrix,
			camera.matrixWorldInverse,
		);
		this.frustum.setFromProjectionMatrix(this.matrix);
		const eye = camera.getWorldPosition(new THREE.Vector3());
		let spotted = false;
		if (snapshotAge <= MAX_SNAPSHOT_AGE_MS) {
			for (const info of infos) {
				const definition = SPECIES[info.species];
				const revealedDouble = info.species !== "double" || info.mimic === null;
				if (
					!definition.hostile ||
					!revealedDouble ||
					info.targetId !== selfId ||
					!info.aware ||
					!HUNTING_STATES.has(info.state)
				) {
					continue;
				}
				if (
					info.species === "murmure" &&
					info.extra < 0.5 &&
					info.state !== "special"
				) {
					continue;
				}
				const sphere = new THREE.Sphere(
					info.center,
					definition.aimRadius + 0.2,
				);
				if (!this.frustum.intersectsSphere(sphere)) {
					continue;
				}
				const top = info.center.clone();
				top.y += definition.bodyHeight * 0.35;
				if (
					lineOfSight(this.world, eye, info.center) ||
					lineOfSight(this.world, eye, top)
				) {
					spotted = true;
					break;
				}
			}
		}
		const target = spotted ? 1 : 0;
		const speed = spotted ? 3.5 : 1.4;
		this.intensity += (target - this.intensity) * Math.min(1, dt * speed);
		if (spotted && !this.wasSpotted && now - this.lastSting > 8000) {
			this.lastSting = now;
			soundBank.play("spotted", { volume: 0.7 });
		}
		this.wasSpotted = spotted;
		return this.intensity;
	}
}
