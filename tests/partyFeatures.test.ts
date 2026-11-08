import { describe, expect, it } from "vitest";
import { type PlayerStats, pickAwards } from "../server/game/awards.js";
import {
	HIGHLIGHT_LEAD_MS,
	HIGHLIGHT_TAIL_MS,
} from "../server/game/highlights.js";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import { applyClientState } from "../server/game/systems/playerMotion.js";
import { parseClientState } from "../server/net/validation.js";
import { type MatchMetrics, withMatchMetrics } from "../shared/challenges.js";
import {
	ANOMALY_FIRST_SPAWN_DELAY_MS,
	CAMERA_RETURN_MS,
	cameraCount,
	FALL_FRAGMENT_LOSS,
	HEALTH_MAX,
	MATERIAL_IDS,
	OCCULT_IDS,
	PACT_HEALTH_COST,
	RELIQUARY_FRAGMENTS,
	STAKE_KINDS,
	WALKIE_RETURN_MS,
	walkieCount,
} from "../shared/config/index.js";
import {
	DAILY_THEMES,
	dailyChallenge,
	dailyDateKey,
} from "../shared/dailyChallenge.js";
import { BREW_DURATION_MS, CAULDRON_BREWS } from "../shared/manor/brews.js";
import {
	generateManor,
	layoutChecksum,
} from "../shared/manor/generateManor.js";
import { liquidAt, liquidVolumes } from "../shared/manor/liquids.js";
import {
	defaultPrivateConfig,
	matchDurationMs,
	PUBLIC_MATCH_CONFIG,
	sanitizeMatchConfig,
	TUTORIAL_MATCH_CONFIG,
} from "../shared/matchConfig.js";
import { type MatchResults, PLAYER_FLAG } from "../shared/protocol/game.js";
import {
	hatUnlocked,
	lanternUnlocked,
	newlyUnlocked,
	type ProgressStats,
} from "../shared/rewards.js";
import { VoiceTimeline } from "../shared/voiceTimeline.js";
import { silenceAnomalies } from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function playerOf(sim: MatchSimulation, id = "p1"): MatchPlayer {
	return sim.match.players.get(id) as MatchPlayer;
}

function standAt(
	player: MatchPlayer,
	spot: { x: number; y: number; z: number },
) {
	player.position = { x: spot.x, y: spot.y, z: spot.z + 0.6 };
	player.roomId = null;
}

describe("talkies-walkies", () => {
	it("place des talkies selon le nombre de joueurs, rien dans le tutoriel", () => {
		expect(walkieCount(1)).toBe(2);
		expect(walkieCount(4)).toBe(2);
		expect(walkieCount(8)).toBe(4);
		const layout = generateManor(77, PUBLIC_MATCH_CONFIG);
		expect(layout.walkies.length).toBeGreaterThanOrEqual(4);
		expect(generateManor(77, TUTORIAL_MATCH_CONFIG).walkies).toHaveLength(0);
		expect(layoutChecksum(layout)).toBe(
			layoutChecksum(generateManor(77, PUBLIC_MATCH_CONFIG)),
		);
	});

	it("prend, transmet et attire les monstres vers celui qui reçoit", () => {
		const sim = new MatchSimulation({ seed: 77, players: 2 });
		const [first, second] = sim.match.layout.walkies;
		const a = playerOf(sim, "p1");
		const b = playerOf(sim, "p2");
		standAt(a, first);
		sim.match.handleInteract("p1", { kind: "walkie", id: first.id });
		standAt(b, second);
		sim.match.handleInteract("p2", { kind: "walkie", id: second.id });
		expect(a.walkie).toBe(first.id);
		expect(b.walkie).toBe(second.id);
		sim.match.handleRadio("p1", true);
		expect(a.flags(sim.match.now) & PLAYER_FLAG.radio).not.toBe(0);
		a.recordVoice({ t: sim.match.now, level: 0.9, activeMs: 100 });
		sim.match.walkies.update(sim.match);
		const heard = sim.match.sounds.filter(
			(sound) => sound.kind === "voice" && sound.playerId === "p2",
		);
		expect(heard.length).toBeGreaterThan(0);
		expect(heard[0].position).toMatchObject({
			x: b.position.x,
			z: b.position.z,
		});
	});

	it("refuse d'émettre sans talkie et le rend à sa place après une mort", () => {
		const sim = new MatchSimulation({ seed: 77, players: 1 });
		const player = playerOf(sim);
		sim.match.handleRadio("p1", true);
		expect(player.radioOn).toBe(false);
		const spot = sim.match.layout.walkies[0];
		standAt(player, spot);
		sim.match.handleInteract("p1", { kind: "walkie", id: spot.id });
		player.protectedUntil = 0;
		player.lastDamageAt = -Infinity;
		sim.match.applyDamage(player, HEALTH_MAX, "fall", null);
		expect(player.walkie).toBe(-1);
		sim.run(WALKIE_RETURN_MS / 1000 + 0.5);
		expect(sim.transport.eventsOfType("walkie").at(-1)).toMatchObject({
			id: spot.id,
			available: true,
		});
	});
});

