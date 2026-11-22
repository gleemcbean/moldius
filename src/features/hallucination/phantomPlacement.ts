import type { Vec3 } from "@shared/math";
import { circleBoxPenetration } from "@shared/physics/character";
import type { CollisionWorld } from "@shared/physics/collisionWorld";
import { lineOfSight } from "@shared/physics/lineOfSight";
import * as THREE from "three";

const BODY_RADIUS = 0.38;
const PATH_RADIUS = 0.3;
const PATH_STEP = 0.35;
const PATH_MARGIN = 1.2;
const SPACING = 2.5;
const ATTEMPTS = 28;

export interface Viewpoint {
	eye: THREE.Vector3;
	forward: THREE.Vector3;
	feet: Vec3;
}

export interface SpawnRule {
	near: number;
	far: number;
	sight: "hidden" | "visible" | "any";
	walk: boolean;
}

export function inView(
	view: Viewpoint,
	point: THREE.Vector3,
	cone = 0.62,
): boolean {
	const toward = point.clone().sub(view.eye);
	const distance = toward.length();

	return distance > 0.01 && toward.dot(view.forward) / distance > cone;
}

export function standingSpot(
	world: CollisionWorld,
	point: Vec3,
	radius = BODY_RADIUS,
): Vec3 | null {
	const region = world.regionAt(point, point.y + 0.3);

	if (!region) {
		return null;
	}

	const floor = world.regionFloorY(region, point);

	if (
		Math.abs(floor - point.y) > 0.5 ||
		world.distanceToWalls(point, floor + 0.3, floor + 1.6, radius + 0.1) <
			radius
	) {
		return null;
	}

	const bounds = {
		minX: point.x - radius,
		maxX: point.x + radius,
		minZ: point.z - radius,
		maxZ: point.z + radius,
	};

	for (const id of world.queryBoxes(bounds)) {
		const box = world.boxes[id];

		if (
			box.enabled &&
			box.yMax > floor + 0.2 &&
			box.yMin < floor + 1.7 &&
			circleBoxPenetration(point.x, point.z, radius, box)
		) {
			return null;
		}
	}

	return { x: point.x, y: floor, z: point.z };
}

export function walkable(world: CollisionWorld, from: Vec3, to: Vec3): boolean {
	const distance = Math.hypot(to.x - from.x, to.z - from.z);
	const span = Math.max(0, distance - PATH_MARGIN);
	const steps = Math.max(1, Math.ceil(span / PATH_STEP));

	for (let step = 1; step <= steps; step += 1) {
		const t = (step / steps) * (span / Math.max(distance, 1e-3));

		const spot = standingSpot(
			world,
			{
				x: from.x + (to.x - from.x) * t,
				y: from.y + (to.y - from.y) * t,
				z: from.z + (to.z - from.z) * t,
			},
			PATH_RADIUS,
		);

		if (!spot) {
			return false;
		}
	}

	return true;
}

export function findSpawn(
	world: CollisionWorld,
	view: Viewpoint,
	rule: SpawnRule,
	taken: readonly Vec3[],
	random: () => number,
): Vec3 | null {
	for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
		const angle = random() * Math.PI * 2;
		const distance = rule.near + random() * (rule.far - rule.near);

		const spot = standingSpot(world, {
			x: view.feet.x + Math.cos(angle) * distance,
			y: view.feet.y,
			z: view.feet.z + Math.sin(angle) * distance,
		});

		if (
			!spot ||
			taken.some(
				(other) => Math.hypot(other.x - spot.x, other.z - spot.z) < SPACING,
			)
		) {
			continue;
		}

		const head = new THREE.Vector3(spot.x, spot.y + 1.3, spot.z);
		const knee = new THREE.Vector3(spot.x, spot.y + 0.5, spot.z);

		const sighted =
			lineOfSight(world, view.eye, head) && lineOfSight(world, view.eye, knee);

		const fits =
			rule.sight === "any" ||
			(rule.sight === "visible"
				? sighted && inView(view, head)
				: sighted && !inView(view, head, 0.35));

		if (fits && (!rule.walk || walkable(world, spot, view.feet))) {
			return spot;
		}
	}

	return null;
}
