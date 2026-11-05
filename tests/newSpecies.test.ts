import { describe, expect, it } from "vitest";
import {
	observedByPlayers,
	SPREAD_RADIUS,
} from "../server/game/ai/dispersal.js";
import { muzzleToward } from "../server/game/ai/species/fulgurant.js";
import { anomalyExtra } from "../server/game/ai/updateAnomaly.js";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import { throwPlayer } from "../server/game/systems/throwing.js";
import { SWARM_DIRECTIONS, swarmClearance } from "../shared/anomalies/swarm.js";
import {
	FULGURANT_MIN_STAY_MS,
	FULGURANT_UNWATCHED_MS,
	GORGON_GAZE_LIMIT_MS,
	GORGON_PETRIFY_MS,
	HEALTH_MAX,
	RAT_KING_SWARM_RADIUS,
	SERVER_TICK_MS,
	SPRINT_SPEED,
} from "../shared/config/index.js";
import { SPECIES } from "../shared/config/species.js";
import { lookDirection } from "../shared/math.js";
import { lineOfSight } from "../shared/physics/lineOfSight.js";
import { PLAYER_FLAG } from "../shared/protocol/game.js";
import {
	aimAt,
	castAt,
	findClearLine,
	installAnomaly,
	placeBot,
	prepareCaster,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function quietSimulation(seed = 4242): MatchSimulation {
	const sim = new MatchSimulation({ seed, players: 1 });
	silenceAnomalies(sim);
	return sim;
}

describe("Colosse", () => {
	it("projette le joueur dans une pièce voisine en lui infligeant des dégâts", () => {
		const sim = quietSimulation();
		const { match } = sim;
		const opening = match.layout.openings.find((candidate) => {
			const a = match.layout.rooms[candidate.roomA];
			const b = match.layout.rooms[candidate.roomB];
			return (
				candidate.level === 0 &&
				a.type !== "stairwell" &&
				b.type !== "stairwell" &&
				a.area > 20 &&
				b.area > 12
			);
		});
		if (!opening) {
			throw new Error("No suitable opening found for the test.");
		}
		const middle = {
			x: (opening.start.x + opening.end.x) / 2,
			z: (opening.start.z + opening.end.z) / 2,
		};
		const inA = (distance: number) => ({
			x: middle.x - opening.normal.x * distance,
			y: opening.floorY,
			z: middle.z - opening.normal.z * distance,
		});
		const cellNear = (point: { x: number; z: number }) =>
			(match.grid.roomCells.get(opening.roomA) ?? [])
				.filter((cell) => match.grid.isInMainComponent(cell))
				.map((cell) => ({ cell, position: match.grid.nodePosition(cell) }))
				.sort(
					(a, b) =>
						Math.hypot(a.position.x - point.x, a.position.z - point.z) -
						Math.hypot(b.position.x - point.x, b.position.z - point.z),
				)[0]?.cell ?? null;
		const playerNode = cellNear(inA(1.4));
		const colossusNode = cellNear(inA(2.8));
		if (playerNode === null || colossusNode === null) {
			throw new Error("No walkable spot near the opening.");
		}
		placeBot(sim, "p1", match.grid.nodePosition(playerNode), 0);
		sim.run(2.2);
		const entity = installAnomaly(
			sim,
			0,
			"colosse",
			match.grid.nodePosition(colossusNode),
		);
		const player = match.players.get("p1") as MatchPlayer;
		expect(match.roomIdAt(player.position)).toBe(opening.roomA);
		expect(throwPlayer(match, entity, player)).toBe(true);
		expect(player.health).toBe(HEALTH_MAX - SPECIES.colosse.damage);
		const move = sim.transport.forcedMoves.at(-1);
		expect(move?.kind).toBe("throw");
		expect(match.roomIdAt(player.position)).toBe(opening.roomB);
		expect(match.grid.isWalkablePoint(player.position)).toBe(true);
		sim.run(0.05);
		expect(
			sim.transport
				.eventsOfType("thrown")
				.some((event) => event.playerId === "p1"),
		).toBe(true);
	});

	it("se capture de face comme de dos", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 3.6);
		placeBot(sim, "p1", line.origin, line.yaw);
		prepareCaster(sim, "p1", {});
		const facing = installAnomaly(
			sim,
			0,
			"colosse",
			line.target,
			line.yaw + Math.PI,
		);
		facing.spawnDueAt = Infinity;
		facing.hostile = false;
		expect(castAt(sim, "p1", facing).ok).toBe(true);
	});
});

