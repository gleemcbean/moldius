import { EYE_HEIGHT_STANDING } from "@shared/config/index";
import type { ManorLayout } from "@shared/manor/types";
import * as THREE from "three";
import type { ModelKit } from "../../models/modelKit";
import { specialTexture } from "../../world/textures/textureFiles";

const VISIBLE_RANGE = 24;
const BOOK_ABOVE_EYES = 0.04;
const TURN_RATE = 5;

export class AltarViews {
	readonly group = new THREE.Group();

	private readonly books: {
		root: THREE.Object3D;
		y: number;
		phase: number;
		yaw: number;
	}[] = [];

	private readonly materials: THREE.Material[] = [];
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
	}

	private buildBook(kit: ModelKit): THREE.Object3D {
		const rig = kit.rig("world/altar_book");

		for (const [name, key] of [
			["page_left", "altarPageLeft"],
			["page_right", "altarPageRight"],
		] as const) {
			const texture = specialTexture(key);

			texture.magFilter = THREE.NearestFilter;

			const material = new THREE.MeshStandardMaterial({
				map: texture,
				roughness: 0.95,
				emissive: 0x6a5a30,
				emissiveMap: texture,
				emissiveIntensity: 0.55,
			});

			this.materials.push(material);

			rig.mesh(name).material = material;
		}

		return rig.root;
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
		for (const material of this.materials) {
			material.dispose();
		}
	}
}
