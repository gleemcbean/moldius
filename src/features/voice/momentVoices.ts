import {
	type TimeWindow,
	VOICE_SAMPLE_RATE,
	VoiceTimeline,
} from "@shared/voiceTimeline";
import { audioEngine } from "../audio/audioEngine";
import { clockSync } from "../network/clockSync";
import { micManager } from "./micManager";
import { voiceChat } from "./voiceChat";
import { loadVoiceWorklet } from "./voiceWorklet";

const TRIM_INTERVAL_MS = 1000;

interface VoiceCapture {
	stream: MediaStream;
	source: MediaStreamAudioSourceNode;
	node: AudioWorkletNode | null;
	silent: GainNode;
}

class MomentVoiceBank {
	private readonly timelines = new Map<string, VoiceTimeline>();
	private readonly captures = new Map<string, VoiceCapture>();
	private windows: readonly TimeWindow[] = [];
	private workletReady: Promise<boolean> | null = null;
	private capturing = false;
	private trimmedAt = 0;
	private generation = 0;

	start(): void {
		this.capturing = true;
		this.generation += 1;
		this.workletReady ??= loadVoiceWorklet();
	}

	setWindows(windows: readonly TimeWindow[]): void {
		this.windows = windows;
	}

	update(playerIds: Iterable<string>, selfId: string): void {
		if (!this.capturing) {
			return;
		}
		for (const id of playerIds) {
			const stream =
				id === selfId ? micManager.outgoingStream : voiceChat.remoteStream(id);
			if (stream && this.captures.get(id)?.stream !== stream) {
				void this.capture(id, stream);
			}
		}
		const now = performance.now();
		if (now - this.trimmedAt > TRIM_INTERVAL_MS) {
			this.trimmedAt = now;
			const serverNow = clockSync.serverNow();
			for (const timeline of this.timelines.values()) {
				timeline.trim(serverNow, this.windows);
			}
		}
	}

	private async capture(id: string, stream: MediaStream): Promise<void> {
		const generation = this.generation;
		this.release(id);
		const context = audioEngine.ctx;
		const source = context.createMediaStreamSource(stream);
		const silent = context.createGain();
		silent.gain.value = 0;
		const capture: VoiceCapture = { stream, source, silent, node: null };
		this.captures.set(id, capture);
		if (!(await this.workletReady)) {
			return;
		}
		if (
			!this.capturing ||
			generation !== this.generation ||
			this.captures.get(id) !== capture
		) {
			return;
		}
		const node = new AudioWorkletNode(context, "voice-capture");
		capture.node = node;
		let timeline = this.timelines.get(id);
		if (!timeline) {
			timeline = new VoiceTimeline();
			this.timelines.set(id, timeline);
		}
		const target = timeline;
		node.port.onmessage = (event: MessageEvent<Int16Array>) => {
			if (this.capturing) {
				target.push(event.data, clockSync.serverNow());
			}
		};
		source.connect(node);
		node.connect(silent);
		silent.connect(context.destination);
	}

	private release(id: string): void {
		const capture = this.captures.get(id);
		if (!capture) {
			return;
		}
		capture.source.disconnect();
		capture.silent.disconnect();
		if (capture.node) {
			capture.node.port.onmessage = null;
			capture.node.disconnect();
		}
		this.captures.delete(id);
	}

	stopCapture(): void {
		this.capturing = false;
		for (const id of [...this.captures.keys()]) {
			this.release(id);
		}
	}

	extract(id: string, from: number, to: number): AudioBuffer | null {
		const samples = this.timelines.get(id)?.extract(from, to);
		if (!samples) {
			return null;
		}
		const buffer = audioEngine.ctx.createBuffer(
			1,
			samples.length,
			VOICE_SAMPLE_RATE,
		);
		buffer.copyToChannel(samples, 0);
		return buffer;
	}

	clear(): void {
		this.stopCapture();
		this.generation += 1;
		for (const timeline of this.timelines.values()) {
			timeline.clear();
		}
		this.timelines.clear();
		this.windows = [];
	}
}

export const momentVoices = new MomentVoiceBank();
