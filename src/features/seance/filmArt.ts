import { FILM_HEIGHT, FILM_WIDTH } from "@shared/minigames/filmRunner";

export const GROUND_Y = 150;
export const INK = "#140b05";
export const LIGHT = "#fff3d2";
export const BORDER = 14;

const TITLE_FONT = "'IM Fell English SC', 'Times New Roman', serif";
const TEXT_FONT = "'IM Fell English', 'Times New Roman', serif";

export interface MushroomPose {
	ducking: boolean;
	airborne: boolean;
	rising: number;
	run: number;
	squash: number;
	tumble: number;
	cap: string;
}

export interface CardLine {
	text: string;
	size: number;
	title?: boolean;
	color?: string;
}

function hash(value: number): number {
	const scaled = Math.sin(value * 127.1 + 311.7) * 43758.5453;

	return scaled - Math.floor(scaled);
}

export function drawPaper(
	context: CanvasRenderingContext2D,
	brightness: number,
): void {
	const light = context.createRadialGradient(
		FILM_WIDTH * 0.5,
		FILM_HEIGHT * 0.42,
		10,
		FILM_WIDTH * 0.5,
		FILM_HEIGHT * 0.5,
		FILM_WIDTH * 0.62,
	);

	light.addColorStop(0, "#f4dca6");
	light.addColorStop(0.45, "#d9b273");
	light.addColorStop(1, "#6e4a24");

	context.fillStyle = light;

	context.fillRect(0, 0, FILM_WIDTH, FILM_HEIGHT);

	context.fillStyle = `rgba(24, 12, 2, ${Math.max(0, 1 - brightness) * 0.9})`;

	context.fillRect(0, 0, FILM_WIDTH, FILM_HEIGHT);
}

export function drawMoon(
	context: CanvasRenderingContext2D,
	time: number,
): void {
	const x = 244;
	const y = 40;
	const halo = context.createRadialGradient(x, y, 6, x, y, 42);

	halo.addColorStop(0, "rgba(255, 246, 220, 0.75)");
	halo.addColorStop(1, "rgba(255, 246, 220, 0)");

	context.fillStyle = halo;

	context.fillRect(x - 42, y - 42, 84, 84);

	context.fillStyle = "#fff6dc";

	context.beginPath();
	context.arc(x, y, 15, 0, Math.PI * 2);
	context.fill();

	context.fillStyle = "rgba(150, 110, 60, 0.25)";

	for (const [dx, dy, radius] of [
		[-5, -3, 3.5],
		[4, 4, 2.5],
		[3, -6, 1.6],
	]) {
		context.beginPath();
		context.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
		context.fill();
	}

	const cloud = (time * 4) % (FILM_WIDTH + 120);

	context.fillStyle = "rgba(90, 60, 30, 0.35)";

	context.beginPath();
	context.ellipse(FILM_WIDTH + 60 - cloud, 46, 38, 6, 0, 0, Math.PI * 2);
	context.ellipse(FILM_WIDTH + 80 - cloud, 41, 22, 5, 0, 0, Math.PI * 2);
	context.fill();
}

function tower(
	context: CanvasRenderingContext2D,
	x: number,
	width: number,
	height: number,
	spire: number,
): void {
	const base = GROUND_Y - 8;

	context.rect(x, base - height, width, height);
	context.moveTo(x - 2, base - height);
	context.lineTo(x + width / 2, base - height - spire);
	context.lineTo(x + width + 2, base - height);
}

function windows(
	context: CanvasRenderingContext2D,
	x: number,
	width: number,
	height: number,
	seed: number,
): void {
	const base = GROUND_Y - 8;

	for (let row = 0; row < 3; row += 1) {
		for (let column = 0; column < 2; column += 1) {
			if (hash(seed * 7 + row * 3 + column) < 0.45) {
				continue;
			}

			context.rect(
				x + width * (0.22 + column * 0.38),
				base - height + 6 + row * 9,
				2.2,
				4,
			);
		}
	}
}

