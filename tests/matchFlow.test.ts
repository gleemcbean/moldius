import { describe, expect, it } from "vitest";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import { planRoster } from "../server/game/roster.js";
import { formulaKeyWord } from "../shared/anomalies/formulas.js";
import {
	ANOMALY_FIRST_SPAWN_DELAY_MS,
	ANOMALY_NEXT_DELAY_MS,
	anomalyTierCaps,
	MATCH_DURATION_MS,
	PLAYER_RESPAWN_DELAY_MS,
	PLAYER_RESPAWN_PROTECTION_MS,
	PUBLIC_SIMULTANEOUS_ANOMALIES,
} from "../shared/config/index.js";
import { SPECIES, SPECIES_IDS } from "../shared/config/species.js";
import {
	defaultPrivateConfig,
	sanitizeMatchConfig,
} from "../shared/matchConfig.js";
import { yawToDirection } from "../shared/math.js";
import { SeededRandom } from "../shared/random.js";
import {
	findClearLine,
	installAnomaly,
	placeBot,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

describe("pool d'espèces", () => {
	it("tire six à huit espèces par partie et couvre les dix espèces au fil des parties", () => {
		const seen = new Set<string>();
		for (let seed = 1; seed <= 60; seed += 1) {
			const plan = planRoster(new SeededRandom(seed), 10, new Set());
			expect(plan.pool.length).toBeGreaterThanOrEqual(6);
			expect(plan.pool.length).toBeLessThanOrEqual(8);
			expect(plan.pool.length).toBeLessThan(SPECIES_IDS.length);
			for (const instance of plan.instances) {
				seen.add(instance.species);
				expect(plan.pool).toContain(instance.species);
			}
		}
		expect(seen.size).toBe(SPECIES_IDS.length);
	});

	it("ne tire que les espèces choisies dans le lobby", () => {
		const allowed = ["brume", "veilleur", "murmure"] as const;
		for (let seed = 1; seed <= 20; seed += 1) {
			const plan = planRoster(new SeededRandom(seed), 8, new Set(), allowed);
			expect(
				plan.pool.every((species) => allowed.includes(species as never)),
			).toBe(true);
			expect(plan.instances.length).toBeGreaterThanOrEqual(7);
		}
		const fallback = defaultPrivateConfig();
		expect(
			sanitizeMatchConfig({ ...fallback, species: [] }, fallback).species,
		).toEqual([...SPECIES_IDS]);
		expect(
			sanitizeMatchConfig(
				{ ...fallback, species: ["gorgone", "nope", "brume", "brume"] },
				fallback,
			).species,
		).toEqual(["gorgone", "brume"]);
	});

	it("borne le pool au nombre d'anomalies et respecte 1 à 20 exemplaires", () => {
		expect(
			planRoster(new SeededRandom(3), 1, new Set()).instances,
		).toHaveLength(1);
		const large = planRoster(new SeededRandom(3), 20, new Set());
		expect(large.instances.length).toBeGreaterThanOrEqual(19);
		expect(large.instances.length).toBeLessThanOrEqual(20);
		const small = planRoster(new SeededRandom(9), 4, new Set());
		expect(small.pool.length).toBeLessThanOrEqual(small.instances.length);
	});

	it("donne une seule formule par espèce, à mots uniques d'une espèce à l'autre", () => {
		const plan = planRoster(new SeededRandom(17), 14, new Set());
		for (const species of plan.pool) {
			const formulas = new Set(
				plan.instances
					.filter((instance) => instance.species === species)
					.map((instance) => instance.formula.join(" ")),
			);
			expect(formulas.size).toBe(1);
		}
		const words = plan.pool.flatMap(
			(species) =>
				plan.instances
					.find((instance) => instance.species === species)
					?.formula.map(formulaKeyWord) ?? [],
		);
		expect(new Set(words).size).toBe(words.length);
		expect(plan.instances.length).toBeGreaterThan(plan.pool.length);
		for (const instance of plan.instances) {
			expect(instance.exemplar).toBeGreaterThanOrEqual(1);
			expect(instance.exemplar).toBeLessThanOrEqual(instance.exemplarCount);
		}
	});
});

describe("cycle de partie", () => {
	it("règle la durée d'une partie personnalisée entre 3 et 30 minutes", () => {
		const fallback = defaultPrivateConfig();
		expect(fallback.durationMinutes).toBe(16);
		const clamp = (durationMinutes: unknown) =>
			sanitizeMatchConfig({ ...fallback, durationMinutes }, fallback)
				.durationMinutes;
		expect(clamp(12.4)).toBe(12);
		expect(clamp(1)).toBe(3);
		expect(clamp(60)).toBe(30);
		expect(clamp("long")).toBe(16);
		const sim = new MatchSimulation({
			seed: 77,
			players: 1,
			config: { durationMinutes: 4 },
		});
		expect(sim.match.endsAt - sim.match.now).toBe(4 * 60_000);
	});

	it("garde au plus trois anomalies à la fois et fait venir la suivante après une capture", () => {
		const sim = new MatchSimulation({
			seed: 77,
			players: 2,
		});
		expect(sim.match.anomalies.length).toBeGreaterThan(
			PUBLIC_SIMULTANEOUS_ANOMALIES,
		);
		let most = 0;
		sim.run(ANOMALY_FIRST_SPAWN_DELAY_MS / 1000 + 20, () => {
			most = Math.max(
				most,
				sim.match.anomalies.filter((entity) => entity.active).length,
			);
		});
		expect(most).toBe(PUBLIC_SIMULTANEOUS_ANOMALIES);
		const captured = sim.match.anomalies.find((entity) => entity.active);
		if (!captured) {
			throw new Error("No active anomaly to capture.");
		}
		const waiting = sim.match.anomalies.filter((entity) => !entity.active);
		sim.match.removeAnomaly(captured, "captured");
		sim.run((ANOMALY_NEXT_DELAY_MS - 500) / 1000);
		expect(waiting.some((entity) => entity.active)).toBe(false);
		sim.run(2);
		expect(waiting.filter((entity) => entity.active)).toHaveLength(1);
		expect(captured.active).toBe(false);
		expect(sim.match.anomalies.filter((entity) => entity.active)).toHaveLength(
			PUBLIC_SIMULTANEOUS_ANOMALIES,
		);
	});

	it("ne fait jamais coexister plus d'anomalies d'une catégorie que sa limite", () => {
		for (const seed of [77, 101, 2024]) {
			const sim = new MatchSimulation({
				seed,
				players: 2,
				config: { simultaneousAnomalies: 3 },
			});
			const most = { 1: 0, 2: 0, 3: 0 };
			let total = 0;
			sim.run(ANOMALY_FIRST_SPAWN_DELAY_MS / 1000 + 90, () => {
				const counts = { 1: 0, 2: 0, 3: 0 };
				for (const entity of sim.match.anomalies) {
					if (entity.active) {
						counts[SPECIES[entity.species].tier] += 1;
					}
				}
				for (const tier of [1, 2, 3] as const) {
					most[tier] = Math.max(most[tier], counts[tier]);
				}
				total = Math.max(total, counts[1] + counts[2] + counts[3]);
				const active = sim.match.anomalies.filter((entity) => entity.active);
				if (active.length > 0 && sim.match.now % 7000 < 50) {
					sim.match.removeAnomaly(active[0], "captured");
				}
			});
			for (const tier of [1, 2, 3] as const) {
				expect(most[tier]).toBeLessThanOrEqual(anomalyTierCaps(3)[tier]);
			}
			expect(total).toBeLessThanOrEqual(3);
		}
	});

	it("atteint le nombre d'anomalies simultanées réglé dans le lobby", () => {
		const sim = new MatchSimulation({
			seed: 77,
			players: 2,
			config: { simultaneousAnomalies: 8 },
		});
		expect(sim.match.anomalies).toHaveLength(12);
		let most = 0;
		sim.run(ANOMALY_FIRST_SPAWN_DELAY_MS / 1000 + 45, () => {
			most = Math.max(
				most,
				sim.match.anomalies.filter((entity) => entity.active).length,
			);
		});
		expect(most).toBe(8);
	});

	it("tient le nombre demandé même avec une seule espèce autorisée", () => {
		const sim = new MatchSimulation({
			seed: 77,
			players: 1,
			config: { simultaneousAnomalies: 3, species: ["murmure"] },
		});
		let most = 0;
		sim.run(ANOMALY_FIRST_SPAWN_DELAY_MS / 1000 + 20, () => {
			most = Math.max(
				most,
				sim.match.anomalies.filter((entity) => entity.active).length,
			);
		});
		expect(most).toBe(3);
	});

	it("fait apparaître les anomalies après 30 s, hors de vue des joueurs", () => {
		const sim = new MatchSimulation({ seed: 77, players: 2 });
		const startedAt = sim.match.startedAt;
		sim.run(ANOMALY_FIRST_SPAWN_DELAY_MS / 1000 - 0.5);
		expect(sim.match.anomalies.some((entity) => entity.active)).toBe(false);
		const checks: number[] = [];
		sim.run(15, () => {
			for (const entity of sim.match.anomalies) {
				if (entity.active && entity.spawnedAt === sim.match.now - 50) {
					for (const player of sim.match.players.values()) {
						checks.push(
							Math.hypot(
								player.position.x - entity.position.x,
								player.position.y - entity.position.y,
								player.position.z - entity.position.z,
							),
						);
					}
				}
			}
		});
		const spawns = sim.transport.eventsOfType("anomalySpawn");
		expect(spawns.length).toBeGreaterThan(0);
		for (const entity of sim.match.anomalies.filter(
			(candidate) => candidate.active,
		)) {
			expect(entity.spawnedAt - startedAt).toBeGreaterThanOrEqual(
				ANOMALY_FIRST_SPAWN_DELAY_MS,
			);
		}
		expect(checks.length).toBeGreaterThan(0);
		for (const distance of checks) {
			expect(distance).toBeGreaterThanOrEqual(13.5);
		}
	});

	it("termine la partie à 480 s et publie les résultats", () => {
		const sim = new MatchSimulation({ seed: 5, players: 1 });
		silenceAnomalies(sim);
		sim.run(MATCH_DURATION_MS / 1000 - 1);
		expect(sim.match.phase).toBe("playing");
		sim.run(2);
		expect(sim.match.phase).toBe("ended");
		const end = sim.transport.messages.find(
			(message) => message.event === "game:end",
		);
		expect(end).toBeDefined();
		expect(sim.results).toBeTruthy();
	});

	it("réanime un joueur mort après 20 s avec une protection de 2 s", () => {
		const sim = new MatchSimulation({ seed: 5, players: 1 });
		silenceAnomalies(sim);
		sim.run(3);
		const player = sim.match.players.get("p1") as MatchPlayer;
		sim.match.applyDamage(player, 200, "veilleur", null);
		expect(player.alive).toBe(false);
		sim.run(PLAYER_RESPAWN_DELAY_MS / 1000 - 1);
		expect(player.alive).toBe(false);
		sim.run(1.5);
		expect(player.alive).toBe(true);
		expect(player.health).toBe(100);
		const respawn = sim.transport
			.eventsOfType("respawn")
			.find((event) => event.playerId === "p1") as { protectedUntil: number };
		expect(respawn.protectedUntil - sim.match.now).toBeLessThanOrEqual(
			PLAYER_RESPAWN_PROTECTION_MS,
		);
		expect(respawn.protectedUntil - sim.match.now).toBeGreaterThan(3_400);
		expect(sim.match.applyDamage(player, 30, "veilleur", null)).toBe(false);
		sim.run(PLAYER_RESPAWN_PROTECTION_MS / 1000 + 0.2);
		expect(sim.match.applyDamage(player, 30, "veilleur", null)).toBe(true);
	});

	it("limite la fréquence des dégâts répétés", () => {
		const sim = new MatchSimulation({ seed: 5, players: 1 });
		silenceAnomalies(sim);
		sim.run(3);
		const player = sim.match.players.get("p1") as MatchPlayer;
		expect(sim.match.applyDamage(player, 20, "veilleur", null)).toBe(true);
		expect(sim.match.applyDamage(player, 20, "veilleur", null)).toBe(false);
		expect(player.health).toBe(80);
	});

	it("corrige un déplacement impossible côté serveur", () => {
		const sim = new MatchSimulation({ seed: 5, players: 1 });
		silenceAnomalies(sim);
		sim.run(1);
		const bot = sim.bot("p1");
		const before = { ...(sim.match.players.get("p1") as MatchPlayer).position };
		bot.character.x += 12;
		sim.run(0.1);
		const corrections = sim.transport.forcedMoves.filter(
			(move) => move.kind === "correction",
		);
		expect(corrections.length).toBeGreaterThan(0);
		expect(
			Math.hypot(
				(sim.match.players.get("p1") as MatchPlayer).position.x - before.x,
				(sim.match.players.get("p1") as MatchPlayer).position.z - before.z,
			),
		).toBeLessThan(1);
	});
});

describe("Boursouflé", () => {
	function setup() {
		const sim = new MatchSimulation({ seed: 4242, players: 2 });
		silenceAnomalies(sim);
		const line = findClearLine(sim, 3.4);
		const direction = yawToDirection(line.yaw);
		placeBot(sim, "p1", line.origin, line.yaw);
		placeBot(
			sim,
			"p2",
			{
				x: line.origin.x + direction.x * 1.2,
				y: line.origin.y,
				z: line.origin.z + direction.z * 1.2,
			},
			line.yaw,
		);
		sim.run(2.5);
		return { sim, line };
	}

	it("s'arme puis explose si deux joueurs restent dans le périmètre", () => {
		const { sim, line } = setup();
		const entity = installAnomaly(sim, 0, "boursoufle", line.target);
		sim.run(0.3);
		expect(entity.state).toBe("windup");
		sim.run(1.2);
		const explosion = sim.transport.eventsOfType("explosion")[0];
		expect(explosion).toBeDefined();

		if (!explosion) {
			throw new Error("Explosion event was not found.");
		}

		expect(explosion.killed.sort()).toEqual(["p1", "p2"]);
		expect(entity.active).toBe(false);
		expect((sim.match.players.get("p1") as MatchPlayer).score).toBe(0);
	});

	it("annule l'explosion si les joueurs se séparent", () => {
		const { sim, line } = setup();
		const entity = installAnomaly(sim, 0, "boursoufle", line.target);
		sim.run(0.4);
		expect(entity.state).toBe("windup");
		const far = sim.match.layout.rooms
			.filter(
				(room) =>
					room.level === 0 &&
					room.type !== "stairwell" &&
					Math.hypot(
						room.labelPoint.x - line.target.x,
						room.labelPoint.z - line.target.z,
					) > 15,
			)
			.map((room) =>
				sim.match.grid.nearestNode(
					{ x: room.labelPoint.x, y: room.floorY, z: room.labelPoint.z },
					2,
				),
			)
			.find((node) => node !== null);

		if (!far) {
			throw new Error("No suitable far node found for the test.");
		}

		sim.teleportBot("p2", sim.match.grid.nodePosition(far));
		sim.run(1.5);
		expect(sim.transport.eventsOfType("explosion")).toHaveLength(0);
		expect(entity.active).toBe(true);
		expect(entity.state).not.toBe("windup");
		expect((sim.match.players.get("p1") as MatchPlayer).alive).toBe(true);
	});
});

describe("intelligence artificielle", () => {
	it("fait orbiter le Hurleur autour d'une autre anomalie et crier", () => {
		let sim: MatchSimulation | null = null;
		for (let seed = 76; !sim && seed < 120; seed += 1) {
			const candidate = new MatchSimulation({
				seed,
				players: 1,
				config: { simultaneousAnomalies: 4 },
			});
			if (
				candidate.match.anomalies.some((entity) => entity.species === "hurleur")
			) {
				sim = candidate;
			}
		}
		if (!sim) {
			throw new Error("No seed with a Hurleur found for the test.");
		}
		const firstDue = Math.min(
			...sim.match.anomalies.map((entity) => entity.spawnDueAt),
		);
		for (const entity of sim.match.anomalies) {
			if (entity.species === "hurleur") {
				entity.spawnDueAt = firstDue - 1;
			} else if (SPECIES[entity.species].tier === 1) {
				entity.spawnDueAt = Infinity;
			}
		}
		const states = new Map<string, number>();
		sim.run(150, () => {
			for (const entity of sim.match.anomalies) {
				if (entity.active && entity.species === "hurleur") {
					states.set(entity.state, (states.get(entity.state) ?? 0) + 1);
				}
			}
		});
		expect(states.get("special") ?? 0).toBeGreaterThan(200);
		expect(sim.transport.eventsOfType("scream").length).toBeGreaterThan(3);
	});

	it("répartit les patrouilles dans plusieurs salles et garde les entités mobiles", () => {
		const sim = new MatchSimulation({
			seed: 23,
			players: 1,
			config: { simultaneousAnomalies: 4 },
		});
		const silent = sim.match.players.get("p1") as MatchPlayer;
		silent.hiddenSpot = -1;
		const rooms = new Set<number>();
		const travelled = new Map<number, number>();
		const last = new Map<number, { x: number; z: number }>();
		sim.run(120, () => {
			for (const entity of sim.match.anomalies) {
				if (!entity.active) {
					continue;
				}
				const room = sim.match.roomIdAt(entity.position);
				if (room !== null) {
					rooms.add(room);
				}
				const previous = last.get(entity.id);
				if (previous) {
					travelled.set(
						entity.id,
						(travelled.get(entity.id) ?? 0) +
							Math.hypot(
								entity.position.x - previous.x,
								entity.position.z - previous.z,
							),
					);
				}
				last.set(entity.id, { x: entity.position.x, z: entity.position.z });
			}
		});
		expect(rooms.size).toBeGreaterThanOrEqual(8);
		for (const entity of sim.match.anomalies) {
			if (entity.species === "archiviste" || !travelled.has(entity.id)) {
				continue;
			}
			expect(travelled.get(entity.id)).toBeGreaterThan(10);
		}
	});
});
