import { describe, expect, it } from "vitest";
import { canEngage } from "../server/game/ai/dispersal.js";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import { entryWon } from "../shared/challenges.js";
import {
	BOUNTY_PUSH_POINTS,
	bountyValue,
	ENERGY_MAX,
	HEALTH_MAX,
	PUSH_DISTANCE,
	possessedQuota,
} from "../shared/config/index.js";
import { insideGhostBounds } from "../shared/ghost.js";
import {
	defaultPrivateConfig,
	type MatchConfig,
	possessedConfig,
	sanitizeMatchConfig,
} from "../shared/matchConfig.js";
import type { GameEvent, MatchResults } from "../shared/protocol/game.js";
import {
	castAt,
	findClearLine,
	installAnomaly,
	placeBot,
	prepareCaster,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function setup(
	options: {
		players?: number;
		config?: Partial<MatchConfig>;
		teams?: (number | null)[];
	} = {},
): MatchSimulation {
	const sim = new MatchSimulation({
		seed: 4242,
		players: options.players ?? 2,
		config: { events: false, ...options.config },
		teams: options.teams,
	});

	silenceAnomalies(sim);
	sim.run(2.2);

	return sim;
}

function player(sim: MatchSimulation, id: string): MatchPlayer {
	return sim.match.players.get(id) as MatchPlayer;
}

function eventsTo(
	sim: MatchSimulation,
	target: string,
	type: GameEvent["type"],
): GameEvent[] {
	return sim.transport.messages
		.filter(
			(message) =>
				message.event === "game:events" &&
				(message.target === target || message.target === "all"),
		)
		.flatMap((message) => (message.payload as { events: GameEvent[] }).events)
		.filter((event) => event.type === type);
}

function kill(sim: MatchSimulation, id: string): MatchPlayer {
	const victim = player(sim, id);

	victim.protectedUntil = 0;

	sim.match.applyDamage(victim, HEALTH_MAX, "veilleur", null);

	return victim;
}

describe("fantômes", () => {
	it("volent librement mais restent autour du manoir", () => {
		const sim = setup({ players: 1 });
		const ghost = kill(sim, "p1");

		expect(ghost.alive).toBe(false);

		const bot = sim.bot("p1");

		bot.character.y += 1.2;

		sim.run(0.2);
		expect(ghost.position.y).toBeCloseTo(bot.character.y, 3);

		const bounds = sim.match.ghostBounds;

		ghost.position = { x: bounds.maxX - 0.1, y: ghost.position.y, z: 0 };
		bot.character.x = bounds.maxX + 1;
		bot.character.z = 0;

		sim.run(0.1);
		expect(insideGhostBounds(ghost.position, bounds)).toBe(true);

		expect(
			sim.transport.forcedMoves.some((move) => move.kind === "correction"),
		).toBe(true);
	});

	it("frappent pour se faire entendre, avec un temps de recharge", () => {
		const sim = setup({ players: 1 });

		kill(sim, "p1");
		sim.match.handleGhostAction("p1", "knock", -1);
		sim.match.handleGhostAction("p1", "knock", -1);
		sim.run(0.1);
		expect(sim.transport.eventsOfType("poltergeist")).toHaveLength(1);
	});

	it("claquent une porte proche, puis doivent attendre", () => {
		const sim = setup({ players: 1 });
		const ghost = kill(sim, "p1");
		const door = sim.match.doors.doors.find(Boolean);

		if (!door) {
			throw new Error("aucune porte");
		}

		ghost.position = {
			x: door.center.x,
			y: door.center.y - 0.6,
			z: door.center.z,
		};

		const before = door.open;

		sim.match.handleGhostAction("p1", "door", door.id);
		expect(door.open).toBe(!before);
		sim.match.handleGhostAction("p1", "door", door.id);
		expect(door.open).toBe(!before);
	});

	it("ne ramassent rien et n'interagissent pas comme les vivants", () => {
		const sim = setup({ players: 1 });
		const ghost = kill(sim, "p1");
		const pickup = sim.match.layout.pickups[0];

		ghost.position = { x: pickup.x, y: pickup.y - 0.8, z: pickup.z };

		sim.match.handleInteract("p1", { kind: "pickup", id: pickup.id });

		expect(Object.values(ghost.materials).every((count) => count === 0)).toBe(
			true,
		);
	});
});

describe("signaux et émotes", () => {
	it("montre un signal à ses alliés seulement", () => {
		const sim = setup({
			players: 3,
			config: { teamCount: 2 },
			teams: [0, 0, 1],
		});

		const eye = player(sim, "p1").eyePosition();

		sim.match.handlePing("p1", {
			kind: "danger",
			x: eye.x + 2,
			y: eye.y - 1,
			z: eye.z,
			anomalyId: null,
		});

		expect(eventsTo(sim, "p1", "ping")).toHaveLength(1);
		expect(eventsTo(sim, "p2", "ping")).toHaveLength(1);
		expect(eventsTo(sim, "p3", "ping")).toHaveLength(0);
	});

	it("garde ses signaux pour soi sans allié", () => {
		const sim = setup({ players: 2 });
		const eye = player(sim, "p1").eyePosition();

		sim.match.handlePing("p1", { kind: "here", ...eye, anomalyId: null });
		expect(eventsTo(sim, "p1", "ping")).toHaveLength(1);
		expect(eventsTo(sim, "p2", "ping")).toHaveLength(0);
	});

	it("montre les signaux à tous en mode Le Possédé", () => {
		const sim = setup({
			players: 3,
			config: { ...possessedConfig(), events: false },
		});

		const eye = player(sim, "p1").eyePosition();

		sim.match.handlePing("p1", { kind: "danger", ...eye, anomalyId: null });
		expect(eventsTo(sim, "p2", "ping")).toHaveLength(1);
		expect(eventsTo(sim, "p3", "ping")).toHaveLength(1);
	});

	it("refuse un signal trop lointain et limite les rafales", () => {
		const sim = setup({ players: 2, config: { teamCount: 2 }, teams: [0, 0] });
		const eye = player(sim, "p1").eyePosition();

		const ping = () =>
			sim.match.handlePing("p1", { kind: "here", ...eye, anomalyId: null });

		sim.match.handlePing("p1", {
			kind: "here",
			x: eye.x + 500,
			y: eye.y,
			z: eye.z,
			anomalyId: null,
		});

		ping();
		ping();
		expect(eventsTo(sim, "p2", "ping")).toHaveLength(1);
		sim.run(1);
		ping();
		sim.run(1);
		ping();
		sim.run(1);
		ping();
		expect(eventsTo(sim, "p2", "ping")).toHaveLength(3);
		sim.run(4.2);
		ping();
		expect(eventsTo(sim, "p2", "ping")).toHaveLength(4);
	});

	it("réserve les signaux des fantômes aux fantômes alliés", () => {
		const sim = setup({
			players: 3,
			config: { teamCount: 2 },
			teams: [0, 0, 0],
		});

		kill(sim, "p1");
		kill(sim, "p2");

		const eye = player(sim, "p1").eyePosition();

		sim.match.handlePing("p1", { kind: "regroup", ...eye, anomalyId: null });
		expect(eventsTo(sim, "p2", "ping")).toHaveLength(1);
		expect(eventsTo(sim, "p3", "ping")).toHaveLength(0);
	});

	it("diffuse une émote à tout le monde", () => {
		const sim = setup({ players: 2 });

		sim.match.handleEmote("p1", "dance");
		sim.run(0.1);

		expect(sim.transport.eventsOfType("emote")[0]).toMatchObject({
			playerId: "p1",
			emote: "dance",
		});
	});

	it("annule l'émote au moindre mouvement", () => {
		const sim = setup({ players: 2 });

		sim.match.handleEmote("p1", "dance");
		sim.run(0.3);
		expect(player(sim, "p1").emoteUntil).toBeGreaterThan(sim.match.now);

		sim.bot("p1").input.forward = 1;

		sim.run(0.2);

		const stopped = sim.transport.eventsOfType("emote").at(-1);

		expect(stopped).toMatchObject({ playerId: "p1", emote: null });
		expect(player(sim, "p1").emoteUntil).toBeLessThanOrEqual(sim.match.now);
	});

	it("arrête l'émote sur demande", () => {
		const sim = setup({ players: 1 });

		sim.match.handleEmote("p1", "wave");
		sim.match.handleEmote("p1", null);
		sim.run(0.1);

		expect(
			sim.transport.eventsOfType("emote").map((event) => event.emote),
		).toEqual(["wave", null]);
	});
});

describe("dons de fragments", () => {
	it("passe un fragment à un joueur proche", () => {
		const sim = setup({ players: 2 });
		const line = findClearLine(sim, 1.6);

		placeBot(sim, "p1", line.origin, line.yaw);
		placeBot(sim, "p2", line.target, line.yaw + Math.PI);

		const giver = player(sim, "p1");
		const receiver = player(sim, "p2");

		giver.materials.amethyst = 2;

		sim.match.handleGift("p1", "p2", "amethyst");
		expect(giver.materials.amethyst).toBe(1);
		expect(receiver.materials.amethyst).toBe(1);
		sim.run(0.1);
		expect(sim.transport.eventsOfType("gift")).toHaveLength(1);
	});

	it("refuse sans fragment ou à distance", () => {
		const sim = setup({ players: 2 });
		const line = findClearLine(sim, 6);

		placeBot(sim, "p1", line.origin, line.yaw);
		placeBot(sim, "p2", line.target, line.yaw + Math.PI);

		const giver = player(sim, "p1");

		giver.materials.ruby = 1;

		sim.match.handleGift("p1", "p2", "ruby");
		sim.match.handleGift("p1", "p2", "jade");
		expect(giver.materials.ruby).toBe(1);
		expect(player(sim, "p2").materials.ruby).toBe(0);
	});
});

describe("mutateurs", () => {
	it("ne garde que des mutateurs connus, sans doublon", () => {
		const fallback = defaultPrivateConfig();

		expect(
			sanitizeMatchConfig(
				{ ...fallback, mutators: ["noMap", "bogus", "oneLife", "noMap"] },
				fallback,
			).mutators,
		).toEqual(["oneLife", "noMap"]);
	});

	it("une seule vie : on reste fantôme et la partie s'arrête quand tous tombent", () => {
		const sim = setup({ players: 2, config: { mutators: ["oneLife"] } });
		const first = kill(sim, "p1");

		expect(first.respawnAt).toBe(Infinity);
		sim.run(0.2);
		expect(sim.results).toBeUndefined();
		kill(sim, "p2");
		sim.run(0.2);
		expect(sim.results).not.toBeUndefined();
	});

	it("lanternes interdites et énergie infinie", () => {
		const sim = setup({
			players: 1,
			config: { mutators: ["darkness", "infiniteEnergy"] },
		});

		const lone = player(sim, "p1");

		sim.match.handleLantern("p1", true);
		expect(lone.lanternOpen).toBe(false);

		lone.energy = 10;

		sim.run(0.2);
		expect(lone.energy).toBe(ENERGY_MAX);
	});

	it("poussée surpuissante", () => {
		const sim = setup({ players: 1, config: { mutators: ["strongPush"] } });

		expect(sim.match.pushTuning().distance).toBeGreaterThan(PUSH_DISTANCE * 2);
	});
});

describe("événements du manoir", () => {
	function startEvent(sim: MatchSimulation, kind: "bloodMoon" | "lockdown") {
		const events = sim.match.manorEvents;

		events.pending = {
			kind,
			startsAt: sim.match.now,
			endsAt: sim.match.now + 30_000,
		};

		(events as unknown as { rng: unknown }).rng = sim.match.rng.fork("test");

		sim.run(0.1);
	}

	it("annonce puis lance un événement au hasard", () => {
		const sim = setup({ players: 1, config: { events: true } });

		sim.match.manorEvents.nextAt = sim.match.now + 500;

		sim.run(0.2);

		const [warning] = sim.transport.eventsOfType("manorEvent");

		expect(warning).toMatchObject({ phase: "warning" });
		sim.run(9);

		expect(
			sim.transport
				.eventsOfType("manorEvent")
				.some((event) => event.phase === "start"),
		).toBe(true);
	});

	it("la lune rouge double les points des captures", () => {
		const sim = setup({ players: 1, config: { events: true } });

		startEvent(sim, "bloodMoon");

		const line = findClearLine(sim, 3.4);

		placeBot(sim, "p1", line.origin, line.yaw);
		prepareCaster(sim, "p1", { lantern: true });

		const entity = installAnomaly(
			sim,
			0,
			"veilleur",
			line.target,
			line.yaw + Math.PI,
		);

		const result = castAt(sim, "p1", entity);

		expect(result.ok).toBe(true);
		expect(player(sim, "p1").score).toBe(entity.definition.points * 2);
	});

	it("le verrouillage ferme les portes et empêche de les rouvrir", () => {
		const sim = setup({ players: 1, config: { events: true } });
		const door = sim.match.doors.doors.find(Boolean);

		if (!door) {
			throw new Error("aucune porte");
		}

		sim.match.setDoor(door.id, true, null);
		startEvent(sim, "lockdown");
		expect(door.open).toBe(false);
		expect(sim.match.doorsLocked()).toBe(true);
	});
});

describe("prime sur le leader", () => {
	it("désigne le leader largement en tête et récompense qui le pousse", () => {
		const sim = setup({ players: 2 });
		const line = findClearLine(sim, 1.1);

		placeBot(sim, "p2", line.origin, line.yaw);
		placeBot(sim, "p1", line.target, line.yaw);

		const leader = player(sim, "p1");

		leader.score = 400;

		sim.run(0.1);

		expect(sim.transport.eventsOfType("bounty").at(-1)).toMatchObject({
			playerId: "p1",
			value: bountyValue(400),
		});

		sim.match.handlePush("p2", line.yaw);
		expect(player(sim, "p2").score).toBe(BOUNTY_PUSH_POINTS);

		const value = sim.match.bounty.value;

		kill(sim, "p1");
		expect(player(sim, "p2").score).toBe(BOUNTY_PUSH_POINTS + value);
		sim.run(0.1);

		expect(
			sim.transport.eventsOfType("bountyReward").map((event) => event.reason),
		).toEqual(["push", "claim"]);
	});

	it("n'existe pas en équipes", () => {
		const sim = setup({ players: 2, config: { teamCount: 2 }, teams: [0, 1] });

		player(sim, "p1").score = 900;

		sim.run(0.2);
		expect(sim.transport.eventsOfType("bounty")).toHaveLength(0);
	});
});

describe("mode Le Possédé", () => {
	function possessedSim(): MatchSimulation {
		return setup({
			players: 3,
			config: { ...possessedConfig(), events: false },
		});
	}

	it("ne s'active que depuis son mode, jamais par les règles", () => {
		const classic = defaultPrivateConfig();

		expect(
			sanitizeMatchConfig({ ...classic, mode: "possessed" }, classic).mode,
		).toBe("classic");

		const possessed = possessedConfig();

		const kept = sanitizeMatchConfig(
			{ ...possessed, mode: "classic", teamCount: 2, bounty: true },
			possessed,
		);

		expect(kept).toMatchObject({
			mode: "possessed",
			teamCount: 0,
			bounty: false,
		});
	});

	it("désigne un possédé que les anomalies épargnent", () => {
		const sim = possessedSim();
		const system = sim.match.possessed;

		if (!system) {
			throw new Error("mode absent");
		}

		const roles = sim.transport.messages.filter(
			(message) => message.event === "game:role",
		);

		expect(roles).toHaveLength(3);

		expect(
			roles.filter(
				(message) => (message.payload as { role: string }).role === "possessed",
			),
		).toHaveLength(1);

		const possessed = player(sim, system.possessedId);

		expect(sim.match.applyDamage(possessed, 40, "veilleur", null)).toBe(false);
		expect(possessed.health).toBe(HEALTH_MAX);

		const entity = installAnomaly(sim, 0, "murmure", possessed.position);

		expect(canEngage(sim.match, entity, possessed)).toBe(false);
	});

	it("lance le vote une fois le rituel accompli et démasque le possédé", () => {
		const sim = possessedSim();
		const system = sim.match.possessed;

		if (!system) {
			throw new Error("mode absent");
		}

		expect(system.quota).toBe(possessedQuota(2));

		for (let capture = 0; capture < system.quota; capture += 1) {
			system.onCapture(sim.match);
		}

		expect(sim.match.phase).toBe("voting");

		const hunters = [...sim.match.players.keys()].filter(
			(id) => id !== system.possessedId,
		);

		for (const hunter of hunters) {
			sim.match.handleVote(hunter, system.possessedId);
		}

		sim.match.handleVote(system.possessedId, hunters[0]);
		sim.run(0.1);

		const results = sim.results as MatchResults;

		expect(results.possessed).toMatchObject({
			winner: "hunters",
			unmasked: true,
			quotaReached: true,
		});

		const entry = (id: string) =>
			results.entries.find(
				(candidate) => candidate.playerId === id,
			) as MatchResults["entries"][number];

		expect(entryWon(results, entry(hunters[0]))).toBe(true);
		expect(entryWon(results, entry(system.possessedId))).toBe(false);
	});

	it("donne la victoire au possédé si le temps manque", () => {
		const sim = possessedSim();

		sim.match.endsAt = sim.match.now + 100;

		sim.run(0.3);

		const results = sim.results as MatchResults;

		expect(results.possessed?.winner).toBe("possessed");
		expect(results.winnerId).toBeNull();
	});

	it("profane un autel pour empêcher d'y fabriquer", () => {
		const sim = possessedSim();
		const system = sim.match.possessed;
		const altar = sim.match.layout.altars[0];

		if (!system || !altar) {
			throw new Error("mode ou autel absent");
		}

		const possessed = player(sim, system.possessedId);

		possessed.position = { x: altar.x + 0.8, y: altar.y, z: altar.z };

		sim.match.handlePower(system.possessedId, {
			altarId: altar.id,
			x: altar.x,
			y: altar.y,
			z: altar.z,
		});

		expect(sim.match.altarCursed(altar.id)).toBe(true);

		possessed.materials.amethyst = 2;
		possessed.materials.brass = 1;

		sim.match.handleCraft(system.possessedId, altar.id, "pendulum");
		expect(possessed.objects.pendulum).toBe(0);
	});
});
