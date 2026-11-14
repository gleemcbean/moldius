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

const MEASURE_CACHE_LIMIT = 4000;

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
}

function sameNumbers(a: number[], b: number[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let index = 0; index < a.length; index += 1) {
		const left = a[index];
		const right = b[index];
		if (left !== right && !(Number.isNaN(left) && Number.isNaN(right))) {
			return false;
		}
	}
	return true;
}

function sameRefs(a: unknown[], b: unknown[]): boolean {
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

export class HudRecorder {
	private numbers: number[] = [];
	private refs: unknown[] = [];
	private previousNumbers: number[] = [];
	private previousRefs: unknown[] = [];
	private readonly stack: DrawState[] = [];
	private readonly gradients: CanvasGradient[] = [];
	private readonly widths = new Map<string, number>();
	private state: DrawState;
	private gradientCount = 0;
	private dirty = true;

	constructor(private readonly target: CanvasRenderingContext2D) {
		this.state = {
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
			shadowColor: "rgba(0, 0, 0, 0)",
			shadowBlur: 0,
			lineDash: [],
		};
	}

	begin(): void {
		this.numbers.length = 0;
		this.refs.length = 0;
		this.gradientCount = 0;
		this.stack.length = 0;
	}

	commit(): boolean {
		const changed =
			this.dirty ||
			!sameNumbers(this.numbers, this.previousNumbers) ||
			!sameRefs(this.refs, this.previousRefs);
		if (changed) {
			this.replay();
		}
		const numbers = this.previousNumbers;
		const refs = this.previousRefs;
		this.previousNumbers = this.numbers;
		this.previousRefs = this.refs;
		this.numbers = numbers;
		this.refs = refs;
		this.dirty = false;
		return changed;
	}

	invalidate(): void {
		this.dirty = true;
	}

	forgetMeasures(): void {
		this.widths.clear();
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
		const font = this.state.font;
		const key = `${font}\u0000${text}`;
		let width = this.widths.get(key);
		if (width === undefined) {
			const previous = this.target.font;
			this.target.font = font;
			width = this.target.measureText(text).width;
			this.target.font = previous;
			if (this.widths.size >= MEASURE_CACHE_LIMIT) {
				this.widths.clear();
			}
			this.widths.set(key, width);
		}
		return { width };
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
	}

	strokeRect(x: number, y: number, width: number, height: number): void {
		this.numbers.push(OP.strokeRect, x, y, width, height);
	}

	clearRect(x: number, y: number, width: number, height: number): void {
		this.numbers.push(OP.clearRect, x, y, width, height);
	}

	fillText(text: string, x: number, y: number): void {
		this.numbers.push(OP.fillText, x, y);
		this.refs.push(text);
	}

	strokeText(text: string, x: number, y: number): void {
		this.numbers.push(OP.strokeText, x, y);
		this.refs.push(text);
	}

	beginPath(): void {
		this.numbers.push(OP.beginPath);
	}

	closePath(): void {
		this.numbers.push(OP.closePath);
	}

	moveTo(x: number, y: number): void {
		this.numbers.push(OP.moveTo, x, y);
	}

	lineTo(x: number, y: number): void {
		this.numbers.push(OP.lineTo, x, y);
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
	}

	fill(path?: Path2D, rule?: CanvasFillRule): void {
		if (path) {
			this.numbers.push(OP.fillPath);
			this.refs.push(path, rule ?? "nonzero");
		} else {
			this.numbers.push(OP.fill);
		}
	}

	stroke(): void {
		this.numbers.push(OP.stroke);
	}

	save(): void {
		this.stack.push({ ...this.state, lineDash: [...this.state.lineDash] });
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
		this.numbers.push(OP.translate, x, y);
	}

	scale(x: number, y: number): void {
		this.numbers.push(OP.scale, x, y);
	}

	rotate(angle: number): void {
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
		} else {
			this.numbers.push(OP.drawImageSized, x, y, width, height);
		}
	}

	private replay(): void {
		const context = this.target;
		const numbers = this.numbers;
		const refs = this.refs;
		const gradients = this.gradients;
		gradients.length = 0;
		let at = 0;
		let ref = 0;
		const next = () => numbers[at++];
		const take = () => refs[ref++];
		while (at < numbers.length) {
			switch (next()) {
				case OP.fillStyle:
					context.fillStyle = take() as string;
					break;
				case OP.fillGradient:
					context.fillStyle = gradients[next()];
					break;
				case OP.strokeStyle:
					context.strokeStyle = take() as string;
					break;
				case OP.lineWidth:
					context.lineWidth = next();
					break;
				case OP.font:
					context.font = take() as string;
					break;
				case OP.textAlign:
					context.textAlign = take() as CanvasTextAlign;
					break;
				case OP.textBaseline:
					context.textBaseline = take() as CanvasTextBaseline;
					break;
				case OP.globalAlpha:
					context.globalAlpha = next();
					break;
				case OP.lineJoin:
					context.lineJoin = take() as CanvasLineJoin;
					break;
				case OP.lineCap:
					context.lineCap = take() as CanvasLineCap;
					break;
				case OP.filter:
					context.filter = take() as string;
					break;
				case OP.shadowColor:
					context.shadowColor = take() as string;
					break;
				case OP.shadowBlur:
					context.shadowBlur = next();
					break;
				case OP.lineDash: {
					const count = next();
					context.setLineDash(numbers.slice(at, at + count));
					at += count;
					break;
				}
				case OP.fillRect:
					context.fillRect(next(), next(), next(), next());
					break;
				case OP.strokeRect:
					context.strokeRect(next(), next(), next(), next());
					break;
				case OP.clearRect:
					context.clearRect(next(), next(), next(), next());
					break;
				case OP.fillText:
					context.fillText(take() as string, next(), next());
					break;
				case OP.strokeText:
					context.strokeText(take() as string, next(), next());
					break;
				case OP.beginPath:
					context.beginPath();
					break;
				case OP.closePath:
					context.closePath();
					break;
				case OP.moveTo:
					context.moveTo(next(), next());
					break;
				case OP.lineTo:
					context.lineTo(next(), next());
					break;
				case OP.arc:
					context.arc(next(), next(), next(), next(), next(), next() === 1);
					break;
				case OP.fill:
					context.fill();
					break;
				case OP.fillPath:
					context.fill(take() as Path2D, take() as CanvasFillRule);
					break;
				case OP.stroke:
					context.stroke();
					break;
				case OP.save:
					context.save();
					break;
				case OP.restore:
					context.restore();
					break;
				case OP.translate:
					context.translate(next(), next());
					break;
				case OP.scale:
					context.scale(next(), next());
					break;
				case OP.rotate:
					context.rotate(next());
					break;
				case OP.setTransform:
					context.setTransform(next(), next(), next(), next(), next(), next());
					break;
				case OP.drawImage:
					context.drawImage(take() as CanvasImageSource, next(), next());
					break;
				case OP.drawImageSized:
					context.drawImage(
						take() as CanvasImageSource,
						next(),
						next(),
						next(),
						next(),
					);
					break;
				case OP.gradient: {
					const id = next();
					gradients[id] = context.createRadialGradient(
						next(),
						next(),
						next(),
						next(),
						next(),
						next(),
					);
					break;
				}
				case OP.gradientStop: {
					const id = next();
					gradients[id]?.addColorStop(next(), take() as string);
					break;
				}
				default:
					at = numbers.length;
			}
		}
	}
}
