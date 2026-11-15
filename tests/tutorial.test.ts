import { describe, expect, it } from "vitest";
import type { MatchPlayer } from "../server/game/MatchPlayer.js";
import {
	MATERIAL_IDS,
	OCCULT_IDS,
	OCCULT_RECIPES,
	PICKUP_INTERACT_RANGE,
	PICKUP_MIN_PER_LEVEL,
	STAKE_INTERACT_RANGE,
	STAKE_KINDS,
} from "../shared/config/index.js";
import { TUTORIAL_MATCH_CONFIG, TUTORIAL_SEED } from "../shared/matchConfig.js";
import {
	TUTORIAL_DUMMY_ID,
	TUTORIAL_WOUNDED_HEALTH,
	type TutorialStage,
} from "../shared/tutorial.js";
import type { Vec3 } from "../shared/math.js";
import { lineOfSight } from "../shared/physics/lineOfSight.js";
import { castAt, placeBot, prepareCaster } from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function tutorialSim(): MatchSimulation {
	return new MatchSimulation({
		seed: TUTORIAL_SEED,
		players: 1,
		config: TUTORIAL_MATCH_CONFIG,
		tutorial: true,
	});
}

function self(sim: MatchSimulation): MatchPlayer {
	return sim.match.players.get("p1") as MatchPlayer;
}

function stage(sim: MatchSimulation, next: TutorialStage): void {
	sim.match.handleTutorialStage("p1", next);
	sim.run(0.2);
}

function flatDistance(
	a: { x: number; z: number },
	b: { x: number; z: number },
): number {
	return Math.hypot(a.x - b.x, a.z - b.z);
}

function yawTo(
	from: { x: number; z: number },
	to: { x: number; z: number },
): number {
	return Math.atan2(-(to.x - from.x), -(to.z - from.z));
}

function standNextTo(sim: MatchSimulation, target: Vec3): void {
	const { match } = sim;
	const grid = match.grid;
	for (let cell = 0; cell < grid.cellsPerLevel * grid.levelCount; cell += 1) {
		if (!grid.walkable[cell] || !grid.isInMainComponent(cell)) {
			continue;
		}
		const point = grid.nodePosition(cell);
		const distance = flatDistance(point, target);
		if (
			distance >= 1 &&
			distance <= 1.4 &&
			Math.abs(point.y - target.y) < 0.5 &&
			lineOfSight(
				match.world,
				{ ...point, y: point.y + 1 },
				{ ...target, y: target.y + 1 },
			)
		) {
			placeBot(sim, "p1", point, yawTo(point, target));
			return;
		}
	}
	throw new Error("Aucune place libre à côté de la cible");
}

function roomDoorsOpen(sim: MatchSimulation, roomId: number): boolean[] {
	const { match } = sim;
	return match.layout.rooms[roomId].openingIds.flatMap((openingId) => {
		const door = match.layout.openings[openingId].door;
		return door ? [match.doors.get(door.id)?.open ?? false] : [];
	});
}

