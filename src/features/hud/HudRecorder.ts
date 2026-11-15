const OP = {
	fillStyle: 1,
	fillGradient: 2,
	strokeStyle: 3,
	lineWidth: 4,
	font: 5,
	textAlign: 6,
	textBaseline: 7,
	globalAlpha: 8,
	lineJoin: 9,
	lineCap: 10,
	filter: 11,
	shadowColor: 12,
	shadowBlur: 13,
	lineDash: 14,
	fillRect: 15,
	strokeRect: 16,
	clearRect: 17,
	fillText: 18,
	strokeText: 19,
	beginPath: 20,
	closePath: 21,
	moveTo: 22,
	lineTo: 23,
	arc: 24,
	fill: 25,
	fillPath: 26,
	stroke: 27,
	save: 28,
	restore: 29,
	translate: 30,
	scale: 31,
	rotate: 32,
	setTransform: 33,
	drawImage: 34,
	drawImageSized: 35,
	gradient: 36,
	gradientStop: 37,
} as const;

const NUMBER_ARITY: number[] = [];
const REF_ARITY: number[] = [];

for (const [op, numbers, refs] of [
	[OP.fillStyle, 0, 1],
	[OP.fillGradient, 1, 0],
	[OP.strokeStyle, 0, 1],
	[OP.lineWidth, 1, 0],
	[OP.font, 0, 1],
	[OP.textAlign, 0, 1],
	[OP.textBaseline, 0, 1],
	[OP.globalAlpha, 1, 0],
	[OP.lineJoin, 0, 1],
	[OP.lineCap, 0, 1],
	[OP.filter, 0, 1],
	[OP.shadowColor, 0, 1],
	[OP.shadowBlur, 1, 0],
	[OP.fillRect, 4, 0],
	[OP.strokeRect, 4, 0],
	[OP.clearRect, 4, 0],
	[OP.fillText, 2, 1],
	[OP.strokeText, 2, 1],
	[OP.beginPath, 0, 0],
	[OP.closePath, 0, 0],
	[OP.moveTo, 2, 0],
	[OP.lineTo, 2, 0],
	[OP.arc, 6, 0],
	[OP.fill, 0, 0],
	[OP.fillPath, 0, 2],
	[OP.stroke, 0, 0],
	[OP.save, 0, 0],
	[OP.restore, 0, 0],
	[OP.translate, 2, 0],
	[OP.scale, 2, 0],
	[OP.rotate, 1, 0],
	[OP.setTransform, 6, 0],
	[OP.drawImage, 2, 1],
	[OP.drawImageSized, 4, 1],
	[OP.gradient, 7, 0],
	[OP.gradientStop, 2, 1],
] as const) {
	NUMBER_ARITY[op] = numbers;
	REF_ARITY[op] = refs;
}

const MEASURE_CACHE_LIMIT = 4000;
const FONT_CACHE_LIMIT = 200;
const FALLBACK_FONT_SIZE = 64;
const MAX_REGIONS = 6;
const MERGE_GAP = 6;
const REGION_MARGIN = 2;
const FULL_REPAINT_SHARE = 0.55;
const TRANSPARENT = "rgba(0, 0, 0, 0)";

export class RecordedGradient {
	constructor(
		private readonly recorder: HudRecorder,
		readonly id: number,
	) {}

	addColorStop(offset: number, color: string): void {
		this.recorder.recordStop(this.id, offset, color);
	}
}

type Style = string | RecordedGradient;

interface DrawState {
	fillStyle: Style;
	strokeStyle: string;
	lineWidth: number;
	font: string;
	textAlign: CanvasTextAlign;
	textBaseline: CanvasTextBaseline;
	globalAlpha: number;
	lineJoin: CanvasLineJoin;
	lineCap: CanvasLineCap;
	filter: string;
	shadowColor: string;
	shadowBlur: number;
	lineDash: number[];
	a: number;
	b: number;
	c: number;
	d: number;
	e: number;
	f: number;
}

