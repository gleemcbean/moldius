import { EYE_HEIGHT_STANDING } from "@shared/config/index";
import type { ManorLayout } from "@shared/manor/types";
import { hashString, SeededRandom } from "@shared/random";
import * as THREE from "three";
import type { ModelKit } from "../../models/modelKit";
import { disposeModel } from "../../models/occultModels";

const VISIBLE_RANGE = 24;
const BOOK_ABOVE_EYES = 0.04;
const TURN_RATE = 5;

function pageCanvas(seed: string, mirrored: boolean): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = 96;
	canvas.height = 128;
	const context = canvas.getContext("2d") as CanvasRenderingContext2D;
	const rng = new SeededRandom(hashString(seed));
	context.fillStyle = "#e6d6ac";
	context.fillRect(0, 0, 96, 128);
	context.fillStyle = "#2c1a10";
	for (let y = 10; y < 122; y += 7) {
		if (!mirrored && y > 32 && y < 88) {
			continue;
		}
		let x = 10;
		while (x < 84) {
			const word = rng.int(5, 15);
			context.fillRect(x, y, Math.min(word, 86 - x), 2);
			x += word + 3;
		}
	}
	if (!mirrored) {
		context.strokeStyle = "#0fae9f";
		context.lineWidth = 2;
		context.beginPath();
		for (let index = 0; index <= 5; index += 1) {
			const angle = (index * 2 * 2 * Math.PI) / 5 - Math.PI / 2;
			const x = 48 + Math.cos(angle) * 24;
			const y = 60 + Math.sin(angle) * 24;
			if (index === 0) {
				context.moveTo(x, y);
			} else {
				context.lineTo(x, y);
			}
		}
		context.stroke();
		context.beginPath();
		context.arc(48, 60, 26, 0, Math.PI * 2);
		context.stroke();
	}
	return canvas;
}

export class AltarViews {
	readonly group = new THREE.Group();
	private readonly books: {
		root: THREE.Group;
		y: number;
		phase: number;
		yaw: number;
	}[] = [];
	private readonly geometries: THREE.BufferGeometry[] = [];
	private readonly textures: THREE.Texture[] = [];
	private readonly materials: THREE.Material[] = [];
	private readonly template: THREE.Group;
	private time = 0;

	constructor(layout: ManorLayout, kit: ModelKit) {
		const template = this.buildBook(kit);
		for (const altar of layout.altars) {
			const root = template.clone();
			const y = altar.y + EYE_HEIGHT_STANDING + BOOK_ABOVE_EYES;
			root.position.set(altar.x, y, altar.z);
			this.group.add(root);
			this.books.push({ root, y, phase: altar.id * 2.1, yaw: 0 });
		}
		this.template = template;
	}

	private buildBook(kit: ModelKit): THREE.Group {
		const book = new THREE.Group();
		const pageGeometry = new THREE.PlaneGeometry(0.17, 0.23);
		this.geometries.push(pageGeometry);
		const lean = 0.32;
		for (const side of [-1, 1]) {
			const hinge = new THREE.Group();
			hinge.rotation.y = -side * lean;
			const cover = kit.box(0.185, 0.245, 0.012, {
				texture: "leather",
				color: 0x6a2bb0,
				roughness: 0.7,
			});
			cover.position.set((side * 0.185) / 2, 0, -0.012);
			hinge.add(cover);
			const block = kit.box(0.17, 0.23, 0.018, {
				color: 0xd9c89c,
				roughness: 1,
			});
			block.position.set((side * 0.17) / 2, 0, 0.003);
			hinge.add(block);
			const texture = new THREE.CanvasTexture(
				pageCanvas(`altar-${side}`, side > 0),
			);
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.magFilter = THREE.NearestFilter;
			this.textures.push(texture);
			const material = new THREE.MeshStandardMaterial({
				map: texture,
				roughness: 0.95,
				emissive: 0x6a5a30,
				emissiveMap: texture,
				emissiveIntensity: 0.55,
			});
			this.materials.push(material);
			const page = new THREE.Mesh(pageGeometry, material);
			page.position.set((side * 0.17) / 2, 0, 0.0125);
			hinge.add(page);
			for (const y of [-1, 1]) {
				const corner = kit.box(0.026, 0.026, 0.016, {
					texture: "brass",
					color: 0xffd98a,
					roughness: 0.4,
					metalness: 0.7,
				});
				corner.position.set(side * 0.172, (y * 0.23) / 2, -0.01);
				hinge.add(corner);
			}
			book.add(hinge);
		}
		const spine = kit.cylinder(0.012, 0.012, 0.245, {
			texture: "leather",
			color: 0x4a1a80,
		});
		spine.position.z = -0.018;
		book.add(spine);
		return book;
	}

	update(dt: number, eye: THREE.Vector3): void {
		this.time += dt;
		const facing = new THREE.Vector3();
		for (const book of this.books) {
			const { root } = book;
			const near =
				root.position.distanceToSquared(eye) < VISIBLE_RANGE * VISIBLE_RANGE;
			root.visible = near;
			if (!near) {
				continue;
			}
			root.position.y = book.y + Math.sin(this.time * 1.4 + book.phase) * 0.035;
			facing.subVectors(eye, root.position);
			const target = Math.atan2(facing.x, facing.z);
			const delta = Math.atan2(
				Math.sin(target - book.yaw),
				Math.cos(target - book.yaw),
			);
			book.yaw += delta * Math.min(1, dt * TURN_RATE);
			const pitch = -Math.atan2(facing.y, Math.hypot(facing.x, facing.z));
			root.rotation.set(
				pitch * 0.85 + Math.sin(this.time * 0.9 + book.phase) * 0.04,
				book.yaw,
				Math.sin(this.time * 0.7 + book.phase) * 0.03,
				"YXZ",
			);
		}
	}

	dispose(): void {
		disposeModel(this.template);
		for (const geometry of this.geometries) {
			geometry.dispose();
		}
		for (const texture of this.textures) {
			texture.dispose();
		}
		for (const material of this.materials) {
			material.dispose();
		}
	}
}
