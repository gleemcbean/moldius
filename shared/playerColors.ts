export const PLAYER_COLOR_CHOICES: readonly number[] = [
	0xd8442f, 0x3f7fd6, 0xe0b326, 0x8f4fc9, 0x4f9e45, 0xe2772a, 0xd9629a,
	0x8a5a34,
];

export const DEFAULT_PLAYER_COLOR = PLAYER_COLOR_CHOICES[0];

export function isPlayerColor(value: unknown): value is number {
	return typeof value === "number" && PLAYER_COLOR_CHOICES.includes(value);
}

export function colorHex(value: number): string {
	return value.toString(16).padStart(6, "0");
}
