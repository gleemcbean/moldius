import * as THREE from "three";
import type { ModelKit } from "./modelKit";

export const CAMERA_BODY = { width: 0.15, height: 0.105, depth: 0.06 };
export const CAMERA_SCREEN_SIZE = 0.074;

export interface CameraModel {
	root: THREE.Group;
	screen: THREE.Mesh;
	flash: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
}

export function createCameraModel(
	kit: ModelKit,
	screenTexture: THREE.Texture | null = null,
): CameraModel {
	const root = new THREE.Group();
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
	const flash = new THREE.Mesh(
		new THREE.BoxGeometry(0.026, 0.014, 0.004),
		new THREE.MeshBasicMaterial({ color: 0xd8dde4 }),
	);
	flash.position.set(-0.05, height + 0.012, -depth * 0.4 - 0.002);
	root.add(flash);
	const screen = new THREE.Mesh(
		new THREE.PlaneGeometry(CAMERA_SCREEN_SIZE, CAMERA_SCREEN_SIZE),
		screenTexture
			? new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false })
			: new THREE.MeshStandardMaterial({
					color: 0x0c1014,
					roughness: 0.2,
					metalness: 0.4,
				}),
	);
	screen.position.set(-0.012, height / 2, depth / 2 + 0.001);
	root.add(screen);
	return { root, screen, flash };
}
