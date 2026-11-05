import {
	ANOMALY_PURSUERS_PER_PLAYER,
	ANOMALY_ROOM_CAPACITY,
	DISPERSAL_CHECK_INTERVAL_MS,
	DISPERSAL_OBSERVED_CONE_COS,
} from "../../../shared/config/index.js";
import type { SpeciesId } from "../../../shared/config/species.js";
import { lookDirection, type Vec3 } from "../../../shared/math.js";
import { lineOfSight } from "../../../shared/physics/lineOfSight.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";
import type { AnomalyEntity } from "./AnomalyEntity.js";

export const SPREAD_RADIUS = 9;
const ANCHORED: ReadonlySet<SpeciesId> = new Set([
	"luciole",
	"archiviste",
	"hurleur",
	"brume",
]);

export function isRoaming(entity: AnomalyEntity): boolean {
	return entity.active && !ANCHORED.has(entity.species);
}

export function engagedPlayer(entity: AnomalyEntity): string | null {
	if (!isRoaming(entity)) {
		return null;
	}
	if (entity.carryingPlayerId) {
		return entity.carryingPlayerId;
	}
	switch (entity.state) {
		case "chase":
		case "recover":
		case "special":
			return entity.targetId;
		case "windup":
			return entity.attackTargetId ?? entity.targetId;
		case "extract":
			return entity.witnessed?.playerId ?? null;
		case "investigate":
			return entity.interestPlayerId;
		default:
			return null;
	}
}

function committed(entity: AnomalyEntity): boolean {
	return entity.state !== "chase" && entity.state !== "investigate";
}

function separation(entity: AnomalyEntity, point: Vec3): number {
	return (
		Math.hypot(point.x - entity.position.x, point.z - entity.position.z) +
		Math.abs(point.y - entity.position.y) * 3
	);
}

function pursuersOf(match: Match, playerId: string): AnomalyEntity[] {
	return match.anomalies.filter((other) => engagedPlayer(other) === playerId);
}

function roomTooBusy(
	match: Match,
	entity: AnomalyEntity,
	player: MatchPlayer,
): boolean {
	const room = match.roomIdAt(player.position);
	if (room === null || match.roomIdAt(entity.position) === room) {
		return false;
	}
	let busy = 0;
	for (const other of match.anomalies) {
		if (
			other !== entity &&
			engagedPlayer(other) !== null &&
			match.roomIdAt(other.position) === room
		) {
			busy += 1;
		}
	}
	return busy >= ANOMALY_ROOM_CAPACITY;
}

export function canEngage(
	match: Match,
	entity: AnomalyEntity,
	player: MatchPlayer,
): boolean {
	if ((entity.ignoredUntil.get(player.id) ?? 0) > match.now) {
		return false;
	}
	if (!isRoaming(entity) || engagedPlayer(entity) === player.id) {
		return true;
	}
	const rivals = pursuersOf(match, player.id).filter(
		(other) => other !== entity,
	);
	return (
		rivals.length < ANOMALY_PURSUERS_PER_PLAYER &&
		!roomTooBusy(match, entity, player)
	);
}

export function interestToDrop(
	match: Match,
	entity: AnomalyEntity,
): string | null {
	if (entity.state !== "chase" && entity.state !== "investigate") {
		return null;
	}
	const playerId = engagedPlayer(entity);
	if (!playerId) {
		return null;
	}
	const player = match.players.get(playerId);
	const rivals = pursuersOf(match, playerId);
	if (rivals.length > ANOMALY_PURSUERS_PER_PLAYER) {
		const anchor = player?.position ?? entity.position;
		rivals.sort(
			(a, b) =>
				Number(committed(b)) - Number(committed(a)) ||
				separation(a, anchor) - separation(b, anchor) ||
				a.id - b.id,
		);
		if (rivals.indexOf(entity) >= ANOMALY_PURSUERS_PER_PLAYER) {
			return playerId;
		}
	}
	if (
		entity.state === "chase" &&
		player &&
		roomTooBusy(match, entity, player)
	) {
		return playerId;
	}
	return null;
}

function countedRoom(match: Match, entity: AnomalyEntity): number | null {
	if (
		(entity.state === "patrol" || entity.state === "travel") &&
		entity.destinationRoom !== null
	) {
		return entity.destinationRoom;
	}
	return match.roomIdAt(entity.position);
}

function roomLoad(match: Match, roomId: number, entity: AnomalyEntity): number {
	let load = 0;
	for (const other of match.anomalies) {
		if (
			other !== entity &&
			isRoaming(other) &&
			countedRoom(match, other) === roomId
		) {
			load += 1;
		}
	}
	return load;
}

export function roomHasSpace(
	match: Match,
	roomId: number,
	entity: AnomalyEntity,
): boolean {
	return roomLoad(match, roomId, entity) < ANOMALY_ROOM_CAPACITY;
}

function overRoomCapacity(match: Match, entity: AnomalyEntity): boolean {
	const room = match.roomIdAt(entity.position);
	if (room === null || countedRoom(match, entity) !== room) {
		return false;
	}
	const occupants = match.anomalies.filter(
		(other) => isRoaming(other) && countedRoom(match, other) === room,
	);
	if (occupants.length <= ANOMALY_ROOM_CAPACITY) {
		return false;
	}
	occupants.sort(
		(a, b) =>
			Number(engagedPlayer(b) !== null) - Number(engagedPlayer(a) !== null) ||
			a.id - b.id,
	);
	return occupants.indexOf(entity) >= ANOMALY_ROOM_CAPACITY;
}

export function observedByPlayers(
	match: Match,
	entity: AnomalyEntity,
): boolean {
	const center = entity.center();
	for (const player of match.players.values()) {
		if (!player.alive || !player.connected || player.hidden) {
			continue;
		}
		const eye = player.eyePosition();
		const dx = center.x - eye.x;
		const dy = center.y - eye.y;
		const dz = center.z - eye.z;
		const distance = Math.hypot(dx, dy, dz);
		if (distance > 40) {
			continue;
		}
		const look = lookDirection(player.yaw, player.pitch);
		const facing = (look.x * dx + look.y * dy + look.z * dz) / (distance || 1);
		if (
			(distance < 4 || facing > DISPERSAL_OBSERVED_CONE_COS) &&
			lineOfSight(match.world, eye, center, { ignoreFurniture: true })
		) {
			return true;
		}
	}
	return false;
}

export function crowdingNeighbor(
	match: Match,
	entity: AnomalyEntity,
): AnomalyEntity | null {
	for (const other of match.anomalies) {
		if (other === entity || !other.active || ANCHORED.has(other.species)) {
			continue;
		}
		if (Math.abs(other.position.y - entity.position.y) > 2.5) {
			continue;
		}
		if (
			Math.hypot(
				other.position.x - entity.position.x,
				other.position.z - entity.position.z,
			) < SPREAD_RADIUS
		) {
			return other;
		}
	}
	return null;
}

export function shouldDisperse(match: Match, entity: AnomalyEntity): boolean {
	if (ANCHORED.has(entity.species) || match.now < entity.nextSpreadCheckAt) {
		return false;
	}
	entity.nextSpreadCheckAt = match.now + DISPERSAL_CHECK_INTERVAL_MS;
	if (entity.state === "travel") {
		entity.hurrying = entity.hurrying && !observedByPlayers(match, entity);
		return false;
	}
	if (overRoomCapacity(match, entity)) {
		return true;
	}
	return (
		crowdingNeighbor(match, entity) !== null &&
		!observedByPlayers(match, entity)
	);
}
