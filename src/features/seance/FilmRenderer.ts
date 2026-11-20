import {
	FILM_HEIGHT,
	FILM_INTRO_TICKS,
	FILM_MUSHROOM_X,
	FILM_SHAPES,
	FILM_TICK_RATE,
	FILM_TOTAL_TICKS,
	FILM_WIDTH,
	type FilmObstacle,
	type FilmState,
	obstacleVisible,
	obstacleWidth,
	obstacleX,
} from "@shared/minigames/filmRunner";
import * as THREE from "three";
import {
	BORDER,
	type CardLine,
	drawBat,
	drawBurn,
	drawCandles,
	drawCaption,
	drawCard,
	drawChandelier,
	drawFilmBorders,
	drawGear,
	drawGrain,
	drawGraveyard,
	drawGround,
	drawLeader,
	drawMoon,
	drawMushroom,
	drawOwl,
	drawPaper,
	drawSkyline,
	drawSpikes,
	GROUND_Y,
	LIGHT,
} from "./filmArt";

const SCALE = 4;
const SHUTTER_RATE = 18;
const TITLE_SECONDS = 1.6;
const DEATH_CARD_DELAY = 0.5;
const BURN_SECONDS = 0.9;

export type FilmEnding = "won" | "lost" | "cut";

export interface FilmLabels {
	presents: string;
	title: string;
	controls: string;
	end: string;
	endText: string;
	intermission: string;
	intermissionText: string;
	cut: string;
}

function capTint(color: number): string {
	const tint = new THREE.Color(color).lerp(new THREE.Color(0x24130a), 0.45);

	return `#${tint.getHexString()}`;
}

export class FilmRenderer {
	readonly canvas = document.createElement("canvas");
	private readonly context: CanvasRenderingContext2D;
	private readonly cap: string;
	private shutterClock = 0;
	private brightness = 1;
	private jitter = 0;
	private scratches: number[] = [];
	private wasGrounded = true;
	private squash = 0;
	private tumble = 0;

	constructor(capColor: number) {
		this.canvas.width = FILM_WIDTH * SCALE;
		this.canvas.height = FILM_HEIGHT * SCALE;
		this.context = this.canvas.getContext("2d") as CanvasRenderingContext2D;
		this.cap = capTint(capColor);
	}

	private advanceShutter(dt: number): void {
		this.shutterClock += dt;

		if (this.shutterClock < 1 / SHUTTER_RATE) {
			return;
		}

		this.shutterClock = 0;
		this.brightness = 0.88 + Math.random() * 0.12;
		this.jitter = (Math.random() - 0.5) * 1.1;

		this.scratches = this.scratches.filter(() => Math.random() < 0.7);

		if (Math.random() < 0.3) {
			this.scratches.push(BORDER + Math.random() * (FILM_WIDTH - BORDER * 2));
		}
	}

	private drawObstacle(
		state: FilmState,
		obstacle: FilmObstacle,
		clock: number,
	): void {
		const context = this.context;
		const shape = FILM_SHAPES[obstacle.kind];
		const x = obstacleX(state, obstacle);
		const width = obstacleWidth(obstacle.kind, state.level);
		const height = shape.top - shape.bottom;

		switch (obstacle.kind) {
			case "gear":
				drawGear(context, x, width, height, -state.distance / (height / 2));
				break;

			case "candles":
				drawCandles(context, x, width, height, clock);
				break;

			case "spikes":
				drawSpikes(context, x, width, height);
				break;

			case "bat":
				drawBat(
					context,
					x,
					GROUND_Y - (shape.bottom + shape.top) / 2,
					width,
					clock,
				);

				break;

			case "chandelier":
				drawChandelier(context, x, GROUND_Y - shape.bottom, width, clock);
				break;

			case "owl":
				drawOwl(
					context,
					x,
					GROUND_Y - (shape.bottom + shape.top) / 2,
					width,
					clock,
				);

				break;
		}
	}

