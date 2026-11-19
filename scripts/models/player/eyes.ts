import * as THREE from "three";
import type { MaterialOptions } from "../world/MaterialLibrary";
import type { ModelKit, Surface } from "./modelKit";

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

export class Eyeball {
	readonly root = new THREE.Group();
	private readonly gaze = new THREE.Group();
	private readonly pupil: THREE.Mesh | null = null;
	private readonly pupilShape: [number, number];

	constructor(kit: ModelKit, options: EyeOptions) {
		const { radius } = options;
		const segments = options.segments ?? 16;
		this.root.add(
			kit.sphere(radius, options.sclera, [1, 1, 1], segments),
			this.gaze,
		);
		if (options.iris) {
			const angle = options.irisAngle ?? 0.62;
			const iris = kit.mesh(
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
			);
			this.gaze.add(iris);
		}
		this.pupilShape = options.pupilShape ?? [1, 1];
		if (options.pupil) {
			const size = radius * (options.pupilSize ?? 0.3);
			this.pupil = kit.sphere(size, options.pupil, [1, 1, 0.4], 10);
			this.pupil.position.z = Math.sqrt(radius * radius - size * size);
			this.gaze.add(this.pupil);
			this.dilate(1);
		}
		if (options.catchlight ?? true) {
			const glint = kit.sphere(radius * 0.17, CATCHLIGHT, [1, 1, 0.5], 6);
			glint.position.copy(CATCHLIGHT_DIRECTION).multiplyScalar(radius * 0.99);
			glint.lookAt(CATCHLIGHT_DIRECTION.clone().multiplyScalar(2));
			this.root.add(glint);
		}
	}

	look(yaw: number, pitch: number): void {
		this.gaze.rotation.set(-pitch, yaw, 0);
	}

	dilate(scale: number): void {
		this.pupil?.scale.set(
			scale * this.pupilShape[0],
			scale * this.pupilShape[1],
			1,
		);
	}
}
