import { describe, expect, it } from "vitest";
import { LEVEL_HEIGHT, SLAB_THICKNESS } from "../shared/config/index.js";
import { DOMESTIC_KINDS } from "../shared/manor/furnitureCatalog.js";
import {
	generateManor,
	layoutChecksum,
} from "../shared/manor/generateManor.js";
import {
	openingPassage,
	stairHeightAt,
} from "../shared/manor/layoutBuilder.js";
import {
	boxCorners,
	boxesOverlap2D,
	edgeDirection,
	pointInPolygon,
	polygonsOverlap,
} from "../shared/manor/polygon.js";
import { MAX_CEILING } from "../shared/manor/roomCatalog.js";
import type { Room, StairSpec } from "../shared/manor/types.js";
import { PUBLIC_MATCH_CONFIG } from "../shared/matchConfig.js";
import { rotate2 } from "../shared/math.js";
import {
	allFixtures,
	fixture,
	mainComponent,
	manorOptions,
	navComponents,
	occupiedLevels,
} from "./helpers/manorFixtures.js";

const fixtures = allFixtures();
const GLASS_SEEDS = Array.from(
	{ length: 24 },
	(_, index) => 3001 + index * 977,
);

describe("génération du manoir", () => {
	it("est déterministe pour une même graine", () => {
		const first = generateManor(424242, manorOptions("medium"));
		const second = generateManor(424242, manorOptions("medium"));
		expect(layoutChecksum(first)).toBe(layoutChecksum(second));
		const other = generateManor(424243, manorOptions("medium"));
		expect(layoutChecksum(other)).not.toBe(layoutChecksum(first));
	});

	it.each(fixtures.map((item) => [item.seed, item.size, item] as const))(
		"graine %i (%s) : aucune salle ne chevauche une autre",
		(_seed, _size, item) => {
			const rooms = item.layout.rooms;
			for (let i = 0; i < rooms.length; i += 1) {
				for (let j = i + 1; j < rooms.length; j += 1) {
					const a = rooms[i];
					const b = rooms[j];
					const levelsB = occupiedLevels(b);
					const shareLevel = occupiedLevels(a).some((level) =>
						levelsB.includes(level),
					);
					if (shareLevel) {
						expect(
							polygonsOverlap(a.polygon, b.polygon, 0.01),
							`${a.type}#${a.id} / ${b.type}#${b.id}`,
						).toBe(false);
					}
				}
			}
		},
	);

	it.each(fixtures.map((item) => [item.seed, item.size, item] as const))(
		"graine %i (%s) : toutes les salles sont reliées et praticables",
		(_seed, _size, item) => {
			const components = navComponents(item);
			const main = mainComponent(item);
			for (const room of item.layout.rooms) {
				const cells = item.grid.roomCells.get(room.id) ?? [];
				expect(
					cells.some((cell) => components[cell] === main),
					`${room.type}#${room.id}`,
				).toBe(true);
			}
			item.grid.portals.forEach((portal, index) => {
				const node = item.grid.portalBase + index;
				expect(
					components[node],
					`ouverture ${portal.openingId} ${portal.role}`,
				).toBe(main);
			});
		},
	);

	it.each(fixtures.map((item) => [item.seed, item.size, item] as const))(
		"graine %i (%s) : les ouvertures relient exactement les murs des deux salles",
		(_seed, _size, item) => {
			for (const opening of item.layout.openings) {
				const roomA = item.layout.rooms[opening.roomA];
				const roomB = item.layout.rooms[opening.roomB];
				const edgeA = roomA.edges[opening.edgeA];
				const edgeB = roomB.edges[opening.edgeB];
				expect(edgeA.kind).toBe("line");
				expect(edgeB.kind).toBe("line");
				const directionA = edgeDirection(edgeA);
				const directionB = edgeDirection(edgeB);
				expect(
					directionA.x * directionB.x + directionA.z * directionB.z,
				).toBeCloseTo(-1, 4);
				const passage = openingPassage(opening);
				const middleB = {
					x: (passage[1].x + passage[2].x) / 2,
					z: (passage[1].z + passage[2].z) / 2,
				};
				const offsetB =
					(middleB.x - edgeB.a.x) * -directionB.z +
					(middleB.z - edgeB.a.z) * directionB.x;
				expect(Math.abs(offsetB)).toBeLessThan(0.01);
				expect(opening.width).toBeGreaterThanOrEqual(0.9);
				expect(opening.height).toBeGreaterThanOrEqual(2.05);
				expect(opening.height).toBeLessThanOrEqual(
					Math.min(roomA.ceilingY, roomB.ceilingY) - opening.floorY,
				);
			}
		},
	);

	it("produit des boucles, des impasses et au moins sept orientations de murs", () => {
		let loops = 0;
		for (const item of fixtures) {
			const { rooms, openings } = item.layout;
			loops += openings.length - (rooms.length - 1);
			const deadEnds = rooms.filter((room) => room.openingIds.length === 1);
			expect(deadEnds.length).toBeGreaterThan(1);
			const headings = new Set<number>();
			for (const room of rooms) {
				for (const edge of room.edges) {
					if (edge.kind === "line") {
						const direction = edgeDirection(edge);
						headings.add(
							Math.round(
								(Math.atan2(direction.z, direction.x) * 4) / Math.PI + 8,
							) % 8,
						);
					}
				}
			}
			expect(headings.size).toBeGreaterThanOrEqual(7);
			expect(
				rooms.some((room) => room.edges.some((edge) => edge.kind === "arc")),
			).toBe(true);
		}
		expect(loops).toBeGreaterThan(fixtures.length);
	});

	it("les toilettes et débarras sont petits et reliés par une seule porte", () => {
		let checked = 0;
		for (const item of fixtures) {
			for (const room of item.layout.rooms) {
				if (room.type !== "toilets" && room.type !== "closet") {
					continue;
				}
				checked += 1;
				expect(room.openingIds).toHaveLength(1);
				const opening = item.layout.openings[room.openingIds[0]];
				expect(opening.kind).toBe("door");
				expect(opening.door).not.toBeNull();
				expect(room.area).toBeLessThan(room.type === "closet" ? 4.6 : 5.8);
			}
		}
		expect(checked).toBeGreaterThan(5);
	});

	it("chaque étage compte au moins quatre pièces", () => {
		const layouts = [
			...fixtures.map((item) => item.layout),
			generateManor(150461, manorOptions("small", 3)),
			generateManor(934442, manorOptions("large", 3)),
			generateManor(71271, manorOptions("small", 3)),
		];
		for (const layout of layouts) {
			for (const level of layout.levels.filter((level) => level > 0)) {
				const rooms = layout.rooms.filter(
					(room) => room.level === level && room.type !== "stairwell",
				);
				expect(
					rooms.length,
					`graine ${layout.seed}, étage ${level}`,
				).toBeGreaterThanOrEqual(4);
			}
		}
	});

	it("aucune salle n'est construite au-dessus d'une verrière", () => {
		let checked = 0;
		for (const item of [...fixtures, ...allFixtures(GLASS_SEEDS)]) {
			for (const room of item.layout.rooms.filter(
				(candidate) => candidate.style.ceiling === "glass",
			)) {
				checked += 1;
				const above = item.layout.rooms.filter(
					(other) =>
						other.level > room.level &&
						polygonsOverlap(other.polygon, room.polygon, 0.05),
				);
				expect(
					above.map((other) => other.type),
					`${room.type}#${room.id} (graine ${item.seed})`,
				).toEqual([]);
			}
		}
		expect(checked).toBeGreaterThan(10);
	});

	it("la serre a une verrière, des plantes et aucun mobilier domestique", () => {
		let checked = 0;
		for (const item of fixtures) {
			for (const room of item.layout.rooms.filter(
				(candidate) => candidate.type === "greenhouse",
			)) {
				checked += 1;
				expect(room.style.ceiling).toBe("glass");
				const items = item.layout.furniture.filter(
					(furniture) => furniture.roomId === room.id,
				);
				expect(
					items.some(
						(furniture) =>
							furniture.kind === "planterBed" ||
							furniture.kind === "pottedPlant",
					),
				).toBe(true);
				expect(
					items.filter((furniture) => DOMESTIC_KINDS.has(furniture.kind)),
				).toEqual([]);
				const above = item.layout.rooms.filter(
					(other) =>
						other.level > room.level &&
						polygonsOverlap(other.polygon, room.polygon),
				);
				expect(above).toEqual([]);
			}
		}
		expect(checked).toBeGreaterThan(3);
	});

	it("les salles d'ambiance ont leur mobilier caractéristique", () => {
		const signatures: Record<string, string[]> = {
			observatory: ["telescope"],
			curiosities: ["displayCase"],
			nursery: ["crib", "rockingHorse"],
			laundry: ["dryingLine", "washtub"],
			crypt: ["sarcophagus"],
		};
		const seen = new Set<string>();
		for (const item of fixtures) {
			for (const room of item.layout.rooms) {
				const expected = signatures[room.type];
				if (!expected) {
					continue;
				}
				seen.add(room.type);
				const kinds = new Set(
					item.layout.furniture
						.filter((piece) => piece.roomId === room.id)
						.map((piece) => piece.kind),
				);
				expect(
					expected.some((kind) => kinds.has(kind)),
					`${room.type}#${room.id} (graine ${item.seed})`,
				).toBe(true);
				if (room.type === "observatory") {
					expect(room.level).toBeGreaterThan(0);
					expect(room.style.ceiling).toBe("glass");
				}
				if (room.type === "crypt") {
					expect(room.level).toBe(0);
					expect(["stoneBlocks", "rubbleStone", "mossyBrick"]).toContain(
						room.style.wall,
					);
				}
			}
		}
		expect([...seen].sort()).toEqual(Object.keys(signatures).sort());
	});

	it("varie le mobilier et les motifs de murs d'une graine à l'autre", () => {
		const kinds = new Set(
			fixtures.flatMap((item) =>
				item.layout.furniture.map((piece) => piece.kind),
			),
		);
		const novelties = [
			"secretary",
			"vanity",
			"bust",
			"urn",
			"torchere",
			"stool",
			"screen",
			"hangingPots",
			"wallClock",
			"ovalPortrait",
			"hangingCage",
			"gardenLantern",
			"teaSet",
			"hourglass",
		];
		expect(novelties.filter((kind) => kinds.has(kind)).length).toBeGreaterThan(
			10,
		);
		const walls = new Set<string>(
			fixtures.flatMap((item) =>
				item.layout.rooms.map((room) => room.style.wall),
			),
		);
		expect(
			[
				"wallpaperFloral",
				"wallpaperTrellis",
				"wallpaperStripes",
				"wallpaperFleur",
				"rubbleStone",
				"mossyBrick",
			].filter((wall) => walls.has(wall)).length,
		).toBeGreaterThanOrEqual(4);
	});

	it("la cave est en pierre et meublée en conséquence", () => {
		for (const item of fixtures) {
			for (const room of item.layout.rooms.filter(
				(candidate) => candidate.type === "cellar",
			)) {
				expect(["stoneFlags", "cobble"]).toContain(room.style.floor);
				expect(["stoneBlocks", "brick", "rubbleStone", "mossyBrick"]).toContain(
					room.style.wall,
				);
				const kinds = new Set(
					item.layout.furniture
						.filter((furniture) => furniture.roomId === room.id)
						.map((furniture) => furniture.kind),
				);
				expect(
					["wineRack", "barrel", "crate", "shelf"].some((kind) =>
						kinds.has(kind),
					),
				).toBe(true);
				expect(kinds.has("rug")).toBe(false);
			}
		}
	});
});

