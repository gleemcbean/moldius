import type { Language } from "../i18n/languages.js";

/** Reconnaissance des incantations par le serveur : le micro y arrive en PCM 16 bits, 16 kHz. */
export const SPEECH_SAMPLE_RATE = 16_000;
/** Un bloc par tour du ScriptProcessor du client (4096 échantillons à 48 kHz ≈ 1366 à 16 kHz). */
export const SPEECH_MAX_CHUNK_BYTES = 8192;
export const SPEECH_MAX_GRAMMAR = 3001;
export const SPEECH_MAX_PHRASE = 120;

/**
 * Les modèles de public/vosk, nommés comme les modèles officiels. L'ancien nom
 * (model-fr-0.22.tar.gz…) désignait des archives défectueuses encore gardées par les caches
 * (Cloudflare, navigateurs) : changer de nom les contourne.
 */
export const VOSK_MODEL_FILES: Record<Language, string> = {
	fr: "vosk-model-small-fr-0.22.tar.gz",
	en: "vosk-model-small-en-us-0.15.tar.gz",
};

export interface SpeechPrepareRequest {
	language: Language;
}

export interface SpeechStartRequest {
	/** Choisi par le client : les réponses d'une écoute précédente sont ignorées. */
	id: string;
	language: Language;
	grammar: string[];
}

export interface SpeechAudioRequest {
	id: string;
	data: ArrayBuffer;
}

/**
 * Une réponse par bloc reçu (partielle ou résultat), plus une à la fin de l'écoute :
 * le client compte ses blocs pour savoir laquelle est la dernière.
 */
export type SpeechReply =
	| { id: string; event: "partialresult"; text: string }
	| { id: string; event: "result"; text: string }
	| { id: string; event: "error"; error: string };

export type SpeechPrepareResult = "ready" | "unavailable";
