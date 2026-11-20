import { describe, expect, it } from "vitest";
import {
	musicLoopBounds,
	musicTrackFor,
} from "../src/features/audio/musicLoop.js";

describe("musique d'ambiance", () => {
	it("choisit la piste du mode, sinon la piste de secours", () => {
		expect(musicTrackFor("game", new Set(["ambient", "game", "menu"]))).toBe(
			"game",
		);

		expect(musicTrackFor("menu", new Set(["ambient", "game"]))).toBe("ambient");
		expect(musicTrackFor("menu", new Set(["zeta", "alpha"]))).toBe("alpha");
		expect(musicTrackFor("game", new Set())).toBeNull();
	});

	it("boucle sur toute la piste par défaut et respecte les bornes réglées", () => {
		expect(musicLoopBounds(undefined, 140)).toEqual({ start: 0, end: 140 });

		expect(musicLoopBounds({ loopStart: 12, loopEnd: 96 }, 140)).toEqual({
			start: 12,
			end: 96,
		});

		expect(musicLoopBounds({ loopEnd: 300 }, 140)).toEqual({
			start: 0,
			end: 140,
		});

		expect(musicLoopBounds({ loopStart: 90, loopEnd: 40 }, 140)).toEqual({
			start: 0,
			end: 140,
		});
	});
});