function dodgeScenario(talkWhileMoving: boolean) {
	const sim = quietSimulation();
	const line = findClearLine(sim, 6, 0, 2);
	placeBot(sim, "p1", line.origin, line.yaw);
	sim.run(2.2);
	const entity = installAnomaly(sim, 0, "fulgurant", line.target, line.yaw);
	const across = { x: Math.cos(line.yaw), z: -Math.sin(line.yaw) };
	const spot = [1.4, -1.4, 1.8, -1.8, 1.1, -1.1]
		.map((offset) =>
			sim.match.grid.nearestNode(
				{
					x: line.origin.x + across.x * offset,
					y: line.origin.y,
					z: line.origin.z + across.z * offset,
				},
				0,
			),
		)
		.filter((node): node is number => node !== null)
		.map((node) => sim.match.grid.nodePosition(node))
		.find((position) => {
			const chest = { ...position, y: position.y + 1 };
			return (
				Math.abs(position.y - line.origin.y) < 0.05 &&
				Math.hypot(position.x - line.origin.x, position.z - line.origin.z) >
					1 &&
				lineOfSight(sim.match.world, muzzleToward(entity, chest), chest)
			);
		});
	if (!spot) {
		throw new Error("No side step found for the test.");
	}
	const bot = sim.bot("p1");
	bot.voiceLevel = 0.9;
	sim.run(0.3);
	expect(entity.state).toBe("windup");
	bot.voiceLevel = talkWhileMoving ? 0.9 : 0;
	sim.teleportBot("p1", spot);
	sim.run(1.6);
	return { sim, shot: sim.transport.eventsOfType("laser")[0] };
}

