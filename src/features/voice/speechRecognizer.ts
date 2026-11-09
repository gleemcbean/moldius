import { INCANTATION_VOCABULARY } from "@shared/anomalies/vocabulary";
import { CAST_LISTEN_MAX_MS } from "@shared/config/index";
import { desktopApp } from "../../app/desktopApp";
import { currentLanguage, currentMessages } from "../../i18n";
import { speechLocale } from "../../i18n/language";
import { preloadVosk, VoskListener, voskSupported } from "./voskRecognizer";

interface RecognitionAlternative {
	transcript: string;
	confidence: number;
}

interface RecognitionResult {
	readonly isFinal: boolean;
	readonly length: number;
	[index: number]: RecognitionAlternative;
}

interface RecognitionEvent extends Event {
	readonly resultIndex: number;
	readonly results: {
		readonly length: number;
		[index: number]: RecognitionResult;
	};
}

interface RecognitionErrorEvent extends Event {
	readonly error: string;
}

interface Recognition extends EventTarget {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	phrases?: unknown[];
	onresult: ((event: RecognitionEvent) => void) | null;
	onerror: ((event: RecognitionErrorEvent) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

type RecognitionConstructor = new () => Recognition;

interface SpeechScope {
	SpeechRecognition?: RecognitionConstructor;
	webkitSpeechRecognition?: RecognitionConstructor;
	SpeechRecognitionPhrase?: new (phrase: string, boost: number) => unknown;
}

function speechScope(): Window & SpeechScope {
	return window;
}

function recognitionConstructor(): RecognitionConstructor | null {
	// Dans l'application de bureau, la reconnaissance native existe mais ne marche pas
	// (service de Google réservé à Chrome) : on passe directement à Vosk.
	if (desktopApp) {
		return null;
	}
	const scope = speechScope();
	return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export type SpeechEngine = "native" | "vosk";

export function speechEngine(): SpeechEngine | null {
	if (recognitionConstructor() !== null) {
		return "native";
	}
	return voskSupported() ? "vosk" : null;
}

export function speechRecognitionAvailable(): boolean {
	return speechEngine() !== null;
}

export function prepareSpeechRecognition(): void {
	if (speechEngine() === "vosk") {
		preloadVosk();
	}
}

export interface ListenCallbacks {
	onInterim: (text: string) => void;
	onFinal: (alternatives: string[]) => void;
	onError: (message: string) => void;
	onEnd: () => void;
}

let phrasesAccepted = true;

export class IncantationListener {
	private recognition: Recognition | null = null;
	private readonly fallback = new VoskListener();
	private timeout: number | null = null;
	private delivered = false;
	private interim = "";

	get active(): boolean {
		return this.recognition !== null || this.fallback.active;
	}

	start(
		callbacks: ListenCallbacks,
		hintWords: readonly string[] = [],
		formulas: readonly (readonly string[])[] = [],
	): boolean {
		const Constructor = recognitionConstructor();
		if (!Constructor) {
			if (voskSupported()) {
				return this.fallback.start(callbacks, formulas);
			}
			callbacks.onError(currentMessages().game.speech.unavailable);
			return false;
		}
		this.stop();
		const recognition = new Constructor();
		recognition.lang = speechLocale(currentLanguage());
		recognition.continuous = false;
		recognition.interimResults = true;
		recognition.maxAlternatives = 5;
		const hinted = this.applyHints(recognition, hintWords);
		let retryWithoutHints = false;
		this.delivered = false;
		this.interim = "";
		recognition.onresult = (event) => {
			for (
				let index = event.resultIndex;
				index < event.results.length;
				index += 1
			) {
				const result = event.results[index];
				if (result.isFinal) {
					const alternatives: string[] = [];
					for (
						let alternative = 0;
						alternative < result.length;
						alternative += 1
					) {
						alternatives.push(result[alternative].transcript);
					}
					this.delivered = true;
					callbacks.onFinal(alternatives);
				} else {
					this.interim = result[0]?.transcript ?? "";
					callbacks.onInterim(this.interim);
				}
			}
		};
		recognition.onerror = (event) => {
			if (hinted && event.error === "phrases-not-supported") {
				phrasesAccepted = false;
				retryWithoutHints = true;
				return;
			}
			if (event.error !== "aborted" && event.error !== "no-speech") {
				const labels = currentMessages().game.speech;
				callbacks.onError(labels.errors[event.error] ?? labels.generic);
			}
		};
		recognition.onend = () => {
			if (retryWithoutHints) {
				this.clear();
				if (!this.start(callbacks, hintWords)) {
					callbacks.onEnd();
				}
				return;
			}
			if (!this.delivered && this.interim.trim().length > 0) {
				this.delivered = true;
				callbacks.onFinal([this.interim]);
			}
			this.clear();
			callbacks.onEnd();
		};
		try {
			recognition.start();
		} catch {
			if (hinted) {
				phrasesAccepted = false;
				return this.start(callbacks, hintWords);
			}
			callbacks.onError(currentMessages().game.speech.failedToStart);
			return false;
		}
		this.recognition = recognition;
		this.timeout = window.setTimeout(() => this.finish(), CAST_LISTEN_MAX_MS);
		return true;
	}

	finish(): void {
		this.recognition?.stop();
		this.fallback.finish();
	}

	stop(): void {
		this.recognition?.abort();
		this.fallback.stop();
		this.clear();
	}

	private clear(): void {
		if (this.timeout !== null) {
			window.clearTimeout(this.timeout);
			this.timeout = null;
		}
		this.recognition = null;
	}

	private applyHints(
		recognition: Recognition,
		hintWords: readonly string[],
	): boolean {
		const PhraseConstructor = speechScope().SpeechRecognitionPhrase;
		if (!phrasesAccepted || !PhraseConstructor || !("phrases" in recognition)) {
			return false;
		}
		try {
			const words = hintWords.length > 0 ? hintWords : INCANTATION_VOCABULARY;
			recognition.phrases = words
				.slice(0, 200)
				.map((word) => new PhraseConstructor(word, 4));
			return true;
		} catch {
			return false;
		}
	}
}
