import { describe, expect, it } from "vitest";
import { targetIsStrikeable } from "../server/game/ai/combat.js";
import { canEngage } from "../server/game/ai/dispersal.js";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import {
	CINEMA_MIN_STAY_MS,
	CINEMA_RESULT_GRACE_MS,
	CINEMA_STALL_MS,
	CINEMA_UNWATCHED_MS,
} from "../shared/config/index.js";
import {
	FILM_BASE_LEVEL,
	FILM_TOTAL_MS,
} from "../shared/minigames/filmRunner.js";
import { PLAYER_FLAG } from "../shared/protocol/game.js";
import { PERFECT, playFilm } from "./helpers/filmPlayer.js";
import {
	castAt,
	findClearLine,
	installAnomaly,
	placeBot,
	prepareCaster,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function quietSimulation(seed = 4242): MatchSimulation {
	const sim = new MatchSimulation({ seed, players: 1 });

	silenceAnomalies(sim);

	return sim;
}

function seanceScenario() {
	const sim = quietSimulation();
	const line = findClearLine(sim, 4);

	placeBot(sim, "p1", line.origin, line.yaw);

	const victim = sim.match.players.get("p1") as MatchPlayer;

	victim.protectedUntil = 0;

	const entity = installAnomaly(
		sim,
		0,
		"cinematographe",
		line.target,
		line.yaw + Math.PI,
	);

	for (let step = 0; step < 50 && entity.state !== "special"; step += 1) {
		sim.run(0.1);
	}

	const start = sim.transport
		.eventsOfType("seance")
		.find((event) => event.phase === "start");

	if (!start) {
		throw new Error("Le Cinématographe n'a pas lancé son film");
	}

	return { sim, line, victim, entity, start };
}

function winningInputs(start: { seed: number; level: number }): number[] {
	const run = playFilm(start.seed, start.level, PERFECT);

	expect(run.state.outcome).toBe("won");

	return run.inputs;
}

describe("Cinématographe", () => {
	it("change de place dès que personne ne le regarde", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 6);

		placeBot(sim, "p1", line.origin, line.yaw + Math.PI);

		(sim.match.players.get("p1") as MatchPlayer).protectedUntil = Infinity;

		const entity = installAnomaly(
			sim,
			0,
			"cinematographe",
			line.target,
			line.yaw,
		);

		const generation = entity.gen;

		sim.run((CINEMA_MIN_STAY_MS + CINEMA_UNWATCHED_MS + 1500) / 1000);

		expect(entity.gen).toBeGreaterThan(generation);
	});

	it("enferme dans son film le joueur resté dans son faisceau", () => {
		const { sim, victim, start } = seanceScenario();

		expect(start.playerId).toBe("p1");
		expect(victim.entranced).toBe(true);

		expect(
			sim.match.snapshot().players[0].flags & PLAYER_FLAG.entranced,
		).not.toBe(0);

		const before = { ...victim.position };
		const bot = sim.bot("p1");

		bot.input.forward = 1;
		bot.input.sprint = true;

		sim.run(1);

		expect(
			Math.hypot(victim.position.x - before.x, victim.position.z - before.z),
		).toBeLessThan(0.3);
	});

	it("abandonne sa visée quand le joueur quitte le faisceau", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 4);

		placeBot(sim, "p1", line.origin, line.yaw);

		const entity = installAnomaly(
			sim,
			0,
			"cinematographe",
			line.target,
			line.yaw + Math.PI,
		);

		for (let step = 0; step < 30 && entity.state !== "windup"; step += 1) {
			sim.run(0.1);
		}

		expect(entity.state).toBe("windup");

		const far = findClearLine(sim, 3, 0, 0);

		const away = sim.match.layout.rooms.find(
			(room) =>
				room.level === 0 &&
				room.id !== sim.match.roomIdAt(line.origin) &&
				room.type !== "stairwell" &&
				Math.hypot(
					room.labelPoint.x - line.origin.x,
					room.labelPoint.z - line.origin.z,
				) > 14,
		);

		const node = away
			? sim.match.grid.nearestNode(
					{ x: away.labelPoint.x, y: away.floorY, z: away.labelPoint.z },
					4,
				)
			: null;

		placeBot(
			sim,
			"p1",
			node === null ? far.origin : sim.match.grid.nodePosition(node),
			0,
		);

		sim.run(1.5);

		expect(entity.state).not.toBe("special");
		expect(sim.transport.eventsOfType("seance")).toHaveLength(0);
	});

	it("cale après une victoire et se laisse alors capturer", () => {
		const { sim, victim, entity, start } = seanceScenario();
		const inputs = winningInputs(start);

		sim.run(FILM_TOTAL_MS / 1000);
		sim.match.handleFilm("p1", { anomalyId: entity.id, inputs });
		sim.run(0.1);

		expect(sim.transport.eventsOfType("seance").at(-1)?.phase).toBe("won");
		expect(entity.state).toBe("stalled");
		expect(victim.entranced).toBe(false);
		expect(victim.alive).toBe(true);
		expect(victim.filmLevel).toBeGreaterThan(FILM_BASE_LEVEL);

		prepareCaster(sim, "p1", { voiceLevel: 0.95 });

		expect(castAt(sim, "p1", entity).ok).toBe(true);
	});

	it("ne se laisse pas capturer tant qu'il tourne", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 4);

		placeBot(sim, "p1", line.origin, line.yaw);
		prepareCaster(sim, "p1", { voiceLevel: 0.95 });

		const entity = installAnomaly(
			sim,
			0,
			"cinematographe",
			line.target,
			line.yaw,
		);

		entity.lastStrikeAt = sim.match.now;

		const result = castAt(sim, "p1", entity);

		expect(result.ok).toBe(false);
		expect(result.reason).toBe("rolling");
	});

	it("tue sur-le-champ le joueur qui perd", () => {
		const { sim, victim, entity } = seanceScenario();

		sim.match.handleFilm("p1", { anomalyId: entity.id, inputs: [] });
		sim.run(0.1);

		expect(victim.alive).toBe(false);
		expect(victim.filmLevel).toBeLessThan(FILM_BASE_LEVEL);

		expect(sim.transport.eventsOfType("death").at(-1)).toMatchObject({
			playerId: "p1",
			cause: "cinematographe",
		});

		expect(entity.state).toBe("recover");
	});

	it("rend sa victime intouchable par les autres anomalies pendant le film", () => {
		const { sim, victim, entity } = seanceScenario();

		const other = installAnomaly(sim, 1, "cordyceps", victim.position, 0);

		expect(targetIsStrikeable(sim.match, victim)).toBe(false);
		expect(canEngage(sim.match, other, victim)).toBe(false);

		expect(
			sim.match.applyDamage(victim, 100, "cordyceps", other.center()),
		).toBe(false);

		expect(sim.match.applyDamage(victim, 100, "explosion", null)).toBe(false);

		expect(victim.alive).toBe(true);

		sim.match.handleFilm("p1", { anomalyId: entity.id, inputs: [] });
		sim.run(0.1);

		expect(victim.alive).toBe(false);
	});

	it("tue aussi le joueur qui ne rend jamais sa bobine", () => {
		const { sim, victim } = seanceScenario();

		sim.run((FILM_TOTAL_MS + CINEMA_RESULT_GRACE_MS) / 1000 + 0.5);

		expect(victim.alive).toBe(false);
	});

	it("ignore une victoire annoncée avant la fin du film", () => {
		const { sim, entity, start } = seanceScenario();
		const inputs = winningInputs(start);

		sim.match.handleFilm("p1", { anomalyId: entity.id, inputs });
		sim.run(0.1);

		expect(entity.state).toBe("special");

		sim.run(FILM_TOTAL_MS / 1000);
		sim.match.handleFilm("p1", { anomalyId: entity.id, inputs });

		expect(entity.state).toBe("stalled");
	});

	it("repart après avoir calé un moment", () => {
		const { sim, entity, start } = seanceScenario();

		sim.run(FILM_TOTAL_MS / 1000);

		sim.match.handleFilm("p1", {
			anomalyId: entity.id,
			inputs: winningInputs(start),
		});

		sim.run(CINEMA_STALL_MS / 1000 - 1);

		expect(entity.state).toBe("stalled");

		sim.run(2);

		expect(entity.state).not.toBe("stalled");
	});

	it("libère sa victime s'il disparaît pendant la séance", () => {
		const { sim, victim, entity } = seanceScenario();

		sim.match.removeAnomaly(entity, "dismissed");
		sim.run(0.1);

		expect(victim.entranced).toBe(false);
		expect(sim.transport.eventsOfType("seance").at(-1)?.phase).toBe("cancel");
	});
});
