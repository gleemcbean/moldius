import * as THREE from "three";

export function nameTag(name: string, color: number): THREE.Sprite {
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 64;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	context.font = '700 34px "Barlow Condensed", sans-serif';
	context.textAlign = "center";
	context.textBaseline = "middle";
	const width = Math.min(250, context.measureText(name).width + 28);
	context.fillStyle = "rgba(10, 12, 10, 0.72)";
	context.fillRect(128 - width / 2, 10, width, 44);
	context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
	context.fillRect(128 - width / 2, 50, width, 4);
	context.fillStyle = "#ecefe2";
	context.fillText(name, 128, 32);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const sprite = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: texture,
			depthTest: true,
			transparent: true,
		}),
	);
	sprite.scale.set(0.9, 0.225, 1);
	return sprite;
}
