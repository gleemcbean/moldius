import type { CompulsionOrder } from "../../../shared/anomalies/compulsion.js";
import {
	COMPULSION_GAP_MAX_MS,
	COMPULSION_GAP_MIN_MS,
	COMPULSION_LANTERN_MS,
	COMPULSION_LEAP_MS,
	COMPULSION_LEAP_RANGE,
	COMPULSION_LURE_MS,
	COMPULSION_LURE_RANGE,
	COMPULSION_LURE_STOP,
	COMPULSION_SCREAM_MS,
	INFECTED_SCREAM_LOUDNESS,
	INFECTION_IMMUNITY_MS,
	INFECTION_INCUBATION_MS,
	INFECTION_MS,
	SHOUT_DURATION_MS,
} from "../../../shared/config/index.js";
import { findLeapSpots, type LeapSpot } from "../../../shared/manor/ledges.js";
import { hasMutator } from "../../../shared/matchConfig.js";
import type { Vec3 } from "../../../shared/math.js";
import type { CompulsionKind } from "../../../shared/protocol/game.js";
import type { AnomalyEntity } from "../ai/AnomalyEntity.js";
import { lureAnomalies } from "../ai/lure.js";
import type { Match } from "../Match.js";
import type { MatchPlayer } from "../MatchPlayer.js";

const DURATIONS: Record<CompulsionKind, number> = {
	scream: COMPULSION_SCREAM_MS,
	expel: COMPULSION_SCREAM_MS,
	lure: COMPULSION_LURE_MS,
	leap: COMPULSION_LEAP_MS,
	lantern: COMPULSION_LANTERN_MS,
};

const WEIGHTS: Record<CompulsionKind, number> = {
	scream: 1,
	expel: 1,
	lure: 1.4,
	leap: 2.2,
	lantern: 0.8,
};

const LEAP_CANDIDATES = 4;
const LURE_CANDIDATES = 3;
const leapCache = new WeakMap<Match, LeapSpot[]>();

function leapSpots(match: Match): LeapSpot[] {
	let spots = leapCache.get(match);

	if (!spots) {
		spots = findLeapSpots(match.layout, match.world);

		leapCache.set(match, spots);
	}

	return spots;
}

function walkPath(match: Match, from: Vec3, to: Vec3): Vec3[] | null {
	const path = match.finder.findPath(from, to, {
		canOpenDoors: false,
		isDoorClosed: (doorId) => match.doors.isClosed(doorId),
		maxExpansions: 20_000,
	});

	if (!path || path.length === 0) {
		return null;
	}

	return path.map((point) => ({
		x: Math.round(point.x * 100) / 100,
		y: Math.round(point.y * 100) / 100,
		z: Math.round(point.z * 100) / 100,
	}));
}

function pathLength(from: Vec3, path: readonly Vec3[]): number {
	let length = 0;
	let previous = from;

	for (const point of path) {
		length += Math.hypot(point.x - previous.x, point.z - previous.z);
		previous = point;
	}

	return length;
}

function flatDistance(a: Vec3, b: Vec3): number {
	return Math.hypot(a.x - b.x, a.z - b.z);
}

function trimPath(
	from: Vec3,
	path: readonly Vec3[],
	stopShort: number,
): Vec3[] {
	const keep = pathLength(from, path) - stopShort;
	const trimmed: Vec3[] = [];
	let travelled = 0;
	let previous = from;

	if (keep <= 0.3) {
		return trimmed;
	}

	for (const point of path) {
		const segment = flatDistance(point, previous);

		if (travelled + segment >= keep) {
			const t = segment > 0 ? (keep - travelled) / segment : 0;

			trimmed.push({
				x: previous.x + (point.x - previous.x) * t,
				y: previous.y + (point.y - previous.y) * t,
				z: previous.z + (point.z - previous.z) * t,
			});

			return trimmed;
		}

		trimmed.push(point);

		travelled += segment;
		previous = point;
	}

	return trimmed;
}

function lurePath(match: Match, player: MatchPlayer): Vec3[] | null {
	const prey = match.anomalies
		.filter(
			(entity) =>
				entity.active &&
				entity.definition.damage > 0 &&
				entity.state !== "stalled" &&
				flatDistance(entity.position, player.position) <= COMPULSION_LURE_RANGE,
		)
		.sort(
			(a, b) =>
				flatDistance(a.position, player.position) -
				flatDistance(b.position, player.position),
		)
		.slice(0, LURE_CANDIDATES);

	for (const entity of prey) {
		const path = walkPath(match, player.position, entity.position);

		if (!path || pathLength(player.position, path) > COMPULSION_LURE_RANGE) {
			continue;
		}

		const kept = trimPath(player.position, path, COMPULSION_LURE_STOP);

		if (kept.length > 0) {
			return kept;
		}
	}

	return null;
}

function leapPlan(
	match: Match,
	player: MatchPlayer,
): { path: Vec3[]; spot: LeapSpot } | null {
	const spots = leapSpots(match)
		.filter(
			(spot) =>
				Math.abs(spot.start.y - player.position.y) < 3 &&
				flatDistance(spot.start, player.position) <= COMPULSION_LEAP_RANGE,
		)
		.sort(
			(a, b) =>
				flatDistance(a.start, player.position) -
				flatDistance(b.start, player.position),
		)
		.slice(0, LEAP_CANDIDATES);

	for (const spot of spots) {
		const path =
			flatDistance(spot.start, player.position) < 0.4
				? [spot.start]
				: walkPath(match, player.position, spot.start);

		if (
			!path ||
			pathLength(player.position, path) > COMPULSION_LEAP_RANGE * 1.4
		) {
			continue;
		}

		return { path: [...path, spot.edge], spot };
	}

	return null;
}

