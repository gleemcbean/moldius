import { FORMULA_WORD_COUNT } from "../config/index.js";
import type { SeededRandom } from "../random.js";
import { INCANTATION_VOCABULARY } from "./vocabulary.js";

export type Formula = readonly string[];

export const MAX_FILLER_BETWEEN_WORDS = 2;
export const MAX_EXTRA_TOKENS = 4;
export const MAX_TOKENS_PER_WORD = 3;
export const MIN_WORD_SEPARATION = 3;

const PHONETIC_RULES: [RegExp, string][] = [
	[/ph/g, "f"],
	[/th/g, "t"],
	[/rh/g, "r"],
	[/ch/g, "k"],
	[/qu/g, "k"],
	[/ck/g, "k"],
	[/gu(?=[eiy])/g, "g"],
	[/c(?=[eiy])/g, "s"],
	[/g(?=[eiy])/g, "j"],
	[/[cq]/g, "k"],
	[/x/g, "ks"],
	[/z/g, "s"],
	[/y/g, "i"],
	[/w/g, "v"],
	[/h/g, ""],
	[/eau/g, "o"],
	[/au/g, "o"],
	[/[ao]e/g, "e"],
	[/[ae]i/g, "e"],
	[/ou/g, "u"],
	[/(.)\1+/g, "$1"],
	[/um$/g, "om"],
	[/[ae][mn](?=[^aeiou]|$)/g, "en"],
	[/[ou][mn](?=[^aeiou])/g, "on"],
	[/(.)\1+/g, "$1"],
];

export function normalizeSpeech(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/œ/g, "oe")
		.replace(/æ/g, "ae")
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter((token) => token.length > 0);
}

export function normalizeWord(word: string): string {
	return normalizeSpeech(word).join("");
}

export function phoneticKey(word: string): string {
	let key = normalizeWord(word);
	for (const [pattern, replacement] of PHONETIC_RULES) {
		key = key.replace(pattern, replacement);
	}
	if (key.length > 3 && key.endsWith("e")) {
		key = key.slice(0, -1);
	}
	return key;
}

export function editDistance(a: string, b: string): number {
	if (a === b) {
		return 0;
	}
	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i += 1) {
		const current = [i];
		for (let j = 1; j <= b.length; j += 1) {
			current.push(
				Math.min(
					previous[j] + 1,
					current[j - 1] + 1,
					previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
				),
			);
		}
		previous = current;
	}
	return previous[b.length];
}

export function phoneticTolerance(key: string): number {
	if (key.length <= 3) {
		return 0;
	}
	return key.length <= 6 ? 1 : 2;
}

export function soundsLike(spoken: string, expectedKey: string): boolean {
	const key = phoneticKey(spoken);
	return (
		key.length > 0 &&
		Math.abs(key.length - expectedKey.length) <=
			phoneticTolerance(expectedKey) &&
		editDistance(key, expectedKey) <= phoneticTolerance(expectedKey)
	);
}

export function transcriptMatchesFormula(
	transcript: string,
	formula: Formula,
): boolean {
	const tokens = normalizeSpeech(transcript);
	const expected = formula.map(phoneticKey);
	if (
		tokens.length === 0 ||
		tokens.length > expected.length * MAX_TOKENS_PER_WORD + MAX_EXTRA_TOKENS
	) {
		return false;
	}
	return matchFrom(tokens, expected, 0, 0, 0);
}

function matchFrom(
	tokens: string[],
	expected: string[],
	tokenIndex: number,
	wordIndex: number,
	skipped: number,
): boolean {
	if (wordIndex === expected.length) {
		return skipped + tokens.length - tokenIndex <= MAX_EXTRA_TOKENS;
	}
	const limit =
		wordIndex === 0
			? tokens.length
			: Math.min(tokens.length, tokenIndex + MAX_FILLER_BETWEEN_WORDS + 1);
	for (let index = tokenIndex; index < limit; index += 1) {
		const extra = skipped + index - tokenIndex;
		if (extra > MAX_EXTRA_TOKENS) {
			return false;
		}
		for (
			let span = 1;
			span <= MAX_TOKENS_PER_WORD && index + span <= tokens.length;
			span += 1
		) {
			const spoken = tokens.slice(index, index + span).join("");
			if (
				soundsLike(spoken, expected[wordIndex]) &&
				matchFrom(tokens, expected, index + span, wordIndex + 1, extra)
			) {
				return true;
			}
		}
	}
	return false;
}

function pickSeparated(
	pool: readonly string[],
	needed: number,
	separation: number,
): string[] | null {
	const chosen: string[] = [];
	const keys: string[] = [];
	for (const word of pool) {
		const key = phoneticKey(word);
		if (keys.every((other) => editDistance(other, key) >= separation)) {
			chosen.push(word);
			keys.push(key);
			if (chosen.length === needed) {
				return chosen;
			}
		}
	}
	return null;
}

export function generateFormulas(
	rng: SeededRandom,
	count: number,
	forbidden: ReadonlySet<string> = new Set(),
): Formula[] {
	const needed = count * FORMULA_WORD_COUNT;
	const fresh = rng.shuffle(
		INCANTATION_VOCABULARY.filter(
			(word) => !forbidden.has(formulaKeyWord(word)),
		),
	);
	const everything = rng.shuffle([...INCANTATION_VOCABULARY]);
	const words =
		pickSeparated(fresh, needed, MIN_WORD_SEPARATION) ??
		pickSeparated(fresh, needed, 2) ??
		pickSeparated(everything, needed, MIN_WORD_SEPARATION) ??
		pickSeparated(everything, needed, 2);
	if (!words) {
		throw new Error(`Vocabulaire insuffisant pour ${needed} mots distincts`);
	}
	const formulas: Formula[] = [];
	for (let index = 0; index < count; index += 1) {
		formulas.push(
			words.slice(index * FORMULA_WORD_COUNT, (index + 1) * FORMULA_WORD_COUNT),
		);
	}
	return formulas;
}

export function formulaKeyWord(word: string): string {
	return phoneticKey(word);
}

export function formulaText(formula: Formula): string {
	return formula.join(" ");
}
