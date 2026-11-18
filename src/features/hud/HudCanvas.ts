import {
	GHOST_DOOR_COOLDOWN_MS,
	GHOST_KNOCK_COOLDOWN_MS,
	MAX_PHOTOS_PER_MATCH,
	POSSESSED_POWER_COOLDOWN_MS,
	PUSH_COOLDOWN_MS,
	ROLE_REVEAL_MS,
	SHOUT_COOLDOWN_MS,
	VOICE_AUDIBLE_LEVEL,
} from "@shared/config/index";
import {
	MATERIAL_IDS,
	type MaterialId,
	OCCULT_IDS,
	OCCULT_RECIPES,
	type OccultId,
} from "@shared/config/occult";
import type { BrewEffect } from "@shared/manor/brews";
import type { Level } from "@shared/manor/types";
import { TEAM_COLORS, teamStandings } from "@shared/teams";
import * as THREE from "three";
import { ICON_PATHS } from "../../components/Icon";
import { activeBindings, backCode, keyLabel } from "../../config/controls";
import { currentMessages } from "../../i18n";
import { formatClock, hexColor } from "../../utils/format";
import {
	curvatureZoom,
	HUD_BEND,
	POST_BULGE,
	POST_EFFECTS,
	type ScreenVeil,
} from "../engine/render/PostEffects";
import {
	drawPadGlyph,
	FACE_GLYPHS,
	faceLetterPath,
	GLYPH_GAP,
	GLYPH_SCALE,
	hasGlyph,
	splitGlyphs,
} from "../gamepad/padGlyphs";
import type { ObjectArt, ObjectArtId } from "../grimoire/objectArt";
import { MAP_MAX_ZOOM, mapStore, resetMap, zoomMap } from "../map/mapStore";
import { settingsStore } from "../settings/settingsStore";
import { HudRecorder } from "./HudRecorder";
import { hazeFilter } from "./hazeFilter";
import { type HudState, hudStore, type LeaderboardRow } from "./hudStore";

export const MINIMAP_SIZE = 224;

const RESOLUTION = 0.82;
const REFERENCE_WIDTH = 1500;
const REFERENCE_HEIGHT = 790;
const MIN_SCALE = 1.12;
const MAX_SCALE = 2;
const PAINT_INTERVAL_MS = 1000 / 240;
const WALKIE_ICON = new Path2D(ICON_PATHS.walkie);
const FEEDBACK_MS = 4200;
const NOISE_SEGMENTS = 18;
const HEALTH_TRAIL_HOLD_MS = 420;
const HEALTH_TRAIL_SPEED = 45;
const LOW_HEALTH = 30;
const BAR_GLOW = 9;
const ENERGY_DENIED_MS = 450;
const BREW_PANEL_HEIGHT = 46;
const MAP_MARGIN = 40;
const MAP_MAX_WIDTH = 1800;
const MAP_HEADER = 56;
const MAP_FOOTER = 74;
const MAP_BORDER = 3;
const MAP_BACKGROUND = "#0d100d";
const MAP_HOVER = "#2c342d";
const MAP_ALLY = "#3fb8a4";
const MAP_WINDOW = "#8fd3e6";
const MAP_STAIRS = "#aabeff";
const GAUGE_SNAP = 0.002;

const YELLOW = "#dce54d";
const YELLOW_DEEP = "#b9c22f";
const BACKGROUND = "#111512";
const PANEL_BACKGROUND = "#1d231f";
const LINE_STRONG = "#46543f";
const TEXT = "#ecefe2";
const TEXT_MUTED = "#b4bca8";
const TEXT_DIM = "#7d8676";
const DANGER = "#e5533d";
const OK = "#8fd36a";
const VOICE = "#63c6e8";
const ALTAR = "#2ee6d6";
const DARK_PANEL = "rgba(10, 12, 10, 0.78)";

const BODY = "Alegreya, Georgia, serif";
const BREW_COLORS: Record<BrewEffect, string> = {
	nausea: "#7dff5a",
	feather: "#c39bff",
	haste: "#6cc4ff",
	sluggish: "#ffb45a",
	vigor: "#ff6a5a",
};
const FIGURES = '"Barlow Condensed", "Arial Narrow", sans-serif';
const TITLE = '"IM Fell English SC", Alegreya, Georgia, serif';
const UI = '"Barlow Condensed", "Arial Narrow", sans-serif';

const FEEDBACK_TONES: Record<string, string> = {
	success: OK,
	error: DANGER,
	warning: YELLOW,
	info: VOICE,
};

type VeilShape = Omit<ScreenVeil, "alpha">;

function tint(
	red: number,
	green: number,
	blue: number,
	alpha: number,
): readonly [number, number, number, number] {
	return [red / 255, green / 255, blue / 255, alpha];
}

function screenVeil(
	from: number,
	inner: readonly [number, number, number, number],
	to: number,
	outer: readonly [number, number, number, number],
): VeilShape {
	return {
		x: 0.5,
		y: 0.5,
		radiusX: Math.SQRT1_2,
		radiusY: Math.SQRT1_2,
		from,
		to,
		inner,
		outer,
	};
}

const SPOTTED_VEIL = screenVeil(0.4, tint(0, 0, 0, 0), 1, tint(40, 0, 0, 0.55));
const GAZE_VEIL = screenVeil(0.35, tint(0, 0, 0, 0), 1, tint(20, 90, 80, 0.6));
const DAMAGE_VEIL = screenVeil(
	0.45,
	tint(160, 0, 0, 0),
	1,
	tint(170, 10, 0, 0.7),
);
const WOUNDED_VEIL = screenVeil(
	0.55,
	tint(120, 0, 0, 0),
	1,
	tint(120, 0, 0, 0.35),
);
const SLIMED_VEIL: VeilShape = {
	x: 0.5,
	y: 1,
	radiusX: Math.SQRT1_2,
	radiusY: Math.SQRT2,
	from: 0,
	to: 0.45,
	inner: tint(90, 160, 40, 0.35),
	outer: tint(90, 160, 40, 0),
};
const BLOOD_MOON_VEIL = screenVeil(
	0.5,
	tint(120, 0, 10, 0),
	1,
	tint(150, 10, 20, 0.42),
);
const HIDDEN_VEIL = screenVeil(
	0.25,
	tint(0, 0, 0, 0),
	0.75,
	tint(0, 0, 0, 0.85),
);
const CARRIED_VEIL = screenVeil(
	0,
	tint(40, 28, 14, 0.75),
	0.7,
	tint(10, 6, 2, 0.97),
);

type TextAlign = "left" | "center" | "right";

interface TextStyle {
	font: string;
	color?: string;
	align?: TextAlign;
	outline?: boolean;
	glyphSize?: number;
}

interface Stop {
	at: number;
	color: string;
}

export interface HudPoint {
	x: number;
	y: number;
}

export interface HudMarker {
	x: number;
	y: number;
	onScreen: boolean;
	angle: number;
	label: string;
	detail: string;
	color: string;
	fresh: number;
}

export interface MapArea {
	x: number;
	y: number;
	width: number;
	height: number;
	ratio: number;
}

interface MapButton {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	run: () => void;
}

export function ensureHudFonts(): Promise<unknown> {
	if (!document.fonts) {
		return Promise.resolve();
	}
	return Promise.all(
		[
			`500 20px ${UI}`,
			`700 20px ${UI}`,
			`700 40px ${FIGURES}`,
			`500 20px ${FIGURES}`,
			`400 32px ${TITLE}`,
		].map((font) => document.fonts.load(font)),
	);
}

function layerTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.NoColorSpace;
	texture.premultiplyAlpha = true;
	texture.generateMipmaps = false;
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;
	return texture;
}

export class HudCanvas {
	readonly texture: THREE.CanvasTexture;
	readonly minimap = document.createElement("canvas");
	readonly minimapTexture: THREE.CanvasTexture;
	readonly minimapRect = new THREE.Vector4();
	readonly minimapPixels = new THREE.Vector2(1, 1);
	minimapShown = false;
	readonly bigMap = document.createElement("canvas");
	minimapLabel = "";
	minimapRoom = "";
	mapLevels: readonly Level[] = [0];
	markers: HudMarker[] = [];
	readonly veils: ScreenVeil[] = [];
	onMapClose: (() => void) | null = null;
	private mapHover: string | null = null;
	private mapButtons: MapButton[] = [];
	private readonly canvas = document.createElement("canvas");
	private readonly context: HudRecorder;
	private readonly source: THREE.Texture;
	private readonly uploadRegion = new THREE.Box2();
	private readonly uploadAt = new THREE.Vector2();
	private readonly hazedMinimap = document.createElement("canvas");
	private minimapDirty = true;
	private minimapHaze = -1;
	private minimapUploaded = 0;
	private width = 1;
	private height = 1;
	private drawScale = RESOLUTION;
	private paintedAt = -Infinity;
	private feedbackId = -1;
	private feedbackAt = 0;
	private gaugeShown = 0;
	private minimapBottom = 0;
	private materialsBottom = 0;
	private healthTrail = 100;
	private healthSeen = 100;
	private healthTrailHold = 0;
	private readonly wrapCache = new Map<string, string[]>();

	constructor(private readonly art: ObjectArt) {
		this.context = new HudRecorder(
			this.canvas.getContext("2d") as CanvasRenderingContext2D,
		);
		this.context.registerPath(WALKIE_ICON, 0, 0, 16, 16);
		for (const glyph of FACE_GLYPHS) {
			this.context.registerPath(faceLetterPath(glyph), 4, 4, 16, 16);
		}
		this.texture = layerTexture(this.canvas);
		this.texture.flipY = false;
		this.source = new THREE.Texture(this.canvas);
		this.minimapTexture = layerTexture(this.minimap);
	}

	get pixelWidth(): number {
		return this.canvas.width;
	}

	get pixelHeight(): number {
		return this.canvas.height;
	}

	resize(width: number, height: number): void {
		const pixelWidth = Math.max(1, Math.round(width * RESOLUTION));
		const pixelHeight = Math.max(1, Math.round(height * RESOLUTION));
		const scale = Math.min(
			MAX_SCALE,
			Math.max(
				MIN_SCALE,
				Math.min(width / REFERENCE_WIDTH, height / REFERENCE_HEIGHT),
			),
		);
		this.drawScale = RESOLUTION * scale;
		this.width = Math.max(1, width / scale);
		this.height = Math.max(1, height / scale);
		if (
			this.canvas.width !== pixelWidth ||
			this.canvas.height !== pixelHeight
		) {
			this.canvas.width = pixelWidth;
			this.canvas.height = pixelHeight;
			this.texture.dispose();
			this.wrapCache.clear();
			this.context.forgetMeasures();
		}
		this.context.invalidate();
		this.paintedAt = -Infinity;
	}

	markMinimap(): void {
		this.minimapDirty = true;
	}

	due(now: number): boolean {
		return now - this.paintedAt >= PAINT_INTERVAL_MS;
	}

