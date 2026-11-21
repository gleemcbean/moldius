import { createStore } from "../../utils/store";

export const MAX_PEER_VOLUME = 2;

export interface VoicePrefs {
	volumes: Record<string, number>;
	muted: Record<string, boolean>;
}

export const voicePrefsStore = createStore<VoicePrefs>({
	volumes: {},
	muted: {},
});

export function peerVolume(playerId: string): number {
	return voicePrefsStore.get().volumes[playerId] ?? 1;
}

export function isPeerMuted(playerId: string): boolean {
	return voicePrefsStore.get().muted[playerId] ?? false;
}

export function peerGain(playerId: string): number {
	return isPeerMuted(playerId) ? 0 : peerVolume(playerId);
}

export function setPeerMuted(playerId: string, muted: boolean): void {
	voicePrefsStore.set((state) => ({
		muted: { ...state.muted, [playerId]: muted },
	}));
}

export function setPeerVolume(playerId: string, volume: number): void {
	const clamped = Math.min(MAX_PEER_VOLUME, Math.max(0, volume));

	voicePrefsStore.set((state) => ({
		volumes: { ...state.volumes, [playerId]: clamped },
		muted: { ...state.muted, [playerId]: clamped === 0 },
	}));
}
