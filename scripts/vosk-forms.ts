import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import {
	editDistance,
	phoneticKey,
	soundsLike,
} from "../shared/anomalies/formulas.js";
import { INCANTATION_VOCABULARY } from "../shared/anomalies/vocabulary.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODELS = {
	fr: "vosk-model-small-fr-0.22",
	en: "vosk-model-small-en-us-0.15",
} as const;
const MAX_FORMS = 3;

function fileFromArchive(archivePath: string, wanted: string): Buffer {
	const archive = gunzipSync(readFileSync(archivePath));
	for (let offset = 0; offset + 512 <= archive.length; ) {
		const header = archive.subarray(offset, offset + 512);
		if (header.every((byte) => byte === 0)) {
			break;
		}
		const name = header.toString("utf8", 0, 100).replace(/\0.*$/s, "");
		const size = Number.parseInt(
			header.toString("ascii", 124, 136).replace(/\0.*$/s, "").trim() || "0",
			8,
		);
		const start = offset + 512;
		if (name === wanted) {
			return archive.subarray(start, start + size);
		}
		offset = start + Math.ceil(size / 512) * 512;
	}
	throw new Error(`${wanted} introuvable dans ${archivePath}`);
}

function modelWords(grammarFst: Buffer): string[] {
	const marker = Buffer.from("words.txt");
	for (
		let found = grammarFst.indexOf(marker);
		found >= 0;
		found = grammarFst.indexOf(marker, found + 1)
	) {
		const nameEnd = found + marker.length;
		for (
			let start = nameEnd - 1;
			start >= Math.max(4, nameEnd - 200);
			start -= 1
		) {
			if (grammarFst.readInt32LE(start - 4) !== nameEnd - start) {
				continue;
			}
			const size = Number(grammarFst.readBigInt64LE(nameEnd + 8));
			if (size <= 0 || size > 10_000_000) {
				continue;
			}
			const words: string[] = [];
			let offset = nameEnd + 16;
			for (let index = 0; index < size; index += 1) {
				const length = grammarFst.readInt32LE(offset);
				words.push(
					grammarFst.toString("utf8", offset + 4, offset + 4 + length),
				);
				offset += 4 + length + 8;
			}
			return words;
		}
	}
	throw new Error("Table de symboles introuvable dans Gr.fst");
}

function spokenForms(vocabulary: string[]): Record<string, string[]> {
	const words = vocabulary.filter(
		(word) =>
			/^[a-zà-ÿœæ]+$/.test(word) &&
			(word.length >= 2 || word === "a" || word === "à"),
	);
	const known = new Set(words);
	const byKey = new Map<string, string[]>();
	for (const word of words) {
		const key = phoneticKey(word);
		if (key) {
			byKey.set(key, [...(byKey.get(key) ?? []), word]);
		}
	}
	const table: Record<string, string[]> = {};
	for (const latin of INCANTATION_VOCABULARY) {
		const key = phoneticKey(latin);
		const score = (phrase: string, pair: boolean) => {
			const spokenKey = phoneticKey(phrase.replace(/ /g, ""));
			return (
				editDistance(spokenKey, key) * 10 +
				(spokenKey[0] === key[0] ? 0 : 12) +
				Math.abs(spokenKey.length - key.length) +
				(pair ? 4 : 0)
			);
		};
		const candidates = words
			.filter((word) => word !== latin && soundsLike(word, key))
			.map((word) => ({ phrase: word, score: score(word, false) }));
		const pairs = (left: readonly string[], right: readonly string[]): void => {
			for (const a of left) {
				for (const b of right) {
					if (soundsLike(a + b, key)) {
						candidates.push({
							phrase: `${a} ${b}`,
							score: score(`${a} ${b}`, true),
						});
					}
				}
			}
		};
		for (let split = 1; split < key.length; split += 1) {
			pairs(
				(byKey.get(key.slice(0, split)) ?? [])
					.filter((word) => word.length >= 2)
					.slice(0, 8),
				(byKey.get(key.slice(split)) ?? []).slice(0, 8),
			);
		}
		if (!candidates.some((candidate) => candidate.score < 12)) {
			for (let split = 2; split < key.length - 1; split += 1) {
				const prefix = key.slice(0, split);
				const right = (byKey.get(key.slice(split)) ?? []).slice(0, 3);
				if (right.length === 0) {
					continue;
				}
				for (const [leftKey, left] of byKey) {
					if (
						leftKey[0] === prefix[0] &&
						Math.abs(leftKey.length - prefix.length) <= 1 &&
						editDistance(leftKey, prefix) <= 1
					) {
						pairs(left.filter((word) => word.length >= 2).slice(0, 3), right);
					}
				}
			}
		}
		if (!candidates.some((candidate) => candidate.score < 12)) {
			const near = (target: string, sameStart: boolean) =>
				[...byKey.entries()]
					.filter(
						([other]) =>
							(!sameStart || other[0] === target[0]) &&
							Math.abs(other.length - target.length) <= 1 &&
							editDistance(other, target) <= 1,
					)
					.flatMap(([, list]) =>
						list.filter((word) => word.length >= 2).slice(0, 2),
					)
					.slice(0, 6);
			for (let split = 2; split < key.length - 1; split += 1) {
				pairs(near(key.slice(0, split), true), near(key.slice(split), false));
			}
		}
		candidates.sort(
			(a, b) => a.score - b.score || a.phrase.length - b.phrase.length,
		);
		const forms = known.has(latin) ? [latin] : [];
		for (const { phrase, score: value } of candidates) {
			if (
				forms.length >= MAX_FORMS ||
				value >= (forms.length === 0 ? 20 : 12)
			) {
				break;
			}
			if (!forms.includes(phrase)) {
				forms.push(phrase);
			}
		}
		table[latin] = forms;
	}
	return table;
}

const tables: Record<string, Record<string, string[]>> = {};
for (const [language, model] of Object.entries(MODELS)) {
	const grammar = fileFromArchive(
		resolve(root, "public/vosk", `${model}.tar.gz`),
		`${model}/graph/Gr.fst`,
	);
	tables[language] = spokenForms(modelWords(grammar));
	const missing = Object.entries(tables[language])
		.filter(([, forms]) => forms.length === 0)
		.map(([word]) => word);
	console.log(
		`Vosk ${language} : ${INCANTATION_VOCABULARY.length - missing.length}/${INCANTATION_VOCABULARY.length} mots couverts${missing.length ? ` (sans forme : ${missing.join(", ")})` : ""}`,
	);
}

const output = resolve(root, "src/features/voice/voskForms.ts");
writeFileSync(
	output,
	`// Généré par scripts/vosk-forms.ts (npm run vosk:forms) : ne pas modifier à la main.
import type { Language } from "@shared/i18n/languages";

/**
 * Pour chaque mot des incantations, des façons de le dire avec les mots que connaît le modèle
 * Vosk de la langue. Toutes sonnent comme le mot latin pour le comparateur phonétique du jeu.
 */
export const VOSK_SPOKEN_FORMS: Record<
	Language,
	Readonly<Record<string, readonly string[]>>
> = ${JSON.stringify(tables, null, "\t")};
`,
);
console.log(`Écrit : ${output}`);
