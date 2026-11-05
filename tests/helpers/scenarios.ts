import { AnomalyEntity } from "../../server/game/ai/AnomalyEntity.js";
import { hoverHeight } from "../../server/game/ai/locomotion.js";
import {
	CROUCH_EYE_DROP,
	EYE_HEIGHT_STANDING,
} from "../../shared/config/index.js";
import type { SpeciesId } from "../../shared/config/species.js";
import { type Vec3, yawToDirection } from "../../shared/math.js";
import { lineOfSight } from "../../shared/physics/lineOfSight.js";
import type { CastResult } from "../../shared/protocol/game.js";
import type { MatchSimulation } from "./simulation.js";

export const TEST_FORMULA = ["ignis", "umbra", "lumen"] as const;

export interface ClearLine {
	origin: Vec3;
	yaw: number;
	target: Vec3;
	roomId: number;
}

export function findClearLine(
	sim: MatchSimulation,
	distance: number,
	minimumRoomSize = 0,
	sideClearance = 0,
): ClearLine {
	const { match } = sim;
	const rooms = [...match.layout.rooms]
		.filter(
			(room) =>
				room.level === 0 &&
				room.type !== "stairwell" &&
				room.area >= minimumRoomSize,
		)
		.sort((a, b) => b.area - a.area);
	for (const room of rooms) {
		for (const origin of candidateOrigins(sim, room.id)) {
			const line = clearLineFrom(sim, origin, room.id, distance, sideClearance);
			if (line) {
				return line;
			}
		}
	}
	throw new Error(`Aucune ligne dégagée de ${distance} m dans ce manoir`);
}

function candidateOrigins(sim: MatchSimulation, roomId: number): Vec3[] {
	const { match } = sim;
	const room = match.layout.rooms[roomId];
	const center = { x: room.labelPoint.x, y: room.floorY, z: room.labelPoint.z };
	const origins: Vec3[] = [];
	const node = match.grid.nearestNode(center, 2);
	if (node !== null) {
		origins.push(match.grid.nodePosition(node));
	}
	const cells = (match.grid.roomCells.get(roomId) ?? [])
		.filter((cell) => match.grid.component[cell] === match.grid.mainComponent)
		.map((cell) => match.grid.nodePosition(cell))
		.sort(
			(a, b) =>
				Math.hypot(a.x - center.x, a.z - center.z) -
				Math.hypot(b.x - center.x, b.z - center.z),
		);
	for (let index = 0; index < cells.length; index += 5) {
		origins.push(cells[index]);
	}
	return origins;
}

function clearLineFrom(
	sim: MatchSimulation,
	origin: Vec3,
	roomId: number,
	distance: number,
	sideClearance: number,
): ClearLine | null {
	const { match } = sim;
	for (let step = 0; step < 32; step += 1) {
		const yaw = (step / 32) * Math.PI * 2 - Math.PI;
		const direction = yawToDirection(yaw);
		const target = {
			x: origin.x + direction.x * distance,
			y: origin.y,
			z: origin.z + direction.z * distance,
		};
		const targetNode = match.grid.nearestNode(target, 0);
		if (
			targetNode === null ||
			Math.abs(match.grid.nodePosition(targetNode).y - origin.y) > 0.05
		) {
			continue;
		}
		if (
			match.roomIdAt(target) !== roomId ||
			!match.finder.walkableLine(origin, target, 0)
		) {
			continue;
		}
		const eye = {
			...origin,
			y: origin.y + EYE_HEIGHT_STANDING - CROUCH_EYE_DROP,
		};
		const clear = [0.4, 1, 1.6].every((height) =>
			lineOfSight(match.world, eye, { ...target, y: target.y + height }),
		);
		const sides =
			sideClearance === 0 ||
			[1, -1].every((side) =>
				match.finder.walkableLine(
					origin,
					{
						x: origin.x - direction.z * side * sideClearance,
						y: origin.y,
						z: origin.z + direction.x * side * sideClearance,
					},
					0,
				),
			);
		if (clear && sides) {
			return { origin, yaw, target, roomId };
		}
	}
	return null;
}