describe("tutoriel : le manoir", () => {
	it("est un petit manoir de plain-pied avec tout ce que demandent les étapes", () => {
		const { match } = tutorialSim();
		expect(match.layout.levels).toEqual([0]);
		expect(match.anomalies).toHaveLength(1);
		expect(match.anomalies[0].species).toBe("murmure");
		expect(match.anomalies[0].occult).not.toBeNull();
		expect(match.layout.altars.length).toBeGreaterThan(0);
		expect(match.layout.valves.length).toBeGreaterThan(0);
		expect(match.layout.hideSpots.length).toBeGreaterThan(0);
		expect(match.layout.pickups.length).toBeGreaterThanOrEqual(
			PICKUP_MIN_PER_LEVEL,
		);
		expect(
			[...new Set(match.layout.stakes.map((stake) => stake.kind))].sort(),
		).toEqual([...STAKE_KINDS].sort());
		expect(match.walkieTotal).toBeGreaterThan(0);
		expect(match.cameraTotal).toBeGreaterThan(0);
	});

	it("ne pose que les matériaux de la recette, même après réapparition", () => {
		const sim = tutorialSim();
		const { match } = sim;
		const wanted = Object.keys(
			OCCULT_RECIPES[match.anomalies[0].occult as "pendulum"],
		);
		for (const pickup of match.layout.pickups) {
			expect(wanted).toContain(pickup.material);
		}
		const pickupId = match.layout.pickups[0].id;
		for (let round = 0; round < 40; round += 1) {
			match.loot.returnsAt.set(pickupId, match.now);
			match.loot.update(match);
			expect(wanted).toContain(match.loot.materialOf(match, pickupId));
		}
		const floor = match.layout.pickups.find((entry) => entry.spot === "floor");
		if (floor) {
			const node = match.grid.nearestNode(floor, 2) as number;
			placeBot(sim, "p1", match.grid.nodePosition(node), 0);
			match.handleInteract("p1", { kind: "pickup", id: floor.id });
			expect(
				MATERIAL_IDS.reduce((sum, id) => sum + self(sim).materials[id], 0),
			).toBe(1);
		}
	});

	it("annonce le mannequin aux clients, après le vrai joueur", () => {
		const { match } = tutorialSim();
		const players = match.initPayload().players;
		expect(players.map((player) => player.id)).toEqual([
			"p1",
			TUTORIAL_DUMMY_ID,
		]);
		expect(match.players.has(TUTORIAL_DUMMY_ID)).toBe(false);
	});

	it("n'éveille aucun monstre sans demande et ne blesse jamais", () => {
		const sim = tutorialSim();
		sim.run(30);
		const { match } = sim;
		expect(match.anomalies[0].active).toBe(false);
		const player = self(sim);
		player.protectedUntil = 0;
		expect(match.applyDamage(player, 80, "murmure", null)).toBe(false);
		expect(player.health).toBe(100);
	});

	it("ignore les étapes hors du tutoriel", () => {
		const sim = new MatchSimulation({ seed: 4242, players: 1 });
		sim.match.handleTutorialStage("p1", "wound");
		sim.run(0.2);
		expect(self(sim).health).toBe(100);
		expect(sim.match.initPayload().players).toHaveLength(1);
	});
});

describe("tutoriel : discrétion", () => {
	it("enferme le joueur face à un monstre figé", () => {
		const sim = tutorialSim();
		stage(sim, "stealth");
		const { match } = sim;
		const player = self(sim);
		const entity = match.anomalies[0];
		expect(entity.active).toBe(true);
		const distance = flatDistance(player.position, entity.position);
		expect(distance).toBeGreaterThan(6);
		expect(distance).toBeLessThan(10);
		const roomId = match.roomIdAt(player.position) as number;
		expect(match.roomIdAt(entity.position)).toBe(roomId);
		expect(roomDoorsOpen(sim, roomId).every((open) => !open)).toBe(true);
		const before = { ...entity.position };
		sim.run(4);
		expect(flatDistance(before, entity.position)).toBeLessThan(0.01);
		stage(sim, "free");
		expect(entity.active).toBe(false);
		expect(
			sim.transport
				.eventsOfType("anomalyRemoved")
				.some((event) => event.reason === "dismissed"),
		).toBe(true);
	});

	it("signale qu'il entend un joueur qui marche, pas un joueur accroupi à distance", () => {
		const sim = tutorialSim();
		stage(sim, "stealth");
		const { match } = sim;
		const entity = match.anomalies[0];
		const bot = sim.bot("p1");
		bot.input.crouch = true;
		sim.run(0.6);
		bot.input.strafe = 1;
		const heardBefore = sim.transport.eventsOfType("heard").length;
		sim.run(2);
		expect(sim.transport.eventsOfType("heard").length).toBe(heardBefore);
		bot.input.strafe = 0;
		bot.input.crouch = false;
		bot.input.yaw = Math.atan2(
			-(entity.position.x - bot.character.x),
			-(entity.position.z - bot.character.z),
		);
		bot.input.forward = 1;
		sim.run(0.5);
		for (let step = 0; step < 40; step += 1) {
			if (flatDistance(bot.character, entity.position) < 2.5) {
				break;
			}
			sim.run(0.1);
		}
		bot.input.forward = 0;
		sim.run(1);
		const heard = sim.transport.eventsOfType("heard");
		expect(heard.length).toBeGreaterThan(heardBefore);
		expect(heard.every((event) => event.playerId === "p1")).toBe(true);
	});
});