describe("Fulgurant", () => {
	it("ne marche pas et réapparaît hors de vue quand personne ne le regarde", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 6);
		placeBot(sim, "p1", line.origin, line.yaw + Math.PI);
		const player = sim.match.players.get("p1") as MatchPlayer;
		player.protectedUntil = Infinity;
		const entity = installAnomaly(sim, 0, "fulgurant", line.target, line.yaw);
		const start = { ...entity.position };
		const generation = entity.gen;
		expect(observedByPlayers(sim.match, entity)).toBe(false);
		sim.run((FULGURANT_MIN_STAY_MS - 500) / 1000);
		expect(entity.gen).toBe(generation);
		expect(
			Math.hypot(entity.position.x - start.x, entity.position.z - start.z),
		).toBeLessThan(0.01);
		sim.run((FULGURANT_UNWATCHED_MS - FULGURANT_MIN_STAY_MS + 1500) / 1000);
		expect(entity.gen).toBe(generation + 1);
		expect(observedByPlayers(sim.match, entity)).toBe(false);
		expect(
			Math.hypot(
				entity.position.x - player.position.x,
				entity.position.z - player.position.z,
			),
		).toBeGreaterThanOrEqual(14);
		expect(sim.transport.eventsOfType("anomalySpawn").at(-1)?.anomalyId).toBe(
			entity.id,
		);
	});

	it("reste en place tant qu'un joueur le regarde", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 6);
		placeBot(sim, "p1", line.origin, line.yaw);
		(sim.match.players.get("p1") as MatchPlayer).protectedUntil = Infinity;
		const entity = installAnomaly(sim, 0, "fulgurant", line.target, line.yaw);
		const generation = entity.gen;
		expect(observedByPlayers(sim.match, entity)).toBe(true);
		sim.run((FULGURANT_UNWATCHED_MS + 3000) / 1000);
		expect(entity.gen).toBe(generation);
		expect(
			Math.hypot(
				entity.position.x - line.target.x,
				entity.position.z - line.target.z,
			),
		).toBeLessThan(0.3);
	});

	it("suit à l'oreille un joueur qui se déplace en parlant pendant la charge", () => {
		const { sim, shot } = dodgeScenario(true);
		expect(shot?.hits).toEqual(["p1"]);
		expect(sim.transport.eventsOfType("laserCharge").length).toBeGreaterThan(1);
	});

	it("tire là où il a entendu un joueur qui s'est écarté en silence", () => {
		const { sim, shot } = dodgeScenario(false);
		expect(shot?.hits).toEqual([]);
		expect((sim.match.players.get("p1") as MatchPlayer).health).toBe(
			HEALTH_MAX,
		);
	});

	it("tire là où il entend un joueur puis reste immobile 10 secondes", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 6);
		placeBot(sim, "p1", line.origin, line.yaw);
		sim.run(2.2);
		const entity = installAnomaly(sim, 0, "fulgurant", line.target, line.yaw);
		const bot = sim.bot("p1");
		bot.voiceLevel = 0.9;
		sim.run(0.6);
		expect(entity.state).toBe("windup");
		expect(sim.transport.eventsOfType("laserCharge")).toHaveLength(1);
		bot.voiceLevel = 0;
		sim.run(1.4);
		const shot = sim.transport.eventsOfType("laser")[0];
		expect(shot?.hits).toEqual(["p1"]);
		const player = sim.match.players.get("p1") as MatchPlayer;
		expect(player.health).toBe(HEALTH_MAX - SPECIES.fulgurant.damage);
		expect(entity.state).toBe("special");
		const position = { ...entity.position };
		bot.voiceLevel = 0.9;
		sim.run(9);
		expect(entity.state).toBe("special");
		expect(
			Math.hypot(
				entity.position.x - position.x,
				entity.position.z - position.z,
			),
		).toBeLessThan(0.01);
		expect(sim.transport.eventsOfType("laser")).toHaveLength(1);
		bot.voiceLevel = 0;
		sim.run(1.5);
		expect(entity.state).not.toBe("special");
	});

	it("se capture à tout moment, pas seulement en surchauffe", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 4);
		placeBot(sim, "p1", line.origin, line.yaw);
		prepareCaster(sim, "p1", { voiceLevel: 0.95 });
		const calm = installAnomaly(sim, 0, "fulgurant", line.target, line.yaw);
		calm.setState("idle", sim.match.now);
		calm.lastStrikeAt = sim.match.now;
		expect(castAt(sim, "p1", calm).ok).toBe(true);
	});
});

describe("Idole (gorgone)", () => {
	it("fond sur le joueur qui la fixe trop longtemps", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 6);
		placeBot(sim, "p1", line.origin, line.yaw);
		sim.run(2.2);
		const entity = installAnomaly(sim, 0, "gorgone", line.target, line.yaw);
		entity.idleUntil = Infinity;
		aimAt(sim, "p1", entity.center(), false);
		sim.run(GORGON_GAZE_LIMIT_MS / 1000 - 0.8);
		expect(entity.state).not.toBe("special");
		expect(entity.state).not.toBe("chase");
		sim.run(1.2);
		expect(["special", "chase"]).toContain(entity.state);
		expect(sim.transport.eventsOfType("scream")).toHaveLength(1);
		const player = sim.match.players.get("p1") as MatchPlayer;
		let struckAt = 0;
		sim.run(4, () => {
			if (struckAt === 0 && player.health < HEALTH_MAX) {
				struckAt = sim.match.now;
			}
		});
		expect(player.health).toBe(HEALTH_MAX - SPECIES.gorgone.damage);
		expect(player.petrifiedUntil).toBe(struckAt + GORGON_PETRIFY_MS);
	});

	it("pétrifie le joueur qu'elle frappe : il ne peut plus bouger pendant 3 s", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 6);
		placeBot(sim, "p1", line.origin, line.yaw);
		const player = sim.match.players.get("p1") as MatchPlayer;
		player.petrifiedUntil = sim.match.now + GORGON_PETRIFY_MS;
		const start = { ...player.position };
		const bot = sim.bot("p1");
		bot.input.forward = 1;
		sim.run(GORGON_PETRIFY_MS / 1000 - 0.3);
		expect(
			sim.match.snapshot().players[0].flags & PLAYER_FLAG.petrified,
		).not.toBe(0);
		expect(
			Math.hypot(player.position.x - start.x, player.position.z - start.z),
		).toBeLessThan(0.3);
		sim.run(1.5);
		expect(
			Math.hypot(player.position.x - start.x, player.position.z - start.z),
		).toBeGreaterThan(1);
	});

	it("fond sur sa cible bien plus vite qu'un joueur qui sprinte", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 6);
		placeBot(sim, "p1", line.origin, line.yaw);
		sim.run(2.2);
		const entity = installAnomaly(sim, 0, "gorgone", line.target, line.yaw);
		entity.idleUntil = Infinity;
		aimAt(sim, "p1", entity.center(), false);
		const strides: number[] = [];
		let previous = { ...entity.position };
		sim.run(GORGON_GAZE_LIMIT_MS / 1000 + 2, () => {
			if (entity.state === "chase") {
				strides.push(
					Math.hypot(
						entity.position.x - previous.x,
						entity.position.z - previous.z,
					),
				);
			}
			previous = { ...entity.position };
		});
		expect(strides.length).toBeGreaterThan(2);
		const fastest = Math.max(...strides) / (SERVER_TICK_MS / 1000);
		expect(fastest).toBeGreaterThan(SPRINT_SPEED * 1.6);
	});

	it("ignore celui qui détourne le regard", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 6);
		placeBot(sim, "p1", line.origin, line.yaw + Math.PI);
		sim.run(2.2);
		const entity = installAnomaly(sim, 0, "gorgone", line.target, line.yaw);
		sim.run(8);
		expect(["special", "chase", "windup"]).not.toContain(entity.state);
		expect(sim.transport.eventsOfType("scream")).toHaveLength(0);
		const player = sim.match.players.get("p1") as MatchPlayer;
		expect(player.health).toBe(HEALTH_MAX);
	});
});

