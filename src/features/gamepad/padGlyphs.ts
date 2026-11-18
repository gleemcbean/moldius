import { PAD_BUTTON } from "./gamepad";

export type PadGlyph = "a" | "b" | "x" | "y" | "up" | "down" | "left" | "right";

export type FaceGlyph = "a" | "b" | "x" | "y";

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
	stroke(): void;
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
	family: string,
): void {
	context.save();
	const radius = size / 2;
	if (isFaceGlyph(glyph)) {
		const color = FACE_COLORS[glyph];
		context.beginPath();
		context.arc(cx, cy, radius, 0, Math.PI * 2);
		context.fillStyle = GLYPH_BACKING;
		context.fill();
		context.lineWidth = Math.max(1.5, size * 0.1);
		context.strokeStyle = color;
		context.beginPath();
		context.arc(cx, cy, radius - context.lineWidth / 2, 0, Math.PI * 2);
		context.stroke();
		context.fillStyle = color;
		context.font = `800 ${Math.round(size * 0.62)}px ${family}`;
		context.textAlign = "center";
		context.textBaseline = "middle";
		context.fillText(glyph.toUpperCase(), cx, cy + size * 0.04);
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