describe("tutoriel : interactions", () => {
	it("blesse sans tuer, et l'eau verte soigne", () => {
		const sim = tutorialSim();
		stage(sim, "wound");
		const player = self(sim);
		expect(player.health).toBe(TUTORIAL_WOUNDED_HEALTH);
		expect(player.alive).toBe(true);
		const { match } = sim;
		const valve = match.layout.valves[0];
		placeBot(sim, "p1", { x: valve.jet.x, y: valve.floorY, z: valve.jet.z }, 0);
		expect(match.valves.activate(valve.id, match.now)).not.toBeNull();
		sim.run(3);
		expect(player.health).toBeGreaterThanOrEqual(TUTORIAL_WOUNDED_HEALTH + 16);
	});

	it("fait apparaître le mannequin au milieu de la pièce, en terrain dégagé", () => {
		const sim = tutorialSim();
		stage(sim, "push");
		const { match } = sim;
		const player = self(sim);
		const dummy = match.players.get(TUTORIAL_DUMMY_ID) as MatchPlayer;
		expect(dummy).toBeDefined();
		const roomId = match.roomIdAt(player.position) as number;
		const room = match.layout.rooms[roomId];
		expect(match.roomIdAt(dummy.position)).toBe(roomId);
		expect(flatDistance(player.position, dummy.position)).toBeGreaterThan(1.3);
		const spread = Math.max(
			room.bounds.maxX - room.bounds.minX,
			room.bounds.maxZ - room.bounds.minZ,
		);
		expect(flatDistance(dummy.position, room.labelPoint)).toBeLessThan(
			spread / 3,
		);
		expect(
			match.snapshot().players.some((entry) => entry.id === TUTORIAL_DUMMY_ID),
		).toBe(true);
		standNextTo(sim, dummy.position);
		const before = { ...dummy.position };
		match.handlePush("p1", yawTo(player.position, dummy.position));
		sim.run(0.1);
		expect(
			sim.transport
				.eventsOfType("push")
				.some(
					(event) =>
						event.fromId === "p1" && event.targetId === TUTORIAL_DUMMY_ID,
				),
		).toBe(true);
		expect(flatDistance(before, dummy.position)).toBeGreaterThan(1.5);
		stage(sim, "free");
		expect(match.players.has(TUTORIAL_DUMMY_ID)).toBe(false);
		expect(
			match.snapshot().players.some((entry) => entry.id === TUTORIAL_DUMMY_ID),
		).toBe(false);
	});

	it("un cri raté n'éveille pas le monstre, un cri qui brise l'incantation l'attire", () => {
		const sim = tutorialSim();
		stage(sim, "shout");
		const { match } = sim;
		const player = self(sim);
		const dummy = match.players.get(TUTORIAL_DUMMY_ID) as MatchPlayer;
		const entity = match.anomalies[0];
		standNextTo(sim, dummy.position);
		expect(entity.active).toBe(true);
		const start = { ...entity.position };
		expect(dummy.casting).toBeNull();
		match.handleShout("p1");
		sim.run(6);
		expect(flatDistance(start, entity.position)).toBeLessThan(0.01);
		expect(entity.state).toBe("idle");
		for (
			let tries = 0;
			tries < 200 &&
			(dummy.casting === null || player.shoutCooldownUntil > match.now);
			tries += 1
		) {
			sim.run(0.1);
		}
		expect(dummy.casting).not.toBeNull();
		expect(flatDistance(start, entity.position)).toBeLessThan(0.01);
		match.handleShout("p1");
		sim.run(0.1);
		expect(
			sim.transport
				.eventsOfType("castInterrupted")
				.some(
					(event) =>
						event.playerId === TUTORIAL_DUMMY_ID &&
						event.byId === "p1" &&
						event.cause === "shout",
				),
		).toBe(true);
		expect(dummy.casting).toBeNull();
		sim.run(10);
		for (let second = 0; second < 10; second += 1) {
			sim.run(1);
			const distance = Math.hypot(
				entity.position.x - player.position.x,
				entity.position.y - player.position.y,
				entity.position.z - player.position.z,
			);
			expect(distance).toBeLessThan(5);
		}
		stage(sim, "capture");
		expect(match.players.has(TUTORIAL_DUMMY_ID)).toBe(false);
		expect(entity.active).toBe(true);
	});

	it("passer l'étape du cri réveille quand même le monstre", () => {
		const sim = tutorialSim();
		stage(sim, "shout");
		const entity = sim.match.anomalies[0];
		const start = { ...entity.position };
		sim.run(3);
		expect(flatDistance(start, entity.position)).toBeLessThan(0.01);
		stage(sim, "capture");
		sim.run(4);
		expect(flatDistance(start, entity.position)).toBeGreaterThan(1);
	});

	it("laisse le monstre attiré se faire capturer sans dégâts", () => {
		const sim = tutorialSim();
		stage(sim, "capture");
		const { match } = sim;
		const player = self(sim);
		const entity = match.anomalies[0];
		const object = entity.occult as (typeof OCCULT_IDS)[number];
		expect(entity.active).toBe(true);
		expect(player.objects[object]).toBe(1);
		sim.run(14);
		expect(player.health).toBe(100);
		sim.bot("p1").held = OCCULT_IDS.indexOf(object);
		prepareCaster(sim, "p1", { voiceLevel: 0.4 });
		const result = castAt(sim, "p1", entity);
		expect(result.ok).toBe(true);
		expect(entity.active).toBe(false);
	});
});