describe("appareil photo", () => {
	it("en pose ailleurs que les talkies, sauf dans le tutoriel", () => {
		expect(cameraCount(1)).toBe(1);
		expect(cameraCount(8)).toBe(4);
		for (const seed of [11, 77, 2024]) {
			const layout = generateManor(seed, PUBLIC_MATCH_CONFIG);
			expect(layout.cameras.length).toBeGreaterThanOrEqual(4);
			const walkieRooms = new Set(layout.walkies.map((spot) => spot.roomId));
			expect(
				layout.cameras
					.slice(0, 4)
					.every((spot) => !walkieRooms.has(spot.roomId)),
			).toBe(true);
		}
		const tutorial = new MatchSimulation({
			seed: 77,
			players: 1,
			tutorial: true,
		});
		expect(tutorial.match.initPayload().cameraTotal).toBe(0);
	});

	it("montre aux autres l'appareil levé, seulement chez qui en tient un", () => {
		const sim = new MatchSimulation({ seed: 77, players: 1 });
		const player = playerOf(sim);
		const raise = (seq: number) => {
			const message = parseClientState({
				seq,
				x: player.position.x,
				y: player.position.y,
				z: player.position.z,
				yaw: 0,
				pitch: 0,
				vx: 0,
				vy: 0,
				vz: 0,
				grounded: true,
				crouch: 0,
				sprint: false,
				moveInput: false,
				grimoire: false,
				camera: true,
				voiceLevel: 0,
				voicePeakMs: 0,
				held: -1,
				moveAck: 0,
				jumps: 0,
			});
			if (!message) {
				throw new Error("message refusé");
			}
			applyClientState(sim.match, player, message);
			return (player.flags(sim.match.now) & PLAYER_FLAG.camera) !== 0;
		};
		expect(raise(1_000)).toBe(false);
		const spot = sim.match.layout.cameras[0];
		standAt(player, spot);
		sim.match.handleInteract("p1", { kind: "camera", id: spot.id });
		expect(raise(1_001)).toBe(true);
	});

	it("annonce dans chaque image les objets portés, que les meilleurs moments rejouent", () => {
		const sim = new MatchSimulation({ seed: 77, players: 1 });
		const player = playerOf(sim);
		const now = sim.match.now;
		expect(player.snapshot(now).held).toBeUndefined();
		player.held = "pendulum";
		expect(player.snapshot(now).held).toBeUndefined();
		player.objects.pendulum = 1;
		expect(player.snapshot(now).held).toBe(OCCULT_IDS.indexOf("pendulum"));
		player.walkie = 0;
		player.camera = 0;
		const flags = player.snapshot(now).flags;
		expect(flags & PLAYER_FLAG.walkieHeld).not.toBe(0);
		expect(flags & PLAYER_FLAG.cameraHeld).not.toBe(0);
		expect(flags & PLAYER_FLAG.camera).toBe(0);
	});

	it("se ramasse une fois par joueur et revient à sa place après une mort", () => {
		const sim = new MatchSimulation({ seed: 77, players: 1 });
		const player = playerOf(sim);
		const spot = sim.match.layout.cameras[0];
		standAt(player, spot);
		sim.match.handleInteract("p1", { kind: "camera", id: spot.id });
		expect(player.camera).toBe(spot.id);
		sim.run(0.1);
		expect(sim.transport.eventsOfType("camera").at(-1)).toMatchObject({
			id: spot.id,
			holder: "p1",
		});
		player.protectedUntil = 0;
		player.lastDamageAt = -Infinity;
		sim.match.applyDamage(player, HEALTH_MAX, "fall", null);
		expect(player.camera).toBe(-1);
		sim.run(CAMERA_RETURN_MS / 1000 + 0.5);
		expect(sim.transport.eventsOfType("camera").at(-1)).toMatchObject({
			id: spot.id,
			available: true,
		});
	});
});

