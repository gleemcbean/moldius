export type MusicMode = "menu" | "game";

export interface MusicTrackConfig {
	loopStart?: number;
	loopEnd?: number;
	volume?: number;
}

const FALLBACK_TRACK = "ambient";

export function musicTrackFor(
	mode: MusicMode,
	available: ReadonlySet<string> | ReadonlyMap<string, unknown>,
): string | null {
	for (const id of [mode, FALLBACK_TRACK]) {
		if (available.has(id)) {
			return id;
		}
	}

	return [...available.keys()].sort()[0] ?? null;
}

export function musicLoopBounds(
	config: MusicTrackConfig | undefined,
	duration: number,
): { start: number; end: number } {
	const end =
		config?.loopEnd !== undefined && config.loopEnd > 0
			? Math.min(config.loopEnd, duration)
			: duration;

	const start = Math.min(Math.max(0, config?.loopStart ?? 0), end);

	return start < end ? { start, end } : { start: 0, end: duration };
}
