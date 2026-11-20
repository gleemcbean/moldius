import {
	createFilm,
	FILM_INPUT,
	FILM_MAX_INPUTS,
	FILM_TICK_MS,
	type FilmState,
	stepFilm,
} from "@shared/minigames/filmRunner";
import type { SeancePhase } from "@shared/protocol/game";
import { type SoundHandle, soundBank } from "../audio/soundBank";
import { rumble } from "../gamepad/rumble";
import { hudStore } from "../hud/hudStore";
import { type FilmEnding, type FilmLabels, FilmRenderer } from "./FilmRenderer";

const MAX_FRAME_SECONDS = 0.25;
const INPUT_ROOM = FILM_MAX_INPUTS * 2 - 2;

export interface FilmButtons {
	jump: boolean;
	duck: boolean;
}

export interface SeanceStart {
	anomalyId: number;
	seed: number;
	level: number;
}

export class FilmController {
	readonly renderer: FilmRenderer;
	private state: FilmState | null = null;
	private anomalyId = -1;
	private inputs: number[] = [];
	private accumulator = 0;
	private pendingJump = false;
	private duck = false;
	private recordedDuck = false;
	private reported = false;
	private ending: FilmEnding | null = null;
	private endingSince = 0;
	private clock = 0;
	private closeAt = 0;
	private music: SoundHandle | null = null;
	private whirr: SoundHandle | null = null;

	constructor(
		capColor: number,
		private readonly labels: () => FilmLabels,
		private readonly report: (anomalyId: number, inputs: number[]) => void,
	) {
		this.renderer = new FilmRenderer(capColor);
	}

	get active(): boolean {
		return this.state !== null;
	}

	get canvas(): HTMLCanvasElement {
		return this.renderer.canvas;
	}

	start(start: SeanceStart): void {
		this.stopSounds();

		this.state = createFilm(start.seed, start.level);
		this.anomalyId = start.anomalyId;
		this.inputs = [];
		this.accumulator = 0;
		this.pendingJump = false;
		this.duck = false;
		this.recordedDuck = false;
		this.reported = false;
		this.ending = null;
		this.endingSince = 0;
		this.clock = 0;
		this.closeAt = 0;

		this.music = soundBank.play("film-piano", {
			bus: "music",
			loop: true,
			volume: 0.6,
		});

		this.whirr = soundBank.play("cinema-idle", { loop: true, volume: 0.35 });

		rumble("scare", { scale: 0.4 });
		hudStore.set({ film: true });
	}

	update(dt: number, buttons: FilmButtons): void {
		const state = this.state;

		if (!state) {
			return;
		}

		this.clock += dt;

		if (this.ending) {
			this.endingSince += dt;
		} else {
			this.play(state, dt, buttons);
		}

		this.renderer.draw(
			state,
			this.labels(),
			dt,
			this.clock,
			this.ending,
			this.endingSince,
		);

		if (this.closeAt > 0 && this.clock >= this.closeAt) {
			this.stop();
		}
	}

	private play(state: FilmState, dt: number, buttons: FilmButtons): void {
		if (buttons.jump) {
			this.pendingJump = true;
		}

		this.duck = buttons.duck;
		this.accumulator += Math.min(dt, MAX_FRAME_SECONDS) * 1000;

		while (this.accumulator >= FILM_TICK_MS && state.outcome === "playing") {
			this.accumulator -= FILM_TICK_MS;

			this.tick(state);
		}

		if (state.outcome !== "playing") {
			this.finish(state.outcome);
		}
	}

	private tick(state: FilmState): void {
		const jump = this.pendingJump && this.inputs.length < INPUT_ROOM;
		const jumps = state.jumps;

		this.pendingJump = false;

		if (jump) {
			this.inputs.push(state.tick, FILM_INPUT.jump);
		}

		if (this.duck !== this.recordedDuck && this.inputs.length < INPUT_ROOM) {
			this.recordedDuck = this.duck;

			this.inputs.push(
				state.tick,
				this.duck ? FILM_INPUT.duck : FILM_INPUT.rise,
			);
		}

		stepFilm(state, jump, this.recordedDuck);

		if (state.jumps > jumps) {
			soundBank.play("film-jump", { bus: "ui", volume: 0.5 });
		}
	}

	private finish(outcome: "won" | "lost"): void {
		this.ending = outcome;
		this.endingSince = 0;

		if (!this.reported) {
			this.reported = true;

			this.report(this.anomalyId, this.inputs);
		}

		this.music?.stop(0.3);

		this.music = null;

		soundBank.play(outcome === "won" ? "film-win" : "film-fin", {
			bus: "ui",
			volume: 0.9,
		});

		rumble(outcome === "won" ? "pickup" : "hit");
	}

	resolve(phase: SeancePhase): void {
		if (!this.state || phase === "start") {
			return;
		}

		if (phase === "cancel") {
			this.ending = "cut";
			this.endingSince = 0;
		} else if (this.ending !== phase) {
			this.ending = phase;
			this.endingSince = 0;
		}

		this.closeAt = this.clock + (phase === "won" ? 2.8 : 2.2);
	}

	stop(): void {
		this.state = null;
		this.closeAt = 0;

		this.stopSounds();
		hudStore.set({ film: false });
	}

	private stopSounds(): void {
		this.music?.stop(0.4);
		this.whirr?.stop(0.4);

		this.music = null;
		this.whirr = null;
	}
}
