import {
	MURMUR_AWAKEN_MS,
	MURMUR_LANTERN_TRIGGER_RANGE,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import { lineOfSight } from "../../../../shared/physics/lineOfSight.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { canEngage } from "../dispersal.js";
import { updateHunter } from "../hunter.js";
import { clearPath, faceTowards } from "../locomotion.js";
import { releaseClaim } from "../patrol.js";
import { type PerceptionResult, perceive } from "../perception.js";
import { meleeProfile } from "./profiles.js";

const HOSTILE = meleeProfile(SPECIES.murmure);
const CALM = meleeProfile(SPECIES.murmure, {
	canHunt: false,
	canInvestigate: false,
	canExtract: false,
});

export function updateMurmure(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	const perception = perceive(match, entity, dt);
	if (entity.hostile) {
		updateHunter(match, entity, dt, HOSTILE, perception);
		if (
			(entity.state === "patrol" || entity.state === "idle") &&
			entity.targetId === null
		) {
			entity.hostile = false;
		}
		return;
	}
	if (entity.state === "special") {
		runAwakening(match, entity, dt);
		return;
	}
	const trigger = findTrigger(match, entity, perception);
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
		return;
	}
	updateHunter(match, entity, dt, CALM, perception);
}

function runAwakening(match: Match, entity: AnomalyEntity, dt: number): void {
	const target = entity.targetId
		? match.players.get(entity.targetId)
		: undefined;
	if (target) {
		faceTowards(entity, target.position, 4, dt);
	}
	if (entity.stateAge(match.now) >= MURMUR_AWAKEN_MS) {
		entity.hostile = true;
		entity.setState("chase", match.now);
	}
}

function findTrigger(
	match: Match,
	entity: AnomalyEntity,
	perception: PerceptionResult,
): MatchPlayer | null {
	const eye = entity.eye();
	for (const player of match.players.values()) {
		if (
			!player.active ||
			!player.lanternOpen ||
			player.protectedUntil > match.now ||
			!canEngage(match, entity, player)
		) {
			continue;
		}
		const distance = Math.hypot(
			player.position.x - entity.position.x,
			player.position.z - entity.position.z,
		);
		if (
			distance > MURMUR_LANTERN_TRIGGER_RANGE ||
			Math.abs(player.position.y - entity.position.y) > 2.5
		) {
			continue;
		}
		const lantern = {
			x: player.position.x,
			y: player.position.y + 1.25,
			z: player.position.z,
		};
		if (lineOfSight(match.world, eye, lantern)) {
			return player;
		}
	}
	const sound = perception.heard;
	if (
		sound?.playerId &&
		(sound.kind === "voice" ||
			sound.kind === "shout" ||
			sound.kind === "footsteps")
	) {
		const player = match.players.get(sound.playerId);
		if (player?.active && canEngage(match, entity, player)) {
			return player;
		}
	}
	return null;
}