function forcedScream(match: Match, player: MatchPlayer): void {
	player.shoutingUntil = match.now + SHOUT_DURATION_MS;
	player.casting = null;

	match.sounds.push({
		position: { ...player.position },
		loudness: INFECTED_SCREAM_LOUDNESS,
		playerId: player.id,
		kind: "shout",
	});

	lureAnomalies(match, player.position, player.id);
}

export function planCompulsion(
	match: Match,
	player: MatchPlayer,
	kind: CompulsionKind,
): CompulsionOrder | null {
	const until = match.now + DURATIONS[kind];

	switch (kind) {
		case "expel":
			return player.hidden ? { kind, until, path: [], leap: null } : null;

		case "scream":
			return { kind, until, path: [], leap: null };

		case "lantern":
			return player.lanternOpen || hasMutator(match.config, "darkness")
				? null
				: { kind, until, path: [], leap: null };

		case "lure": {
			const path = lurePath(match, player);

			return path ? { kind, until, path, leap: null } : null;
		}

		case "leap": {
			const plan = leapPlan(match, player);

			return plan
				? { kind, until, path: plan.path, leap: plan.spot.direction }
				: null;
		}
	}
}

function chooseOrder(match: Match, player: MatchPlayer): CompulsionOrder {
	const expel = planCompulsion(match, player, "expel");

	if (expel) {
		return expel;
	}

	const options = (["scream", "lure", "leap", "lantern"] as const).flatMap(
		(kind) => {
			const order = planCompulsion(match, player, kind);

			return order ? [order] : [];
		},
	);

	const weighted = options.map(
		(order) =>
			[
				order,
				order.kind === player.lastCompulsion && options.length > 1
					? WEIGHTS[order.kind] * 0.25
					: WEIGHTS[order.kind],
			] as const,
	);

	return match.rng.weighted(weighted);
}

export function startCompulsion(
	match: Match,
	player: MatchPlayer,
	order: CompulsionOrder = chooseOrder(match, player),
): void {
	player.compulsion = { kind: order.kind, until: order.until };
	player.lastCompulsion = order.kind;
	player.casting = null;

	player.nextCompulsionAt =
		order.until + match.rng.range(COMPULSION_GAP_MIN_MS, COMPULSION_GAP_MAX_MS);

	if (order.kind === "expel") {
		match.unhidePlayer(player, "unhide");
	}

	if (order.kind === "scream" || order.kind === "expel") {
		forcedScream(match, player);
	}

	if (order.kind === "lantern") {
		player.lanternOpen = true;
	}

	match.emit({
		type: "compulsion",
		playerId: player.id,
		kind: order.kind,
		until: order.until,
		path: order.path,
		leap: order.leap,
	});
}

export function canBeInfected(match: Match, player: MatchPlayer): boolean {
	return (
		player.alive &&
		!player.lanternOpen &&
		!player.infected(match.now) &&
		player.immuneUntil <= match.now
	);
}

export function infectPlayer(
	match: Match,
	player: MatchPlayer,
	source: AnomalyEntity,
): void {
	player.infectedUntil = match.now + INFECTION_MS;
	player.infectedBy = source.id;
	player.nextCompulsionAt = match.now + INFECTION_INCUBATION_MS;
	player.compulsion = null;
	player.lastCompulsion = null;

	match.emit({
		type: "infection",
		playerId: player.id,
		anomalyId: source.id,
		until: player.infectedUntil,
	});
}

export function cureInfection(match: Match, player: MatchPlayer): void {
	if (player.infectedUntil === 0) {
		return;
	}

	player.infectedUntil = 0;
	player.infectedBy = null;
	player.compulsion = null;
	player.immuneUntil = match.now + INFECTION_IMMUNITY_MS;

	match.emit({
		type: "infection",
		playerId: player.id,
		anomalyId: null,
		until: 0,
	});
}

export function cureVictimsOf(match: Match, entity: AnomalyEntity): void {
	for (const player of match.players.values()) {
		if (player.infectedBy === entity.id) {
			cureInfection(match, player);
		}
	}
}

export function breakCompulsion(match: Match, player: MatchPlayer): void {
	if (!player.compelled(match.now) || !player.compulsion) {
		return;
	}

	player.compulsion = null;

	match.emit({
		type: "compulsion",
		playerId: player.id,
		kind: player.lastCompulsion ?? "scream",
		until: match.now,
		path: [],
		leap: null,
	});
}

export function updateInfections(match: Match): void {
	for (const player of match.players.values()) {
		if (player.infectedUntil === 0) {
			continue;
		}

		if (
			!player.alive ||
			!player.connected ||
			match.now >= player.infectedUntil
		) {
			cureInfection(match, player);

			continue;
		}

		if (player.compulsion && match.now >= player.compulsion.until) {
			player.compulsion = null;
		}

		if (
			!player.compulsion &&
			!player.carried &&
			!player.entranced &&
			match.now >= player.nextCompulsionAt
		) {
			startCompulsion(match, player);
		}
	}
}
