import { beforeEach, describe, expect, it } from "vitest";
import { hoverHeight } from "../server/game/ai/locomotion.js";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import { ANOMALY_RETURN_DELAY_MS } from "../shared/config/index.js";
import { SPECIES } from "../shared/config/species.js";
import {
	type ClearLine,
	castAt,
	findClearLine,
	installAnomaly,
	placeBot,
	prepareCaster,
	silenceAnomalies,
	speakFormula,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

let sim: MatchSimulation;
let line: ClearLine;

function setup(
	distance = 3.4,
	players = 1,
	seeds: readonly number[] = [4242],
): void {
	for (const seed of seeds) {
		sim = new MatchSimulation({ seed, players });
		silenceAnomalies(sim);
		try {
			line = findClearLine(sim, distance);
		} catch (error) {
			if (seed === seeds[seeds.length - 1]) {
				throw error;
			}
			continue;
		}
		break;
	}
	placeBot(sim, "p1", line.origin, line.yaw);
}

describe("captures vocales validées par le serveur", () => {
	beforeEach(() => setup());

	it("capture un Veilleur avec la bonne formule, lanterne ouverte et immobile", () => {
		prepareCaster(sim, "p1", { lantern: true });
		const entity = installAnomaly(
			sim,
			0,
			"veilleur",
			line.target,
			line.yaw + Math.PI,
		);
		const result = castAt(sim, "p1", entity);
		expect(result.ok).toBe(true);
		expect(result.points).toBe(SPECIES.veilleur.points);
		expect((sim.match.players.get("p1") as MatchPlayer).score).toBe(
			SPECIES.veilleur.points,
		);
		expect(entity.active).toBe(false);
		sim.run(0.05);
		expect(sim.transport.eventsOfType("capture")).toHaveLength(1);
		expect(sim.transport.eventsOfType("anomalyRemoved")[0]).toMatchObject({
			anomalyId: entity.id,
			reason: "captured",
		});
	});

	it("refuse une formule erronée", () => {
		prepareCaster(sim, "p1", { lantern: true });
		const entity = installAnomaly(
			sim,
			0,
			"veilleur",
			line.target,
			line.yaw + Math.PI,
		);
		const result = castAt(sim, "p1", entity, ["febris", "gladius", "nebula"]);
		expect(result).toMatchObject({ ok: false, reason: "wrong-words" });
		expect(entity.active).toBe(true);
	});

	it("refuse la formule d'un autre exemplaire", () => {
		prepareCaster(sim, "p1", { lantern: true });
		const entity = installAnomaly(
			sim,
			0,
			"veilleur",
			line.target,
			line.yaw + Math.PI,
		);
		const result = castAt(sim, "p1", entity, ["stella", "corvus", "vapor"]);
		expect(result.reason).toBe("wrong-words");
	});

	it("ignore la lanterne : ouverte ou fermée, la capture passe", () => {
		prepareCaster(sim, "p1", { lantern: true });
		const lit = installAnomaly(sim, 0, "murmure", line.target);
		expect(castAt(sim, "p1", lit).ok).toBe(true);
		prepareCaster(sim, "p1", { lantern: false });
		const dark = installAnomaly(
			sim,
			0,
			"veilleur",
			line.target,
			line.yaw + Math.PI,
		);
		expect(castAt(sim, "p1", dark).ok).toBe(true);
	});

	it("n'exige plus de rester immobile", () => {
		prepareCaster(sim, "p1", { lantern: true });
		const bot = sim.bot("p1");
		bot.input.forward = 1;
		sim.run(0.4);
		bot.input.forward = 0;
		const entity = installAnomaly(
			sim,
			0,
			"veilleur",
			{
				x: bot.character.x + (line.target.x - line.origin.x),
				y: line.target.y,
				z: bot.character.z + (line.target.z - line.origin.z),
			},
			line.yaw + Math.PI,
		);
		expect(castAt(sim, "p1", entity).ok).toBe(true);
	});

	it("exige une activité vocale réelle", () => {
		prepareCaster(sim, "p1", { lantern: true, voiceLevel: 0 });
		const entity = installAnomaly(
			sim,
			0,
			"veilleur",
			line.target,
			line.yaw + Math.PI,
		);
		expect(castAt(sim, "p1", entity).reason).toBe("no-voice");
	});

	it("capture sans viser : la formule suffit à désigner l'anomalie", () => {
		prepareCaster(sim, "p1", { lantern: true });
		const entity = installAnomaly(
			sim,
			0,
			"veilleur",
			line.target,
			line.yaw + Math.PI,
		);
		const bot = sim.bot("p1");
		bot.input.yaw = line.yaw + 1.2;
		bot.pitch = -0.6;
		sim.run(0.2);
		const result = speakFormula(sim, "p1", entity.formula);
		expect(result.ok).toBe(true);
		expect(result.anomalyId).toBe(entity.id);
	});

	it("ignore une phrase qui ne correspond à aucune anomalie présente", () => {
		prepareCaster(sim, "p1", { lantern: true });
		installAnomaly(sim, 0, "veilleur", line.target, line.yaw + Math.PI);
		const result = speakFormula(sim, "p1", ["bonjour", "tout", "le", "monde"]);
		expect(result.ok).toBe(false);
		expect(result.reason).toBe("wrong-words");
	});

	it("capture toutes les espèces jusqu'à 5 m, pas au-delà", () => {
		for (const species of ["crache-cendre", "luciole", "veilleur"] as const) {
			setup(4.6);
			prepareCaster(sim, "p1", { voiceLevel: 0.95 });
			const near = installAnomaly(sim, 0, species, line.target);
			expect(castAt(sim, "p1", near).ok).toBe(true);
		}
		setup(6.6, 1, [4242, 7, 19, 23, 101, 202, 303, 404, 505, 606]);
		prepareCaster(sim, "p1", { voiceLevel: 0.95 });
		const far = installAnomaly(sim, 0, "crache-cendre", line.target);
		expect(castAt(sim, "p1", far).reason).toBe("out-of-range");
	});

	it("capture un Doppelgänger même non révélé", () => {
		prepareCaster(sim, "p1", { lantern: true });
		const entity = installAnomaly(sim, 0, "double", line.target);
		entity.revealed = false;
		expect(castAt(sim, "p1", entity).ok).toBe(true);
	});
});

describe("cri du Hurleur", () => {
	beforeEach(() => setup());

	it("bloque la capture des autres espèces mais jamais la sienne", () => {
		prepareCaster(sim, "p1", { lantern: true });
		const veilleur = installAnomaly(
			sim,
			0,
			"veilleur",
			line.target,
			line.yaw + Math.PI,
		);
		const side = {
			x: line.origin.x * 0.5 + line.target.x * 0.5,
			y: line.origin.y,
			z: line.origin.z * 0.5 + line.target.z * 0.5,
		};
		const hurleur = installAnomaly(sim, 1, "hurleur", side, 0, [
			"tambour",
			"girafe",
			"cerise",
			"manteau",
		]);
		hurleur.nextScreamAt = Infinity;
		hurleur.screamUntil = Infinity;
		expect(castAt(sim, "p1", veilleur).reason).toBe("howler-scream");
		(sim.match.players.get("p1") as MatchPlayer).castBlockedUntil = 0;
		prepareCaster(sim, "p1", { lantern: true, voiceLevel: 0.95 });
		hurleur.position = {
			...line.target,
			y: line.target.y + hoverHeight(hurleur),
		};
		hurleur.history.clear();
		hurleur.history.push({ t: sim.match.now, ...hurleur.position, yaw: 0 });
		veilleur.active = false;
		const own = castAt(sim, "p1", hurleur);
		expect(own.ok).toBe(true);
		expect(own.points).toBe(SPECIES.hurleur.points);
	});
});

describe("retour des anomalies capturées", () => {
	it("revient après une minute avec une nouvelle génération", () => {
		setup();
		prepareCaster(sim, "p1", { lantern: true });
		const entity = installAnomaly(
			sim,
			0,
			"veilleur",
			line.target,
			line.yaw + Math.PI,
		);
		const generation = entity.gen;
		expect(castAt(sim, "p1", entity).ok).toBe(true);
		const capturedAt = sim.match.now;
		expect(entity.spawnDueAt).toBe(capturedAt + ANOMALY_RETURN_DELAY_MS);
		sim.bot("p1").lantern = false;
		sim.run(ANOMALY_RETURN_DELAY_MS / 1000 - 1);
		expect(entity.active).toBe(false);
		sim.run(20);
		expect(entity.active).toBe(true);
		expect(entity.gen).toBe(generation + 1);
		const spawn = sim.transport
			.eventsOfType("anomalySpawn")
			.find((event) => event.anomalyId === entity.id);
		expect(spawn?.gen).toBe(generation + 1);
	});
});

describe("règles d'incantation supplémentaires", () => {
	beforeEach(() => setup());

	it("n'exige jamais de murmurer ni de clamer la formule", () => {
		prepareCaster(sim, "p1", { crouch: true, voiceLevel: 0.95 });
		const murmure = installAnomaly(sim, 0, "murmure", line.target);
		expect(castAt(sim, "p1", murmure)).toMatchObject({ ok: true });
		setup(4.2, 1, [4242, 777, 31337]);
		prepareCaster(sim, "p1", { voiceLevel: 0.3 });
		const cendre = installAnomaly(sim, 0, "crache-cendre", line.target);
		expect(castAt(sim, "p1", cendre)).toMatchObject({ ok: true });
	});

	it("un dégât subi n'annule pas l'incantation", () => {
		prepareCaster(sim, "p1", { lantern: true });
		const entity = installAnomaly(
			sim,
			0,
			"veilleur",
			line.target,
			line.yaw + Math.PI,
		);
		const player = sim.match.players.get("p1") as MatchPlayer;
		sim.match.handleCastBegin("p1");
		player.protectedUntil = 0;
		expect(sim.match.applyDamage(player, 10, "murmure", null)).toBe(true);
		expect(player.casting).not.toBeNull();
		expect(castAt(sim, "p1", entity).ok).toBe(true);
	});
});