export interface HudRegion {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

interface Segment {
	numbers: number;
	refs: number;
	numbersEnd: number;
	refsEnd: number;
	depth: number;
	depthEnd: number;
	left: number;
	top: number;
	right: number;
	bottom: number;
	start: DrawState;
}

function sameNumbers(a: number[], b: number[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let index = 0; index < a.length; index += 1) {
		if (a[index] !== b[index]) {
			return false;
		}
	}
	return true;
}

function sameState(a: DrawState, b: DrawState): boolean {
	return (
		typeof a.fillStyle === "string" &&
		a.fillStyle === b.fillStyle &&
		a.strokeStyle === b.strokeStyle &&
		a.lineWidth === b.lineWidth &&
		a.font === b.font &&
		a.textAlign === b.textAlign &&
		a.textBaseline === b.textBaseline &&
		a.globalAlpha === b.globalAlpha &&
		a.lineJoin === b.lineJoin &&
		a.lineCap === b.lineCap &&
		a.filter === b.filter &&
		a.shadowColor === b.shadowColor &&
		a.shadowBlur === b.shadowBlur &&
		a.a === b.a &&
		a.b === b.b &&
		a.c === b.c &&
		a.d === b.d &&
		a.e === b.e &&
		a.f === b.f &&
		sameNumbers(a.lineDash, b.lineDash)
	);
}

function emptySegment(state: DrawState): Segment {
	return {
		numbers: 0,
		refs: 0,
		numbersEnd: 0,
		refsEnd: 0,
		depth: 0,
		depthEnd: 0,
		left: Infinity,
		top: Infinity,
		right: -Infinity,
		bottom: -Infinity,
		start: { ...state },
	};
}

export class HudRecorder {
	private numbers: number[] = [];
	private refs: unknown[] = [];
	private previousNumbers: number[] = [];
	private previousRefs: unknown[] = [];
	private segments: Segment[] = [];
	private previousSegments: Segment[] = [];
	private segmentCount = 0;
	private previousCount = 0;
	private current: Segment;
	private readonly stack: DrawState[] = [];
	private readonly gradients: CanvasGradient[] = [];
	private readonly widths = new Map<string, Map<string, number>>();
	private readonly sizes = new Map<string, number>();
	private readonly paths = new WeakMap<object, HudRegion>();
	private readonly regions: HudRegion[] = [];
	private readonly defaults: DrawState;
	private state: DrawState;
	private measured = 0;
	private gradientCount = 0;
	private dirty = true;
	private everything = true;
	private boxLeft = 0;
	private boxTop = 0;
	private boxRight = 0;
	private boxBottom = 0;
	private pathLeft = Infinity;
	private pathTop = Infinity;
	private pathRight = -Infinity;
	private pathBottom = -Infinity;

	constructor(private readonly target: CanvasRenderingContext2D) {
		this.defaults = {
			fillStyle: "#000000",
			strokeStyle: "#000000",
			lineWidth: 1,
			font: target.font,
			textAlign: "start",
			textBaseline: "alphabetic",
			globalAlpha: 1,
			lineJoin: "miter",
			lineCap: "butt",
			filter: "none",
			shadowColor: TRANSPARENT,
			shadowBlur: 0,
			lineDash: [],
			a: 1,
			b: 0,
			c: 0,
			d: 1,
			e: 0,
			f: 0,
		};
		this.state = { ...this.defaults };
		this.current = emptySegment(this.defaults);
	}

	get repaintedAll(): boolean {
		return this.everything;
	}

	get repainted(): readonly HudRegion[] {
		return this.regions;
	}

	begin(): void {
		this.numbers.length = 0;
		this.refs.length = 0;
		this.gradientCount = 0;
		this.stack.length = 0;
		this.state = { ...this.defaults };
		this.segmentCount = 0;
		this.openSegment();
	}

	section(): void {
		this.closeSegment();
		this.openSegment();
	}

	commit(): boolean {
		this.closeSegment();
		const canvas = (
			this.target as { canvas?: { width: number; height: number } }
		).canvas;
		const width = canvas?.width ?? 0;
		const height = canvas?.height ?? 0;
		const sized = width > 0 && height > 0;
		this.regions.length = 0;
		let everything = this.dirty || this.segmentCount !== this.previousCount;
		if (!everything) {
			let changed = false;
			for (let index = 0; index < this.segmentCount; index += 1) {
				const segment = this.segments[index];
				const previous = this.previousSegments[index];
				if (!this.sameSegment(segment, previous)) {
					changed = true;
					if (sized) {
						this.addRegion(segment, width, height);
						this.addRegion(previous, width, height);
					}
				}
			}
			if (!changed || (sized && this.regions.length === 0)) {
				this.swap();
				return false;
			}
			let area = 0;
			for (const region of this.regions) {
				area += (region.right - region.left) * (region.bottom - region.top);
			}
			everything = !sized || area > width * height * FULL_REPAINT_SHARE;
		}
		if (everything) {
			this.regions.length = 0;
		}
		this.everything = everything;
		this.replay(width, height);
		this.swap();
		this.dirty = false;
		return true;
	}

