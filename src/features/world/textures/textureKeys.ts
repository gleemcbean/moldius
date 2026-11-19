import { DEFAULT_HAT_PATTERN, type HatPattern } from "@shared/hatPatterns";
import { colorHex } from "@shared/playerColors";

export function capTextureKey(
	color: number,
	pattern: HatPattern = DEFAULT_HAT_PATTERN,
): string {
	return `cap-${colorHex(color)}-${pattern}`;
}

export type TextureMap = "albedo" | "normal" | "orm";

export function textureFile(
	category: string,
	key: string,
	map: TextureMap = "albedo",
	low = false,
): string {
	return `${category}/${low ? "low/" : ""}${map}/${key}.png`;
}