	paint(now: number, renderer: THREE.WebGLRenderer): void {
		const dt = Math.min(0.2, (now - this.paintedAt) / 1000);
		this.paintedAt = now;
		const settings = settingsStore.get();
		const hud = hudStore.get();
		const context = this.context;
		context.begin();
		this.minimapShown = false;
		context.setTransform(this.drawScale, 0, 0, this.drawScale, 0, 0);
		context.textBaseline = "middle";
		context.lineJoin = "round";
		this.updateVeils(hud, now);
		context.section();
		this.paintLookAway(hud);
		context.section();
		if (hud.noMap) {
			this.minimapBottom = 20;
		} else {
			this.paintMinimap(hud);
		}
		context.section();
		this.paintTopBar(hud, now);
		context.section();
		this.paintMaterials(hud);
		context.section();
		if (!hud.ghost) {
			this.paintStatus(hud, now, dt);
		}
		context.section();
		this.paintBrew(hud, now);
		context.section();
		this.paintWalkie(hud, now);
		context.section();
		this.paintCamera(hud);
		context.section();
		this.paintAbilities(hud);
		context.section();
		if (!hud.ghost) {
			this.paintHotbar(hud);
		}
		this.paintMarkers(hud);
		context.section();
		this.paintPrompt(hud);
		context.section();
		this.paintCast(hud, now);
		context.section();
		this.paintFeedback(hud, now);
		context.section();
		this.paintAltar(hud);
		context.section();
		this.paintGift(hud);
		context.section();
		this.paintTutorial(hud);
		context.section();
		this.paintNoise(hud, dt);
		context.section();
		this.paintDev(hud);
		context.section();
		this.paintStats(hud, settings.stats);
		context.section();
		if (hud.ghost) {
			this.paintGhost(hud);
		} else {
			this.paintDeath(hud);
		}
		context.section();
		this.paintWheel(hud);
		context.section();
		this.paintRole(hud, now);
		context.section();
		this.paintLeaderboard(hud, now);
		context.section();
		if (hud.showMap && !hud.noMap) {
			this.paintBigMap(hud);
			context.invalidate();
		}
		if (context.commit()) {
			this.upload(renderer);
		}
	}

	private upload(renderer: THREE.WebGLRenderer): void {
		const context = this.context;
		if (context.repaintedAll) {
			this.texture.needsUpdate = true;
			return;
		}
		for (const region of context.repainted) {
			this.uploadRegion.min.set(region.left, region.top);
			this.uploadRegion.max.set(region.right, region.bottom);
			this.uploadAt.set(region.left, region.top);
			renderer.copyTextureToTexture(
				this.source,
				this.texture,
				this.uploadRegion,
				this.uploadAt,
			);
		}
	}

	pointer(
		clientX: number,
		clientY: number,
		canvas: HTMLCanvasElement,
	): HudPoint {
		const rect = canvas.getBoundingClientRect();
		const column = Math.floor(
			((clientX - rect.left) / rect.width) * canvas.width,
		);
		const row = Math.floor(
			((clientY - rect.top) / rect.height) * canvas.height,
		);
		return this.at(
			((column + 0.5) / canvas.width) * this.width,
			((row + 0.5) / canvas.height) * this.height,
		);
	}

	minimapRatio(): number {
		const pixels = Math.max(1, Math.round(this.minimapSize() * this.drawScale));
		if (this.minimap.width !== pixels) {
			this.minimap.width = pixels;
			this.minimap.height = pixels;
			this.minimapDirty = true;
		}
		return pixels / MINIMAP_SIZE;
	}

	private refreshMinimap(haze: number): void {
		if (!this.minimapDirty && haze === this.minimapHaze) {
			return;
		}
		this.minimapDirty = false;
		this.minimapHaze = haze;
		const filter = hazeFilter(haze);
		let source = this.minimap;
		if (filter) {
			const hazed = this.hazedMinimap;
			if (
				hazed.width !== this.minimap.width ||
				hazed.height !== this.minimap.height
			) {
				hazed.width = this.minimap.width;
				hazed.height = this.minimap.height;
			}
			const context = hazed.getContext("2d");
			if (context) {
				context.setTransform(1, 0, 0, 1, 0, 0);
				context.filter = "none";
				context.fillStyle = YELLOW;
				context.fillRect(0, 0, hazed.width, hazed.height);
				context.filter = filter;
				context.drawImage(this.minimap, 0, 0);
				context.filter = "none";
				source = hazed;
			}
		}
		if (this.minimapUploaded !== source.width) {
			this.minimapTexture.dispose();
			this.minimapUploaded = source.width;
		}
		this.minimapTexture.image = source;
		this.minimapTexture.needsUpdate = true;
	}

	mapArea(): MapArea {
		const frame = this.mapFrame();
		const area = {
			x: frame.x + MAP_BORDER,
			y: frame.y + MAP_HEADER,
			width: frame.width - MAP_BORDER * 2,
			height: Math.max(40, frame.height - MAP_HEADER - MAP_FOOTER),
		};
		const pixelWidth = Math.max(1, Math.round(area.width * this.drawScale));
		const pixelHeight = Math.max(1, Math.round(area.height * this.drawScale));
		if (this.bigMap.width !== pixelWidth) {
			this.bigMap.width = pixelWidth;
		}
		if (this.bigMap.height !== pixelHeight) {
			this.bigMap.height = pixelHeight;
		}
		return { ...area, ratio: this.drawScale };
	}

	inMapArea(point: HudPoint): boolean {
		const area = this.mapArea();
		return (
			point.x >= area.x &&
			point.y >= area.y &&
			point.x <= area.x + area.width &&
			point.y <= area.y + area.height
		);
	}

	get hoveredMapButton(): string | null {
		return this.mapHover;
	}

	hoverMap(point: HudPoint | null): boolean {
		this.mapHover = point ? (this.mapButtonAt(point)?.id ?? null) : null;
		return this.mapHover !== null;
	}

	pressMap(point: HudPoint): boolean {
		const button = this.mapButtonAt(point);
		button?.run();
		return button !== undefined;
	}

	private mapButtonAt(point: HudPoint): MapButton | undefined {
		return this.mapButtons.find(
			(button) =>
				point.x >= button.x &&
				point.y >= button.y &&
				point.x <= button.x + button.width &&
				point.y <= button.y + button.height,
		);
	}

	private mapFrame(): { x: number; y: number; width: number; height: number } {
		const along = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
		const left = Math.max(
			...along.map((share) => this.at(MAP_MARGIN, share * this.height).x),
		);
		const right = Math.min(
			...along.map(
				(share) => this.at(this.width - MAP_MARGIN, share * this.height).x,
			),
		);
		const top = Math.max(
			...along.map((share) => this.at(share * this.width, MAP_MARGIN).y),
		);
		const bottom = Math.min(
			...along.map(
				(share) => this.at(share * this.width, this.height - MAP_MARGIN).y,
			),
		);
		const width = Math.min(MAP_MAX_WIDTH, right - left);
		return {
			x: (left + right - width) / 2,
			y: top,
			width,
			height: bottom - top,
		};
	}

	private minimapSize(): number {
		return Math.max(150, Math.min(MINIMAP_SIZE, this.height * 0.3));
	}

	private at(x: number, y: number): { x: number; y: number } {
		const nx = x / this.width;
		const ny = y / this.height;
		const cx = nx - 0.5;
		const cy = ny - 0.5;
		const aspect = this.width / this.height;
		const bulge = POST_BULGE * POST_EFFECTS.curvature;
		const factor =
			(1 + bulge * ((cx * aspect) ** 2 + cy * cy)) /
			curvatureZoom(POST_EFFECTS.curvature, aspect);
		return {
			x: (nx + (0.5 + cx * factor - nx) * HUD_BEND) * this.width,
			y: (ny + (0.5 + cy * factor - ny) * HUD_BEND) * this.height,
		};
	}

	private place(
		x: number,
		y: number,
		width: number,
		height: number,
		alignX: "left" | "center" | "right",
		alignY: "top" | "center" | "bottom",
	): { x: number; y: number } {
		const left =
			alignX === "left" ? x : alignX === "right" ? x - width : x - width / 2;
		const top =
			alignY === "top" ? y : alignY === "bottom" ? y - height : y - height / 2;
		const across = (position: number, extent: number) =>
			[0, 0.25, 0.5, 0.75, 1].map((share) => position + extent * share);
		const edgeX = (screenX: number) =>
			across(top, height).map((screenY) => this.at(screenX, screenY).x);
		const edgeY = (screenY: number) =>
			across(left, width).map((screenX) => this.at(screenX, screenY).y);
		const placedX =
			alignX === "left"
				? Math.max(...edgeX(left))
				: alignX === "right"
					? Math.min(...edgeX(left + width)) - width
					: this.at(x, top + height / 2).x - width / 2;
		const placedY =
			alignY === "top"
				? Math.max(...edgeY(top))
				: alignY === "bottom"
					? Math.min(...edgeY(top + height)) - height
					: this.at(left + width / 2, y).y - height / 2;
		return { x: placedX, y: placedY };
	}

	private glyphSize(limit?: number): number {
		const match = /(\d+(?:\.\d+)?)px/.exec(this.context.font);
		const pixels = match ? Number(match[1]) : 16;
		const size = Math.round(pixels * GLYPH_SCALE);
		return limit === undefined ? size : Math.min(size, limit);
	}

	private onlyGlyph(value: string): boolean {
		const runs = splitGlyphs(value);
		return runs.length === 1 && "glyph" in runs[0];
	}

	private keyCapWidth(value: string, minimum: number, height: number): number {
		if (this.onlyGlyph(value)) {
			return height;
		}
		return Math.max(minimum, this.measure(value, height - 6).width + 8);
	}

	private keyCap(
		value: string,
		x: number,
		y: number,
		width: number,
		height: number,
		font: string,
	): void {
		if (this.onlyGlyph(value)) {
			this.text(value, x + width / 2, y + height / 2, {
				font,
				align: "center",
				outline: false,
				glyphSize: height,
			});
			return;
		}
		this.panel(x, y, width, height, YELLOW);
		this.text(value, x + width / 2, y + height / 2 + 1, {
			font,
			color: BACKGROUND,
			align: "center",
			outline: false,
			glyphSize: height - 6,
		});
	}

	private measure(value: string, glyphLimit?: number): { width: number } {
		if (!hasGlyph(value)) {
			return this.context.measureText(value);
		}
		const size = this.glyphSize(glyphLimit);
		const gap = size * GLYPH_GAP;
		let width = 0;
		for (const run of splitGlyphs(value)) {
			width +=
				"glyph" in run
					? size + gap * 2
					: this.context.measureText(run.text).width;
		}
		return { width };
	}

	private glyphCenterY(y: number, size: number): number {
		switch (this.context.textBaseline) {
			case "top":
			case "hanging":
				return y + size * 0.42;
			case "bottom":
			case "ideographic":
				return y - size * 0.42;
			case "alphabetic":
				return y - size * 0.3;
			default:
				return y;
		}
	}

	private glyphText(
		value: string,
		x: number,
		y: number,
		align: CanvasTextAlign,
		outline: boolean,
		color: string,
		glyphLimit?: number,
	): void {
		const context = this.context;
		const size = this.glyphSize(glyphLimit);
		const gap = size * GLYPH_GAP;
		const width = this.measure(value, glyphLimit).width;
		const start =
			align === "center"
				? x - width / 2
				: align === "right" || align === "end"
					? x - width
					: x;
		const runs = splitGlyphs(value);
		const centerY = this.glyphCenterY(y, size);
		context.textAlign = "left";
		let cursor = start;
		for (const run of runs) {
			if ("glyph" in run) {
				if (outline) {
					context.fillStyle = "rgba(0, 0, 0, 0.8)";
					context.beginPath();
					context.arc(
						cursor + gap + size / 2,
						centerY,
						size / 2 + 1.75,
						0,
						Math.PI * 2,
					);
					context.fill();
				}
				drawPadGlyph(
					context,
					run.glyph,
					cursor + gap + size / 2,
					centerY,
					size,
				);
				cursor += size + gap * 2;
				continue;
			}
			if (outline) {
				context.strokeStyle = "rgba(0, 0, 0, 0.8)";
				context.lineWidth = 3.5;
				context.strokeText(run.text, cursor, y);
			}
			context.fillStyle = color;
			context.fillText(run.text, cursor, y);
			cursor += context.measureText(run.text).width;
		}
		context.textAlign = align;
	}

	private text(
		value: string,
		x: number,
		y: number,
		{
			font,
			color = TEXT,
			align = "left",
			outline = true,
			glyphSize,
		}: TextStyle,
	): void {
		const context = this.context;
		context.font = font;
		context.textAlign = align;
		if (hasGlyph(value)) {
			this.glyphText(value, x, y, align, outline, color, glyphSize);
			return;
		}
		if (outline) {
			context.strokeStyle = "rgba(0, 0, 0, 0.8)";
			context.lineWidth = 3.5;
			context.strokeText(value, x, y);
		}
		context.fillStyle = color;
		context.fillText(value, x, y);
	}

