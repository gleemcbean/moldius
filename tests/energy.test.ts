import { describe, expect, it } from "vitest";
import { MatchPlayer } from "../server/game/MatchPlayer.js";
import { spendEnergy, stepEnergy } from "../server/game/systems/energy.js";
import {
	ENERGY_MAX,
	ENERGY_USE_REGEN_PAUSE_SECONDS,
	JUMP_ENERGY_COST,
	JUMP_REGEN_PAUSE_SECONDS,
	LANTERN_ENERGY_COST_PER_SECOND,
	LANTERN_OPEN_ENERGY_COST,
	SPRINT_ENERGY_COST_PER_SECOND,
	SPRINT_RESUME_THRESHOLD,
	SPRINT_START_ENERGY_COST,
} from "../shared/config/index.js";
import { silenceAnomalies } from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

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

	it("baisse à chaque saut enchaîné, sans régénérer entre deux", () => {
		const sim = new MatchSimulation({ seed: 4242, players: 1 });
		silenceAnomalies(sim);
		sim.run(1);
		const target = sim.match.players.get("p1") as MatchPlayer;
		const bot = sim.bot("p1");
		bot.input.jump = true;
		sim.run(5);
		expect(bot.jumps).toBeGreaterThanOrEqual(4);
		expect(target.energy).toBeCloseTo(
			ENERGY_MAX - bot.jumps * JUMP_ENERGY_COST,
			5,
		);
	});

	it("débite les sauts qui tiennent dans un seul message", () => {
		const sim = new MatchSimulation({ seed: 4242, players: 1 });
		silenceAnomalies(sim);
		sim.run(1);
		const target = sim.match.players.get("p1") as MatchPlayer;
		const bot = sim.bot("p1");
		bot.jumps += 2;
		sim.run(0.05);
		expect(target.energy).toBeCloseTo(ENERGY_MAX - JUMP_ENERGY_COST * 2, 5);
		bot.jumps = 0;
		sim.run(0.05);
		expect(target.jumpsSeen).toBe(0);
		expect(target.energy).toBeCloseTo(ENERGY_MAX - JUMP_ENERGY_COST * 2, 5);
	});

	it("ne régénère pas entre deux coups de sprint ou de lanterne", () => {
		const target = player();
		target.energy = 50;
		target.lanternOpen = true;
		run(target, 0.2);
		target.lanternOpen = false;
		const after = target.energy;
		run(target, ENERGY_USE_REGEN_PAUSE_SECONDS - 0.1);
		expect(target.energy).toBe(after);
		run(target, 1.1);
		expect(target.energy).toBeGreaterThan(after);
	});

	it("fait payer chaque ouverture de la lanterne", () => {
		const sim = new MatchSimulation({ seed: 4242, players: 1 });
		silenceAnomalies(sim);
		sim.run(1);
		const target = sim.match.players.get("p1") as MatchPlayer;
		sim.match.handleLantern("p1", true);
		expect(target.energy).toBeCloseTo(ENERGY_MAX - LANTERN_OPEN_ENERGY_COST, 5);
		const opened = target.energy;
		sim.match.handleLantern("p1", true);
		expect(target.energy).toBe(opened);
		sim.match.handleLantern("p1", false);
		expect(target.energy).toBe(opened);
	});

	it("vide l'énergie quand on spamme le sprint", () => {
		const sim = new MatchSimulation({ seed: 4242, players: 1 });
		silenceAnomalies(sim);
		sim.run(1);
		const target = sim.match.players.get("p1") as MatchPlayer;
		const bot = sim.bot("p1");
		bot.input.forward = 1;
		bot.input.sprint = true;
		sim.run(0.1);
		expect(target.energy).toBeLessThanOrEqual(
			ENERGY_MAX - SPRINT_START_ENERGY_COST,
		);
		const before = target.energy;
		for (let tap = 0; tap < 8; tap += 1) {
			bot.input.sprint = false;
			sim.run(0.15);
			bot.input.sprint = true;
			sim.run(0.15);
		}
		expect(target.energy).toBeLessThanOrEqual(
			before - 8 * SPRINT_START_ENERGY_COST,
		);
	});

	it("attend après un saut avant de régénérer", () => {
		const target = player();
		target.energy = 50;
		target.energyRegenPause = JUMP_REGEN_PAUSE_SECONDS;
		run(target, JUMP_REGEN_PAUSE_SECONDS - 0.1);
		expect(target.energy).toBe(50);
		run(target, 1.1);
		expect(target.energy).toBeCloseTo(58, 5);
	});
});
