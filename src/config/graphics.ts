import type {
	ColorLevels,
	GraphicsQuality,
	PostEffectLevels,
	PostEffectPreset,
} from "../types/settings";

export interface QualityPreset {
	lightPool: number;
	shadowMapSize: number;
	pixelRatio: number;
	maxDevicePixelRatio: number;
	antialias: boolean;
	particleScale: number;
	textureAnisotropy: number;
}

export const QUALITY_PRESETS: Record<GraphicsQuality, QualityPreset> = {
	low: {
		lightPool: 4,
		shadowMapSize: 256,
		pixelRatio: 0.5,
		maxDevicePixelRatio: 2,
		antialias: false,
		particleScale: 0.5,
		textureAnisotropy: 1,
	},
	medium: {
		lightPool: 6,
		shadowMapSize: 512,
		pixelRatio: 0.6,
		maxDevicePixelRatio: 2,
		antialias: true,
		particleScale: 0.8,
		textureAnisotropy: 4,
	},
	high: {
		lightPool: 8,
		shadowMapSize: 1024,
		pixelRatio: 0.8,
		maxDevicePixelRatio: 2,
		antialias: true,
		particleScale: 1,
		textureAnisotropy: 8,
	},
};

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

export const COLOR_LEVELS: readonly ColorLevels[] = [185, 127, 104];

export const DEFAULT_COLOR_LEVELS: ColorLevels = 127;

export const POST_EFFECT_PRESETS: Record<PostEffectPreset, PostEffectLevels> = {
	clear: {
		curvature: 0,
		aberration: 0,
		bleed: 0,
		vignette: 0,
		grain: 0,
		scanlines: 0,
		dither: 0,
		flicker: 0,
		band: 0,
		saturation: 0,
		danger: 1,
	},
	balanced: {
		curvature: 1,
		aberration: 0.45,
		bleed: 0,
		vignette: 0.55,
		grain: 0.85,
		scanlines: 0.3,
		dither: 0.5,
		flicker: 0.6,
		band: 0.5,
		saturation: 1,
		danger: 1,
	},
	vhs: {
		curvature: 1,
		aberration: 1,
		bleed: 1,
		vignette: 1,
		grain: 1,
		scanlines: 1,
		dither: 1,
		flicker: 1,
		band: 1,
		saturation: 1,
		danger: 1,
	},
};

export const DEFAULT_POST_EFFECT_PRESET: PostEffectPreset = "balanced";