describe("chaudrons et liquides", () => {
	it("repère les pieds dans un récipient, même tourné, mais pas sur son bord", () => {
		const cauldron = {
			id: 4,
			kind: "cauldron",
			variant: 0,
			roomId: 0,
			level: 0,
			x: 2,
			y: 0,
			z: 3,
			rotation: Math.PI / 4,
			width: 1,
			depth: 1,
			height: 0.85,
			colliders: [],
			hideSpotId: null,
			valveId: null,
			parentId: null,
			seed: 3,
		} as const;
		const [volume] = liquidVolumes([{ ...cauldron, colliders: [] }]);
		expect(volume.brew).toBe(CAULDRON_BREWS[3]);
		expect(liquidAt([volume], { x: 2, y: 0.14, z: 3 })).toBe(volume);
		expect(liquidAt([volume], { x: 2, y: 0.85, z: 3 })).toBeNull();
		expect(liquidAt([volume], { x: 2.6, y: 0.14, z: 3 })).toBeNull();
	});

	it("donne l'effet en entrant, pas en restant, et l'efface à la réapparition", () => {
		const sim = new MatchSimulation({ seed: 77, players: 1 });
		silenceAnomalies(sim);
		const player = playerOf(sim);
		const { x, y, z } = player.position;
		const haste = CAULDRON_BREWS.find(({ effect }) => effect === "haste");
		sim.match.liquids.push({
			itemId: 9_999,
			kind: "cauldron",
			x,
			z,
			rotation: 0,
			halfWidth: 0.4,
			halfDepth: 0.4,
			elliptic: false,
			floorY: y - 0.1,
			surfaceY: y + 0.6,
			brew: haste ?? null,
		});
		sim.run(0.2);
		expect(player.brew).toBe("haste");
		expect(player.brewUntil - sim.match.now).toBeLessThanOrEqual(
			BREW_DURATION_MS.haste,
		);
		const events = () => sim.transport.eventsOfType("brew").length;
		expect(events()).toBe(1);
		sim.run(1);
		expect(events()).toBe(1);
		player.position = { x: x + 3, y, z };
		sim.run(0.2);
		player.position = { x, y, z };
		sim.run(0.2);
		expect(events()).toBe(2);
		player.position = { x: x + 3, y, z };
		sim.run(BREW_DURATION_MS.haste / 1000 + 0.5);
		expect(player.brew).toBeNull();
	});
});

