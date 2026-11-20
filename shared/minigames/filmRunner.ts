import { clamp } from "../math.js";
import { SeededRandom } from "../random.js";

export const FILM_TICK_RATE = 120;
export const FILM_TICK_MS = 1000 / FILM_TICK_RATE;
export const FILM_INTRO_TICKS = 3 * FILM_TICK_RATE;
export const FILM_PLAY_TICKS = 15 * FILM_TICK_RATE;
export const FILM_TOTAL_TICKS = FILM_INTRO_TICKS + FILM_PLAY_TICKS;
export const FILM_TOTAL_MS = FILM_TOTAL_TICKS * FILM_TICK_MS;

export const FILM_WIDTH = 320;
export const FILM_HEIGHT = 180;
export const FILM_MUSHROOM_X = 72;

export const FILM_BASE_LEVEL = 0.55;
export const FILM_LEVEL_STEP = 0.12;
export const FILM_FIRST_STEP = 0.32;
export const FILM_MIN_LEVEL = -0.4;
export const FILM_MAX_LEVEL = 1.3;
export const FILM_MAX_INPUTS = 600;

export const FILM_INPUT = { jump: 1, duck: 2, rise: 3 } as const;

export const FILM_JUMP_APEX = 31;
export const FILM_STAND_HEIGHT = 22;
export const FILM_DUCK_HEIGHT = 11;
export const FILM_STAND_HALF_WIDTH = 7;
export const FILM_DUCK_HALF_WIDTH = 9;

const JUMP_BUFFER_TICKS = 12;
const FORGIVENESS = 1.5;
const BASE_GRAVITY = 520;
const LEVEL_GRAVITY = 1.1;
const DIVE_FACTOR = 2.6;
const BASE_SPEED = 115;
const LEVEL_SPEED = 35;
const SPEED_RAMP = 0.3;
const LEVEL_STRETCH = 0.5;
const FIRST_ARRIVAL_S = 2.2;
const LAST_ARRIVAL_MARGIN_S = 0.7;
const SPAWN_MARGIN = 40;

export type FilmObstacleKind =
	| "gear"
	| "candles"
	| "spikes"
	| "bat"
	| "chandelier"
	| "owl";

export type FilmLane = "ground" | "low" | "high";

export interface FilmShape {
	width: number;
	bottom: number;
	top: number;
	lane: FilmLane;
}

export const FILM_SHAPES: Record<FilmObstacleKind, FilmShape> = {
	gear: { width: 16, bottom: 0, top: 17, lane: "ground" },
	candles: { width: 22, bottom: 0, top: 13, lane: "ground" },
	spikes: { width: 28, bottom: 0, top: 9, lane: "ground" },
	bat: { width: 18, bottom: 14, top: 26, lane: "low" },
	chandelier: { width: 28, bottom: 14, top: FILM_HEIGHT, lane: "low" },
	owl: { width: 20, bottom: 30, top: 44, lane: "high" },
};

const LANE_KINDS: Record<FilmLane, readonly FilmObstacleKind[]> = {
	ground: ["gear", "candles", "spikes"],
	low: ["bat", "chandelier"],
	high: ["owl"],
};

export type FilmOutcome = "playing" | "won" | "lost";

export interface FilmObstacle {
	kind: FilmObstacleKind;
	arrival: number;
	track: number;
}

export interface FilmState {
	seed: number;
	level: number;
	tick: number;
	distance: number;
	speed: number;
	y: number;
	vy: number;
	grounded: boolean;
	ducking: boolean;
	buffered: number;
	jumps: number;
	obstacles: FilmObstacle[];
	outcome: FilmOutcome;
	hit: number;
}

export function clampFilmLevel(level: number): number {
	return clamp(level, FILM_MIN_LEVEL, FILM_MAX_LEVEL);
}

export function nextFilmLevel(
	level: number,
	won: boolean,
	played: number,
): number {
	const step = Math.max(FILM_LEVEL_STEP, FILM_FIRST_STEP / (1 + played * 0.5));

	return clampFilmLevel(level + (won ? step : -step));
}

