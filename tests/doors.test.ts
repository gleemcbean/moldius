import { describe, expect, it } from "vitest";
import { followPath, requestPath } from "../server/game/ai/locomotion.js";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import {
	DOOR_INTERACT_RANGE,
	EYE_HEIGHT_STANDING,
} from "../shared/config/index.js";
import { DOOR_FRAME_WIDTH, doorGeometry } from "../shared/manor/doors.js";
import type { Opening } from "../shared/manor/types.js";
import { lineOfSight } from "../shared/physics/lineOfSight.js";
import { allFixtures, SEEDS } from "./helpers/manorFixtures.js";
import {
	installAnomaly,
	placeBot,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

describe("portes", () => {
	it("le battant remplit l'ouverture, au jeu près du chambranle", () => {
		let checked = 0;
		for (const fixture of allFixtures(SEEDS.slice(0, 4))) {
			for (const opening of fixture.layout.openings) {
				if (!opening.door) {
					continue;
				}
				const geometry = doorGeometry(opening);
				expect(opening.width - geometry.panelLength).toBeLessThanOrEqual(
					DOOR_FRAME_WIDTH * 2 + 0.01,
				);
				expect(opening.height - geometry.panelHeight).toBeLessThanOrEqual(
					DOOR_FRAME_WIDTH + 0.01,
				);
				checked += 1;
			}
		}
		expect(checked).toBeGreaterThan(10);
	});

	it("ne s'ouvre que de près", () => {
		const sim = new MatchSimulation({ seed: 4242, players: 1 });
		silenceAnomalies(sim);
		const { match } = sim;
		const candidate = [...match.doors.doors]
			.filter((door) => door !== undefined)
			.map((door) => {
				const opening = match.layout.openings[door.openingId];
				return { door, opening };
			})
			.find(
				({ opening }) =>
					opening.level === 0 && standingSpot(sim, opening, 3.2) !== null,
			);
		expect(candidate).toBeDefined();
		if (!candidate) {
			throw new Error("No suitable door found for the test.");
		}
		const { door, opening } = candidate;
		const initial = door.open;
		const far = standingSpot(sim, opening, 3.2) as {
			position: { x: number; y: number; z: number };
			yaw: number;
		};

		placeBot(sim, "p1", far.position, far.yaw);
		sim.match.handleInteract("p1", { kind: "door", id: door.id });
		expect(door.open).toBe(initial);
		const near = standingSpot(sim, opening, 1.2) as {
			position: { x: number; y: number; z: number };
			yaw: number;
		};

		placeBot(sim, "p1", near.position, near.yaw);
		sim.match.handleInteract("p1", { kind: "door", id: door.id });
		expect(door.open).toBe(!initial);
		expect(DOOR_INTERACT_RANGE).toBeLessThanOrEqual(2);
	});

	it("un joueur emporté par le Collecteur n'agit plus sur le décor", () => {
		const sim = new MatchSimulation({ seed: 4242, players: 2 });
		silenceAnomalies(sim);
		const { match } = sim;
		const candidate = [...match.doors.doors]
			.filter((door) => door !== undefined)
			.map((door) => ({ door, opening: match.layout.openings[door.openingId] }))
			.find(
				({ opening }) =>
					opening.level === 0 && standingSpot(sim, opening, 1.2) !== null,
			);
		if (!candidate) {
			throw new Error("No suitable door found for the test.");
		}
		const { door, opening } = candidate;
		const near = standingSpot(sim, opening, 1.2) as {
			position: { x: number; y: number; z: number };
			yaw: number;
		};
		placeBot(sim, "p1", near.position, near.yaw);
		placeBot(sim, "p2", near.position, near.yaw + Math.PI);
		const player = match.players.get("p1") as MatchPlayer;
		player.energy = 100;
		const collector = installAnomaly(sim, 0, "collecteur", near.position);
		match.beginCarry(player, collector);
		const initial = door.open;
		const events = sim.transport.events.length;

		match.handleInteract("p1", { kind: "door", id: door.id });
		match.handleLantern("p1", true);
		match.handleCastBegin("p1");
		match.handleShout("p1");
		match.handlePush("p1", near.yaw + Math.PI);
		expect(door.open).toBe(initial);
		expect(player.lanternOpen).toBe(false);
		expect(player.casting).toBeNull();
		expect(
			sim.transport.events
				.slice(events)
				.filter((event) => event.type === "shout" || event.type === "push"),
		).toHaveLength(0);

		match.dropCarried(player, collector);
		placeBot(sim, "p1", near.position, near.yaw);
		match.handleInteract("p1", { kind: "door", id: door.id });
		expect(door.open).toBe(!initial);
	});

	it("la grille de navigation ne franchit une porte que par son seuil", () => {
		let checked = 0;
		for (const fixture of allFixtures(SEEDS.slice(0, 4))) {
			for (const opening of fixture.layout.openings) {
				if (!opening.door) {
					continue;
				}
				const [front, back] = fixture.grid.portals.filter(
					(portal) =>
						portal.openingId === opening.id && portal.role !== "center",
				);
				const path = fixture.finder.findPath(front, back, {
					canOpenDoors: true,
					isDoorClosed: () => true,
				});
				expect(
					path?.some((point) => point.doorId === opening.door?.id),
					`porte ${opening.door.id} (graine ${fixture.seed})`,
				).toBe(true);
				expect(fixture.finder.walkableLine(front, back, front.gridLevel)).toBe(
					false,
				);
				checked += 1;
			}
		}
		expect(checked).toBeGreaterThan(30);
	});

	it("les anomalies ouvrent les portes fermées au lieu de les traverser", () => {
		const waits: Record<string, number> = {};
		for (const species of ["collecteur", "veilleur"] as const) {
			const sim = new MatchSimulation({ seed: 4242, players: 1 });
			silenceAnomalies(sim);
			const { match } = sim;
			const door = match.doors.doors.find((candidate) => candidate);
			if (!door) {
				throw new Error("No door in this manor.");
			}
			const opening = match.layout.openings[door.openingId];
			match.setDoor(door.id, false, null);
			const across = (point: { x: number; z: number }) =>
				(point.x - opening.start.x) * opening.normal.x +
				(point.z - opening.start.z) * opening.normal.z;
			const besideDoor = (offset: number) => {
				const portal = match.grid.portals.find(
					(candidate) =>
						candidate.openingId === opening.id &&
						candidate.role === (offset < 0 ? "frontA" : "frontB"),
				);
				const node = match.grid.nearestNode(
					{
						x: (portal?.x ?? 0) + opening.normal.x * offset,
						y: opening.floorY,
						z: (portal?.z ?? 0) + opening.normal.z * offset,
					},
					2,
				);
				return match.grid.nodePosition(node as number);
			};
			const entity = installAnomaly(sim, 0, species, besideDoor(-0.6));
			expect(requestPath(match, entity, besideDoor(0.6))).toBe(true);
			expect(entity.path.some((point) => point.doorId === door.id)).toBe(true);
			let waited = 0;
			let status = "moving";
			for (let tick = 0; tick < 200 && status !== "arrived"; tick += 1) {
				match.now += 50;
				status = followPath(match, entity, 3, 0.05);
				if (status === "waiting") {
					waited += 50;
				}
				if (door.open === false) {
					expect(across(entity.position)).toBeLessThan(0);
				}
			}
			expect(status).toBe("arrived");
			expect(door.open).toBe(true);
			expect(across(entity.position)).toBeGreaterThan(opening.depth);
			waits[species] = waited;
		}
		expect(waits.collecteur).toBeLessThan(600);
		expect(waits.veilleur).toBeGreaterThanOrEqual(1800);
	});
});

function standingSpot(
	sim: MatchSimulation,
	opening: Opening,
	distance: number,
): { position: { x: number; y: number; z: number }; yaw: number } | null {
	const geometry = doorGeometry(opening);
	for (const side of [-1, 1]) {
		const x =
			geometry.center.x +
			opening.normal.x * side * (distance + opening.depth / 2);
		const z =
			geometry.center.z +
			opening.normal.z * side * (distance + opening.depth / 2);
		const position = { x, y: opening.floorY, z };
		const region = sim.match.world.regionAt({ x, z }, opening.floorY);
		const node = sim.match.grid.nearestNode(position, 0);
		const eye = { x, y: opening.floorY + EYE_HEIGHT_STANDING, z };
		const target = {
			x: geometry.center.x,
			y: opening.floorY + 1.1,
			z: geometry.center.z,
		};
		if (
			region &&
			node !== null &&
			lineOfSight(sim.match.world, eye, target, { ignoreDoors: true })
		) {
			return {
				position,
				yaw: Math.atan2(opening.normal.x * side, opening.normal.z * side),
			};
		}
	}
	return null;
}
