import { describe, expect, it } from "vitest";
import {
	editDistance,
	formulaKeyWord,
	generateFormulas,
	MIN_WORD_SEPARATION,
	normalizeSpeech,
	phoneticKey,
	transcriptMatchesFormula,
} from "../shared/anomalies/formulas.js";
import { INCANTATION_VOCABULARY } from "../shared/anomalies/vocabulary.js";
import { FORMULA_WORD_COUNT } from "../shared/config/index.js";
import { SeededRandom } from "../shared/random.js";

const FORMULA = ["ignis", "umbra", "lumen"];

describe("normalisation de la parole", () => {
	it("retire accents, ponctuation et majuscules", () => {
		expect(normalizeSpeech("Ignis, UMBRA… lumène !")).toEqual([
			"ignis",
			"umbra",
			"lumene",
		]);
	});

	it("rapproche les graphies d'un même son", () => {
		expect(phoneticKey("umbra")).toBe(phoneticKey("ombra"));
		expect(phoneticKey("lumen")).toBe(phoneticKey("loumen"));
		expect(phoneticKey("aurum")).toBe(phoneticKey("orhomme"));
		expect(phoneticKey("lux")).toBe(phoneticKey("luxe"));
	});
});

describe("reconnaissance des formules latines", () => {
	it("accepte la formule exacte", () => {
		expect(transcriptMatchesFormula("ignis umbra lumen", FORMULA)).toBe(true);
	});

	it("tolère une transcription à la française, des mots coupés et quelques mots parasites", () => {
		expect(transcriptMatchesFormula("Ignis, Ombra, Loumen", FORMULA)).toBe(
			true,
		);
		expect(transcriptMatchesFormula("ig nice ombre a lumen", FORMULA)).toBe(
			true,
		);
		expect(transcriptMatchesFormula("euh ignis le umbra lumen", FORMULA)).toBe(
			true,
		);
		expect(
			transcriptMatchesFormula("or homme spiritus vulpès", [
				"aurum",
				"spiritus",
				"vulpes",
			]),
		).toBe(true);
	});

	it("refuse un ordre différent", () => {
		expect(transcriptMatchesFormula("umbra ignis lumen", FORMULA)).toBe(false);
	});

	it("refuse un mot manquant ou un autre mot", () => {
		expect(transcriptMatchesFormula("ignis lumen", FORMULA)).toBe(false);
		expect(transcriptMatchesFormula("ignis umbra stella", FORMULA)).toBe(false);
	});

	it("refuse une phrase trop longue qui noie la formule", () => {
		expect(
			transcriptMatchesFormula("ignis un deux trois umbra lumen", FORMULA),
		).toBe(false);
		expect(
			transcriptMatchesFormula(
				"alors donc voila bon bref ignis umbra lumen",
				FORMULA,
			),
		).toBe(false);
	});

	it("ne confond jamais deux formules d'une même partie", () => {
		const formulas = generateFormulas(new SeededRandom(5), 20);
		for (const spoken of formulas) {
			for (const other of formulas) {
				expect(transcriptMatchesFormula(spoken.join(" "), other)).toBe(
					spoken === other,
				);
			}
		}
	});
});

describe("génération des formules", () => {
	it("produit des formules de trois mots latins, tous distincts et bien séparés à l'oreille", () => {
		const formulas = generateFormulas(new SeededRandom(42), 20);
		const words = formulas.flat().map(formulaKeyWord);
		expect(formulas).toHaveLength(20);
		for (const formula of formulas) {
			expect(formula).toHaveLength(FORMULA_WORD_COUNT);
		}
		expect(new Set(words).size).toBe(words.length);
		for (let i = 0; i < words.length; i += 1) {
			for (let j = i + 1; j < words.length; j += 1) {
				expect(editDistance(words[i], words[j])).toBeGreaterThanOrEqual(2);
			}
		}
	});

	it("évite les mots de la partie précédente", () => {
		for (let seed = 1; seed <= 40; seed += 1) {
			const first = generateFormulas(new SeededRandom(seed), 20);
			const previous = new Set(first.flat().map(formulaKeyWord));
			const second = generateFormulas(
				new SeededRandom(seed + 500),
				20,
				previous,
			);
			for (const word of second.flat()) {
				expect(previous.has(formulaKeyWord(word))).toBe(false);
			}
		}
	});

	it("change de formules entre deux graines", () => {
		const a = generateFormulas(new SeededRandom(1), 4).flat().join(" ");
		const b = generateFormulas(new SeededRandom(2), 4).flat().join(" ");
		expect(a).not.toBe(b);
	});

	it("dispose d'un vocabulaire latin sans mots qui se ressemblent", () => {
		const keys = INCANTATION_VOCABULARY.map(phoneticKey);
		expect(new Set(keys).size).toBe(keys.length);
		expect(keys.length).toBeGreaterThanOrEqual(FORMULA_WORD_COUNT * 50);
		for (let i = 0; i < keys.length; i += 1) {
			expect(keys[i].length).toBeGreaterThanOrEqual(4);
			for (let j = i + 1; j < keys.length; j += 1) {
				expect(editDistance(keys[i], keys[j])).toBeGreaterThanOrEqual(2);
			}
		}
		expect(MIN_WORD_SEPARATION).toBeGreaterThanOrEqual(2);
	});
});
