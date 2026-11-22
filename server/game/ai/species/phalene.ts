import {
	PHALENE_RETREAT_DISTANCE,
	PHALENE_RETREAT_MS,
	PHALENE_VISIONS_REACH,
} from "../../../../shared/config/index.js";
import { SPECIES } from "../../../../shared/config/species.js";
import type { Vec3 } from "../../../../shared/math.js";
import type { Match } from "../../Match.js";
import type { MatchPlayer } from "../../MatchPlayer.js";
import { startHallucination } from "../../systems/hallucination.js";
import type { AnomalyEntity } from "../AnomalyEntity.js";
import { inMeleeReach, meleeStrike, targetIsStrikeable } from "../combat.js";
import { startSearch, updateHunter } from "../hunter.js";
import {
	clearPath,
	faceTowards,
	hoverHeight,
	moveDirect,
} from "../locomotion.js";
import { perceive, VISUAL_MEMORY_MS } from "../perception.js";
import { meleeProfile } from "./profiles.js";

const DEFINITION = SPECIES.phalene;
const RETREAT_TURNS = [0, 0.5, -0.5, 1, -1, 1.35, -1.35];
const RETREAT_SPANS = [1, 0.65, 0.4];
const RETREAT_ARRIVAL = 0.3;

function seesVisions(match: Match, player: MatchPlayer): boolean {
	return player.hallucinating(match.now);
}

function dazzle(
	match: Match,
	entity: AnomalyEntity,
	target: MatchPlayer,
): boolean {
	if (
		!targetIsStrikeable(match, target) ||
		!inMeleeReach(match, entity, target, PHALENE_VISIONS_REACH)
	) {
		return false;
	}

	startHallucination(match, target, entity);

	return true;
}

const PROFILE = meleeProfile(DEFINITION, {
	readyToAttack: (match, entity, target) =>
		inMeleeReach(
			match,
			entity,
			target,
			seesVisions(match, target) ? -0.05 : PHALENE_VISIONS_REACH - 0.3,
		),
	strike: (match, entity, target) => {
		const visions = !seesVisions(match, target);

		const hit = visions
			? dazzle(match, entity, target)
			: meleeStrike(match, entity, target);

		match.emit({
			type: "attack",
			anomalyId: entity.id,
			phase: "strike",
			targetId: target.id,
			hit,
		});

		if (hit) {
			retreatFrom(match, entity, target);
		}
	},
});

export function updatePhalene(
	match: Match,
	entity: AnomalyEntity,
	dt: number,
): void {
	const perception = perceive(match, entity, dt);

	if (entity.state === "special") {
		flutterAway(match, entity, dt);
	} else {
		updateHunter(match, entity, dt, PROFILE, perception);
	}

	const preyId = entity.attackTargetId ?? entity.targetId;
	const prey = preyId ? match.players.get(preyId) : undefined;

	entity.stingReady = prey ? seesVisions(match, prey) : false;
}

export function phaleneExtra(entity: AnomalyEntity): number {
	return entity.stingReady ? 1 : 0;
}

function feetOf(entity: AnomalyEntity): Vec3 {
	return {
		x: entity.position.x,
		y: entity.position.y - hoverHeight(entity),
		z: entity.position.z,
	};
}

function retreatCandidate(
	match: Match,
	feet: Vec3,
	from: Vec3,
	angle: number,
	span: number,
): Vec3 | null {
	const reach = PHALENE_RETREAT_DISTANCE * span;

	const node = match.grid.nearestNode(
		{
			x: from.x + Math.sin(angle) * reach,
			y: feet.y,
			z: from.z + Math.cos(angle) * reach,
		},
		1,
	);

	if (node === null) {
		return null;
	}

	const point = match.grid.nodePosition(node);
	const gained = Math.hypot(point.x - from.x, point.z - from.z);
	const current = Math.hypot(feet.x - from.x, feet.z - from.z);

	return Math.abs(point.y - feet.y) < 1.2 &&
		gained > current + 0.8 &&
		match.finder.walkableLine(feet, point, match.gridLevelOf(feet))
		? point
		: null;
}

function chooseRetreat(
	match: Match,
	entity: AnomalyEntity,
	from: Vec3,
): Vec3 | null {
	const feet = feetOf(entity);
	const away = Math.atan2(feet.x - from.x, feet.z - from.z);

	for (const span of RETREAT_SPANS) {
		for (const turn of RETREAT_TURNS) {
			const point = retreatCandidate(match, feet, from, away + turn, span);

			if (point) {
				return point;
			}
		}
	}

	return null;
}

function retreatFrom(
	match: Match,
	entity: AnomalyEntity,
	target: MatchPlayer,
): void {
	clearPath(entity);

	entity.velocity = { x: 0, y: 0, z: 0 };
	entity.retreatPoint = chooseRetreat(match, entity, target.position);

	entity.setState("special", match.now);
}

function resumeHunt(match: Match, entity: AnomalyEntity): void {
	const target = entity.targetId
		? match.players.get(entity.targetId)
		: undefined;

	const memory = target ? entity.memory.get(target.id) : undefined;

	entity.retreatPoint = null;

	if (
		target?.alive &&
		memory &&
		match.now - memory.lastSeenAt < VISUAL_MEMORY_MS
	) {
		entity.setState("chase", match.now);
	} else {
		startSearch(match, entity);
	}
}

function flutterAway(match: Match, entity: AnomalyEntity, dt: number): void {
	const target = entity.targetId
		? match.players.get(entity.targetId)
		: undefined;

	if (!target?.alive || entity.stateAge(match.now) >= PHALENE_RETREAT_MS) {
		resumeHunt(match, entity);

		return;
	}

	const goal = entity.retreatPoint;
	const feet = feetOf(entity);

	const remaining = goal
		? Math.hypot(goal.x - feet.x, goal.z - feet.z)
		: Number.POSITIVE_INFINITY;

	if (
		!goal ||
		remaining <= RETREAT_ARRIVAL ||
		!moveDirect(match, entity, goal, DEFINITION.hostileSpeed, dt)
	) {
		entity.retreatPoint = null;
		entity.velocity = { x: 0, y: 0, z: 0 };
	}

	faceTowards(entity, target.position, 7, dt);
}
