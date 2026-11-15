import { CAST_LISTEN_MAX_MS } from "@shared/config/index";
import type { Language } from "@shared/i18n/languages";
import { VOSK_MODEL_FILES } from "@shared/protocol/speech";
import { currentLanguage, currentMessages } from "../../i18n";
import { audioEngine } from "../audio/audioEngine";
import { micManager } from "./micManager";
import { loadVoiceWorklet } from "./voiceWorklet";
import { voskGrammar } from "./voskGrammar";

const WORKER_URL = "/vosk/worker.js";
const SETTLE_MS = 700;
const CONCLUDE_TIMEOUT_MS = 4000;
const CHUNK_SIZE = 4096;
const INT16_SCALE = 0x8000;
const MAX_SESSION_AUDIO_MS = CAST_LISTEN_MAX_MS + 2000;
const GAP_MAX_MS = 2000;
const SPEAKING_LEVEL = 0.12;
const SPEECH_HOLD_MS = 500;
const CHECK_INTERVAL_MS = 200;
const WORKLET_RATE = 16_000;
const WORKLET_BLOCK_SAMPLES = 1600;
const LEVEL_MIN_DB = -62;
const LEVEL_MAX_DB = -12;

let workletState: "idle" | "loading" | "ready" | "failed" = "idle";

function geckoCapture(): boolean {
	return (
		typeof navigator !== "undefined" && /Firefox\//.test(navigator.userAgent)
	);
}

function prepareWorklet(): void {
	if (workletState !== "idle") {
		return;
	}
	workletState = "loading";
	void loadVoiceWorklet().then(
		(ok) => {
			workletState = ok ? "ready" : "failed";
		},
		() => {
			workletState = "failed";
		},
	);
}

function chunkLevel(samples: Float32Array): number {
	let sum = 0;
	for (const value of samples) {
		const normalized = value / INT16_SCALE;
		sum += normalized * normalized;
	}
	const rms = Math.sqrt(sum / Math.max(1, samples.length));
	const db = 20 * Math.log10(Math.max(rms, 1e-7));
	return Math.min(
		1,
		Math.max(0, (db - LEVEL_MIN_DB) / (LEVEL_MAX_DB - LEVEL_MIN_DB)),
	);
}

type VoskReply =
	| { event: "load"; result: boolean }
	| { event: "error"; recognizerId?: string; error: string }
	| { event: "result"; recognizerId: string; result: { text?: string } }
	| {
			event: "partialresult";
			recognizerId: string;
			result: { partial?: string };
	  };

export type RecognizerReply = Exclude<VoskReply, { event: "load" }>;

export interface RecognizerBackend {
	readonly ready: boolean;
	readonly failed: boolean;
	open(
		sampleRate: number,
		listener: (reply: RecognizerReply) => void,
		grammar: readonly string[],
	): string;
	feed(recognizerId: string, samples: Float32Array, sampleRate: number): void;
	conclude(recognizerId: string): void;
	close(recognizerId: string): void;
}

export interface VoskCallbacks {
	onInterim: (text: string) => void;
	onFinal: (alternatives: string[]) => void;
	onError: (message: string) => void;
	onEnd: () => void;
}

