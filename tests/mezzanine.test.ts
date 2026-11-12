import { describe, expect, it } from "vitest";
import { lureAnomalies } from "../server/game/ai/lure.js";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import { RELIEF_MAX_HEIGHT } from "../shared/config/index.js";
import { generateManor } from "../shared/manor/generateManor.js";
import { floorsSeenFromEye } from "../shared/manor/levels.js";
import { MEZZANINE_SHAPES } from "../shared/manor/mezzanineShapes.js";
import {
	distanceToPolygonBoundary,
	pointInPolygon,
} from "../shared/manor/polygon.js";
import type { ManorLayout, Room } from "../shared/manor/types.js";
import {
	clipProfile,
	WALL_RELIEF_MAX_LOW_DEPTH,
	wallProfile,
} from "../shared/manor/wallRelief.js";
import { TUTORIAL_MATCH_CONFIG, TUTORIAL_SEED } from "../shared/matchConfig.js";
import { NavGrid } from "../shared/navigation/navGrid.js";
import { PathFinder } from "../shared/navigation/pathfinding.js";
import {
	circleBoxPenetration,
	supportHeight,
} from "../shared/physics/character.js";
import { CollisionWorld } from "../shared/physics/collisionWorld.js";
import { lineOfSight } from "../shared/physics/lineOfSight.js";
import {
	installAnomaly,
	placeBot,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

const SEEDS = [1, 7, 42, 2024, 4242, 977, 31337, 555];

function manor(
	seed: number,
	manorSize: "small" | "medium" | "large" = "small",
) {
	return generateManor(seed, {
		manorSize,
		roomTypes: [...TUTORIAL_MATCH_CONFIG.roomTypes],
		floors: 1,
		upperFloorSize: "small",
		stairCount: 1,
	});
}

function grandRooms(layout: ManorLayout): Room[] {
	return layout.rooms.filter((room) => room.mezzanine !== null);
}

function deckPoint(room: Room): { x: number; y: number; z: number } {
	const spec = room.mezzanine as NonNullable<Room["mezzanine"]>;
	const [a, b] = [spec.deck[0], spec.deck[1]];
	const middle = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
	const inward = { x: spec.stair.forward.x, z: spec.stair.forward.z };
	return {
		x: middle.x - inward.x * 1.5,
		y: spec.floorY,
		z: middle.z - inward.z * 1.5,
	};
}

function voidPoint(room: Room): { x: number; y: number; z: number } {
	return { x: room.labelPoint.x, y: room.floorY, z: room.labelPoint.z };
}

describe("grandes salles à mezzanine", () => {
	it("en place dans les manoirs à étage, jamais dans ceux de plain-pied", () => {
		for (const seed of SEEDS) {
			expect(grandRooms(manor(seed)).length).toBeGreaterThanOrEqual(1);
		}
		expect(grandRooms(manor(7, "large")).length).toBeGreaterThanOrEqual(2);
		const flat = generateManor(7, {
			manorSize: "small",
			roomTypes: [...TUTORIAL_MATCH_CONFIG.roomTypes],
			floors: 0,
			upperFloorSize: "small",
			stairCount: 1,
		});
		expect(grandRooms(flat)).toHaveLength(0);
	});

	it("sont nettement plus grandes et plus hautes que les autres", () => {
		for (const seed of SEEDS) {
			for (const room of grandRooms(manor(seed))) {
				const spec = room.mezzanine as NonNullable<Room["mezzanine"]>;
				expect(room.height).toBeGreaterThan(6);
				expect(room.area).toBeGreaterThan(120);
				expect(room.ceilingY).toBeLessThan(8.8);
				expect(spec.floorY - room.floorY).toBeLessThanOrEqual(3.75);
				expect(spec.floorY - room.floorY).toBeGreaterThanOrEqual(3.25);
			}
		}
	});

	it("gardent la mezzanine et l'escalier à l'intérieur de la salle", () => {
		for (const seed of SEEDS) {
			for (const room of grandRooms(manor(seed))) {
				const spec = room.mezzanine as NonNullable<Room["mezzanine"]>;
				const inside = (point: { x: number; z: number }) => {
					const center = room.labelPoint;
					return pointInPolygon(
						{
							x: point.x + (center.x - point.x) * 0.01,
							z: point.z + (center.z - point.z) * 0.01,
						},
						room.polygon,
					);
				};
				expect(spec.deck.every(inside)).toBe(true);
				expect(spec.stairPolygon.every(inside)).toBe(true);
				expect(pointInPolygon(room.labelPoint, spec.deck)).toBe(false);
				expect(pointInPolygon(room.labelPoint, spec.stairPolygon)).toBe(false);
			}
		}
	});

	it("ouvrent de petites salles depuis la mezzanine", () => {
		let total = 0;
		for (const seed of SEEDS) {
			const layout = manor(seed);
			for (const room of grandRooms(layout)) {
				const upper = layout.openings.filter(
					(opening) =>
						opening.roomA === room.id &&
						opening.floorY > room.floorY + 1 &&
						opening.kind !== "window",
				);
				expect(upper.length).toBeGreaterThanOrEqual(1);
				for (const opening of upper) {
					const small = layout.rooms[opening.roomB];
					expect(small.level).toBe(room.level + 1);
					expect(small.floorY).toBeCloseTo(
						(room.mezzanine as NonNullable<Room["mezzanine"]>).floorY,
					);
					total += 1;
				}
			}
		}
		expect(total).toBeGreaterThan(SEEDS.length);
	});

	it("laisse tout le monde atteindre la mezzanine et ses petites salles", () => {
		for (const seed of SEEDS) {
			const layout = manor(seed);
			const world = new CollisionWorld(layout);
			const grid = new NavGrid(world);
			const finder = new PathFinder(grid);
			for (const room of grandRooms(layout)) {
				const spec = room.mezzanine as NonNullable<Room["mezzanine"]>;
				const deckCells = (grid.roomCells.get(room.id) ?? []).filter(
					(node) => Math.abs(grid.heights[node] - spec.floorY) < 0.05,
				);
				expect(deckCells.length).toBeGreaterThan(20);
				expect(
					deckCells.filter((n) => !grid.isInMainComponent(n)).length,
				).toBeLessThanOrEqual(4);
				const path = finder.findPath(voidPoint(room), deckPoint(room), {
					canOpenDoors: true,
					isDoorClosed: () => false,
				});
				expect(path).not.toBeNull();
				const heights = (path ?? []).map((point) => point.y);
				expect(Math.max(...heights)).toBeGreaterThan(spec.floorY - 0.1);
				for (const opening of layout.openings) {
					if (opening.roomA === room.id && opening.floorY > room.floorY + 1) {
						const cells = grid.roomCells.get(opening.roomB) ?? [];
						expect(cells.some((node) => grid.isInMainComponent(node))).toBe(
							true,
						);
					}
				}
			}
		}
	});

	it("porte les joueurs à la bonne hauteur et laisse passer dessous", () => {
		for (const seed of SEEDS) {
			const layout = manor(seed);
			const world = new CollisionWorld(layout);
			for (const room of grandRooms(layout)) {
				const spec = room.mezzanine as NonNullable<Room["mezzanine"]>;
				const deck = deckPoint(room);
				expect(supportHeight(world, deck.x, deck.z, deck.y, 0.3).height).toBe(
					spec.floorY,
				);
				expect(
					supportHeight(world, deck.x, deck.z, room.floorY, 0.3).height,
				).toBeLessThan(room.floorY + RELIEF_MAX_HEIGHT);
				const { stair } = spec;
				const middle = {
					x: stair.origin.x + stair.forward.x * (stair.length / 2),
					z: stair.origin.z + stair.forward.z * (stair.length / 2),
				};
				const ramp = supportHeight(world, middle.x, middle.z, spec.floorY, 0.3);
				expect(ramp.ramp).toBe(true);
				expect(ramp.height ?? 0).toBeGreaterThan(1);
				expect(ramp.height ?? 9).toBeLessThan(spec.floorY);
			}
		}
	});

	it("voit à travers le vide mais pas à travers le plancher", () => {
		for (const seed of SEEDS) {
			const layout = manor(seed);
			const world = new CollisionWorld(layout);
			for (const room of grandRooms(layout)) {
				const deck = deckPoint(room);
				const eyeOnDeck = { ...deck, y: deck.y + 1.6 };
				const underDeck = { x: deck.x, y: room.floorY + 1.6, z: deck.z };
				expect(
					lineOfSight(world, underDeck, eyeOnDeck, { ignoreFurniture: true }),
				).toBe(false);
				const center = { ...voidPoint(room), y: room.floorY + 1.6 };
				const nearEdge = {
					x: deck.x + (center.x - deck.x) * 0.02,
					y: eyeOnDeck.y,
					z: deck.z + (center.z - deck.z) * 0.02,
				};
				expect(
					lineOfSight(world, center, nearEdge, { ignoreFurniture: true }),
				).toBe(true);
			}
		}
	});
});

describe("formes des grandes salles et des mezzanines", () => {
	const sample = Array.from({ length: 40 }, (_, index) => index + 1).flatMap(
		(seed) => grandRooms(manor(seed, seed % 2 ? "medium" : "large")),
	);

	it("donne aux salles des pans coupés et des arrondis", () => {
		const curved = sample.filter((room) =>
			room.edges.some((edge) => edge.kind === "arc"),
		);
		const angled = sample.filter((room) =>
			room.edges.some(
				(edge) =>
					edge.kind === "line" &&
					Math.abs(edge.a.x - edge.b.x) > 0.1 &&
					Math.abs(edge.a.z - edge.b.z) > 0.1 &&
					Math.abs(room.axisAngle % (Math.PI / 2)) < 0.01,
			),
		);
		expect(curved.length).toBeGreaterThan(sample.length * 0.3);
		expect(angled.length).toBeGreaterThan(sample.length * 0.2);
		expect(
			sample.filter((room) => room.edges.length > 4).length,
		).toBeGreaterThan(sample.length * 0.8);
	});

	it("varie la forme des mezzanines", () => {
		const shapes = new Set(
			sample.map((room) => room.mezzanine?.shape as string),
		);
		expect([...shapes].sort()).toEqual(
			[...MEZZANINE_SHAPES].map(String).sort(),
		);
	});

	it("épouse le contour et ne met un garde-corps que sur les bords libres", () => {
		for (const room of sample) {
			const spec = room.mezzanine as NonNullable<Room["mezzanine"]>;
			for (const [index, point] of spec.deck.entries()) {
				const next = spec.deck[(index + 1) % spec.deck.length];
				const middle = {
					x: (point.x + next.x) / 2,
					z: (point.z + next.z) / 2,
				};
				expect(
					pointInPolygon(middle, room.polygon) ||
						distanceToPolygonBoundary(middle, room.polygon) < 0.05,
				).toBe(true);
			}
			expect(spec.rails.length).toBeGreaterThan(0);
			for (const rail of spec.rails) {
				const middle = {
					x: (rail.a.x + rail.b.x) / 2,
					z: (rail.a.z + rail.b.z) / 2,
				};
				expect(distanceToPolygonBoundary(middle, room.polygon)).toBeGreaterThan(
					0.03,
				);
				expect(distanceToPolygonBoundary(middle, spec.deck)).toBeLessThan(0.01);
			}
			expect(spec.deckEdges.length).toBeGreaterThan(0);
		}
	});

	it("garde les estrades rares", () => {
		let rooms = 0;
		let withRelief = 0;
		for (let seed = 1; seed <= 30; seed += 1) {
			const layout = manor(seed, "large");
			for (const room of grandRooms(layout)) {
				const spec = room.mezzanine as NonNullable<Room["mezzanine"]>;
				const ground = layout.furniture.filter(
					(item) =>
						item.roomId === room.id &&
						item.kind === "dais" &&
						item.y < spec.floorY - 1,
				);
				expect(ground.length).toBeLessThanOrEqual(2);
				rooms += 1;
				withRelief += ground.length > 0 ? 1 : 0;
			}
		}
		expect(withRelief).toBeGreaterThan(rooms * 0.7);
	});
});

describe("mobilier et reliefs", () => {
	it("garnit les mezzanines et varie les hauteurs au sol", () => {
		for (const seed of SEEDS) {
			const layout = manor(seed);
			for (const room of grandRooms(layout)) {
				const spec = room.mezzanine as NonNullable<Room["mezzanine"]>;
				const onDeck = layout.furniture.filter(
					(item) =>
						item.roomId === room.id &&
						item.y >= spec.floorY - 0.01 &&
						item.colliders.length > 0,
				);
				expect(onDeck.length, `graine ${seed}`).toBeGreaterThanOrEqual(5);
				expect(spec.posts.length).toBeGreaterThanOrEqual(2);
			}
		}
	});

	it("rend les gradins praticables à pied", () => {
		for (const seed of SEEDS) {
			const layout = manor(seed);
			const grid = new NavGrid(new CollisionWorld(layout));
			for (const dais of layout.furniture.filter((i) => i.kind === "dais")) {
				const heights = (grid.roomCells.get(dais.roomId) ?? [])
					.filter((node) => grid.isInMainComponent(node))
					.map((node) => grid.nodePosition(node))
					.filter((point) => {
						const x = Math.abs(point.x - dais.x);
						const z = Math.abs(point.z - dais.z);
						return Math.hypot(x, z) < Math.hypot(dais.width, dais.depth) / 2;
					})
					.map((point) => point.y - dais.y);
				expect(Math.max(...heights)).toBeGreaterThan(0.1);
			}
		}
	});

	it("garde les piliers d'une même salle éloignés", () => {
		for (const seed of SEEDS) {
			const layout = manor(seed, "large");
			const pillars = layout.furniture.filter((item) => item.kind === "pillar");
			pillars.forEach((a, index) => {
				for (const b of pillars.slice(index + 1)) {
					if (a.roomId === b.roomId) {
						expect(
							Math.hypot(a.x - b.x, a.z - b.z),
							`graine ${seed}`,
						).toBeGreaterThanOrEqual(4);
					}
				}
			});
		}
	});

	it("ne fait jamais traverser un lustre par un pilier", () => {
		for (const seed of SEEDS) {
			const layout = manor(seed, "large");
			for (const chandelier of layout.furniture.filter(
				(item) => item.kind === "chandelier",
			)) {
				const room = layout.rooms[chandelier.roomId];
				const columns = [
					...layout.furniture
						.filter((item) => item.kind === "pillar" && item.roomId === room.id)
						.map((item) => ({ x: item.x, z: item.z, radius: item.width / 2 })),
					...(room.mezzanine?.posts ?? []).map((post) => ({
						...post,
						radius: 0.2,
					})),
				];
				for (const column of columns) {
					expect(
						Math.hypot(column.x - chandelier.x, column.z - chandelier.z),
						`graine ${seed}`,
					).toBeGreaterThanOrEqual(chandelier.width / 2 + column.radius);
				}
			}
		}
	});

	it("équilibre le mobilier au sol des petites salles", () => {
		for (const seed of SEEDS) {
			const layout = manor(seed);
			for (const room of layout.rooms) {
				if (
					room.area >= 26 ||
					room.type === "corridor" ||
					room.type === "stairwell"
				) {
					continue;
				}
				const onFloor = layout.furniture.filter(
					(item) =>
						item.roomId === room.id &&
						item.parentId === null &&
						item.height > 0.1 &&
						Math.abs(item.y - room.floorY) < 0.01,
				);
				const standing = onFloor.filter((item) => item.colliders.length > 0);
				const covered =
					standing.reduce((sum, item) => sum + item.width * item.depth, 0) /
					room.area;
				const label = `graine ${seed}, ${room.type} de ${room.area.toFixed(1)} m²`;
				expect(onFloor.length, label).toBeGreaterThanOrEqual(1);
				expect(covered, label).toBeLessThan(0.36);
				expect(standing.length, label).toBeLessThanOrEqual(
					Math.max(4, Math.round(room.area / 3.4)),
				);
				if (room.area >= 8) {
					expect(covered, label).toBeGreaterThanOrEqual(0.1);
				}
			}
		}
	});

	it("donne une hitbox à tout objet posé au sol d'une certaine taille", () => {
		const flat = new Set([
			"pond",
			"rug",
			"ritualCircle",
			"bloodStain",
			"climbingVine",
		]);
		for (const seed of SEEDS) {
			const layout = manor(seed);
			for (const item of layout.furniture) {
				const room = layout.rooms[item.roomId];
				if (
					item.parentId === null &&
					Math.abs(item.y - room.floorY) < 0.01 &&
					!flat.has(item.kind) &&
					item.height >= 0.4 &&
					item.width * item.depth >= 0.1
				) {
					expect(item.colliders.length, item.kind).toBeGreaterThan(0);
				}
			}
		}
	});
});

describe("lumières par étage", () => {
	it("ne garde que l'étage du joueur, et les deux sur un palier", () => {
		expect(floorsSeenFromEye(0.85, 0.85)).toMatchObject({
			lowest: 0,
			highest: 0,
		});
		expect(floorsSeenFromEye(5.25, 0.85)).toMatchObject({
			lowest: 1,
			highest: 1,
		});
		expect(floorsSeenFromEye(4.35, 0.85)).toMatchObject({
			lowest: 0,
			highest: 1,
		});
	});
});

describe("dans une vraie partie", () => {
	function tutorial(): MatchSimulation {
		return new MatchSimulation({
			seed: TUTORIAL_SEED,
			players: 1,
			config: TUTORIAL_MATCH_CONFIG,
			tutorial: true,
		});
	}

	it("le tutoriel a sa grande salle", () => {
		expect(grandRooms(tutorial().match.layout).length).toBeGreaterThanOrEqual(
			1,
		);
	});

	it("un joueur monte l'escalier jusqu'à la mezzanine", () => {
		const sim = tutorial();
		silenceAnomalies(sim);
		const room = grandRooms(sim.match.layout)[0];
		const { stair, floorY } = room.mezzanine as NonNullable<Room["mezzanine"]>;
		placeBot(
			sim,
			"p1",
			{
				x: stair.origin.x - stair.forward.x * 0.5,
				y: room.floorY,
				z: stair.origin.z - stair.forward.z * 0.5,
			},
			Math.atan2(-stair.forward.x, -stair.forward.z),
		);
		sim.bot("p1").input.forward = 1;
		sim.run(5);
		expect(sim.bot("p1").character.y).toBeCloseTo(floorY, 1);
	});

	it("le garde-corps retient le joueur en haut", () => {
		const sim = tutorial();
		silenceAnomalies(sim);
		const room = grandRooms(sim.match.layout)[0];
		const spec = room.mezzanine as NonNullable<Room["mezzanine"]>;
		const deck = deckPoint(room);
		const toVoid = {
			x: room.labelPoint.x - deck.x,
			z: room.labelPoint.z - deck.z,
		};
		placeBot(sim, "p1", deck, Math.atan2(-toVoid.x, -toVoid.z));
		const bot = sim.bot("p1");
		bot.input.forward = 1;
		bot.input.sprint = true;
		sim.run(4);
		expect(bot.character.y).toBeCloseTo(spec.floorY, 1);
	});

	it("un saut par-dessus le garde-corps blesse à l'atterrissage", () => {
		const sim = new MatchSimulation({ seed: 1, players: 1 });
		silenceAnomalies(sim);
		const room = grandRooms(sim.match.layout)[0];
		const spec = room.mezzanine as NonNullable<Room["mezzanine"]>;
		const rail = spec.rails[0];
		const center = voidPoint(room);
		const clearRun = (point: { x: number; z: number }) => {
			const length = Math.hypot(center.x - point.x, center.z - point.z);
			const unit = {
				x: (center.x - point.x) / length,
				z: (center.z - point.z) / length,
			};
			const start = {
				x: point.x - unit.x * 1.4,
				y: spec.floorY,
				z: point.z - unit.z * 1.4,
			};
			const free = [0, 0.25, 0.5, 0.75, 1, 1.4].every((run) =>
				sim.match.world.boxes.every(
					(box) =>
						box.yMax < spec.floorY + 0.1 ||
						box.yMin > spec.floorY + 1.5 ||
						!circleBoxPenetration(
							start.x + unit.x * run,
							start.z + unit.z * run,
							0.25,
							box,
						),
				),
			);
			const lands = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6].every((run) =>
				sim.match.world.boxes.every(
					(box) =>
						box.yMax > spec.floorY - 1 ||
						box.yMax <= room.floorY + 0.05 ||
						!circleBoxPenetration(
							start.x + unit.x * run,
							start.z + unit.z * run,
							0.4,
							box,
						),
				),
			);
			return free && lands ? { start, unit } : null;
		};
		const run = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
			.map((t) =>
				clearRun({
					x: rail.a.x + (rail.b.x - rail.a.x) * t,
					z: rail.a.z + (rail.b.z - rail.a.z) * t,
				}),
			)
			.find((candidate) => candidate !== null);
		if (!run) {
			throw new Error("Aucun élan dégagé vers le garde-corps");
		}
		placeBot(sim, "p1", run.start, Math.atan2(-run.unit.x, -run.unit.z));
		const player = sim.match.players.get("p1") as MatchPlayer;
		player.protectedUntil = 0;
		const bot = sim.bot("p1");
		bot.input.forward = 1;
		bot.input.sprint = true;
		bot.input.jump = true;
		sim.run(0.05);
		bot.input.jump = false;
		sim.run(2.5);
		expect(bot.character.y).toBeLessThan(spec.floorY - 2);
		expect(player.health).toBeLessThan(90);
		expect(player.health).toBeGreaterThan(40);
		expect(sim.transport.eventsOfType("damage")[0]).toMatchObject({
			source: "fall",
		});
	});

	it("une chute ne tue jamais dans le tutoriel", () => {
		const sim = tutorial();
		const player = sim.match.players.get("p1") as MatchPlayer;
		player.health = 10;
		sim.match.applyFallDamage(player, 50);
		expect(player.health).toBe(1);
		expect(player.alive).toBe(true);
	});

	it("un simple saut sur place ne blesse pas", () => {
		const sim = new MatchSimulation({ seed: 4242, players: 1 });
		silenceAnomalies(sim);
		const room = grandRooms(sim.match.layout)[0];
		placeBot(sim, "p1", voidPoint(room), 0);
		const player = sim.match.players.get("p1") as MatchPlayer;
		player.protectedUntil = 0;
		const bot = sim.bot("p1");
		bot.input.jump = true;
		sim.run(3);
		expect(player.health).toBe(100);
	});

	it("un monstre attiré sur la mezzanine y monte", () => {
		const sim = tutorial();
		silenceAnomalies(sim);
		const room = grandRooms(sim.match.layout)[0];
		const spec = room.mezzanine as NonNullable<Room["mezzanine"]>;
		const deck = deckPoint(room);
		placeBot(sim, "p1", deck, 0);
		const monster = installAnomaly(sim, 0, "veilleur", voidPoint(room));
		let highest = monster.position.y;
		for (let second = 0; second < 40; second += 1) {
			lureAnomalies(sim.match, deck, "p1");
			sim.run(1);
			highest = Math.max(highest, monster.position.y);
		}
		expect(highest).toBeGreaterThan(spec.floorY - 0.2);
	});
});