describe("mobilier", () => {
	it.each(fixtures.map((item) => [item.seed, item.size, item] as const))(
		"graine %i (%s) : les meubles restent dans leur salle sans se chevaucher",
		(_seed, _size, item) => {
			const { furniture, rooms } = item.layout;
			for (const piece of furniture) {
				const room = rooms[piece.roomId];
				for (const collider of piece.colliders) {
					for (const corner of boxCorners(collider)) {
						expect(
							pointInPolygon(corner, room.polygon),
							`${piece.kind}#${piece.id} dans ${room.type}`,
						).toBe(true);
					}
					expect(collider.yMin).toBeGreaterThanOrEqual(room.floorY - 1e-6);
				}
			}
			const colliding = furniture.filter((piece) => piece.colliders.length > 0);
			for (let i = 0; i < colliding.length; i += 1) {
				for (let j = i + 1; j < colliding.length; j += 1) {
					const a = colliding[i];
					const b = colliding[j];
					if (
						a.roomId !== b.roomId ||
						a.parentId === b.id ||
						b.parentId === a.id ||
						Math.abs(a.y - b.y) > 3
					) {
						continue;
					}
					const overlap = a.colliders.some((ca) =>
						b.colliders.some((cb) => boxesOverlap2D(ca, cb, 0.01)),
					);
					expect(overlap, `${a.kind}#${a.id} / ${b.kind}#${b.id}`).toBe(false);
				}
			}
		},
	);

	it("les meubles adossés font face à la salle et les cachettes sont accessibles", () => {
		for (const item of fixtures) {
			const components = navComponents(item);
			const main = mainComponent(item);
			for (const piece of item.layout.furniture) {
				if (
					![
						"wardrobe",
						"lockers",
						"bookcase",
						"cabinet",
						"bed",
						"fireplace",
						"valveStation",
					].includes(piece.kind)
				) {
					continue;
				}
				const room = item.layout.rooms[piece.roomId];
				const front = {
					x: piece.x - Math.sin(piece.rotation) * (piece.depth / 2 + 0.3),
					z: piece.z + Math.cos(piece.rotation) * (piece.depth / 2 + 0.3),
				};
				expect(
					pointInPolygon(front, room.polygon),
					`${piece.kind}#${piece.id}`,
				).toBe(true);
			}
			for (const spot of item.layout.hideSpots) {
				const furniture = item.layout.furniture[spot.furnitureId];
				const node = item.grid.nearestNode(
					{ x: spot.entry.x, y: furniture.y, z: spot.entry.z },
					2,
				);
				expect(node, `cachette ${spot.id}`).not.toBeNull();
				expect(components[node ?? 0], `cachette ${spot.id}`).toBe(main);
			}
			for (const valve of item.layout.valves) {
				const node = item.grid.nearestNode(
					{ x: valve.jet.x, y: valve.floorY, z: valve.jet.z },
					2,
				);
				expect(node).not.toBeNull();
				expect(components[node ?? 0]).toBe(main);
			}
		}
	});

	it("les miroirs ne sont jamais dans une fenêtre et les lumières restent dans leur salle", () => {
		for (const item of fixtures) {
			const windows = item.layout.furniture.filter(
				(piece) => piece.kind === "window",
			);
			const mirrors = item.layout.furniture.filter(
				(piece) => piece.kind === "mirror" || piece.kind === "painting",
			);
			for (const mirror of mirrors) {
				for (const window of windows) {
					if (window.roomId !== mirror.roomId) {
						continue;
					}
					const horizontal =
						Math.hypot(window.x - mirror.x, window.z - mirror.z) <
						(window.width + mirror.width) / 2;
					const vertical =
						mirror.y < window.y + window.height &&
						mirror.y + mirror.height > window.y;
					expect(
						horizontal && vertical,
						`miroir ${mirror.id} / fenêtre ${window.id}`,
					).toBe(false);
				}
			}
			for (const light of item.layout.lights) {
				const room = item.layout.rooms[light.roomId];
				expect(
					pointInPolygon(
						{ x: light.position.x, z: light.position.z },
						room.polygon,
					),
				).toBe(true);
				expect(light.position.y).toBeLessThan(room.ceilingY);
			}
		}
	});

	it("les objets posés sur une estrade reposent sur son plateau", () => {
		let checked = 0;
		for (const item of fixtures) {
			for (const piece of item.layout.furniture) {
				if (piece.parentId === null) {
					continue;
				}
				const parent = item.layout.furniture[piece.parentId];
				expect(piece.y).toBeCloseTo(parent.y + parent.height, 3);
				if (parent.kind === "estrade") {
					checked += 1;
					for (const collider of piece.colliders) {
						expect(collider.yMin).toBeCloseTo(parent.y + parent.height, 3);
					}
				}
			}
		}
		expect(checked).toBeGreaterThan(2);
	});

	it("propose des cachettes variées dont la vue est placée à l'intérieur du meuble", () => {
		const kinds = new Set<string>();
		for (const item of fixtures) {
			for (const spot of item.layout.hideSpots) {
				const furniture = item.layout.furniture[spot.furnitureId];
				kinds.add(furniture.kind);
				const local = rotate2(
					{
						x: spot.interior.x - furniture.x,
						z: spot.interior.z - furniture.z,
					},
					-furniture.rotation,
				);
				expect(
					Math.abs(local.x),
					`${furniture.kind}#${furniture.id}`,
				).toBeLessThan(furniture.width / 2);
				expect(
					Math.abs(local.z),
					`${furniture.kind}#${furniture.id}`,
				).toBeLessThan(furniture.depth / 2);
				const eye = spot.interior.y - furniture.y;
				expect(eye).toBeGreaterThan(0.4);
				expect(eye).toBeLessThan(furniture.height);
			}
		}
		for (const kind of [
			"wardrobe",
			"lockers",
			"trunk",
			"curtainAlcove",
			"cask",
		]) {
			expect(kinds.has(kind), kind).toBe(true);
		}
	});

	it("les armoires-cachettes sont nombreuses et variées", () => {
		for (const item of fixtures) {
			expect(item.layout.hideSpots.length).toBeGreaterThanOrEqual(
				Math.ceil(item.layout.rooms.length * 0.35),
			);
			const kinds = new Set(
				item.layout.hideSpots.map(
					(spot) => item.layout.furniture[spot.furnitureId].kind,
				),
			);
			expect(kinds.size).toBeGreaterThanOrEqual(2);
			expect(item.layout.valves.length).toBeGreaterThanOrEqual(3);
		}
	});
});