	private panel(
		x: number,
		y: number,
		width: number,
		height: number,
		fill = DARK_PANEL,
		border?: string,
		thickness = 2,
	): void {
		const context = this.context;
		context.fillStyle = fill;
		context.fillRect(x, y, width, height);
		if (border) {
			context.strokeStyle = border;
			context.lineWidth = thickness;
			context.strokeRect(
				x + thickness / 2,
				y + thickness / 2,
				width - thickness,
				height - thickness,
			);
		}
	}

	private wrap(value: string, font: string, width: number): string[] {
		const key = `${font}|${width}|${value}`;
		const cached = this.wrapCache.get(key);
		if (cached) {
			return cached;
		}
		const context = this.context;
		context.font = font;
		const lines: string[] = [];
		let line = "";
		for (const word of value.split(/\s+/)) {
			const candidate = line ? `${line} ${word}` : word;
			if (line && this.measure(candidate).width > width) {
				lines.push(line);
				line = word;
			} else {
				line = candidate;
			}
		}
		if (line) {
			lines.push(line);
		}
		if (this.wrapCache.size > 300) {
			this.wrapCache.clear();
		}
		this.wrapCache.set(key, lines);
		return lines;
	}

	private drawArt(
		id: ObjectArtId,
		x: number,
		y: number,
		size: number,
		alpha = 1,
	): void {
		const image = this.art.get(id);
		if (!image) {
			return;
		}
		const context = this.context;
		context.globalAlpha = alpha;
		context.drawImage(image, x, y, size, size);
		context.globalAlpha = 1;
	}

	private veil(
		centerX: number,
		centerY: number,
		radiusX: number,
		radiusY: number,
		stops: Stop[],
		alpha = 1,
	): void {
		const context = this.context;
		const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
		for (const stop of stops) {
			gradient.addColorStop(stop.at, stop.color);
		}
		context.save();
		context.globalAlpha = alpha;
		context.translate(centerX, centerY);
		context.scale(radiusX, radiusY);
		context.fillStyle = gradient;
		context.fillRect(
			-centerX / radiusX,
			-centerY / radiusY,
			this.width / radiusX,
			this.height / radiusY,
		);
		context.restore();
	}

	private centerVeil(stops: Stop[], alpha = 1): void {
		this.veil(
			this.width / 2,
			this.height / 2,
			(this.width / 2) * Math.SQRT2,
			(this.height / 2) * Math.SQRT2,
			stops,
			alpha,
		);
	}

	private addVeil(shape: VeilShape, alpha = 1): void {
		this.veils.push({ ...shape, alpha: Math.min(1, Math.max(0, alpha)) });
	}

	private updateVeils(hud: HudState, now: number): void {
		this.veils.length = 0;
		if (hud.spotted > 0.01) {
			this.addVeil(SPOTTED_VEIL, hud.spotted);
		}
		if (hud.gaze > 0.05) {
			this.addVeil(GAZE_VEIL, Math.min(1, hud.gaze * 1.1));
		}
		const damage = Math.max(0, 1 - (now - hud.damageAt) / 700);
		if (damage > 0) {
			this.addVeil(DAMAGE_VEIL, damage * 0.85);
		}
		if (hud.health < 30 && !hud.dead) {
			this.addVeil(WOUNDED_VEIL, 0.78 + Math.sin(now / 190) * 0.22);
		}
		if (hud.slimed) {
			this.addVeil(SLIMED_VEIL);
		}
		if (
			hud.manorEvent?.kind === "bloodMoon" &&
			hud.manorEvent.phase === "start"
		) {
			this.addVeil(BLOOD_MOON_VEIL, 0.85 + Math.sin(now / 700) * 0.15);
		}
		if (hud.hidden) {
			this.addVeil(HIDDEN_VEIL);
		}
		if (hud.carried) {
			this.addVeil(CARRIED_VEIL);
		}
	}

	private paintLookAway(hud: HudState): void {
		if (hud.gaze > 0.35) {
			const at = this.at(this.width / 2, this.height * 0.22);
			this.text(currentMessages().game.hud.lookAway, at.x, at.y, {
				font: `400 32px ${TITLE}`,
				color: "#b8fff0",
				align: "center",
			});
		}
	}

	private paintMinimap(hud: HudState): void {
		const context = this.context;
		const size = this.minimapSize();
		const { x, y } = this.place(20, 20, size, size, "left", "top");
		this.minimapBottom = y + size;
		context.fillStyle = "rgba(0, 0, 0, 0.7)";
		context.fillRect(x - 5, y - 5, size + 10, size + 10);
		context.fillStyle = YELLOW;
		context.fillRect(x - 2, y - 2, size + 4, size + 4);
		this.minimapRatio();
		const pixels = this.minimap.width;
		const left = Math.round(x * this.drawScale);
		const top = Math.round(y * this.drawScale);
		context.save();
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(left, top, pixels, pixels);
		context.restore();
		const width = this.canvas.width;
		const height = this.canvas.height;
		this.minimapRect.set(
			left / width,
			1 - (top + pixels) / height,
			pixels / width,
			pixels / height,
		);
		this.minimapPixels.set(pixels, pixels);
		this.minimapShown = true;
		this.refreshMinimap(hud.haze);
		if (this.minimapRoom) {
			this.text(this.minimapRoom, x + 8, y + 15, {
				font: `700 16px ${UI}`,
			});
		}
		if (this.minimapLabel) {
			this.text(this.minimapLabel, x + 8, y + size - 13, {
				font: `700 16px ${UI}`,
			});
		}
	}

	private paintBigMap(hud: HudState): void {
		const messages = currentMessages().game.map;
		const context = this.context;
		const state = mapStore.get();
		const frame = this.mapFrame();
		const area = this.mapArea();
		context.fillStyle = "rgba(4, 5, 4, 0.9)";
		context.fillRect(-60, -60, this.width + 120, this.height + 120);
		context.fillStyle = BACKGROUND;
		context.fillRect(
			frame.x - 5,
			frame.y - 5,
			frame.width + 10,
			frame.height + 10,
		);
		context.fillStyle = YELLOW;
		context.fillRect(
			frame.x - 2,
			frame.y - 2,
			frame.width + 4,
			frame.height + 4,
		);
		context.fillStyle = MAP_BACKGROUND;
		context.fillRect(frame.x, frame.y, frame.width, frame.height);
		this.text(messages.title, frame.x + 18, frame.y + MAP_HEADER / 2, {
			font: `400 32px ${TITLE}`,
			color: YELLOW,
			outline: false,
		});
		this.mapButtons = [];
		const top = frame.y + (MAP_HEADER - 36) / 2;
		let right = frame.x + frame.width - 14;
		right = this.mapButton("close", messages.close, right, top, {
			primary: true,
			run: () => this.onMapClose?.(),
		});
		right = this.mapButton("recenter", messages.recenter, right - 8, top, {
			run: () => resetMap(),
		});
		right = this.mapButton("zoomIn", "+", right - 8, top, {
			disabled: state.zoom >= MAP_MAX_ZOOM,
			run: () => zoomMap(1),
		});
		const zoomText = `×${state.zoom.toFixed(1)}`;
		this.text(zoomText, right - 30, top + 19, {
			font: `700 20px ${FIGURES}`,
			color: TEXT,
			align: "center",
			outline: false,
		});
		right = this.mapButton("zoomOut", "−", right - 60, top, {
			disabled: state.zoom <= 1,
			run: () => zoomMap(-1),
		});
		if (this.mapLevels.length > 1) {
			right -= 10;
			for (const level of [...this.mapLevels].reverse()) {
				right = this.mapButton(
					`level-${level}`,
					messages.levelName(level),
					right - 6,
					top,
					{ primary: state.level === level, run: () => resetMap(level) },
				);
			}
		}
		const filter = hazeFilter(hud.haze);
		if (filter) {
			context.filter = filter;
		}
		const scale = this.drawScale;
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.drawImage(
			this.bigMap,
			Math.round(area.x * scale),
			Math.round(area.y * scale),
		);
		context.setTransform(scale, 0, 0, scale, 0, 0);
		context.filter = "none";
		context.fillStyle = LINE_STRONG;
		context.fillRect(area.x, area.y - 2, area.width, 2);
		context.fillRect(area.x, area.y + area.height, area.width, 2);
		this.paintMapLegend(frame, area.y + area.height);
	}

	private mapButton(
		id: string,
		label: string,
		right: number,
		y: number,
		{
			primary = false,
			disabled = false,
			run,
		}: { primary?: boolean; disabled?: boolean; run: () => void },
	): number {
		const context = this.context;
		const font = `700 18px ${UI}`;
		context.font = font;
		const width = Math.max(38, Math.ceil(this.measure(label).width) + 24);
		const height = 36;
		const x = right - width;
		const hover = !disabled && this.mapHover === id;
		this.panel(
			x,
			y,
			width,
			height,
			primary ? YELLOW : hover ? MAP_HOVER : PANEL_BACKGROUND,
			hover ? TEXT : primary ? YELLOW : LINE_STRONG,
			2,
		);
		this.text(label, x + width / 2, y + height / 2 + 1, {
			font,
			color: primary ? BACKGROUND : disabled ? TEXT_DIM : TEXT,
			align: "center",
			outline: false,
		});
		if (!disabled) {
			this.mapButtons.push({ id, x, y, width, height, run });
		}
		return x;
	}

	private paintMapLegend(
		frame: { x: number; y: number; width: number },
		top: number,
	): void {
		const legend = currentMessages().game.map.legend;
		const context = this.context;
		const font = `500 16px ${UI}`;
		const y = top + 20;
		const items: [string, (x: number) => number][] = [
			[
				legend.you,
				(x) => {
					context.fillStyle = YELLOW;
					context.beginPath();
					context.moveTo(x + 7, y - 7);
					context.lineTo(x + 14, y + 7);
					context.lineTo(x, y + 7);
					context.closePath();
					context.fill();
					return 14;
				},
			],
			[
				legend.players,
				(x) => {
					context.fillStyle = MAP_ALLY;
					context.beginPath();
					context.arc(x + 6, y, 6, 0, Math.PI * 2);
					context.fill();
					return 12;
				},
			],
			[legend.elsewhere, (x) => this.mapLegendBadge(x, y, MAP_ALLY)],
			[
				legend.current,
				(x) => {
					context.fillStyle = "#33301f";
					context.fillRect(x, y - 7, 22, 14);
					context.strokeStyle = YELLOW;
					context.lineWidth = 2;
					context.setLineDash([4, 3]);
					context.strokeRect(x, y - 7, 22, 14);
					context.setLineDash([]);
					return 22;
				},
			],
			[
				legend.door,
				(x) => {
					context.fillStyle = YELLOW;
					context.fillRect(x, y - 2, 18, 4);
					return 18;
				},
			],
			[
				legend.window,
				(x) => {
					context.fillStyle = MAP_WINDOW;
					context.fillRect(x, y - 1.5, 18, 3);
					return 18;
				},
			],
			[legend.stairs, (x) => this.mapLegendBadge(x, y, MAP_STAIRS)],
		];
		let x = frame.x + 18;
		for (const [label, icon] of items) {
			x += icon(x) + 7;
			this.text(label, x, y + 1, { font, color: TEXT_MUTED, outline: false });
			context.font = font;
			x += this.measure(label).width + 20;
		}
		const hintFont = `500 14px ${BODY}`;
		const lines = this.wrap(
			currentMessages().game.map.footer,
			hintFont,
			frame.width - 36,
		);
		lines.slice(0, 2).forEach((line, index) => {
			this.text(line, frame.x + 18, top + 42 + index * 16, {
				font: hintFont,
				color: TEXT_DIM,
				outline: false,
			});
		});
	}

