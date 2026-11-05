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

function curvedPage(side: -1 | 1): THREE.BufferGeometry {
	const geometry = new THREE.PlaneGeometry(
		BOOK_PAGE_WIDTH,
		BOOK_PAGE_HEIGHT,
		16,
		1,
	);
	const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
	for (let index = 0; index < positions.count; index += 1) {
		const x = positions.getX(index) + (side * BOOK_PAGE_WIDTH) / 2;
		const t = Math.abs(x) / BOOK_PAGE_WIDTH;
		positions.setX(index, x);
		positions.setZ(index, Math.sin(t * Math.PI * 0.85) * 0.016 - t * 0.004);
	}
	geometry.computeVertexNormals();
	return geometry;
}

function pageMaterial(): THREE.MeshStandardMaterial {
	return new THREE.MeshStandardMaterial({
		roughness: 0.95,
		metalness: 0,
		color: 0xffffff,
	});
}

export class GrimoireModel {
	readonly root = new THREE.Group();
	private readonly left = pageMaterial();
	private readonly right = pageMaterial();
	private readonly flipFront = pageMaterial();
	private readonly flipBack = pageMaterial();
	private readonly flipGroup = new THREE.Group();
	private flipProgress = 1;
	private flipDirection: 1 | -1 = 1;
	private afterFlip: (() => void) | null = null;
	private readonly queue: {
		left: THREE.Texture;
		right: THREE.Texture;
		direction: 1 | -1;
	}[] = [];

	constructor(kit: ModelKit) {
		const leather = { texture: "leather", color: 0x7a2a1e, roughness: 0.7 };
		const coverWidth = BOOK_PAGE_WIDTH + 0.015;
		for (const side of [-1, 1]) {
			const cover = kit.box(
				coverWidth,
				BOOK_PAGE_HEIGHT + 0.025,
				0.012,
				leather,
			);
			cover.position.set((side * coverWidth) / 2, 0, -0.012);
			this.root.add(cover);
			const block = kit.box(
				BOOK_PAGE_WIDTH - 0.006,
				BOOK_PAGE_HEIGHT - 0.008,
				0.014,
				{
					texture: "paper",
					color: 0xe8d8b0,
					roughness: 1,
				},
			);
			block.position.set((side * BOOK_PAGE_WIDTH) / 2, 0, -0.003);
			this.root.add(block);
			for (const y of [-1, 1]) {
				const corner = kit.box(0.03, 0.03, 0.016, {
					texture: "brass",
					roughness: 0.4,
					metalness: 0.7,
				});
				corner.position.set(
					side * (coverWidth - 0.012),
					(y * (BOOK_PAGE_HEIGHT + 0.01)) / 2,
					-0.01,
				);
				this.root.add(corner);
			}
		}
		const spine = kit.cylinder(
			0.016,
			0.016,
			BOOK_PAGE_HEIGHT + 0.025,
			leather,
			10,
		);
		spine.position.z = -0.016;
		this.root.add(spine);
		const leftPage = new THREE.Mesh(curvedPage(-1), this.left);
		const rightPage = new THREE.Mesh(curvedPage(1), this.right);
		leftPage.position.z = 0.006;
		rightPage.position.z = 0.006;
		this.root.add(leftPage, rightPage);
		const front = new THREE.Mesh(curvedPage(1), this.flipFront);
		const back = new THREE.Mesh(curvedPage(-1), this.flipBack);
		back.rotation.y = Math.PI;
		back.position.z = -0.0006;
		this.flipGroup.add(front, back);
		this.flipGroup.position.z = 0.007;
		this.flipGroup.visible = false;
		this.root.add(this.flipGroup);
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
		this.root.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
			}
		});
	}
}