describe("reliefs des murs et verdure", () => {
	const layouts = Array.from({ length: 14 }, (_, index) =>
		manor(index + 1, "medium"),
	);

	it("garde le bas des murs fin et les grands reliefs au-dessus de la tête", () => {
		const reliefs = new Set<string>();
		for (const room of layouts.flatMap((layout) => layout.rooms)) {
			const profile = wallProfile(room);
			expect(profile[0].y).toBe(0);
			expect(profile[profile.length - 1].y).toBeCloseTo(room.height);
			for (let index = 1; index < profile.length; index += 1) {
				expect(profile[index].y).toBeGreaterThanOrEqual(profile[index - 1].y);
			}
			for (const node of profile) {
				if (node.y < 2.3) {
					expect(node.depth).toBeLessThanOrEqual(WALL_RELIEF_MAX_LOW_DEPTH);
				}
				expect(node.depth).toBeLessThanOrEqual(0.85);
			}
			if (profile.some((node) => node.depth > 0)) {
				reliefs.add(profile.map((node) => node.depth.toFixed(2)).join());
			}
		}
		expect(reliefs.size).toBeGreaterThan(8);
	});

	it("découpe un profil sans perdre ses hauteurs", () => {
		const nodes = [
			{ y: 0, depth: 0.2 },
			{ y: 1, depth: 0 },
			{ y: 3, depth: 0.4 },
		];
		expect(clipProfile(nodes, 0.5, 2)).toEqual([
			{ y: 0.5, depth: 0.1 },
			{ y: 1, depth: 0 },
			{ y: 2, depth: 0.2 },
		]);
	});

	it("garnit les grandes salles sans gêner la circulation", () => {
		for (const layout of layouts) {
			const grid = new NavGrid(new CollisionWorld(layout));
			for (const room of grandRooms(layout)) {
				const items = layout.furniture.filter((i) => i.roomId === room.id);
				const kinds = (list: string[]) =>
					items.filter((item) => list.includes(item.kind)).length;
				expect(
					kinds(["ivyWall", "railVine", "climbingVine"]),
				).toBeGreaterThanOrEqual(2);
				expect(
					kinds(["pottedPlant", "palmTree", "planterBed"]),
				).toBeGreaterThan(2);
				expect(items.length).toBeGreaterThan(30);
				expect(
					items.filter(
						(item) =>
							item.parentId === null &&
							item.colliders.length > 0 &&
							item.y <
								(room.mezzanine as NonNullable<Room["mezzanine"]>).floorY - 1,
					).length,
				).toBeGreaterThan(8);
				const cells = grid.roomCells.get(room.id) ?? [];
				const reachable = cells.filter((n) => grid.isInMainComponent(n));
				expect(reachable.length / cells.length).toBeGreaterThan(0.65);
			}
		}
	});
});
