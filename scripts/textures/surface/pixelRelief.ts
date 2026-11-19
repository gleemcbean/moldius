const WALLPAPER = 2.4;
const RUG = 1.6;
const CLOTH = 1.1;

export const PIXEL_RELIEF: Record<string, number> = {
	wallpaperGreen: WALLPAPER,
	wallpaperRed: WALLPAPER,
	wallpaperBlue: WALLPAPER,
	wallpaperOchre: WALLPAPER,
	wallpaperPurple: WALLPAPER,
	wallpaperFloral: WALLPAPER,
	wallpaperTrellis: WALLPAPER,
	wallpaperStripes: 1.4,
	wallpaperFleur: WALLPAPER,
	wallpaperNursery: WALLPAPER,
	wallpaperStars: WALLPAPER,
	redCarpet: RUG,
	rugPersian: RUG,
	rugBlue: RUG,
	rugGreen: RUG,
	rugRound: RUG,
	rugRunner: RUG,
	tapestry: RUG,
	velvetRed: CLOTH,
	velvetGreen: CLOTH,
	velvetBlue: CLOTH,
	velvetPurple: CLOTH,
	linen: 1.8,
	burlap: 2.6,
	sheetCloth: CLOTH,
	sheetHanging: CLOTH,
	curtainPale: CLOTH,
	clothPale: CLOTH,
	books: 2.8,
	paintingLandscape: 0.9,
	paintingPortrait: 0.9,
	paintingMushroom: 0.9,
	paintingStillLife: 0.9,
	paintingStorm: 0.9,
	paintingAbstract: 0.9,
	armorPlate: 2.2,
	curiosityShelves: 2.2,
	ossuary: 2.8,
	specimens: 1.6,
	wicker: 3,
	horsePaint: 1,
	sarcophagusLid: 2.8,
	cageBars: 2.2,
	spindles: 2.2,
	fur: 2.4,
	bone: 1.6,
	mushroomSkin: 0.8,
	stem: 1,
	mushroomStem: 1.2,
	tanLeather: 1.6,
	gills: 2.6,
	mossDrape: 2.2,
	foliage: 1.6,
	foliageDark: 1.6,
	foliageWarm: 1.6,
	leafBlade: 1,
	palmFrond: 1,
	leafSprig: 1,
	slime: 1.6,
	paper: 0.6,
};

export const CAP_RELIEF = 1.4;

export function pixelReliefStrength(key: string): number {
	if (key.startsWith("cap-")) {
		return CAP_RELIEF;
	}
	return PIXEL_RELIEF[key] ?? 0;
}

export function pixelNormals(
	pixels: Uint8ClampedArray,
	width: number,
	height: number,
	strength: number,
): Uint8Array {
	const relief = new Float32Array(width * height);
	for (let y = 0; y < height; y += 1) {
		const source = (height - 1 - y) * width;
		for (let x = 0; x < width; x += 1) {
			const index = (source + x) * 4;
			const luma =
				(pixels[index] * 0.299 +
					pixels[index + 1] * 0.587 +
					pixels[index + 2] * 0.114) /
				255;
			relief[y * width + x] = luma * (pixels[index + 3] / 255);
		}
	}
	const normal = new Uint8Array(width * height * 4);
	for (let y = 0; y < height; y += 1) {
		const up = ((y + 1) % height) * width;
		const down = ((y - 1 + height) % height) * width;
		const row = y * width;
		for (let x = 0; x < width; x += 1) {
			const right = (x + 1) % width;
			const left = (x - 1 + width) % width;
			const dx = (relief[row + right] - relief[row + left]) * strength;
			const dy = (relief[up + x] - relief[down + x]) * strength;
			const inverse = 1 / Math.sqrt(dx * dx + dy * dy + 1);
			const out = (row + x) * 4;
			normal[out] = Math.round((-dx * inverse * 0.5 + 0.5) * 255);
			normal[out + 1] = Math.round((-dy * inverse * 0.5 + 0.5) * 255);
			normal[out + 2] = Math.round((inverse * 0.5 + 0.5) * 255);
			normal[out + 3] = Math.round(relief[row + x] * 255);
		}
	}
	return normal;
}
