import * as THREE from "three";
import { type ModelKit, PartList } from "../models/modelKit";
import { roundedBox } from "../world/furniture/parts";
import {
	meterBox,
	meterCylinder,
	meterLathe,
	meterSphere,
	meterTorus,
	placed,
	scaleUv,
} from "../world/geometryUtils";
import type { MaterialOptions } from "../world/MaterialLibrary";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./pageRenderer";

const FLIP_SECONDS = 0.38;
const FLIP_MIN_SECONDS = 0.09;
export const BOOK_PAGE_WIDTH = 0.205;
export const BOOK_PAGE_HEIGHT = BOOK_PAGE_WIDTH * (PAGE_HEIGHT / PAGE_WIDTH);
const COVER_THICKNESS = 0.012;
const PAGE_BLOCK = 0.014;
const LEATHER: MaterialOptions = {
	texture: "leather",
	color: 0x7a2a1e,
	roughness: 0.7,
};
const TOOLED: MaterialOptions = {
	texture: "leather",
	color: 0x4e1a12,
	roughness: 0.7,
};
const BRASS: MaterialOptions = {
	texture: "brass",
	roughness: 0.4,
	metalness: 0.7,
};
const PAPER: MaterialOptions = {
	texture: "paper",
	color: 0xe8d8b0,
	roughness: 1,
};
const EDGES: MaterialOptions = { texture: "pageEdges", roughness: 1 };
const RIBBON: MaterialOptions = { texture: "velvetRed", roughness: 0.9 };
const HEADBAND: MaterialOptions = { texture: "velvetGreen", roughness: 0.9 };
const STRAP: MaterialOptions = {
	texture: "leather",
	color: 0x5a2016,
	roughness: 0.7,
};

function edgePlane(length: number, thickness: number): THREE.BufferGeometry {
	return scaleUv(new THREE.PlaneGeometry(length, thickness), length, thickness);
}

