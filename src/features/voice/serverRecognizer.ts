import type { Language } from "@shared/i18n/languages";
import { SPEECH_SAMPLE_RATE, type SpeechReply } from "@shared/protocol/speech";
import { getSocket } from "../network/socket";
import type { RecognizerBackend, RecognizerReply } from "./voskRecognizer";

const PREPARE_TIMEOUT_MS = 90_000;

class Downsampler {
	private progress = 0;
	private sum = 0;
	private count = 0;

	run(samples: Float32Array, sampleRate: number): Int16Array {
		const step = sampleRate / SPEECH_SAMPLE_RATE;
		const output = new Int16Array(Math.ceil(samples.length / step) + 1);
		let filled = 0;
		for (const value of samples) {
			this.sum += value;
			this.count += 1;
			this.progress += 1;
			if (this.progress >= step) {
				this.progress -= step;
				output[filled] = Math.max(
					-0x8000,
					Math.min(0x7fff, Math.round(this.sum / this.count)),
				);
				filled += 1;
				this.sum = 0;
				this.count = 0;
			}
		}
		return output.slice(0, filled);
	}
}

const listeners = new Map<string, (reply: RecognizerReply) => void>();
let subscribed = false;

function dispatch(reply: SpeechReply): void {
	const listener = listeners.get(reply.id);
	if (!listener) {
		return;
	}
	if (reply.event === "error") {
		listener({ event: "error", recognizerId: reply.id, error: reply.error });
	} else if (reply.event === "partialresult") {
		listener({
			event: "partialresult",
			recognizerId: reply.id,
			result: { partial: reply.text },
		});
	} else {
		listener({
			event: "result",
			recognizerId: reply.id,
			result: { text: reply.text },
		});
	}
}

let unavailable = false;

export function serverSpeechUnavailable(): boolean {
	return unavailable;
}

export class ServerModel implements RecognizerBackend {
	ready = false;
	failed = false;
	private readonly downsamplers = new Map<string, Downsampler>();

	constructor(private readonly language: Language) {
		const socket = getSocket();
		if (!subscribed) {
			subscribed = true;
			socket.on("speech:reply", dispatch);
		}
		socket
			.timeout(PREPARE_TIMEOUT_MS)
			.emit("speech:prepare", { language }, (error, result) => {
				if (error) {
					this.failed = true;
					return;
				}
				this.ready = result === "ready";
				this.failed = !this.ready;
				if (!this.ready) {
					unavailable = true;
				}
			});
	}

	open(
		_sampleRate: number,
		listener: (reply: RecognizerReply) => void,
		grammar: readonly string[],
	): string {
		const id = crypto.randomUUID();
		listeners.set(id, listener);
		this.downsamplers.set(id, new Downsampler());
		getSocket().emit("speech:start", {
			id,
			language: this.language,
			grammar: [...grammar],
		});
		return id;
	}

	feed(recognizerId: string, samples: Float32Array, sampleRate: number): void {
		const pcm = this.downsamplers.get(recognizerId)?.run(samples, sampleRate);
		if (pcm) {
			getSocket().emit("speech:audio", {
				id: recognizerId,
				data: pcm.buffer as ArrayBuffer,
			});
		}
	}

	conclude(recognizerId: string): void {
		getSocket().emit("speech:end", { id: recognizerId });
	}

	close(recognizerId: string): void {
		listeners.delete(recognizerId);
		this.downsamplers.delete(recognizerId);
		getSocket().emit("speech:cancel", { id: recognizerId });
	}
}

const models = new Map<Language, ServerModel>();

export function serverModelFor(language: Language): ServerModel {
	let model = models.get(language);
	if (!model || model.failed) {
		model = new ServerModel(language);
		models.set(language, model);
	}
	return model;
}
