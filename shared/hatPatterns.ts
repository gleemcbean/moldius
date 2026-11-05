export const HAT_PATTERNS = [
	"spots",
	"plain",
	"speckles",
	"stripes",
	"rings",
	"stars",
	"scales",
	"swirl",
] as const;

export type HatPattern = (typeof HAT_PATTERNS)[number];

export const DEFAULT_HAT_PATTERN: HatPattern = "spots";

export function isHatPattern(value: unknown): value is HatPattern {
	return (
		typeof value === "string" &&
		(HAT_PATTERNS as readonly string[]).includes(value)
	);
}
