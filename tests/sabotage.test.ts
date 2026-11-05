import { beforeEach, describe, expect, it } from "vitest";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import {
	PUSH_COOLDOWN_MS,
	PUSH_ENERGY_COST,
	SHOUT_COOLDOWN_MS,
	SHOUT_ENERGY_COST,
} from "../shared/config/index.js";
import { yawToDirection } from "../shared/math.js";
import {
	type ClearLine,
	castAt,
	findClearLine,
	installAnomaly,
	placeBot,
	prepareCaster,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

let sim: MatchSimulation;
let line: ClearLine;

function beside(distance: number): { x: number; y: number; z: number } {
	const direction = yawToDirection(line.yaw);
	return {
		x: line.origin.x + direction.x * distance,
		y: line.origin.y,
		z: line.origin.z + direction.z * distance,
	};
}

beforeEach(() => {
	sim = new MatchSimulation({ seed: 4242, players: 2 });
	silenceAnomalies(sim);
	line = findClearLine(sim, 3.4);
	placeBot(sim, "p1", line.origin, line.yaw);
	placeBot(sim, "p2", beside(1.4), line.yaw + Math.PI);
	sim.run(2.2);
});

describe("sabotage compétitif", () => {
	it("le cri interrompt une incantation proche et coûte 12 d'énergie avec 8 s de recharge", () => {
		const caster = sim.match.players.get("p1") as MatchPlayer;
		const saboteur = sim.match.players.get("p2") as MatchPlayer;
		sim.match.handleCastBegin("p1");
		caster.casting = { since: sim.match.now };
		const energyBefore = saboteur.energy;
		sim.match.handleShout("p2");
		expect(caster.casting).toBeNull();
		expect(saboteur.energy).toBeCloseTo(energyBefore - SHOUT_ENERGY_COST, 5);
		expect(saboteur.shoutCooldownUntil).toBe(sim.match.now + SHOUT_COOLDOWN_MS);
		sim.run(0.05);
		expect(sim.transport.eventsOfType("castInterrupted")[0]).toMatchObject({
			playerId: "p1",
			byId: "p2",
			cause: "shout",
		});
		const energyAfter = saboteur.energy;
		sim.match.handleShout("p2");
		expect(saboteur.energy).toBeCloseTo(energyAfter, 5);
	});

	it("une incantation interrompue échoue côté serveur", () => {
		prepareCaster(sim, "p1", { lantern: true });
		const entity = installAnomaly(
			sim,
			0,
			"veilleur",
			line.target,
			line.yaw + Math.PI,
		);
		sim.match.handleCastBegin("p1");
		sim.match.handleShout("p2");
		sim.match.handleCast("p1", {
			transcripts: [entity.formula.join(" ")],
			method: "speech",
		});
		const results = sim.transport.messages.filter(
			(message) => message.event === "game:castResult",
		);
		expect(
			(results[results.length - 1].payload as { reason: string }).reason,
		).toBe("interrupted");
		expect(entity.active).toBe(true);
	});

	it("la poussée déplace la cible, coûte 12 d'énergie et a 4,5 s de recharge", () => {
		const target = sim.match.players.get("p1") as MatchPlayer;
		const pusher = sim.match.players.get("p2") as MatchPlayer;
		const before = { ...target.position };
		const energyBefore = pusher.energy;
		const towardTarget = Math.atan2(
			-(target.position.x - pusher.position.x),
			-(target.position.z - pusher.position.z),
		);
		sim.match.handlePush("p2", towardTarget);
		expect(pusher.energy).toBeCloseTo(energyBefore - PUSH_ENERGY_COST, 5);
		expect(pusher.pushCooldownUntil).toBe(sim.match.now + PUSH_COOLDOWN_MS);
		expect(
			Math.hypot(target.position.x - before.x, target.position.z - before.z),
		).toBeGreaterThan(0.3);
		sim.run(0.05);
		expect(sim.transport.eventsOfType("push")[0]).toMatchObject({
			fromId: "p2",
			targetId: "p1",
		});
		const energyAfter = pusher.energy;
		sim.match.handlePush("p2", towardTarget);
		expect(pusher.energy).toBeCloseTo(energyAfter, 5);
	});

	it("la poussée exige de viser la cible", () => {
		const target = sim.match.players.get("p1") as MatchPlayer;
		const pusher = sim.match.players.get("p2") as MatchPlayer;
		const towardTarget = Math.atan2(
			-(target.position.x - pusher.position.x),
			-(target.position.z - pusher.position.z),
		);
		const energyBefore = pusher.energy;
		sim.match.handlePush("p2", towardTarget + Math.PI);
		expect(pusher.energy).toBe(energyBefore);
	});

	it("une voix forte et soutenue à proximité interrompt l'incantation", () => {
		const caster = sim.match.players.get("p1") as MatchPlayer;
		caster.casting = { since: sim.match.now };
		sim.bot("p1").voiceLevel = 0.2;
		sim.bot("p1").voicePeakMs = 50;
		sim.bot("p2").voiceLevel = 0.9;
		sim.bot("p2").voicePeakMs = 50;
		sim.run(0.6);
		expect(caster.casting).toBeNull();
		expect(
			sim.transport
				.eventsOfType("castInterrupted")
				.some((event) => event.cause === "voice" && event.byId === "p2"),
		).toBe(true);
	});

	it("une voix normale ne sabote pas", () => {
		const caster = sim.match.players.get("p1") as MatchPlayer;
		caster.casting = { since: sim.match.now };
		sim.bot("p2").voiceLevel = 0.4;
		sim.bot("p2").voicePeakMs = 50;
		sim.run(0.8);
		expect(caster.casting).not.toBeNull();
	});

	it("le sabotage peut interrompre la capture du Hurleur malgré son exemption", () => {
		prepareCaster(sim, "p1", { voiceLevel: 0.95 });
		const hurleur = installAnomaly(sim, 0, "hurleur", line.target);
		hurleur.screamUntil = sim.match.now + 60_000;
		hurleur.nextScreamAt = Infinity;
		sim.match.handleCastBegin("p1");
		sim.match.handleShout("p2");
		const caster = sim.match.players.get("p1") as MatchPlayer;
		expect(caster.casting).toBeNull();
		caster.castBlockedUntil = 0;
		caster.sabotageProtectedUntil = 0;
		const result = castAt(sim, "p1", hurleur);
		expect(result.ok).toBe(true);
	});
});