export function drawSkyline(
	context: CanvasRenderingContext2D,
	offset: number,
): void {
	const tile = 120;
	const first = Math.floor(offset / tile) - 1;

	for (let index = first; index < first + 5; index += 1) {
		const x = index * tile - offset;
		const seed = index * 13.7;
		const height = 34 + hash(seed) * 26;
		const width = 22 + hash(seed + 1) * 14;

		context.fillStyle = "rgba(70, 42, 20, 0.42)";

		context.beginPath();
		tower(context, x + 10, width, height, 14 + hash(seed + 2) * 12);
		tower(context, x + 14 + width, width * 1.8, height * 0.62, 8);
		tower(context, x + 18 + width * 2.8, width * 0.7, height * 0.85, 18);
		context.fill();

		context.fillStyle = "rgba(255, 228, 160, 0.55)";

		context.beginPath();
		windows(context, x + 10, width, height, index);
		windows(context, x + 14 + width, width * 1.8, height * 0.62, index + 50);
		context.fill();
	}
}

function deadTree(
	context: CanvasRenderingContext2D,
	x: number,
	height: number,
	seed: number,
): void {
	const branch = (
		fromX: number,
		fromY: number,
		angle: number,
		length: number,
		depth: number,
	) => {
		const toX = fromX + Math.sin(angle) * length;
		const toY = fromY - Math.cos(angle) * length;

		context.lineWidth = Math.max(0.6, depth * 0.9);

		context.beginPath();
		context.moveTo(fromX, fromY);
		context.lineTo(toX, toY);
		context.stroke();

		if (depth > 0) {
			const spread = 0.45 + hash(seed + depth) * 0.3;

			branch(toX, toY, angle - spread, length * 0.68, depth - 1);
			branch(toX, toY, angle + spread * 0.8, length * 0.62, depth - 1);
		}
	};

	branch(x, GROUND_Y, (hash(seed) - 0.5) * 0.2, height, 3);
}

export function drawGraveyard(
	context: CanvasRenderingContext2D,
	offset: number,
): void {
	const tile = 64;
	const first = Math.floor(offset / tile) - 1;

	context.fillStyle = "rgba(38, 22, 10, 0.72)";
	context.strokeStyle = "rgba(38, 22, 10, 0.72)";

	for (let index = first; index < first + 7; index += 1) {
		const x = index * tile - offset;
		const kind = hash(index * 3.3);

		if (kind < 0.35) {
			deadTree(context, x + 30, 20 + hash(index) * 14, index);
		} else if (kind < 0.7) {
			context.beginPath();
			context.moveTo(x + 18, GROUND_Y);
			context.lineTo(x + 18, GROUND_Y - 12);
			context.arc(x + 24, GROUND_Y - 12, 6, Math.PI, 0);
			context.lineTo(x + 30, GROUND_Y);
			context.fill();

			context.fillRect(x + 40, GROUND_Y - 16, 2, 16);
			context.fillRect(x + 36, GROUND_Y - 12, 10, 2);
		} else {
			for (let post = 0; post < 6; post += 1) {
				const postX = x + 8 + post * 8;

				context.fillRect(postX, GROUND_Y - 13, 1.4, 13);
				context.beginPath();
				context.moveTo(postX - 1, GROUND_Y - 13);
				context.lineTo(postX + 0.7, GROUND_Y - 16);
				context.lineTo(postX + 2.4, GROUND_Y - 13);
				context.fill();
			}

			context.fillRect(x + 6, GROUND_Y - 10, 48, 1);
		}
	}
}

export function drawGround(
	context: CanvasRenderingContext2D,
	offset: number,
): void {
	context.fillStyle = INK;

	context.fillRect(0, GROUND_Y, FILM_WIDTH, FILM_HEIGHT - GROUND_Y);

	context.beginPath();

	const start = Math.floor(offset / 3) * 3;

	for (let x = start; x < offset + FILM_WIDTH + 6; x += 3) {
		const height = 1 + hash(x * 0.37) * 3.2;
		const screenX = x - offset;

		context.moveTo(screenX, GROUND_Y + 0.5);
		context.lineTo(screenX + 1.2, GROUND_Y - height);
		context.lineTo(screenX + 2.4, GROUND_Y + 0.5);
	}

	context.fill();
}

export function drawGear(
	context: CanvasRenderingContext2D,
	x: number,
	width: number,
	height: number,
	angle: number,
): void {
	const radius = Math.min(width, height) / 2;
	const centerY = GROUND_Y - radius;
	const teeth = 9;

	context.save();
	context.translate(x, centerY);
	context.rotate(angle);
	context.scale(width / (radius * 2), 1);

	context.fillStyle = INK;

	context.beginPath();

	for (let tooth = 0; tooth < teeth * 2; tooth += 1) {
		const reach = tooth % 2 === 0 ? radius : radius * 0.78;
		const a = (tooth / (teeth * 2)) * Math.PI * 2;

		context.lineTo(Math.cos(a) * reach, Math.sin(a) * reach);
	}

	context.closePath();
	context.fill();

	context.fillStyle = "#c59a5c";

	context.beginPath();
	context.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
	context.fill();

	context.restore();
}