describe("tutoriel : pour aller plus loin", () => {
	it("enferme le joueur dans chaque salle spéciale, à portée de son autel", () => {
		const sim = tutorialSim();
		const { match } = sim;
		const player = self(sim);
		for (const kind of STAKE_KINDS) {
			stage(sim, kind);
			const stake = match.layout.stakes.find((entry) => entry.kind === kind);
			if (!stake) {
				throw new Error(`Salle ${kind} absente`);
			}
			expect(match.roomIdAt(player.position)).toBe(stake.roomId);
			expect(roomDoorsOpen(sim, stake.roomId).every((open) => !open)).toBe(
				true,
			);
			const eye = player.eyePosition();
			expect(
				Math.hypot(stake.x - eye.x, stake.y + 0.9 - eye.y, stake.z - eye.z),
			).toBeLessThanOrEqual(STAKE_INTERACT_RANGE);
		}
	});

	it("le pacte coûte de la vie sans tuer et donne un objet occulte", () => {
		const sim = tutorialSim();
		stage(sim, "pact");
		const { match } = sim;
		const player = self(sim);
		const stake = match.layout.stakes.find((entry) => entry.kind === "pact");
		match.handleInteract("p1", { kind: "stake", id: stake?.id ?? -1 });
		expect(player.health).toBeLessThan(100);
		expect(player.alive).toBe(true);
		expect(OCCULT_IDS.some((id) => player.objects[id] > 0)).toBe(true);
		stage(sim, "sanctuary");
		expect(player.health).toBeLessThanOrEqual(TUTORIAL_WOUNDED_HEALTH);
		const sanctuary = match.layout.stakes.find(
			(entry) => entry.kind === "sanctuary",
		);
		const before = player.health;
		match.handleInteract("p1", { kind: "stake", id: sanctuary?.id ?? -1 });
		sim.run(4);
		expect(player.health).toBeGreaterThan(before + 20);
	});

	it("dépose le joueur à portée d'un talkie-walkie puis d'un appareil photo", () => {
		const sim = tutorialSim();
		const { match } = sim;
		const player = self(sim);
		stage(sim, "walkie");
		const walkie = match.layout.walkies
			.slice(0, match.walkieTotal)
			.find((spot) => spot.roomId === match.roomIdAt(player.position));
		expect(walkie).toBeDefined();
		const eye = player.eyePosition();
		expect(
			Math.hypot(
				(walkie?.x ?? 0) - eye.x,
				(walkie?.y ?? 0) - eye.y,
				(walkie?.z ?? 0) - eye.z,
			),
		).toBeLessThanOrEqual(PICKUP_INTERACT_RANGE);
		match.handleInteract("p1", { kind: "walkie", id: walkie?.id ?? -1 });
		expect(player.walkie).toBe(walkie?.id);
		stage(sim, "camera");
		const camera = match.layout.cameras
			.slice(0, match.cameraTotal)
			.find((spot) => spot.roomId === match.roomIdAt(player.position));
		expect(camera).toBeDefined();
		match.handleInteract("p1", { kind: "camera", id: camera?.id ?? -1 });
		expect(player.camera).toBe(camera?.id);
	});
});
