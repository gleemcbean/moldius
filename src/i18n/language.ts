import { isLanguage, type Language } from "@shared/i18n/languages";

export { isLanguage, LANGUAGES, type Language } from "@shared/i18n/languages";

export const LANGUAGE_NAMES: Record<Language, string> = {
	fr: "Français",
	en: "English",
};

export function browserLanguage(): Language {
	const preferred =
		typeof navigator === "undefined" ? [] : (navigator.languages ?? []);
	for (const tag of [
		...preferred,
		typeof navigator === "undefined" ? "" : navigator.language,
	]) {
		const base = tag?.toLowerCase().split("-")[0];
		if (isLanguage(base)) {
			return base;
		}
	}
	return "en";
}

export function speechLocale(language: Language): string {
	return language === "fr" ? "fr-FR" : "en-US";
}
