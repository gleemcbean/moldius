export const LANGUAGES = ["fr", "en"] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "fr";

export function isLanguage(value: unknown): value is Language {
	return (
		typeof value === "string" &&
		(LANGUAGES as readonly string[]).includes(value)
	);
}

export function parseLanguage(header: string | undefined): Language | null {
	for (const part of (header ?? "").split(",")) {
		const tag = part.trim().split(";")[0]?.toLowerCase().split("-")[0];
		if (isLanguage(tag)) {
			return tag;
		}
	}
	return null;
}
