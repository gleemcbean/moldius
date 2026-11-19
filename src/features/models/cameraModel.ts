import * as THREE from "three";
import type { ModelKit } from "./modelKit";

export const CAMERA_BODY = { width: 0.15, height: 0.105, depth: 0.06 };
export const CAMERA_SCREEN_SIZE = 0.074;

export interface CameraModel {
	root: THREE.Object3D;
	screen: THREE.Mesh;
	flash: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

export function createCameraModel(
	kit: ModelKit,
	screenTexture: THREE.Texture | null = null,
): CameraModel {
	const rig = kit.rig("tools/camera");
	const screen = rig.mesh("screen");
	screen.material = screenTexture
		? new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false })
		: new THREE.MeshStandardMaterial({
				color: 0x0c1014,
				roughness: 0.2,
				metalness: 0.4,
			});
	const flash = rig.mesh("flash") as THREE.Mesh<
		THREE.BufferGeometry,
		THREE.MeshBasicMaterial
	>;
	flash.material = new THREE.MeshBasicMaterial({ color: 0xd8dde4 });
	return { root: rig.root, screen, flash };
}