function flame(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	size: number,
	time: number,
): void {
	const sway = Math.sin(time * 14 + x) * size * 0.25;

	context.save();

	context.shadowColor = "rgba(255, 220, 140, 0.9)";
	context.shadowBlur = 6;
	context.fillStyle = LIGHT;

	context.beginPath();
	context.moveTo(x - size * 0.45, y);

	context.quadraticCurveTo(
		x - size * 0.5,
		y - size * 0.9,
		x + sway,
		y - size * 1.8,
	);

	context.quadraticCurveTo(x + size * 0.5, y - size * 0.9, x + size * 0.45, y);
	context.closePath();
	context.fill();
	context.restore();
}

export function drawCandles(
	context: CanvasRenderingContext2D,
	x: number,
	width: number,
	height: number,
	time: number,
): void {
	const count = 3;
	const step = width / count;

	context.fillStyle = INK;

	for (let index = 0; index < count; index += 1) {
		const candleHeight = height * (0.62 + ((index + 1) % 3) * 0.19);
		const left = x - width / 2 + index * step + step * 0.2;
		const candleWidth = step * 0.6;

		context.fillRect(left, GROUND_Y - candleHeight, candleWidth, candleHeight);
		context.fillRect(left - 1, GROUND_Y - 2, candleWidth + 2, 2);

		flame(
			context,
			left + candleWidth / 2,
			GROUND_Y - candleHeight - 0.5,
			2.4,
			time + index,
		);
	}
}

export function drawSpikes(
	context: CanvasRenderingContext2D,
	x: number,
	width: number,
	height: number,
): void {
	const count = Math.max(4, Math.round(width / 5));
	const left = x - width / 2;

	context.fillStyle = INK;

	context.fillRect(left, GROUND_Y - 2.5, width, 2.5);
	context.beginPath();

	for (let index = 0; index < count; index += 1) {
		const base = left + (index / count) * width;
		const tip = height * (0.8 + hash(index + x * 0.01) * 0.2);

		context.moveTo(base, GROUND_Y - 2);
		context.lineTo(base + width / count / 2, GROUND_Y - tip);
		context.lineTo(base + width / count, GROUND_Y - 2);
	}

	context.fill();
}

export function drawBat(
	context: CanvasRenderingContext2D,
	x: number,
	centerY: number,
	width: number,
	time: number,
): void {
	const flap = Math.sin(time * 19 + x * 0.1);
	const span = width / 2;
	const lift = flap * 5;

	context.fillStyle = INK;

	context.beginPath();
	context.ellipse(x, centerY, 3, 4, 0, 0, Math.PI * 2);
	context.fill();

	for (const side of [-1, 1]) {
		context.beginPath();
		context.moveTo(x + side * 2, centerY - 1);

		context.quadraticCurveTo(
			x + side * span * 0.5,
			centerY - 4 - lift,
			x + side * span,
			centerY - lift,
		);

		context.lineTo(x + side * span * 0.78, centerY + 2 - lift * 0.4);
		context.lineTo(x + side * span * 0.6, centerY - lift * 0.3);
		context.lineTo(x + side * span * 0.4, centerY + 3 - lift * 0.2);
		context.lineTo(x + side * 2, centerY + 2);
		context.fill();
	}

	context.beginPath();
	context.moveTo(x - 2, centerY - 3);
	context.lineTo(x - 1.5, centerY - 6);
	context.lineTo(x - 0.5, centerY - 3.5);
	context.lineTo(x + 0.5, centerY - 3.5);
	context.lineTo(x + 1.5, centerY - 6);
	context.lineTo(x + 2, centerY - 3);
	context.fill();

	context.fillStyle = LIGHT;

	context.fillRect(x - 1.4, centerY - 2.2, 0.8, 0.8);
	context.fillRect(x + 0.6, centerY - 2.2, 0.8, 0.8);
}

