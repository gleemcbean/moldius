import {
	decodeMuLaw,
	encodeMuLaw,
	VOICE_RELAY_BLOCK_SAMPLES,
	VoiceRelayGate,
} from "@shared/voiceRelay";
import { VOICE_SAMPLE_RATE } from "@shared/voiceTimeline";
import { audioEngine } from "../audio/audioEngine";
import { loadVoiceWorklet } from "./voiceWorklet";

const PLAYBACK_DELAY_S = 0.08;
const PLAYBACK_MAX_LAG_S = 0.4;

/** Découpe le micro en petits blocs compressés, seulement quand quelqu'un en a besoin. */
export class VoiceRelayCapture {
	private source: MediaStreamAudioSourceNode | null = null;
	private node: AudioWorkletNode | null = null;
	private silent: GainNode | null = null;
	private track: MediaStreamTrack | null = null;
	private generation = 0;
	private readonly gate = new VoiceRelayGate();

	constructor(private readonly onBlock: (data: ArrayBuffer) => void) {}

	async start(track: MediaStreamTrack): Promise<void> {
		if (this.track === track) {
			return;
		}
		this.stop();
		this.track = track;
		const generation = this.generation;
		if (!(await loadVoiceWorklet()) || generation !== this.generation) {
			return;
		}
		const context = audioEngine.ctx;
		const source = context.createMediaStreamSource(new MediaStream([track]));
		const node = new AudioWorkletNode(context, "voice-capture", {
			processorOptions: { blockSamples: VOICE_RELAY_BLOCK_SAMPLES },
		});
		const silent = context.createGain();
		silent.gain.value = 0;
		node.port.onmessage = (event: MessageEvent<Int16Array>) => {
			if (this.gate.shouldSend(event.data)) {
				this.onBlock(encodeMuLaw(event.data).buffer as ArrayBuffer);
			}
		};
		source.connect(node).connect(silent).connect(context.destination);
		this.source = source;
		this.node = node;
		this.silent = silent;
	}

	stop(): void {
		this.generation += 1;
		this.track = null;
		if (this.node) {
			this.node.port.onmessage = null;
		}
		this.source?.disconnect();
		this.node?.disconnect();
		this.silent?.disconnect();
		this.source = null;
		this.node = null;
		this.silent = null;
	}
}

/**
 * Rejoue les blocs d'un joueur dans un flux audio : le reste du jeu (position de
 * la voix, talkie, meilleurs moments) le traite comme un flux direct.
 */
export class VoiceRelayPlayback {
	readonly output = audioEngine.ctx.createMediaStreamDestination();
	/** Le son à brancher directement sur le joueur, sans repasser par un flux. */
	readonly bus = audioEngine.ctx.createGain();
	private nextStart = 0;

	constructor() {
		this.bus.connect(this.output);
	}

	get stream(): MediaStream {
		return this.output.stream;
	}

	play(data: ArrayBuffer): void {
		const context = audioEngine.ctx;
		const samples = decodeMuLaw(new Uint8Array(data));
		if (samples.length === 0) {
			return;
		}
		const now = context.currentTime;
		if (this.nextStart < now || this.nextStart > now + PLAYBACK_MAX_LAG_S) {
			this.nextStart = now + PLAYBACK_DELAY_S;
		}
		const buffer = context.createBuffer(1, samples.length, VOICE_SAMPLE_RATE);
		const channel = buffer.getChannelData(0);
		for (let index = 0; index < samples.length; index += 1) {
			channel[index] = samples[index] / 32768;
		}
		const source = context.createBufferSource();
		source.buffer = buffer;
		source.connect(this.bus);
		source.start(this.nextStart);
		this.nextStart += buffer.duration;
	}

	dispose(): void {
		this.bus.disconnect();
		this.output.disconnect();
	}
}
