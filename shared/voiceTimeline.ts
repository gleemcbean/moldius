export const VOICE_SAMPLE_RATE = 16_000;

/** Les dernières secondes restent en mémoire : un moment se repère après coup. */
export const VOICE_ROLLING_MS = 12_000;

const RESYNC_MS = 200;
const SILENCE_PEAK = 120;
const INT16_SCALE = 32_768;

export interface TimeWindow {
	from: number;
	to: number;
}

interface VoiceChunk {
	start: number;
	end: number;
	samples: Int16Array;
}

/**
 * La voix d'un joueur, en petits morceaux datés à l'heure du serveur. Les blancs ne
 * sont pas gardés et seul le passage récent ou un moment marquant reste en mémoire.
 */
export class VoiceTimeline {
	private chunks: VoiceChunk[] = [];
	private nextStart: number | null = null;

	get chunkCount(): number {
		return this.chunks.length;
	}

	/** Les morceaux arrivent avec du jeu : on les enchaîne pour éviter les clics. */
	push(samples: Int16Array, now: number): void {
		const duration = (samples.length / VOICE_SAMPLE_RATE) * 1000;
		const expected = now - duration;
		const start =
			this.nextStart !== null && Math.abs(this.nextStart - expected) < RESYNC_MS
				? this.nextStart
				: expected;
		this.nextStart = start + duration;
		let peak = 0;
		for (const sample of samples) {
			peak = Math.max(peak, Math.abs(sample));
		}
		if (peak >= SILENCE_PEAK) {
			this.chunks.push({ start, end: start + duration, samples });
		}
	}

	trim(now: number, keep: readonly TimeWindow[]): void {
		const recent = now - VOICE_ROLLING_MS;
		this.chunks = this.chunks.filter(
			(chunk) =>
				chunk.end >= recent ||
				keep.some(
					(window) => chunk.end >= window.from && chunk.start <= window.to,
				),
		);
	}

	/** Null s'il n'y a que du silence sur cette période. */
	extract(from: number, to: number): Float32Array<ArrayBuffer> | null {
		const length = Math.max(
			0,
			Math.round(((to - from) / 1000) * VOICE_SAMPLE_RATE),
		);
		const output = new Float32Array(new ArrayBuffer(length * 4));
		let found = false;
		for (const chunk of this.chunks) {
			if (chunk.end <= from || chunk.start >= to) {
				continue;
			}
			const offset = Math.round(
				((chunk.start - from) / 1000) * VOICE_SAMPLE_RATE,
			);
			for (let index = 0; index < chunk.samples.length; index += 1) {
				const position = offset + index;
				if (position >= 0 && position < length) {
					output[position] = chunk.samples[index] / INT16_SCALE;
					found = true;
				}
			}
		}
		return found ? output : null;
	}

	clear(): void {
		this.chunks = [];
		this.nextStart = null;
	}
}