export function drawChandelier(
	context: CanvasRenderingContext2D,
	x: number,
	bottomY: number,
	width: number,
	time: number,
): void {
	const sway = Math.sin(time * 2.2 + x * 0.05) * 0.06;
	const length = bottomY - 8;

	context.save();
	context.translate(x, 0);
	context.rotate(sway);

	context.strokeStyle = INK;
	context.lineWidth = 0.9;

	context.beginPath();
	context.moveTo(0, 0);
	context.lineTo(0, length - 6);
	context.stroke();

	context.fillStyle = INK;

	context.beginPath();
	context.ellipse(0, length - 3, 3, 4, 0, 0, Math.PI * 2);
	context.fill();

	context.lineWidth = 1.4;

	context.beginPath();
	context.moveTo(-width / 2, length - 4);
	context.quadraticCurveTo(-width / 4, length + 6, 0, length + 2);
	context.quadraticCurveTo(width / 4, length + 6, width / 2, length - 4);
	context.stroke();

	for (const arm of [-0.5, -0.17, 0.17, 0.5]) {
		const armX = arm * width;

		context.fillRect(armX - 1, length - 9, 2, 6);

		flame(context, armX, length - 9, 1.8, time + arm * 3);
	}

	context.beginPath();
	context.moveTo(-3, length + 2);
	context.lineTo(0, length + 8);
	context.lineTo(3, length + 2);
	context.fill();

	context.restore();
}

export function drawOwl(
	context: CanvasRenderingContext2D,
	x: number,
	centerY: number,
	width: number,
	time: number,
): void {
	const flap = Math.sin(time * 7 + x * 0.1) * 3;

	context.fillStyle = INK;

	for (const side of [-1, 1]) {
		context.beginPath();
		context.moveTo(x + side * 3, centerY - 3);

		context.quadraticCurveTo(
			x + side * width * 0.7,
			centerY - 6 - flap,
			x + side * width * 0.85,
			centerY + 1 - flap,
		);

		context.quadraticCurveTo(
			x + side * width * 0.5,
			centerY + 2,
			x + side * 3,
			centerY + 4,
		);

		context.fill();
	}

	context.beginPath();
	context.ellipse(x, centerY, 5, 7, 0, 0, Math.PI * 2);
	context.fill();

	context.beginPath();
	context.moveTo(x - 4.5, centerY - 4);
	context.lineTo(x - 4, centerY - 9);
	context.lineTo(x - 1.5, centerY - 5.5);
	context.lineTo(x + 1.5, centerY - 5.5);
	context.lineTo(x + 4, centerY - 9);
	context.lineTo(x + 4.5, centerY - 4);
	context.fill();

	context.save();

	context.shadowColor = "rgba(255, 220, 120, 0.9)";
	context.shadowBlur = 4;
	context.fillStyle = "#ffe08a";

	context.beginPath();
	context.arc(x - 1.8, centerY - 3, 1.2, 0, Math.PI * 2);
	context.arc(x + 1.8, centerY - 3, 1.2, 0, Math.PI * 2);
	context.fill();
	context.restore();
}

