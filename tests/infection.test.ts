import { describe, expect, it } from "vitest";
import type { AnomalyEntity } from "../server/game/ai/AnomalyEntity.js";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import {
	canBeInfected,
	infectPlayer,
	planCompulsion,
	startCompulsion,
	updateInfections,
} from "../server/game/systems/infection.js";
import { CompulsionDriver } from "../shared/anomalies/compulsion.js";
import {
	CORDYCEPS_INFECT_DAMAGE,
	CORDYCEPS_RIPEN_MS,
	HEALTH_MAX,
	INFECTION_MS,
} from "../shared/config/index.js";
import { SPECIES } from "../shared/config/species.js";
import { findLeapSpots, type LeapSpot } from "../shared/manor/ledges.js";
import type { CompulsionKind } from "../shared/protocol/game.js";
import { PLAYER_FLAG } from "../shared/protocol/game.js";
import {
	findClearLine,
	installAnomaly,
	placeBot,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function quietSimulation(seed = 4242, players = 1): MatchSimulation {
	const sim = new MatchSimulation({ seed, players });

	silenceAnomalies(sim);

	return sim;
}

function player(sim: MatchSimulation, id = "p1"): MatchPlayer {
	return sim.match.players.get(id) as MatchPlayer;
}

function biteScenario(ripe: boolean, lantern: boolean) {
	const sim = quietSimulation();
	const line = findClearLine(sim, 1.3);

	placeBot(sim, "p1", line.origin, line.yaw);

	const victim = player(sim);

	victim.protectedUntil = 0;

	sim.bot("p1").lantern = lantern;

	sim.run(0.2);

	const entity = installAnomaly(
		sim,
		0,
		"cordyceps",
		line.target,
		line.yaw + Math.PI,
	);

	entity.ripenSince = ripe ? sim.match.now - CORDYCEPS_RIPEN_MS : sim.match.now;

	for (let step = 0; step < 40; step += 1) {
		sim.run(0.1);

		if (
			sim.transport
				.eventsOfType("attack")
				.some((event) => event.phase === "strike")
		) {
			break;
		}
	}

	return { sim, victim, entity };
}

function infected(sim: MatchSimulation, kind: CompulsionKind) {
	const victim = player(sim);

	const source = installAnomaly(sim, sim.match.anomalies.length, "cordyceps", {
		x: 0,
		y: -50,
		z: 0,
	});

	source.active = false;

	infectPlayer(sim.match, victim, source);

	const order = planCompulsion(sim.match, victim, kind);

	return { victim, source, order };
}

function obey(sim: MatchSimulation, driver: CompulsionDriver, seconds: number) {
	const bot = sim.bot("p1");

	sim.run(seconds, () => {
		const steer = driver.steer(
			{ x: bot.character.x, y: bot.character.y, z: bot.character.z },
			sim.match.now,
		);

		bot.input.forward = steer.forward;
		bot.input.sprint = steer.sprint;
		bot.input.jump = steer.jump;

		if (steer.yaw !== null) {
			bot.input.yaw = steer.yaw;
		}
	});
}

function leapScenario(): { sim: MatchSimulation; spot: LeapSpot } {
	for (let seed = 1; seed <= 12; seed += 1) {
		const sim = quietSimulation(seed);
		const spots = findLeapSpots(sim.match.layout, sim.match.world);

		const spot = spots.find(
			(candidate) =>
				sim.match.grid.isWalkablePoint(candidate.start) && candidate.drop > 2,
		);

		if (spot) {
			return { sim, spot };
		}
	}

	throw new Error("Aucune mezzanine avec un élan dégagé");
}

describe("morsure du Cordyceps", () => {
	it("blesse sans infecter tant que sa massue n'est pas mûre", () => {
		const { victim } = biteScenario(false, false);

		expect(victim.health).toBe(HEALTH_MAX - SPECIES.cordyceps.damage);
		expect(victim.infected(Number.MAX_SAFE_INTEGER - 1)).toBe(false);
		expect(victim.infectedUntil).toBe(0);
	});

	it("infecte quand sa massue est mûre et la lanterne éteinte", () => {
		const { sim, victim, entity } = biteScenario(true, false);

		expect(victim.health).toBe(HEALTH_MAX - CORDYCEPS_INFECT_DAMAGE);
		expect(victim.infected(sim.match.now)).toBe(true);
		expect(victim.infectedBy).toBe(entity.id);

		expect(sim.transport.eventsOfType("infection")[0]).toMatchObject({
			playerId: "p1",
			anomalyId: entity.id,
		});

		expect(
			sim.match.snapshot().players[0].flags & PLAYER_FLAG.infected,
		).not.toBe(0);

		expect(entity.ripenSince).toBeGreaterThan(sim.match.now - 5_000);
	});

	it("voit ses spores brûlées par une lanterne ouverte", () => {
		const { victim } = biteScenario(true, true);

		expect(victim.health).toBe(HEALTH_MAX - SPECIES.cordyceps.damage);
		expect(victim.infectedUntil).toBe(0);
	});
});

describe("joueur infecté", () => {
	it("hurle malgré lui et attire les anomalies voisines", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 8);

		placeBot(sim, "p1", line.origin, line.yaw);

		const listener = installAnomaly(sim, 0, "veilleur", line.target, line.yaw);
		const { victim, order } = infected(sim, "scream");

		victim.protectedUntil = Infinity;

		startCompulsion(sim.match, victim, order ?? undefined);

		expect(listener.luredUntil).toBeGreaterThan(sim.match.now);
		expect(victim.shoutingUntil).toBeGreaterThan(sim.match.now);

		expect(
			sim.match.snapshot().players[0].flags & PLAYER_FLAG.compelled,
		).not.toBe(0);

		sim.run(0.1);

		expect(sim.transport.eventsOfType("compulsion")[0]).toMatchObject({
			playerId: "p1",
			kind: "scream",
		});
	});

	it("court vers l'anomalie la plus proche", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 10);

		placeBot(sim, "p1", line.origin, line.yaw + Math.PI);

		const prey: AnomalyEntity = installAnomaly(
			sim,
			0,
			"fulgurant",
			line.target,
			line.yaw,
		);

		const { victim, order } = infected(sim, "lure");

		victim.protectedUntil = Infinity;

		expect(order?.path.length).toBeGreaterThan(0);

		startCompulsion(sim.match, victim, order ?? undefined);

		obey(
			sim,
			new CompulsionDriver(
				order ?? { kind: "lure", until: 0, path: [], leap: null },
			),
			4,
		);

		const gap = Math.hypot(
			victim.position.x - prey.position.x,
			victim.position.z - prey.position.z,
		);

		expect(gap).toBeLessThan(3.5);
	});

	it("saute par-dessus le garde-corps d'une mezzanine", () => {
		const { sim, spot } = leapScenario();

		placeBot(
			sim,
			"p1",
			spot.start,
			Math.atan2(-spot.direction.x, -spot.direction.z),
		);

		const { victim, order } = infected(sim, "leap");

		victim.protectedUntil = 0;

		expect(order?.leap).not.toBeNull();

		startCompulsion(sim.match, victim, order ?? undefined);

		obey(
			sim,
			new CompulsionDriver(
				order ?? { kind: "leap", until: 0, path: [], leap: null },
			),
			4,
		);

		expect(sim.bot("p1").character.y).toBeLessThan(spot.start.y - 1.5);

		expect(
			sim.transport
				.eventsOfType("damage")
				.some((event) => event.playerId === "p1" && event.source === "fall"),
		).toBe(true);
	});

	it("sort de force de sa cachette en hurlant", () => {
		const sim = quietSimulation();

		const spot = sim.match.layout.hideSpots.find((candidate) => {
			const furniture = sim.match.layout.furniture[candidate.furnitureId];

			return (
				furniture.level === 0 &&
				sim.match.grid.nearestNode(
					{ x: candidate.entry.x, y: furniture.y, z: candidate.entry.z },
					0,
				) !== null
			);
		});

		if (!spot) {
			throw new Error("Aucune cachette accessible");
		}

		const furniture = sim.match.layout.furniture[spot.furnitureId];

		placeBot(
			sim,
			"p1",
			{ x: spot.entry.x, y: furniture.y, z: spot.entry.z },
			spot.facing,
		);

		sim.match.handleInteract("p1", { kind: "hide", id: spot.id });

		const victim = player(sim);

		expect(victim.hidden).toBe(true);

		const { order } = infected(sim, "expel");

		expect(order?.kind).toBe("expel");

		startCompulsion(sim.match, victim, order ?? undefined);

		expect(victim.hidden).toBe(false);
		expect(victim.shoutingUntil).toBeGreaterThan(sim.match.now);
	});

	it("garde la lanterne ouverte pendant la compulsion", () => {
		const sim = quietSimulation();

		placeBot(sim, "p1", findClearLine(sim, 3).origin, 0);

		const { victim, order } = infected(sim, "lantern");

		startCompulsion(sim.match, victim, order ?? undefined);

		expect(victim.lanternOpen).toBe(true);

		sim.match.handleLantern("p1", false);

		expect(victim.lanternOpen).toBe(true);

		sim.run(6);
		sim.match.handleLantern("p1", false);

		expect(victim.lanternOpen).toBe(false);
	});

	it("est libéré par la poussée d'un allié", () => {
		const sim = quietSimulation(4242, 2);
		const line = findClearLine(sim, 3);

		placeBot(sim, "p1", line.origin, line.yaw);

		placeBot(
			sim,
			"p2",
			{
				x: line.origin.x - Math.sin(line.yaw) * -0.9,
				y: line.origin.y,
				z: line.origin.z - Math.cos(line.yaw) * -0.9,
			},
			line.yaw,
		);

		const { victim } = infected(sim, "scream");

		startCompulsion(sim.match, victim);

		expect(victim.compelled(sim.match.now)).toBe(true);

		player(sim, "p2").energy = 100;

		sim.match.handlePush("p2", line.yaw);

		expect(victim.compelled(sim.match.now)).toBe(false);
	});

	it("guérit quand son Cordyceps est capturé", () => {
		const sim = quietSimulation();

		placeBot(sim, "p1", findClearLine(sim, 3).origin, 0);

		const { victim, source } = infected(sim, "scream");

		source.active = true;

		sim.match.removeAnomaly(source, "captured");
		sim.run(0.1);

		expect(victim.infected(sim.match.now)).toBe(false);
		expect(sim.transport.eventsOfType("infection").at(-1)?.until).toBe(0);
	});

	it("guérit au bout de 40 s puis résiste un moment aux spores", () => {
		const sim = quietSimulation();

		placeBot(sim, "p1", findClearLine(sim, 3).origin, 0);

		const { victim } = infected(sim, "scream");

		victim.protectedUntil = Infinity;

		sim.run(INFECTION_MS / 1000 + 0.3);
		updateInfections(sim.match);

		expect(victim.infected(sim.match.now)).toBe(false);
		expect(canBeInfected(sim.match, victim)).toBe(false);

		sim.run(31);

		expect(canBeInfected(sim.match, victim)).toBe(true);
	});
});
