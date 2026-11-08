import * as THREE from "three";
import type { ModelKit } from "./modelKit";

/** Origine au bas du talkie, antenne vers le haut, grille vers +z. */
export function createWalkieModel(kit: ModelKit): THREE.Group {
	const root = new THREE.Group();
	const dark = { color: 0x24262a, roughness: 0.55, metalness: 0.2 };
	const body = kit.box(0.09, 0.17, 0.045, dark);
	body.position.y = 0.085;
	root.add(body);
	const grille = kit.box(0.066, 0.06, 0.006, {
		color: 0x4a4e55,
		roughness: 0.8,
	});
	grille.position.set(0, 0.12, 0.024);
	root.add(grille);
	const display = kit.box(0.05, 0.022, 0.004, {
		color: 0x9fdc8a,
		roughness: 0.3,
		emissive: 0x6fbf5a,
		emissiveIntensity: 1.2,
	});
	display.position.set(0, 0.066, 0.024);
	root.add(display);
	const antenna = kit.cylinder(0.005, 0.008, 0.16, dark);
	antenna.position.set(0.028, 0.25, 0);
	root.add(antenna);
	const knob = kit.cylinder(0.012, 0.012, 0.02, {
		color: 0xc23b2e,
		roughness: 0.5,
	});
	knob.position.set(-0.024, 0.18, 0);
	root.add(knob);
	return root;
}