export function drawMushroom(
	context: CanvasRenderingContext2D,
	x: number,
	footY: number,
	pose: MushroomPose,
): void {
	const squash = pose.ducking ? 0.5 : 1 - pose.squash * 0.18;

	const stretch = pose.airborne
		? 1 + Math.min(0.12, Math.abs(pose.rising) * 0.0006)
		: 1;

	const stemHeight = 11 * squash * stretch;
	const stemWidth = pose.ducking ? 11 : 9;
	const capWidth = pose.ducking ? 22 : 18 + pose.squash * 2;
	const capHeight = pose.ducking ? 7 : 10 * stretch;
	const tilt = pose.airborne ? -Math.sign(pose.rising) * 0.12 : 0;

	context.save();
	context.translate(x, footY);
	context.rotate(tilt + pose.tumble);

	context.fillStyle = INK;
	context.lineCap = "round";
	context.strokeStyle = INK;
	context.lineWidth = 2;

	if (pose.airborne) {
		context.beginPath();
		context.moveTo(-2.5, -1);
		context.lineTo(-3.5, -3);
		context.moveTo(2.5, -1);
		context.lineTo(3.5, -2.5);
		context.stroke();
	} else if (!pose.ducking) {
		const stride = Math.sin(pose.run * Math.PI * 2) * 2.6;

		context.beginPath();
		context.moveTo(-2, -2);
		context.lineTo(-2 + stride, 0);
		context.moveTo(2, -2);
		context.lineTo(2 - stride, 0);
		context.stroke();
	}

	const stemBottom = pose.ducking ? 0 : -2;

	context.beginPath();

	context.roundRect(
		-stemWidth / 2,
		stemBottom - stemHeight,
		stemWidth,
		stemHeight,
		3,
	);

	context.fill();

	const armSwing = pose.airborne
		? -3
		: Math.sin(pose.run * Math.PI * 2 + 1.2) * 2;

	context.lineWidth = 1.4;

	context.beginPath();
	context.moveTo(-stemWidth / 2 + 0.5, stemBottom - stemHeight * 0.55);

	context.lineTo(
		-stemWidth / 2 - 2.5,
		stemBottom - stemHeight * 0.3 + armSwing,
	);

	context.moveTo(stemWidth / 2 - 0.5, stemBottom - stemHeight * 0.55);
	context.lineTo(stemWidth / 2 + 2.5, stemBottom - stemHeight * 0.3 - armSwing);
	context.stroke();

	const capBottom = stemBottom - stemHeight + 1.5;

	context.fillStyle = pose.cap;

	context.beginPath();
	context.ellipse(0, capBottom, capWidth / 2, capHeight, 0, Math.PI, 0);
	context.closePath();
	context.fill();

	context.strokeStyle = INK;
	context.lineWidth = 1;

	context.stroke();

	context.fillStyle = "rgba(255, 243, 210, 0.85)";

	for (const [dx, dy, radius] of [
		[-4, 0.55, 1.3],
		[2.5, 0.75, 1.6],
		[5.5, 0.35, 0.9],
	]) {
		context.beginPath();

		context.arc(
			dx * (capWidth / 18),
			capBottom - capHeight * dy,
			radius,
			0,
			Math.PI * 2,
		);

		context.fill();
	}

	context.fillStyle = LIGHT;

	context.fillRect(-2.6, stemBottom - stemHeight * 0.72, 1.3, 1.6);
	context.fillRect(1.3, stemBottom - stemHeight * 0.72, 1.3, 1.6);

	context.restore();
}

export function drawFilmBorders(
	context: CanvasRenderingContext2D,
	time: number,
): void {
	const scroll = (time * 140) % 14;

	context.fillStyle = "#070403";

	context.fillRect(0, 0, BORDER, FILM_HEIGHT);
	context.fillRect(FILM_WIDTH - BORDER, 0, BORDER, FILM_HEIGHT);

	context.fillStyle = "rgba(240, 214, 160, 0.32)";

	for (let y = -14 + scroll; y < FILM_HEIGHT; y += 14) {
		for (const x of [3.5, FILM_WIDTH - BORDER + 3.5]) {
			context.beginPath();
			context.roundRect(x, y, 7, 8, 1.6);
			context.fill();
		}
	}
}

export function drawGrain(
	context: CanvasRenderingContext2D,
	scratches: readonly number[],
): void {
	context.fillStyle = "rgba(30, 16, 4, 0.22)";

	for (let speck = 0; speck < 140; speck += 1) {
		context.fillRect(
			Math.random() * FILM_WIDTH,
			Math.random() * FILM_HEIGHT,
			Math.random() < 0.9 ? 0.6 : 1.6,
			0.6,
		);
	}

	for (const x of scratches) {
		context.fillStyle =
			x % 2 > 1 ? "rgba(255, 240, 210, 0.3)" : "rgba(20, 10, 0, 0.35)";

		context.fillRect(x, 0, 0.5, FILM_HEIGHT);
	}

	if (Math.random() < 0.08) {
		context.fillStyle = "rgba(20, 10, 0, 0.5)";

		context.beginPath();

		context.arc(
			BORDER + Math.random() * (FILM_WIDTH - BORDER * 2),
			Math.random() * FILM_HEIGHT,
			0.8 + Math.random() * 2.2,
			0,
			Math.PI * 2,
		);

		context.fill();
	}

	const vignette = context.createRadialGradient(
		FILM_WIDTH / 2,
		FILM_HEIGHT / 2,
		FILM_HEIGHT * 0.35,
		FILM_WIDTH / 2,
		FILM_HEIGHT / 2,
		FILM_WIDTH * 0.62,
	);

	vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
	vignette.addColorStop(1, "rgba(10, 4, 0, 0.75)");

	context.fillStyle = vignette;

	context.fillRect(0, 0, FILM_WIDTH, FILM_HEIGHT);
}