	invalidate(): void {
		this.dirty = true;
	}

	forgetMeasures(): void {
		this.widths.clear();
		this.measured = 0;
	}

	registerPath(
		path: Path2D,
		left: number,
		top: number,
		right: number,
		bottom: number,
	): void {
		this.paths.set(path, { left, top, right, bottom });
	}

	recordStop(id: number, offset: number, color: string): void {
		this.numbers.push(OP.gradientStop, id, offset);
		this.refs.push(color);
	}

	get fillStyle(): Style {
		return this.state.fillStyle;
	}

	set fillStyle(value: Style) {
		this.state.fillStyle = value;
		if (typeof value === "string") {
			this.numbers.push(OP.fillStyle);
			this.refs.push(value);
		} else {
			this.numbers.push(OP.fillGradient, value.id);
		}
	}

	get strokeStyle(): string {
		return this.state.strokeStyle;
	}

	set strokeStyle(value: string) {
		this.state.strokeStyle = value;
		this.numbers.push(OP.strokeStyle);
		this.refs.push(value);
	}

	get lineWidth(): number {
		return this.state.lineWidth;
	}

	set lineWidth(value: number) {
		this.state.lineWidth = value;
		this.numbers.push(OP.lineWidth, value);
	}

	get font(): string {
		return this.state.font;
	}

	set font(value: string) {
		this.state.font = value;
		this.numbers.push(OP.font);
		this.refs.push(value);
	}

	get textAlign(): CanvasTextAlign {
		return this.state.textAlign;
	}

	set textAlign(value: CanvasTextAlign) {
		this.state.textAlign = value;
		this.numbers.push(OP.textAlign);
		this.refs.push(value);
	}

	get textBaseline(): CanvasTextBaseline {
		return this.state.textBaseline;
	}

	set textBaseline(value: CanvasTextBaseline) {
		this.state.textBaseline = value;
		this.numbers.push(OP.textBaseline);
		this.refs.push(value);
	}

	get globalAlpha(): number {
		return this.state.globalAlpha;
	}

	set globalAlpha(value: number) {
		this.state.globalAlpha = value;
		this.numbers.push(OP.globalAlpha, value);
	}

	get lineJoin(): CanvasLineJoin {
		return this.state.lineJoin;
	}

	set lineJoin(value: CanvasLineJoin) {
		this.state.lineJoin = value;
		this.numbers.push(OP.lineJoin);
		this.refs.push(value);
	}

	get lineCap(): CanvasLineCap {
		return this.state.lineCap;
	}

	set lineCap(value: CanvasLineCap) {
		this.state.lineCap = value;
		this.numbers.push(OP.lineCap);
		this.refs.push(value);
	}

	get filter(): string {
		return this.state.filter;
	}

	set filter(value: string) {
		this.state.filter = value;
		this.numbers.push(OP.filter);
		this.refs.push(value);
	}

	get shadowColor(): string {
		return this.state.shadowColor;
	}

	set shadowColor(value: string) {
		this.state.shadowColor = value;
		this.numbers.push(OP.shadowColor);
		this.refs.push(value);
	}

	get shadowBlur(): number {
		return this.state.shadowBlur;
	}

	set shadowBlur(value: number) {
		this.state.shadowBlur = value;
		this.numbers.push(OP.shadowBlur, value);
	}

	setLineDash(segments: number[]): void {
		this.state.lineDash = [...segments];
		this.numbers.push(OP.lineDash, segments.length, ...segments);
	}

	measureText(text: string): { width: number } {
		return { width: this.measure(this.state.font, text) };
	}

	createRadialGradient(
		x0: number,
		y0: number,
		r0: number,
		x1: number,
		y1: number,
		r1: number,
	): RecordedGradient {
		const id = this.gradientCount;
		this.gradientCount += 1;
		this.numbers.push(OP.gradient, id, x0, y0, r0, x1, y1, r1);
		return new RecordedGradient(this, id);
	}

	fillRect(x: number, y: number, width: number, height: number): void {
		this.numbers.push(OP.fillRect, x, y, width, height);
		this.project(x, y, x + width, y + height);
		this.grow(1);
	}

