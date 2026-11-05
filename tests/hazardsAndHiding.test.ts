import { describe, expect, it } from "vitest";
import { MatchPlayer } from "../server/game/MatchPlayer.js";
import {
	ballisticVelocity,
	projectilePosition,
} from "../server/game/systems/hazards.js";
import {
	ARCHIVIST_PULSE_TELEGRAPH_MS,
	EYE_HEIGHT_STANDING,
	HIDE_EXTRACTION_RANGE,
	SLIME_PUDDLE_DAMAGE,
	SLIME_PUDDLE_DURATION_MS,
	VOICE_AUDIBLE_LEVEL,
} from "../shared/config/index.js";
import type { Room } from "../shared/manor/types.js";
import {
	findClearLine,
	installAnomaly,
	placeBot,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function quietSimulation(players = 1): MatchSimulation {
	const sim = new MatchSimulation({ seed: 4242, players });
	silenceAnomalies(sim);
	return sim;
}

describe("flaques de slime", () => {
	it("ralentissent au contact du sol seulement et expirent après 15 s", () => {
		const sim = quietSimulation();
		const player = sim.match.players.get("p1") as MatchPlayer;
		sim.run(0.5);
		const puddle = sim.match.hazards.addPuddle(
			{ ...player.position },
			sim.match.now,
		);
		expect(sim.match.hazards.isOnSlime(player)).toBe(true);
		player.grounded = false;
		expect(sim.match.hazards.isOnSlime(player)).toBe(false);
		player.grounded = true;
		const jumping = new MatchPlayer(
			"j",
			"Sauteur",
			0,
			{ x: puddle.x, y: puddle.y + 0.8, z: puddle.z, yaw: 0 },
			0,
		);
		jumping.grounded = true;
		expect(sim.match.hazards.isOnSlime(jumping)).toBe(false);
		expect(
			sim.match.hazards.expirePuddles(
				sim.match.now + SLIME_PUDDLE_DURATION_MS - 1,
			),
		).toHaveLength(0);
		expect(
			sim.match.hazards.expirePuddles(sim.match.now + SLIME_PUDDLE_DURATION_MS),
		).toHaveLength(1);
		expect(sim.match.hazards.puddles).toHaveLength(0);
	});

	it("rongent un peu la vie sans interrompre une incantation", () => {
		const sim = quietSimulation();
		const player = sim.match.players.get("p1") as MatchPlayer;
		sim.run(0.5);
		player.protectedUntil = 0;
		player.casting = { since: sim.match.now };
		sim.match.hazards.addPuddle({ ...player.position }, sim.match.now);
		sim.run(3.2);
		expect(player.health).toBe(100 - SLIME_PUDDLE_DAMAGE * 3);
		expect(player.casting).not.toBeNull();
		const damages = sim.transport.eventsOfType("damage");
		expect(damages).toHaveLength(3);
		expect(
			damages.every((event) => event.periodic && event.source === "suinteur"),
		).toBe(true);
	});

	it("suivent une trajectoire balistique réelle jusqu'au point visé", () => {
		const from = { x: 0, y: 1.2, z: 0 };
		const to = { x: 6, y: 0, z: 3 };
		const gravity = 9;
		const velocity = ballisticVelocity(from, to, 7, gravity);
		const flight = Math.hypot(6, 3) / 7;
		const projectile = {
			id: 1,
			kind: "slime" as const,
			origin: from,
			velocity,
			gravity,
			launchedAt: 1000,
			ownerId: 0,
			previous: from,
		};
		const landing = projectilePosition(projectile, 1000 + flight * 1000);
		expect(landing.x).toBeCloseTo(6, 3);
		expect(landing.z).toBeCloseTo(3, 3);
		expect(landing.y).toBeCloseTo(0, 3);
		const apex = projectilePosition(projectile, 1000 + flight * 500);
		expect(apex.y).toBeGreaterThan(from.y * 0.5);
	});

	it("un projectile lancé contre un mur s'arrête sur le mur", () => {
		const sim = quietSimulation();
		const room = sim.match.layout.rooms.find(
			(candidate) => candidate.level === 0 && candidate.type !== "stairwell",
		) as Room;
		const inside = {
			x: room.labelPoint.x,
			y: room.floorY + 1.2,
			z: room.labelPoint.z,
		};
		const far = { x: inside.x + 80, y: inside.y, z: inside.z };
		const projectile = sim.match.hazards.launch(
			"ember",
			inside,
			{ x: 20, y: 0, z: 0 },
			0,
			sim.match.now,
			0,
		);
		let outcome = null;
		for (let step = 1; step < 100 && !outcome; step += 1) {
			outcome =
				sim.match.hazards.stepProjectiles([], sim.match.now + step * 50)[0] ??
				null;
		}
		expect(outcome).not.toBeNull();

		if (!outcome) {
			throw new Error("No outcome produced for projectile.");
		}

		expect(outcome.projectile.id).toBe(projectile.id);
		expect(outcome.at.x).toBeLessThan(far.x);
		expect(outcome.at.x - inside.x).toBeLessThan(
			Math.max(room.bounds.maxX - room.bounds.minX, 1) + 1.5,
		);
	});
});

describe("cachettes", () => {
	function hideScenario(watched: boolean, distance: number) {
		const sim = quietSimulation();
		const spot = sim.match.layout.hideSpots.find((candidate) => {
			const furniture = sim.match.layout.furniture[candidate.furnitureId];
			return (
				furniture.level === 0 &&
				sim.match.grid.nearestNode(
					{ x: candidate.entry.x, y: furniture.y, z: candidate.entry.z },
					0,
				) !== null
			);
		});

		if (!spot) {
			throw new Error("No suitable hide spot found for the test.");
		}

		const furniture = sim.match.layout.furniture[spot.furnitureId];
		const entry = { x: spot.entry.x, y: furniture.y, z: spot.entry.z };
		placeBot(sim, "p1", entry, spot.facing);
		const away = {
			x: entry.x - Math.sin(spot.facing) * distance,
			y: entry.y,
			z: entry.z - Math.cos(spot.facing) * distance,
		};
		const entity = installAnomaly(sim, 0, "veilleur", away);
		if (watched) {
			const memory = entity.memoryFor("p1");
			memory.awareness = 1;
			memory.visibleNow = true;
			memory.lastSeenAt = sim.match.now;
			memory.lastSeenPosition = { ...entry };
		}
		sim.match.handleInteract("p1", { kind: "hide", id: spot.id });
		return {
			sim,
			spot,
			entity,
			player: sim.match.players.get("p1") as MatchPlayer,
		};
	}

	it("cache réellement le joueur à l'intérieur du meuble", () => {
		const { sim, spot, player } = hideScenario(false, 6);
		expect(player.hiddenSpot).toBe(spot.id);
		expect(player.active).toBe(false);
		expect(
			Math.hypot(
				player.position.x - spot.interior.x,
				player.position.z - spot.interior.z,
			),
		).toBeLessThan(0.05);
		expect(sim.transport.forcedMoves.some((move) => move.kind === "hide")).toBe(
			true,
		);
		sim.match.handleInteract("p1", { kind: "unhide", id: spot.id });
		expect(player.hidden).toBe(false);
		expect(
			sim.match.world.regionAt(
				{ x: player.position.x, z: player.position.z },
				player.position.y,
			),
		).not.toBeNull();
	});

	it("une anomalie qui a vu le joueur entrer de près s'en souvient", () => {
		const { entity } = hideScenario(true, HIDE_EXTRACTION_RANGE - 0.8);
		expect(entity.witnessed).not.toBeNull();
	});

	it("aucune extraction sans observation récente", () => {
		const { entity } = hideScenario(false, HIDE_EXTRACTION_RANGE - 0.8);
		expect(entity.witnessed).toBeNull();
	});

	it("aucune extraction si l'anomalie était trop loin", () => {
		const { entity } = hideScenario(true, HIDE_EXTRACTION_RANGE + 2.5);
		expect(entity.witnessed).toBeNull();
	});

	it("une anomalie qui entend le joueur caché le sort de sa cachette", () => {
		const { sim, player } = hideScenario(false, HIDE_EXTRACTION_RANGE - 0.8);
		sim.bot("p1").voiceLevel = 0.8;
		sim.run(4);
		expect(
			sim.transport
				.eventsOfType("extractWarning")
				.some((event) => event.playerId === "p1"),
		).toBe(true);
		expect(
			sim.transport.forcedMoves.some((move) => move.kind === "extract"),
		).toBe(true);
		expect(player.hidden).toBe(false);
	});

	it("les bruits faibles du micro ne trahissent pas le joueur caché", () => {
		const { sim, entity, player } = hideScenario(
			false,
			HIDE_EXTRACTION_RANGE - 0.8,
		);
		sim.bot("p1").voiceLevel = VOICE_AUDIBLE_LEVEL - 0.05;
		sim.run(4);
		expect(entity.witnessed).toBeNull();
		expect(sim.transport.eventsOfType("extractWarning")).toHaveLength(0);
		expect(player.hidden).toBe(true);
	});
});

describe("Archiviste", () => {
	it("attire les joueurs de sa salle et télégraphie ses pulsations", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 3.2, 32);
		placeBot(sim, "p1", line.target, line.yaw);
		const entity = installAnomaly(sim, 0, "archiviste", line.origin);
		entity.homeRoom = line.roomId;
		entity.nextPulseAt = sim.match.now + 400;
		const player = sim.match.players.get("p1") as MatchPlayer;
		const pull = sim.match.pullOn(player);
		expect(Math.hypot(pull.x, pull.z)).toBeGreaterThan(0.5);
		const room = sim.match.layout.rooms[line.roomId];
		const toCenter = {
			x: room.labelPoint.x - player.position.x,
			z: room.labelPoint.z - player.position.z,
		};
		expect(pull.x * toCenter.x + pull.z * toCenter.z).toBeGreaterThan(0);
		sim.run(0.6);
		const charge = sim.transport
			.eventsOfType("pulse")
			.find((event) => event.phase === "charge");
		expect(charge).toBeDefined();
		if (!charge) {
			throw new Error("No charge event found");
		}
		const chargeIndex = sim.transport.events.indexOf(charge);
		expect(
			sim.transport.events
				.slice(chargeIndex)
				.some((event) => event.type === "pulse" && event.phase === "release"),
		).toBe(false);
		sim.run(ARCHIVIST_PULSE_TELEGRAPH_MS / 1000 + 0.2);
		expect(
			sim.transport
				.eventsOfType("pulse")
				.some((event) => event.phase === "release"),
		).toBe(true);
	});
});