	private mapLegendBadge(x: number, y: number, color: string): number {
		const context = this.context;
		context.fillStyle = "rgba(11, 13, 11, 0.82)";
		context.strokeStyle = color;
		context.lineWidth = 2;
		context.beginPath();
		context.arc(x + 9, y, 8, 0, Math.PI * 2);
		context.fill();
		context.stroke();
		this.text("↑", x + 9, y + 1, {
			font: `400 14px ${TITLE}`,
			color,
			align: "center",
			outline: false,
		});
		return 18;
	}

	private paintTopBar(hud: HudState, now: number): void {
		const messages = currentMessages().game;
		const urgent = hud.remainingMs < 60_000;
		const clock = formatClock(hud.remainingMs);
		const font = `700 40px ${FIGURES}`;
		this.context.font = font;
		const width = this.measure(clock).width + 34;
		const placed = this.place(this.width / 2, 20, width, 50, "center", "top");
		const x = placed.x + width / 2;
		const y = placed.y;
		this.panel(placed.x, y, width, 50, "rgba(10, 12, 10, 0.75)");
		this.context.globalAlpha =
			urgent && Math.floor(now / 500) % 2 === 1 ? 0.55 : 1;
		this.text(clock, x, y + 26, {
			font,
			color: urgent ? DANGER : YELLOW,
			align: "center",
			outline: false,
		});
		this.context.globalAlpha = 1;
		let below = y + 66;
		if (hud.anomaliesInMs > 0) {
			this.text(
				messages.hud.awakening(Math.ceil(hud.anomaliesInMs / 1000)),
				x,
				below,
				{ font: `700 18px ${UI}`, color: TEXT_MUTED, align: "center" },
			);
			below += 26;
		}
		const party = currentMessages().party;
		if (hud.ritual) {
			const done = hud.ritual.captures >= hud.ritual.quota;
			this.badge(
				party.possessed.ritual(hud.ritual.captures, hud.ritual.quota),
				x,
				below,
				done ? OK : "#c39bff",
			);
			below += 34;
		}
		if (hud.manorEvent) {
			const event = hud.manorEvent;
			const name = party.events.names[event.kind];
			const warning = event.phase === "warning";
			const seconds = Math.max(
				0,
				Math.ceil(
					((warning ? event.startsAt : event.endsAt) - hud.serverNow) / 1000,
				),
			);
			this.context.globalAlpha =
				warning && Math.floor(now / 400) % 2 === 1 ? 0.6 : 1;
			this.badge(
				warning
					? party.events.warning(name, seconds)
					: party.events.active(name, seconds),
				x,
				below,
				event.kind === "bloodMoon" ? DANGER : warning ? YELLOW : ALTAR,
			);
			this.context.globalAlpha = 1;
			below += 34;
		}
		if (hud.bounty) {
			this.badge(
				hud.bounty.self
					? party.bounty.hudSelf(hud.bounty.value)
					: party.bounty.hud(hud.bounty.name, hud.bounty.value),
				x,
				below,
				"#ffc857",
			);
		}
	}

	private badge(value: string, x: number, y: number, color: string): void {
		const font = `700 17px ${UI}`;
		this.context.font = font;
		const width = this.measure(value).width + 26;
		this.panel(x - width / 2, y - 13, width, 28, DARK_PANEL, color);
		this.text(value, x, y + 1, {
			font,
			color,
			align: "center",
			outline: false,
		});
	}

	private paintMaterials(hud: HudState): void {
		const names = currentMessages().grimoire.materials;
		const width = 224;
		const rowHeight = 26;
		const height = MATERIAL_IDS.length * rowHeight;
		const placed = this.place(
			this.width - 20,
			20,
			width,
			height,
			"right",
			"top",
		);
		const right = placed.x + width;
		const y = placed.y;
		this.materialsBottom = y + height;
		MATERIAL_IDS.forEach((id, index) => {
			const owned = hud.inventory?.materials[id] ?? 0;
			const rowY = y + index * rowHeight;
			const middle = rowY + rowHeight / 2 + 1;
			const name = names[id];
			this.drawArt(
				id,
				right - rowHeight + 2,
				rowY + 1,
				rowHeight - 2,
				owned > 0 ? 1 : 0.35,
			);
			this.text(`×${owned}`, right - rowHeight - 4, middle, {
				font: `700 20px ${FIGURES}`,
				color: owned > 0 ? YELLOW : TEXT_DIM,
				align: "right",
			});
			this.text(
				name.charAt(0).toUpperCase() + name.slice(1),
				right - rowHeight - 34,
				middle,
				{
					font: `500 18px ${UI}`,
					color: owned > 0 ? TEXT : TEXT_MUTED,
					align: "right",
				},
			);
		});
	}

	private paintStatus(hud: HudState, now: number, dt: number): void {
		const figureWidth = 72;
		const barWidth = 270;
		const healthHeight = 22;
		const energyHeight = 13;
		const gap = 5;
		const height = 46;
		const { x, y } = this.place(
			20,
			this.height - 20,
			figureWidth + barWidth,
			height,
			"left",
			"bottom",
		);
		if (hud.health < this.healthSeen) {
			this.healthTrailHold = now + HEALTH_TRAIL_HOLD_MS;
		}
		this.healthSeen = hud.health;
		if (hud.health >= this.healthTrail) {
			this.healthTrail = hud.health;
		} else if (now >= this.healthTrailHold) {
			this.healthTrail = Math.max(
				hud.health,
				this.healthTrail - HEALTH_TRAIL_SPEED * dt,
			);
		}
		const low = hud.health < LOW_HEALTH && !hud.dead;
		const beat = low ? 0.5 + Math.sin(now / 150) * 0.5 : 0;
		const barX = x + figureWidth;
		const barsTop = y + (height - healthHeight - gap - energyHeight) / 2;
		this.text(String(Math.round(hud.health)), barX - 12, y + height / 2 + 1, {
			font: `700 56px ${FIGURES}`,
			color: low ? `rgb(255, ${70 + Math.round(beat * 60)}, 60)` : TEXT,
			align: "right",
		});
		this.paintBar(
			barX,
			barsTop,
			barWidth,
			healthHeight,
			hud.health,
			low ? "#ff4a3a" : "#f0534a",
			this.healthTrail,
		);
		this.paintBar(
			barX,
			barsTop + healthHeight + gap,
			barWidth,
			energyHeight,
			hud.energy,
			hud.sprintLocked ? "#8a8d7a" : YELLOW,
		);
		const denied = now - hud.energyDeniedAt;
		if (hud.energyDeniedAt > 0 && denied < ENERGY_DENIED_MS) {
			this.context.fillStyle = `rgba(229, 83, 61, ${0.85 * (1 - denied / ENERGY_DENIED_MS)})`;
			this.context.fillRect(
				barX - 2,
				barsTop + healthHeight + gap - 2,
				barWidth + 4,
				energyHeight + 4,
			);
		}
	}

	private brewShown(hud: HudState): boolean {
		return Boolean(hud.brew) && !hud.dead && !hud.showMap && !hud.paused;
	}

	private brewSpace(hud: HudState): number {
		return this.brewShown(hud) ? BREW_PANEL_HEIGHT + 12 : 0;
	}

	private paintBrew(hud: HudState, now: number): void {
		if (!this.brewShown(hud) || !hud.brew) {
			return;
		}
		const labels = currentMessages().game.brew;
		const color = BREW_COLORS[hud.brew];
		const name = labels.names[hud.brew];
		const seconds = `${Math.max(0, Math.ceil(hud.brewLeftMs / 1000))} s`;
		const context = this.context;
		const nameFont = `600 18px ${UI}`;
		const timeFont = `700 24px ${FIGURES}`;
		context.font = nameFont;
		const nameWidth = this.measure(name).width;
		context.font = timeFont;
		const timeWidth = this.measure(seconds).width;
		const width = 14 + 14 + 10 + nameWidth + 12 + timeWidth + 14;
		const height = BREW_PANEL_HEIGHT;
		const { x, y } = this.place(
			20,
			this.height - 20 - 46 - 12,
			width,
			height,
			"left",
			"bottom",
		);
		const ending = hud.brewLeftMs < 3000;
		const blink = ending ? 0.55 + 0.45 * Math.sin(now / 90) : 1;
		this.panel(x, y, width, height, DARK_PANEL, color);
		context.globalAlpha = blink;
		context.fillStyle = color;
		context.beginPath();
		context.arc(x + 14 + 7, y + height / 2 - 3, 7, 0, Math.PI * 2);
		context.fill();
		context.globalAlpha = 1;
		this.text(name, x + 14 + 14 + 10, y + height / 2 - 2, {
			font: nameFont,
			color: TEXT,
		});
		this.text(seconds, x + width - 14, y + height / 2 - 2, {
			font: timeFont,
			color,
			align: "right",
		});
		const fraction = Math.min(1, Math.max(0, hud.brewLeftMs / hud.brewTotalMs));
		context.fillStyle = "rgba(255, 255, 255, 0.12)";
		context.fillRect(x + 8, y + height - 9, width - 16, 3);
		context.fillStyle = color;
		context.fillRect(x + 8, y + height - 9, (width - 16) * fraction, 3);
	}

	private paintWalkieIcon(
		x: number,
		y: number,
		size: number,
		color: string,
		active: boolean,
		now: number,
	): void {
		const context = this.context;
		context.save();
		context.translate(x, y);
		context.scale(size / 16, size / 16);
		context.fillStyle = color;
		context.fill(WALKIE_ICON, "evenodd");
		context.restore();
		if (!active) {
			return;
		}
		context.save();
		context.strokeStyle = color;
		context.lineWidth = Math.max(1.5, size / 12);
		context.lineCap = "round";
		for (let wave = 0; wave < 3; wave += 1) {
			context.globalAlpha =
				0.2 + 0.8 * Math.max(0, Math.sin(now / 130 - wave * 0.9));
			context.beginPath();
			context.arc(
				x + size * 0.66,
				y + size * 0.14,
				(wave + 1) * size * 0.22,
				-Math.PI * 0.4,
				Math.PI * 0.15,
			);
			context.stroke();
		}
		context.restore();
	}

	private paintWalkie(hud: HudState, now: number): void {
		if (!hud.walkieHeld || hud.showMap || hud.paused) {
			return;
		}
		const labels = currentMessages().game.walkie;
		const speakers = hud.walkieSpeakers;
		const active = hud.walkieTalking || speakers.length > 0;
		const lines = hud.walkieTalking
			? [labels.talking]
			: speakers.length > 0
				? speakers.map((name) => labels.hearing(name))
				: [labels.idle(keyLabel(activeBindings().radio))];
		const color = hud.walkieTalking ? DANGER : active ? OK : TEXT_MUTED;
		const font = `500 18px ${UI}`;
		const context = this.context;
		context.font = font;
		const textWidth = Math.max(
			...lines.map((line) => this.measure(line).width),
		);
		const iconSize = 26;
		const waves = 22;
		const width = 14 + iconSize + waves + textWidth + 16;
		const height = Math.max(44, 12 + lines.length * 24);
		const { x, y } = this.place(
			20,
			this.height - 20 - 46 - 12 - this.brewSpace(hud),
			width,
			height,
			"left",
			"bottom",
		);
		this.panel(x, y, width, height, DARK_PANEL, color);
		this.paintWalkieIcon(
			x + 12,
			y + (height - iconSize) / 2,
			iconSize,
			color,
			active,
			now,
		);
		const textX = x + 14 + iconSize + waves;
		const firstY = y + height / 2 - ((lines.length - 1) * 24) / 2 + 1;
		lines.forEach((line, index) => {
			this.text(line, textX, firstY + index * 24, {
				font,
				color: active ? TEXT : TEXT_MUTED,
			});
		});
	}

	private walkieHeight(hud: HudState): number {
		const lines = hud.walkieTalking
			? 1
			: Math.max(1, hud.walkieSpeakers.length);
		return Math.max(44, 12 + lines * 24);
	}