export function silenceAnomalies(sim: MatchSimulation): void {
	for (const entity of sim.match.anomalies) {
		entity.active = false;
		entity.state = "gone";
		entity.spawnDueAt = Infinity;
	}
}

export function installAnomaly(
	sim: MatchSimulation,
	slot: number,
	species: SpeciesId,
	feet: Vec3,
	yaw = 0,
	formula: readonly string[] = TEST_FORMULA,
): AnomalyEntity {
	const { match } = sim;
	const entity = new AnomalyEntity(slot, species, 1, 1, [...formula]);
	match.anomalies[slot] = entity;
	entity.resetForSpawn(
		{ ...feet, y: feet.y + hoverHeight(entity) },
		yaw,
		match.now,
	);
	entity.spawnDueAt = Infinity;
	if (species === "archiviste") {
		entity.homeRoom = match.roomIdAt(feet);
	}
	if (species === "luciole") {
		entity.homePoint = { ...feet };
	}
	return entity;
}

export function aimAt(
	sim: MatchSimulation,
	playerId: string,
	point: Vec3,
	crouched: boolean,
): { yaw: number; pitch: number } {
	const bot = sim.bot(playerId);
	const eyeY =
		bot.character.y + EYE_HEIGHT_STANDING - (crouched ? CROUCH_EYE_DROP : 0);
	const dx = point.x - bot.character.x;
	const dz = point.z - bot.character.z;
	const yaw = Math.atan2(-dx, -dz);
	const pitch = Math.atan2(point.y - eyeY, Math.hypot(dx, dz));
	bot.input.yaw = yaw;
	bot.pitch = pitch;
	return { yaw, pitch };
}

export interface CastSetup {
	crouch?: boolean;
	lantern?: boolean;
	voiceLevel?: number;
	stillSeconds?: number;
}

export function prepareCaster(
	sim: MatchSimulation,
	playerId: string,
	setup: CastSetup,
): void {
	const bot = sim.bot(playerId);
	bot.input.forward = 0;
	bot.input.strafe = 0;
	bot.input.crouch = setup.crouch ?? false;
	bot.lantern = setup.lantern ?? false;
	bot.voiceLevel = setup.voiceLevel ?? 0.3;
	bot.voicePeakMs = bot.voiceLevel > 0 ? 50 : 0;
	sim.run(setup.stillSeconds ?? 1.6);
}

export function castAt(
	sim: MatchSimulation,
	playerId: string,
	entity: AnomalyEntity,
	words: readonly string[] = entity.formula,
): CastResult {
	const bot = sim.bot(playerId);
	const center = entity.center();
	const crouched = bot.input.crouch;
	aimAt(sim, playerId, center, crouched);
	sim.run(0.1);
	return speakFormula(sim, playerId, words);
}

export function speakFormula(
	sim: MatchSimulation,
	playerId: string,
	words: readonly string[],
): CastResult {
	const { match } = sim;
	match.handleCastBegin(playerId);
	sim.run(0.1);
	match.handleCast(playerId, {
		transcripts: [words.join(" ")],
		method: "speech",
	});
	return lastCastResult(sim, playerId) as CastResult;
}

export function lastCastResult(
	sim: MatchSimulation,
	playerId: string,
): CastResult | null {
	const messages = sim.transport.messages.filter(
		(message) =>
			message.event === "game:castResult" && message.target === playerId,
	);
	const last = messages[messages.length - 1];
	return last ? (last.payload as CastResult) : null;
}

export function placeBot(
	sim: MatchSimulation,
	playerId: string,
	feet: Vec3,
	yaw: number,
): void {
	sim.teleportBot(playerId, feet, yaw);
	const bot = sim.bot(playerId);
	bot.input.yaw = yaw;
	bot.input.forward = 0;
	bot.input.strafe = 0;
	sim.run(0.3);
}
