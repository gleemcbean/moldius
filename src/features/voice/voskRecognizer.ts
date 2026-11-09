import { CAST_LISTEN_MAX_MS } from "@shared/config/index";
import type { Language } from "@shared/i18n/languages";
import { currentLanguage, currentMessages } from "../../i18n";
import { micManager } from "./micManager";
import { voskGrammar } from "./voskGrammar";

const WORKER_URL = "/vosk/worker.js";
/**
 * Nommés comme les modèles officiels. L'ancien nom (model-fr-0.22.tar.gz…) désignait des
 * archives défectueuses encore gardées par les caches (Cloudflare, navigateurs) : changer de
 * nom les contourne.
 */
const MODEL_URLS: Record<Language, string> = {
	fr: "/vosk/vosk-model-small-fr-0.22.tar.gz",
	en: "/vosk/vosk-model-small-en-us-0.15.tar.gz",
};
const SETTLE_MS = 700;
const CHUNK_SIZE = 4096;
const INT16_SCALE = 0x8000;

type VoskReply =
	| { event: "load"; result: boolean }
	| { event: "error"; recognizerId?: string; error: string }
	| { event: "result"; recognizerId: string; result: { text?: string } }
	| {
			event: "partialresult";
			recognizerId: string;
			result: { partial?: string };
	  };

type RecognizerReply = Exclude<VoskReply, { event: "load" }>;

export interface VoskCallbacks {
	onInterim: (text: string) => void;
	onFinal: (alternatives: string[]) => void;
	onError: (message: string) => void;
	onEnd: () => void;
}

/** Le bruit reconnu « [unk] » n'est pas une parole : il ne doit ni lancer ni remplir une incantation. */
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

class VoskModel {
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
			this.worker.onmessage = (event: MessageEvent<VoskReply>) => {
				const reply = event.data;
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
		model = new VoskModel(MODEL_URLS[language]);
		models.set(language, model);
	}
	return model;
}

export function preloadVosk(): void {
	if (voskSupported()) {
		modelFor(currentLanguage());
	}
}

export class VoskListener {
	private context: AudioContext | null = null;
	private session: {
		model: VoskModel;
		recognizerId: string;
		source: MediaStreamAudioSourceNode;
		processor: ScriptProcessorNode;
		sink: GainNode;
		callbacks: VoskCallbacks;
		heard: string[];
		pending: number;
		concluding: boolean;
		settle: number | null;
		timeout: number;
	} | null = null;

	get active(): boolean {
		return this.session !== null;
	}

	/** formulas : celles de la partie, qui deviennent la grammaire du modèle (voir voskGrammar). */
	start(
		callbacks: VoskCallbacks,
		formulas: readonly (readonly string[])[] = [],
	): boolean {
		this.stop();
		const labels = currentMessages().game.speech;
		const language = currentLanguage();
		const model = modelFor(language);
		if (!model.ready) {
			callbacks.onError(model.failed ? labels.failedToStart : labels.loading);
			return false;
		}
		const stream = micManager.inputStream;
		if (!stream) {
			callbacks.onError(labels.failedToStart);
			return false;
		}
		this.context ??= new AudioContext();
		const context = this.context;
		void context.resume().catch(() => undefined);
		const source = context.createMediaStreamSource(stream);
		const processor = context.createScriptProcessor(CHUNK_SIZE, 1, 1);
		const sink = context.createGain();
		sink.gain.value = 0;
		const recognizerId = model.open(
			context.sampleRate,
			(reply) => this.receive(reply),
			voskGrammar(language, formulas),
		);
		const session = {
			model,
			recognizerId,
			source,
			processor,
			sink,
			callbacks,
			heard: [] as string[],
			pending: 0,
			concluding: false,
			settle: null as number | null,
			timeout: window.setTimeout(() => this.finish(), CAST_LISTEN_MAX_MS),
		};
		processor.onaudioprocess = (event) => {
			if (this.session !== session || session.concluding) {
				return;
			}
			session.pending += 1;
			model.feed(
				recognizerId,
				event.inputBuffer.getChannelData(0).map((value) => value * INT16_SCALE),
				context.sampleRate,
			);
		};
		source.connect(processor);
		processor.connect(sink).connect(context.destination);
		this.session = session;
		return true;
	}

	finish(): void {
		const session = this.session;
		if (!session || session.concluding) {
			return;
		}
		session.concluding = true;
		this.disconnect();
		session.model.conclude(session.recognizerId);
	}

	stop(): void {
		const session = this.session;
		if (!session) {
			return;
		}
		this.disconnect();
		this.release();
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
				this.cancelSettle();
				session.callbacks.onInterim([...session.heard, partial].join(" "));
			}
			return;
		}
		const text = withoutUnknown(reply.result.text ?? "");
		if (text) {
			session.heard.push(text);
			session.callbacks.onInterim(session.heard.join(" "));
		}
		if (session.concluding && !fromChunk) {
			this.deliver();
			return;
		}
		if (text) {
			this.cancelSettle();
			session.settle = window.setTimeout(() => this.finish(), SETTLE_MS);
		}
	}

	private deliver(): void {
		const session = this.session;
		if (!session) {
			return;
		}
		const transcript = session.heard.join(" ").trim();
		this.disconnect();
		this.release();
		if (transcript) {
			session.callbacks.onFinal([transcript]);
		}
		session.callbacks.onEnd();
	}

	private cancelSettle(): void {
		if (this.session?.settle != null) {
			window.clearTimeout(this.session.settle);
			this.session.settle = null;
		}
	}

	private disconnect(): void {
		const session = this.session;
		if (!session) {
			return;
		}
		session.processor.onaudioprocess = null;
		session.source.disconnect();
		session.processor.disconnect();
		session.sink.disconnect();
	}

	private release(): void {
		const session = this.session;
		if (!session) {
			return;
		}
		this.cancelSettle();
		window.clearTimeout(session.timeout);
		session.model.close(session.recognizerId);
		this.session = null;
	}
}