	strokeRect(x: number, y: number, width: number, height: number): void {
		this.numbers.push(OP.strokeRect, x, y, width, height);
		this.project(x, y, x + width, y + height);
		this.grow(this.strokeSpread());
	}

	clearRect(x: number, y: number, width: number, height: number): void {
		this.numbers.push(OP.clearRect, x, y, width, height);
		this.project(x, y, x + width, y + height);
		this.grow(1);
	}

	fillText(text: string, x: number, y: number): void {
		this.numbers.push(OP.fillText, x, y);
		this.refs.push(text);
		this.traceText(text, x, y, false);
	}

	strokeText(text: string, x: number, y: number): void {
		this.numbers.push(OP.strokeText, x, y);
		this.refs.push(text);
		this.traceText(text, x, y, true);
	}

	beginPath(): void {
		this.numbers.push(OP.beginPath);
		this.pathLeft = Infinity;
		this.pathTop = Infinity;
		this.pathRight = -Infinity;
		this.pathBottom = -Infinity;
	}

	closePath(): void {
		this.numbers.push(OP.closePath);
	}

	moveTo(x: number, y: number): void {
		this.numbers.push(OP.moveTo, x, y);
		this.trace(x, y, x, y);
	}

	lineTo(x: number, y: number): void {
		this.numbers.push(OP.lineTo, x, y);
		this.trace(x, y, x, y);
	}

	arc(
		x: number,
		y: number,
		radius: number,
		start: number,
		end: number,
		counterclockwise = false,
	): void {
		this.numbers.push(
			OP.arc,
			x,
			y,
			radius,
			start,
			end,
			counterclockwise ? 1 : 0,
		);
		const reach = Math.abs(radius);
		this.trace(x - reach, y - reach, x + reach, y + reach);
	}

	fill(path?: Path2D, rule?: CanvasFillRule): void {
		if (path) {
			this.numbers.push(OP.fillPath);
			this.refs.push(path, rule ?? "nonzero");
			const bounds = this.paths.get(path);
			if (bounds) {
				this.project(bounds.left, bounds.top, bounds.right, bounds.bottom);
				this.grow(1);
			} else {
				this.unbound();
			}
		} else {
			this.numbers.push(OP.fill);
			this.loadPath();
			this.grow(1);
		}
	}

	stroke(): void {
		this.numbers.push(OP.stroke);
		this.loadPath();
		this.grow(this.strokeSpread());
	}

	save(): void {
		this.stack.push({ ...this.state });
		this.numbers.push(OP.save);
	}

	restore(): void {
		const previous = this.stack.pop();
		if (previous) {
			this.state = previous;
		}
		this.numbers.push(OP.restore);
	}

	translate(x: number, y: number): void {
		const state = this.state;
		state.e += state.a * x + state.c * y;
		state.f += state.b * x + state.d * y;
		this.numbers.push(OP.translate, x, y);
	}

	scale(x: number, y: number): void {
		const state = this.state;
		state.a *= x;
		state.b *= x;
		state.c *= y;
		state.d *= y;
		this.numbers.push(OP.scale, x, y);
	}

	rotate(angle: number): void {
		const state = this.state;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const { a, b, c, d } = state;
		state.a = a * cos + c * sin;
		state.b = b * cos + d * sin;
		state.c = c * cos - a * sin;
		state.d = d * cos - b * sin;
		this.numbers.push(OP.rotate, angle);
	}

	setTransform(
		a: number,
		b: number,
		c: number,
		d: number,
		e: number,
		f: number,
	): void {
		const state = this.state;
		state.a = a;
		state.b = b;
		state.c = c;
		state.d = d;
		state.e = e;
		state.f = f;
		this.numbers.push(OP.setTransform, a, b, c, d, e, f);
	}

	drawImage(image: CanvasImageSource, x: number, y: number): void;
	drawImage(
		image: CanvasImageSource,
		x: number,
		y: number,
		width: number,
		height: number,
	): void;
	drawImage(
		image: CanvasImageSource,
		x: number,
		y: number,
		width?: number,
		height?: number,
	): void {
		this.refs.push(image);
		if (width === undefined || height === undefined) {
			this.numbers.push(OP.drawImage, x, y);
			const size = image as { width?: unknown; height?: unknown };
			if (typeof size.width === "number" && typeof size.height === "number") {
				this.project(x, y, x + size.width, y + size.height);
				this.grow(1);
			} else {
				this.unbound();
			}
		} else {
			this.numbers.push(OP.drawImageSized, x, y, width, height);
			this.project(x, y, x + width, y + height);
			this.grow(1);
		}
	}

