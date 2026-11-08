import type { HatPattern } from "@shared/hatPatterns";
import { hashString } from "@shared/random";
import { useEffect, useRef } from "react";
import {
	capRecipe,
	capTextureKey,
} from "../features/world/textures/creatureTextures";
import { PixelPainter } from "../features/world/textures/PixelPainter";
import styles from "./HatPreview.module.scss";

const WIDTH = 64;
const HEIGHT = 36;
const DOME_RADIUS = 31;
const DOME_BASE = HEIGHT - 4;
const DOME_TILT = 0.6;
/** Le chapeau enroule la texture deux fois : voir latheGeometry dans MushroomModel. */
const DOME_WRAPS = 2;
const DOME_SAMPLES = 3;
/** Ces motifs rayonnent depuis le sommet : à plat, ils ne ressembleraient à rien. */
const DOME_PATTERNS: ReadonlySet<HatPattern> = new Set(["web", "mycelium"]);

function drawOnDome(
	context: CanvasRenderingContext2D,
	source: HTMLCanvasElement,
): void {
	const from = source.getContext("2d")?.getImageData(0, 0, 64, 32);
	if (!from) {
		return;
	}
	const image = context.createImageData(WIDTH, HEIGHT);
	const cos = Math.cos(DOME_TILT);
	const sin = Math.sin(DOME_TILT);
	for (let y = 0; y < HEIGHT; y += 1) {
		for (let x = 0; x < WIDTH; x += 1) {
			// Plusieurs points par pixel : un fil fin reste continu une fois réduit.
			const sum = [0, 0, 0, 0];
			for (let sub = 0; sub < DOME_SAMPLES * DOME_SAMPLES; sub += 1) {
				const offsetX = ((sub % DOME_SAMPLES) + 0.5) / DOME_SAMPLES;
				const offsetY = (Math.floor(sub / DOME_SAMPLES) + 0.5) / DOME_SAMPLES;
				const nx = (x + offsetX - WIDTH / 2) / DOME_RADIUS;
				const ny = Math.max(0, (DOME_BASE - y - offsetY) / DOME_RADIUS);
				const depth = 1 - nx * nx - ny * ny;
				if (depth < 0) {
					continue;
				}
				const nz = Math.sqrt(depth);
				const up = ny * cos + nz * sin;
				const front = nz * cos - ny * sin;
				const along = Math.atan2(nx, front) / (2 * Math.PI) + 0.5;
				const sourceX = Math.floor(along * DOME_WRAPS * 64) % 64;
				const sourceY = Math.min(
					31,
					Math.floor((Math.acos(Math.min(1, up)) / (Math.PI / 2)) * 32),
				);
				const read = (sourceY * 64 + sourceX) * 4;
				for (let channel = 0; channel < 3; channel += 1) {
					sum[channel] += from.data[read + channel];
				}
				sum[3] += 1;
			}
			if (sum[3] > 0) {
				const write = (y * WIDTH + x) * 4;
				for (let channel = 0; channel < 3; channel += 1) {
					image.data[write + channel] = sum[channel] / sum[3];
				}
				image.data[write + 3] = sum[3] > DOME_SAMPLES ? 255 : 0;
			}
		}
	}
	context.putImageData(image, 0, 0);
}

export function HatPreview({
	color,
	pattern,
	className,
}: {
	color: number;
	pattern: HatPattern;
	className?: string;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const target = canvas.current;
		const context = target?.getContext("2d");
		if (!target || !context) {
			return;
		}
		const painter = new PixelPainter(
			64,
			32,
			hashString(capTextureKey(color, pattern)),
		);
		capRecipe(color, pattern).draw(painter);
		const source = painter.commit();
		context.clearRect(0, 0, WIDTH, HEIGHT);
		if (DOME_PATTERNS.has(pattern)) {
			drawOnDome(context, source);
			return;
		}
		context.save();
		context.beginPath();
		context.ellipse(
			WIDTH / 2,
			HEIGHT - 4,
			WIDTH / 2 - 1,
			HEIGHT - 5,
			0,
			Math.PI,
			Math.PI * 2,
		);
		context.lineTo(WIDTH - 1, HEIGHT - 1);
		context.lineTo(1, HEIGHT - 1);
		context.closePath();
		context.clip();
		context.imageSmoothingEnabled = false;
		context.drawImage(source, 0, 0, WIDTH, HEIGHT);
		context.restore();
	}, [color, pattern]);

	return (
		<canvas
			ref={canvas}
			width={WIDTH}
			height={HEIGHT}
			className={[styles.hat, className ?? ""].join(" ")}
		/>
	);
}