describe("répartition des anomalies", () => {
	it("deux anomalies côte à côte s'éloignent quand personne ne les regarde", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 3);
		const player = sim.match.players.get("p1") as MatchPlayer;
		const far = [...sim.match.layout.rooms]
			.filter((room) => room.level === 0 && room.type !== "stairwell")
			.sort(
				(a, b) =>
					Math.hypot(
						b.labelPoint.x - line.origin.x,
						b.labelPoint.z - line.origin.z,
					) -
					Math.hypot(
						a.labelPoint.x - line.origin.x,
						a.labelPoint.z - line.origin.z,
					),
			)[0];
		const node = sim.match.grid.nearestNode(
			{ x: far.labelPoint.x, y: far.floorY, z: far.labelPoint.z },
			3,
		);
		if (node === null) {
			throw new Error("No far node found for the test.");
		}
		placeBot(sim, "p1", sim.match.grid.nodePosition(node), 0);
		player.protectedUntil = Infinity;
		const first = installAnomaly(sim, 0, "veilleur", line.origin, line.yaw);
		const second = installAnomaly(sim, 1, "veilleur", line.target, line.yaw);
		const gap = () =>
			Math.hypot(
				first.position.x - second.position.x,
				first.position.z - second.position.z,
			);
		expect(gap()).toBeLessThan(SPREAD_RADIUS);
		let hurried = false;
		sim.run(25, () => {
			hurried ||= first.hurrying || second.hurrying;
		});
		expect(hurried).toBe(true);
		expect(gap()).toBeGreaterThan(SPREAD_RADIUS);
	});
});

