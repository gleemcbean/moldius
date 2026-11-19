import { audioEngine } from "./audioEngine";
import { soundBank } from "./soundBank";

export type MusicMode = "menu" | "game";

const LEVELS: Record<MusicMode, number> = { menu: 0.5, game: 0.22 };
const LOOKAHEAD_S = 6;
const TICK_MS = 1000;
const CHORD_S = 14;
const CHORD_SOUND = "music-chord";
const NOTE_SOUND = "music-note";
const NEXT_CHORDS = [
	[1, 2, 3],
	[2, 0, 4],
	[3, 0],
	[0, 1],
	[0, 2],
] as const;

function pick<T>(items: readonly T[]): T {
	return items[Math.floor(Math.random() * items.length)];
}

class MusicPlayer {
	private output: GainNode | null = null;
	private timer: number | null = null;
	private mode: MusicMode = "menu";
	private chord = 0;
	private chordAt = 0;
	private noteAt = 0;

	start(): void {
		if (this.timer !== null || !audioEngine.ready) {
			return;
		}
		const context = audioEngine.ctx;
		if (!this.output) {
			this.output = context.createGain();
			this.output.gain.value = 0;
			this.output.connect(audioEngine.bus("music"));
		}
		this.chordAt = context.currentTime + 0.1;
		this.noteAt = context.currentTime + 3;
		this.output.gain.setTargetAtTime(
			LEVELS[this.mode],
			context.currentTime,
			2.5,
		);
		this.timer = window.setInterval(() => this.schedule(), TICK_MS);
		this.schedule();
	}

	setMode(mode: MusicMode): void {
		if (mode === this.mode) {
			return;
		}
		this.mode = mode;
		if (this.output) {
			this.output.gain.setTargetAtTime(
				LEVELS[mode],
				audioEngine.ctx.currentTime,
				1.5,
			);
		}
	}

	private schedule(): void {
		const context = audioEngine.ctx;
		if (context.state !== "running") {
			return;
		}
		const now = context.currentTime;
		this.chordAt = Math.max(this.chordAt, now + 0.05);
		this.noteAt = Math.max(this.noteAt, now + 0.05);
		while (this.chordAt < now + LOOKAHEAD_S) {
			const chord = soundBank.buffer(CHORD_SOUND, this.chord);
			if (!chord) {
				break;
			}
			this.play(context, chord, this.chordAt, null);
			this.chordAt += CHORD_S;
			this.chord = pick(NEXT_CHORDS[this.chord]);
		}
		while (this.noteAt < now + LOOKAHEAD_S) {
			const note = soundBank.buffer(NOTE_SOUND);
			if (note && Math.random() < 0.7) {
				this.play(context, note, this.noteAt, Math.random() * 0.8 - 0.4);
			}
			this.noteAt += 2.2 + Math.random() * 4.5;
		}
	}

	private play(
		context: AudioContext,
		buffer: AudioBuffer,
		time: number,
		pan: number | null,
	): void {
		const output = this.output as GainNode;
		const source = context.createBufferSource();
		source.buffer = buffer;
		let panner: StereoPannerNode | null = null;
		if (pan === null) {
			source.connect(output);
		} else {
			panner = context.createStereoPanner();
			panner.pan.value = pan;
			source.connect(panner).connect(output);
		}
		source.onended = () => {
			source.disconnect();
			panner?.disconnect();
		};
		source.start(time);
	}
}

export const music = new MusicPlayer();