function cornerGuard(): THREE.BufferGeometry {
	const shape = new THREE.Shape();
	shape.moveTo(0.004, 0.004);
	shape.lineTo(-0.034, 0.004);
	shape.lineTo(0.004, -0.034);
	shape.closePath();
	const geometry = new THREE.ExtrudeGeometry(shape, {
		depth: COVER_THICKNESS + 0.003,
		bevelEnabled: true,
		bevelThickness: 0.0012,
		bevelSize: 0.0012,
		bevelSegments: 2,
		curveSegments: 1,
	});
	geometry.translate(0, 0, -(COVER_THICKNESS + 0.003) / 2);
	return geometry;
}

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
		const parts = new PartList();
		const coverWidth = BOOK_PAGE_WIDTH + 0.015;
		const coverHeight = BOOK_PAGE_HEIGHT + 0.025;
		const blockWidth = BOOK_PAGE_WIDTH - 0.006;
		const blockHeight = BOOK_PAGE_HEIGHT - 0.008;
		for (const side of [-1, 1] as const) {
			parts.add(
				LEATHER,
				placed(
					roundedBox(coverWidth, coverHeight, COVER_THICKNESS, 0.0035, 2),
					(side * coverWidth) / 2,
					0,
					-0.012,
				),
			);
			const insetWidth = coverWidth - 0.036;
			const insetHeight = coverHeight - 0.036;
			const frameX = (side * coverWidth) / 2;
			const back = -0.012 - COVER_THICKNESS / 2;
			for (const [width, height, x, y] of [
				[insetWidth, 0.004, frameX, insetHeight / 2],
				[insetWidth, 0.004, frameX, -insetHeight / 2],
				[0.004, insetHeight, frameX - insetWidth / 2, 0],
				[0.004, insetHeight, frameX + insetWidth / 2, 0],
			] as const) {
				parts.add(
					TOOLED,
					placed(roundedBox(width, height, 0.003, 0.0012), x, y, back),
				);
			}
			parts.add(
				BRASS,
				placed(
					meterLathe(
						[
							[0.001, 0.0045],
							[0.008, 0.0042],
							[0.016, 0.0028],
							[0.021, 0.001],
							[0.022, 0],
							[0.001, 0],
						].map(([radius, height]) => new THREE.Vector2(radius, height)),
						28,
					),
					frameX,
					0,
					back,
					0,
					-Math.PI / 2,
				),
			);
			for (const [dx, dy] of [
				[-1, -1],
				[-1, 1],
				[1, -1],
				[1, 1],
			] as const) {
				parts.add(
					BRASS,
					placed(
						meterSphere(0.005, 12, 8).scale(1, 1, 0.55),
						frameX + dx * (insetWidth / 2 - 0.012),
						dy * (insetHeight / 2 - 0.012),
						back,
					),
				);
			}
			for (const corner of [-1, 1] as const) {
				parts.add(
					BRASS,
					placed(
						cornerGuard(),
						side * coverWidth,
						(corner * coverHeight) / 2,
						-0.012,
						0,
						0,
						side === 1
							? corner === 1
								? 0
								: -Math.PI / 2
							: corner === 1
								? Math.PI / 2
								: Math.PI,
					),
				);
			}
			parts.add(
				PAPER,
				placed(
					meterBox(blockWidth, blockHeight, PAGE_BLOCK),
					(side * BOOK_PAGE_WIDTH) / 2,
					0,
					-0.003,
				),
			);
			parts.add(
				EDGES,
				placed(
					edgePlane(blockHeight, PAGE_BLOCK),
					side * (BOOK_PAGE_WIDTH / 2 + blockWidth / 2) + side * 0.0002,
					0,
					-0.003,
					(side * Math.PI) / 2,
					0,
					Math.PI / 2,
				),
			);
			for (const end of [-1, 1] as const) {
				parts.add(
					EDGES,
					placed(
						edgePlane(blockWidth, PAGE_BLOCK),
						(side * BOOK_PAGE_WIDTH) / 2,
						end * (blockHeight / 2 + 0.0002),
						-0.003,
						0,
						(-end * Math.PI) / 2,
					),
				);
			}
		}
		const spineProfile: [number, number][] = [
			[0.001, -coverHeight / 2],
			[0.0155, -coverHeight / 2],
			[0.0165, -coverHeight / 2 + 0.004],
		];
		for (const band of [-0.3, -0.1, 0.1, 0.3]) {
			const y = band * coverHeight;
			spineProfile.push(
				[0.0165, y - 0.006],
				[0.0188, y - 0.003],
				[0.0188, y + 0.003],
				[0.0165, y + 0.006],
			);
		}
		spineProfile.push(
			[0.0165, coverHeight / 2 - 0.004],
			[0.0155, coverHeight / 2],
			[0.001, coverHeight / 2],
		);
		parts.add(
			LEATHER,
			placed(
				meterLathe(
					spineProfile.map(
						([radius, height]) => new THREE.Vector2(radius, height),
					),
					20,
				),
				0,
				0,
				-0.016,
			),
		);
		for (const end of [-1, 1] as const) {
			parts.add(
				HEADBAND,
				placed(
					meterCylinder(0.0028, 0.0028, 0.026, 8),
					0,
					end * (blockHeight / 2 - 0.001),
					-0.004,
					0,
					0,
					Math.PI / 2,
				),
			);
		}
		parts.add(
			RIBBON,
			placed(
				roundedBox(0.007, BOOK_PAGE_HEIGHT * 0.62, 0.0008, 0.0003),
				0.009,
				-BOOK_PAGE_HEIGHT * 0.36,
				0.0062,
			),
		);
		parts.add(
			RIBBON,
			placed(
				roundedBox(0.007, 0.05, 0.0008, 0.0003),
				0.012,
				-BOOK_PAGE_HEIGHT / 2 - 0.02,
				0.003,
				0,
				0.5,
				-0.18,
			),
		);
		parts.add(
			STRAP,
			placed(
				roundedBox(0.055, 0.022, 0.0032, 0.0012),
				coverWidth + 0.022,
				0,
				-0.0175,
			),
		);
		parts.add(
			BRASS,
			placed(meterTorus(0.0105, 0.0022, 6, 18), coverWidth + 0.048, 0, -0.0175),
		);
		parts.add(
			BRASS,
			placed(
				meterCylinder(0.0016, 0.0016, 0.021, 6),
				coverWidth + 0.048,
				0,
				-0.0175,
			),
		);
		parts.build(kit, this.root);
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
