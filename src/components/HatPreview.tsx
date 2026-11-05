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
