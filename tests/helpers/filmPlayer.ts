import {
	createFilm,
	FILM_DUCK_HALF_WIDTH,
	FILM_INPUT,
	FILM_SHAPES,
	FILM_STAND_HALF_WIDTH,
	FILM_TICK_RATE,
	type FilmState,
	filmGravity,
	filmJumpSpeed,
	filmSpeed,
	obstacleVisible,
	obstacleWidth,
	stepFilm,
} from "../../shared/minigames/filmRunner.js";
import { SeededRandom } from "../../shared/random.js";

export interface FilmSkill {
	timingSd: number;
	reactionMs: number;
	lapse: number;
}

export const NOVICE: FilmSkill = { timingSd: 70, reactionMs: 320, lapse: 0.03 };

export const AVERAGE: FilmSkill = {
	timingSd: 45,
	reactionMs: 260,
	lapse: 0.015,
};

export const EXPERT: FilmSkill = {
	timingSd: 25,
	reactionMs: 200,
	lapse: 0.005,
};

export const PERFECT: FilmSkill = { timingSd: 0, reactionMs: 150, lapse: 0 };

const MARGIN = 1.5;

export interface FilmRun {
	state: FilmState;
	inputs: number[];
}

function gaussian(rng: SeededRandom): number {
	const u = Math.max(1e-9, rng.next());
	const v = rng.next();

	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function airWindow(height: number, level: number): [number, number] {
	const a = filmGravity(level) / 2;
	const b = -filmJumpSpeed(level);
	const root = Math.sqrt(b * b - 4 * a * height);

	return [(-b - root) / (2 * a), (-b + root) / (2 * a)];
}

export function playFilm(
	seed: number,
	level: number,
	skill: FilmSkill,
	rng: SeededRandom = new SeededRandom(seed),
): FilmRun {
	const state = createFilm(seed, level);
	const jumps = new Set<number>();
	const ducks: [number, number][] = [];
	const noticed = new Set<number>();
	const spread = (skill.timingSd / 1000) * FILM_TICK_RATE;
	const inputs: number[] = [];
	let ducking = false;

	while (state.outcome === "playing") {
		state.obstacles.forEach((obstacle, index) => {
			if (noticed.has(index) || !obstacleVisible(state, obstacle)) {
				return;
			}

			noticed.add(index);

			const reaction =
				state.tick +
				Math.round(
					((skill.reactionMs + gaussian(rng) * 40) / 1000) * FILM_TICK_RATE,
				);

			if (rng.chance(skill.lapse)) {
				return;
			}

			const shape = FILM_SHAPES[obstacle.kind];
			const speed = filmSpeed(state.level, obstacle.arrival);

			if (shape.lane === "ground") {
				const reach =
					obstacleWidth(obstacle.kind, state.level) / 2 +
					FILM_STAND_HALF_WIDTH -
					MARGIN;

				const half = (reach / speed) * FILM_TICK_RATE;
				const [rise, fall] = airWindow(shape.top - MARGIN, state.level);
				const early = obstacle.arrival + half - fall * FILM_TICK_RATE;
				const late = obstacle.arrival - half - rise * FILM_TICK_RATE;
				const ideal = (early + late) / 2 + gaussian(rng) * spread;

				jumps.add(Math.max(reaction, Math.round(ideal)));
			} else if (shape.lane === "low") {
				const reach = shape.width / 2 + FILM_DUCK_HALF_WIDTH - MARGIN;
				const half = (reach / speed) * FILM_TICK_RATE;

				const from = Math.round(
					obstacle.arrival - half - rng.range(8, 30) + gaussian(rng) * spread,
				);

				const to = Math.round(
					obstacle.arrival + half + rng.range(4, 14) + gaussian(rng) * spread,
				);

				ducks.push([Math.max(reaction, from), to]);
			}
		});

		const jump = jumps.has(state.tick);

		const duck = ducks.some(
			([from, to]) => state.tick >= from && state.tick <= to,
		);

		if (jump) {
			inputs.push(state.tick, FILM_INPUT.jump);
		}

		if (duck !== ducking) {
			ducking = duck;

			inputs.push(state.tick, duck ? FILM_INPUT.duck : FILM_INPUT.rise);
		}

		stepFilm(state, jump, duck);
	}

	return { state, inputs };
}

export function winRate(
	level: number,
	skill: FilmSkill,
	films: number,
	salt = 1,
): number {
	const rng = new SeededRandom(salt);
	let wins = 0;

	for (let film = 1; film <= films; film += 1) {
		if (
			playFilm(film * 7919 + salt, level, skill, rng).state.outcome === "won"
		) {
			wins += 1;
		}
	}

	return wins / films;
}
