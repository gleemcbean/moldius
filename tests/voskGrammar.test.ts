import { describe, expect, it } from "vitest";
import {
	generateFormulas,
	transcriptMatchesFormula,
} from "../shared/anomalies/formulas.js";
import { INCANTATION_VOCABULARY } from "../shared/anomalies/vocabulary.js";
import { SeededRandom } from "../shared/random.js";

// Le code client se charge à l'exécution, comme dans les autres tests : il n'entre pas
// dans le typage NodeNext des tests.
type Forms = Record<"fr" | "en", Readonly<Record<string, readonly string[]>>>;
const clientRoot = "../src/features/voice";
const { VOSK_SPOKEN_FORMS } = (await import(`${clientRoot}/voskForms.ts`)) as {
	VOSK_SPOKEN_FORMS: Forms;
};
const { voskGrammar } = (await import(`${clientRoot}/voskGrammar.ts`)) as {
	voskGrammar: (
		language: "fr" | "en",
		formulas: readonly (readonly string[])[],
	) => string[];
};

describe("grammaire Vosk des incantations", () => {
	it("donne à chaque mot latin au moins une forme, que le comparateur accepte", () => {
		for (const language of ["fr", "en"] as const) {
			for (const word of INCANTATION_VOCABULARY) {
				const forms = VOSK_SPOKEN_FORMS[language][word];
				expect(forms?.length, `${language} ${word}`).toBeGreaterThan(0);
				for (const form of forms) {
					expect(
						transcriptMatchesFormula(form, [word]),
						`${language} ${word} → ${form}`,
					).toBe(true);
				}
			}
		}
	});

	it("dit chaque formule d'une partie de façons que le serveur reconnaîtra", () => {
		const formulas = generateFormulas(new SeededRandom(7), 8);
		for (const language of ["fr", "en"] as const) {
			const grammar = voskGrammar(language, formulas);
			expect(grammar.at(-1)).toBe("[unk]");
			for (const phrase of grammar.slice(0, -1)) {
				expect(
					formulas.some((formula) => transcriptMatchesFormula(phrase, formula)),
					`${language} « ${phrase} »`,
				).toBe(true);
			}
			for (const formula of formulas) {
				expect(
					grammar.some((phrase) => transcriptMatchesFormula(phrase, formula)),
				).toBe(true);
			}
		}
	});

	it("prend tout le vocabulaire quand la partie n'a pas encore de formule", () => {
		const grammar = voskGrammar("fr", []);
		for (const word of INCANTATION_VOCABULARY) {
			expect(
				grammar.some((phrase) => transcriptMatchesFormula(phrase, [word])),
				word,
			).toBe(true);
		}
	});
});