	private paintCamera(hud: HudState): void {
		const flash = (performance.now() - hud.photoFlashAt) / 260;
		if (flash >= 0 && flash < 1 && !hud.paused) {
			this.context.fillStyle = `rgba(255, 255, 255, ${(0.55 * (1 - flash)).toFixed(3)})`;
			this.context.fillRect(0, 0, this.width, this.height);
		}
		if (!hud.cameraHeld || hud.showMap || hud.paused) {
			return;
		}
		const labels = currentMessages().game.camera;
		const keys = activeBindings();
		const line = hud.cameraAiming
			? labels.aiming(
					keyLabel(keys.photo),
					hud.photoCount,
					MAX_PHOTOS_PER_MATCH,
				)
			: hud.cameraRaised
				? labels.raised(
						keyLabel(keys.photo),
						hud.photoCount,
						MAX_PHOTOS_PER_MATCH,
						keyLabel(keys.aim),
					)
				: labels.lowered(keyLabel(keys.aim), keyLabel(keys.camera));
		const color = hud.cameraRaised ? YELLOW : TEXT_MUTED;
		const font = `500 18px ${UI}`;
		const context = this.context;
		context.font = font;
		const iconSize = 24;
		const width = 14 + iconSize + 12 + this.measure(line).width + 16;
		const height = 44;
		const below = hud.walkieHeld ? this.walkieHeight(hud) + 8 : 0;
		const { x, y } = this.place(
			20,
			this.height - 20 - 46 - 12 - this.brewSpace(hud) - below,
			width,
			height,
			"left",
			"bottom",
		);
		this.panel(x, y, width, height, DARK_PANEL, color);
		const iconX = x + 12;
		const iconY = y + (height - iconSize * 0.7) / 2;
		context.fillStyle = color;
		context.fillRect(iconX, iconY + 3, iconSize, iconSize * 0.7 - 3);
		context.fillRect(iconX + iconSize * 0.3, iconY, iconSize * 0.3, 4);
		context.fillStyle = DARK_PANEL;
		context.beginPath();
		context.arc(
			iconX + iconSize / 2,
			iconY + 3 + (iconSize * 0.7 - 3) / 2,
			iconSize * 0.2,
			0,
			Math.PI * 2,
		);
		context.fill();
		this.text(line, x + 14 + iconSize + 12, y + height / 2 + 1, {
			font,
			color: hud.cameraRaised ? TEXT : TEXT_MUTED,
		});
	}

	private fitText(value: string, font: string, width: number): string {
		const context = this.context;
		context.font = font;
		if (this.measure(value).width <= width) {
			return value;
		}
		let end = value.length;
		while (end > 1 && this.measure(`${value.slice(0, end)}…`).width > width) {
			end -= 1;
		}
		return `${value.slice(0, end)}…`;
	}

	private paintLeaderboard(hud: HudState, now: number): void {
		if (!hud.showLeaderboard || hud.paused || hud.showMap) {
			return;
		}
		const messages = currentMessages();
		const labels = messages.game.leaderboard;
		const rows = hud.leaderboard;
		const teamMode = rows.some((row) => row.team !== null);
		const standings = teamMode
			? teamStandings(
					rows.map((row) => ({
						playerId: row.id,
						team: row.team,
						score: row.score,
						captures: 0,
						deaths: 0,
					})),
				)
			: [];
		const lineCount = rows.length + standings.length;
		const padding = 22;
		const titleHeight = 54;
		const headHeight = 26;
		const gap = 5;
		const available =
			this.height -
			56 -
			padding * 2 -
			titleHeight -
			headHeight -
			standings.length * 6;
		const rowHeight = Math.max(
			24,
			Math.min(46, available / Math.max(1, lineCount) - gap),
		);
		const width = Math.min(1060, this.width - 56);
		const height =
			padding * 2 +
			titleHeight +
			headHeight +
			lineCount * (rowHeight + gap) +
			standings.length * 6;
		const context = this.context;
		context.fillStyle = "rgba(5, 6, 5, 0.55)";
		context.fillRect(0, 0, this.width, this.height);
		context.section();
		const x = (this.width - width) / 2;
		const top = (this.height - height) / 2;
		this.panel(x, top, width, height, "rgba(17, 21, 18, 0.95)", YELLOW);
		const inner = x + padding;
		const right = x + width - padding;
		const energyWidth = Math.min(150, width * 0.14);
		const energyX = right - energyWidth - 10;
		const healthX = energyX - energyWidth - 16;
		const pointsRight = healthX - 18;
		const nameX = inner + 44;
		const nameLimit = pointsRight - 90 - nameX;
		this.text(labels.title, inner, top + padding + 20, {
			font: `400 40px ${TITLE}`,
			color: YELLOW,
		});
		const headY = top + padding + titleHeight + headHeight / 2 - 4;
		const headFont = `500 16px ${UI}`;
		const headStyle = { font: headFont, color: TEXT_MUTED, outline: false };
		this.text("#", inner + 12, headY, headStyle);
		this.text(labels.mushroom, nameX, headY, headStyle);
		this.text(labels.points, pointsRight, headY, {
			...headStyle,
			align: "right",
		});
		this.text(labels.health, healthX, headY, headStyle);
		this.text(labels.energy, energyX, headY, headStyle);
		let y = top + padding + titleHeight + headHeight;
		const figures = `700 ${Math.round(rowHeight * 0.62)}px ${FIGURES}`;
		const names = `700 ${Math.round(rowHeight * 0.6)}px ${UI}`;
		const swatch = Math.round(rowHeight * 0.42);
		const middle = () => y + rowHeight / 2 + 1;
		const paintPlayer = (row: LeaderboardRow, rank: string) => {
			context.save();
			context.globalAlpha = row.alive ? 1 : 0.6;
			this.panel(
				inner - 8,
				y,
				right - inner + 16,
				rowHeight,
				PANEL_BACKGROUND,
				row.self ? YELLOW : LINE_STRONG,
			);
			this.text(rank, inner + 28, middle(), {
				font: figures,
				color: YELLOW,
				align: "right",
			});
			context.fillStyle = hexColor(row.color);
			context.fillRect(nameX, y + (rowHeight - swatch) / 2, swatch, swatch);
			let cursor = nameX + swatch + 10;
			const name = this.fitText(row.name, names, nameLimit - swatch - 10);
			this.text(name, cursor, middle(), { font: names });
			context.font = names;
			cursor += this.measure(name).width + 12;
			if (row.tagline) {
				const taglineFont = `italic 500 ${Math.round(rowHeight * 0.4)}px ${BODY}`;
				const room = nameX + nameLimit - cursor - 60;
				if (room > 30) {
					const tagline = this.fitText(
						messages.appearance.taglines[row.tagline],
						taglineFont,
						room,
					);
					this.text(tagline, cursor, middle(), {
						font: taglineFont,
						color: YELLOW_DEEP,
					});
					context.font = taglineFont;
					cursor += this.measure(tagline).width + 12;
				}
			}
			if (row.walkie) {
				const size = Math.round(rowHeight * 0.58);
				this.paintWalkieIcon(
					cursor,
					y + (rowHeight - size) / 2,
					size,
					row.radio ? OK : TEXT_MUTED,
					row.radio,
					now,
				);
				cursor += size + (row.radio ? size * 0.9 : 8);
			}
			if (row.bounty) {
				const bountyFont = `700 14px ${UI}`;
				const bountyLabel = messages.party.bounty.tag;
				context.font = bountyFont;
				const bountyWidth = this.measure(bountyLabel).width + 12;
				this.panel(
					cursor,
					y + (rowHeight - 20) / 2,
					bountyWidth,
					20,
					"#ffc857",
				);
				this.text(bountyLabel, cursor + 6, middle(), {
					font: bountyFont,
					color: BACKGROUND,
					outline: false,
				});
				cursor += bountyWidth + 8;
			}
			const tag = !row.alive ? labels.down : row.self ? labels.you : null;
			if (tag) {
				const tagFont = `700 14px ${UI}`;
				context.font = tagFont;
				const tagWidth = this.measure(tag).width + 12;
				this.panel(
					cursor,
					y + (rowHeight - 20) / 2,
					tagWidth,
					20,
					row.alive ? YELLOW : DANGER,
				);
				this.text(tag, cursor + 6, middle(), {
					font: tagFont,
					color: row.alive ? BACKGROUND : TEXT,
					outline: false,
				});
			}
			this.text(messages.common.number(row.score), pointsRight, middle(), {
				font: figures,
				align: "right",
			});
			const barHeight = Math.min(18, rowHeight * 0.45);
			const barY = y + (rowHeight - barHeight) / 2;
			const bars = [
				[healthX, row.health, "#f0534a"],
				[energyX, row.energy, YELLOW],
			] as const;
			for (const [barX, value, color] of bars) {
				this.paintBar(barX, barY, energyWidth, barHeight, value, color);
				this.text(String(Math.round(value)), barX + energyWidth - 6, middle(), {
					font: `700 14px ${FIGURES}`,
					align: "right",
				});
			}
			context.restore();
			y += rowHeight + gap;
		};
		if (teamMode) {
			standings.forEach((standing, index) => {
				y += 6;
				this.text(String(index + 1), inner + 28, middle(), {
					font: figures,
					color: YELLOW,
					align: "right",
				});
				context.fillStyle = hexColor(TEAM_COLORS[standing.team]);
				context.fillRect(nameX, y + (rowHeight - swatch) / 2, swatch, swatch);
				this.text(
					messages.common.teams[standing.team],
					nameX + swatch + 10,
					middle(),
					{ font: names },
				);
				this.text(
					messages.common.number(standing.score),
					pointsRight,
					middle(),
					{ font: figures, align: "right" },
				);
				y += rowHeight + gap;
				for (const row of rows) {
					if (row.team === standing.team) {
						paintPlayer(row, "");
					}
				}
			});
		} else {
			rows.forEach((row, index) => {
				paintPlayer(row, String(index + 1));
			});
		}
	}

	private paintBar(
		x: number,
		y: number,
		width: number,
		height: number,
		value: number,
		color: string,
		trail = 0,
	): void {
		const context = this.context;
		const extent = (amount: number) =>
			(width * Math.max(0, Math.min(100, amount))) / 100;
		const fill = extent(value);
		context.fillStyle = "rgba(0, 0, 0, 0.55)";
		context.fillRect(x, y, width, height);
		context.fillStyle = "rgba(255, 255, 255, 0.1)";
		context.fillRect(x, y, width, height);
		if (trail > value) {
			context.fillStyle = "rgba(255, 255, 255, 0.72)";
			context.fillRect(x + fill, y, extent(trail) - fill, height);
		}
		if (fill > 0) {
			context.save();
			context.shadowColor = color;
			context.shadowBlur = BAR_GLOW * this.drawScale;
			context.fillStyle = color;
			context.fillRect(x, y, fill, height);
			context.restore();
			context.fillStyle = "rgba(255, 255, 255, 0.85)";
			context.fillRect(x + fill - 2, y, 2, height);
		}
	}

