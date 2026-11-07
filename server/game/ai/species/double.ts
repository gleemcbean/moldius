import {
	DOPPELGANGER_LIGHT_REVEAL,
	DOPPELGANGER_PROXIMITY_REVEAL,
	DOPPELGANGER_REDISGUISE_AFTER_MS,
	DOPPELGANGER_REVEAL_MS,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import { lookDirection } from "../../../../shared/math.js";
import { lineOfSight } from "../../../../shared/physics/lineOfSight.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { canEngage } from "../dispersal.js";
import { updateHunter } from "../hunter.js";
import { clearPath, faceTowards } from "../locomotion.js";
import { releaseClaim } from "../patrol.js";
import { perceive } from "../perception.js";
import { meleeProfile } from "./profiles.js";

const HOSTILE = meleeProfile(SPECIES.double);
const DISGUISED = meleeProfile(SPECIES.double, {
	canHunt: false,
	canInvestigate: false,
	canExtract: false,
	patrolSpeed: SPECIES.double.calmSpeed,
});

export function updateDouble(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	if (needsNewMimic(match, entity)) {
		chooseMimic(match, entity);
	}
	const perception = perceive(match, entity, dt);
	if (entity.revealed) {
		updateHunter(match, entity, dt, HOSTILE, perception);
		if (
			entity.targetId === null &&
			match.now - entity.lostTargetAt > DOPPELGANGER_REDISGUISE_AFTER_MS &&
			entity.state === "patrol"
		) {
			entity.revealed = false;
			chooseMimic(match, entity);
		}
		return;
	}
	if (entity.state === "special") {
		const target = entity.targetId
			? match.players.get(entity.targetId)
			: undefined;
		if (target) {
			faceTowards(entity, target.position, 6, dt);
		}
		if (entity.stateAge(match.now) >= DOPPELGANGER_REVEAL_MS) {
			entity.revealed = true;
			entity.setState("chase", match.now);
		}
		return;
	}
	const trigger = revealTrigger(match, entity);
	if (trigger) {
		entity.targetId = trigger.id;
		const memory = entity.memoryFor(trigger.id);
		memory.awareness = 1.5;
		memory.lastSeenAt = match.now;
		memory.lastSeenPosition = { ...trigger.position };
		clearPath(entity);
		releaseClaim(match, entity);
		entity.velocity = { x: 0, y: 0, z: 0 };
		entity.setState("special", match.now);
		match.emit({ type: "reveal", anomalyId: entity.id });
		return;
	}
	updateHunter(match, entity, dt, DISGUISED, perception);
}

function canBeMimicked(player: MatchPlayer): boolean {
	return player.alive && player.connected;
}

/** Imiter un mort ou un absent le trahirait aussitôt sur la carte et au classement. */
function needsNewMimic(match: Match, entity: AnomalyEntity): boolean {
	const mimic = entity.mimicPlayerId
		? match.players.get(entity.mimicPlayerId)
		: undefined;
	if (!mimic) {
		return true;
	}
	return (
		!canBeMimicked(mimic) && [...match.players.values()].some(canBeMimicked)
	);
}

/** Entre deux joueurs tirés au sort, prend le plus loin : le vrai a moins de chances d'être à côté. */
function chooseMimic(match: Match, entity: AnomalyEntity): void {
	const players = [...match.players.values()];
	const active = players.filter(canBeMimicked);
	const pool = active.length > 0 ? active : players;
	if (pool.length === 0) {
		entity.mimicPlayerId = null;
		return;
	}
	const away = (player: MatchPlayer) =>
		Math.hypot(
			player.position.x - entity.position.x,
			player.position.z - entity.position.z,
		);
	const first = match.rng.pick(pool);
	const second = match.rng.pick(pool);
	entity.mimicPlayerId = (away(first) >= away(second) ? first : second).id;
}

function revealTrigger(
	match: Match,
	entity: AnomalyEntity,
): MatchPlayer | null {
	const center = entity.center();
	for (const player of match.players.values()) {
		if (
			!player.active ||
			player.protectedUntil > match.now ||
			!canEngage(match, entity, player)
		) {
			continue;
		}
		const eye = player.eyePosition();
		const distance = Math.hypot(
			eye.x - center.x,
			eye.y - center.y,
			eye.z - center.z,
		);
		if (
			distance <= DOPPELGANGER_PROXIMITY_REVEAL &&
			lineOfSight(match.world, eye, center)
		) {
			return player;
		}
		if (player.lanternOpen && distance <= DOPPELGANGER_LIGHT_REVEAL) {
			const look = lookDirection(player.yaw, player.pitch);
			const facing =
				(look.x * (center.x - eye.x) +
					look.y * (center.y - eye.y) +
					look.z * (center.z - eye.z)) /
				distance;
			if (
				facing > Math.cos((40 * Math.PI) / 180) &&
				lineOfSight(match.world, eye, center)
			) {
				return player;
			}
		}
	}
	return null;
}