	private openSegment(): void {
		let segment = this.segments[this.segmentCount];
		if (!segment) {
			segment = emptySegment(this.state);
			this.segments[this.segmentCount] = segment;
		} else {
			Object.assign(segment.start, this.state);
		}
		segment.numbers = this.numbers.length;
		segment.refs = this.refs.length;
		segment.depth = this.stack.length;
		segment.left = Infinity;
		segment.top = Infinity;
		segment.right = -Infinity;
		segment.bottom = -Infinity;
		this.current = segment;
		this.segmentCount += 1;
	}

	private closeSegment(): void {
		const segment = this.current;
		segment.numbersEnd = this.numbers.length;
		segment.refsEnd = this.refs.length;
		segment.depthEnd = this.stack.length;
	}

	private swap(): void {
		const numbers = this.previousNumbers;
		const refs = this.previousRefs;
		const segments = this.previousSegments;
		this.previousNumbers = this.numbers;
		this.previousRefs = this.refs;
		this.previousSegments = this.segments;
		this.previousCount = this.segmentCount;
		this.numbers = numbers;
		this.refs = refs;
		this.segments = segments;
	}

	private sameSegment(segment: Segment, previous: Segment): boolean {
		if (
			segment.depth !== 0 ||
			previous.depth !== 0 ||
			segment.numbersEnd - segment.numbers !==
				previous.numbersEnd - previous.numbers ||
			segment.refsEnd - segment.refs !== previous.refsEnd - previous.refs ||
			!sameState(segment.start, previous.start)
		) {
			return false;
		}
		const numbers = this.numbers;
		const before = this.previousNumbers;
		const shift = previous.numbers - segment.numbers;
		for (let index = segment.numbers; index < segment.numbersEnd; index += 1) {
			const left = numbers[index];
			const right = before[index + shift];
			if (left !== right && !(Number.isNaN(left) && Number.isNaN(right))) {
				return false;
			}
		}
		const refs = this.refs;
		const earlier = this.previousRefs;
		const offset = previous.refs - segment.refs;
		for (let index = segment.refs; index < segment.refsEnd; index += 1) {
			if (refs[index] !== earlier[index + offset]) {
				return false;
			}
		}
		return true;
	}

	private addRegion(segment: Segment, width: number, height: number): void {
		if (segment.left > segment.right || segment.top > segment.bottom) {
			return;
		}
		const left = Math.max(0, Math.floor(segment.left) - REGION_MARGIN);
		const top = Math.max(0, Math.floor(segment.top) - REGION_MARGIN);
		const right = Math.min(width, Math.ceil(segment.right) + REGION_MARGIN);
		const bottom = Math.min(height, Math.ceil(segment.bottom) + REGION_MARGIN);
		if (right <= left || bottom <= top) {
			return;
		}
		this.insertRegion(left, top, right, bottom);
		while (this.regions.length > MAX_REGIONS) {
			this.mergeClosestRegions();
		}
	}

	private insertRegion(
		left: number,
		top: number,
		right: number,
		bottom: number,
	): void {
		const regions = this.regions;
		let index = 0;
		while (index < regions.length) {
			const region = regions[index];
			if (
				region.left - MERGE_GAP <= right &&
				left <= region.right + MERGE_GAP &&
				region.top - MERGE_GAP <= bottom &&
				top <= region.bottom + MERGE_GAP
			) {
				left = Math.min(left, region.left);
				top = Math.min(top, region.top);
				right = Math.max(right, region.right);
				bottom = Math.max(bottom, region.bottom);
				regions[index] = regions[regions.length - 1];
				regions.pop();
				index = 0;
			} else {
				index += 1;
			}
		}
		regions.push({ left, top, right, bottom });
	}

	private mergeClosestRegions(): void {
		const regions = this.regions;
		let best = Infinity;
		let first = 0;
		let second = 1;
		for (let i = 0; i < regions.length; i += 1) {
			for (let j = i + 1; j < regions.length; j += 1) {
				const a = regions[i];
				const b = regions[j];
				const waste =
					(Math.max(a.right, b.right) - Math.min(a.left, b.left)) *
						(Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top)) -
					(a.right - a.left) * (a.bottom - a.top) -
					(b.right - b.left) * (b.bottom - b.top);
				if (waste < best) {
					best = waste;
					first = i;
					second = j;
				}
			}
		}
		const a = regions[first];
		const b = regions[second];
		regions.splice(second, 1);
		regions.splice(first, 1);
		this.insertRegion(
			Math.min(a.left, b.left),
			Math.min(a.top, b.top),
			Math.max(a.right, b.right),
			Math.max(a.bottom, b.bottom),
		);
	}