	private paintAbilities(hud: HudState): void {
		const messages = currentMessages().game.hud;
		const party = currentMessages().party;
		const keys = activeBindings();
		const ghostEntries = [
			{
				label: party.ghost.knock,
				key: keys.shout,
				readyAt: hud.ghostKnockReadyAt,
				duration: GHOST_KNOCK_COOLDOWN_MS,
			},
			{
				label: party.ghost.slam,
				key: keys.interact,
				readyAt: hud.ghostDoorReadyAt,
				duration: GHOST_DOOR_COOLDOWN_MS,
			},
			{
				label: party.ping.label,
				key: keys.ping,
				readyAt: 0,
				duration: 1,
			},
		];
		const powerEntries =
			hud.role === "possessed"
				? [
						{
							label: party.possessed.power,
							key: keys.power,
							readyAt: hud.powerReadyAt,
							duration: POSSESSED_POWER_COOLDOWN_MS,
						},
					]
				: [];
		const entries = hud.ghost
			? ghostEntries
			: [
					...powerEntries,
					{
						label: messages.push,
						key: keys.push,
						readyAt: hud.pushReadyAt,
						duration: hud.pushCooldownMs || PUSH_COOLDOWN_MS,
					},
					{
						label: messages.shout,
						key: keys.shout,
						readyAt: hud.shoutReadyAt,
						duration: SHOUT_COOLDOWN_MS,
					},
					{
						label: messages.grimoire,
						key: keys.grimoire,
						readyAt: 0,
						duration: 1,
					},
				];
		if (hud.voting) {
			return;
		}
		const context = this.context;
		const font = `700 18px ${UI}`;
		context.font = font;
		const total = entries.reduce(
			(sum, entry) =>
				sum +
				Math.max(24, this.measure(keyLabel(entry.key)).width + 8) +
				this.measure(entry.label).width +
				36,
			-8,
		);
		const placed = this.place(
			this.width - 20,
			this.height - 20,
			total,
			38,
			"right",
			"bottom",
		);
		let right = placed.x + total;
		const y = placed.y;
		for (const entry of [...entries].reverse()) {
			context.font = font;
			const keyText = keyLabel(entry.key);
			const keyFont = `700 16px ${FIGURES}`;
			context.font = keyFont;
			const keyWidth = this.keyCapWidth(keyText, 24, 24);
			context.font = font;
			const width = this.measure(entry.label).width + keyWidth + 28;
			const x = right - width;
			const remaining = Math.max(0, entry.readyAt - hud.serverNow);
			this.panel(x, y, width, 38, "rgba(10, 12, 10, 0.75)");
			this.keyCap(keyText, x + 8, y + 7, keyWidth, 24, keyFont);
			this.text(entry.label, x + keyWidth + 18, y + 20, {
				font,
				color: remaining > 0 ? TEXT_DIM : TEXT,
				outline: false,
			});
			if (entry.duration > 1) {
				context.fillStyle = YELLOW;
				context.fillRect(
					x,
					y + 35,
					width * (1 - remaining / entry.duration),
					3,
				);
			}
			right = x - 8;
		}
	}

	private paintHotbar(hud: HudState): void {
		const messages = currentMessages();
		const slot = 58;
		const gap = 4;
		const total = OCCULT_IDS.length * (slot + gap) + gap;
		const placed = this.place(
			this.width / 2,
			this.height - 20,
			total,
			slot + gap * 2,
			"center",
			"bottom",
		);
		const anchor = { x: placed.x + total / 2 };
		const x = placed.x;
		const y = placed.y;
		const selected = OCCULT_IDS[hud.heldSlot];
		const owned = (hud.inventory?.objects[selected] ?? 0) > 0;
		this.text(
			owned
				? messages.grimoire.objects[selected]
				: messages.game.inventory.handEmpty,
			anchor.x,
			y - 14,
			{
				font: `700 20px ${UI}`,
				color: owned ? YELLOW : TEXT_MUTED,
				align: "center",
			},
		);
		this.panel(x, y, total, slot + gap * 2, "rgba(10, 12, 10, 0.72)");
		OCCULT_IDS.forEach((id, index) => {
			const count = hud.inventory?.objects[id] ?? 0;
			const slotX = x + gap + index * (slot + gap);
			const slotY = y + gap;
			const held = index === hud.heldSlot;
			const used = hud.occultInPlay.includes(id);
			const craftable = used && this.craftable(hud, id);
			this.panel(
				slotX,
				slotY,
				slot,
				slot,
				held
					? "rgba(221, 230, 80, 0.14)"
					: craftable
						? "rgba(46, 230, 214, 0.12)"
						: "rgba(0, 0, 0, 0)",
				held ? YELLOW : craftable ? ALTAR : "rgba(239, 227, 184, 0.3)",
				held || craftable ? 3 : 1,
			);
			this.drawArt(
				id,
				slotX,
				slotY,
				slot,
				!used ? 0.1 : count > 0 ? 1 : craftable ? 0.5 : 0.2,
			);
			this.text(String(index + 1), slotX + 5, slotY + 9, {
				font: `700 16px ${UI}`,
				color: TEXT_MUTED,
			});
			if (count > 0) {
				this.text(String(count), slotX + slot - 4, slotY + slot - 10, {
					font: `700 18px ${UI}`,
					align: "right",
				});
			}
			if (craftable) {
				this.paintCraftBadge(slotX + slot - 11, slotY + 11);
			}
		});
	}

	private craftable(hud: HudState, object: OccultId): boolean {
		const materials = hud.inventory?.materials;
		return (
			materials !== undefined &&
			(Object.entries(OCCULT_RECIPES[object]) as [MaterialId, number][]).every(
				([material, count]) => materials[material] >= count,
			)
		);
	}

	private paintCraftBadge(x: number, y: number): void {
		const context = this.context;
		context.beginPath();
		context.arc(x, y, 9, 0, Math.PI * 2);
		context.fillStyle = ALTAR;
		context.fill();
		context.lineWidth = 2;
		context.strokeStyle = BACKGROUND;
		context.stroke();
		context.fillStyle = BACKGROUND;
		context.fillRect(x - 5, y - 1.5, 10, 3);
		context.fillRect(x - 1.5, y - 5, 3, 10);
	}

	private paintPrompt(hud: HudState): void {
		if (!hud.prompt || hud.altarOpen) {
			return;
		}
		const context = this.context;
		const x = this.width / 2;
		const y = this.height / 2;
		const font = `700 20px ${UI}`;
		context.font = font;
		const keyText = keyLabel(activeBindings().interact);
		const keyWidth = this.keyCapWidth(keyText, 24, 24);
		const width = this.measure(hud.prompt).width + keyWidth + 30;
		const left = x - width / 2;
		const top = y + 34;
		this.panel(left, top, width, 34, "rgba(10, 12, 10, 0.72)");
		this.keyCap(keyText, left + 8, top + 5, keyWidth, 24, font);
		this.text(hud.prompt, left + keyWidth + 20, top + 18, {
			font,
			outline: false,
		});
	}

	private paintCast(hud: HudState, now: number): void {
		const messages = currentMessages().game.cast;
		const context = this.context;
		if (hud.howlerNearby) {
			const at = this.at(this.width / 2, 110);
			const font = `700 18px ${UI}`;
			context.font = font;
			const width = this.measure(messages.howler).width + 28;
			context.globalAlpha = Math.floor(now / 250) % 2 === 1 ? 0.55 : 1;
			this.panel(at.x - width / 2, at.y, width, 32, "rgba(120, 20, 20, 0.75)");
			this.text(messages.howler, at.x, at.y + 16, {
				font,
				align: "center",
				outline: false,
			});
			context.globalAlpha = 1;
		}
		if (hud.castPhase === "sent") {
			const at = this.at(this.width / 2, this.height * 0.84);
			const font = `500 16px ${UI}`;
			context.font = font;
			const width = this.measure(messages.sent).width + 36;
			this.panel(
				at.x - width / 2,
				at.y - 20,
				width,
				38,
				"rgba(10, 12, 10, 0.86)",
				YELLOW,
			);
			this.text(messages.sent, at.x, at.y, {
				font,
				color: YELLOW,
				align: "center",
				outline: false,
			});
		}
	}

	private paintFeedback(hud: HudState, now: number): void {
		const feedback = hud.feedback;
		if (!feedback) {
			return;
		}
		if (feedback.id !== this.feedbackId) {
			this.feedbackId = feedback.id;
			this.feedbackAt = now;
		}
		const progress = (now - this.feedbackAt) / FEEDBACK_MS;
		if (progress >= 1) {
			return;
		}
		const alpha =
			progress < 0.06
				? progress / 0.06
				: progress > 0.8
					? (1 - progress) / 0.2
					: 1;
		const at = this.at(this.width / 2, this.height * 0.74);
		const font = `500 20px ${BODY}`;
		const lines = this.wrap(feedback.text, font, 620);
		const context = this.context;
		context.font = font;
		const width =
			Math.max(...lines.map((line) => this.measure(line).width)) + 36;
		const height = lines.length * 26 + 18;
		context.globalAlpha = alpha;
		this.panel(at.x - width / 2, at.y, width, height, "rgba(10, 12, 10, 0.82)");
		context.fillStyle = FEEDBACK_TONES[feedback.tone] ?? YELLOW;
		context.fillRect(at.x - width / 2, at.y + height - 3, width, 3);
		lines.forEach((line, index) => {
			this.text(line, at.x, at.y + 22 + index * 26, {
				font,
				color: feedback.tone === "success" ? "#d8ffb8" : TEXT,
				align: "center",
				outline: false,
			});
		});
		context.globalAlpha = 1;
	}

	private paintAltar(hud: HudState): void {
		if (!hud.altarOpen) {
			return;
		}
		const messages = currentMessages();
		const width = 590;
		const rowHeight = 36;
		const height = OCCULT_IDS.length * rowHeight + 88;
		const placed = this.place(
			this.width / 2,
			this.height * 0.86,
			width,
			height,
			"center",
			"bottom",
		);
		const x = placed.x;
		const y = placed.y;
		this.panel(x, y, width, height, "rgba(16, 8, 26, 0.92)", ALTAR);
		this.text(messages.game.altar.title, x + 16, y + 18, {
			font: `500 16px ${UI}`,
			color: ALTAR,
			outline: false,
		});
		if (hud.prompt) {
			const promptFont = `700 18px ${UI}`;
			this.context.font = promptFont;
			const keyText = keyLabel(activeBindings().interact);
			const keyWidth = this.keyCapWidth(keyText, 22, 22);
			const promptWidth = this.measure(hud.prompt).width;
			const promptX = x + width - 14 - promptWidth;
			this.keyCap(
				keyText,
				promptX - keyWidth - 8,
				y + 6,
				keyWidth,
				22,
				promptFont,
			);
			this.text(hud.prompt, promptX, y + 18, {
				font: promptFont,
				color: YELLOW,
				outline: false,
			});
		}
		const owned = (id: MaterialId) => hud.inventory?.materials[id] ?? 0;
		OCCULT_IDS.forEach((object, index) => {
			const rowY = y + 34 + index * rowHeight;
			const recipe = Object.entries(OCCULT_RECIPES[object]) as [
				MaterialId,
				number,
			][];
			const used = hud.occultInPlay.includes(object);
			const ready = used && recipe.every(([id, count]) => owned(id) >= count);
			const selected = index === hud.altarSelected;
			if (selected) {
				this.panel(
					x + 8,
					rowY,
					width - 16,
					rowHeight - 2,
					used ? "rgba(46, 230, 214, 0.16)" : "rgba(255, 255, 255, 0.05)",
					used ? ALTAR : TEXT_MUTED,
				);
			}
			const alpha = !used ? 0.28 : ready || selected ? 1 : 0.5;
			this.context.globalAlpha = alpha;
			if (!used) {
				this.panel(x + 16, rowY + 6, 24, 24, TEXT_MUTED);
				this.text(String(index + 1), x + 28, rowY + 19, {
					font: `700 16px ${UI}`,
					color: BACKGROUND,
					align: "center",
					outline: false,
				});
				this.drawArt(object, x + 46, rowY + 1, 34, alpha);
				this.text(messages.grimoire.objects[object], x + 92, rowY + 18, {
					font: `700 18px ${UI}`,
					color: TEXT_MUTED,
					outline: false,
				});
				this.text(messages.game.altar.unused, x + width - 16, rowY + 18, {
					font: `italic 500 16px ${BODY}`,
					color: TEXT_MUTED,
					align: "right",
					outline: false,
				});
				this.context.globalAlpha = 1;
				return;
			}
			this.panel(x + 16, rowY + 6, 24, 24, YELLOW);
			this.text(String(index + 1), x + 28, rowY + 19, {
				font: `700 16px ${UI}`,
				color: BACKGROUND,
				align: "center",
				outline: false,
			});
			this.drawArt(object, x + 46, rowY + 1, 34, alpha);
			this.text(messages.grimoire.objects[object], x + 92, rowY + 18, {
				font: `700 18px ${UI}`,
				outline: false,
			});
			let right = x + width - 54;
			for (const [id, count] of [...recipe].reverse()) {
				this.text(`${owned(id)}/${count}`, right, rowY + 18, {
					font: `700 16px ${UI}`,
					align: "right",
					outline: false,
				});
				this.drawArt(id, right - 58, rowY + 3, 30, alpha);
				right -= 66;
			}
			this.text(
				`×${hud.inventory?.objects[object] ?? 0}`,
				x + width - 16,
				rowY + 18,
				{
					font: `700 16px ${UI}`,
					color: YELLOW,
					align: "right",
					outline: false,
				},
			);
			this.context.globalAlpha = 1;
		});
		this.text(messages.game.altar.hint, x + 16, y + height - 40, {
			font: `500 16px ${BODY}`,
			color: TEXT_MUTED,
			outline: false,
		});
		const keys = activeBindings();
		this.text(
			messages.game.altar.close(
				`${keyLabel(keys.shout)} / ${keyLabel(backCode())}`,
			),
			x + 16,
			y + height - 18,
			{
				font: `700 16px ${UI}`,
				color: ALTAR,
				outline: false,
			},
		);
	}

