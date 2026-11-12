import {
	VOICE_PROXIMITY_FULL_RANGE,
	VOICE_PROXIMITY_MAX_RANGE,
} from "@shared/config/index";
import { audioEngine, setPannerPosition } from "../../audio/audioEngine";
import { momentVoices } from "../../voice/momentVoices";

interface ReplayVoice {
	source: AudioBufferSourceNode;
	panner: PannerNode;
}

export class ReplayVoices {
	private readonly voices = new Map<string, ReplayVoice>();

	play(
		playerIds: Iterable<string>,
		from: number,
		to: number,
		at: number,
	): void {
		const context = audioEngine.ctx;
		for (const id of playerIds) {
			const buffer = momentVoices.extract(id, from, to);
			if (!buffer) {
				continue;
			}
			const source = context.createBufferSource();
			source.buffer = buffer;
			const panner = audioEngine.createPanner(
				VOICE_PROXIMITY_FULL_RANGE,
				VOICE_PROXIMITY_MAX_RANGE,
				1,
			);
			panner.distanceModel = "linear";
			source.connect(panner);
			panner.connect(audioEngine.bus("voice"));
			source.start(at);
			this.voices.set(id, { source, panner });
		}
	}

	place(playerId: string, x: number, y: number, z: number): void {
		const voice = this.voices.get(playerId);
		if (voice) {
			setPannerPosition(voice.panner, x, y, z);
		}
	}

	stop(): void {
		for (const voice of this.voices.values()) {
			try {
				voice.source.stop();
			} catch {}
			voice.source.disconnect();
			voice.panner.disconnect();
		}
		this.voices.clear();
	}
}
