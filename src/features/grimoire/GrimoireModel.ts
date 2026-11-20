import * as THREE from "three";
import type { ModelKit } from "../models/modelKit";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./pageRenderer";

const FLIP_SECONDS = 0.38;
const FLIP_MIN_SECONDS = 0.09;
export const BOOK_PAGE_WIDTH = 0.205;
export const BOOK_PAGE_HEIGHT = BOOK_PAGE_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH);

export function createPageTexture(
	canvas: HTMLCanvasElement,
	anisotropy: number,
): THREE.CanvasTexture {
	const texture = new THREE.CanvasTexture(canvas);

	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = anisotropy;
	texture.minFilter = THREE.LinearMipmapLinearFilter;
	texture.magFilter = THREE.LinearFilter;

	return texture;
}

function pageMaterial(): THREE.MeshStandardMaterial {
	return new THREE.MeshStandardMaterial({
		roughness: 0.95,
		metalness: 0,
		color: 0xffffff,
	});
}

export class GrimoireModel {
	readonly root: THREE.Object3D;
	private readonly left = pageMaterial();
	private readonly right = pageMaterial();
	private readonly flipFront = pageMaterial();
	private readonly flipBack = pageMaterial();
	private readonly flipGroup: THREE.Object3D;
	private flipProgress = 1;
	private flipDirection: 1 | -1 = 1;
	private afterFlip: (() => void) | null = null;

	private readonly queue: {
		left: THREE.Texture;
		right: THREE.Texture;
		direction: 1 | -1;
	}[] = [];

	constructor(kit: ModelKit) {
		const rig = kit.rig("tools/grimoire");

		this.root = rig.root;
		this.flipGroup = rig.node("flip");
		rig.mesh("page_left").material = this.left;
		rig.mesh("page_right").material = this.right;
		rig.mesh("flip_front").material = this.flipFront;
		rig.mesh("flip_back").material = this.flipBack;
	}

	setPages(left: THREE.Texture, right: THREE.Texture): void {
		this.left.map = left;
		this.right.map = right;
		this.left.needsUpdate = true;
		this.right.needsUpdate = true;
	}

	flipTo(left: THREE.Texture, right: THREE.Texture, direction: 1 | -1): void {
		this.queue.push({ left, right, direction });

		if (this.flipProgress >= 1) {
			this.startNextFlip();
		}
	}

	private startNextFlip(): void {
		const next = this.queue.shift();

		if (!next) {
			return;
		}

		const { left, right, direction } = next;
		const oldLeft = this.left.map;
		const oldRight = this.right.map;

		this.flipDirection = direction;

		if (direction === 1) {
			this.flipFront.map = oldRight;
			this.flipBack.map = left;
			this.right.map = right;

			this.afterFlip = () => {
				this.left.map = left;
				this.left.needsUpdate = true;
			};
		} else {
			this.flipFront.map = right;
			this.flipBack.map = oldLeft;
			this.left.map = left;

			this.afterFlip = () => {
				this.right.map = right;
				this.right.needsUpdate = true;
			};
		}

		for (const material of [
			this.left,
			this.right,
			this.flipFront,
			this.flipBack,
		]) {
			material.needsUpdate = true;
		}

		this.flipProgress = 0;
		this.flipGroup.visible = true;

		this.updateFlipTransform();
	}

	get flipping(): boolean {
		return this.flipProgress < 1;
	}

	update(dt: number): void {
		if (this.flipProgress >= 1) {
			return;
		}

		const duration = Math.max(
			FLIP_MIN_SECONDS,
			FLIP_SECONDS / (1 + this.queue.length),
		);

		this.flipProgress = Math.min(1, this.flipProgress + dt / duration);

		this.updateFlipTransform();

		if (this.flipProgress >= 1) {
			this.finishFlip();
			this.startNextFlip();
		}
	}

	private updateFlipTransform(): void {
		const eased = 0.5 - Math.cos(this.flipProgress * Math.PI) / 2;

		const angle =
			this.flipDirection === 1 ? eased * Math.PI : (1 - eased) * Math.PI;

		this.flipGroup.rotation.y = -angle;
		this.flipGroup.position.z = 0.007 + Math.sin(eased * Math.PI) * 0.025;
	}

	private finishFlip(): void {
		this.flipProgress = 1;
		this.flipGroup.visible = false;

		this.afterFlip?.();

		this.afterFlip = null;
	}

	dispose(): void {
		for (const material of [
			this.left,
			this.right,
			this.flipFront,
			this.flipBack,
		]) {
			material.dispose();
		}
	}
}
