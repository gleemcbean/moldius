import { describe, expect, it } from "vitest";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import { startHallucination } from "../server/game/systems/hallucination.js";
import { HALLUCINATION_MS, HEALTH_MAX } from "../shared/config/index.js";
import { SPECIES } from "../shared/config/species.js";
import { PLAYER_FLAG } from "../shared/protocol/game.js";
import {
	findClearLine,
	installAnomaly,
	placeBot,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function quietSimulation(seed = 4242): MatchSimulation {
	const sim = new MatchSimulation({ seed, players: 1 });

	silenceAnomalies(sim);

	return sim;
}

function strikes(sim: MatchSimulation) {
	return sim.transport
		.eventsOfType("attack")
		.filter((event) => event.phase === "strike");
}

function runUntilStrikes(sim: MatchSimulation, count: number, seconds: number) {
	for (let step = 0; step < seconds * 10; step += 1) {
		sim.run(0.1);

		if (strikes(sim).filter((event) => event.hit).length >= count) {
			break;
		}
	}
}

function mothScenario() {
	const sim = quietSimulation();
	const line = findClearLine(sim, 8, 0, 1);

	placeBot(sim, "p1", line.origin, line.yaw);

	const victim = sim.match.players.get("p1") as MatchPlayer;

	victim.protectedUntil = 0;

	const length = Math.hypot(
		line.target.x - line.origin.x,
		line.target.z - line.origin.z,
	);

	const near = {
		x: line.origin.x + ((line.target.x - line.origin.x) / length) * 1.4,
		y: line.origin.y,
		z: line.origin.z + ((line.target.z - line.origin.z) / length) * 1.4,
	};

	const entity = installAnomaly(sim, 0, "phalene", near, line.yaw + Math.PI);

	return { sim, victim, entity };
}

describe("Phalène", () => {
	it("donne des visions sans blesser à sa première attaque", () => {
		const { sim, victim, entity } = mothScenario();

		runUntilStrikes(sim, 1, 6);

		expect(strikes(sim)[0]).toMatchObject({ anomalyId: entity.id, hit: true });
		expect(victim.health).toBe(HEALTH_MAX);
		expect(victim.hallucinating(sim.match.now)).toBe(true);
		expect(victim.hallucinatedBy).toBe(entity.id);

		expect(sim.transport.eventsOfType("hallucination")[0]).toMatchObject({
			playerId: "p1",
			anomalyId: entity.id,
		});

		const snapshot = sim.match.snapshot();

		expect(snapshot.players[0].flags & PLAYER_FLAG.hallucinating).not.toBe(0);
		expect(entity.state).toBe("special");
		expect(snapshot.anomalies[0].extra).toBe(1);
	});

	it("s'éloigne puis blesse à sa deuxième attaque", () => {
		const { sim, victim, entity } = mothScenario();

		runUntilStrikes(sim, 1, 6);

		const retreatStart = { ...entity.position };

		sim.run(1.2);

		expect(
			Math.hypot(
				entity.position.x - victim.position.x,
				entity.position.z - victim.position.z,
			),
		).toBeGreaterThan(
			Math.hypot(
				retreatStart.x - victim.position.x,
				retreatStart.z - victim.position.z,
			),
		);

		runUntilStrikes(sim, 2, 14);

		expect(strikes(sim).filter((event) => event.hit)).toHaveLength(2);
		expect(victim.health).toBe(HEALTH_MAX - SPECIES.phalene.damage);
		expect(sim.transport.eventsOfType("hallucination")).toHaveLength(1);
	});

	it("dissipe ses visions quand on la capture", () => {
		const { sim, victim, entity } = mothScenario();

		startHallucination(sim.match, victim, entity);
		sim.match.removeAnomaly(entity, "captured");
		sim.run(0.1);

		expect(victim.hallucinatingUntil).toBe(0);
		expect(victim.hallucinatedBy).toBeNull();

		expect(sim.transport.eventsOfType("hallucination").at(-1)).toMatchObject({
			playerId: "p1",
			anomalyId: null,
			until: 0,
		});
	});

	it("laisse les visions s'éteindre d'elles-mêmes et à la mort", () => {
		const { sim, victim, entity } = mothScenario();

		entity.active = false;

		startHallucination(sim.match, victim, entity);
		sim.run(HALLUCINATION_MS / 1000 + 0.3);

		expect(victim.hallucinatingUntil).toBe(0);

		expect(
			sim.match.snapshot().players[0].flags & PLAYER_FLAG.hallucinating,
		).toBe(0);

		startHallucination(sim.match, victim, entity);
		sim.match.applyDamage(victim, HEALTH_MAX, "phalene", null);
		sim.run(0.1);

		expect(victim.alive).toBe(false);
		expect(victim.hallucinatingUntil).toBe(0);
	});
});
