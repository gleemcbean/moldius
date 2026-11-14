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

export function bountyTag(): THREE.Sprite {
	const canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 64;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	context.fillStyle = "rgba(10, 12, 10, 0.72)";
	context.beginPath();
	context.arc(64, 32, 28, 0, Math.PI * 2);
	context.fill();
	context.fillStyle = "#ffc857";
	context.beginPath();
	context.moveTo(40, 44);
	context.lineTo(36, 20);
	context.lineTo(50, 32);
	context.lineTo(64, 14);
	context.lineTo(78, 32);
	context.lineTo(92, 20);
	context.lineTo(88, 44);
	context.closePath();
	context.fill();
	context.fillRect(40, 46, 48, 5);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const sprite = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: texture,
			depthTest: true,
			transparent: true,
		}),
	);
	sprite.scale.set(0.44, 0.22, 1);
	return sprite;
}