	private drawHero(
		state: FilmState,
		dt: number,
		ending: FilmEnding | null,
	): void {
		if (state.grounded && !this.wasGrounded) {
			this.squash = 1;
		}

		this.wasGrounded = state.grounded;
		this.squash = Math.max(0, this.squash - dt * 7);

		if (ending === "lost") {
			this.tumble = Math.min(Math.PI * 0.55, this.tumble + dt * 5);
		}

		drawMushroom(this.context, FILM_MUSHROOM_X, GROUND_Y - state.y, {
			ducking: state.ducking,
			airborne: !state.grounded,
			rising: state.vy,
			run: state.distance / 11,
			squash: this.squash,
			tumble: this.tumble,
			cap: this.cap,
		});
	}

	private drawProgress(state: FilmState): void {
		const context = this.context;

		const progress = Math.max(
			0,
			(state.tick - FILM_INTRO_TICKS) / (FILM_TOTAL_TICKS - FILM_INTRO_TICKS),
		);

		const left = FILM_WIDTH / 2 - 50;

		context.fillStyle = "rgba(20, 10, 2, 0.55)";

		context.fillRect(left, 8, 100, 2.2);

		context.fillStyle = LIGHT;

		context.fillRect(left, 8, 100 * progress, 2.2);

		context.beginPath();
		context.arc(left + 100 * progress, 9.1, 2.6, 0, Math.PI * 2);
		context.fill();
	}

	private drawEnding(
		ending: FilmEnding,
		since: number,
		labels: FilmLabels,
	): void {
		const context = this.context;

		if (ending === "lost") {
			context.fillStyle = `rgba(120, 10, 0, ${Math.min(0.45, since * 0.9)})`;

			context.fillRect(0, 0, FILM_WIDTH, FILM_HEIGHT);

			if (since > DEATH_CARD_DELAY) {
				this.card(
					[
						{ text: labels.end, size: 42, title: true, color: "#f6d0b0" },
						{ text: labels.endText, size: 11 },
					],
					Math.min(1, (since - DEATH_CARD_DELAY) * 3),
					"#1a0402",
				);
			}

			return;
		}

		if (ending === "won") {
			drawBurn(context, Math.min(1.4, since / BURN_SECONDS));

			if (since > BURN_SECONDS) {
				this.card(
					[
						{ text: labels.intermission, size: 30, title: true },
						{ text: labels.intermissionText, size: 11 },
					],
					Math.min(1, (since - BURN_SECONDS) * 3),
				);
			}

			return;
		}

		this.card([{ text: labels.cut, size: 13 }], Math.min(1, since * 3));
	}

	private card(lines: readonly CardLine[], alpha: number, tint?: string): void {
		drawCard(this.context, lines, alpha, tint);
	}

	draw(
		state: FilmState,
		labels: FilmLabels,
		dt: number,
		clock: number,
		ending: FilmEnding | null,
		endingSince: number,
	): void {
		const context = this.context;
		const filmTime = state.tick / FILM_TICK_RATE;
		const intro = FILM_INTRO_TICKS / FILM_TICK_RATE;
		const frozen = ending !== null;

		if (!frozen) {
			this.advanceShutter(dt);
		}

		context.setTransform(SCALE, 0, 0, SCALE, 0, 0);
		context.save();
		context.translate(0, this.jitter);

		drawPaper(context, this.brightness);
		drawMoon(context, clock);
		drawSkyline(context, state.distance * 0.12);
		drawGraveyard(context, state.distance * 0.4);

		for (const obstacle of state.obstacles) {
			if (obstacleVisible(state, obstacle)) {
				this.drawObstacle(state, obstacle, clock);
			}
		}

		drawGround(context, state.distance);
		this.drawHero(state, dt, ending);
		context.restore();

		drawGrain(context, this.scratches);
		drawFilmBorders(context, frozen ? 0 : clock);

		if (filmTime >= intro) {
			this.drawProgress(state);
		} else if (filmTime >= TITLE_SECONDS) {
			drawLeader(context, intro - filmTime);
			drawCaption(context, labels.controls);
		} else {
			this.card(
				[
					{ text: labels.presents, size: 12 },
					{ text: labels.title, size: 22, title: true },
				],
				Math.min(1, (TITLE_SECONDS - filmTime) * 4),
			);
		}

		if (ending) {
			this.drawEnding(ending, endingSince, labels);
		}
	}
}
