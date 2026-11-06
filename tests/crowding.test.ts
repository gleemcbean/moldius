import { describe, expect, it } from "vitest";
import type { AnomalyEntity } from "../server/game/ai/AnomalyEntity.js";
import { engagedPlayer, isRoaming } from "../server/game/ai/dispersal.js";
import { perceive } from "../server/game/ai/perception.js";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import {
	ANOMALY_PURSUERS_PER_PLAYER,
	ANOMALY_ROOM_CAPACITY,
	PLAYER_RESPAWN_PROTECTION_MS,
} from "../shared/config/index.js";
import { type Vec3, yawToDirection } from "../shared/math.js";
import {
	type ClearLine,
	findClearLine,
	installAnomaly,
	placeBot,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function alongLine(
	sim: MatchSimulation,
	line: ClearLine,
	distance: number,
): Vec3 {
	const direction = yawToDirection(line.yaw);
	const node = sim.match.grid.nearestNode(
		{
			x: line.origin.x + direction.x * distance,
			y: line.origin.y,
			z: line.origin.z + direction.z * distance,
		},
		1,
	);
	if (node === null) {
		throw new Error("Aucun point praticable sur la ligne");
	}
	return sim.match.grid.nodePosition(node);
}

function watchedRoom(seed: number) {
	const sim = new MatchSimulation({ seed, players: 1 });
	silenceAnomalies(sim);
	const line = findClearLine(sim, 6);
	placeBot(sim, "p1", line.origin, line.yaw);
	const player = sim.match.players.get("p1") as MatchPlayer;
	player.protectedUntil = 0;
	return { sim, line, player };
}

function engageOn(
	sim: MatchSimulation,
	entity: AnomalyEntity,
	player: MatchPlayer,
): void {
	const memory = entity.memoryFor(player.id);
	memory.awareness = 1.5;
	memory.visibleNow = true;
	memory.lastSeenAt = sim.match.now;
	memory.lastSeenPosition = { ...player.position };
	entity.targetId = player.id;
	entity.setState("chase", sim.match.now);
}

function residentRoom(
	sim: MatchSimulation,
	entity: AnomalyEntity,
): number | null {
	if (
		(entity.state === "patrol" || entity.state === "travel") &&
		entity.destinationRoom !== null
	) {
		return entity.destinationRoom;
	}
	return sim.match.roomIdAt(entity.position);
}

describe("répartition des anomalies", () => {
	it("jamais plus de deux anomalies sur un même joueur : les autres le lâchent et quittent la salle", () => {
		const { sim, line, player } = watchedRoom(4242);
		const hunters = [1.8, 3, 4.2, 5.4].map((distance, slot) =>
			installAnomaly(
				sim,
				slot,
				"veilleur",
				alongLine(sim, line, distance),
				line.yaw + Math.PI,
			),
		);
		for (const hunter of hunters) {
			engageOn(sim, hunter, player);
		}
		let most = 0;
		sim.run(0.1);
		const dropped = hunters.filter(
			(hunter) => (hunter.ignoredUntil.get(player.id) ?? 0) > sim.match.now,
		);
		expect(dropped.map((hunter) => hunter.id)).toEqual([2, 3]);
		for (const hunter of dropped) {
			expect(hunter.targetId).toBeNull();
			expect(["travel", "idle"]).toContain(hunter.state);
		}
		sim.run(6, () => {
			player.health = 1_000_000;
			most = Math.max(
				most,
				hunters.filter((hunter) => engagedPlayer(hunter) === player.id).length,
			);
		});
		expect(most).toBeLessThanOrEqual(ANOMALY_PURSUERS_PER_PLAYER);
		for (const hunter of dropped) {
			expect(residentRoom(sim, hunter)).not.toBe(line.roomId);
		}
	});

	it("une anomalie qui a lâché un joueur ne revient pas aussitôt sur lui", () => {
		const { sim, line, player } = watchedRoom(4242);
		player.lanternOpen = true;
		const hunter = installAnomaly(
			sim,
			0,
			"veilleur",
			alongLine(sim, line, 4),
			line.yaw + Math.PI,
		);
		hunter.ignoredUntil.set(player.id, sim.match.now + 5_000);
		for (let tick = 0; tick < 40; tick += 1) {
			expect(perceive(sim.match, hunter, 0.05).target).toBeNull();
		}
		expect(hunter.memory.get(player.id)?.awareness ?? 0).toBeGreaterThan(1);
		sim.match.now += 5_000;
		expect(perceive(sim.match, hunter, 0.05).target?.id).toBe(player.id);
	});

	it("une salle ne garde pas plus de deux anomalies errantes, même sous les yeux d'un joueur", () => {
		const { sim, line, player } = watchedRoom(4242);
		player.protectedUntil = Infinity;
		const idle = [2.5, 4, 5.5].map((distance, slot) => {
			const entity = installAnomaly(
				sim,
				slot,
				"veilleur",
				alongLine(sim, line, distance),
			);
			entity.idleUntil = Infinity;
			return entity;
		});
		sim.run(3.5);
		const stayed = idle.filter(
			(entity) => residentRoom(sim, entity) === line.roomId,
		);
		expect(stayed.map((entity) => entity.id)).toEqual([0, 1]);
		expect(idle[2].state).toBe("travel");
		expect(idle[2].hurrying).toBe(false);
	});

	it("les anomalies errantes parcourent le manoir sans s'entasser dans une salle", () => {
		const sim = new MatchSimulation({ seed: 777, players: 1 });
		silenceAnomalies(sim);
		const line = findClearLine(sim, 4);
		placeBot(sim, "p1", line.origin, line.yaw);
		(sim.match.players.get("p1") as MatchPlayer).protectedUntil = Infinity;
		const cells = sim.match.grid.roomCells.get(line.roomId) as number[];
		const roamers = [0, 1, 2, 3, 4, 5].map((slot) =>
			installAnomaly(
				sim,
				slot,
				"veilleur",
				sim.match.grid.nodePosition(cells[(slot * 7) % cells.length]),
			),
		);
		const visited = new Set<number>();
		let crowded = 0;
		let ticks = 0;
		sim.run(90, () => {
			ticks += 1;
			const residents = new Map<number, number>();
			for (const entity of roamers) {
				const room = sim.match.roomIdAt(entity.position);
				if (room !== null) {
					visited.add(room);
				}
				if (
					!isRoaming(entity) ||
					entity.state === "patrol" ||
					entity.state === "travel" ||
					room === null
				) {
					continue;
				}
				residents.set(room, (residents.get(room) ?? 0) + 1);
			}
			if (
				ticks > 80 &&
				Math.max(0, ...residents.values()) > ANOMALY_ROOM_CAPACITY
			) {
				crowded += 1;
			}
		});
		expect(crowded).toBe(0);
		expect(visited.size).toBeGreaterThan(sim.match.layout.rooms.length * 0.6);
	});

	it("un joueur qui vient de réapparaître est laissé tranquille 5 s, même bruyant et en vue", () => {
		const { sim, line, player } = watchedRoom(4242);
		const hunter = installAnomaly(
			sim,
			0,
			"veilleur",
			alongLine(sim, line, 4),
			line.yaw + Math.PI,
		);
		player.protectedUntil = sim.match.now + PLAYER_RESPAWN_PROTECTION_MS;
		const shout = () =>
			sim.match.sounds.push({
				position: { ...player.position },
				loudness: 14,
				playerId: player.id,
				kind: "shout",
			});
		while (sim.match.now < player.protectedUntil) {
			shout();
			const seen = perceive(sim.match, hunter, 0.05);
			expect(seen.target).toBeNull();
			expect(seen.heard).toBeNull();
			sim.match.sounds.length = 0;
			sim.match.now += 50;
		}
		shout();
		expect(perceive(sim.match, hunter, 0.05).heard?.playerId).toBe(player.id);
	});

	it("les anomalies n'enquêtent pas sur les bruits des autres anomalies", () => {
		const { sim, line } = watchedRoom(4242);
		const listener = installAnomaly(
			sim,
			0,
			"veilleur",
			alongLine(sim, line, 5),
		);
		const near = alongLine(sim, line, 3);
		sim.match.sounds.push(
			{ position: near, loudness: 14, playerId: null, kind: "shout" },
			{ position: near, loudness: 7, playerId: "anomaly:4", kind: "door" },
		);
		expect(perceive(sim.match, listener, 0.05).heard).toBeNull();
		sim.match.sounds.push({
			position: near,
			loudness: 9,
			playerId: "p1",
			kind: "footsteps",
		});
		expect(perceive(sim.match, listener, 0.05).heard?.playerId).toBe("p1");
	});
});