	private paintTutorial(hud: HudState): void {
		const tutorial = hud.tutorial;
		if (!tutorial || tutorial.finished) {
			return;
		}
		const messages = currentMessages().game.tutorial;
		const width = 404;
		const inner = width - 32;
		const bodyFont = `500 18px ${BODY}`;
		const checkFont = `700 16px ${UI}`;
		const choiceFont = `700 17px ${UI}`;
		const keyFont = `700 16px ${UI}`;
		const lines = this.wrap(tutorial.body, bodyFont, inner);
		const checkLines = tutorial.checks.map((check) =>
			this.wrap(`${check.ok ? "✔" : "✘"} ${check.label}`, checkFont, inner),
		);
		this.context.font = keyFont;
		const keyWidth = Math.max(
			0,
			...tutorial.choices.map(
				(choice) => this.measure(choice.key, 20).width + 18,
			),
		);
		const choiceLines = tutorial.choices.map((choice) =>
			this.wrap(choice.label, choiceFont, inner - keyWidth - 12),
		);
		const checksHeight =
			checkLines.length > 0
				? 8 + checkLines.reduce((sum, rows) => sum + rows.length * 20 + 2, 0)
				: 0;
		const choicesHeight =
			choiceLines.length > 0
				? 10 +
					choiceLines.reduce(
						(sum, rows) => sum + Math.max(28, rows.length * 20 + 8) + 8,
						0,
					)
				: 0;
		const footer = tutorial.arrow !== null || tutorial.hint ? 36 : 12;
		const height =
			78 + lines.length * 22 + checksHeight + choicesHeight + footer;
		const placed = this.place(20, 150, width, height, "left", "top");
		const x = placed.x;
		const y = Math.max(placed.y, this.minimapBottom + 16);
		this.panel(x, y, width, height, "rgba(10, 12, 10, 0.88)", YELLOW);
		this.text(
			tutorial.steps > 0
				? messages.progress(tutorial.chapter, tutorial.step, tutorial.steps)
				: tutorial.chapter,
			x + 16,
			y + 20,
			{ font: `600 16px ${UI}`, color: TEXT_MUTED, outline: false },
		);
		this.paintChapterDots(
			x + width - 16,
			y + 20,
			tutorial.chapterIndex,
			tutorial.chapterCount,
		);
		this.text(tutorial.title, x + 16, y + 48, {
			font: `400 28px ${TITLE}`,
			color: YELLOW,
			outline: false,
		});
		let cursor = y + 78;
		for (const line of lines) {
			this.text(line, x + 16, cursor, { font: bodyFont, outline: false });
			cursor += 22;
		}
		if (checkLines.length > 0) {
			cursor += 8;
			tutorial.checks.forEach((check, index) => {
				for (const row of checkLines[index]) {
					this.text(row, x + 16, cursor, {
						font: checkFont,
						color: check.ok ? OK : "#ff8a7a",
						outline: false,
					});
					cursor += 20;
				}
				cursor += 2;
			});
		}
		if (choiceLines.length > 0) {
			cursor += 10;
			tutorial.choices.forEach((choice, index) => {
				const rows = choiceLines[index];
				const rowHeight = Math.max(28, rows.length * 20 + 8);
				const top = cursor - 10;
				this.context.fillStyle = "rgba(220, 229, 77, 0.14)";
				this.context.fillRect(x + 16, top, keyWidth, 26);
				this.context.strokeStyle = YELLOW;
				this.context.lineWidth = 1.5;
				this.context.strokeRect(x + 16.75, top + 0.75, keyWidth - 1.5, 24.5);
				this.text(choice.key, x + 16 + keyWidth / 2, top + 13.5, {
					font: keyFont,
					color: YELLOW,
					align: "center",
					outline: false,
					glyphSize: 20,
				});
				rows.forEach((row, line) => {
					this.text(row, x + 28 + keyWidth, top + 13.5 + line * 20, {
						font: choiceFont,
						color: TEXT,
						outline: false,
					});
				});
				cursor += rowHeight + 8;
			});
			cursor -= 8;
		}
		const footerY = cursor + 12;
		if (tutorial.arrow !== null) {
			const context = this.context;
			context.save();
			context.translate(x + 28, footerY);
			context.rotate((-tutorial.arrow * Math.PI) / 180);
			context.fillStyle = YELLOW;
			context.beginPath();
			context.moveTo(0, -13);
			context.lineTo(9, 3);
			context.lineTo(3, 3);
			context.lineTo(3, 13);
			context.lineTo(-3, 13);
			context.lineTo(-3, 3);
			context.lineTo(-9, 3);
			context.closePath();
			context.fill();
			context.restore();
			this.text(`${tutorial.distance} m`, x + 48, footerY, {
				font: `700 18px ${UI}`,
				outline: false,
			});
		}
		if (tutorial.hint) {
			this.text(tutorial.hint, x + width - 16, footerY, {
				font: `500 16px ${UI}`,
				color: TEXT_MUTED,
				align: "right",
				outline: false,
			});
		}
	}

	private paintChapterDots(
		right: number,
		y: number,
		current: number,
		count: number,
	): void {
		const context = this.context;
		for (let index = 0; index < count; index += 1) {
			const cx = right - (count - 1 - index) * 16 - 5;
			context.beginPath();
			context.arc(cx, y, index === current ? 5.5 : 4.5, 0, Math.PI * 2);
			context.closePath();
			if (index < current) {
				context.fillStyle = YELLOW_DEEP;
				context.fill();
			} else if (index === current) {
				context.fillStyle = YELLOW;
				context.fill();
			} else {
				context.strokeStyle = TEXT_DIM;
				context.lineWidth = 1.5;
				context.stroke();
			}
		}
	}

	private paintNoise(hud: HudState, dt: number): void {
		const shown =
			!hud.dead &&
			!hud.carried &&
			(hud.hidden || (hud.crouching && !hud.lanternOpen));
		const target = shown ? 1 : 0;
		this.gaugeShown += (target - this.gaugeShown) * Math.min(1, dt * 9);
		if (Math.abs(target - this.gaugeShown) < GAUGE_SNAP) {
			this.gaugeShown = target;
		}
		if (this.gaugeShown < 0.02) {
			return;
		}
		const messages = currentMessages().game.hud;
		const context = this.context;
		const width = 68;
		const height = 290;
		const placed = this.place(
			this.width - 20,
			this.height / 2,
			width,
			height,
			"right",
			"center",
		);
		const x = placed.x;
		const y = Math.max(placed.y, this.materialsBottom + 8);
		const level = Math.min(1, Math.max(0, hud.voiceLevel));
		const heard = level >= VOICE_AUDIBLE_LEVEL;
		const lit = Math.round(level * NOISE_SEGMENTS);
		const limit = Math.round(VOICE_AUDIBLE_LEVEL * NOISE_SEGMENTS);
		context.globalAlpha = this.gaugeShown;
		this.panel(x, y, width, height, "rgba(10, 12, 10, 0.72)", LINE_STRONG);
		this.text(messages.noise, x + width / 2, y + 18, {
			font: `700 16px ${UI}`,
			color: TEXT_MUTED,
			align: "center",
			outline: false,
		});
		const segmentHeight = 9;
		for (let segment = 0; segment < NOISE_SEGMENTS; segment += 1) {
			const segmentY = y + 34 + (NOISE_SEGMENTS - 1 - segment) * 12;
			context.fillStyle =
				segment < lit
					? segment >= limit
						? DANGER
						: OK
					: "rgba(255, 255, 255, 0.09)";
			context.fillRect(x + 21, segmentY, 26, segmentHeight);
			if (segment === limit) {
				context.fillStyle = YELLOW;
				context.fillRect(x + 17, segmentY - 3, 34, 2);
			}
		}
		this.text(
			heard ? messages.noiseHeard : messages.noiseQuiet,
			x + width / 2,
			y + height - 18,
			{
				font: `700 16px ${UI}`,
				color: heard ? DANGER : TEXT_MUTED,
				align: "center",
				outline: false,
			},
		);
		context.globalAlpha = 1;
	}

	private paintDev(hud: HudState): void {
		if (!hud.devMode) {
			return;
		}
		const messages = currentMessages().game;
		const labels = messages.dev;
		const font = `500 16px ${UI}`;
		const width = 370;
		const entries: { text: string; color: string }[] = [];
		const add = (text: string, color: string) => {
			for (const line of this.wrap(text, font, width - 24)) {
				entries.push({ text: line, color });
			}
		};
		if (hud.devLive.text) {
			add(
				`${labels.live} « ${hud.devLive.text} »${hud.devLive.matches ? ` ${labels.liveMatch}` : ""}`,
				hud.devLive.matches ? OK : TEXT,
			);
		} else if (hud.devCasts.length === 0) {
			add(labels.empty, TEXT_MUTED);
		}
		for (const cast of hud.devCasts) {
			cast.transcripts.forEach((text, index) => {
				add(
					`${index === 0 ? labels.heard : labels.alternative} « ${text} »`,
					index === 0 ? TEXT : TEXT_MUTED,
				);
			});
			add(
				cast.matchedLabel
					? `${labels.matches(cast.matchedLabel)} · ${labels.expected} « ${cast.expected.join(" ")} »`
					: labels.noMatch,
				cast.matchedLabel ? OK : DANGER,
			);
			add(
				cast.result === "ignored"
					? labels.ignored
					: cast.result === "pending"
						? labels.pending
						: cast.result === "ok"
							? labels.captured
							: labels.refused(messages.cast.reasons[cast.result]),
				TEXT_MUTED,
			);
		}
		const shown = entries.slice(0, 24);
		const height = shown.length * 20 + 42;
		const placed = this.place(
			this.width - 100,
			this.materialsBottom + 10,
			width,
			height,
			"right",
			"top",
		);
		const x = placed.x;
		const y = Math.max(placed.y, this.materialsBottom + 10);
		this.panel(x, y, width, height, DARK_PANEL, LINE_STRONG, 1);
		this.text(labels.title, x + 12, y + 18, {
			font: `500 16px ${UI}`,
			color: YELLOW,
			outline: false,
		});
		shown.forEach((entry, index) => {
			this.text(entry.text, x + 12, y + 44 + index * 20, {
				font,
				color: entry.color,
				outline: false,
			});
		});
	}

	private paintDeath(hud: HudState): void {
		if (!hud.dead) {
			return;
		}
		const messages = currentMessages().game.hud;
		const context = this.context;
		context.fillStyle = "rgba(30, 0, 0, 0.55)";
		context.fillRect(0, 0, this.width, this.height);
		context.section();
		const x = this.width / 2;
		const y = this.height / 2;
		this.text(messages.fallen, x, y - 26, {
			font: `400 56px ${TITLE}`,
			color: DANGER,
			align: "center",
		});
		this.text(
			messages.respawn(
				Math.max(0, Math.ceil((hud.respawnAt - hud.serverNow) / 1000)),
			),
			x,
			y + 26,
			{ font: `700 24px ${UI}`, align: "center" },
		);
	}

