import { describe, expect, it } from "vitest";
import {
	createFilm,
	FILM_BASE_LEVEL,
	FILM_INPUT,
	FILM_MAX_LEVEL,
	FILM_MIN_LEVEL,
	FILM_TOTAL_TICKS,
	nextFilmLevel,
	replayFilm,
	sanitizeFilmInputs,
	stepFilm,
} from "../shared/minigames/filmRunner.js";
import { SeededRandom } from "../shared/random.js";
import {
	AVERAGE,
	EXPERT,
	type FilmSkill,
	NOVICE,
	PERFECT,
	playFilm,
	winRate,
} from "./helpers/filmPlayer.js";

function adaptiveRate(
	skill: FilmSkill,
	players: number,
	films: number,
): number {
	const rng = new SeededRandom(17);
	let wins = 0;

	for (let player = 0; player < players; player += 1) {
		let level = FILM_BASE_LEVEL;

		for (let film = 0; film < films; film += 1) {
			const won =
				playFilm(rng.int(1, 1e9), level, skill, rng).state.outcome === "won";

			wins += won ? 1 : 0;
			level = nextFilmLevel(level, won, film);
		}
	}

	return wins / (players * films);
}

describe("film du Cinématographe", () => {
	it("rejoue exactement une partie à partir de ses seules touches", () => {
		for (const seed of [3, 77, 1234]) {
			const run = playFilm(seed, FILM_BASE_LEVEL, AVERAGE);
			const replay = replayFilm(seed, FILM_BASE_LEVEL, run.inputs);

			expect(replay.outcome).toBe(run.state.outcome);
			expect(replay.tick).toBe(run.state.tick);
			expect(replay.hit).toBe(run.state.hit);
		}
	});

	it("perd le joueur qui ne touche à rien", () => {
		const film = replayFilm(5, FILM_BASE_LEVEL, []);

		expect(film.outcome).toBe("lost");
		expect(film.tick).toBeLessThan(FILM_TOTAL_TICKS);
	});

	it("reste gagnable sans faute à tous les niveaux", () => {
		for (const level of [FILM_MIN_LEVEL, FILM_BASE_LEVEL, FILM_MAX_LEVEL]) {
			expect(winRate(level, PERFECT, 40), String(level)).toBeGreaterThan(0.9);
		}
	});

	it("se gagne environ une fois sur deux par un joueur moyen", () => {
		const rate = winRate(FILM_BASE_LEVEL, AVERAGE, 300, 3);

		expect(rate).toBeGreaterThan(0.38);
		expect(rate).toBeLessThan(0.62);
	});

	it("devient plus dur quand le niveau monte", () => {
		const easy = winRate(FILM_MIN_LEVEL, AVERAGE, 150, 5);
		const base = winRate(FILM_BASE_LEVEL, AVERAGE, 150, 5);
		const hard = winRate(FILM_MAX_LEVEL, AVERAGE, 150, 5);

		expect(easy).toBeGreaterThan(base + 0.15);
		expect(base).toBeGreaterThan(hard + 0.25);
	});

	it("rapproche novices et experts d'une victoire sur deux", () => {
		const novice = adaptiveRate(NOVICE, 30, 20);
		const expert = adaptiveRate(EXPERT, 30, 20);

		expect(novice).toBeGreaterThan(winRate(FILM_BASE_LEVEL, NOVICE, 200, 7));
		expect(expert).toBeLessThan(winRate(FILM_BASE_LEVEL, EXPERT, 200, 7));
		expect(Math.abs(novice - 0.5)).toBeLessThan(0.2);
		expect(Math.abs(expert - 0.5)).toBeLessThan(0.2);
	});

	it("garde le champignon au sol tant qu'il ne saute pas", () => {
		const film = createFilm(9, FILM_BASE_LEVEL);

		for (let tick = 0; tick < 200; tick += 1) {
			stepFilm(film, false, tick > 100);
		}

		expect(film.y).toBe(0);
		expect(film.ducking).toBe(true);
	});

	it("refuse des touches mal formées", () => {
		expect(sanitizeFilmInputs([1, FILM_INPUT.jump])).toEqual([
			1,
			FILM_INPUT.jump,
		]);

		expect(sanitizeFilmInputs([5, 1, 2, 1])).toBeNull();
		expect(sanitizeFilmInputs([1, 9])).toBeNull();
		expect(sanitizeFilmInputs([1.5, 1])).toBeNull();
		expect(sanitizeFilmInputs([1])).toBeNull();
		expect(sanitizeFilmInputs("1,1")).toBeNull();
		expect(sanitizeFilmInputs([FILM_TOTAL_TICKS + 5, 1])).toBeNull();
	});
});