describe("Brume", () => {
	function bearing(sim: MatchSimulation, entityId: number) {
		const player = sim.match.players.get("p1") as MatchPlayer;
		const entity = sim.match.anomalies[entityId];
		const dx = entity.position.x - player.position.x;
		const dz = entity.position.z - player.position.z;
		const distance = Math.hypot(dx, dz);
		const look = lookDirection(player.yaw, 0);
		return {
			distance,
			alignment: (look.x * dx + look.z * dz) / (distance || 1),
		};
	}

	function setup(playerTurn: number) {
		const sim = quietSimulation();
		const line = findClearLine(sim, 4, 30, 2.4);
		placeBot(sim, "p1", line.origin, line.yaw + playerTurn);
		sim.run(2.2);
		const entity = installAnomaly(sim, 0, "brume", line.target, line.yaw);
		return { sim, line, entity };
	}

	it("s'attache au joueur qu'elle voit et se glisse dans son dos", () => {
		const { sim, entity } = setup(Math.PI / 2);

		sim.run(0.2);
		expect(entity.targetId).toBe("p1");
		expect(entity.state).toBe("special");
		sim.run(3);
		const { distance, alignment } = bearing(sim, entity.id);
		expect(alignment).toBeLessThan(-0.3);
		expect(distance).toBeLessThan(3.6);
		expect(anomalyExtra(entity, sim.match.now)).toBe(1);
	});

	it("se fige face au joueur qui la regarde", () => {
		const { sim, entity } = setup(0);
		sim.run(3);
		const { distance, alignment } = bearing(sim, entity.id);
		expect(entity.targetId).toBe("p1");
		expect(alignment).toBeGreaterThan(0.9);
		expect(distance).toBeGreaterThan(1.5);
		expect(distance).toBeLessThan(2.6);
	});

	it("suit à la trace un joueur qui sprinte", () => {
		const { sim, line, entity } = setup(Math.PI / 2);
		sim.run(2);
		const bot = sim.bot("p1");
		bot.input.yaw = line.yaw + Math.PI;
		bot.input.forward = 1;
		bot.input.sprint = true;
		let farthest = 0;
		sim.run(1.5, () => {
			farthest = Math.max(farthest, bearing(sim, entity.id).distance);
		});
		bot.input.forward = 0;
		bot.input.sprint = false;
		sim.run(1);
		expect(entity.targetId).toBe("p1");
		expect(farthest).toBeLessThan(5);
		expect(bearing(sim, entity.id).distance).toBeLessThan(3);
	});

	it("suit le joueur qui marche", () => {
		const { sim, line, entity } = setup(Math.PI / 2);
		sim.run(2);
		const bot = sim.bot("p1");
		bot.input.yaw = line.yaw + Math.PI;
		bot.input.forward = 1;
		let farthest = 0;
		sim.run(1.2, () => {
			farthest = Math.max(farthest, bearing(sim, entity.id).distance);
		});
		bot.input.forward = 0;
		sim.run(1.5);
		expect(entity.targetId).toBe("p1");
		expect(farthest).toBeLessThan(5.5);
		expect(bearing(sim, entity.id).distance).toBeLessThan(3.6);
	});

	it("se lasse au bout de 35 s puis laisse ce joueur tranquille", () => {
		const { sim, entity } = setup(Math.PI / 2);
		sim.run(34);
		expect(entity.targetId).toBe("p1");
		sim.run(1.5);
		expect(entity.targetId).toBeNull();
		expect(anomalyExtra(entity, sim.match.now)).toBe(0);
		sim.run(10);
		expect(entity.targetId).toBeNull();
	});

	it("lâche un joueur qui s'est éloigné de plus de 9 m", () => {
		const { sim, entity } = setup(Math.PI / 2);
		sim.run(1);
		const player = sim.match.players.get("p1") as MatchPlayer;
		const far = sim.match.layout.rooms
			.filter((room) => room.level === 0 && room.type !== "stairwell")
			.map((room) =>
				sim.match.grid.nearestNode(
					{ x: room.labelPoint.x, y: room.floorY, z: room.labelPoint.z },
					2,
				),
			)
			.filter((node): node is number => node !== null)
			.map((node) => sim.match.grid.nodePosition(node))
			.find(
				(point) =>
					Math.hypot(point.x - player.position.x, point.z - player.position.z) >
					20,
			);
		if (!far) {
			throw new Error("No distant room found for the test.");
		}
		placeBot(sim, "p1", far, 0);
		sim.run(1.5);
		expect(entity.targetId).toBe("p1");
		sim.run(1.5);
		expect(entity.targetId).toBeNull();
	});

	it("se capture lanterne ouverte, face à face, à 4 m au plus", () => {
		const { sim, entity } = setup(0);
		sim.run(2);
		prepareCaster(sim, "p1", { lantern: true });
		expect(castAt(sim, "p1", entity).ok).toBe(true);
	});
});

