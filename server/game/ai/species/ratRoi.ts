import {
	RAT_KING_BITE_DAMAGE,
	RAT_KING_BITE_INTERVAL_MS,
	RAT_KING_GATHER_RATE,
	RAT_KING_LIGHT_RANGE,
	RAT_KING_REGROUP_DELAY_MS,
	RAT_KING_SCATTER_RATE,
	RAT_KING_SWARM_RADIUS,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import { lineOfSight } from "../../../../shared/physics/lineOfSight.js";
import type { Match } from "../../Match.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { updateHunter } from "../hunter.js";
import { clearPath } from "../locomotion.js";
import { releaseClaim } from "../patrol.js";
import { perceive } from "../perception.js";
import { meleeProfile } from "./profiles.js";

const DEFINITION = SPECIES["rat-roi"];
const PROFILE = meleeProfile(DEFINITION);

export function updateRatRoi(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	if (litByLantern(match, entity)) {
		entity.litAt = match.now;
		if (entity.state !== "special") {
			scatter(match, entity);
		}
	}
	if (entity.state === "special") {
		runSwarm(match, entity, dt);
		return;
	}
	updateHunter(match, entity, dt, PROFILE, perceive(match, entity, dt));
}

function litByLantern(match: Match, entity: AnomalyEntity): boolean {
	const center = entity.center();
	for (const player of match.players.values()) {
		if (!player.active || !player.lanternOpen) {
			continue;
		}
		const lantern = {
			x: player.position.x,
			y: player.position.y + 1.25,
			z: player.position.z,
		};
		if (
			Math.abs(player.position.y - entity.position.y) < 2.5 &&
			Math.hypot(lantern.x - center.x, lantern.z - center.z) <=
				RAT_KING_LIGHT_RANGE &&
			lineOfSight(match.world, lantern, center)
		) {
			return true;
		}
	}
	return false;
}

function scatter(match: Match, entity: AnomalyEntity): void {
	clearPath(entity);
	releaseClaim(match, entity);
	entity.attackTargetId = null;
	entity.velocity = { x: 0, y: 0, z: 0 };
	entity.nextBiteAt = match.now + RAT_KING_BITE_INTERVAL_MS;
	entity.setState("special", match.now);
}

function runSwarm(match: Match, entity: AnomalyEntity, dt: number): void {
	entity.velocity = { x: 0, y: 0, z: 0 };
	if (match.now - entity.litAt < RAT_KING_REGROUP_DELAY_MS) {
		entity.scatter = Math.min(1, entity.scatter + dt * RAT_KING_SCATTER_RATE);
	} else {
		entity.scatter = Math.max(0, entity.scatter - dt * RAT_KING_GATHER_RATE);
		if (entity.scatter === 0) {
			entity.setState("idle", match.now);
			entity.idleUntil = match.now + 600;
			return;
		}
	}
	if (match.now >= entity.nextBiteAt) {
		entity.nextBiteAt = match.now + RAT_KING_BITE_INTERVAL_MS;
		bite(match, entity);
	}
}

function bite(match: Match, entity: AnomalyEntity): void {
	const reach = RAT_KING_SWARM_RADIUS * entity.scatter;
	const center = entity.center();
	for (const player of match.players.values()) {
		if (
			player.active &&
			lineOfSight(match.world, center, {
				x: player.position.x,
				y: center.y,
				z: player.position.z,
			}) &&
			Math.abs(player.position.y - entity.position.y) < 1.5 &&
			Math.hypot(
				player.position.x - entity.position.x,
				player.position.z - entity.position.z,
			) <= reach
		) {
			match.applyDamage(
				player,
				RAT_KING_BITE_DAMAGE,
				entity.species,
				entity.center(),
				true,
			);
		}
	}
}
