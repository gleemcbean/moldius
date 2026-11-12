import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { CAST_LISTEN_MAX_MS } from "../../shared/config/index.js";
import type { Language } from "../../shared/i18n/languages.js";
import {
	SPEECH_MAX_CHUNK_BYTES,
	SPEECH_SAMPLE_RATE,
	type SpeechPrepareResult,
	type SpeechReply,
	type SpeechStartRequest,
	VOSK_MODEL_FILES,
} from "../../shared/protocol/speech.js";
import { VoskEngine } from "./voskEngine.js";

const MAX_STREAM_SAMPLES =
	((CAST_LISTEN_MAX_MS + 3000) / 1000) * SPEECH_SAMPLE_RATE;
const IDLE_UNLOAD_MS = 10 * 60_000;

export interface SpeechClient {
	id: string;
	reply(reply: SpeechReply): void;
}

interface Stream {
	id: string;
	recognizerId: string;
	engine: VoskEngine;
	client: SpeechClient;
	samples: number;
	pending: number;
	concluding: boolean;
}

export function findVoskDirectory(
	candidates: readonly string[],
): string | null {
	return (
		candidates.find(
			(directory) =>
				existsSync(resolve(directory, "worker.js")) &&
				Object.values(VOSK_MODEL_FILES).some((file) =>
					existsSync(resolve(directory, file)),
				),
		) ?? null
	);
}

export class SpeechService {
	private readonly engines = new Map<Language, VoskEngine>();
	private readonly streams = new Map<string, Stream>();
	private readonly sweep: NodeJS.Timeout;

	constructor(
		private readonly directory: string | null,
		private readonly maxStreams = 24,
	) {
		this.sweep = setInterval(() => this.unloadIdle(), 60_000);
		this.sweep.unref();
	}

	get available(): boolean {
		return this.directory !== null;
	}

	async prepare(language: Language): Promise<SpeechPrepareResult> {
		const engine = this.engineFor(language);
		return engine && (await engine.loaded) ? "ready" : "unavailable";
	}

	start(client: SpeechClient, request: SpeechStartRequest): string | null {
		this.cancel(client);
		const engine = this.engineFor(request.language);
		if (!engine) {
			return "unavailable";
		}
		if (!engine.ready) {
			return engine.failed ? "unavailable" : "loading";
		}
		if (this.streams.size >= this.maxStreams) {
			return "busy";
		}
		const stream: Stream = {
			id: request.id,
			recognizerId: `${client.id}:${request.id}`,
			engine,
			client,
			samples: 0,
			pending: 0,
			concluding: false,
		};
		this.streams.set(client.id, stream);
		engine.open(stream.recognizerId, request.grammar, (reply) => {
			if (this.streams.get(client.id) !== stream) {
				return;
			}
			if (reply.event === "error") {
				client.reply({ id: stream.id, event: "error", error: reply.error });
				this.close(stream);
				return;
			}
			const fromChunk = stream.pending > 0;
			if (fromChunk) {
				stream.pending -= 1;
			}
			client.reply({ id: stream.id, event: reply.event, text: reply.text });
			if (stream.concluding && !fromChunk) {
				this.close(stream);
			}
		});
		return null;
	}

	audio(client: SpeechClient, id: string, data: Buffer): void {
		const stream = this.streams.get(client.id);
		if (!stream || stream.id !== id || stream.concluding) {
			return;
		}
		const usable =
			data.length > 0 &&
			data.length % 2 === 0 &&
			data.length <= SPEECH_MAX_CHUNK_BYTES &&
			stream.samples < MAX_STREAM_SAMPLES;
		if (!usable) {
			client.reply({ id, event: "partialresult", text: "" });
			return;
		}
		const samples = new Int16Array(data.length / 2);
		for (let index = 0; index < samples.length; index += 1) {
			samples[index] = data.readInt16LE(index * 2);
		}
		stream.samples += samples.length;
		stream.pending += 1;
		stream.engine.feed(stream.recognizerId, samples);
	}

	end(client: SpeechClient, id: string): void {
		const stream = this.streams.get(client.id);
		if (!stream || stream.id !== id) {
			client.reply({ id, event: "error", error: "unknown" });
			return;
		}
		if (!stream.concluding) {
			stream.concluding = true;
			stream.engine.finish(stream.recognizerId);
		}
	}

	cancel(client: SpeechClient, id?: string): void {
		const stream = this.streams.get(client.id);
		if (stream && (id === undefined || stream.id === id)) {
			this.close(stream);
		}
	}

	dispose(): void {
		clearInterval(this.sweep);
		for (const engine of this.engines.values()) {
			engine.dispose();
		}
		this.engines.clear();
		this.streams.clear();
	}

	private close(stream: Stream): void {
		if (this.streams.get(stream.client.id) === stream) {
			this.streams.delete(stream.client.id);
		}
		stream.engine.close(stream.recognizerId);
	}

	private engineFor(language: Language): VoskEngine | null {
		if (!this.directory) {
			return null;
		}
		let engine = this.engines.get(language);
		if (!engine || engine.failed) {
			engine?.dispose();
			if (!existsSync(resolve(this.directory, VOSK_MODEL_FILES[language]))) {
				return null;
			}
			engine = new VoskEngine(
				this.directory,
				VOSK_MODEL_FILES[language],
				SPEECH_SAMPLE_RATE,
			);
			this.engines.set(language, engine);
		}
		return engine;
	}

	private unloadIdle(): void {
		const now = Date.now();
		for (const [language, engine] of this.engines) {
			if (engine.streams === 0 && now - engine.usedAt > IDLE_UNLOAD_MS) {
				engine.dispose();
				this.engines.delete(language);
			}
		}
	}
}
