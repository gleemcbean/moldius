import type { Language } from "../i18n/languages.js";

export const SPEECH_SAMPLE_RATE = 16_000;
export const SPEECH_MAX_CHUNK_BYTES = 8192;
export const SPEECH_MAX_GRAMMAR = 3001;
export const SPEECH_MAX_PHRASE = 120;

export const VOSK_MODEL_FILES: Record<Language, string> = {
	fr: "vosk-model-small-fr-0.22.tar.gz",
	en: "vosk-model-small-en-us-0.15.tar.gz",
};

export interface SpeechPrepareRequest {
	language: Language;
}

export interface SpeechStartRequest {
	id: string;
	language: Language;
	grammar: string[];
}

export interface SpeechAudioRequest {
	id: string;
	data: ArrayBuffer;
}

export type SpeechReply =
	| { id: string; event: "partialresult"; text: string }
	| { id: string; event: "result"; text: string }
	| { id: string; event: "error"; error: string };

export type SpeechPrepareResult = "ready" | "unavailable";
