import { beforeEach, describe, expect, it } from "vitest";
import {
	type DisguiseBody,
	PlayerMarkerBlender,
	VoiceClipGate,
} from "../shared/doubleDisguise.js";
import { installAnomaly, silenceAnomalies } from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

const body = (x: number, z = 0) => ({ x, y: 0, z, yaw: 0 });
const disguise = (x: number, playerId = "p2"): DisguiseBody => ({
	...body(x),
	anomalyId: 7,
	playerId,
});
const viewer = { x: 0, y: 0, z: 0 };

describe("point du Doppelgänger sur la carte", () => {
	it("garde un seul point, celui du corps le plus proche", () => {
		const blender = new PlayerMarkerBlender();
		expect(blender.place("p2", viewer, body(50), [], 0).x).toBe(50);
		const near = blender.place("p2", viewer, body(50), [disguise(5)], 10_000);
		expect(near.x).toBe(50);
		expect(
			blender.place("p2", viewer, body(50), [disguise(5)], 12_000).x,
		).toBeCloseTo(5);
	});

	it("fait glisser le point au lieu de le téléporter", () => {
		const blender = new PlayerMarkerBlender();
		blender.place("p2", viewer, body(50), [], 0);
		blender.place("p2", viewer, body(50), [disguise(5)], 10_000);
		const midway = blender.place(
			"p2",
			viewer,
			body(50),
			[disguise(5)],
			10_600,
		).x;
		expect(midway).toBeGreaterThan(5);
		expect(midway).toBeLessThan(50);
	});

	it("ne clignote pas quand les deux corps sont à égale distance", () => {
		const blender = new PlayerMarkerBlender();
		blender.place("p2", viewer, body(10), [], 0);
		const shown = blender.place("p2", viewer, body(10), [disguise(9)], 5000);
		expect(shown.x).toBe(10);
	});

	it("revient sur le vrai joueur quand le Double se révèle", () => {
		const blender = new PlayerMarkerBlender();
		blender.place("p2", viewer, body(50), [disguise(5)], 0);
		blender.place("p2", viewer, body(50), [], 5000);
		expect(blender.place("p2", viewer, body(50), [], 8000).x).toBeCloseTo(50);
	});

	it("ignore le déguisement d'un autre joueur et celui d'un mort", () => {
		const blender = new PlayerMarkerBlender();
		expect(blender.place("p3", viewer, body(50), [disguise(5)], 9000).x).toBe(
			50,
		);
		expect(
			blender.place("p2", viewer, body(50), [disguise(5)], 9000, true).x,
		).toBe(50);
	});
});

describe("extraits de voix", () => {
	it("garde une phrase et jette un bruit bref", () => {
		const gate = new VoiceClipGate();
		expect(gate.step(0.1, 0)).toBeNull();
		expect(gate.step(0.5, 100)).toBe("start");
		expect(gate.step(0.5, 900)).toBeNull();
		expect(gate.step(0, 1400)).toBe("keep");
		expect(gate.step(0.5, 2000)).toBe("start");
		expect(gate.step(0, 2500)).toBe("discard");
	});

	it("coupe une phrase trop longue", () => {
		const gate = new VoiceClipGate();
		gate.step(0.5, 0);
		expect(gate.step(0.5, 3100)).toBe("keep");
	});
});

describe("choix du joueur imité", () => {
	let sim: MatchSimulation;

	beforeEach(() => {
		sim = new MatchSimulation({ seed: 4242, players: 3 });
		silenceAnomalies(sim);
		sim.run(1);
	});

	it("abandonne un joueur mort ou déconnecté", () => {
		const entity = installAnomaly(
			sim,
			0,
			"double",
			sim.match.players.get("p1")?.position ?? { x: 0, y: 0, z: 0 },
		);
		entity.revealed = false;
		entity.mimicPlayerId = "p2";
		const copied = sim.match.players.get("p2");
		if (copied) {
			copied.alive = false;
			copied.respawnAt = Infinity;
		}
		sim.run(0.2);
		expect(entity.mimicPlayerId).not.toBe("p2");
		expect(entity.mimicPlayerId).not.toBeNull();
	});
});