describe("réseau", () => {
	it("ignore les états clients anciens ou dupliqués", () => {
		const sim = quietSimulation();
		sim.run(0.5);
		const player = sim.match.players.get("p1") as MatchPlayer;
		const bot = sim.bot("p1");
		const position = { ...player.position };
		sim.match.handleClientState("p1", {
			seq: bot.seq - 3,
			x: position.x + 0.5,
			y: position.y,
			z: position.z,
			yaw: 0,
			pitch: 0,
			vx: 0,
			vy: 0,
			vz: 0,
			grounded: true,
			crouch: 0,
			sprint: false,
			moveInput: true,
			grimoire: false,
			voiceLevel: 0,
			voicePeakMs: 0,
			held: -1,
			moveAck: bot.moveAck,
		});
		expect(player.position).toEqual(position);
	});

	it("ne compte jamais deux fois la même capture", () => {
		const sim = quietSimulation();
		const line = findClearLine(sim, 3.4);
		placeBot(sim, "p1", line.origin, line.yaw);
		const bot = sim.bot("p1");
		bot.lantern = true;
		bot.voiceLevel = 0.3;
		bot.voicePeakMs = 50;
		sim.run(1.6);
		const entity = installAnomaly(
			sim,
			0,
			"veilleur",
			line.target,
			line.yaw + Math.PI,
		);
		const center = entity.center();
		const eyeY = bot.character.y + EYE_HEIGHT_STANDING;
		const dx = center.x - bot.character.x;
		const dz = center.z - bot.character.z;
		const aimYaw = Math.atan2(-dx, -dz);
		const aimPitch = Math.atan2(center.y - eyeY, Math.hypot(dx, dz));
		bot.input.yaw = aimYaw;
		bot.pitch = aimPitch;
		sim.run(0.1);
		const request = {
			transcripts: [entity.formula.join(" ")],
			method: "speech" as const,
		};
		sim.match.handleCastBegin("p1");
		sim.match.handleCast("p1", request);
		sim.match.handleCastBegin("p1");
		sim.match.handleCast("p1", request);
		sim.run(0.1);
		expect(sim.transport.eventsOfType("capture")).toHaveLength(1);
		expect(sim.match.players.get("p1") as MatchPlayer).toHaveProperty(
			"score",
			entity.definition.points,
		);
	});
});
