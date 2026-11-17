import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n += 1) {
		let c = n;
		for (let k = 0; k < 8; k += 1) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(bytes: Uint8Array): number {
	let c = 0xffffffff;
	for (let i = 0; i < bytes.length; i += 1) {
		c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length, false);
	out.set(new TextEncoder().encode(type), 4);
	out.set(data, 8);
	view.setUint32(
		8 + data.length,
		crc32(out.subarray(4, 8 + data.length)),
		false,
	);
	return out;
}

export function encodeRgbaToPng(
	width: number,
	height: number,
	rgba: Uint8Array | Uint8ClampedArray,
): Uint8Array {
	const stride = width * 4;
	const raw = new Uint8Array((stride + 1) * height);
	for (let y = 0; y < height; y += 1) {
		const rowStart = y * (stride + 1);
		raw[rowStart] = 0;
		raw.set(rgba.subarray(y * stride, (y + 1) * stride), rowStart + 1);
	}
	const ihdr = new Uint8Array(13);
	const ihdrView = new DataView(ihdr.buffer);
	ihdrView.setUint32(0, width, false);
	ihdrView.setUint32(4, height, false);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const idat = deflateSync(raw, { level: 6 });
	const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
	const chunks = [
		sig,
		pngChunk("IHDR", ihdr),
		pngChunk("IDAT", new Uint8Array(idat)),
		pngChunk("IEND", new Uint8Array(0)),
	];
	const total = chunks.reduce((sum, c) => sum + c.length, 0);
	const png = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		png.set(chunk, offset);
		offset += chunk.length;
	}
	return png;
}

function parseColor(style: string): [number, number, number, number] {
	const s = style.trim().toLowerCase();
	if (s.startsWith("#")) {
		const hex = s.slice(1);
		if (hex.length === 3) {
			return [
				Number.parseInt(hex[0] + hex[0], 16),
				Number.parseInt(hex[1] + hex[1], 16),
				Number.parseInt(hex[2] + hex[2], 16),
				255,
			];
		}
		if (hex.length >= 6) {
			return [
				Number.parseInt(hex.slice(0, 2), 16),
				Number.parseInt(hex.slice(2, 4), 16),
				Number.parseInt(hex.slice(4, 6), 16),
				hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255,
			];
		}
	}
	const match = s.match(/rgba?\(([^)]+)\)/);
	if (match) {
		const parts = match[1].split(",").map((p) => Number.parseFloat(p.trim()));
		return [
			Math.round(parts[0] ?? 0),
			Math.round(parts[1] ?? 0),
			Math.round(parts[2] ?? 0),
			parts.length >= 4 ? Math.round((parts[3] ?? 1) * 255) : 255,
		];
	}
	return [0, 0, 0, 255];
}

class ShimImageData {
	readonly width: number;
	readonly height: number;
	readonly data: Uint8ClampedArray;
	constructor(
		widthOrData: number | Uint8ClampedArray,
		heightOrWidth: number,
		maybeHeight?: number,
	) {
		if (typeof widthOrData === "number") {
			this.width = widthOrData;
			this.height = heightOrWidth;
			this.data = new Uint8ClampedArray(this.width * this.height * 4);
		} else {
			this.data = widthOrData;
			this.width = heightOrWidth;
			this.height =
				maybeHeight ?? Math.floor(widthOrData.length / (4 * heightOrWidth));
		}
	}
}

interface PixelSource {
	width: number;
	height: number;
	pixels?: Uint8ClampedArray;
	data?: ArrayLike<number>;
	ensureBuffer?: () => Uint8ClampedArray;
}

class ShimCanvas {
	width = 1;
	height = 1;
	private pixels = new Uint8ClampedArray(4);
	private allocatedW = 1;
	private allocatedH = 1;

	ensureBuffer(): Uint8ClampedArray {
		const w = Math.max(1, Math.floor(this.width));
		const h = Math.max(1, Math.floor(this.height));
		if (w !== this.allocatedW || h !== this.allocatedH) {
			this.allocatedW = w;
			this.allocatedH = h;
			this.pixels = new Uint8ClampedArray(w * h * 4);
		}
		return this.pixels;
	}