	private paintMarkers(hud: HudState): void {
		if (hud.showMap || hud.paused || this.markers.length === 0) {
			return;
		}
		const context = this.context;
		const margin = 46;
		const centerX = this.width / 2;
		const centerY = this.height / 2;
		for (const marker of this.markers) {
			context.section();
			const dx = Math.cos(marker.angle);
			const dy = Math.sin(marker.angle);
			const reach = Math.min(
				(centerX - margin) / Math.max(Math.abs(dx), 1e-6),
				(centerY - margin) / Math.max(Math.abs(dy), 1e-6),
			);
			const at = this.at(centerX + dx * reach, centerY + dy * reach);
			const pulse = Math.max(0, 1 - marker.fresh);
			context.save();
			context.translate(at.x, at.y);
			context.rotate(marker.angle);
			context.scale(1 + pulse * 0.35, 1 + pulse * 0.35);
			context.fillStyle = marker.color;
			context.strokeStyle = "rgba(0, 0, 0, 0.85)";
			context.lineWidth = 2.5;
			context.beginPath();
			context.moveTo(16, 0);
			context.lineTo(-8, 11);
			context.lineTo(-3, 0);
			context.lineTo(-8, -11);
			context.closePath();
			context.fill();
			context.stroke();
			context.restore();
			this.text(marker.label, at.x - dx * 30, at.y - dy * 30 - 9, {
				font: `700 15px ${UI}`,
				color: marker.color,
				align: "center",
			});
			this.text(marker.detail, at.x - dx * 30, at.y - dy * 30 + 9, {
				font: `500 13px ${UI}`,
				color: TEXT,
				align: "center",
			});
		}
	}

	private paintWheel(hud: HudState): void {
		const wheel = hud.wheel;
		if (!wheel || hud.paused || hud.showMap) {
			return;
		}
		const context = this.context;
		const centerX = this.width / 2;
		const centerY = this.height / 2;
		const inner = 46;
		const outer = 150;
		const count = wheel.labels.length;
		const step = (Math.PI * 2) / count;
		context.fillStyle = "rgba(5, 6, 5, 0.35)";
		context.fillRect(0, 0, this.width, this.height);
		context.section();
		context.save();
		wheel.labels.forEach((label, index) => {
			const start = -Math.PI / 2 + index * step - step / 2;
			const selected = index === wheel.selected;
			context.beginPath();
			context.arc(centerX, centerY, outer, start + 0.02, start + step - 0.02);
			context.arc(
				centerX,
				centerY,
				inner,
				start + step - 0.02,
				start + 0.02,
				true,
			);
			context.closePath();
			context.fillStyle = selected
				? "rgba(46, 52, 46, 0.96)"
				: "rgba(16, 19, 16, 0.86)";
			context.fill();
			context.strokeStyle = selected ? wheel.colors[index] : LINE_STRONG;
			context.lineWidth = selected ? 3 : 1.5;
			context.stroke();
			const middle = start + step / 2;
			const radius = (inner + outer) / 2 + 6;
			this.text(
				label,
				centerX + Math.cos(middle) * radius,
				centerY + Math.sin(middle) * radius,
				{
					font: `700 ${selected ? 19 : 17}px ${UI}`,
					color: selected ? wheel.colors[index] : TEXT,
					align: "center",
				},
			);
		});
		context.restore();
		this.text(wheel.title, centerX, centerY - 6, {
			font: `400 22px ${TITLE}`,
			color: YELLOW,
			align: "center",
		});
		this.text(
			currentMessages().party.wheel.hint,
			centerX,
			centerY + outer + 28,
			{ font: `500 16px ${UI}`, color: TEXT_MUTED, align: "center" },
		);
	}

	private paintGift(hud: HudState): void {
		const gift = hud.gift;
		if (!gift) {
			return;
		}
		const messages = currentMessages();
		const labels = messages.party.gift;
		const width = 460;
		const rowHeight = 32;
		const height = MATERIAL_IDS.length * rowHeight + 70;
		const placed = this.place(
			this.width / 2,
			this.height * 0.86,
			width,
			height,
			"center",
			"bottom",
		);
		const x = placed.x;
		const y = placed.y;
		this.panel(x, y, width, height, "rgba(10, 14, 10, 0.92)", OK);
		this.text(labels.title(gift.name), x + 16, y + 18, {
			font: `700 17px ${UI}`,
			color: OK,
			outline: false,
		});
		MATERIAL_IDS.forEach((id, index) => {
			const rowY = y + 34 + index * rowHeight;
			const owned = hud.inventory?.materials[id] ?? 0;
			const selected = index === gift.selected;
			if (selected) {
				this.panel(
					x + 8,
					rowY,
					width - 16,
					rowHeight - 2,
					"rgba(143, 211, 106, 0.16)",
					OK,
				);
			}
			this.context.globalAlpha = owned > 0 || selected ? 1 : 0.45;
			this.panel(x + 16, rowY + 4, 22, 22, YELLOW);
			this.text(String(index + 1), x + 27, rowY + 16, {
				font: `700 15px ${UI}`,
				color: BACKGROUND,
				align: "center",
				outline: false,
			});
			this.drawArt(id, x + 46, rowY + 1, 28, owned > 0 ? 1 : 0.4);
			const name = messages.grimoire.materials[id];
			this.text(
				name.charAt(0).toUpperCase() + name.slice(1),
				x + 84,
				rowY + 16,
				{
					font: `700 17px ${UI}`,
					outline: false,
				},
			);
			this.text(labels.owned(owned), x + width - 18, rowY + 16, {
				font: `700 17px ${FIGURES}`,
				color: owned > 0 ? YELLOW : TEXT_DIM,
				align: "right",
				outline: false,
			});
			this.context.globalAlpha = 1;
		});
		this.text(labels.hint, x + 16, y + height - 16, {
			font: `500 15px ${BODY}`,
			color: TEXT_MUTED,
			outline: false,
		});
	}

	private paintGhost(hud: HudState): void {
		const party = currentMessages().party.ghost;
		this.centerVeil([
			{ at: 0.35, color: "rgba(40, 70, 110, 0)" },
			{ at: 1, color: "rgba(40, 70, 110, 0.55)" },
		]);
		this.context.section();
		const x = this.width / 2;
		const top = this.at(x, this.height * 0.2);
		this.text(party.title, top.x, top.y, {
			font: `400 40px ${TITLE}`,
			color: "#bfe6ff",
			align: "center",
		});
		const seconds = Math.ceil((hud.respawnAt - hud.serverNow) / 1000);
		this.text(
			hud.oneLife || !Number.isFinite(hud.respawnAt) || hud.respawnAt <= 0
				? party.oneLife
				: party.respawn(Math.max(0, seconds)),
			top.x,
			top.y + 36,
			{ font: `700 20px ${UI}`, align: "center" },
		);
		const keys = activeBindings();
		this.text(
			party.hint(
				keyLabel(keys.jump),
				keyLabel(keys.crouch),
				keyLabel(keys.sprint),
			),
			top.x,
			top.y + 64,
			{ font: `500 17px ${BODY}`, color: TEXT_MUTED, align: "center" },
		);
		this.text(party.voice, top.x, top.y + 88, {
			font: `500 16px ${UI}`,
			color: VOICE,
			align: "center",
		});
	}

	private paintRole(hud: HudState, now: number): void {
		if (!hud.role || hud.roleShownAt <= 0) {
			return;
		}
		const elapsed = now - hud.roleShownAt;
		if (elapsed > ROLE_REVEAL_MS) {
			return;
		}
		const alpha = Math.min(1, elapsed / 300, (ROLE_REVEAL_MS - elapsed) / 600);
		const labels = currentMessages().party.possessed;
		const possessed = hud.role === "possessed";
		const width = 620;
		const bodyFont = `500 19px ${BODY}`;
		const body = possessed
			? labels.rolePossessedText(keyLabel(activeBindings().power))
			: labels.roleHunterText(hud.ritual?.quota ?? 0);
		const lines = this.wrap(body, bodyFont, width - 48);
		const height = 86 + lines.length * 25;
		const x = (this.width - width) / 2;
		const y = this.height * 0.3 - height / 2;
		const color = possessed ? DANGER : "#c39bff";
		this.context.globalAlpha = Math.max(0, alpha);
		this.panel(x, y, width, height, "rgba(12, 8, 16, 0.94)", color, 3);
		this.text(
			possessed ? labels.rolePossessed : labels.roleHunter,
			x + width / 2,
			y + 36,
			{
				font: `400 36px ${TITLE}`,
				color,
				align: "center",
			},
		);
		lines.forEach((line, index) => {
			this.text(line, x + width / 2, y + 76 + index * 25, {
				font: bodyFont,
				align: "center",
				outline: false,
			});
		});
		this.context.globalAlpha = 1;
	}

	private paintStats(
		hud: HudState,
		settings: { corner: string; graph: boolean; opacity: number },
	): void {
		const stats = hud.stats;
		if (!stats || (stats.lines.length === 0 && !settings.graph)) {
			return;
		}
		const font = `600 15px ${FIGURES}`;
		const rowHeight = 19;
		const graphHeight = settings.graph ? 46 : 0;
		const width = 196;
		const height =
			12 +
			stats.lines.length * rowHeight +
			graphHeight +
			(settings.graph ? 8 : 0);
		const right = settings.corner.endsWith("Right");
		const bottom = settings.corner.startsWith("bottom");
		const anchorY = bottom ? this.height - 74 : this.minimapBottom + 16;
		const placed = this.place(
			right ? this.width - 20 : 20,
			bottom
				? anchorY
				: Math.max(anchorY, right ? this.materialsBottom + 12 : anchorY),
			width,
			height,
			right ? "right" : "left",
			bottom ? "bottom" : "top",
		);
		const context = this.context;
		context.globalAlpha = settings.opacity;
		this.panel(
			placed.x,
			placed.y,
			width,
			height,
			"rgba(8, 10, 8, 0.82)",
			LINE_STRONG,
			1,
		);
		stats.lines.forEach((line, index) => {
			const rowY = placed.y + 15 + index * rowHeight;
			this.text(line.label, placed.x + 10, rowY, {
				font,
				color: TEXT_MUTED,
				outline: false,
			});
			this.text(line.value, placed.x + width - 10, rowY, {
				font,
				color: line.warn ? DANGER : TEXT,
				align: "right",
				outline: false,
			});
		});
		if (settings.graph && stats.frames.length > 1) {
			const graphX = placed.x + 10;
			const graphY = placed.y + 12 + stats.lines.length * rowHeight;
			const graphWidth = width - 20;
			context.fillStyle = "rgba(255, 255, 255, 0.05)";
			context.fillRect(graphX, graphY, graphWidth, graphHeight);
			const ceiling = 50;
			const budget = graphY + graphHeight - (graphHeight * 16.7) / ceiling;
			context.strokeStyle = "rgba(220, 229, 77, 0.35)";
			context.lineWidth = 1;
			context.beginPath();
			context.moveTo(graphX, budget);
			context.lineTo(graphX + graphWidth, budget);
			context.stroke();
			const barWidth = graphWidth / stats.frames.length;
			stats.frames.forEach((frame, index) => {
				const size = Math.min(1, frame / ceiling) * graphHeight;
				context.fillStyle = frame > 33 ? DANGER : frame > 17.5 ? YELLOW : OK;
				context.fillRect(
					graphX + index * barWidth,
					graphY + graphHeight - size,
					Math.max(1, barWidth - 0.5),
					size,
				);
			});
		}
		context.globalAlpha = 1;
	}

	dispose(): void {
		this.texture.dispose();
		this.minimapTexture.dispose();
	}
}
