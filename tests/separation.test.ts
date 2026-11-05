import { describe, expect, it } from "vitest";
import { clearShot } from "../server/game/ai/combat.js";
import { separateAnomalies } from "../server/game/ai/separation.js";
import { exposedPlayers } from "../server/game/ai/species/boursoufle.js";
import { fireBeam } from "../server/game/ai/species/fulgurant.js";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import { HazardSystem } from "../server/game/systems/hazards.js";
import type { Vec3 } from "../shared/math.js";
import { lineOfSight } from "../shared/physics/lineOfSight.js";
import {
	findClearLine,
	installAnomaly,
	placeBot,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function quietMatch(seed = 4242): MatchSimulation {
	const sim = new MatchSimulation({ seed, players: 1 });
	silenceAnomalies(sim);
	return sim;
}

describe("les anomalies s'évitent", () => {
	it("deux anomalies au même endroit s'écartent l'une de l'autre", () => {
		const sim = quietMatch();
		const line = findClearLine(sim, 4);
		placeBot(sim, "p1", line.origin, line.yaw);
		const a = installAnomaly(sim, 0, "veilleur", line.target);
		const b = installAnomaly(sim, 1, "murmure", line.target);
		for (let tick = 0; tick < 20; tick += 1) {
			separateAnomalies(sim.match);
		}
		const gap = Math.hypot(
			a.position.x - b.position.x,
			a.position.z - b.position.z,
		);
		expect(gap).toBeGreaterThan(0.9);
	});

	it("le Hurleur reste collé à l'anomalie qu'il accompagne", () => {
		const sim = quietMatch();
		const line = findClearLine(sim, 4);
		placeBot(sim, "p1", line.origin, line.yaw);
		const host = installAnomaly(sim, 0, "veilleur", line.target);
		const rider = installAnomaly(sim, 1, "hurleur", line.target);
		rider.hostId = host.id;
		const before = { ...host.position };
		separateAnomalies(sim.match);
		expect(host.position.x).toBeCloseTo(before.x, 6);
		expect(host.position.z).toBeCloseTo(before.z, 6);
	});
});

describe("projectiles et murs", () => {
	it("un projectile ne touche pas un joueur à travers un mur", () => {
		const sim = quietMatch();
		const world = sim.match.world;
		const wall = world.walls.find(
			(candidate) =>
				!candidate.glass &&
				Math.hypot(
					candidate.b.x - candidate.a.x,
					candidate.b.z - candidate.a.z,
				) > 1.5 &&
				candidate.yMin < 0.5,
		);
		expect(wall).toBeDefined();
		if (!wall) {
			return;
		}
		const length = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
		const normal = {
			x: -(wall.b.z - wall.a.z) / length,
			z: (wall.b.x - wall.a.x) / length,
		};
		const middle = {
			x: (wall.a.x + wall.b.x) / 2,
			z: (wall.a.z + wall.b.z) / 2,
		};
		const floor = wall.yMin;
		const target = {
			alive: true,
			hidden: false,
			carried: false,
			position: {
				x: middle.x + normal.x * 0.3,
				y: floor,
				z: middle.z + normal.z * 0.3,
			},
			bodyHeight: () => 1.78,
		} as unknown as MatchPlayer;
		const hazards = new HazardSystem(world);
		hazards.launch(
			"ember",
			{
				x: middle.x - normal.x * 0.3,
				y: floor + 1.1,
				z: middle.z - normal.z * 0.3,
			},
			{ x: normal.x * 10, y: 0, z: normal.z * 10 },
			0,
			0,
			0,
		);
		const outcomes = hazards.stepProjectiles([target], 60);
		expect(outcomes).toHaveLength(1);
		expect(outcomes[0].player).toBeNull();
	});
});

describe("cage d'escalier", () => {
	it("une anomalie au pied de l'escalier ne blesse pas un joueur à l'étage qu'elle voit", () => {
		const sim = quietMatch(977);
		const { grid, world } = sim.match;
		const pairs: { low: Vec3; top: Vec3 }[] = [];
		for (let cell = 0; cell < grid.cellsPerLevel; cell += 3) {
			const upper = grid.cellsPerLevel + cell;
			if (!grid.walkable[upper]) {
				continue;
			}
			const top = grid.nodePosition(upper);
			for (let lower = 0; lower < grid.cellsPerLevel; lower += 3) {
				const low = grid.nodePosition(lower);
				if (
					grid.walkable[lower] &&
					low.y < 1.3 &&
					Math.hypot(top.x - low.x, top.y - low.y, top.z - low.z) < 16 &&
					lineOfSight(
						world,
						{ ...low, y: low.y + 1.2 },
						{ ...top, y: top.y + 1 },
						{ ignoreFurniture: true, blockGlass: true },
					)
				) {
					pairs.push({ low, top });
				}
			}
		}
		expect(pairs.length).toBeGreaterThan(0);
		for (const { low, top } of pairs.slice(0, 12)) {
			placeBot(sim, "p1", top, 0);
			const player = sim.match.players.get("p1") as MatchPlayer;
			player.protectedUntil = 0;
			const bloat = installAnomaly(sim, 0, "boursoufle", low);
			expect(exposedPlayers(sim.match, bloat)).toHaveLength(0);
			const brazier = installAnomaly(sim, 1, "crache-cendre", low);
			expect(clearShot(sim.match, brazier, player)).toBe(false);
			const fulgurant = installAnomaly(sim, 2, "fulgurant", low);
			expect(
				fireBeam(sim.match, fulgurant, { ...top, y: top.y + 1 }),
			).toHaveLength(0);
		}
	});
});