describe("salles à enjeu", () => {
	it("répartit les trois marchés dans chaque manoir", () => {
		for (const seed of [11, 77, 2024]) {
			const kinds = new Set(
				generateManor(seed, PUBLIC_MATCH_CONFIG).stakes.map(
					(stake) => stake.kind,
				),
			);
			expect([...kinds].sort()).toEqual([...STAKE_KINDS].sort());
		}
		expect(generateManor(11, TUTORIAL_MATCH_CONFIG).stakes).toHaveLength(0);
	});

	it("garde les trois marchés même dans un petit manoir de plain-pied", () => {
		for (const seed of [3, 11, 77, 2024, 4096]) {
			const kinds = new Set(
				generateManor(seed, {
					...PUBLIC_MATCH_CONFIG,
					manorSize: "small",
					floors: 0,
				}).stakes.map((stake) => stake.kind),
			);
			expect(kinds.size, `graine ${seed}`).toBe(STAKE_KINDS.length);
		}
	});

	function stakeSim(kind: (typeof STAKE_KINDS)[number]) {
		const sim = new MatchSimulation({ seed: 77, players: 1 });
		sim.run(1);
		const stake = sim.match.layout.stakes.find((entry) => entry.kind === kind);
		if (!stake) {
			throw new Error(`Pas de salle ${kind}`);
		}
		const player = playerOf(sim);
		player.protectedUntil = 0;
		standAt(player, stake);
		return { sim, stake, player };
	}

	it("le reliquaire donne des fragments et tient compte du repos", () => {
		const { sim, stake, player } = stakeSim("reliquary");
		const count = () =>
			Object.values(player.materials).reduce((sum, value) => sum + value, 0);
		sim.match.handleInteract("p1", { kind: "stake", id: stake.id });
		expect(count()).toBe(RELIQUARY_FRAGMENTS);
		sim.match.handleInteract("p1", { kind: "stake", id: stake.id });
		expect(count()).toBe(RELIQUARY_FRAGMENTS);
	});

	it("le pacte coûte de la vie contre un objet occulte, et peut tuer", () => {
		const { sim, stake, player } = stakeSim("pact");
		const objects = () =>
			Object.values(player.objects).reduce((sum, value) => sum + value, 0);
		sim.match.handleInteract("p1", { kind: "stake", id: stake.id });
		expect(player.health).toBe(HEALTH_MAX - PACT_HEALTH_COST);
		expect(objects()).toBe(1);
		sim.clock.advance(61_000);
		player.health = 30;
		sim.match.handleInteract("p1", { kind: "stake", id: stake.id });
		expect(player.alive).toBe(false);
		sim.run(0.1);
		expect(sim.transport.eventsOfType("death").at(-1)?.cause).toBe("pact");
		expect(objects()).toBe(2);
	});

	it("refuse le pacte tant que le joueur est protégé", () => {
		const { sim, stake, player } = stakeSim("pact");
		player.protectedUntil = sim.match.now + 5000;
		sim.match.handleInteract("p1", { kind: "stake", id: stake.id });
		expect(player.health).toBe(HEALTH_MAX);
		expect(Object.values(player.objects).every((value) => value === 0)).toBe(
			true,
		);
	});

	it("le sanctuaire soigne ceux qui sont dans la salle", () => {
		const { sim, stake, player } = stakeSim("sanctuary");
		player.health = 40;
		player.roomId = stake.roomId;
		sim.match.handleInteract("p1", { kind: "stake", id: stake.id });
		sim.match.stakes.update(sim.match, 1);
		expect(player.health).toBeGreaterThan(40);
	});
});

function endMatch(sim: MatchSimulation): MatchResults {
	sim.run((sim.match.endsAt - sim.match.now) / 1000 + 0.2);
	const end = sim.transport.messages.find(
		(entry) => entry.event === "game:end",
	);
	return end?.payload as MatchResults;
}