	getContext() {
		let tx = 0;
		let ty = 0;
		let sx = 1;
		let sy = 1;
		const stack: [number, number, number, number][] = [];
		let fillStyle = "#000000";
		let strokeStyle = "#000000";
		let lineWidth = 1;
		const canvas = this;

		return {
			canvas,
			get fillStyle() {
				return fillStyle;
			},
			set fillStyle(value: string) {
				fillStyle = value;
			},
			get strokeStyle() {
				return strokeStyle;
			},
			set strokeStyle(value: string) {
				strokeStyle = value;
			},
			get lineWidth() {
				return lineWidth;
			},
			set lineWidth(value: number) {
				lineWidth = value;
			},
			beginPath() {},
			closePath() {},
			moveTo() {},
			lineTo() {},
			arc() {},
			stroke() {},
			fill() {},
			save() {
				stack.push([tx, ty, sx, sy]);
			},
			restore() {
				const top = stack.pop();
				if (top) [tx, ty, sx, sy] = top;
			},
			translate(x: number, y: number) {
				tx += x * sx;
				ty += y * sy;
			},
			scale(x: number, y: number) {
				sx *= x;
				sy *= y;
			},
			createImageData(w: number, h: number) {
				return new ShimImageData(w, h);
			},
			getImageData(gx: number, gy: number, gw: number, gh: number) {
				const buf = canvas.ensureBuffer();
				const cw = Math.max(1, Math.floor(canvas.width));
				const ch = Math.max(1, Math.floor(canvas.height));
				const out = new ShimImageData(gw, gh);
				for (let y = 0; y < gh; y += 1) {
					const srcY = gy + y;
					if (srcY < 0 || srcY >= ch) continue;
					for (let x = 0; x < gw; x += 1) {
						const srcX = gx + x;
						if (srcX < 0 || srcX >= cw) continue;
						const src = (srcY * cw + srcX) * 4;
						const dst = (y * gw + x) * 4;
						out.data[dst] = buf[src];
						out.data[dst + 1] = buf[src + 1];
						out.data[dst + 2] = buf[src + 2];
						out.data[dst + 3] = buf[src + 3];
					}
				}
				return out;
			},
			putImageData(
				img: { width: number; height: number; data: ArrayLike<number> },
				dx = 0,
				dy = 0,
			) {
				const buf = canvas.ensureBuffer();
				const cw = Math.max(1, Math.floor(canvas.width));
				const ch = Math.max(1, Math.floor(canvas.height));
				for (let y = 0; y < img.height; y += 1) {
					const destY = dy + y;
					if (destY < 0 || destY >= ch) continue;
					for (let x = 0; x < img.width; x += 1) {
						const destX = dx + x;
						if (destX < 0 || destX >= cw) continue;
						const src = (y * img.width + x) * 4;
						const dst = (destY * cw + destX) * 4;
						buf[dst] = img.data[src];
						buf[dst + 1] = img.data[src + 1];
						buf[dst + 2] = img.data[src + 2];
						buf[dst + 3] = img.data[src + 3];
					}
				}
			},
			fillRect(rx: number, ry: number, rw: number, rh: number) {
				const buf = canvas.ensureBuffer();
				const cw = Math.max(1, Math.floor(canvas.width));
				const ch = Math.max(1, Math.floor(canvas.height));
				const [r, g, b, a] = parseColor(fillStyle);
				const x0 = Math.max(0, Math.floor(rx));
				const y0 = Math.max(0, Math.floor(ry));
				const x1 = Math.min(cw, Math.floor(rx + rw));
				const y1 = Math.min(ch, Math.floor(ry + rh));
				for (let y = y0; y < y1; y += 1) {
					for (let x = x0; x < x1; x += 1) {
						const dst = (y * cw + x) * 4;
						buf[dst] = r;
						buf[dst + 1] = g;
						buf[dst + 2] = b;
						buf[dst + 3] = a;
					}
				}
			},
			clearRect(rx: number, ry: number, rw: number, rh: number) {
				const buf = canvas.ensureBuffer();
				const cw = Math.max(1, Math.floor(canvas.width));
				const ch = Math.max(1, Math.floor(canvas.height));
				const x0 = Math.max(0, Math.floor(rx));
				const y0 = Math.max(0, Math.floor(ry));
				const x1 = Math.min(cw, Math.floor(rx + rw));
				const y1 = Math.min(ch, Math.floor(ry + rh));
				for (let y = y0; y < y1; y += 1) {
					for (let x = x0; x < x1; x += 1) {
						const dst = (y * cw + x) * 4;
						buf[dst] = 0;
						buf[dst + 1] = 0;
						buf[dst + 2] = 0;
						buf[dst + 3] = 0;
					}
				}
			},
			drawImage(source: PixelSource, ...args: number[]) {
				const srcData = source.ensureBuffer
					? source.ensureBuffer()
					: (source.pixels ?? source.data);
				if (!srcData) return;
				const buf = canvas.ensureBuffer();
				const cw = Math.max(1, Math.floor(canvas.width));
				const ch = Math.max(1, Math.floor(canvas.height));
				const [srcX0, srcY0, srcW, srcH, dstX0, dstY0, dstW, dstH] =
					args.length >= 8
						? args
						: [
								0,
								0,
								source.width,
								source.height,
								args[0] ?? 0,
								args[1] ?? 0,
								args[2] ?? source.width,
								args[3] ?? source.height,
							];
				const flipX = sx < 0;
				const flipY = sy < 0;
				const absSx = Math.abs(sx);
				const absSy = Math.abs(sy);
				const destStartX = flipX
					? tx - (dstX0 + dstW) * absSx
					: tx + dstX0 * absSx;
				const destStartY = flipY
					? ty - (dstY0 + dstH) * absSy
					: ty + dstY0 * absSy;
				const spanW = dstW * absSx;
				const spanH = dstH * absSy;
				for (let y = 0; y < spanH; y += 1) {
					const destY = Math.floor(destStartY + y);
					if (destY < 0 || destY >= ch) continue;
					const v = (y + 0.5) / spanH;
					const srcY = Math.min(
						source.height - 1,
						Math.max(0, Math.floor(srcY0 + (flipY ? 1 - v : v) * srcH)),
					);
					for (let x = 0; x < spanW; x += 1) {
						const destX = Math.floor(destStartX + x);
						if (destX < 0 || destX >= cw) continue;
						const u = (x + 0.5) / spanW;
						const srcX = Math.min(
							source.width - 1,
							Math.max(0, Math.floor(srcX0 + (flipX ? 1 - u : u) * srcW)),
						);
						const src = (srcY * source.width + srcX) * 4;
						const dst = (destY * cw + destX) * 4;
						buf[dst] = srcData[src];
						buf[dst + 1] = srcData[src + 1];
						buf[dst + 2] = srcData[src + 2];
						buf[dst + 3] = srcData[src + 3];
					}
				}
			},
		};
	}