export function filmGravity(level: number): number {
	return BASE_GRAVITY * (1 + LEVEL_GRAVITY * level);
}

export function filmJumpSpeed(level: number): number {
	return Math.sqrt(2 * filmGravity(level) * FILM_JUMP_APEX);
}

export function obstacleWidth(kind: FilmObstacleKind, level: number): number {
	const shape = FILM_SHAPES[kind];

	return shape.lane === "ground"
		? shape.width * (1 + LEVEL_STRETCH * level)
		: shape.width;
}

export function filmSpeed(level: number, tick: number): number {
	const progress = clamp((tick - FILM_INTRO_TICKS) / FILM_PLAY_TICKS, 0, 1);

	return (BASE_SPEED + LEVEL_SPEED * level) * (1 + SPEED_RAMP * progress);
}

function laneAfter(previous: FilmLane, rng: SeededRandom): FilmLane {
	if (previous === "ground") {
		return rng.chance(0.75) ? "low" : "high";
	}

	return "ground";
}

function pickLane(rng: SeededRandom, level: number): FilmLane {
	return rng.weighted<FilmLane>([
		["ground", 3.2],
		["low", 1.6],
		["high", 0.4 + level * 0.9],
	]);
}

function pickKind(
	rng: SeededRandom,
	lane: FilmLane,
	level: number,
): FilmObstacleKind {
	if (lane === "ground") {
		return rng.weighted<FilmObstacleKind>([
			["gear", 3],
			["candles", 2],
			["spikes", 1 + level * 2],
		]);
	}

	return rng.pick(LANE_KINDS[lane]);
}

function schedule(seed: number, level: number): Omit<FilmObstacle, "track">[] {
	const rng = new SeededRandom(seed);
	const ticks = (seconds: number) => Math.round(seconds * FILM_TICK_RATE);
	const last = FILM_TOTAL_TICKS - ticks(LAST_ARRIVAL_MARGIN_S);
	const gapMin = Math.max(0.58, 1.15 - 0.55 * level);
	const gapMax = 1.7 - 0.75 * level;
	const comboChance = 0.12 + 0.3 * level;
	const planned: Omit<FilmObstacle, "track">[] = [];
	let arrival = FILM_INTRO_TICKS + ticks(FIRST_ARRIVAL_S);
	let lane = pickLane(rng, level);

	while (arrival <= last) {
		planned.push({ kind: pickKind(rng, lane, level), arrival });

		if (rng.chance(comboChance)) {
			const follow = laneAfter(lane, rng);
			const gap = ticks(rng.range(0.62, 0.78) - 0.1 * level);

			if (arrival + gap <= last) {
				arrival += gap;
				lane = follow;

				planned.push({ kind: pickKind(rng, lane, level), arrival });
			}
		}

		arrival += ticks(rng.range(gapMin, gapMax));
		lane = pickLane(rng, level);
	}

	return planned;
}

export function createFilm(seed: number, rawLevel: number): FilmState {
	const level = clampFilmLevel(rawLevel);
	const planned = schedule(seed, level);
	const tracks = new Map<number, number>();
	const wanted = new Set(planned.map((entry) => entry.arrival));
	let distance = 0;

	for (let tick = 0; tick <= FILM_TOTAL_TICKS; tick += 1) {
		distance += filmSpeed(level, tick) / FILM_TICK_RATE;

		if (wanted.has(tick)) {
			tracks.set(tick, distance);
		}
	}

	return {
		seed,
		level,
		tick: 0,
		distance: 0,
		speed: filmSpeed(level, 0),
		y: 0,
		vy: 0,
		grounded: true,
		ducking: false,
		buffered: 0,
		jumps: 0,
		obstacles: planned.map((entry) => ({
			...entry,
			track: tracks.get(entry.arrival) ?? 0,
		})),
		outcome: "playing",
		hit: -1,
	};
}

export function obstacleX(state: FilmState, obstacle: FilmObstacle): number {
	return FILM_MUSHROOM_X + obstacle.track - state.distance;
}