describe("meilleurs moments", () => {
	it("retient une grosse chute et la rejoue avec les images autour", () => {
		const sim = new MatchSimulation({
			seed: 77,
			players: 2,
			config: { durationMinutes: 3 },
		});
		sim.run(10);
		const player = playerOf(sim);
		player.protectedUntil = 0;
		sim.match.applyFallDamage(player, 30, 6.5);
		const results = endMatch(sim);
		const fall = results.highlights.find((clip) => clip.kind === "fall");
		expect(fall).toBeDefined();
		expect(fall?.playerId).toBe("p1");
		expect(fall?.value).toBe(6.5);
		expect(fall?.frames.length).toBeGreaterThan(50);
		expect(fall?.frames[0].players[0]).toHaveProperty("v");
		expect(results.highlights.length).toBeLessThanOrEqual(3);
	});

	it("repère le joueur qui hurle pendant une poursuite", () => {
		const sim = new MatchSimulation({
			seed: 77,
			players: 1,
			config: { durationMinutes: 3 },
		});
		sim.run(ANOMALY_FIRST_SPAWN_DELAY_MS / 1000 + 5);
		const chaser = sim.match.anomalies.find((entity) => entity.active);
		if (!chaser) {
			throw new Error("Aucune anomalie active");
		}
		const player = playerOf(sim);
		const frames = 15;
		for (let index = 0; index < frames; index += 1) {
			const now = sim.match.now + 100;
			sim.match.now = now;
			player.recordVoice({ t: now, level: 0.95, activeMs: 100 });
			sim.match.highlights?.frame(
				{
					tick: 100000 + index,
					t: now,
					remainingMs: 1000,
					players: [player.snapshot(now)],
					anomalies: [
						{
							...chaser.snapshot(now, 0),
							target: "p1",
							state: 5,
						},
					],
				},
				sim.match,
			);
		}
		const kinds = sim.match.highlights?.finish().map((clip) => clip.kind);
		expect(kinds).toContain("scream");
	});

	it("ne garde pas deux fois le même instant pour le même joueur", () => {
		const sim = new MatchSimulation({
			seed: 77,
			players: 1,
			config: { durationMinutes: 3 },
		});
		sim.run(10);
		const player = playerOf(sim);
		player.protectedUntil = 0;
		sim.match.applyFallDamage(player, 10, 3);
		sim.match.applyDamage(player, 0, "fall", null, true);
		sim.match.highlights?.fall("p1", 9, false, sim.match);
		sim.run(5);
		const clips = sim.match.highlights?.finish() ?? [];
		expect(clips.filter((clip) => clip.kind === "fall")).toHaveLength(1);
		expect(clips.find((clip) => clip.kind === "fall")?.value).toBe(9);
	});

	it("n'enregistre rien dans le tutoriel", () => {
		const sim = new MatchSimulation({
			seed: 2024,
			players: 1,
			tutorial: true,
			config: TUTORIAL_MATCH_CONFIG,
		});
		expect(sim.match.highlights).toBeNull();
	});
});

describe("voix des meilleurs moments", () => {
	const block = (value: number, length = 1600) =>
		new Int16Array(length).fill(value);

	it("enchaîne les blocs malgré le jeu de l'arrivée et ne garde pas les blancs", () => {
		const voice = new VoiceTimeline();
		voice.push(block(8000), 1100);
		voice.push(block(8000), 1215);
		voice.push(block(0), 1290);
		expect(voice.chunkCount).toBe(2);
		const samples = voice.extract(1000, 1300) as Float32Array;
		expect(samples).toHaveLength(4800);
		expect(samples[0]).toBeCloseTo(8000 / 32768);
		expect(samples[3199]).toBeCloseTo(8000 / 32768);
		expect(samples[3200]).toBe(0);
	});

	it("rend null quand personne n'a parlé", () => {
		const voice = new VoiceTimeline();
		voice.push(block(10), 1100);
		expect(voice.extract(1000, 1200)).toBeNull();
	});

	it("oublie ce qui est vieux sauf les périodes à garder", () => {
		const voice = new VoiceTimeline();
		voice.push(block(9000), 1000);
		voice.push(block(9000), 50_000);
		voice.push(block(9000), 100_000);
		voice.trim(100_100, [{ from: 49_000, to: 51_000 }]);
		expect(voice.chunkCount).toBe(2);
		expect(voice.extract(800, 1100)).toBeNull();
		expect(voice.extract(49_800, 50_100)).not.toBeNull();
		voice.clear();
		expect(voice.chunkCount).toBe(0);
	});

	it("annonce les périodes à garder sans jamais transmettre de son", () => {
		const sim = new MatchSimulation({
			seed: 77,
			players: 1,
			config: { durationMinutes: 3 },
		});
		sim.run(10);
		const player = playerOf(sim);
		player.protectedUntil = 0;
		sim.match.applyFallDamage(player, 10, 5);
		const fellAt = sim.match.now;
		sim.run(2);
		const announced = sim.transport.eventsOfType("voiceWindows");
		expect(announced).toHaveLength(1);
		expect(announced[0].windows).toEqual([
			{
				from: fellAt - HIGHLIGHT_LEAD_MS,
				to: fellAt + HIGHLIGHT_TAIL_MS,
			},
		]);
	});
});