describe("étages et escaliers", () => {
	const withFloors = fixtures.filter((item) => item.floors > 0);

	it("chaque cage d'escalier relie un niveau au suivant et reste close", () => {
		expect(withFloors.length).toBeGreaterThan(4);
		for (const item of withFloors) {
			const stairwells = item.layout.rooms.filter(
				(room) => room.type === "stairwell",
			);
			expect(stairwells.length).toBeGreaterThan(0);
			for (const stair of stairwells) {
				const openings = stair.openingIds.map((id) => item.layout.openings[id]);
				expect(
					openings.filter((opening) => opening.level === stair.level),
				).toHaveLength(1);
				expect(
					openings.filter((opening) => opening.level === stair.level + 1),
				).toHaveLength(1);
				expect(stair.ceilingY).toBeGreaterThan(
					(stair.level + 1) * LEVEL_HEIGHT + 2.5,
				);
				const sideOpenings =
					stair.edgeOpenings[1].length + stair.edgeOpenings[3].length;
				expect(sideOpenings).toBe(0);
			}
			const ground = item.layout.rooms.filter((room) => room.level === 0);
			for (const level of item.layout.levels.slice(1)) {
				const rooms = item.layout.rooms.filter((room) => room.level === level);
				expect(rooms.length, `niveau ${level}`).toBeGreaterThan(0);
				expect(rooms.length).toBeLessThan(ground.length);
				expect(
					rooms.every(
						(room) =>
							room.floorY === level * LEVEL_HEIGHT ||
							item.layout.openings.some(
								(opening) =>
									opening.roomB === room.id &&
									item.layout.rooms[opening.roomA].mezzanine?.floorY ===
										room.floorY,
							),
					),
				).toBe(true);
			}
			expect(item.layout.levels.length).toBeLessThanOrEqual(item.floors + 1);
		}
	});

	it("superpose jusqu'à trois étages reliés au rez-de-chaussée", () => {
		const tall = [3, 7, 11, 19].map((seed) =>
			fixture(seed * 1543, "medium", 3),
		);
		const reached = tall.map((item) => Math.max(...item.layout.levels));
		expect(Math.max(...reached)).toBe(3);
		expect(reached.filter((level) => level >= 2).length).toBeGreaterThanOrEqual(
			3,
		);
		for (const item of tall) {
			const main = mainComponent(item);
			for (const room of item.layout.rooms) {
				const cells = item.grid.roomCells.get(room.id) ?? [];
				expect(
					cells.some((cell) => item.grid.component[cell] === main),
					`${room.type}#${room.id} niveau ${room.level} (graine ${item.seed})`,
				).toBe(true);
			}
		}
	});

	it("varie les hauteurs sous plafond sans empiéter sur l'étage du dessus", () => {
		const rooms = fixtures.flatMap((item) =>
			item.layout.rooms
				.filter((room) => room.type !== "stairwell")
				.map((room) => ({ item, room })),
		);
		const tallRooms = rooms.filter(({ room }) => room.height > MAX_CEILING);
		const lowRooms = rooms.filter(({ room }) => room.height <= 2.65);
		expect(tallRooms.length).toBeGreaterThan(3);
		expect(lowRooms.length).toBeGreaterThan(3);
		for (const { item, room } of tallRooms) {
			expect(room.height).toBeGreaterThan(5);
			expect(room.height).toBeLessThanOrEqual(room.mezzanine ? 8.4 : 6);
			const above = item.layout.rooms.filter(
				(other) =>
					other.level === room.level + 1 &&
					polygonsOverlap(other.polygon, room.polygon, 0.01),
			);
			expect(above, `${room.type}#${room.id}`).toEqual([]);
		}
		for (const { room } of rooms) {
			expect(room.height).toBeGreaterThanOrEqual(2.4);
			if (room.height <= MAX_CEILING) {
				expect(room.ceilingY).toBeLessThanOrEqual(
					(room.level + 1) * LEVEL_HEIGHT - SLAB_THICKNESS,
				);
			}
		}
	});

	it("les anomalies peuvent monter et descendre sans marcher dans le vide", () => {
		const stairs = [...withFloors, fixture(11 * 1543, "medium", 3)].flatMap(
			(item) =>
				item.layout.rooms
					.filter((room) => room.type === "stairwell")
					.slice(0, 2)
					.map((stair) => ({ item, stair })),
		);
		expect(stairs.length).toBeGreaterThan(5);
		for (const { item, stair } of stairs.slice(0, 10)) {
			const bottom = item.layout.openings.find(
				(opening) =>
					opening.level === stair.level &&
					stair.openingIds.includes(opening.id),
			);
			const top = item.layout.openings.find(
				(opening) =>
					opening.level === stair.level + 1 &&
					stair.openingIds.includes(opening.id),
			);

			if (!bottom || !top) {
				throw new Error("Stairwell openings not found for the test.");
			}
			const lowerRoom =
				item.layout.rooms[
					bottom.roomA === stair.id ? bottom.roomB : bottom.roomA
				];
			const upperRoom =
				item.layout.rooms[top.roomA === stair.id ? top.roomB : top.roomA];
			expect(upperRoom.level).toBe(stair.level + 1);
			const centralCell = (room: Room) => {
				const cells = (item.grid.roomCells.get(room.id) ?? []).filter(
					(cell) =>
						item.grid.isInMainComponent(cell) &&
						Math.abs(item.grid.heights[cell] - room.floorY) < 0.05,
				);
				const spread = (cell: number) => {
					const position = item.grid.nodePosition(cell);
					return Math.hypot(
						position.x - room.labelPoint.x,
						position.z - room.labelPoint.z,
					);
				};
				return item.grid.nodePosition(
					cells.reduce((best, cell) =>
						spread(cell) < spread(best) ? cell : best,
					),
				);
			};
			const from = centralCell(lowerRoom);
			const to = centralCell(upperRoom);
			for (const [start, end] of [
				[from, to],
				[to, from],
			] as const) {
				const path = item.finder.findPath(start, end, {
					canOpenDoors: true,
					isDoorClosed: () => false,
				});
				expect(path, `graine ${item.seed}`).not.toBeNull();

				if (!path) {
					throw new Error("Path not found for the test.");
				}

				for (let index = 1; index < path.length; index += 1) {
					const a = path[index - 1];
					const b = path[index];
					const samples = 8;
					for (let step = 0; step <= samples; step += 1) {
						const t = step / samples;
						const point = {
							x: a.x + (b.x - a.x) * t,
							z: a.z + (b.z - a.z) * t,
						};
						const y = a.y + (b.y - a.y) * t;
						const regions = item.world.regionsAt(point);
						const supported = regions.some(
							(region) =>
								Math.abs(item.world.regionFloorY(region, point) - y) < 0.6,
						);
						expect(
							supported,
							`point (${point.x.toFixed(2)}, ${y.toFixed(2)}, ${point.z.toFixed(2)})`,
						).toBe(true);
					}
				}
			}
		}
	});
});

describe("fixtures", () => {
	it("se construisent rapidement", () => {
		const start = performance.now();
		fixture(99991, "large");
		expect(performance.now() - start).toBeLessThan(4000);
	});
});

describe("décor des cages d'escalier", () => {
	it("accroche cadres et appliques au-dessus des marches", () => {
		let checked = 0;
		for (const seed of [1, 2, 3, 4, 5, 6]) {
			const layout = generateManor(seed, { ...PUBLIC_MATCH_CONFIG, floors: 2 });
			for (const room of layout.rooms.filter(
				(candidate) => candidate.type === "stairwell" && candidate.stair,
			)) {
				for (const item of layout.furniture.filter(
					(candidate) =>
						candidate.roomId === room.id && candidate.kind !== "cobweb",
				)) {
					const step = stairHeightAt(room.stair as StairSpec, item);
					expect(
						item.y - room.floorY - step,
						`${item.kind}, graine ${seed}`,
					).toBeGreaterThan(0.9);
					checked += 1;
				}
			}
		}
		expect(checked).toBeGreaterThan(20);
	});
});
