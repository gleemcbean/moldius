import type { Vec2, Vec3 } from "../math.js";
import { circleBoxPenetration } from "../physics/character.js";
import type { CollisionWorld } from "../physics/collisionWorld.js";
import { pointInPolygon } from "./polygon.js";
import type { ManorLayout, MezzanineSpec, Room } from "./types.js";

export interface LeapSpot {
	roomId: number;
	start: Vec3;
	edge: Vec3;
	direction: Vec2;
	drop: number;
}

const RUN_UP = 3;
const RAIL_SAMPLES = [0.2, 0.35, 0.5, 0.65, 0.8];
const RUN_SAMPLES = [0.3, 0.8, 1.4, 2, 2.5, RUN_UP];
const LANDING_SAMPLES = [0.9, 1.5, 2, 2.5, 3, 3.5];
const BODY_RADIUS = 0.3;
const LANDING_RADIUS = 0.45;
const MIN_DROP = 1.6;

function along(point: Vec2, direction: Vec2, distance: number): Vec2 {
	return {
		x: point.x + direction.x * distance,
		z: point.z + direction.z * distance,
	};
}

function voidDirection(spec: MezzanineSpec, a: Vec2, b: Vec2): Vec2 | null {
	const length = Math.hypot(b.x - a.x, b.z - a.z);

	if (length < 0.5) {
		return null;
	}

	const normal = { x: -(b.z - a.z) / length, z: (b.x - a.x) / length };
	const middle = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };

	if (!pointInPolygon(along(middle, normal, 0.4), spec.deck)) {
		return normal;
	}

	const flipped = { x: -normal.x, z: -normal.z };

	return pointInPolygon(along(middle, flipped, 0.4), spec.deck)
		? null
		: flipped;
}

function runIsClear(
	world: CollisionWorld,
	spec: MezzanineSpec,
	edge: Vec2,
	direction: Vec2,
): boolean {
	return RUN_SAMPLES.every((distance) => {
		const point = along(edge, direction, -distance);

		return (
			pointInPolygon(point, spec.deck) &&
			world.boxes.every(
				(box) =>
					box.yMax < spec.floorY + 0.1 ||
					box.yMin > spec.floorY + 1.6 ||
					!circleBoxPenetration(point.x, point.z, BODY_RADIUS, box),
			)
		);
	});
}

function landingIsClear(
	world: CollisionWorld,
	room: Room,
	spec: MezzanineSpec,
	edge: Vec2,
	direction: Vec2,
): boolean {
	return LANDING_SAMPLES.every((distance) => {
		const point = along(edge, direction, distance);

		return (
			!pointInPolygon(point, spec.deck) &&
			!pointInPolygon(point, spec.stairPolygon) &&
			pointInPolygon(point, room.polygon) &&
			world.boxes.every(
				(box) =>
					box.yMin > spec.floorY - 1 ||
					box.yMax <= room.floorY + 0.05 ||
					!circleBoxPenetration(point.x, point.z, LANDING_RADIUS, box),
			)
		);
	});
}

export function findLeapSpots(
	layout: ManorLayout,
	world: CollisionWorld,
): LeapSpot[] {
	const spots: LeapSpot[] = [];

	for (const room of layout.rooms) {
		const spec = room.mezzanine;

		if (!spec || spec.floorY - room.floorY < MIN_DROP) {
			continue;
		}

		for (const rail of spec.rails) {
			const direction = voidDirection(spec, rail.a, rail.b);

			if (!direction) {
				continue;
			}

			for (const t of RAIL_SAMPLES) {
				const edge = {
					x: rail.a.x + (rail.b.x - rail.a.x) * t,
					z: rail.a.z + (rail.b.z - rail.a.z) * t,
				};

				if (
					!runIsClear(world, spec, edge, direction) ||
					!landingIsClear(world, room, spec, edge, direction)
				) {
					continue;
				}

				const start = along(edge, direction, -RUN_UP);

				spots.push({
					roomId: room.id,
					start: { x: start.x, y: spec.floorY, z: start.z },
					edge: { x: edge.x, y: spec.floorY, z: edge.z },
					direction,
					drop: spec.floorY - room.floorY,
				});
			}
		}
	}

	return spots;
}
