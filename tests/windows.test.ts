import { describe, expect, it } from "vitest";
import type { AnomalyEntity } from "../server/game/ai/AnomalyEntity.js";
import { perceive } from "../server/game/ai/perception.js";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import { openingPassage } from "../shared/manor/layoutBuilder.js";
import type { Opening } from "../shared/manor/types.js";
import type { Vec3 } from "../shared/math.js";
import {
	countWallsBetween,
	lineOfSight,
	movementCrossesWall,
} from "../shared/physics/lineOfSight.js";
import { allFixtures, SEEDS } from "./helpers/manorFixtures.js";
import {
	installAnomaly,
	placeBot,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function besideWindow(
	opening: Opening,
	side: -1 | 1,
	distance: number,
	y: number,
): Vec3 {
	const passage = openingPassage(opening);
	const middle = {
		x: (passage[0].x + passage[1].x + passage[2].x + passage[3].x) / 4,
		z: (passage[0].z + passage[1].z + passage[2].z + passage[3].z) / 4,
	};
	const reach = opening.depth / 2 + distance;
	return {
		x: middle.x + opening.normal.x * side * reach,
		y,
		z: middle.z + opening.normal.z * side * reach,
	};
}

function across(opening: Opening, point: { x: number; z: number }): number {
	return (
		(point.x - opening.start.x) * opening.normal.x +
		(point.z - opening.start.z) * opening.normal.z -
		opening.depth / 2
	);
}

describe("vitres entre deux salles", () => {
	it("relient deux salles du même étage sans créer de passage", () => {
		let windows = 0;
		for (const item of allFixtures(SEEDS)) {
			for (const opening of item.layout.openings) {
				if (opening.kind !== "window") {
					continue;
				}
				windows += 1;
				const a = item.layout.rooms[opening.roomA];
				const b = item.layout.rooms[opening.roomB];
				expect(a.level).toBe(b.level);
				expect(opening.door).toBeNull();
				expect(opening.sill).toBeGreaterThan(0.5);
				expect(opening.height - opening.sill).toBeGreaterThan(1);
				expect(
					item.grid.portals.some((portal) => portal.openingId === opening.id),
				).toBe(false);
				const others = item.layout.openings.filter(
					(other) =>
						other.kind !== "window" &&
						((other.roomA === a.id && other.roomB === b.id) ||
							(other.roomA === b.id && other.roomB === a.id)),
				);
				expect(others).toEqual([]);
			}
		}
		expect(windows).toBeGreaterThan(5);
	});

	it("laissent passer le regard, pas les corps, et étouffent les sons", () => {
		let checked = 0;
		for (const item of allFixtures(SEEDS.slice(0, 6))) {
			for (const opening of item.layout.openings) {
				if (opening.kind !== "window") {
					continue;
				}
				const eye = opening.floorY + 1.5;
				const front = besideWindow(opening, -1, 0.6, eye);
				const back = besideWindow(opening, 1, 0.6, eye);
				expect(lineOfSight(item.world, front, back)).toBe(true);
				expect(lineOfSight(item.world, front, back, { blockGlass: true })).toBe(
					false,
				);
				expect(countWallsBetween(item.world, front, back)).toBeGreaterThan(0);
				const feetFront = { ...front, y: opening.floorY };
				const feetBack = { ...back, y: opening.floorY };
				expect(
					movementCrossesWall(item.world, feetFront, feetBack, 1.4, new Set()),
				).toBe(true);
				expect(
					item.finder.walkableLine(feetFront, feetBack, opening.level),
				).toBe(false);
				checked += 1;
			}
		}
		expect(checked).toBeGreaterThan(2);
	});

	it("une anomalie qui voit un joueur à travers une vitre fait le tour par les portes", () => {
		let found: {
			sim: MatchSimulation;
			opening: Opening;
		} | null = null;
		for (let seed = 1; seed <= 80 && !found; seed += 1) {
			const sim = new MatchSimulation({ seed, players: 1 });
			const opening = sim.match.layout.openings.find((candidate) => {
				if (candidate.kind !== "window" || candidate.level !== 0) {
					return false;
				}
				return [-1, 1].every((side) => {
					const point = besideWindow(candidate, side as -1 | 1, 1.4, 0);
					const node = sim.match.grid.nearestNode(point, 1);
					return node !== null && sim.match.grid.isInMainComponent(node);
				});
			});
			if (opening) {
				found = { sim, opening };
			}
		}
		if (!found) {
			throw new Error("No usable window in the first 80 manors.");
		}
		const { sim, opening } = found;
		silenceAnomalies(sim);
		const playerSpot = sim.match.grid.nodePosition(
			sim.match.grid.nearestNode(besideWindow(opening, 1, 1.4, 0), 1) as number,
		);
		const hunterSpot = sim.match.grid.nodePosition(
			sim.match.grid.nearestNode(
				besideWindow(opening, -1, 1.4, 0),
				1,
			) as number,
		);
		const towardHunter = Math.atan2(
			-(hunterSpot.x - playerSpot.x),
			-(hunterSpot.z - playerSpot.z),
		);
		placeBot(sim, "p1", playerSpot, towardHunter);
		const player = sim.match.players.get("p1") as MatchPlayer;
		player.protectedUntil = 0;
		player.lanternOpen = true;
		const hunter: AnomalyEntity = installAnomaly(
			sim,
			0,
			"veilleur",
			hunterSpot,
			towardHunter + Math.PI,
		);
		const playerRoom = sim.match.roomIdAt(player.position);
		expect(sim.match.roomIdAt(hunter.position)).not.toBe(playerRoom);
		let sawThroughGlass = false;
		for (let tick = 0; tick < 40 && !sawThroughGlass; tick += 1) {
			sawThroughGlass =
				perceive(sim.match, hunter, 0.05).target?.id === player.id;
		}
		expect(sawThroughGlass).toBe(true);

		let reached = false;
		let crossedGlass = false;
		let hurtThroughGlass = false;
		let side = Math.sign(across(opening, hunter.position));
		sim.run(40, () => {
			const now = Math.sign(across(opening, hunter.position));
			const passage = openingPassage(opening);
			const along =
				(hunter.position.x - (passage[0].x + passage[3].x) / 2) *
					((opening.end.x - opening.start.x) / opening.width) +
				(hunter.position.z - (passage[0].z + passage[3].z) / 2) *
					((opening.end.z - opening.start.z) / opening.width);
			if (now !== side && now !== 0 && Math.abs(along) < opening.width / 2) {
				crossedGlass = true;
			}
			if (now !== 0) {
				side = now;
			}
			const inPlayerRoom = sim.match.roomIdAt(hunter.position) === playerRoom;
			const clearReach = lineOfSight(
				sim.match.world,
				{ ...hunter.position, y: hunter.position.y + 1.4 },
				{ ...player.position, y: player.position.y + 1.1 },
				{ blockGlass: true, ignoreFurniture: true },
			);
			if (!inPlayerRoom && player.health < 100 && !clearReach) {
				hurtThroughGlass = true;
			}
			reached ||= inPlayerRoom || (player.health < 100 && clearReach);
			player.health = Math.max(player.health, 100);
		});
		expect(crossedGlass).toBe(false);
		expect(hurtThroughGlass).toBe(false);
		expect(reached).toBe(true);
	});
});
