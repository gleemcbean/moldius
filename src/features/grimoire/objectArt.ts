import {
	MATERIAL_IDS,
	type MaterialId,
	OCCULT_IDS,
	type OccultId,
} from "@shared/config/occult";
import * as THREE from "three";
import { createStore } from "../../utils/store";
import type { ModelKit } from "../models/modelKit";
import {
	createMaterialModel,
	createOccultModel,
	disposeModel,
} from "../models/occultModels";

export type ObjectArtId = MaterialId | OccultId;
export type ObjectArt = Map<ObjectArtId, HTMLCanvasElement>;

const SIZE = 256;
const BLOCK = 2;
const INK = [42, 26, 14];

export const objectArtStore = createStore<{
	urls: Partial<Record<ObjectArtId, string>>;
}>({ urls: {} });

function stylize(pixels: Uint8Array): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = SIZE;
	canvas.height = SIZE;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	const image = context.createImageData(SIZE, SIZE);
	const blocks = SIZE / BLOCK;
	const source = (column: number, row: number) =>
		((SIZE - 1 - row * BLOCK) * SIZE + column * BLOCK) * 4;
	const opaque = (column: number, row: number) =>
		column >= 0 &&
		row >= 0 &&
		column < blocks &&
		row < blocks &&
		pixels[source(column, row) + 3] > 40;
	for (let row = 0; row < blocks; row += 1) {
		for (let column = 0; column < blocks; column += 1) {
			if (!opaque(column, row)) {
				continue;
			}
			const from = source(column, row);
			const edge =
				!opaque(column - 1, row) ||
				!opaque(column + 1, row) ||
				!opaque(column, row - 1) ||
				!opaque(column, row + 1);
			const color = edge
				? INK
				: [0, 1, 2].map((channel) =>
						Math.min(255, Math.round(pixels[from + channel] / 12) * 12 + 6),
					);
			for (let y = row * BLOCK; y < (row + 1) * BLOCK; y += 1) {
				for (let x = column * BLOCK; x < (column + 1) * BLOCK; x += 1) {
					const target = (y * SIZE + x) * 4;
					image.data[target] = color[0];
					image.data[target + 1] = color[1];
					image.data[target + 2] = color[2];
					image.data[target + 3] = 255;
				}
			}
		}
	}
	context.putImageData(image, 0, 0);
	return canvas;
}

export function renderObjectArt(
	renderer: THREE.WebGLRenderer,
	kit: ModelKit,
): ObjectArt {
	const result: ObjectArt = new Map();
	const target = new THREE.WebGLRenderTarget(SIZE, SIZE, {
		colorSpace: THREE.SRGBColorSpace,
	});
	const scene = new THREE.Scene();
	scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6058, 2));
	const key = new THREE.DirectionalLight(0xffffff, 2.6);
	key.position.set(2, 4, 5);
	scene.add(key);
	const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 10);
	const pixels = new Uint8Array(SIZE * SIZE * 4);
	const previousTarget = renderer.getRenderTarget();
	const previousClear = renderer.getClearColor(new THREE.Color());
	const previousAlpha = renderer.getClearAlpha();
	const entries: [ObjectArtId, THREE.Group][] = [
		...MATERIAL_IDS.map(
			(id) => [id, createMaterialModel(kit, id)] as [ObjectArtId, THREE.Group],
		),
		...OCCULT_IDS.map(
			(id) => [id, createOccultModel(kit, id)] as [ObjectArtId, THREE.Group],
		),
	];
	for (const [id, model] of entries) {
		scene.add(model);
		model.rotation.y = -0.35;
		model.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(model);
		const center = box.getCenter(new THREE.Vector3());
		const size = box.getSize(new THREE.Vector3());
		const radius = Math.max(size.x, size.y, size.z) * 0.54;
		camera.position.set(
			center.x + radius * 0.35,
			center.y + radius * 0.75,
			center.z + radius / Math.tan((camera.fov * Math.PI) / 360),
		);
		camera.lookAt(center);
		renderer.setRenderTarget(target);
		renderer.setClearColor(0x000000, 0);
		renderer.clear();
		renderer.render(scene, camera);
		renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);
		result.set(id, stylize(pixels));
		scene.remove(model);
		disposeModel(model);
	}
	renderer.setRenderTarget(previousTarget);
	renderer.setClearColor(previousClear, previousAlpha);
	target.dispose();
	const urls: Partial<Record<ObjectArtId, string>> = {};
	for (const [id, canvas] of result) {
		urls[id] = canvas.toDataURL("image/png");
	}
	objectArtStore.set({ urls });
	return result;
}