describe("Collecteur", () => {
	it("s'enfuit loin après avoir déposé sa proie, sans revenir la chercher", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 3, 30, 2.4);
		placeBot(sim, "p1", line.origin, line.yaw);
		sim.run(2.2);
		const player = sim.match.players.get("p1") as MatchPlayer;
		player.protectedUntil = 0;
		const entity = installAnomaly(
			sim,
			0,
			"collecteur",
			line.target,
			line.yaw + Math.PI,
		);
		let carried = false;
		let drop: { x: number; z: number } | null = null;
		sim.run(25, () => {
			carried ||= entity.carryingPlayerId === "p1";
			if (carried && !drop && entity.state === "flee") {
				drop = { x: player.position.x, z: player.position.z };
			}
		});
		expect(carried).toBe(true);
		expect(drop).not.toBeNull();
		const from = drop as unknown as { x: number; z: number };
		let farthest = 0;
		let returned = false;
		sim.run(12, () => {
			farthest = Math.max(
				farthest,
				Math.hypot(entity.position.x - from.x, entity.position.z - from.z),
			);
			returned ||= entity.targetId === "p1";
		});
		expect(farthest).toBeGreaterThan(10);
		expect(returned).toBe(false);
		expect(entity.state).not.toBe("flee");
	});
});

describe("Roi de rats", () => {
	function setup() {
		const sim = quietSimulation();
		const line = findClearLine(sim, 3.5, 30, 2.4);
		placeBot(sim, "p1", line.origin, line.yaw);
		sim.run(2.2);
		const player = sim.match.players.get("p1") as MatchPlayer;
		player.protectedUntil = 0;
		const entity = installAnomaly(
			sim,
			0,
			"rat-roi",
			line.target,
			line.yaw + Math.PI,
		);
		return { sim, line, player, entity };
	}

	it("s'éparpille sous la lanterne et mord ceux qui traversent la nuée", () => {
		const { sim, line, player, entity } = setup();
		sim.bot("p1").lantern = true;
		sim.run(0.8);
		expect(entity.state).toBe("special");
		expect(entity.scatter).toBe(1);
		expect(anomalyExtra(entity, sim.match.now)).toBe(1);
		const healthy = player.health;
		const direction = lookDirection(line.yaw, 0);
		placeBot(
			sim,
			"p1",
			{
				x: line.target.x - direction.x * 1.4,
				y: line.target.y,
				z: line.target.z - direction.z * 1.4,
			},
			line.yaw,
		);
		sim.run(1.5);
		expect(player.health).toBeLessThan(healthy);
		expect(entity.state).toBe("special");
	});

	it("se reforme quelques secondes après le retour de l'obscurité", () => {
		const { sim, entity } = setup();
		sim.bot("p1").lantern = true;
		sim.run(0.8);
		sim.bot("p1").lantern = false;
		sim.run(2);
		expect(entity.state).toBe("special");
		expect(entity.scatter).toBe(1);
		sim.run(2.6);
		expect(entity.scatter).toBe(0);
		expect(entity.state).not.toBe("special");
	});

	it("se capture lanterne fermée, même dispersé", () => {
		const { sim, player, entity } = setup();
		sim.bot("p1").lantern = true;
		sim.run(0.8);
		player.protectedUntil = Infinity;
		prepareCaster(sim, "p1", { lantern: false, stillSeconds: 0.4 });
		expect(castAt(sim, "p1", entity).ok).toBe(true);
	});
});

describe("Nuée du Roi de rats", () => {
	it("s'arrête avant les murs et ne mord pas à travers", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 3.5, 30, 2.4);
		const clearance = swarmClearance(
			sim.match.world,
			line.target,
			0,
			RAT_KING_SWARM_RADIUS,
		);
		expect(clearance).toHaveLength(SWARM_DIRECTIONS);
		for (const [index, distance] of clearance.entries()) {
			const angle = (index / SWARM_DIRECTIONS) * Math.PI * 2;
			const end = {
				x: line.target.x + Math.sin(angle) * distance,
				y: line.target.y + 0.3,
				z: line.target.z + Math.cos(angle) * distance,
			};
			expect(
				lineOfSight(
					sim.match.world,
					{ ...line.target, y: line.target.y + 0.3 },
					end,
				),
			).toBe(true);
		}
		expect(Math.min(...clearance)).toBeLessThan(RAT_KING_SWARM_RADIUS);
	});
});
