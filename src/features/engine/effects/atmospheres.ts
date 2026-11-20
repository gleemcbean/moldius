import type { AtmosphereKind } from "@shared/manor/rooms/blueprint";
import { roomBlueprint } from "@shared/manor/rooms/index";
import type { RoomType } from "@shared/manor/types";

export interface AtmosphereStyle {
	spores: readonly number[];
	sporesPerSquareMeter: number;
	sporeSize: number;
	rise: number;
	swirl: number;
	mist: number;
	mistOpacity: number;
	air: number;
	airMix: number;
	airDensity: number;
	tone: string;
	toneVolume: number;
}

export const ATMOSPHERES: Record<AtmosphereKind, AtmosphereStyle> = {
	spores: {
		spores: [0x9dffd8, 0xc8ff8a, 0x7ad8ff, 0xffd890, 0xb8ffe8],
		sporesPerSquareMeter: 4.2,
		sporeSize: 0.075,
		rise: 0.07,
		swirl: 0.22,
		mist: 0x7ae0c0,
		mistOpacity: 0.26,
		air: 0x0e2a22,
		airMix: 0.55,
		airDensity: 1.3,
		tone: "fungal-loop",
		toneVolume: 0.32,
	},
	fae: {
		spores: [0xd8a8ff, 0xffb8f0, 0x9ad8ff, 0xfff0b0, 0xc0a0ff],
		sporesPerSquareMeter: 3.2,
		sporeSize: 0.07,
		rise: 0.13,
		swirl: 0.45,
		mist: 0xb898ff,
		mistOpacity: 0.2,
		air: 0x1e1634,
		airMix: 0.5,
		airDensity: 1.15,
		tone: "fae-loop",
		toneVolume: 0.28,
	},
};

export interface RoomAtmosphereStyle {
	style: AtmosphereStyle;
	density: number;
}

export function atmosphereOf(type: RoomType): RoomAtmosphereStyle | null {
	const atmosphere = roomBlueprint(type).atmosphere;

	return atmosphere
		? { style: ATMOSPHERES[atmosphere.kind], density: atmosphere.density }
		: null;
}