	toBlob(cb: (blob: Blob | null) => void, type = "image/png"): void {
		const buf = this.ensureBuffer();
		const png = encodeRgbaToPng(
			Math.max(1, Math.floor(this.width)),
			Math.max(1, Math.floor(this.height)),
			buf,
		);
		cb(new Blob([Uint8Array.from(png)], { type }));
	}

	toDataURL(type = "image/png"): string {
		const buf = this.ensureBuffer();
		const png = encodeRgbaToPng(
			Math.max(1, Math.floor(this.width)),
			Math.max(1, Math.floor(this.height)),
			buf,
		);
		return `data:${type};base64,${Buffer.from(png).toString("base64")}`;
	}
}

class ShimFileReader {
	result: ArrayBuffer | string | null = null;
	onloadend: (() => void) | null = null;
	onload: (() => void) | null = null;

	readAsArrayBuffer(blob: Blob): void {
		void blob.arrayBuffer().then((buf) => {
			this.result = buf;
			this.onload?.();
			this.onloadend?.();
		});
	}

	readAsDataURL(blob: Blob): void {
		void blob.arrayBuffer().then((buf) => {
			this.result = `data:${blob.type || "image/png"};base64,${Buffer.from(buf).toString("base64")}`;
			this.onload?.();
			this.onloadend?.();
		});
	}
}

export function installNodeCanvasShim(): void {
	const g = globalThis as Record<string, unknown>;
	if (g.__moldiusCanvasShimInstalled) return;
	g.__moldiusCanvasShimInstalled = true;
	g.HTMLCanvasElement = ShimCanvas;
	g.ImageData = ShimImageData;
	g.FileReader = ShimFileReader;
	g.document = {
		createElement: (tag: string) => (tag === "canvas" ? new ShimCanvas() : {}),
		createElementNS: (_ns: string, tag: string) =>
			tag === "canvas" ? new ShimCanvas() : {},
	};
}