	private touches(segment: Segment): boolean {
		for (const region of this.regions) {
			if (
				segment.left < region.right &&
				segment.right > region.left &&
				segment.top < region.bottom &&
				segment.bottom > region.top
			) {
				return true;
			}
		}
		return false;
	}

	private measure(font: string, text: string): number {
		let widths = this.widths.get(font);
		let width = widths?.get(text);
		if (width !== undefined) {
			return width;
		}
		const previous = this.target.font;
		this.target.font = font;
		width = this.target.measureText(text).width;
		this.target.font = previous;
		if (this.measured >= MEASURE_CACHE_LIMIT) {
			this.widths.clear();
			this.measured = 0;
			widths = undefined;
		}
		if (!widths) {
			widths = new Map();
			this.widths.set(font, widths);
		}
		widths.set(text, width);
		this.measured += 1;
		return width;
	}

	private fontSize(font: string): number {
		let size = this.sizes.get(font);
		if (size === undefined) {
			const match = /(\d*\.?\d+)px/.exec(font);
			size = match ? Number(match[1]) : FALLBACK_FONT_SIZE;
			if (this.sizes.size >= FONT_CACHE_LIMIT) {
				this.sizes.clear();
			}
			this.sizes.set(font, size);
		}
		return size;
	}

	private project(x0: number, y0: number, x1: number, y1: number): void {
		const { a, b, c, d, e, f } = this.state;
		const ax0 = a * x0;
		const ax1 = a * x1;
		const cy0 = c * y0;
		const cy1 = c * y1;
		const bx0 = b * x0;
		const bx1 = b * x1;
		const dy0 = d * y0;
		const dy1 = d * y1;
		this.boxLeft = Math.min(ax0, ax1) + Math.min(cy0, cy1) + e;
		this.boxRight = Math.max(ax0, ax1) + Math.max(cy0, cy1) + e;
		this.boxTop = Math.min(bx0, bx1) + Math.min(dy0, dy1) + f;
		this.boxBottom = Math.max(bx0, bx1) + Math.max(dy0, dy1) + f;
	}

	private trace(x0: number, y0: number, x1: number, y1: number): void {
		this.project(x0, y0, x1, y1);
		this.pathLeft = Math.min(this.pathLeft, this.boxLeft);
		this.pathTop = Math.min(this.pathTop, this.boxTop);
		this.pathRight = Math.max(this.pathRight, this.boxRight);
		this.pathBottom = Math.max(this.pathBottom, this.boxBottom);
	}

	private loadPath(): void {
		this.boxLeft = this.pathLeft;
		this.boxTop = this.pathTop;
		this.boxRight = this.pathRight;
		this.boxBottom = this.pathBottom;
	}

	private traceText(text: string, x: number, y: number, stroke: boolean): void {
		const state = this.state;
		const size = this.fontSize(state.font);
		const width = this.measure(state.font, text);
		const align = state.textAlign;
		const start =
			align === "center"
				? x - width / 2
				: align === "right" || align === "end"
					? x - width
					: x;
		const baseline = state.textBaseline;
		const above =
			baseline === "middle"
				? size
				: baseline === "alphabetic"
					? size * 1.2
					: size * 1.5;
		const below =
			baseline === "middle"
				? size
				: baseline === "alphabetic"
					? size * 0.6
					: size * 1.5;
		const outline = stroke ? Math.abs(state.lineWidth) : 0;
		const slack = size * 0.5 + outline;
		this.project(
			start - slack,
			y - above - outline,
			start + width + slack,
			y + below + outline,
		);
		this.grow(1);
	}

	private strokeSpread(): number {
		const state = this.state;
		const half =
			(Math.abs(state.lineWidth) / 2) *
			Math.max(Math.hypot(state.a, state.b), Math.hypot(state.c, state.d));
		return half * (state.lineJoin === "miter" ? 10 : 1.5) + 1;
	}

