import { INCANTATION_VOCABULARY } from "@shared/anomalies/vocabulary";
import type { Language } from "@shared/i18n/languages";
import { VOSK_SPOKEN_FORMS } from "./voskForms";

const UNKNOWN = "[unk]";
const MAX_PHRASES = 3000;

function formsOf(language: Language, word: string): readonly string[] {
	const forms = VOSK_SPOKEN_FORMS[language][word.toLowerCase()];
	return forms && forms.length > 0 ? forms : [word];
}

export function voskGrammar(
	language: Language,
	formulas: readonly (readonly string[])[],
): string[] {
	const phrases = new Set<string>();
	if (formulas.length === 0) {
		for (const word of INCANTATION_VOCABULARY) {
			for (const form of formsOf(language, word)) {
				phrases.add(form);
			}
		}
	}
	for (const formula of formulas) {
		for (const phrase of spokenForms(language, formula)) {
			phrases.add(phrase);
		}
	}
	for (const formula of formulas) {
		for (let start = 0; start < formula.length; start += 1) {
			for (const length of [2, 1]) {
				const part = formula.slice(start, start + length);
				if (part.length === length && length < formula.length) {
					for (const phrase of spokenForms(language, part)) {
						phrases.add(phrase);
					}
				}
			}
		}
	}
	return [...[...phrases].slice(0, MAX_PHRASES), UNKNOWN];
}

function spokenForms(language: Language, words: readonly string[]): string[] {
	let spoken = [""];
	for (const word of words) {
		spoken = spoken.flatMap((start) =>
			formsOf(language, word).map((form) =>
				start ? `${start} ${form}` : form,
			),
		);
	}
	return spoken;
}
