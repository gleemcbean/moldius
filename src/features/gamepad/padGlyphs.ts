import { PAD_BUTTON } from "./gamepad";

export type PadGlyph = "a" | "b" | "x" | "y" | "up" | "down" | "left" | "right";

export type FaceGlyph = "a" | "b" | "x" | "y";

export const FACE_GLYPHS: readonly FaceGlyph[] = ["a", "b", "x", "y"];

export type DpadGlyph = "up" | "down" | "left" | "right";

const GLYPH_CHARS: Record<PadGlyph, string> = {
	a: "",
	b: "",
	x: "",
	y: "",
	up: "",
	down: "",
	left: "",
	right: "",
};

const CHAR_GLYPHS = new Map<string, PadGlyph>(
	Object.entries(GLYPH_CHARS).map(([glyph, char]) => [char, glyph as PadGlyph]),
);

const BUTTON_GLYPHS = new Map<number, PadGlyph>([
	[PAD_BUTTON.a, "a"],
	[PAD_BUTTON.b, "b"],
	[PAD_BUTTON.x, "x"],
	[PAD_BUTTON.y, "y"],
	[PAD_BUTTON.up, "up"],
	[PAD_BUTTON.down, "down"],
	[PAD_BUTTON.left, "left"],
	[PAD_BUTTON.right, "right"],
]);

const GLYPH_PATTERN = /[-]/;
const GLYPH_SPLIT = /([-])/;

export const FACE_COLORS: Record<FaceGlyph, string> = {
	a: "#7fd66b",
	b: "#ef5f4c",
	x: "#5fa8f0",
	y: "#f1cf4a",
};

export const GLYPH_BACKING = "#121410";
export const GLYPH_INK = "#ecefe2";
export const GLYPH_DIM = "#4c5245";

export const GLYPH_SCALE = 1.18;
export const GLYPH_GAP = 0.14;
export const GLYPH_BOX = 20;
export const FACE_RING_RADIUS = 8.8;
export const FACE_RING_WIDTH = 1.8;
export const FACE_LETTER_WIDTH = 2.1;

export const FACE_LETTERS: Record<FaceGlyph, string> = {
	a: "M5.7 14.6L10 5.4L14.3 14.6M7.35 11.1H12.65",
	b: "M6.7 5.4V14.6M6.7 5.4H10.5A2.2 2.2 0 0 1 10.5 9.8H6.7M6.7 9.8H11A2.4 2.4 0 0 1 11 14.6H6.7",
	x: "M6 5.4L14 14.6M14 5.4L6 14.6",
	y: "M6 5.4L10 10.2L14 5.4M10 10.2V14.6",
};

const letterPaths = new Map<FaceGlyph, Path2D>();

export function faceLetterPath(glyph: FaceGlyph): Path2D {
	let path = letterPaths.get(glyph);
	if (!path) {
		path = new Path2D(FACE_LETTERS[glyph]);
		letterPaths.set(glyph, path);
	}
	return path;
}

export function glyphChar(glyph: PadGlyph): string {
	return GLYPH_CHARS[glyph];
}

export function buttonGlyph(button: number): PadGlyph | null {
	return BUTTON_GLYPHS.get(button) ?? null;
}

export function hasGlyph(text: string): boolean {
	return GLYPH_PATTERN.test(text);
}

export function isFaceGlyph(glyph: PadGlyph): glyph is FaceGlyph {
	return glyph in FACE_COLORS;
}

export type GlyphRun = { text: string } | { glyph: PadGlyph };

export function splitGlyphs(text: string): GlyphRun[] {
	const runs: GlyphRun[] = [];
	for (const part of text.split(GLYPH_SPLIT)) {
		if (part === "") {
			continue;
		}
		const glyph = CHAR_GLYPHS.get(part);
		runs.push(glyph ? { glyph } : { text: part });
	}
	return runs;
}

export interface GlyphContext {
	fillStyle: unknown;
	strokeStyle: unknown;
	lineWidth: number;
	lineCap: CanvasLineCap;
	lineJoin: CanvasLineJoin;
	font: string;
	textAlign: CanvasTextAlign;
	textBaseline: CanvasTextBaseline;
	save(): void;
	restore(): void;
	beginPath(): void;
	closePath(): void;
	moveTo(x: number, y: number): void;
	lineTo(x: number, y: number): void;
	arc(x: number, y: number, radius: number, start: number, end: number): void;
	fill(): void;
	stroke(path?: Path2D): void;
	translate(x: number, y: number): void;
	scale(x: number, y: number): void;
	fillRect(x: number, y: number, width: number, height: number): void;
	fillText(text: string, x: number, y: number): void;
}

const DPAD_ARMS: Record<DpadGlyph, { x: number; y: number }> = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
};

function crossPath(
	context: GlyphContext,
	cx: number,
	cy: number,
	reach: number,
	arm: number,
): void {
	const r = reach;
	const a = arm / 2;
	context.beginPath();
	context.moveTo(cx - a, cy - r);
	context.lineTo(cx + a, cy - r);
	context.lineTo(cx + a, cy - a);
	context.lineTo(cx + r, cy - a);
	context.lineTo(cx + r, cy + a);
	context.lineTo(cx + a, cy + a);
	context.lineTo(cx + a, cy + r);
	context.lineTo(cx - a, cy + r);
	context.lineTo(cx - a, cy + a);
	context.lineTo(cx - r, cy + a);
	context.lineTo(cx - r, cy - a);
	context.lineTo(cx - a, cy - a);
	context.closePath();
}

export function drawPadGlyph(
	context: GlyphContext,
	glyph: PadGlyph,
	cx: number,
	cy: number,
	size: number,
): void {
	context.save();
	const radius = size / 2;
	if (isFaceGlyph(glyph)) {
		const color = FACE_COLORS[glyph];
		const unit = size / GLYPH_BOX;
		context.beginPath();
		context.arc(
			cx,
			cy,
			(FACE_RING_RADIUS + FACE_RING_WIDTH / 2) * unit,
			0,
			Math.PI * 2,
		);
		context.fillStyle = GLYPH_BACKING;
		context.fill();
		context.lineWidth = FACE_RING_WIDTH * unit;
		context.strokeStyle = color;
		context.beginPath();
		context.arc(cx, cy, FACE_RING_RADIUS * unit, 0, Math.PI * 2);
		context.stroke();
		context.translate(cx - radius, cy - radius);
		context.scale(unit, unit);
		context.lineWidth = FACE_LETTER_WIDTH;
		context.lineCap = "round";
		context.lineJoin = "round";
		context.stroke(faceLetterPath(glyph));
		context.restore();
		return;
	}
	const reach = radius;
	const arm = size * 0.38;
	crossPath(context, cx, cy, reach, arm);
	context.fillStyle = GLYPH_BACKING;
	context.fill();
	context.lineWidth = Math.max(1, size * 0.07);
	context.strokeStyle = GLYPH_DIM;
	context.stroke();
	const direction = DPAD_ARMS[glyph];
	const inset = context.lineWidth * 1.1;
	const width = arm - inset * 2;
	const length = reach - inset - size * 0.04;
	const start = size * 0.04;
	context.fillStyle = GLYPH_INK;
	if (direction.x === 0) {
		const top = direction.y < 0 ? cy - start - length : cy + start;
		context.fillRect(cx - width / 2, top, width, length);
	} else {
		const left = direction.x < 0 ? cx - start - length : cx + start;
		context.fillRect(left, cy - width / 2, length, width);
	}
	context.restore();
}