describe("poids des meilleurs moments", () => {
	it("reste léger même à 8 joueurs et 8 anomalies", () => {
		const sim = new MatchSimulation({
			seed: 77,
			players: 8,
			config: { simultaneousAnomalies: 8, durationMinutes: 3 },
		});
		sim.run(50);
		for (const id of ["p1", "p2", "p3"]) {
			const player = playerOf(sim, id);
			player.protectedUntil = 0;
			sim.match.applyFallDamage(player, 10, 5);
			sim.run(12);
		}
		const clips = sim.match.highlights?.finish() ?? [];
		expect(clips).toHaveLength(3);
		const size = JSON.stringify(clips).length;
		console.log(`3 extraits : ${Math.round(size / 1024)} Ko`);
		expect(size).toBeLessThan(1_000_000);
	});
});

describe("chutes", () => {
	function fallen(materials: number) {
		const sim = new MatchSimulation({ seed: 21, players: 1 });
		silenceAnomalies(sim);
		sim.run(0.2);
		const player = sim.match.players.get("p1") as MatchPlayer;
		player.protectedUntil = 0;
		for (const id of MATERIAL_IDS) {
			player.materials[id] = 0;
		}
		for (let index = 0; index < materials; index += 1) {
			player.materials[MATERIAL_IDS[index % MATERIAL_IDS.length]] += 1;
		}
		player.objects[OCCULT_IDS[0]] = 2;
		sim.match.applyDamage(player, HEALTH_MAX * 2, "pact", null, true);
		return { sim, player };
	}
	const total = (player: MatchPlayer) =>
		MATERIAL_IDS.reduce((sum, id) => sum + player.materials[id], 0);

	it("fait perdre quelques fragments, pas les objets", () => {
		const { sim, player } = fallen(7);
		expect(player.alive).toBe(false);
		expect(total(player)).toBe(7 - FALL_FRAGMENT_LOSS);
		expect(player.objects[OCCULT_IDS[0]]).toBe(2);
		sim.run(0.1);
		const death = sim.transport
			.eventsOfType("death")
			.find((event) => event.playerId === "p1");
		expect(death?.fragmentsLost).toBe(FALL_FRAGMENT_LOSS);
		expect(
			sim.transport.messages.some(
				(message) =>
					message.event === "game:inventory" && message.target === "p1",
			),
		).toBe(true);
	});

	it("ne descend jamais sous zéro", () => {
		const { player } = fallen(1);
		expect(total(player)).toBe(0);
		expect(fallen(0).player.alive).toBe(false);
	});
});

describe("durée d'une partie", () => {
	it("dure 16 minutes par défaut et reste réglable", () => {
		expect(PUBLIC_MATCH_CONFIG.durationMinutes).toBe(16);
		expect(defaultPrivateConfig().durationMinutes).toBe(16);
		expect(matchDurationMs(PUBLIC_MATCH_CONFIG)).toBe(16 * 60_000);
		const fallback = defaultPrivateConfig();
		expect(
			sanitizeMatchConfig({ ...fallback, durationMinutes: 16 }, fallback)
				.durationMinutes,
		).toBe(16);
		expect(TUTORIAL_MATCH_CONFIG.durationMinutes).toBe(15);
	});
});

