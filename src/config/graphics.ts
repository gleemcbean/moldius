import type { SurfaceQuality } from "../features/world/textures/TextureLibrary";
import type { GraphicsQuality } from "../types/settings";

export interface QualityPreset {
	lightPool: number;
	shadowMapSize: number;
	pixelRatio: number;
	maxDevicePixelRatio: number;
	msaaSamples: number;
	supersample: boolean;
	particleScale: number;
	textureAnisotropy: number;
	surfaceDetail: number;
	parallaxSteps: number;
}

export const QUALITY_PRESETS: Record<GraphicsQuality, QualityPreset> = {
	low: {
		lightPool: 4,
		shadowMapSize: 256,
		pixelRatio: 0.5,
		maxDevicePixelRatio: 2,
		msaaSamples: 0,
		supersample: false,
		particleScale: 0.5,
		textureAnisotropy: 1,
		surfaceDetail: 0.5,
		parallaxSteps: 0,
	},
	medium: {
		lightPool: 6,
		shadowMapSize: 512,
		pixelRatio: 0.6,
		maxDevicePixelRatio: 2,
		msaaSamples: 2,
		supersample: false,
		particleScale: 0.8,
		textureAnisotropy: 4,
		surfaceDetail: 0.5,
		parallaxSteps: 10,
	},
	high: {
		lightPool: 12,
		shadowMapSize: 1024,
		pixelRatio: 0.8,
		maxDevicePixelRatio: 2,
		msaaSamples: 4,
		supersample: true,
		particleScale: 1,
		textureAnisotropy: 8,
		surfaceDetail: 1,
		parallaxSteps: 18,
	},
};

export function surfaceQuality(quality: GraphicsQuality): SurfaceQuality {
	const preset = QUALITY_PRESETS[quality];

	return { detail: preset.surfaceDetail, parallax: preset.parallaxSteps };
}

export function renderPixelRatio(
	quality: GraphicsQuality,
	renderScale: number,
): number {
	const preset = QUALITY_PRESETS[quality];

	const device =
		typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

	return (
		Math.min(device, preset.maxDevicePixelRatio) *
		preset.pixelRatio *
		renderScale
	);
}

export const FPS_LIMITS = [0, 30, 60, 90, 120, 144] as const;
