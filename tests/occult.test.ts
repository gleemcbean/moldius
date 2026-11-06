import { describe, expect, it } from "vitest";
import { planRoster } from "../server/game/roster.js";
import {
	ALTAR_MAX_PER_LEVEL,
	DEFAULT_ITEMS_PER_PLAYER,
	MATERIAL_IDS,
	MAX_ITEMS_PER_PLAYER,
	MIN_ITEMS_PER_PLAYER,
	OCCULT_IDS,
	OCCULT_RECIPES,
	PICKUP_MIN_PER_LEVEL,
} from "../shared/config/index.js";
import { ENABLED_SPECIES_IDS } from "../shared/config/monsters.js";
import { SPECIES_IDS, type SpeciesId } from "../shared/config/species.js";
import {
	generateManor,
	layoutChecksum,
} from "../shared/manor/generateManor.js";
import {
	type ManorSize,
	PUBLIC_MATCH_CONFIG,
	pickupTotal,
	sanitizeMatchConfig,
	TUTORIAL_MATCH_CONFIG,
	TUTORIAL_SEED,
	TUTORIAL_WOUNDED_HEALTH,
} from "../shared/matchConfig.js";
import { lineOfSight } from "../shared/physics/lineOfSight.js";
import { SeededRandom } from "../shared/random.js";
import {
	castAt,
	findClearLine,
	installAnomaly,
	placeBot,
	prepareCaster,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function pointWithinWalk(
	sim: MatchSimulation,
	from: { x: number; y: number; z: number },
	minimum = 18,
	maximum = 28,
	longestWalk = 40,
): { x: number; y: number; z: number } | null {
	const { match } = sim;
	const level = match.gridLevelOf(from);
	for (let cell = 0; cell < match.grid.cellsPerLevel; cell += 7) {
		const node = level * match.grid.cellsPerLevel + cell;
		if (!match.grid.walkable[node] || !match.grid.isInMainComponent(node)) {
			continue;
		}
		const point = match.grid.nodePosition(node);
		const distance = Math.hypot(point.x - from.x, point.z - from.z);
		if (distance <= minimum || distance >= maximum) {
			continue;
		}
		const path = match.finder.findPath(point, from, {
			canOpenDoors: true,
			isDoorClosed: () => false,
		});
		if (!path) {
			continue;
		}
		let walked = 0;
		let previous = point;
		for (const step of path) {
			walked += Math.hypot(
				step.x - previous.x,
				step.y - previous.y,
				step.z - previous.z,
			);
			previous = step;
		}
		if (walked <= longestWalk) {
			return point;
		}
	}
	return null;
}

function quiet(seed = 4242): MatchSimulation {
	const sim = new MatchSimulation({ seed, players: 1 });
	silenceAnomalies(sim);
	return sim;
}

function roomsOnLevel(sizes: ManorSize, seed: number) {
	return generateManor(seed, {
		...PUBLIC_MATCH_CONFIG,
		manorSize: sizes,
		upperFloorSize: sizes,
		floors: 2,
	});
}

describe("manoir : autels et matériaux", () => {
	it("place un à trois autels par étage, selon sa taille", () => {
		for (const size of ["small", "medium", "large"] as const) {
			for (const seed of [11, 202, 3003, 40004, 7, 88]) {
				const layout = roomsOnLevel(size, seed);
				for (const level of new Set(layout.rooms.map((room) => room.level))) {
					const altars = layout.altars.filter(
						(altar) => altar.level === level,
					).length;
					expect(
						altars,
						`${size} ${seed} étage ${level}`,
					).toBeGreaterThanOrEqual(1);
					expect(altars).toBeLessThanOrEqual(ALTAR_MAX_PER_LEVEL);
				}
			}
		}
	});

	it("rend chaque autel accessible à pied", () => {
		const sim = new MatchSimulation({ seed: 202, players: 1 });
		const { layout, grid } = sim.match;
		expect(layout.altars.length).toBeGreaterThan(0);
		for (const altar of layout.altars) {
			const node = grid.nearestNode(altar, 3);
			expect(node).not.toBeNull();
			expect(grid.isInMainComponent(node as number)).toBe(true);
		}
	});

	it("place des matériaux équilibrés, au sol, sur les meubles et dans les contenants", () => {
		const spots = new Set<string>();
		for (const seed of [11, 202, 3003]) {
			const layout = roomsOnLevel("medium", seed);
			const rooms = layout.rooms.filter((room) => room.type !== "stairwell");
			for (const level of new Set(rooms.map((room) => room.level))) {
				expect(
					layout.pickups.filter((pickup) => pickup.level === level).length,
				).toBeGreaterThanOrEqual(PICKUP_MIN_PER_LEVEL);
			}
			const counts = MATERIAL_IDS.map(
				(id) =>
					layout.pickups.filter((pickup) => pickup.material === id).length,
			);
			expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
			for (const pickup of layout.pickups) {
				spots.add(pickup.spot);
				if (pickup.spot === "floor") {
					expect(pickup.furnitureId).toBeNull();
				} else {
					expect(pickup.furnitureId).not.toBeNull();
				}
			}
		}
		expect([...spots].sort()).toEqual(["container", "floor", "surface"]);
	});
});

describe("nombre d'items réglable", () => {
	it("pose le nombre demandé par joueur, même au-delà du nombre de salles", () => {
		for (const [perPlayer, players] of [
			[DEFAULT_ITEMS_PER_PLAYER, 3],
			[MIN_ITEMS_PER_PLAYER, 4],
			[MAX_ITEMS_PER_PLAYER, 4],
		]) {
			const sim = new MatchSimulation({
				seed: 202,
				players,
				config: { itemsPerPlayer: perPlayer },
			});
			const expected = perPlayer * players;
			const placed = sim.match.layout.pickups.length;
			expect(sim.match.initPayload().pickupTotal).toBe(expected);
			expect(placed).toBeGreaterThanOrEqual(
				Math.min(expected, PICKUP_MIN_PER_LEVEL * 2) - 1,
			);
			expect(Math.abs(placed - expected)).toBeLessThanOrEqual(
				PICKUP_MIN_PER_LEVEL * 2 + 1,
			);
		}
	});

	it("adapte le nombre de morceaux à la taille du manoir", () => {
		const total = (config: Partial<typeof PUBLIC_MATCH_CONFIG>) =>
			pickupTotal({ ...PUBLIC_MATCH_CONFIG, ...config }, 4);
		const reference = PUBLIC_MATCH_CONFIG.itemsPerPlayer * 4;
		expect(total({})).toBe(reference);
		expect(total({ manorSize: "small" })).toBeLessThan(reference);
		expect(total({ manorSize: "large" })).toBeGreaterThan(reference);
		expect(total({ floors: 0 })).toBeLessThan(reference);
		expect(total({ floors: 3 })).toBeGreaterThan(reference);
		expect(total({ upperFloorSize: "large" })).toBeGreaterThan(reference);

		const placed = (manorSize: ManorSize) =>
			generateManor(202, {
				...PUBLIC_MATCH_CONFIG,
				manorSize,
				pickupTotal: pickupTotal({ ...PUBLIC_MATCH_CONFIG, manorSize }, 4),
			}).pickups.length;
		expect(placed("small")).toBeLessThan(placed("medium"));
		expect(placed("medium")).toBeLessThan(placed("large"));
	});

	it("ne met jamais deux items dans le même meuble", () => {
		const layout = generateManor(202, {
			...PUBLIC_MATCH_CONFIG,
			pickupTotal: 80,
		});
		const furniture = layout.pickups
			.map((pickup) => pickup.furnitureId)
			.filter((id) => id !== null);
		expect(new Set(furniture).size).toBe(furniture.length);
	});

	it("borne le réglage du lobby", () => {
		const fallback = PUBLIC_MATCH_CONFIG;
		const read = (itemsPerPlayer: unknown) =>
			sanitizeMatchConfig({ ...fallback, itemsPerPlayer }, fallback)
				.itemsPerPlayer;
		expect(read(999)).toBe(MAX_ITEMS_PER_PLAYER);
		expect(read(0)).toBe(MIN_ITEMS_PER_PLAYER);
		expect(read(6.4)).toBe(6);
		expect(read("beaucoup")).toBe(DEFAULT_ITEMS_PER_PLAYER);
	});

	it("garde la même disposition à somme de contrôle égale", () => {
		const options = { ...PUBLIC_MATCH_CONFIG, pickupTotal: 24 };
		expect(layoutChecksum(generateManor(7, options))).toBe(
			layoutChecksum(generateManor(7, options)),
		);
		expect(layoutChecksum(generateManor(7, options))).not.toBe(
			layoutChecksum(generateManor(7, { ...options, pickupTotal: 40 })),
		);
	});
});

describe("objets occultes", () => {
	it("donne à une espèce un seul objet, partagé par ses exemplaires", () => {
		const plan = planRoster(new SeededRandom(5), 12, new Set());
		const bySpecies = new Map<SpeciesId, Set<string>>();
		for (const instance of plan.instances) {
			const set = bySpecies.get(instance.species) ?? new Set();
			set.add(instance.occult);
			bySpecies.set(instance.species, set);
		}
		for (const objects of bySpecies.values()) {
			expect(objects.size).toBe(1);
		}
	});

	it("ramasse un matériau une fois, puis il réapparaît", () => {
		const sim = quiet();
		const { match } = sim;
		const player = match.players.get("p1") as NonNullable<
			ReturnType<typeof match.players.get>
		>;
		const pickup = match.layout.pickups.find(
			(entry) =>
				entry.spot === "floor" &&
				lineOfSight(
					match.world,
					{ x: entry.x + 0.5, y: entry.y + 0.8, z: entry.z },
					entry,
				),
		);
		expect(pickup).toBeDefined();
		if (!pickup) {
			return;
		}
		match.handleInteract("p1", { kind: "pickup", id: pickup.id });
		expect(player.materials[pickup.material]).toBe(0);
		placeBot(
			sim,
			"p1",
			{ x: pickup.x + 0.5, y: pickup.y - 0.05, z: pickup.z },
			0,
		);
		match.handleInteract("p1", { kind: "pickup", id: pickup.id });
		expect(player.materials[pickup.material]).toBe(1);
		match.handleInteract("p1", { kind: "pickup", id: pickup.id });
		expect(player.materials[pickup.material]).toBe(1);
		sim.run(91);
		expect(match.loot.returnsAt.has(pickup.id)).toBe(false);
		const respawned = match.loot.materialOf(match, pickup.id);
		const before = player.materials[respawned];
		match.handleInteract("p1", { kind: "pickup", id: pickup.id });
		expect(player.materials[respawned]).toBe(before + 1);
	});

	it("tire un matériau au hasard à chaque réapparition", () => {
		const sim = quiet();
		const { match } = sim;
		const pickupId = match.layout.pickups[0].id;
		const checksum = layoutChecksum(match.layout);
		const seen = new Set<string>();
		for (let round = 0; round < 40; round += 1) {
			match.loot.returnsAt.set(pickupId, match.now);
			match.loot.update(match);
			seen.add(match.loot.materialOf(match, pickupId));
		}
		expect(seen.size).toBeGreaterThan(1);
		expect(layoutChecksum(match.layout)).toBe(checksum);
		const events = match
			.currentStateEvents()
			.filter((event) => event.type === "pickupBack" && event.id === pickupId);
		expect(events).toEqual([
			{
				type: "pickupBack",
				id: pickupId,
				material: match.loot.materialOf(match, pickupId),
			},
		]);
	});

	it("fabrique sur un autel en consommant la recette", () => {
		const sim = quiet();
		const { match } = sim;
		const player = match.players.get("p1") as NonNullable<
			ReturnType<typeof match.players.get>
		>;
		const altar = match.layout.altars[0];
		const node = match.grid.nearestNode(altar, 3) as number;
		placeBot(sim, "p1", match.grid.nodePosition(node), 0);
		match.handleCraft("p1", altar.id, "pendulum");
		expect(player.objects.pendulum).toBe(0);
		player.materials.amethyst = 3;
		player.materials.brass = 1;
		match.handleCraft("p1", altar.id, "pendulum");
		expect(player.objects.pendulum).toBe(1);
		expect(player.materials.amethyst).toBe(
			3 - (OCCULT_RECIPES.pendulum.amethyst as number),
		);
		expect(player.materials.brass).toBe(0);
		match.handleCraft("p1", altar.id, "pendulum");
		expect(player.objects.pendulum).toBe(1);
	});

	it("exige l'objet de l'anomalie en main pour la capturer, et le consomme", () => {
		const sim = quiet();
		const line = findClearLine(sim, 3.4);
		placeBot(sim, "p1", line.origin, line.yaw);
		prepareCaster(sim, "p1", {});
		const entity = installAnomaly(sim, 0, "crache-cendre", line.target);
		entity.occult = "athame";
		const player = sim.match.players.get("p1") as NonNullable<
			ReturnType<typeof sim.match.players.get>
		>;
		const bot = sim.bot("p1");
		expect(castAt(sim, "p1", entity).reason).toBe("missing-occult");
		player.objects.jadeEye = 1;
		bot.held = OCCULT_IDS.indexOf("jadeEye");
		expect(castAt(sim, "p1", entity).reason).toBe("missing-occult");
		player.objects.athame = 1;
		expect(castAt(sim, "p1", entity).reason).toBe("missing-occult");
		bot.held = OCCULT_IDS.indexOf("athame");
		expect(castAt(sim, "p1", entity).ok).toBe(true);
		expect(player.objects.athame).toBe(0);
		expect(player.objects.jadeEye).toBe(1);
	});
});

describe("cri", () => {
	it.each([
		"murmure",
		"veilleur",
		"crache-cendre",
		"collecteur",
		"suinteur",
		"boursoufle",
		"colosse",
	] as SpeciesId[])("attire %s à l'endroit du cri, même de loin", (species) => {
		const sim = quiet(202);
		const { match } = sim;
		const player = match.players.get("p1") as NonNullable<
			ReturnType<typeof match.players.get>
		>;
		const line = findClearLine(sim, 3);
		placeBot(sim, "p1", line.origin, line.yaw);
		sim.run(0.2);
		player.protectedUntil = 0;
		const far = pointWithinWalk(sim, player.position);
		expect(far).not.toBeNull();
		const entity = installAnomaly(
			sim,
			0,
			species,
			far as NonNullable<typeof far>,
		);
		const shoutAt = { ...player.position };
		match.handleShout("p1");
		expect(entity.state).toBe("investigate");
		const remaining = () =>
			Math.hypot(entity.position.x - shoutAt.x, entity.position.z - shoutAt.z);
		let seconds = 0;
		while (remaining() > 6 && seconds < 8) {
			sim.run(0.5);
			seconds += 0.5;
		}
		expect(remaining()).toBeLessThanOrEqual(6);
	});
});

describe("monstre attiré par un cri", () => {
	function lured(species: SpeciesId) {
		const sim = quiet(202);
		const { match } = sim;
		const player = match.players.get("p1") as NonNullable<
			ReturnType<typeof match.players.get>
		>;
		const line = findClearLine(sim, 3);
		placeBot(sim, "p1", line.origin, line.yaw);
		sim.run(0.2);
		player.protectedUntil = Infinity;
		const far = pointWithinWalk(sim, player.position, 12, 20, 30);
		expect(far).not.toBeNull();
		const entity = installAnomaly(
			sim,
			0,
			species,
			far as NonNullable<typeof far>,
		);
		match.handleShout("p1");
		return { sim, player, entity };
	}

	it("s'arrête à distance du joueur, sans entrer dans la caméra", () => {
		const { sim, player, entity } = lured("murmure");
		let closest = Infinity;
		sim.run(14, () => {
			closest = Math.min(
				closest,
				Math.hypot(
					entity.position.x - player.position.x,
					entity.position.z - player.position.z,
				),
			);
		});
		expect(closest).toBeLessThan(6);
		expect(closest).toBeGreaterThan(1);
	});

	it("écarte un monstre posé sur un joueur", () => {
		const sim = quiet(202);
		const { match } = sim;
		const player = match.players.get("p1") as NonNullable<
			ReturnType<typeof match.players.get>
		>;
		const line = findClearLine(sim, 3, 30, 2.4);
		placeBot(sim, "p1", line.origin, line.yaw);
		sim.run(0.2);
		player.protectedUntil = Infinity;
		const entity = installAnomaly(sim, 0, "murmure", { ...player.position });
		sim.run(0.8);
		expect(
			Math.hypot(
				entity.position.x - player.position.x,
				entity.position.z - player.position.z,
			),
		).toBeGreaterThan(0.8);
	});
});

describe("monstres désactivés", () => {
	it("ne tire que les espèces autorisées", () => {
		const plan = planRoster(new SeededRandom(9), 10, new Set(), [
			"murmure",
			"veilleur",
		]);
		expect(new Set(plan.instances.map((entry) => entry.species))).toEqual(
			new Set(["murmure", "veilleur"]),
		);
	});

	it("tolère qu'aucune espèce ne reste", () => {
		expect(planRoster(new SeededRandom(9), 10, new Set(), [])).toEqual({
			pool: [],
			instances: [],
		});
	});

	it("garde toutes les espèces actives par défaut", () => {
		expect(ENABLED_SPECIES_IDS).toEqual(SPECIES_IDS);
	});
});

describe("tutoriel", () => {
	function tutorialSim(): MatchSimulation {
		return new MatchSimulation({
			seed: TUTORIAL_SEED,
			players: 1,
			config: TUTORIAL_MATCH_CONFIG,
			tutorial: true,
		});
	}

	it("garde les matériaux de la recette au tutoriel, même après réapparition", () => {
		const { match } = tutorialSim();
		const wanted = Object.keys(
			OCCULT_RECIPES[match.anomalies[0].occult as "pendulum"],
		);
		const pickupId = match.layout.pickups[0].id;
		for (let round = 0; round < 40; round += 1) {
			match.loot.returnsAt.set(pickupId, match.now);
			match.loot.update(match);
			expect(wanted).toContain(match.loot.materialOf(match, pickupId));
		}
	});

	it("a un manoir fixe avec tout ce que demandent les étapes", () => {
		const { match } = tutorialSim();
		expect(match.anomalies).toHaveLength(1);
		expect(match.anomalies[0].species).toBe("murmure");
		expect(match.anomalies[0].occult).not.toBeNull();
		expect(match.layout.altars.some((altar) => altar.level === 0)).toBe(true);
		expect(
			match.layout.pickups.filter((p) => p.level === 0).length,
		).toBeGreaterThanOrEqual(PICKUP_MIN_PER_LEVEL);
		expect(match.layout.hideSpots.length).toBeGreaterThan(0);
		expect(match.layout.levels.length).toBeGreaterThan(1);
	});

	it("blesse le joueur sur demande sans le tuer, et l'eau verte le soigne", () => {
		const sim = tutorialSim();
		const { match } = sim;
		const player = match.players.get("p1") as NonNullable<
			ReturnType<typeof match.players.get>
		>;
		expect(match.layout.valves.length).toBeGreaterThan(0);
		match.handleTutorialWound("p1");
		expect(player.health).toBe(TUTORIAL_WOUNDED_HEALTH);
		expect(player.alive).toBe(true);
		const valve = match.layout.valves[0];
		placeBot(sim, "p1", { x: valve.jet.x, y: valve.floorY, z: valve.jet.z }, 0);
		expect(match.valves.activate(valve.id, match.now)).not.toBeNull();
		sim.run(3);
		expect(player.health).toBeGreaterThanOrEqual(TUTORIAL_WOUNDED_HEALTH + 16);
	});

	it("ne blesse personne hors du tutoriel", () => {
		const sim = new MatchSimulation({ seed: 4242, players: 1 });
		const player = sim.match.players.get("p1") as NonNullable<
			ReturnType<typeof sim.match.players.get>
		>;
		sim.match.handleTutorialWound("p1");
		expect(player.health).toBe(100);
	});

	it("n'éveille le monstre que sur demande, et le joueur ne prend aucun dégât", () => {
		const sim = tutorialSim();
		const { match } = sim;
		sim.run(40);
		expect(match.anomalies[0].active).toBe(false);
		const player = match.players.get("p1") as NonNullable<
			ReturnType<typeof match.players.get>
		>;
		player.protectedUntil = 0;
		expect(match.applyDamage(player, 50, "murmure", null)).toBe(false);
		match.handleTutorialSummon("p1");
		expect(match.anomalies[0].active).toBe(true);
		expect(player.objects[match.anomalies[0].occult as "pendulum"]).toBe(1);
	});

	it("garde le monstre près du joueur après le cri, pour laisser le temps d'incanter", () => {
		const sim = tutorialSim();
		const { match } = sim;
		const player = match.players.get("p1") as NonNullable<
			ReturnType<typeof match.players.get>
		>;
		sim.run(12);
		match.handleTutorialSummon("p1");
		sim.run(1);
		match.handleShout("p1");
		sim.run(8);
		const entity = match.anomalies[0];
		for (let second = 0; second < 15; second += 1) {
			sim.run(1);
			const distance = Math.hypot(
				entity.position.x - player.position.x,
				entity.position.y - player.position.y,
				entity.position.z - player.position.z,
			);
			expect(distance).toBeLessThan(5);
			expect(distance).toBeGreaterThan(0.9);
		}
	});

	it("ne pose que les matériaux de la recette, et donne exactement celui ramassé", () => {
		const sim = tutorialSim();
		const { match } = sim;
		const player = match.players.get("p1") as NonNullable<
			ReturnType<typeof match.players.get>
		>;
		const recipe = OCCULT_RECIPES[match.anomalies[0].occult as "pendulum"];
		const wanted = Object.keys(recipe);
		for (const pickup of match.layout.pickups) {
			expect(wanted).toContain(pickup.material);
		}
		const pickup = match.layout.pickups.find((entry) => entry.spot === "floor");
		expect(pickup).toBeDefined();
		if (!pickup) {
			return;
		}
		const node = match.grid.nearestNode(pickup, 2) as number;
		placeBot(sim, "p1", match.grid.nodePosition(node), 0);
		match.handleInteract("p1", { kind: "pickup", id: pickup.id });
		expect(player.materials[pickup.material]).toBe(1);
		expect(
			MATERIAL_IDS.reduce((sum, id) => sum + player.materials[id], 0),
		).toBe(1);
	});
});