	private unbound(): void {
		const segment = this.current;
		segment.left = -Infinity;
		segment.top = -Infinity;
		segment.right = Infinity;
		segment.bottom = Infinity;
	}

	private grow(pad: number): void {
		const state = this.state;
		const left = this.boxLeft;
		const top = this.boxTop;
		const right = this.boxRight;
		const bottom = this.boxBottom;
		if (
			state.filter !== "none" ||
			Number.isNaN(left) ||
			Number.isNaN(top) ||
			Number.isNaN(right) ||
			Number.isNaN(bottom)
		) {
			this.unbound();
			return;
		}
		if (left > right || top > bottom) {
			return;
		}
		const spread =
			pad +
			(state.shadowBlur > 0 && state.shadowColor !== TRANSPARENT
				? state.shadowBlur * 2
				: 0);
		const segment = this.current;
		segment.left = Math.min(segment.left, left - spread);
		segment.top = Math.min(segment.top, top - spread);
		segment.right = Math.max(segment.right, right + spread);
		segment.bottom = Math.max(segment.bottom, bottom + spread);
	}

	private apply(state: DrawState): void {
		const context = this.target;
		context.setTransform(state.a, state.b, state.c, state.d, state.e, state.f);
		context.fillStyle =
			typeof state.fillStyle === "string"
				? state.fillStyle
				: (this.gradients[state.fillStyle.id] ?? this.defaults.fillStyle);
		context.strokeStyle = state.strokeStyle;
		context.lineWidth = state.lineWidth;
		context.font = state.font;
		context.textAlign = state.textAlign;
		context.textBaseline = state.textBaseline;
		context.globalAlpha = state.globalAlpha;
		context.lineJoin = state.lineJoin;
		context.lineCap = state.lineCap;
		context.filter = state.filter;
		context.shadowColor = state.shadowColor;
		context.shadowBlur = state.shadowBlur;
		context.setLineDash(state.lineDash);
	}

