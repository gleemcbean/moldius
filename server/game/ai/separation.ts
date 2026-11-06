import {
	SEPARATION_GAP,
	SEPARATION_MAX_PUSH,
	SEPARATION_PLAYER_GAP,
	SEPARATION_SAME_FLOOR,
} from "../../../shared/config/index.js";
import type { Match } from "../Match.js";
import type { AnomalyEntity } from "./AnomalyEntity.js";
import { hoverHeight } from "./locomotion.js";

const NUDGE_TURNS = [0, Math.PI / 2, -Math.PI / 2, Math.PI];

function bodyRadius(entity: AnomalyEntity): number {
	return Math.min(0.8, Math.max(0.35, entity.definition.aimRadius));
}

function anchored(entity: AnomalyEntity): boolean {
	return entity.species === "archiviste";
}

function travelling(a: AnomalyEntity, b: AnomalyEntity): boolean {
	return a.hostId === b.id || b.hostId === a.id;
}

function nudge(
	match: Match,
	entity: AnomalyEntity,
	x: number,
	z: number,
): boolean {
	const hover = entity.definition.flying ? hoverHeight(entity) : 0;
	const feet = {
		x: entity.position.x,
		y: entity.position.y - hover,
		z: entity.position.z,
	};
	const target = { x: feet.x + x, y: feet.y, z: feet.z + z };
	if (!match.finder.walkableLine(feet, target, match.gridLevelOf(feet))) {
		return false;
	}
	entity.position.x = target.x;
	entity.position.z = target.z;
	return true;
}

function keepOffPlayers(match: Match, active: AnomalyEntity[]): void {
	for (const entity of active) {
		for (const player of match.players.values()) {
			if (
				!player.active ||
				player.carried ||
				Math.abs(player.position.y - entity.position.y) > SEPARATION_SAME_FLOOR
			) {
				continue;
			}
			const dx = entity.position.x - player.position.x;
			const dz = entity.position.z - player.position.z;
			const distance = Math.hypot(dx, dz);
			const overlap = bodyRadius(entity) + SEPARATION_PLAYER_GAP - distance;
			if (overlap > 0) {
				const push = Math.min(SEPARATION_MAX_PUSH, overlap);
				const angle = distance < 1e-3 ? entity.id + 0.7 : Math.atan2(dz, dx);
				NUDGE_TURNS.some((turn) =>
					nudge(
						match,
						entity,
						Math.cos(angle + turn) * push,
						Math.sin(angle + turn) * push,
					),
				);
			}
		}
	}
}

export function separateAnomalies(match: Match): void {
	const active = match.anomalies.filter((entity) => entity.active);
	keepOffPlayers(match, active);
	for (let i = 0; i < active.length; i += 1) {
		for (let j = i + 1; j < active.length; j += 1) {
			const a = active[i];
			const b = active[j];
			if (
				travelling(a, b) ||
				Math.abs(a.position.y - b.position.y) > SEPARATION_SAME_FLOOR
			) {
				continue;
			}
			let dx = b.position.x - a.position.x;
			let dz = b.position.z - a.position.z;
			let distance = Math.hypot(dx, dz);
			const overlap = bodyRadius(a) + bodyRadius(b) + SEPARATION_GAP - distance;
			if (overlap <= 0) {
				continue;
			}
			if (distance < 1e-4) {
				const angle = (a.id * 2.399 + b.id) % (Math.PI * 2);
				dx = Math.cos(angle);
				dz = Math.sin(angle);
				distance = 1;
			}
			const nx = dx / distance;
			const nz = dz / distance;
			const push = Math.min(SEPARATION_MAX_PUSH, overlap);
			const shareA = anchored(a) ? 0 : anchored(b) ? 1 : 0.5;
			const shareB = anchored(b) ? 0 : 1 - shareA;
			if (shareA > 0) {
				nudge(match, a, -nx * push * shareA, -nz * push * shareA);
			}
			if (shareB > 0) {
				nudge(match, b, nx * push * shareB, nz * push * shareB);
			}
		}
	}
}
