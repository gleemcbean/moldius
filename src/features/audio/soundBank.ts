import loops from "../../assets/sounds/loops.json";
import { type AudioBus, audioEngine, setPannerPosition } from "./audioEngine";

const SOUND_URLS = import.meta.glob<string>("../../assets/sounds/*.ogg", {
	eager: true,
	query: "?url&no-inline",
	import: "default",
});

const SOUND_NAME = /([^/]+?)(?:\.(\d+))?\.ogg$/;
const LOOP_ENDS: Record<string, number> = loops;
const LOAD_CONCURRENCY = 6;
const LOAD_PRIORITY = ["ui-"];

interface SoundFile {
	id: string;
	variant: number;
	url: string;
}

const SOUND_FILES: SoundFile[] = Object.entries(SOUND_URLS)
	.flatMap(([path, url]) => {
		const match = SOUND_NAME.exec(path);

		return match ? [{ id: match[1], variant: Number(match[2] ?? 0), url }] : [];
	})
	.sort((a, b) => priorityOf(a.id) - priorityOf(b.id));

function priorityOf(id: string): number {
	const index = LOAD_PRIORITY.findIndex((prefix) => id.startsWith(prefix));

	return index === -1 ? LOAD_PRIORITY.length : index;
}

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
	private readonly loadedFiles = new Set<SoundFile>();
	private readonly listeners = new Set<(fraction: number) => void>();
	private loading: Promise<void> | null = null;

	get isLoaded(): boolean {
		return this.loadedFiles.size === SOUND_FILES.length;
	}

	private get progress(): number {
		return SOUND_FILES.length === 0
			? 1
			: this.loadedFiles.size / SOUND_FILES.length;
	}

	load(onProgress?: (fraction: number) => void): Promise<void> {
		if (onProgress) {
			onProgress(this.progress);
			this.listeners.add(onProgress);
		}

		this.loading ??= this.fetchMissing().finally(() => {
			this.loading = null;

			this.listeners.clear();
		});

		return this.loading;
	}

	private async fetchMissing(): Promise<void> {
		const queue = SOUND_FILES.filter((file) => !this.loadedFiles.has(file));

		const worker = async () => {
			for (let file = queue.shift(); file; file = queue.shift()) {
				const buffer = await decode(file.url);

				if (!buffer) {
					continue;
				}

				const variants = this.buffers.get(file.id) ?? [];

				variants[file.variant] = buffer;

				this.buffers.set(file.id, variants);
				this.loadedFiles.add(file);

				for (const listener of this.listeners) {
					listener(this.progress);
				}
			}
		};

		await Promise.all(Array.from({ length: LOAD_CONCURRENCY }, worker));
	}

	has(id: string): boolean {
		return this.buffers.has(id);
	}

	buffer(id: string, variant?: number): AudioBuffer | null {
		const variants = this.buffers.get(id);

		if (!variants || variants.length === 0) {
			return null;
		}

		return (
			variants[variant ?? Math.floor(Math.random() * variants.length)] ?? null
		);
	}

	play(id: string, options: PlayOptions = {}): SoundHandle | null {
		if (!audioEngine.ready) {
			return null;
		}

		if (
			!options.loop &&
			options.bus !== "ui" &&
			this.active.size >= MAX_ONE_SHOTS
		) {
			return null;
		}

		const buffer = this.buffer(id, options.variant);

		if (!buffer) {
			return null;
		}

		const context = audioEngine.ctx;
		const source = context.createBufferSource();

		source.buffer = buffer;
		source.loop = options.loop ?? false;

		if (source.loop) {
			source.loopStart = 0;
			source.loopEnd = LOOP_ENDS[id] ?? buffer.duration;
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

export const soundBank = new SoundBank();
