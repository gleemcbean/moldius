import type { Language } from "./i18n/languages.js";

export const DEFAULT_PLAYER_NAMES: Record<Language, readonly string[]> = {
	fr: [
		"Morille Hardie",
		"Cèpe Bougon",
		"Girolle Vive",
		"Amanite Rieuse",
		"Pleurote Lunaire",
		"Trompette Noire",
		"Truffe Discrète",
		"Coulemelle",
		"Vesse-de-Loup",
		"Pied-Bleu",
		"Russule Rouge",
		"Mousseron Futé",
		"Lactaire Doux",
		"Clavaire Dorée",
		"Bolet Bai",
		"Craterelle",
		"Shiitaké Pressé",
		"Hydne Hérissé",
	],
	en: [
		"Bold Morel",
		"Grumpy Porcini",
		"Lively Chanterelle",
		"Giggling Amanita",
		"Moonlit Oyster",
		"Black Trumpet",
		"Shy Truffle",
		"Parasol",
		"Puffball",
		"Wood Blewit",
		"Red Brittlegill",
		"Clever Miller",
		"Mild Milkcap",
		"Golden Coral",
		"Bay Bolete",
		"Horn of Plenty",
		"Hasty Shiitake",
		"Hedgehog Hydnum",
	],
};

export function randomPlayerName(
	language: Language,
	exclude: readonly string[] = [],
	random: () => number = Math.random,
): string {
	const pool = DEFAULT_PLAYER_NAMES[language];
	const options = pool.filter((name) => !exclude.includes(name));
	const choices = options.length > 0 ? options : pool;

	return (
		choices[Math.floor(random() * choices.length)] ?? pool[0] ?? "Champignon"
	);
}
