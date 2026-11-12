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
		let spoken = [""];
		for (const word of formula) {
			spoken = spoken.flatMap((start) =>
				formsOf(language, word).map((form) =>
					start ? `${start} ${form}` : form,
				),
			);
		}
		for (const phrase of spoken) {
			phrases.add(phrase);
		}
	}
	return [...[...phrases].slice(0, MAX_PHRASES), UNKNOWN];
}