function withoutUnknown(text: string): string {
	return text
		.replace(/\[unk\]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function voskSupported(): boolean {
	return (
		typeof WebAssembly === "object" &&
		typeof Worker === "function" &&
		typeof indexedDB !== "undefined" &&
		typeof AudioContext === "function"
	);
}

class VoskModel implements RecognizerBackend {
	readonly loaded: Promise<void>;
	ready = false;
	failed = false;
	private readonly worker: Worker;
	private readonly listeners = new Map<
		string,
		(reply: RecognizerReply) => void
	>();

	constructor(modelUrl: string) {
		this.worker = new Worker(WORKER_URL);
		this.loaded = new Promise<void>((resolve, reject) => {
			this.worker.onmessage = (event: MessageEvent<VoskReply | undefined>) => {
				const reply = event.data;
				if (!reply) {
					return;
				}
				if (reply.event === "load") {
					this.ready = reply.result;
					this.failed = !reply.result;
					if (reply.result) {
						resolve();
					} else {
						reject(new Error("Modèle Vosk non chargé"));
					}
					return;
				}
				if (reply.recognizerId) {
					this.listeners.get(reply.recognizerId)?.(reply);
				} else if (reply.event === "error" && !this.ready) {
					this.failed = true;
					reject(new Error(reply.error));
				}
			};
			this.worker.onerror = () => {
				this.failed = true;
				reject(new Error("Worker Vosk indisponible"));
			};
		});
		this.loaded.catch(() => undefined);
		this.worker.postMessage({ action: "set", key: "logLevel", value: -2 });
		this.worker.postMessage({
			action: "load",
			modelUrl: new URL(modelUrl, window.location.href).href,
		});
	}

	open(
		sampleRate: number,
		listener: (reply: RecognizerReply) => void,
		grammar: readonly string[],
	): string {
		const recognizerId = crypto.randomUUID();
		this.listeners.set(recognizerId, listener);
		this.worker.postMessage({
			action: "create",
			recognizerId,
			sampleRate,
			grammar: JSON.stringify(grammar),
		});
		return recognizerId;
	}

	feed(recognizerId: string, samples: Float32Array, sampleRate: number): void {
		this.worker.postMessage(
			{ action: "audioChunk", recognizerId, data: samples, sampleRate },
			[samples.buffer],
		);
	}

	conclude(recognizerId: string): void {
		this.worker.postMessage({ action: "retrieveFinalResult", recognizerId });
	}

	close(recognizerId: string): void {
		this.listeners.delete(recognizerId);
		this.worker.postMessage({ action: "remove", recognizerId });
	}
}

const models = new Map<Language, VoskModel>();

function modelFor(language: Language): VoskModel {
	let model = models.get(language);
	if (!model || model.failed) {
		model = new VoskModel(`/vosk/${VOSK_MODEL_FILES[language]}`);
		models.set(language, model);
	}
	return model;
}

export function preloadVosk(): void {
	if (voskSupported()) {
		modelFor(currentLanguage());
	}
}

interface Segment {
	final: string;
	partial: string;
}

interface Tap {
	kind: "script" | "worklet";
	stream: MediaStream;
	context: AudioContext;
	sampleRate: number;
	source: MediaStreamAudioSourceNode;
	processor: ScriptProcessorNode | AudioWorkletNode;
	sink: GainNode;
}

interface ListenSession {
	model: RecognizerBackend;
	recognizerId: string;
	callbacks: VoskCallbacks;
	segments: Segment[];
	partial: string;
	pending: number;
	concluding: boolean;
	settle: number | null;
	check: number | null;
	giveUp: number | null;
	fedSamples: number;
	sampleRate: number;
	spokeAt: number;
}

export function sessionTranscripts(
	segments: readonly Segment[],
	partial: string,
): string[] {
	const join = (parts: string[]) =>
		parts
			.filter((part) => part.length > 0)
			.join(" ")
			.trim();
	const finals = join(segments.map((segment) => segment.final));
	const hopeful = join([
		...segments.map((segment) => segment.final || segment.partial),
		partial,
	]);
	const partials = join([
		...segments.map((segment) => segment.partial || segment.final),
		partial,
	]);
	return [...new Set([finals, hopeful, partials])].filter(
		(text) => text.length > 0,
	);
}

export class VoskListener {
	private tap: Tap | null = null;
	private gap: Float32Array[] = [];
	private gapSamples = 0;
	private gapRate = 0;
	private session: ListenSession | null = null;

	constructor(
		private readonly backendFor: (
			language: Language,
		) => RecognizerBackend = modelFor,
	) {
		if (geckoCapture()) {
			prepareWorklet();
		}
	}

	get active(): boolean {
		return this.session !== null;
	}

	start(
		callbacks: VoskCallbacks,
		formulas: readonly (readonly string[])[] = [],
	): boolean {
		this.endSession();
		const labels = currentMessages().game.speech;
		const language = currentLanguage();
		const model = this.backendFor(language);
		if (!model.ready) {
			callbacks.onError(model.failed ? labels.failedToStart : labels.loading);
			return false;
		}
		const tap = this.ensureTap();
		if (!tap) {
			callbacks.onError(labels.failedToStart);
			return false;
		}
		void tap.context.resume().catch(() => undefined);
		const recognizerId = model.open(
			tap.sampleRate,
			(reply) => this.receive(reply),
			voskGrammar(language, formulas),
		);
		const session: ListenSession = {
			model,
			recognizerId,
			callbacks,
			segments: [],
			partial: "",
			pending: 0,
			concluding: false,
			settle: null,
			check: null,
			giveUp: null,
			fedSamples: 0,
			sampleRate: tap.sampleRate,
			spokeAt: 0,
		};
		this.session = session;
		for (const chunk of this.gap) {
			this.feed(session, chunk);
		}
		this.gap = [];
		this.gapSamples = 0;
		const fedMs = (session.fedSamples / session.sampleRate) * 1000;
		this.scheduleCheck(
			session,
			Math.max(CHECK_INTERVAL_MS, CAST_LISTEN_MAX_MS - fedMs),
		);
		return true;
	}

	finish(): void {
		const session = this.session;
		if (!session || session.concluding) {
			return;
		}
		session.concluding = true;
		this.clearTimers(session);
		session.giveUp = window.setTimeout(
			() => this.deliver(),
			CONCLUDE_TIMEOUT_MS,
		);
		session.model.conclude(session.recognizerId);
	}

	stop(): void {
		this.endSession();
		this.releaseTap();
		this.gap = [];
		this.gapSamples = 0;
	}

	private ensureTap(): Tap | null {
		const stream = micManager.inputStream;
		if (!stream) {
			this.releaseTap();
			return null;
		}
		const kind =
			geckoCapture() && workletState === "ready" ? "worklet" : "script";
		if (this.tap?.stream === stream && this.tap.kind === kind) {
			return this.tap;
		}
		this.releaseTap();
		const tap =
			kind === "worklet" ? this.workletTap(stream) : this.scriptTap(stream);
		if (this.gapRate !== tap.sampleRate) {
			this.gap = [];
			this.gapSamples = 0;
		}
		this.gapRate = tap.sampleRate;
		this.tap = tap;
		return tap;
	}

	private scriptTap(stream: MediaStream): Tap {
		const context = new AudioContext();
		const source = context.createMediaStreamSource(stream);
		const processor = context.createScriptProcessor(CHUNK_SIZE, 1, 1);
		const sink = context.createGain();
		sink.gain.value = 0;
		const tap: Tap = {
			kind: "script",
			stream,
			context,
			sampleRate: context.sampleRate,
			source,
			processor,
			sink,
		};
		processor.onaudioprocess = (event) => {
			if (this.tap !== tap) {
				return;
			}
			this.capture(
				event.inputBuffer.getChannelData(0).map((value) => value * INT16_SCALE),
				context.sampleRate,
				micManager.measure(),
			);
		};
		source.connect(processor);
		processor.connect(sink).connect(context.destination);
		return tap;
	}

	private workletTap(stream: MediaStream): Tap {
		const context = audioEngine.ctx;
		void context.resume().catch(() => undefined);
		const source = context.createMediaStreamSource(stream);
		const processor = new AudioWorkletNode(context, "voice-capture", {
			processorOptions: { blockSamples: WORKLET_BLOCK_SAMPLES },
		});
		const sink = context.createGain();
		sink.gain.value = 0;
		const tap: Tap = {
			kind: "worklet",
			stream,
			context,
			sampleRate: WORKLET_RATE,
			source,
			processor,
			sink,
		};
		processor.port.onmessage = (event: MessageEvent<Int16Array>) => {
			if (this.tap !== tap) {
				return;
			}
			const samples = Float32Array.from(event.data);
			this.capture(samples, WORKLET_RATE, chunkLevel(samples));
		};
		source.connect(processor).connect(sink).connect(context.destination);
		return tap;
	}

	private releaseTap(): void {
		const tap = this.tap;
		if (!tap) {
			return;
		}
		if (tap.kind === "worklet") {
			(tap.processor as AudioWorkletNode).port.onmessage = null;
		} else {
			(tap.processor as ScriptProcessorNode).onaudioprocess = null;
		}
		tap.source.disconnect();
		tap.processor.disconnect();
		tap.sink.disconnect();
		if (tap.kind === "script") {
			void tap.context.close().catch(() => undefined);
		}
		this.tap = null;
	}

	private capture(
		samples: Float32Array,
		sampleRate: number,
		level: number,
	): void {
		const session = this.session;
		if (level >= SPEAKING_LEVEL && session) {
			session.spokeAt = performance.now();
		}
		if (session && !session.concluding) {
			this.feed(session, samples);
			if (session.fedSamples / sampleRate >= MAX_SESSION_AUDIO_MS / 1000) {
				this.finish();
			}
			return;
		}
		this.gap.push(samples);
		this.gapSamples += samples.length;
		while (
			this.gap.length > 1 &&
			this.gapSamples / sampleRate > GAP_MAX_MS / 1000
		) {
			this.gapSamples -= (this.gap.shift() as Float32Array).length;
		}
	}

	private feed(session: ListenSession, samples: Float32Array): void {
		session.pending += 1;
		session.fedSamples += samples.length;
		session.model.feed(session.recognizerId, samples, session.sampleRate);
	}

	private scheduleCheck(session: ListenSession, delay: number): void {
		session.check = window.setTimeout(() => {
			session.check = null;
			if (this.session !== session || session.concluding) {
				return;
			}
			const now = performance.now();
			const speaking =
				now - session.spokeAt < SPEECH_HOLD_MS ||
				(session.partial.length > 0 && session.settle === null);
			if (speaking) {
				this.scheduleCheck(session, CHECK_INTERVAL_MS);
				return;
			}
			this.finish();
		}, delay);
	}

	private receive(reply: RecognizerReply): void {
		const session = this.session;
		if (!session) {
			return;
		}
		if (reply.event === "error") {
			session.callbacks.onError(currentMessages().game.speech.generic);
			this.deliver();
			return;
		}
		const fromChunk = session.pending > 0;
		if (fromChunk) {
			session.pending -= 1;
		}
		if (reply.event === "partialresult") {
			const partial = withoutUnknown(reply.result.partial ?? "");
			if (partial) {
				session.partial = partial;
				this.cancelSettle(session);
				session.callbacks.onInterim(
					[...session.segments.map((segment) => segment.final), partial]
						.filter((text) => text.length > 0)
						.join(" "),
				);
			}
			return;
		}
		const text = withoutUnknown(reply.result.text ?? "");
		const added = text.length > 0 || session.partial.length > 0;
		if (added) {
			session.segments.push({ final: text, partial: session.partial });
			session.partial = "";
			session.callbacks.onInterim(
				session.segments
					.map((segment) => segment.final || segment.partial)
					.join(" "),
			);
		}
		if (session.concluding && !fromChunk) {
			this.deliver();
			return;
		}
		if (added && !session.concluding) {
			this.cancelSettle(session);
			session.settle = window.setTimeout(() => this.finish(), SETTLE_MS);
		}
	}

	private deliver(): void {
		const session = this.session;
		if (!session) {
			return;
		}
		const transcripts = sessionTranscripts(session.segments, session.partial);
		this.endSession();
		if (transcripts.length > 0) {
			session.callbacks.onFinal(transcripts);
		}
		session.callbacks.onEnd();
	}

	private cancelSettle(session: ListenSession): void {
		if (session.settle !== null) {
			window.clearTimeout(session.settle);
			session.settle = null;
		}
	}

	private clearTimers(session: ListenSession): void {
		this.cancelSettle(session);
		if (session.check !== null) {
			window.clearTimeout(session.check);
			session.check = null;
		}
	}

	private endSession(): void {
		const session = this.session;
		if (!session) {
			return;
		}
		this.clearTimers(session);
		if (session.giveUp !== null) {
			window.clearTimeout(session.giveUp);
		}
		session.model.close(session.recognizerId);
		this.session = null;
	}
}
