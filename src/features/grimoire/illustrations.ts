import { SPECIES_IDS, type SpeciesId } from "@shared/config/species";
import * as THREE from "three";
import { createAnomalyModel } from "../models/anomalies/createAnomalyModel";
import type { ModelKit } from "../models/modelKit";

export type IllustrationStyle = "ink" | "color";

type Rgb = [number, number, number];

const SIZE = 384;
const INK: Rgb = [42, 26, 14];
const WASH: Rgb = [196, 160, 110];
const PIGMENT_LEVELS = 4;
const PAPER_TINT = 0.3;
const BLOCK = 3;
const BLOCK_CENTER = Math.floor(BLOCK / 2);
const POSE_TIME = 1.45;
const POSES: Partial<
	Record<
		SpeciesId,
		{
			state: "idle" | "chase" | "windup" | "special";
			extra: number;
			time?: number;
		}
	>
> = {
	murmure: { state: "special", extra: 1 },
	double: { state: "special", extra: 1 },
	boursoufle: { state: "idle", extra: 0.5 },
	hurleur: { state: "idle", extra: 1, time: 1.51 },
	archiviste: { state: "idle", extra: 0.3 },
	fulgurant: { state: "windup", extra: 0.8 },
	gorgone: { state: "idle", extra: 0.6 },
	brume: { state: "special", extra: 1 },
	"rat-roi": { state: "idle", extra: 0 },
};

function mix(from: Rgb, to: Rgb, t: number): Rgb {
	return [
		from[0] + (to[0] - from[0]) * t,
		from[1] + (to[1] - from[1]) * t,
		from[2] + (to[2] - from[2]) * t,
	];
}

function grain(x: number, y: number): number {
	const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
	return value - Math.floor(value);
}

function inkTone(_color: Rgb, luminance: number, hatch: boolean): Rgb {
	const level = Math.round(luminance ** 0.75 * 3) / 3;
	return mix(INK, WASH, hatch && level < 0.5 ? 0 : level);
}

function pigmentTone(color: Rgb, luminance: number, hatch: boolean): Rgb {
	const pigment = color.map(
		(channel) =>
			(Math.round((channel / 255) * (PIGMENT_LEVELS - 1)) /
				(PIGMENT_LEVELS - 1)) *
			255,
	) as Rgb;
	const tinted = mix(pigment, WASH, PAPER_TINT);
	return hatch && luminance < 0.3 ? mix(tinted, INK, 0.55) : tinted;
}

function stylize(
	pixels: Uint8Array,
	style: IllustrationStyle,
): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = SIZE;
	canvas.height = SIZE;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	const image = context.createImageData(SIZE, SIZE);
	const blocks = SIZE / BLOCK;
	const sourceOf = (column: number, row: number) =>
		((SIZE - 1 - (row * BLOCK + BLOCK_CENTER)) * SIZE +
			column * BLOCK +
			BLOCK_CENTER) *
		4;
	const alphaAt = (column: number, row: number) =>
		column < 0 || row < 0 || column >= blocks || row >= blocks
			? 0
			: pixels[sourceOf(column, row) + 3];
	const tone = style === "ink" ? inkTone : pigmentTone;
	for (let row = 0; row < blocks; row += 1) {
		for (let column = 0; column < blocks; column += 1) {
			const source = sourceOf(column, row);
			if (pixels[source + 3] < 8) {
				continue;
			}
			const reach =
				Math.hypot(column / blocks - 0.5, (row / blocks - 0.5) * 0.8) * 2;
			const presence = Math.min(1, Math.max(0, (1 - reach) / 0.5));
			if (grain(column, row) > presence * 1.2) {
				continue;
			}
			const color: Rgb = [
				pixels[source],
				pixels[source + 1],
				pixels[source + 2],
			];
			const luminance =
				(color[0] * 0.3 + color[1] * 0.55 + color[2] * 0.15) / 255;
			const edge =
				(alphaAt(column - 1, row) < 8 ||
					alphaAt(column + 1, row) < 8 ||
					alphaAt(column, row - 1) < 8 ||
					alphaAt(column, row + 1) < 8) &&
				grain(row + 31, column + 7) > 0.4;
			const hatch = (column + row) % 3 === 0;
			const blot = grain(
				Math.floor(column / 6) + 101,
				Math.floor(row / 6) + 53,
			);
			const [red, green, blue] = mix(
				edge ? INK : tone(color, luminance, hatch),
				WASH,
				(1 - presence) * 0.55 + blot * 0.2,
			);
			const opacity =
				(style === "color" ? 255 : 205) * (0.55 + 0.45 * presence);
			for (let y = row * BLOCK; y < (row + 1) * BLOCK; y += 1) {
				for (let x = column * BLOCK; x < (column + 1) * BLOCK; x += 1) {
					const target = (y * SIZE + x) * 4;
					image.data[target] = red;
					image.data[target + 1] = green;
					image.data[target + 2] = blue;
					image.data[target + 3] = opacity;
				}
			}
		}
	}
	context.putImageData(image, 0, 0);
	return canvas;
}