export function drawLeader(
	context: CanvasRenderingContext2D,
	remaining: number,
): void {
	const x = FILM_WIDTH / 2;
	const y = FILM_HEIGHT / 2 - 8;
	const radius = 34;
	const fraction = remaining - Math.floor(remaining);
	const number = Math.max(1, Math.ceil(remaining));

	context.fillStyle = "rgba(20, 10, 2, 0.35)";

	context.beginPath();
	context.moveTo(x, y);

	context.arc(
		x,
		y,
		radius,
		-Math.PI / 2,
		-Math.PI / 2 + (1 - fraction) * Math.PI * 2,
	);

	context.closePath();
	context.fill();

	context.strokeStyle = INK;
	context.lineWidth = 1.2;

	for (const scale of [1, 0.82]) {
		context.beginPath();
		context.arc(x, y, radius * scale, 0, Math.PI * 2);
		context.stroke();
	}

	context.beginPath();
	context.moveTo(x - radius * 1.3, y);
	context.lineTo(x + radius * 1.3, y);
	context.moveTo(x, y - radius * 1.3);
	context.lineTo(x, y + radius * 1.3);
	context.stroke();

	context.fillStyle = INK;
	context.font = `40px ${TITLE_FONT}`;
	context.textAlign = "center";
	context.textBaseline = "middle";

	context.fillText(String(number), x, y + 2);
}

export function drawCaption(
	context: CanvasRenderingContext2D,
	text: string,
): void {
	const y = FILM_HEIGHT - 14;

	context.fillStyle = "rgba(10, 5, 2, 0.8)";

	context.fillRect(BORDER + 30, y - 9, FILM_WIDTH - BORDER * 2 - 60, 15);

	context.fillStyle = LIGHT;
	context.font = `9px ${TEXT_FONT}`;
	context.textAlign = "center";
	context.textBaseline = "middle";

	context.fillText(text, FILM_WIDTH / 2, y - 1.5);
}

export function drawCard(
	context: CanvasRenderingContext2D,
	lines: readonly CardLine[],
	alpha: number,
	tint = "#0d0905",
): void {
	context.save();

	context.globalAlpha = alpha;

	context.fillStyle = tint;

	context.fillRect(0, 0, FILM_WIDTH, FILM_HEIGHT);

	const left = 40;
	const top = 34;
	const width = FILM_WIDTH - 80;
	const height = FILM_HEIGHT - 68;

	context.strokeStyle = "rgba(240, 220, 180, 0.75)";
	context.lineWidth = 1;

	context.strokeRect(left, top, width, height);

	context.lineWidth = 0.5;

	context.strokeRect(left + 4, top + 4, width - 8, height - 8);

	for (const [cornerX, cornerY] of [
		[left, top],
		[left + width, top],
		[left, top + height],
		[left + width, top + height],
	]) {
		context.beginPath();
		context.arc(cornerX, cornerY, 4, 0, Math.PI * 2);
		context.stroke();
	}

	const total = lines.reduce((sum, line) => sum + line.size * 1.35, 0);
	let y = FILM_HEIGHT / 2 - total / 2;

	context.textAlign = "center";
	context.textBaseline = "top";

	for (const line of lines) {
		context.fillStyle = line.color ?? "#f2e3c2";
		context.font = `${line.size}px ${line.title ? TITLE_FONT : TEXT_FONT}`;

		context.fillText(line.text, FILM_WIDTH / 2, y);

		y += line.size * 1.35;
	}

	context.restore();
}

export function drawBurn(
	context: CanvasRenderingContext2D,
	progress: number,
): void {
	const x = FILM_WIDTH * 0.52;
	const y = FILM_HEIGHT * 0.46;
	const radius = progress * FILM_WIDTH * 0.75;

	context.save();
	context.beginPath();

	for (let step = 0; step <= 48; step += 1) {
		const angle = (step / 48) * Math.PI * 2;
		const wobble = radius * (0.82 + hash(step * 1.7) * 0.36);
		const px = x + Math.cos(angle) * wobble;
		const py = y + Math.sin(angle) * wobble * 0.8;

		if (step === 0) {
			context.moveTo(px, py);
		} else {
			context.lineTo(px, py);
		}
	}

	context.closePath();

	context.shadowColor = "rgba(255, 150, 40, 1)";
	context.shadowBlur = 10;
	context.strokeStyle = "rgba(255, 170, 60, 0.95)";
	context.lineWidth = 2.5;

	context.stroke();

	context.fillStyle = "#fff8e8";

	context.fill();
	context.restore();
}
