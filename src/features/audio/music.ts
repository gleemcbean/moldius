import { audioEngine } from "./audioEngine";
import {
	type MusicMode,
	type MusicTrackConfig,
	musicLoopBounds,
	musicTrackFor,
} from "./musicLoop";

export type { MusicMode };

interface PlayingTrack {
	id: string;
	source: AudioBufferSourceNode;
	gain: GainNode;
}

const TRACK_URLS = import.meta.glob<string>(
	"../../assets/music/*.{ogg,opus,mp3,m4a,aac,wav,flac,webm}",
	{ eager: true, query: "?url&no-inline", import: "default" },
);
const TRACK_CONFIGS = import.meta.glob<Record<string, MusicTrackConfig>>(
	"../../assets/music/music.json",
	{ eager: true, import: "default" },
);
const TRACK_NAME = /([^/]+)\.[a-z0-9]+$/i;
const LEVELS: Record<MusicMode, number> = { menu: 0.5, game: 0.22 };
const FADE_IN_TAU = 1.2;
const MODE_TAU = 0.6;
const FADE_OUT_TAU = 0.7;
const FADE_OUT_STOP_S = 4;

const TRACKS = new Map<string, string>(
	Object.entries(TRACK_URLS).flatMap(([path, url]) => {
		const match = TRACK_NAME.exec(path);
		return match ? [[match[1], url] as const] : [];
	}),
);
const CONFIG: Record<string, MusicTrackConfig> =
	Object.values(TRACK_CONFIGS)[0] ?? {};

class MusicPlayer {
	private mode: MusicMode = "menu";
	private started = false;
	private playing: PlayingTrack | null = null;
	private request = 0;
	private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();

	start(): void {
		if (this.started || !audioEngine.ready) {
			return;
		}
		this.started = true;
		void this.play();
	}

	setMode(mode: MusicMode): void {
		if (mode === this.mode) {
			return;
		}
		this.mode = mode;
		if (this.started) {
			void this.play();
		}
	}

	private level(id: string): number {
		return LEVELS[this.mode] * (CONFIG[id]?.volume ?? 1);
	}

	private load(id: string): Promise<AudioBuffer | null> {
		let pending = this.buffers.get(id);
		if (!pending) {
			const url = TRACKS.get(id);
			pending = url ? decode(url) : Promise.resolve(null);
			this.buffers.set(id, pending);
		}
		return pending;
	}

	private async play(): Promise<void> {
		const request = ++this.request;
		const id = musicTrackFor(this.mode, TRACKS);
		const context = audioEngine.ctx;
		if (this.playing && this.playing.id === id) {
			this.playing.gain.gain.setTargetAtTime(
				this.level(id),
				context.currentTime,
				MODE_TAU,
			);
			return;
		}
		const buffer = id ? await this.load(id) : null;
		if (request !== this.request) {
			return;
		}
		const previous = this.playing;
		this.playing = null;
		if (previous) {
			fadeOut(context, previous);
		}
		if (!id || !buffer) {
			return;
		}
		const source = context.createBufferSource();
		source.buffer = buffer;
		source.loop = true;
		const bounds = musicLoopBounds(CONFIG[id], buffer.duration);
		source.loopStart = bounds.start;
		source.loopEnd = bounds.end;
		const gain = context.createGain();
		gain.gain.value = 0;
		gain.gain.setTargetAtTime(this.level(id), context.currentTime, FADE_IN_TAU);
		source.connect(gain).connect(audioEngine.bus("music"));
		source.onended = () => {
			source.disconnect();
			gain.disconnect();
		};
		source.start();
		this.playing = { id, source, gain };
	}
}

function fadeOut(context: AudioContext, track: PlayingTrack): void {
	track.gain.gain.setTargetAtTime(0, context.currentTime, FADE_OUT_TAU);
	try {
		track.source.stop(context.currentTime + FADE_OUT_STOP_S);
	} catch {
		track.source.disconnect();
	}
}

async function decode(url: string): Promise<AudioBuffer | null> {
	try {
		const response = await fetch(url);
		return response.ok
			? await audioEngine.ctx.decodeAudioData(await response.arrayBuffer())
			: null;
	} catch {
		return null;
	}
}

export const music = new MusicPlayer();
