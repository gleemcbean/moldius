import type { Language } from "./language";
import { appearanceEn, appearanceFr } from "./sections/home";

const NAMES: Record<Language, readonly string[]> = {
	fr: appearanceFr.names,
	en: appearanceEn.names,
};

export function defaultNames(language: Language): readonly string[] {
	return NAMES[language];
}

export function randomDefaultName(
	language: Language,
	exclude: string[] = [],
): string {
	const pool = NAMES[language];
	const options = pool.filter((name) => !exclude.includes(name));
	return options[Math.floor(Math.random() * options.length)] ?? pool[0];
}

export function isDefaultName(name: string): boolean {
	return Object.values(NAMES).some((pool) => pool.includes(name));
}
