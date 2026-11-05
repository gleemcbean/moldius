import { hashString } from "@shared/random";
import { type AudioBus, audioEngine, setPannerPosition } from "./audioEngine";
import { AMBIENCE_SOUNDS } from "./recipes/ambienceSounds";
import { ANOMALY_SOUNDS } from "./recipes/anomalySounds";
import { PLAYER_SOUNDS } from "./recipes/playerSounds";
import type { SoundRecipe } from "./recipes/types";
import { SynthKit } from "./synthKit";

export const ALL_RECIPES: SoundRecipe[] = [
	...PLAYER_SOUNDS,
	...ANOMALY_SOUNDS,
	...AMBIENCE_SOUNDS,
];

export interface PlayOptions {
	bus?: AudioBus;
	volume?: number;
	rate?: number;
	position?: { x: number; y: number; z: number };
	loop?: boolean;
	refDistance?: number;
	maxDistance?: number;
	rolloff?: number;
	variant?: number;
	occlusion?: number;
}

export interface SoundHandle {
	readonly source: AudioBufferSourceNode;
	readonly gain: GainNode;
	readonly filter: BiquadFilterNode;
	readonly panner: PannerNode | null;
	setPosition(x: number, y: number, z: number): void;
	setVolume(volume: number): void;
	setOcclusion(amount: number): void;
	stop(fadeSeconds?: number): void;
	ended: boolean;
}

const MAX_ONE_SHOTS = 28;

class SoundBank {
	private readonly buffers = new Map<string, AudioBuffer[]>();
	private readonly active = new Set<SoundHandle>();
	private readonly lastPlayed = new Map<string, number>();
	private readonly loopEnds = new Map<AudioBuffer, number>();
	private loaded = false;

	get isLoaded(): boolean {
		return this.loaded;
	}

	async load(onProgress: (fraction: number) => void): Promise<void> {
		if (this.loaded) {
			onProgress(1);
			return;
		}
		const sampleRate = audioEngine.ctx.sampleRate;
		const total = ALL_RECIPES.reduce((sum, recipe) => sum + recipe.variants, 0);
		let done = 0;
		for (const recipe of ALL_RECIPES) {
			const variants: AudioBuffer[] = [];
			for (let variant = 0; variant < recipe.variants; variant += 1) {
				const context = new OfflineAudioContext(
					1,
					Math.ceil(sampleRate * recipe.duration),
					sampleRate,
				);
				recipe.render(
					new SynthKit(context, hashString(`${recipe.id}:${variant}`)),
					variant,
				);
				const buffer = await context.startRendering();
				if (recipe.loop) {
					this.loopEnds.set(buffer, smoothLoop(buffer));
				}
				variants.push(buffer);
				done += 1;
				onProgress(done / total);
			}
			this.buffers.set(recipe.id, variants);
		}
		this.loaded = true;
	}

	has(id: string): boolean {
		return this.buffers.has(id);
	}

	play(id: string, options: PlayOptions = {}): SoundHandle | null {
		const variants = this.buffers.get(id);
		if (!variants || variants.length === 0 || !audioEngine.ready) {
			return null;
		}
		if (!options.loop && this.active.size >= MAX_ONE_SHOTS) {
			return null;
		}
		const context = audioEngine.ctx;
		const buffer =
			variants[options.variant ?? Math.floor(Math.random() * variants.length)];
		const source = context.createBufferSource();
		source.buffer = buffer;
		source.loop = options.loop ?? false;
		if (source.loop) {
			source.loopStart = 0;
			source.loopEnd = this.loopEnds.get(buffer) ?? buffer.duration;
		}
		source.playbackRate.value = options.rate ?? 1;
		const gain = context.createGain();
		gain.gain.value = options.volume ?? 1;
		const filter = context.createBiquadFilter();
		filter.type = "lowpass";
		filter.frequency.value = 20000;
		source.connect(filter).connect(gain);
		let panner: PannerNode | null = null;
		if (options.position) {
			panner = audioEngine.createPanner(
				options.refDistance ?? 1.5,
				options.maxDistance ?? 40,
				options.rolloff ?? 1.3,
			);
			setPannerPosition(
				panner,
				options.position.x,
				options.position.y,
				options.position.z,
			);
			if (panner.positionX) {
				panner.positionX.value = options.position.x;
				panner.positionY.value = options.position.y;
				panner.positionZ.value = options.position.z;
			}
			gain.connect(panner).connect(audioEngine.bus(options.bus ?? "effects"));
		} else {
			gain.connect(audioEngine.bus(options.bus ?? "effects"));
		}
		const handle: SoundHandle = {
			source,
			gain,
			filter,
			panner,
			ended: false,
			setPosition: (x, y, z) => {
				if (panner) {
					setPannerPosition(panner, x, y, z);
				}
			},
			setVolume: (volume) => {
				gain.gain.setTargetAtTime(volume, context.currentTime, 0.05);
			},
			setOcclusion: (amount) => {
				filter.frequency.setTargetAtTime(
					20000 * 0.12 ** amount,
					context.currentTime,
					0.08,
				);
			},
			stop: (fadeSeconds = 0.08) => {
				if (handle.ended) {
					return;
				}
				gain.gain.setTargetAtTime(0, context.currentTime, fadeSeconds / 3);
				try {
					source.stop(context.currentTime + fadeSeconds + 0.05);
				} catch {
					return;
				}
			},
		};
		if (options.occlusion) {
			handle.setOcclusion(options.occlusion);
		}
		source.onended = () => {
			handle.ended = true;
			this.active.delete(handle);
			source.disconnect();
			gain.disconnect();
			panner?.disconnect();
		};
		this.active.add(handle);
		source.start();
		return handle;
	}

	playThrottled(
		id: string,
		minIntervalMs: number,
		options: PlayOptions = {},
		key = id,
	): SoundHandle | null {
		const now = performance.now();
		if (now - (this.lastPlayed.get(key) ?? -Infinity) < minIntervalMs) {
			return null;
		}
		this.lastPlayed.set(key, now);
		return this.play(id, options);
	}

	stopAll(): void {
		for (const handle of [...this.active]) {
			handle.stop(0.2);
		}
	}
}

function smoothLoop(buffer: AudioBuffer): number {
	const data = buffer.getChannelData(0);
	const fade = Math.min(
		Math.floor(buffer.sampleRate * 0.25),
		Math.floor(data.length / 4),
	);
	for (let index = 0; index < fade; index += 1) {
		const t = index / fade;
		const head = data[index];
		const tail = data[data.length - fade + index];
		data[index] = head * t + tail * (1 - t);
	}
	return (data.length - fade) / buffer.sampleRate;
}

export const soundBank = new SoundBank();
