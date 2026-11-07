import {
	VOICE_PROXIMITY_FULL_RANGE,
	VOICE_PROXIMITY_MAX_RANGE,
} from "@shared/config/index";
import { VoiceClipGate } from "@shared/doubleDisguise";
import { audioEngine, setPannerPosition } from "../audio/audioEngine";
import { createRadioFilter } from "./radioEffect";
import { voiceChat } from "./voiceChat";

const MAX_CLIPS_PER_PLAYER = 6;

interface PeerClips {
	gate: VoiceClipGate;
	recorder: MediaRecorder | null;
	chunks: Blob[];
	clips: AudioBuffer[];
	lastPlayed: AudioBuffer | null;
}

export interface VoicePlayback {
	ended: boolean;
	place(position: { x: number; y: number; z: number }, occlusion: number): void;
	stop(): void;
}

/**
 * Bouts de phrases des autres joueurs, comme l'annoncent les conditions
 * d'utilisation. Ils restent en mémoire, sur cette machine et pour cette partie :
 * rien n'est envoyé ni sauvegardé.
 */
class DoubleVoiceBank {
	private readonly peers = new Map<string, PeerClips>();

	update(players: ReadonlySet<string>): void {
		for (const id of [...this.peers.keys()]) {
			if (!players.has(id)) {
				this.forget(id);
			}
		}
		if (typeof MediaRecorder === "undefined") {
			return;
		}
		const now = performance.now();
		for (const id of players) {
			const peer = this.peer(id);
			const action = peer.gate.step(voiceChat.levelOf(id), now);
			if (action === "start") {
				this.startRecording(id, peer);
			} else if (action !== null) {
				this.stopRecording(id, peer, action === "keep");
			}
		}
	}

	clipFor(id: string): AudioBuffer | null {
		const peer = this.peers.get(id);
		if (!peer || peer.clips.length === 0) {
			return null;
		}
		const fresh = peer.clips.filter((clip) => clip !== peer.lastPlayed);
		const pool = fresh.length > 0 ? fresh : peer.clips;
		const clip = pool[Math.floor(Math.random() * pool.length)];
		peer.lastPlayed = clip;
		return clip;
	}

	clear(): void {
		for (const id of [...this.peers.keys()]) {
			this.forget(id);
		}
	}

	private peer(id: string): PeerClips {
		let peer = this.peers.get(id);
		if (!peer) {
			peer = {
				gate: new VoiceClipGate(),
				recorder: null,
				chunks: [],
				clips: [],
				lastPlayed: null,
			};
			this.peers.set(id, peer);
		}
		return peer;
	}

	private forget(id: string): void {
		const peer = this.peers.get(id);
		if (peer) {
			this.stopRecording(id, peer, false);
			peer.clips.length = 0;
			this.peers.delete(id);
		}
	}

	private startRecording(id: string, peer: PeerClips): void {
		const stream = voiceChat.remoteStream(id);
		if (!stream || peer.recorder) {
			return;
		}
		try {
			const recorder = new MediaRecorder(stream);
			peer.chunks = [];
			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					peer.chunks.push(event.data);
				}
			};
			recorder.start();
			peer.recorder = recorder;
		} catch {
			peer.recorder = null;
		}
	}

	private stopRecording(id: string, peer: PeerClips, keep: boolean): void {
		const recorder = peer.recorder;
		if (!recorder) {
			return;
		}
		peer.recorder = null;
		recorder.onstop = () => {
			if (keep && peer.chunks.length > 0) {
				void this.store(
					id,
					peer,
					new Blob(peer.chunks, { type: recorder.mimeType }),
				);
			}
			peer.chunks = [];
		};
		if (recorder.state !== "inactive") {
			recorder.stop();
		}
	}

	private async store(id: string, peer: PeerClips, clip: Blob): Promise<void> {
		try {
			const buffer = await audioEngine.ctx.decodeAudioData(
				await clip.arrayBuffer(),
			);
			if (this.peers.get(id) === peer) {
				peer.clips.push(buffer);
				if (peer.clips.length > MAX_CLIPS_PER_PLAYER) {
					peer.clips.shift();
				}
			}
		} catch {
			return;
		}
	}
}

export const doubleVoices = new DoubleVoiceBank();

/** Le Double se glisse sur la fréquence : même voix, même grésillement qu'un vrai appel. */
export function speakRadioClip(clip: AudioBuffer): void {
	const context = audioEngine.ctx;
	const source = context.createBufferSource();
	source.buffer = clip;
	const radio = createRadioFilter(context);
	const gain = context.createGain();
	gain.gain.value = 1.2;
	source.connect(radio.input);
	radio.output.connect(gain);
	gain.connect(audioEngine.bus("voice"));
	source.onended = () => {
		source.disconnect();
		radio.dispose();
		gain.disconnect();
	};
	source.start();
}

/** Joue un extrait comme une voix de partie : spatialisée et étouffée par les murs. */
export function speakClip(clip: AudioBuffer): VoicePlayback {
	const context = audioEngine.ctx;
	const source = context.createBufferSource();
	source.buffer = clip;
	const filter = context.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.value = 18000;
	const gain = context.createGain();
	const panner = audioEngine.createPanner(
		VOICE_PROXIMITY_FULL_RANGE,
		VOICE_PROXIMITY_MAX_RANGE,
		1,
	);
	panner.distanceModel = "linear";
	source.connect(filter);
	filter.connect(gain);
	gain.connect(panner);
	panner.connect(audioEngine.bus("voice"));
	const playback: VoicePlayback = {
		ended: false,
		place(position, occlusion) {
			setPannerPosition(panner, position.x, position.y, position.z);
			gain.gain.setTargetAtTime(0.45 ** occlusion, context.currentTime, 0.12);
			filter.frequency.setTargetAtTime(
				occlusion > 0 ? 18000 * 0.16 ** Math.min(occlusion, 3) : 18000,
				context.currentTime,
				0.12,
			);
		},
		stop() {
			if (!playback.ended) {
				source.stop();
			}
		},
	};
	source.onended = () => {
		playback.ended = true;
		source.disconnect();
		filter.disconnect();
		gain.disconnect();
		panner.disconnect();
	};
	source.start();
	return playback;
}