function visibleBounds(root: THREE.Object3D): THREE.Box3 {
	const bounds = new THREE.Box3();
	const visit = (object: THREE.Object3D) => {
		if (!object.visible) {
			return;
		}
		if (object instanceof THREE.Mesh) {
			object.geometry.computeBoundingBox();
			bounds.union(
				(object.geometry.boundingBox as THREE.Box3)
					.clone()
					.applyMatrix4(object.matrixWorld),
			);
		}
		for (const child of object.children) {
			visit(child);
		}
	};
	visit(root);
	return bounds;
}

export async function renderIllustrations(
	renderer: THREE.WebGLRenderer,
	kit: ModelKit,
	species: readonly SpeciesId[],
	onProgress: (fraction: number) => void,
	style: IllustrationStyle = "ink",
): Promise<Map<SpeciesId, HTMLCanvasElement>> {
	const result = new Map<SpeciesId, HTMLCanvasElement>();
	const target = new THREE.WebGLRenderTarget(SIZE, SIZE, {
		colorSpace: THREE.SRGBColorSpace,
	});
	const scene = new THREE.Scene();
	scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2));
	const key = new THREE.DirectionalLight(0xffffff, 2.5);
	key.position.set(2, 4, 5);
	scene.add(key);
	const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
	const pixels = new Uint8Array(SIZE * SIZE * 4);
	const previousTarget = renderer.getRenderTarget();
	const previousClear = renderer.getClearColor(new THREE.Color());
	const previousAlpha = renderer.getClearAlpha();
	const drawn = SPECIES_IDS.filter((id) => species.includes(id));
	for (const [index, id] of drawn.entries()) {
		const model = createAnomalyModel(id, kit, 0xd8442f);
		const pose = POSES[id] ?? { state: "chase", extra: 0 };
		const time = pose.time ?? POSE_TIME;
		for (let step = 0; step < 6; step += 1) {
			model.update({
				state: pose.state,
				stateMs: 2000,
				extra: pose.extra,
				speed: 0,
				dt: 0.05,
				time: time - (5 - step) * 0.05,
			});
		}
		model.preparePortrait();
		model.root.rotation.y = -0.45;
		scene.add(model.root);
		model.root.updateMatrixWorld(true);
		const bounds = visibleBounds(model.root);
		const center = bounds.getCenter(new THREE.Vector3());
		const size = bounds.getSize(new THREE.Vector3());
		const radius = Math.max(size.y, size.x, size.z) * 0.62;
		camera.position.set(
			center.x + radius * 0.4,
			center.y + radius * 0.25,
			center.z + radius / Math.tan((camera.fov * Math.PI) / 360),
		);
		camera.lookAt(center);
		renderer.setRenderTarget(target);
		renderer.setClearColor(0x000000, 0);
		renderer.clear();
		renderer.render(scene, camera);
		renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
		result.set(id, stylize(pixels, style));
		scene.remove(model.root);
		model.dispose();
		onProgress((index + 1) / drawn.length);
		await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
	}
	renderer.setRenderTarget(previousTarget);
	renderer.setClearColor(previousClear, previousAlpha);
	target.dispose();
	return result;
}
