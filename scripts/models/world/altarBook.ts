import * as THREE from "three";
import type { BuildKit } from "../kit";

export function buildAltarBook(kit: BuildKit): THREE.Group {
	const book = new THREE.Group();

	book.name = "altar_book";

	const pageGeometry = new THREE.PlaneGeometry(0.17, 0.23);
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

		const page = kit.named(
			side < 0 ? "page_left" : "page_right",
			kit.mesh(pageGeometry.clone(), {
				color: 0xe6d6ac,
				roughness: 0.95,
				emissive: 0x6a5a30,
				emissiveIntensity: 0.55,
			}),
		);

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

export function buildStakeOrb(kit: BuildKit): THREE.Mesh {
	const orb = kit.mesh(new THREE.SphereGeometry(0.09, 12, 10), {
		color: 0xffffff,
		unlit: true,
		fog: false,
	});

	orb.name = "stake_orb";

	return orb;
}