describe("titres de fin de partie", () => {
	const empty = (patch: Partial<PlayerStats> = {}): PlayerStats => ({
		hideMs: 0,
		crafts: 0,
		stakes: 0,
		screamMs: 0,
		longestHideMs: 0,
		hideRunMs: 0,
		fallDamage: 0,
		pushes: 0,
		doors: 0,
		fragments: 0,
		sprintMeters: 0,
		chasedMs: 0,
		radioMs: 0,
		lanternMs: 0,
		abandons: 0,
		pacts: 0,
		captures: 0,
		deaths: 0,
		jumps: 0,
		...patch,
	});

	it("donne un titre à chacun, sans doublon", () => {
		const awards = pickAwards(
			new Map([
				["a", empty({ longestHideMs: 200_000, screamMs: 9000 })],
				["b", empty({ screamMs: 8000 })],
				["c", empty()],
			]),
		);
		expect(awards).toHaveLength(3);
		expect(awards.find((award) => award.playerId === "a")?.id).toBe("hider");
		expect(awards.find((award) => award.playerId === "b")?.id).toBe("screamer");
		expect(awards.find((award) => award.playerId === "c")?.id).toBe("tourist");
	});

	it("repère celui qui a laissé un ami mourir à côté de lui", () => {
		const sim = new MatchSimulation({ seed: 77, players: 2 });
		sim.run(3);
		const victim = playerOf(sim, "p1");
		const friend = playerOf(sim, "p2");
		friend.position = { ...victim.position, x: victim.position.x + 2 };
		victim.protectedUntil = 0;
		sim.match.applyDamage(victim, HEALTH_MAX, "murmure", null);
		expect(sim.match.awards.stats.get("p2")?.abandons).toBe(1);
		expect(sim.match.awards.stats.get("p1")?.deaths).toBe(1);
	});
});

describe("mode de jeu du jour", () => {
	it("donne le même défi à tout le monde, et un autre le lendemain", () => {
		const today = dailyChallenge("2026-11-07");
		expect(dailyChallenge("2026-11-07")).toEqual(today);
		const tomorrow = dailyChallenge("2026-11-08");
		expect(tomorrow.seed).not.toBe(today.seed);
		expect(tomorrow.theme).not.toBe(today.theme);
		expect(dailyDateKey(Date.UTC(2026, 10, 7, 23, 59))).toBe("2026-11-07");
	});

	it("passe par tous les thèmes en une semaine, avec des règles valides", () => {
		const seen = new Set<string>();
		for (let day = 1; day <= 7; day += 1) {
			const challenge = dailyChallenge(`2026-12-0${day}`);
			seen.add(challenge.theme);
			expect(challenge.config.species.length).toBeGreaterThan(0);
			const layout = generateManor(challenge.seed, challenge.config);
			expect(layout.rooms.length).toBeGreaterThan(3);
		}
		expect(seen.size).toBe(DAILY_THEMES.length);
	});
});

describe("récompenses", () => {
	const stats = (patch: Partial<ProgressStats> = {}): ProgressStats => ({
		gamesPlayed: 0,
		wins: 0,
		captures: 0,
		dailies: 0,
		awards: 0,
		...patch,
	});

	it("laisse les motifs de base libres et verrouille les autres", () => {
		expect(hatUnlocked("spots", null)).toBe(true);
		expect(hatUnlocked("crown", null)).toBe(false);
		const done = (metrics: MatchMetrics) =>
			stats({ challenges: withMatchMetrics({}, metrics) });
		expect(hatUnlocked("crown", done({ dailies: 7 }))).toBe(true);
		expect(lanternUnlocked("amber", null)).toBe(true);
		expect(lanternUnlocked("violet", done({ stakes: 4 }))).toBe(false);
		expect(lanternUnlocked("violet", done({ stakes: 5 }))).toBe(true);
	});

	it("repère ce qui vient d'être débloqué", () => {
		const unlocked = newlyUnlocked(
			stats({ challenges: withMatchMetrics({}, { games: 4 }) }),
			stats({ challenges: withMatchMetrics({}, { games: 5 }) }),
		);
		expect(unlocked.map((reward) => reward.value)).toEqual(["emerald"]);
		expect(newlyUnlocked(null, null)).toEqual([]);
	});
});
