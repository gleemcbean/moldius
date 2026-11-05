import type { ColorLevels, GraphicsQuality } from "../types/settings";

export interface QualityPreset {
	lightPool: number;
	shadowMapSize: number;
	pixelRatio: number;
	antialias: boolean;
	particleScale: number;
	textureAnisotropy: number;
}

export const QUALITY_PRESETS: Record<GraphicsQuality, QualityPreset> = {
	low: {
		lightPool: 4,
		shadowMapSize: 256,
		pixelRatio: 0.5,
		antialias: false,
		particleScale: 0.5,
		textureAnisotropy: 1,
	},
	medium: {
		lightPool: 6,
		shadowMapSize: 512,
		pixelRatio: 0.6,
		antialias: true,
		particleScale: 0.8,
		textureAnisotropy: 4,
	},
	high: {
		lightPool: 8,
		shadowMapSize: 1024,
		pixelRatio: 0.7,
		antialias: true,
		particleScale: 1,
		textureAnisotropy: 8,
	},
};

export const FPS_LIMITS = [0, 30, 60, 90, 120, 144] as const;

export const COLOR_LEVELS: readonly ColorLevels[] = [185, 127, 104];
