import { PHOTO_SIZE } from "@shared/config/index";
import * as THREE from "three";
import type { PostEffects } from "../render/PostEffects";

const PREVIEW_SIZE = 256;
const AIMED_PREVIEW_SIZE = 512;
const PHOTO_QUALITY = 0.9;

export class PhotoCamera {
	readonly camera = new THREE.PerspectiveCamera(60, 1, 0.05, 120);
	readonly preview: THREE.WebGLRenderTarget;
	private readonly shot = new THREE.WebGLRenderTarget(1, 1, {
		type: THREE.HalfFloatType,
		depthBuffer: true,
		samples: 4,
	});
	private readonly viewport = new THREE.Vector4();
	private readonly bufferSize = new THREE.Vector2();

	constructor() {
		this.preview = new THREE.WebGLRenderTarget(PREVIEW_SIZE, PREVIEW_SIZE, {
			type: THREE.HalfFloatType,
			depthBuffer: true,
		});
		this.camera.layers.set(0);
	}

	setPreviewDetail(aimed: boolean): void {
		const size = aimed ? AIMED_PREVIEW_SIZE : PREVIEW_SIZE;
		if (this.preview.width !== size) {
			this.preview.setSize(size, size);
		}
	}

	private follow(view: THREE.PerspectiveCamera): void {
		view.updateMatrixWorld();
		view.matrixWorld.decompose(
			this.camera.position,
			this.camera.quaternion,
			this.camera.scale,
		);
		this.camera.fov = view.fov;
		this.camera.near = view.near;
		this.camera.far = view.far;
		this.camera.aspect = 1;
		this.camera.updateProjectionMatrix();
		this.camera.updateMatrixWorld(true);
	}

	renderPreview(
		renderer: THREE.WebGLRenderer,
		scene: THREE.Scene,
		view: THREE.PerspectiveCamera,
	): void {
		this.follow(view);
		const previous = renderer.getRenderTarget();
		renderer.setRenderTarget(this.preview);
		renderer.clear();
		renderer.render(scene, this.camera);
		renderer.setRenderTarget(previous);
	}

	capture(
		renderer: THREE.WebGLRenderer,
		scene: THREE.Scene,
		view: THREE.PerspectiveCamera,
		post: PostEffects,
	): Promise<Blob | null> {
		this.follow(view);
		renderer.getDrawingBufferSize(this.bufferSize);
		const pixelRatio = renderer.getPixelRatio();
		const side = Math.floor(
			Math.min(PHOTO_SIZE, this.bufferSize.x, this.bufferSize.y),
		);
		if (this.shot.width !== side) {
			this.shot.setSize(side, side);
		}
		const previous = renderer.getRenderTarget();
		renderer.getViewport(this.viewport);
		renderer.setRenderTarget(this.shot);
		renderer.clear();
		renderer.render(scene, this.camera);
		renderer.setRenderTarget(null);
		renderer.setViewport(0, 0, side / pixelRatio, side / pixelRatio);
		post.renderSquare(this.shot.texture, side);
		const output = document.createElement("canvas");
		output.width = PHOTO_SIZE;
		output.height = PHOTO_SIZE;
		const context = output.getContext("2d");
		context?.drawImage(
			renderer.domElement,
			0,
			this.bufferSize.y - side,
			side,
			side,
			0,
			0,
			PHOTO_SIZE,
			PHOTO_SIZE,
		);
		renderer.setViewport(this.viewport);
		renderer.setRenderTarget(previous);
		if (!context) {
			return Promise.resolve(null);
		}
		return new Promise((resolve) =>
			output.toBlob(resolve, "image/jpeg", PHOTO_QUALITY),
		);
	}

	dispose(): void {
		this.preview.dispose();
		this.shot.dispose();
	}
}
