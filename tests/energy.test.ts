import { describe, expect, it } from "vitest";
import { MatchPlayer } from "../server/game/MatchPlayer.js";
import { silenceAnomalies } from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";
import { spendEnergy, stepEnergy } from "../server/game/systems/energy.js";
import {
	ENERGY_MAX,
	JUMP_ENERGY_COST,
	LANTERN_ENERGY_COST_PER_SECOND,
	SPRINT_ENERGY_COST_PER_SECOND,
	SPRINT_RESUME_THRESHOLD,
} from "../shared/config/index.js";

function player(): MatchPlayer {
	return new MatchPlayer(
		"p1",
		"Testeur",
		0xffffff,
		{ x: 0, y: 0, z: 0, yaw: 0 },
		0,
	);
}

function run(target: MatchPlayer, seconds: number): void {
	const dt = 0.05;
	for (let time = 0; time < seconds - 1e-9; time += dt) {
		stepEnergy(target, dt);
	}
}

describe("énergie", () => {
	it("consomme 15/s en sprint", () => {
		const target = player();
		target.sprintIntent = true;
		target.moveInput = true;
		run(target, 2);
		expect(target.energy).toBeCloseTo(
			ENERGY_MAX - SPRINT_ENERGY_COST_PER_SECOND * 2,
			5,
		);
	});

	it("consomme 3,8/s avec la lanterne ouverte", () => {
		const target = player();
		target.lanternOpen = true;
		run(target, 5);
		expect(target.energy).toBeCloseTo(
			ENERGY_MAX - LANTERN_ENERGY_COST_PER_SECOND * 5,
			5,
		);
	});

	it("cumule sprint et lanterne", () => {
		const target = player();
		target.lanternOpen = true;
		target.sprintIntent = true;
		target.moveInput = true;
		run(target, 2);
		expect(target.energy).toBeCloseTo(
			ENERGY_MAX -
				(SPRINT_ENERGY_COST_PER_SECOND + LANTERN_ENERGY_COST_PER_SECOND) * 2,
			5,
		);
	});

	it("ne consomme pas en sprint immobile ou accroupi", () => {
		const target = player();
		target.energy = 50;
		target.sprintIntent = true;
		target.moveInput = false;
		run(target, 1);
		expect(target.energy).toBeCloseTo(58, 5);
		target.moveInput = true;
		target.crouch = 1;
		run(target, 1);
		expect(target.energy).toBeCloseTo(66, 5);
	});

	it("régénère 8/s au repos jusqu'au maximum", () => {
		const target = player();
		target.energy = 10;
		run(target, 2);
		expect(target.energy).toBeCloseTo(26, 5);
		run(target, 20);
		expect(target.energy).toBe(ENERGY_MAX);
	});

	it("applique l'hystérésis du sprint : arrêt à 1, reprise à 20", () => {
		const target = player();
		target.sprintIntent = true;
		target.moveInput = true;
		let elapsed = 0;
		while (!target.sprintLocked && elapsed < 10) {
			stepEnergy(target, 0.05);
			elapsed += 0.05;
		}
		expect(target.sprintLocked).toBe(true);
		expect(target.energy).toBeLessThanOrEqual(1);
		expect(elapsed).toBeCloseTo(6.6, 1);
		run(target, 1);
		expect(target.sprintLocked).toBe(true);
		while (target.sprintLocked && elapsed < 20) {
			stepEnergy(target, 0.05);
			elapsed += 0.05;
		}
		expect(target.sprintLocked).toBe(false);
		expect(target.energy).toBeGreaterThanOrEqual(SPRINT_RESUME_THRESHOLD);
		expect(target.energy).toBeLessThan(SPRINT_RESUME_THRESHOLD + 0.5);
	});

	it("referme la lanterne à zéro énergie", () => {
		const target = player();
		target.energy = 1;
		target.lanternOpen = true;
		let closed = false;
		for (let index = 0; index < 20 && !closed; index += 1) {
			closed = stepEnergy(target, 0.05).lanternForcedClosed;
		}
		expect(closed).toBe(true);
		expect(target.lanternOpen).toBe(false);
	});

	it("refuse une action trop coûteuse", () => {
		const target = player();
		target.energy = 11;
		expect(spendEnergy(target, 12)).toBe(false);
		expect(target.energy).toBe(11);
		target.energy = 30;
		expect(spendEnergy(target, 12)).toBe(true);
		expect(target.energy).toBe(18);
	});

	it("débite l'énergie d'un saut côté serveur", () => {
		const sim = new MatchSimulation({ seed: 4242, players: 1 });
		silenceAnomalies(sim);
		sim.run(1);
		const target = sim.match.players.get("p1") as MatchPlayer;
		expect(target.energy).toBe(ENERGY_MAX);
		const bot = sim.bot("p1");
		bot.input.jump = true;
		sim.run(0.1);
		bot.input.jump = false;
		expect(target.grounded).toBe(false);
		expect(target.energy).toBeLessThanOrEqual(
			ENERGY_MAX - JUMP_ENERGY_COST + 1,
		);
		sim.run(2);
		expect(target.grounded).toBe(true);
	});
});