export function obstacleVisible(
	state: FilmState,
	obstacle: FilmObstacle,
): boolean {
	const x = obstacleX(state, obstacle);
	const half = obstacleWidth(obstacle.kind, state.level) / 2;

	return x - half < FILM_WIDTH + SPAWN_MARGIN && x + half > -SPAWN_MARGIN;
}

export function mushroomHeight(state: FilmState): number {
	return state.ducking ? FILM_DUCK_HEIGHT : FILM_STAND_HEIGHT;
}

function collides(state: FilmState, obstacle: FilmObstacle): boolean {
	const shape = FILM_SHAPES[obstacle.kind];
	const x = obstacleX(state, obstacle);
	const half = state.ducking ? FILM_DUCK_HALF_WIDTH : FILM_STAND_HALF_WIDTH;

	const reach =
		obstacleWidth(obstacle.kind, state.level) / 2 + half - FORGIVENESS;

	if (Math.abs(x - FILM_MUSHROOM_X) >= reach) {
		return false;
	}

	const bottom = state.y + FORGIVENESS;
	const top = state.y + mushroomHeight(state) - FORGIVENESS;

	return top > shape.bottom && bottom < shape.top;
}

export function stepFilm(state: FilmState, jump: boolean, duck: boolean): void {
	if (state.outcome !== "playing") {
		return;
	}

	const dt = 1 / FILM_TICK_RATE;

	state.speed = filmSpeed(state.level, state.tick);
	state.distance += state.speed / FILM_TICK_RATE;

	if (jump) {
		state.buffered = JUMP_BUFFER_TICKS;
	}

	if (state.grounded && state.buffered > 0) {
		state.vy = filmJumpSpeed(state.level);
		state.grounded = false;
		state.buffered = 0;
		state.jumps += 1;
	} else if (state.buffered > 0) {
		state.buffered -= 1;
	}

	if (!state.grounded) {
		const gravity = filmGravity(state.level);

		state.vy -= (duck ? gravity * DIVE_FACTOR : gravity) * dt;
		state.y += state.vy * dt;

		if (state.y <= 0) {
			state.y = 0;
			state.vy = 0;
			state.grounded = true;
		}
	}

	state.ducking = state.grounded && duck;

	if (state.tick >= FILM_INTRO_TICKS) {
		const hit = state.obstacles.findIndex((obstacle) =>
			collides(state, obstacle),
		);

		if (hit >= 0) {
			state.outcome = "lost";
			state.hit = hit;

			return;
		}
	}

	state.tick += 1;

	if (state.tick >= FILM_TOTAL_TICKS) {
		state.outcome = "won";
	}
}

export function sanitizeFilmInputs(raw: unknown): number[] | null {
	if (!Array.isArray(raw) || raw.length % 2 !== 0) {
		return null;
	}

	if (raw.length > FILM_MAX_INPUTS * 2) {
		return null;
	}

	let previous = 0;

	for (let index = 0; index < raw.length; index += 2) {
		const tick = raw[index];
		const code = raw[index + 1];

		if (
			!Number.isInteger(tick) ||
			tick < previous ||
			tick > FILM_TOTAL_TICKS ||
			(code !== FILM_INPUT.jump &&
				code !== FILM_INPUT.duck &&
				code !== FILM_INPUT.rise)
		) {
			return null;
		}

		previous = tick;
	}

	return raw as number[];
}

export function replayFilm(
	seed: number,
	level: number,
	inputs: readonly number[],
): FilmState {
	const state = createFilm(seed, level);
	let cursor = 0;
	let duck = false;

	while (state.outcome === "playing") {
		let jump = false;

		while (cursor < inputs.length && inputs[cursor] <= state.tick) {
			const code = inputs[cursor + 1];

			if (code === FILM_INPUT.jump) {
				jump = true;
			} else {
				duck = code === FILM_INPUT.duck;
			}

			cursor += 2;
		}

		stepFilm(state, jump, duck);
	}

	return state;
}
