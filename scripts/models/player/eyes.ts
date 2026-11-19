import * as THREE from "three";
import type { MaterialOptions } from "../../../src/features/world/MaterialLibrary";
import type { BuildKit, Surface } from "../kit";

export interface EyeOptions {
	radius: number;
	sclera: Surface;
	iris?: Surface;
	irisAngle?: number;
	pupil?: Surface;
	pupilSize?: number;
	pupilShape?: [number, number];
	catchlight?: boolean;
	segments?: number;
}

const CATCHLIGHT: MaterialOptions = { color: 0xffffff, unlit: true };
const CATCHLIGHT_DIRECTION = new THREE.Vector3(-0.42, 0.5, 0.76).normalize();

export function buildEyeball(
	kit: BuildKit,
	name: string,
	options: EyeOptions,
): THREE.Group {
	const { radius } = options;
	const segments = options.segments ?? 16;
	const root = kit.pivot(name);
	const gaze = kit.pivot(`${name}_gaze`);
	root.add(kit.sphere(radius, options.sclera, [1, 1, 1], segments), gaze);
	if (options.iris) {
		const angle = options.irisAngle ?? 0.62;
		gaze.add(
			kit.mesh(
				new THREE.SphereGeometry(
					radius * 1.012,
					segments,
					4,
					0,
					Math.PI * 2,
					0,
					angle,
				).rotateX(Math.PI / 2),
				options.iris,
			),
		);
	}
	if (options.pupil) {
		const size = radius * (options.pupilSize ?? 0.3);
		const pupil = kit.named(
			`${name}_pupil`,
			kit.sphere(size, options.pupil, [1, 1, 0.4], 10),
		);
		pupil.position.z = Math.sqrt(radius * radius - size * size);
		const [shapeX, shapeY] = options.pupilShape ?? [1, 1];
		pupil.scale.set(shapeX, shapeY, 1);
		gaze.add(pupil);
	}
	if (options.catchlight ?? true) {
		const glint = kit.sphere(radius * 0.17, CATCHLIGHT, [1, 1, 0.5], 6);
		glint.position.copy(CATCHLIGHT_DIRECTION).multiplyScalar(radius * 0.99);
		glint.lookAt(CATCHLIGHT_DIRECTION.clone().multiplyScalar(2));
		root.add(glint);
	}
	return root;
}
