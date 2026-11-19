import * as THREE from "three";
import {
	CAMERA_BODY,
	CAMERA_SCREEN_SIZE,
} from "../../../src/features/models/cameraModel";
import type { BuildKit } from "../kit";

export function buildCamera(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "camera";
	const { width, height, depth } = CAMERA_BODY;
	const dark = { color: 0x2a2724, roughness: 0.6, metalness: 0.15 };
	const body = kit.box(width, height, depth, dark);
	body.position.y = height / 2;
	root.add(body);
	const grip = kit.box(0.032, height * 0.92, depth * 1.25, {
		color: 0x1a1816,
		roughness: 0.85,
	});
	grip.position.set(width / 2 - 0.016, height * 0.46, -depth * 0.12);
	root.add(grip);
	const hump = kit.box(0.05, 0.026, depth * 0.8, dark);
	hump.position.set(-0.012, height + 0.012, 0);
	root.add(hump);
	const lens = kit.cylinder(0.034, 0.038, 0.05, {
		color: 0x15151a,
		roughness: 0.35,
		metalness: 0.5,
	});
	lens.rotation.x = Math.PI / 2;
	lens.position.set(-0.012, height / 2, -depth / 2 - 0.024);
	root.add(lens);
	const glass = kit.cylinder(0.026, 0.026, 0.004, {
		color: 0x334466,
		roughness: 0.1,
		metalness: 0.8,
		emissive: 0x1a2a44,
		emissiveIntensity: 0.6,
	});
	glass.rotation.x = Math.PI / 2;
	glass.position.set(-0.012, height / 2, -depth / 2 - 0.05);
	root.add(glass);
	const button = kit.cylinder(0.01, 0.01, 0.012, {
		color: 0xc23b2e,
		roughness: 0.5,
	});
	button.position.set(width / 2 - 0.018, height + 0.005, 0.006);
	root.add(button);
	const flash = kit.named(
		"flash",
		kit.mesh(new THREE.BoxGeometry(0.026, 0.014, 0.004), {
			color: 0xd8dde4,
			unlit: true,
		}),
	);
	flash.position.set(-0.05, height + 0.012, -depth * 0.4 - 0.002);
	root.add(flash);
	const screen = kit.named(
		"screen",
		kit.mesh(new THREE.PlaneGeometry(CAMERA_SCREEN_SIZE, CAMERA_SCREEN_SIZE), {
			color: 0x0c1014,
			roughness: 0.2,
			metalness: 0.4,
		}),
	);
	screen.position.set(-0.012, height / 2, depth / 2 + 0.001);
	root.add(screen);
	return root;
}

export function buildWalkie(kit: BuildKit): THREE.Group {
	const root = new THREE.Group();
	root.name = "walkie";
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
	const display = kit.named(
		"display",
		kit.box(0.05, 0.022, 0.004, {
			color: 0x9fdc8a,
			roughness: 0.3,
			emissive: 0x6fbf5a,
			emissiveIntensity: 1.2,
		}),
	);
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
