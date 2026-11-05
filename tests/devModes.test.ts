import { describe, expect, it } from "vitest";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import { ENERGY_MAX, HEALTH_MAX } from "../shared/config/index.js";
import { noDevModes, sanitizeDevModes } from "../shared/devModes.js";
import { yawToDirection } from "../shared/math.js";
import {
	lineOfSight,
	movementCrossesWall,
	pullBackToSight,
} from "../shared/physics/lineOfSight.js";
import { placeBot, silenceAnomalies } from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function simulation(dev: boolean): MatchSimulation {
	const sim = new MatchSimulation({ seed: 4242, players: 1, dev });
	silenceAnomalies(sim);
	sim.run(2.2);
	return sim;
}

function player(sim: MatchSimulation): MatchPlayer {
	return sim.match.players.get("p1") as MatchPlayer;
}

function wallCrossing(sim: MatchSimulation) {
	const { match } = sim;
	for (const room of match.layout.rooms) {
		if (room.level !== 0 || room.type === "stairwell") {
			continue;
		}
		for (const cell of match.grid.roomCells.get(room.id) ?? []) {
			if (!match.grid.isInMainComponent(cell)) {
				continue;
			}
			const from = match.grid.nodePosition(cell);
			for (let step = 0; step < 16; step += 1) {
				const yaw = (step / 16) * Math.PI * 2;
				const direction = yawToDirection(yaw);
				const to = {
					x: from.x + direction.x * 1.6,
					y: from.y,
					z: from.z + direction.z * 1.6,
				};
				const landing = match.grid.nearestNode(to, 1);
				if (
					landing !== null &&
					match.roomIdAt(to) !== room.id &&
					Math.hypot(
						match.grid.nodePosition(landing).x - to.x,
						match.grid.nodePosition(landing).z - to.z,
					) < 0.4 &&
					Math.abs(match.grid.nodePosition(landing).y - from.y) < 0.05 &&
					[-0.6, 0, 0.6].every((side) =>
						movementCrossesWall(
							match.world,
							{
								x: from.x - direction.z * side,
								y: from.y,
								z: from.z + direction.x * side,
							},
							{
								x: to.x - direction.z * side,
								y: to.y,
								z: to.z + direction.x * side,
							},
							1.78,
							new Set(),
						),
					)
				) {
					return { from, to, yaw, roomId: room.id };
				}
			}
		}
	}
	throw new Error("No wall to cross found for the test.");
}

describe("modes de développement", () => {
	it("ne valide que des booléens connus", () => {
		expect(
			sanitizeDevModes({ fly: true, immortal: "oui", other: true }),
		).toEqual({ ...noDevModes(), fly: true });
		expect(sanitizeDevModes(null)).toEqual(noDevModes());
	});

	it("sont ignorés quand le serveur n'est pas en mode dev", () => {
		const sim = simulation(false);
		sim.match.handleDevModes("p1", { ...noDevModes(), immortal: true });
		expect(player(sim).devModes.immortal).toBe(false);
		expect(sim.match.applyDamage(player(sim), 30, "veilleur", null)).toBe(true);
	});

	it("rend immortel et donne une énergie infinie", () => {
		const sim = simulation(true);
		sim.match.handleDevModes("p1", {
			...noDevModes(),
			immortal: true,
			infiniteEnergy: true,
		});
		expect(
			sim.match.applyDamage(player(sim), HEALTH_MAX, "explosion", null),
		).toBe(false);
		expect(player(sim).health).toBe(HEALTH_MAX);
		const bot = sim.bot("p1");
		bot.input.forward = 1;
		bot.input.sprint = true;
		bot.lantern = true;
		sim.run(6);
		expect(player(sim).energy).toBe(ENERGY_MAX);
		expect(player(sim).sprintLocked).toBe(false);
	});

	it("laisse voler au-dessus du sol sans être recalé", () => {
		const sim = simulation(true);
		const start = player(sim).position.y;
		const bot = sim.bot("p1");
		bot.input.rise = 1;
		sim.run(0.5);
		expect(player(sim).position.y).toBeCloseTo(start, 3);
		sim.match.handleDevModes("p1", { ...noDevModes(), fly: true });
		sim.run(0.5);
		const corrections = sim.transport.messages.filter(
			(message) => message.event === "game:forcedMove",
		).length;
		expect(player(sim).position.y).toBeGreaterThan(start + 1);
		expect(player(sim).position.y).toBeCloseTo(bot.character.y, 3);
		expect(
			sim.transport.messages.filter(
				(message) => message.event === "game:forcedMove",
			).length,
		).toBe(corrections);
	});

	it("laisse traverser les murs en passe-muraille, et seulement ainsi", () => {
		for (const enabled of [false, true]) {
			const sim = simulation(true);
			const crossing = wallCrossing(sim);
			placeBot(sim, "p1", crossing.from, crossing.yaw);
			sim.match.handleDevModes("p1", {
				...noDevModes(),
				passThrough: enabled,
			});
			const bot = sim.bot("p1");
			bot.input.forward = 1;
			sim.run(0.7);
			bot.input.forward = 0;
			sim.run(0.2);
			const direction = yawToDirection(crossing.yaw);
			const position = player(sim).position;
			const progress =
				(position.x - crossing.from.x) * direction.x +
				(position.z - crossing.from.z) * direction.z;
			if (enabled) {
				expect(progress).toBeGreaterThan(1.6);
				expect(sim.match.roomIdAt(position)).not.toBe(crossing.roomId);
			} else {
				expect(progress).toBeLessThan(0.9);
			}
		}
	});

	it("accepte le vol rapide en ligne droite à travers le manoir", () => {
		const sim = simulation(true);
		sim.match.handleDevModes("p1", {
			...noDevModes(),
			fly: true,
			passThrough: true,
		});
		const start = { ...player(sim).position };
		const forced = () =>
			sim.transport.messages.filter(
				(message) => message.event === "game:forcedMove",
			).length;
		const before = forced();
		const bot = sim.bot("p1");
		bot.input.forward = 1;
		bot.input.sprint = true;
		sim.run(0.6);
		const position = player(sim).position;
		expect(
			Math.hypot(position.x - start.x, position.z - start.z),
		).toBeGreaterThan(5);
		expect(forced()).toBe(before);
	});
});

describe("joueur à terre", () => {
	it("garde l'orientation de sa chute aux yeux des autres", () => {
		const sim = simulation(false);
		const fallen = player(sim);
		const yaw = fallen.yaw;
		sim.match.applyDamage(fallen, HEALTH_MAX, "veilleur", null);
		expect(fallen.alive).toBe(false);
		sim.bot("p1").input.yaw = yaw + 2;
		sim.run(1);
		expect(fallen.yaw).toBe(yaw);
	});
});

describe("lampe contre un mur", () => {
	it("reste du côté du joueur quand elle dépasserait le mur", () => {
		const sim = simulation(false);
		const crossing = wallCrossing(sim);
		const eye = { ...crossing.from, y: crossing.from.y + 1 };
		const held = { ...crossing.to, y: eye.y };
		expect(lineOfSight(sim.match.world, eye, held)).toBe(false);
		const light = pullBackToSight(sim.match.world, eye, held, 0.06);
		expect(lineOfSight(sim.match.world, eye, light)).toBe(true);
		expect(sim.match.roomIdAt(light)).toBe(crossing.roomId);
		const open = { x: eye.x, y: eye.y + 0.2, z: eye.z };
		expect(pullBackToSight(sim.match.world, eye, open, 0.06)).toBe(open);
	});
});
