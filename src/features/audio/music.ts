import { audioEngine } from "./audioEngine";

export type MusicMode = "menu" | "game";

const LEVELS: Record<MusicMode, number> = { menu: 0.5, game: 0.22 };
const LOOKAHEAD_S = 6;
const TICK_MS = 1000;
const CHORD_S = 14;
const CHORDS = [
	[45, 57, 60, 64],
	[41, 57, 60, 65],
	[38, 57, 62, 65],
	[40, 56, 59, 64],
	[43, 55, 59, 62],
] as const;
const NEXT_CHORDS = [
	[1, 2, 3],
	[2, 0, 4],
	[3, 0],
	[0, 1],
	[0, 2],
] as const;
const MELODY = [69, 71, 72, 74, 76, 79, 81] as const;

function frequency(midi: number): number {
	return 440 * 2 ** ((midi - 69) / 12);
}

function pick<T>(items: readonly T[]): T {
	return items[Math.floor(Math.random() * items.length)];
}

class MusicPlayer {
	private output: GainNode | null = null;
	private echo: GainNode | null = null;
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
			this.echo = this.createEcho(context, this.output);
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

	private createEcho(context: AudioContext, destination: AudioNode): GainNode {
		const input = context.createGain();
		const delay = context.createDelay(1);
		delay.delayTime.value = 0.46;
		const feedback = context.createGain();
		feedback.gain.value = 0.38;
		const tone = context.createBiquadFilter();
		tone.type = "lowpass";
		tone.frequency.value = 1800;
		input.connect(destination);
		input.connect(delay);
		delay.connect(tone).connect(feedback).connect(delay);
		tone.connect(destination);
		return input;
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
			this.playChord(context, this.chordAt);
			this.chordAt += CHORD_S;
			this.chord = pick(NEXT_CHORDS[this.chord]);
		}
		while (this.noteAt < now + LOOKAHEAD_S) {
			if (Math.random() < 0.7) {
				this.playNote(context, this.noteAt);
			}
			this.noteAt += 2.2 + Math.random() * 4.5;
		}
	}

	private playChord(context: AudioContext, time: number): void {
		const [root, ...tones] = CHORDS[this.chord];
		const end = time + CHORD_S + 9;
		const envelope = context.createGain();
		envelope.gain.setValueAtTime(0, time);
		envelope.gain.linearRampToValueAtTime(1, time + 5);
		envelope.gain.setTargetAtTime(0, time + CHORD_S, 2.4);
		envelope.connect(this.output as GainNode);
		const filter = context.createBiquadFilter();
		filter.type = "lowpass";
		filter.Q.value = 0.4;
		filter.frequency.setValueAtTime(420, time);
		filter.frequency.linearRampToValueAtTime(820, time + CHORD_S * 0.55);
		filter.frequency.linearRampToValueAtTime(460, time + CHORD_S + 4);
		filter.connect(envelope);
		for (const midi of tones) {
			for (const detune of [-7, 7]) {
				const voice = context.createOscillator();
				voice.type = "triangle";
				voice.frequency.value = frequency(midi);
				voice.detune.value = detune;
				const level = context.createGain();
				level.gain.value = 0.045;
				voice.connect(level).connect(filter);
				voice.start(time);
				voice.stop(end);
			}
		}
		const bass = context.createOscillator();
		bass.type = "sine";
		bass.frequency.value = frequency(root);
		const bassLevel = context.createGain();
		bassLevel.gain.value = 0.11;
		bass.connect(bassLevel).connect(envelope);
		bass.start(time);
		bass.stop(end);
	}

	private playNote(context: AudioContext, time: number): void {
		const midi = pick(MELODY);
		const envelope = context.createGain();
		envelope.gain.setValueAtTime(0, time);
		envelope.gain.linearRampToValueAtTime(0.05, time + 0.012);
		envelope.gain.setTargetAtTime(0, time + 0.012, 0.9);
		const pan = context.createStereoPanner();
		pan.pan.value = Math.random() * 0.8 - 0.4;
		envelope.connect(pan).connect(this.echo as GainNode);
		for (const [ratio, level] of [
			[1, 1],
			[3, 0.12],
		] as const) {
			const partial = context.createOscillator();
			partial.type = "sine";
			partial.frequency.value = frequency(midi) * ratio;
			const gain = context.createGain();
			gain.gain.value = level;
			partial.connect(gain).connect(envelope);
			partial.start(time);
			partial.stop(time + 5);
		}
	}
}

export const music = new MusicPlayer();
