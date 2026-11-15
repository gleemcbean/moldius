import * as THREE from "three";

const FACE_SIZE = 32;
const CEILING = [84, 70, 56];
const FLOOR = [20, 15, 12];
const HORIZON = [58, 47, 37];

type Glint = [number, number, number, number, number, number, number];

const FACE_GLINTS: Glint[][] = [
	[[9, 14, 2, 3, 255, 196, 120]],
	[
		[21, 13, 2, 3, 255, 186, 110],
		[5, 6, 7, 9, 26, 32, 44],
	],
	[],
	[],
	[[15, 12, 3, 4, 255, 206, 140]],
	[
		[24, 15, 2, 2, 240, 170, 96],
		[8, 5, 8, 10, 22, 28, 40],
	],
];

function mixChannel(a: number[], b: number[], t: number): string {
	return `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * t)).join(",")})`;
}

function paintFace(index: number): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = FACE_SIZE;
	canvas.height = FACE_SIZE;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	if (index === 2) {
		context.fillStyle = mixChannel(CEILING, CEILING, 0);
		context.fillRect(0, 0, FACE_SIZE, FACE_SIZE);
		context.fillStyle = "rgb(112,92,72)";
		context.fillRect(8, 8, 16, 16);
		context.fillStyle = "rgb(150,122,90)";
		context.fillRect(13, 13, 6, 6);
		return canvas;
	}
	if (index === 3) {
		context.fillStyle = mixChannel(FLOOR, FLOOR, 0);
		context.fillRect(0, 0, FACE_SIZE, FACE_SIZE);
		return canvas;
	}
	for (let y = 0; y < FACE_SIZE; y += 1) {
		const t = y / (FACE_SIZE - 1);
		context.fillStyle =
			t < 0.5
				? mixChannel(CEILING, HORIZON, t * 2)
				: mixChannel(HORIZON, FLOOR, (t - 0.5) * 2);
		context.fillRect(0, y, FACE_SIZE, 1);
	}
	for (const [x, y, width, height, r, g, b] of FACE_GLINTS[index]) {
		context.fillStyle = `rgb(${r},${g},${b})`;
		context.fillRect(x, y, width, height);
	}
	return canvas;
}

export function createReflections(): THREE.CubeTexture {
	const texture = new THREE.CubeTexture(
		Array.from({ length: 6 }, (_, index) => paintFace(index)),
	);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.magFilter = THREE.NearestFilter;
	texture.needsUpdate = true;
	return texture;
}
