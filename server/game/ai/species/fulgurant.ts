import {
	FULGURANT_BEAM_RADIUS,
	FULGURANT_LOCK_MS,
	FULGURANT_MIN_STAY_MS,
	FULGURANT_REARM_MS,
	FULGURANT_TRACK_MEMORY_MS,
	FULGURANT_UNWATCHED_MS,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import type { Vec3 } from "../../../../shared/math.js";
import { lineOfSight } from "../../../../shared/physics/lineOfSight.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { sameFloor, targetIsStrikeable } from "../combat.js";
import { canEngage, observedByPlayers } from "../dispersal.js";
import { clearPath, faceTowards } from "../locomotion.js";
import { releaseClaim } from "../patrol.js";
import { type PerceptionResult, perceive } from "../perception.js";

const DEFINITION = SPECIES.fulgurant;

const CANNON_SIDE = 0.32;
const CANNON_REACH = 0.62;
const CANNON_HEIGHT = 1.37;

interface Aim {
	point: Vec3;
	playerId: string;
}

export function muzzleToward(entity: AnomalyEntity, point: Vec3): Vec3 {
	const dx = point.x - entity.position.x;
	const dz = point.z - entity.position.z;
	const length = Math.hypot(dx, dz) || 1;
	const forward = { x: dx / length, z: dz / length };
	const side = { x: forward.z, z: -forward.x };
	const reach = Math.min(CANNON_REACH, Math.max(0, length - 0.6));
	return {
		x: entity.position.x + forward.x * reach + side.x * CANNON_SIDE,
		y: entity.position.y + CANNON_HEIGHT,
		z: entity.position.z + forward.z * reach + side.z * CANNON_SIDE,
	};
}

export function updateFulgurant(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	const perception = perceive(match, entity, dt);
	if (entity.state === "windup") {
		runCharge(match, entity, dt);
		return;
	}
	if (entity.state === "special") {
		runOverheat(match, entity);
		return;
	}
	const aim = pickAim(match, entity, perception);
	if (aim && match.now - entity.lastStrikeAt >= FULGURANT_REARM_MS) {
		startCharge(match, entity, aim);
		return;
	}
	lurk(match, entity, perception, dt);
}

function lurk(
	match: Match,
	entity: AnomalyEntity,
	perception: PerceptionResult,
	dt: number,
): void {
	entity.velocity = { x: 0, y: 0, z: 0 };
	if (entity.state !== "idle") {
		clearPath(entity);
		releaseClaim(match, entity);
		entity.setState("idle", match.now);
	}
	if (perception.heard?.playerId) {
		faceTowards(entity, perception.heard.position, 3, dt);
	}
	if (observedByPlayers(match, entity)) {
		entity.watchedAt = match.now;
		return;
	}
	if (
		match.now - entity.watchedAt >= FULGURANT_UNWATCHED_MS &&
		match.now - entity.spawnedAt >= FULGURANT_MIN_STAY_MS &&
		!match.placeAnomaly(entity)
	) {
		entity.watchedAt = match.now - FULGURANT_UNWATCHED_MS + 1_000;
	}
}

function pickAim(
	match: Match,
	entity: AnomalyEntity,
	perception: PerceptionResult,
): Aim | null {
	const candidates: Aim[] = [];
	const visible = perception.target;
	if (
		visible &&
		targetIsStrikeable(match, visible) &&
		canEngage(match, entity, visible)
	) {
		candidates.push({ point: leadOf(visible), playerId: visible.id });
		candidates.push({ point: chestOf(visible), playerId: visible.id });
	}
	const heard = perception.heard;
	if (heard?.playerId) {
		const source = match.players.get(heard.playerId);
		if (
			source?.alive &&
			!source.hidden &&
			!source.carried &&
			canEngage(match, entity, source)
		) {
			candidates.push({ point: leadOf(source), playerId: source.id });
			candidates.push({
				point: {
					x: heard.position.x,
					y: heard.position.y + source.bodyHeight() * 0.55,
					z: heard.position.z,
				},
				playerId: source.id,
			});
		}
	}
	return candidates.find((aim) => canShoot(match, entity, aim.point)) ?? null;
}

function canShoot(match: Match, entity: AnomalyEntity, point: Vec3): boolean {
	const origin = muzzleToward(entity, point);
	const distance = Math.hypot(
		point.x - origin.x,
		point.y - origin.y,
		point.z - origin.z,
	);
	return (
		distance > 1.2 &&
		distance <= DEFINITION.attackRange &&
		lineOfSight(match.world, origin, point, { blockGlass: true })
	);
}

function leadOf(player: MatchPlayer): Vec3 {
	const chest = chestOf(player);
	const lead = FULGURANT_LOCK_MS / 1000;
	return {
		x: chest.x + player.velocity.x * lead,
		y: chest.y,
		z: chest.z + player.velocity.z * lead,
	};
}

function locate(
	match: Match,
	entity: AnomalyEntity,
	player: MatchPlayer,
): Vec3[] {
	const memory = entity.memory.get(player.id);
	if (!memory || !targetIsStrikeable(match, player)) {
		return [];
	}
	if (memory.visibleNow) {
		return [leadOf(player), chestOf(player)];
	}
	const heardAgo = match.now - memory.lastHeardAt;
	const heard = memory.lastHeardPosition;
	if (!heard || heardAgo > FULGURANT_TRACK_MEMORY_MS) {
		return [];
	}
	const chest = { ...heard, y: heard.y + player.bodyHeight() * 0.55 };
	return heardAgo <= 120 ? [leadOf(player), chest] : [chest];
}

function chestOf(player: MatchPlayer): Vec3 {
	return {
		x: player.position.x,
		y: player.position.y + player.bodyHeight() * 0.55,
		z: player.position.z,
	};
}

function startCharge(match: Match, entity: AnomalyEntity, aim: Aim): void {
	entity.aimPoint = { ...aim.point };
	entity.attackTargetId = aim.playerId;
	clearPath(entity);
	releaseClaim(match, entity);
	entity.velocity = { x: 0, y: 0, z: 0 };
	entity.setState("windup", match.now);
	announceAim(match, entity);
}

function announceAim(match: Match, entity: AnomalyEntity): void {
	const aim = entity.aimPoint;
	if (!aim) {
		return;
	}
	entity.aimAnnouncedAt = match.now;
	match.emit({
		type: "laserCharge",
		anomalyId: entity.id,
		from: muzzleToward(entity, aim),
		target: { ...aim },
		until: match.now + DEFINITION.windupMs - entity.stateAge(match.now),
	});
}

function track(match: Match, entity: AnomalyEntity): void {
	const target = entity.attackTargetId
		? match.players.get(entity.attackTargetId)
		: undefined;
	const previous = entity.aimPoint;
	if (!target || !previous) {
		return;
	}
	const next = locate(match, entity, target).find((point) =>
		canShoot(match, entity, point),
	);
	if (!next) {
		return;
	}
	entity.aimPoint = next;
	const moved = Math.hypot(
		next.x - previous.x,
		next.y - previous.y,
		next.z - previous.z,
	);
	if (moved > 0.15 && match.now - entity.aimAnnouncedAt >= 100) {
		announceAim(match, entity);
	}
}

function runCharge(match: Match, entity: AnomalyEntity, dt: number): void {
	const aim = entity.aimPoint;
	entity.velocity = { x: 0, y: 0, z: 0 };
	if (!aim) {
		entity.setState("idle", match.now);
		return;
	}
	if (entity.stateAge(match.now) < DEFINITION.windupMs - FULGURANT_LOCK_MS) {
		track(match, entity);
	}
	faceTowards(entity, entity.aimPoint ?? aim, 10, dt);
	if (entity.stateAge(match.now) < DEFINITION.windupMs) {
		return;
	}
	fireBeam(match, entity, entity.aimPoint ?? aim);
	entity.lastStrikeAt = match.now;
	entity.aimPoint = null;
	entity.attackTargetId = null;
	entity.setState("special", match.now);
}

function runOverheat(match: Match, entity: AnomalyEntity): void {
	entity.velocity = { x: 0, y: 0, z: 0 };
	if (entity.stateAge(match.now) >= DEFINITION.recoveryMs) {
		entity.setState("idle", match.now);
		entity.idleUntil = match.now + 500;
	}
}

export function fireBeam(
	match: Match,
	entity: AnomalyEntity,
	aim: Vec3,
): string[] {
	const origin = muzzleToward(entity, aim);
	const length =
		Math.hypot(aim.x - origin.x, aim.y - origin.y, aim.z - origin.z) || 1;
	const direction = {
		x: (aim.x - origin.x) / length,
		y: (aim.y - origin.y) / length,
		z: (aim.z - origin.z) / length,
	};
	const end = beamEnd(match, origin, direction, DEFINITION.attackRange);
	const hits: string[] = [];
	for (const player of match.players.values()) {
		if (
			!targetIsStrikeable(match, player) ||
			!sameFloor(entity, player) ||
			beamDistance(origin, end, player) > FULGURANT_BEAM_RADIUS ||
			!lineOfSight(match.world, origin, chestOf(player), { blockGlass: true })
		) {
			continue;
		}
		if (match.applyDamage(player, DEFINITION.damage, "fulgurant", origin)) {
			hits.push(player.id);
		}
	}
	match.emit({
		type: "laser",
		anomalyId: entity.id,
		from: origin,
		to: end,
		hits,
	});
	return hits;
}

function beamEnd(
	match: Match,
	origin: Vec3,
	direction: Vec3,
	range: number,
): Vec3 {
	const at = (distance: number) => ({
		x: origin.x + direction.x * distance,
		y: origin.y + direction.y * distance,
		z: origin.z + direction.z * distance,
	});
	if (lineOfSight(match.world, origin, at(range), { blockGlass: true })) {
		return at(range);
	}
	let low = 0;
	let high = range;
	for (let step = 0; step < 14; step += 1) {
		const middle = (low + high) / 2;
		if (lineOfSight(match.world, origin, at(middle), { blockGlass: true })) {
			low = middle;
		} else {
			high = middle;
		}
	}
	return at(low);
}

function beamDistance(from: Vec3, to: Vec3, player: MatchPlayer): number {
	const bottom = player.position.y + 0.25;
	const top = player.position.y + player.bodyHeight() - 0.1;
	const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
	const steps = Math.max(1, Math.ceil(length / 0.1));
	let best = Infinity;
	for (let step = 0; step <= steps; step += 1) {
		const t = step / steps;
		const x = from.x + (to.x - from.x) * t;
		const y = from.y + (to.y - from.y) * t;
		const z = from.z + (to.z - from.z) * t;
		const vertical = y < bottom ? bottom - y : y > top ? y - top : 0;
		best = Math.min(
			best,
			Math.hypot(x - player.position.x, z - player.position.z, vertical),
		);
	}
	return best;
}