	private replay(width: number, height: number): void {
		const context = this.target;
		const numbers = this.numbers;
		const refs = this.refs;
		const gradients = this.gradients;
		const everything = this.everything;
		gradients.length = 0;
		context.save();
		this.apply(this.defaults);
		if (everything) {
			if (width > 0 && height > 0) {
				context.clearRect(0, 0, width, height);
			}
		} else {
			context.beginPath();
			for (const region of this.regions) {
				context.rect(
					region.left,
					region.top,
					region.right - region.left,
					region.bottom - region.top,
				);
			}
			context.clip();
			for (const region of this.regions) {
				context.clearRect(
					region.left,
					region.top,
					region.right - region.left,
					region.bottom - region.top,
				);
			}
			context.beginPath();
		}
		let at = 0;
		let ref = 0;
		let depth = 0;
		let stale = false;
		for (let index = 0; index < this.segmentCount; index += 1) {
			const segment = this.segments[index];
			const end = segment.numbersEnd;
			const active = everything || this.touches(segment);
			if (!active && segment.depth === 0 && segment.depthEnd === 0) {
				while (at < end) {
					const op = numbers[at];
					if (op === OP.gradient) {
						gradients[numbers[at + 1]] = context.createRadialGradient(
							numbers[at + 2],
							numbers[at + 3],
							numbers[at + 4],
							numbers[at + 5],
							numbers[at + 6],
							numbers[at + 7],
						);
					} else if (op === OP.gradientStop) {
						gradients[numbers[at + 1]]?.addColorStop(
							numbers[at + 2],
							refs[ref] as string,
						);
					}
					if (op === OP.lineDash) {
						at += 2 + numbers[at + 1];
					} else {
						at += 1 + NUMBER_ARITY[op];
						ref += REF_ARITY[op];
					}
				}
				stale = true;
				continue;
			}
			if (stale) {
				this.apply(segment.start);
				stale = false;
			}
			while (at < end) {
				const op = numbers[at];
				at += 1;
				switch (op) {
					case OP.fillStyle:
						context.fillStyle = refs[ref] as string;
						break;
					case OP.fillGradient:
						context.fillStyle = gradients[numbers[at]];
						break;
					case OP.strokeStyle:
						context.strokeStyle = refs[ref] as string;
						break;
					case OP.lineWidth:
						context.lineWidth = numbers[at];
						break;
					case OP.font:
						context.font = refs[ref] as string;
						break;
					case OP.textAlign:
						context.textAlign = refs[ref] as CanvasTextAlign;
						break;
					case OP.textBaseline:
						context.textBaseline = refs[ref] as CanvasTextBaseline;
						break;
					case OP.globalAlpha:
						context.globalAlpha = numbers[at];
						break;
					case OP.lineJoin:
						context.lineJoin = refs[ref] as CanvasLineJoin;
						break;
					case OP.lineCap:
						context.lineCap = refs[ref] as CanvasLineCap;
						break;
					case OP.filter:
						context.filter = refs[ref] as string;
						break;
					case OP.shadowColor:
						context.shadowColor = refs[ref] as string;
						break;
					case OP.shadowBlur:
						context.shadowBlur = numbers[at];
						break;
					case OP.lineDash: {
						const count = numbers[at];
						context.setLineDash(numbers.slice(at + 1, at + 1 + count));
						at += 1 + count;
						continue;
					}
					case OP.fillRect:
						if (active) {
							context.fillRect(
								numbers[at],
								numbers[at + 1],
								numbers[at + 2],
								numbers[at + 3],
							);
						}
						break;
					case OP.strokeRect:
						if (active) {
							context.strokeRect(
								numbers[at],
								numbers[at + 1],
								numbers[at + 2],
								numbers[at + 3],
							);
						}
						break;
					case OP.clearRect:
						if (active) {
							context.clearRect(
								numbers[at],
								numbers[at + 1],
								numbers[at + 2],
								numbers[at + 3],
							);
						}
						break;
					case OP.fillText:
						if (active) {
							context.fillText(
								refs[ref] as string,
								numbers[at],
								numbers[at + 1],
							);
						}
						break;
					case OP.strokeText:
						if (active) {
							context.strokeText(
								refs[ref] as string,
								numbers[at],
								numbers[at + 1],
							);
						}
						break;
					case OP.beginPath:
						context.beginPath();
						break;
					case OP.closePath:
						context.closePath();
						break;
					case OP.moveTo:
						context.moveTo(numbers[at], numbers[at + 1]);
						break;
					case OP.lineTo:
						context.lineTo(numbers[at], numbers[at + 1]);
						break;
					case OP.arc:
						context.arc(
							numbers[at],
							numbers[at + 1],
							numbers[at + 2],
							numbers[at + 3],
							numbers[at + 4],
							numbers[at + 5] === 1,
						);
						break;
					case OP.fill:
						if (active) {
							context.fill();
						}
						break;
					case OP.fillPath:
						if (active) {
							context.fill(
								refs[ref] as Path2D,
								refs[ref + 1] as CanvasFillRule,
							);
						}
						break;
					case OP.stroke:
						if (active) {
							context.stroke();
						}
						break;
					case OP.save:
						context.save();
						depth += 1;
						break;
					case OP.restore:
						if (depth > 0) {
							context.restore();
							depth -= 1;
						}
						break;
					case OP.translate:
						context.translate(numbers[at], numbers[at + 1]);
						break;
					case OP.scale:
						context.scale(numbers[at], numbers[at + 1]);
						break;
					case OP.rotate:
						context.rotate(numbers[at]);
						break;
					case OP.setTransform:
						context.setTransform(
							numbers[at],
							numbers[at + 1],
							numbers[at + 2],
							numbers[at + 3],
							numbers[at + 4],
							numbers[at + 5],
						);
						break;
					case OP.drawImage:
						if (active) {
							context.drawImage(
								refs[ref] as CanvasImageSource,
								numbers[at],
								numbers[at + 1],
							);
						}
						break;
					case OP.drawImageSized:
						if (active) {
							context.drawImage(
								refs[ref] as CanvasImageSource,
								numbers[at],
								numbers[at + 1],
								numbers[at + 2],
								numbers[at + 3],
							);
						}
						break;
					case OP.gradient:
						gradients[numbers[at]] = context.createRadialGradient(
							numbers[at + 1],
							numbers[at + 2],
							numbers[at + 3],
							numbers[at + 4],
							numbers[at + 5],
							numbers[at + 6],
						);
						break;
					case OP.gradientStop:
						gradients[numbers[at]]?.addColorStop(
							numbers[at + 1],
							refs[ref] as string,
						);
						break;
					default:
						at = numbers.length;
						continue;
				}
				at += NUMBER_ARITY[op];
				ref += REF_ARITY[op];
			}
		}
		while (depth > 0) {
			context.restore();
			depth -= 1;
		}
		context.restore();
	}
}
