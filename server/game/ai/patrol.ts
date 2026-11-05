import { PATROL_REVISIT_MS } from "../../../shared/config/index.js";
import type { Room } from "../../../shared/manor/types.js";
import type { Vec3 } from "../../../shared/math.js";
import type { Match } from "../Match.js";
import type { AnomalyEntity } from "./AnomalyEntity.js";
import { roomHasSpace } from "./dispersal.js";
import { requestPath } from "./locomotion.js";

const EXCLUDED = new Set(["stairwell", "closet", "toilets"]);

export function releaseClaim(match: Match, entity: AnomalyEntity): void {
	if (
		entity.destinationRoom !== null &&
		match.roomClaims.get(entity.destinationRoom) === entity.id
	) {
		match.roomClaims.delete(entity.destinationRoom);
	}
	entity.destinationRoom = null;
}

function roomScore(
	match: Match,
	entity: AnomalyEntity,
	room: Room,
	currentRoom: number | null,
): number {
	const distance =
		Math.hypot(
			room.labelPoint.x - entity.position.x,
			room.labelPoint.z - entity.position.z,
		) +
		Math.abs(room.floorY - entity.position.y) * 3;
	let score = distance < 6 ? 0.2 : distance > 45 ? 0.6 : 1.4;
	if (room.id === currentRoom) {
		score *= 0.05;
	}
	const visitedAt = match.roomVisits.get(room.id);
	score *=
		0.35 +
		(visitedAt === undefined
			? 1
			: Math.min(1, (match.now - visitedAt) / PATROL_REVISIT_MS));
	const claimant = match.roomClaims.get(room.id);
	if (claimant !== undefined && claimant !== entity.id) {
		score *= 0.08;
	}
	for (const other of match.anomalies) {
		if (other === entity || !other.active) {
			continue;
		}
		const near =
			Math.hypot(
				other.position.x - room.labelPoint.x,
				other.position.z - room.labelPoint.z,
			) +
			Math.abs(other.position.y - room.floorY) * 3;
		if (near < 10) {
			score *= 0.25;
		}
		const destination =
			other.destinationRoom !== null
				? match.layout.rooms[other.destinationRoom]
				: null;
		if (
			destination &&
			destination.level === room.level &&
			Math.hypot(
				destination.labelPoint.x - room.labelPoint.x,
				destination.labelPoint.z - room.labelPoint.z,
			) < 10
		) {
			score *= 0.4;
		}
	}
	return score * (0.6 + match.rng.next() * 0.8);
}

function withSpace(match: Match, entity: AnomalyEntity, rooms: Room[]): Room[] {
	const open = rooms.filter((room) => roomHasSpace(match, room.id, entity));
	return open.length > 0 ? open : rooms;
}

export function chooseSpreadDestination(
	match: Match,
	entity: AnomalyEntity,
): boolean {
	releaseClaim(match, entity);
	const others = match.anomalies.filter(
		(other) => other !== entity && other.active,
	);
	const ranked = withSpace(
		match,
		entity,
		match.layout.rooms.filter(
			(room) =>
				!EXCLUDED.has(room.type) &&
				(match.grid.roomCells.get(room.id)?.length ?? 0) > 4 &&
				(match.roomClaims.get(room.id) ?? entity.id) === entity.id,
		),
	)
		.map((room) => {
			const separation = Math.min(
				60,
				...others.flatMap((other) => {
					const destination =
						other.destinationRoom !== null
							? match.layout.rooms[other.destinationRoom]
							: null;
					const spots = [
						other.position,
						...(destination
							? [
									{
										x: destination.labelPoint.x,
										y: destination.floorY,
										z: destination.labelPoint.z,
									},
								]
							: []),
					];
					return spots.map(
						(spot) =>
							Math.hypot(
								spot.x - room.labelPoint.x,
								spot.z - room.labelPoint.z,
							) +
							Math.abs(spot.y - room.floorY) * 3,
					);
				}),
			);
			const travel =
				Math.hypot(
					room.labelPoint.x - entity.position.x,
					room.labelPoint.z - entity.position.z,
				) +
				Math.abs(room.floorY - entity.position.y) * 3;
			return {
				room,
				score: separation - travel * 0.25 + match.rng.next() * 3,
			};
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, 4);
	for (const { room } of ranked) {
		const point = randomPointInRoom(match, room);
		if (point && requestPath(match, entity, point)) {
			entity.destinationRoom = room.id;
			match.roomClaims.set(room.id, entity.id);
			return true;
		}
	}
	return false;
}

export function choosePatrolDestination(
	match: Match,
	entity: AnomalyEntity,
): boolean {
	releaseClaim(match, entity);
	entity.hurrying = false;
	const currentRoom = match.roomIdAt(entity.position);
	const rooms = withSpace(
		match,
		entity,
		match.layout.rooms.filter(
			(room) =>
				!EXCLUDED.has(room.type) &&
				(match.grid.roomCells.get(room.id)?.length ?? 0) > 4,
		),
	);
	const ranked = rooms
		.map((room) => ({
			room,
			score: roomScore(match, entity, room, currentRoom),
		}))
		.sort((a, b) => b.score - a.score)
		.slice(0, 4);
	for (const { room } of ranked) {
		const point = randomPointInRoom(match, room);
		if (point && requestPath(match, entity, point)) {
			entity.destinationRoom = room.id;
			match.roomClaims.set(room.id, entity.id);
			return true;
		}
	}
	return false;
}

export function randomPointInRoom(match: Match, room: Room): Vec3 | null {
	const cells = (match.grid.roomCells.get(room.id) ?? []).filter((node) =>
		match.grid.isInMainComponent(node),
	);
	if (cells.length === 0) {
		return null;
	}
	return match.grid.nodePosition(match.rng.pick(cells));
}

export function randomPointNear(
	match: Match,
	origin: Vec3,
	radius: number,
): Vec3 | null {
	for (let attempt = 0; attempt < 12; attempt += 1) {
		const angle = match.rng.range(0, Math.PI * 2);
		const distance = match.rng.range(0.8, radius);
		const candidate = {
			x: origin.x + Math.cos(angle) * distance,
			y: origin.y,
			z: origin.z + Math.sin(angle) * distance,
		};
		const node = match.grid.nearestNode(candidate, 1);
		if (node !== null) {
			const position = match.grid.nodePosition(node);
			if (
				Math.abs(position.y - origin.y) < 1.5 &&
				match.finder.walkableLine(origin, position, match.gridLevelOf(origin))
			) {
				return position;
			}
		}
	}
	return null;
}
