import { describe, expect, it } from "vitest";
import type { AnomalyEntity } from "../server/game/ai/AnomalyEntity.js";
import { perceive } from "../server/game/ai/perception.js";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import { lineOfSight } from "../shared/physics/lineOfSight.js";
import {
	type ClearLine,
	findClearLine,
	installAnomaly,
	placeBot,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

interface Setup {
	sim: MatchSimulation;
	line: ClearLine;
	entity: AnomalyEntity;
}

function setup(distance: number): Setup {
	const sim = new MatchSimulation({ seed: 4242, players: 1 });
	silenceAnomalies(sim);
	const line = findClearLine(sim, distance);
	placeBot(sim, "p1", line.origin, line.yaw);
	sim.run(2.2);
	const entity = installAnomaly(
		sim,
		0,
		"veilleur",
		line.target,
		line.yaw + Math.PI,
	);
	return { sim, line, entity };
}

function timeToDetect(
	{ sim, entity }: Setup,
	configure: () => void,
	limitSeconds = 20,
): number {
	const player = sim.match.players.get("p1") as MatchPlayer;
	configure();
	entity.memory.clear();
	const dt = 0.05;
	for (let elapsed = 0; elapsed < limitSeconds; elapsed += dt) {
		perceive(sim.match, entity, dt);
		if ((entity.memory.get(player.id)?.awareness ?? 0) >= 1) {
			return elapsed;
		}
	}
	return Infinity;
}

describe("perception des anomalies", () => {
	it("repère plus vite un joueur à la lanterne ouverte, plus lentement accroupi dans l'ombre, sans invisibilité totale", () => {
		const scenario = setup(6);
		const player = scenario.sim.match.players.get("p1") as MatchPlayer;
		const lantern = timeToDetect(scenario, () => {
			player.lanternOpen = true;
			player.crouch = 0;
		});
		const standing = timeToDetect(scenario, () => {
			player.lanternOpen = false;
			player.crouch = 0;
		});
		const crouched = timeToDetect(scenario, () => {
			player.lanternOpen = false;
			player.crouch = 1;
		});
		expect(lantern).toBeLessThan(standing);
		expect(standing).toBeLessThan(crouched);
		expect(lantern).toBeLessThan(2.5);
		const close = setup(3);
		const closePlayer = close.sim.match.players.get("p1") as MatchPlayer;
		const closeCrouched = timeToDetect(close, () => {
			closePlayer.lanternOpen = false;
			closePlayer.crouch = 1;
		});
		expect(closeCrouched).toBeLessThan(Infinity);
	});

	it("ne voit pas à travers les murs", () => {
		const scenario = setup(4);
		const { sim, entity } = scenario;
		const player = sim.match.players.get("p1") as MatchPlayer;
		const hiddenRoom = sim.match.layout.rooms.find((room) => {
			if (
				room.level !== 0 ||
				room.type === "stairwell" ||
				room.id === scenario.line.roomId
			) {
				return false;
			}
			const distance = Math.hypot(
				room.labelPoint.x - entity.position.x,
				room.labelPoint.z - entity.position.z,
			);
			const eye = entity.eye();
			return (
				distance < 12 &&
				!lineOfSight(sim.match.world, eye, {
					x: room.labelPoint.x,
					y: room.floorY + 1,
					z: room.labelPoint.z,
				}) &&
				!lineOfSight(sim.match.world, eye, {
					x: room.labelPoint.x,
					y: room.floorY + 1.6,
					z: room.labelPoint.z,
				})
			);
		});
		expect(hiddenRoom).toBeDefined();

		if (!hiddenRoom) {
			throw new Error("No suitable hidden room found for the test.");
		}

		const time = timeToDetect(
			scenario,
			() => {
				player.position = {
					x: hiddenRoom.labelPoint.x,
					y: hiddenRoom.floorY,
					z: hiddenRoom.labelPoint.z,
				};
				player.lanternOpen = true;
				entity.yaw = Math.atan2(
					-(player.position.x - entity.position.x),
					-(player.position.z - entity.position.z),
				);
			},
			8,
		);
		expect(time).toBe(Infinity);
	});

	it("perd une cible enfuie hors de vue, la cherche brièvement puis repart patrouiller", () => {
		const { sim, entity } = setup(3);
		const player = sim.match.players.get("p1") as MatchPlayer;
		player.protectedUntil = Infinity;
		const memory = entity.memoryFor("p1");
		memory.awareness = 1.5;
		memory.visibleNow = true;
		memory.lastSeenAt = sim.match.now;
		memory.lastSeenPosition = { ...player.position };
		entity.targetId = "p1";
		entity.setState("chase", sim.match.now);
		sim.run(0.3);
		expect(["chase", "windup", "recover"]).toContain(entity.state);
		const far = sim.match.layout.rooms
			.filter((room) => room.level === 0 && room.type !== "stairwell")
			.sort(
				(a, b) =>
					Math.hypot(
						b.labelPoint.x - entity.position.x,
						b.labelPoint.z - entity.position.z,
					) -
					Math.hypot(
						a.labelPoint.x - entity.position.x,
						a.labelPoint.z - entity.position.z,
					),
			)[0];
		const node = sim.match.grid.nearestNode(
			{ x: far.labelPoint.x, y: far.floorY, z: far.labelPoint.z },
			3,
		);

		if (!node) {
			throw new Error("No suitable node found in the far room for the test.");
		}

		sim.teleportBot("p1", sim.match.grid.nodePosition(node));
		const states: string[] = [];
		sim.run(30, () => {
			if (states[states.length - 1] !== entity.state) {
				states.push(entity.state);
			}
		});
		expect(states).toContain("search");
		expect(entity.targetId).toBeNull();
		expect(["patrol", "idle", "travel", "investigate"]).toContain(entity.state);
	});
});
