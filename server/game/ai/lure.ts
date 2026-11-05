import {
	SHOUT_LURE_MAX_MS,
	SHOUT_LURE_RANGE,
	SHOUT_LURE_STOP_DISTANCE,
} from "../../../shared/config/index.js";
import type { SpeciesId } from "../../../shared/config/species.js";
import type { Vec3 } from "../../../shared/math.js";
import type { Match } from "../Match.js";
import type { AnomalyEntity } from "./AnomalyEntity.js";
import { requestPath } from "./locomotion.js";
import { releaseClaim } from "./patrol.js";

const LURED_SPECIES: ReadonlySet<SpeciesId> = new Set([
	"murmure",
	"veilleur",
	"crache-cendre",
	"collecteur",
	"double",
	"suinteur",
	"boursoufle",
	"colosse",
	"rat-roi",
]);
const INTERRUPTIBLE = new Set([
	"idle",
	"patrol",
	"travel",
	"search",
	"investigate",
]);

function stopShort(entity: AnomalyEntity, position: Vec3): void {
	while (entity.path.length > 0) {
		const last = entity.path[entity.path.length - 1];
		if (
			Math.hypot(last.x - position.x, last.z - position.z) >=
				SHOUT_LURE_STOP_DISTANCE ||
			Math.abs(last.y - position.y) > 1
		) {
			return;
		}
		entity.path.pop();
	}
}

export function lureAnomalies(
	match: Match,
	position: Vec3,
	playerId: string,
): number {
	let lured = 0;
	for (const entity of match.anomalies) {
		if (
			!entity.active ||
			!LURED_SPECIES.has(entity.species) ||
			!INTERRUPTIBLE.has(entity.state) ||
			Math.hypot(
				position.x - entity.position.x,
				position.y - entity.position.y,
				position.z - entity.position.z,
			) > SHOUT_LURE_RANGE ||
			!requestPath(match, entity, position)
		) {
			continue;
		}
		stopShort(entity, position);
		releaseClaim(match, entity);
		entity.targetId = null;
		entity.luredUntil = match.now + SHOUT_LURE_MAX_MS;
		entity.interestPlayerId = playerId;
		entity.setState("investigate", match.now);
		lured += 1;
	}
	return lured;
}
