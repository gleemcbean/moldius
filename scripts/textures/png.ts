import { deflateSync, inflateSync } from "node:zlib";
import type { PixelData } from "./PixelPainter";

const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

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
	for (let index = 0; index < bytes.length; index += 1) {
		c = CRC_TABLE[(c ^ bytes[index]) & 0xff] ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	const view = new DataView(out.buffer);
	view.setUint32(0, data.length, false);
	out.set(new TextEncoder().encode(type), 4);
	out.set(data, 8);
	view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
	return out;
}

function paeth(a: number, b: number, c: number): number {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function filterRow(
	filter: number,
	row: Uint8Array,
	previous: Uint8Array,
	stride: number,
	out: Uint8Array,
): void {
	for (let index = 0; index < row.length; index += 1) {
		const left = index >= stride ? row[index - stride] : 0;
		const up = previous[index];
		const corner = index >= stride ? previous[index - stride] : 0;
		const predictor =
			filter === 1
				? left
				: filter === 2
					? up
					: filter === 3
						? (left + up) >> 1
						: filter === 4
							? paeth(left, up, corner)
							: 0;
		out[index] = (row[index] - predictor) & 255;
	}
}

function channelsFor(pixels: PixelData): 1 | 3 | 4 {
	const { data } = pixels;
	let gray = true;
	for (let index = 0; index < data.length; index += 4) {
		if (data[index + 3] !== 255) {
			return 4;
		}
		if (data[index] !== data[index + 1] || data[index] !== data[index + 2]) {
			gray = false;
		}
	}
	return gray ? 1 : 3;
}

export function encodePng(pixels: PixelData): Uint8Array {
	const { width, height, data } = pixels;
	const channels = channelsFor(pixels);
	const stride = width * channels;
	const raw = new Uint8Array((stride + 1) * height);
	let previous = new Uint8Array(stride);
	const row = new Uint8Array(stride);
	const candidate = new Uint8Array(stride);
	const best = new Uint8Array(stride);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			for (let channel = 0; channel < channels; channel += 1) {
				row[x * channels + channel] = data[(y * width + x) * 4 + channel];
			}
		}
		let bestFilter = 0;
		let bestScore = Number.POSITIVE_INFINITY;
		for (let filter = 0; filter < 5; filter += 1) {
			filterRow(filter, row, previous, channels, candidate);
			let score = 0;
			for (let index = 0; index < stride; index += 1) {
				const value = candidate[index];
				score += value < 128 ? value : 256 - value;
			}
			if (score < bestScore) {
				bestScore = score;
				bestFilter = filter;
				best.set(candidate);
			}
		}
		raw[y * (stride + 1)] = bestFilter;
		raw.set(best, y * (stride + 1) + 1);
		previous = row.slice();
	}
	const header = new Uint8Array(13);
	const view = new DataView(header.buffer);
	view.setUint32(0, width);
	view.setUint32(4, height);
	header[8] = 8;
	header[9] = channels === 1 ? 0 : channels === 3 ? 2 : 6;
	const parts = [
		SIGNATURE,
		chunk("IHDR", header),
		chunk("IDAT", new Uint8Array(deflateSync(raw, { level: 9 }))),
		chunk("IEND", new Uint8Array(0)),
	];
	const png = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		png.set(part, offset);
		offset += part.length;
	}
	return png;
}

export function decodePng(png: Uint8Array): PixelData {
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	let offset = SIGNATURE.length;
	let width = 0;
	let height = 0;
	let colorType = 6;
	const compressed: Uint8Array[] = [];
	while (offset < png.length) {
		const length = view.getUint32(offset);
		const type = new TextDecoder().decode(png.subarray(offset + 4, offset + 8));
		const body = png.subarray(offset + 8, offset + 8 + length);
		if (type === "IHDR") {
			width = view.getUint32(offset + 8);
			height = view.getUint32(offset + 12);
			colorType = body[9];
		} else if (type === "IDAT") {
			compressed.push(body);
		}
		offset += length + 12;
	}
	const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : 4;
	const stride = width * channels;
	const raw = inflateSync(Buffer.concat(compressed));
	const data = new Uint8ClampedArray(width * height * 4);
	let previous = new Uint8Array(stride);
	for (let y = 0; y < height; y += 1) {
		const filter = raw[y * (stride + 1)];
		const row = new Uint8Array(
			raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)),
		);
		for (let index = 0; index < stride; index += 1) {
			const left = index >= channels ? row[index - channels] : 0;
			const up = previous[index];
			const corner = index >= channels ? previous[index - channels] : 0;
			const predictor =
				filter === 1
					? left
					: filter === 2
						? up
						: filter === 3
							? (left + up) >> 1
							: filter === 4
								? paeth(left, up, corner)
								: 0;
			row[index] = (row[index] + predictor) & 255;
		}
		for (let x = 0; x < width; x += 1) {
			const target = (y * width + x) * 4;
			const source = x * channels;
			data[target] = row[source];
			data[target + 1] = row[source + (channels === 1 ? 0 : 1)];
			data[target + 2] = row[source + (channels === 1 ? 0 : 2)];
			data[target + 3] = channels === 4 ? row[source + 3] : 255;
		}
		previous = row;
	}
	return { width, height, data };
}

export function flipRows(pixels: PixelData): PixelData {
	const { width, height, data } = pixels;
	const flipped = new Uint8ClampedArray(data.length);
	const stride = width * 4;
	for (let y = 0; y < height; y += 1) {
		flipped.set(
			data.subarray((height - 1 - y) * stride, (height - y) * stride),
			y * stride,
		);
	}
	return { width, height, data: flipped };
}
