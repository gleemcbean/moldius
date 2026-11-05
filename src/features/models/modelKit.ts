import * as THREE from "three";
import { meterLathe, meterSphere, scaleUv } from "../world/geometryUtils";
import type {
	MaterialLibrary,
	MaterialOptions,
} from "../world/MaterialLibrary";

export type Surface = MaterialOptions | THREE.Material;

export class ModelKit {
	constructor(readonly materials: MaterialLibrary) {}

	material(options: Surface): THREE.Material {
		return options instanceof THREE.Material
			? options
			: this.materials.get(options);
	}

	unique(options: MaterialOptions): THREE.Material {
		return this.materials.fresh(options);
	}

	mesh(geometry: THREE.BufferGeometry, options: Surface): THREE.Mesh {
		const mesh = new THREE.Mesh(geometry, this.material(options));
		mesh.castShadow = false;
		mesh.receiveShadow = false;
		return mesh;
	}

	lathe(
		profile: [number, number][],
		options: Surface,
		segments = 24,
	): THREE.Mesh {
		return this.mesh(
			meterLathe(
				profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
				segments,
			),
			options,
		);
	}

	sphere(
		radius: number,
		options: Surface,
		scale: [number, number, number] = [1, 1, 1],
		segments = 18,
	): THREE.Mesh {
		const geometry = meterSphere(
			radius,
			segments,
			Math.max(8, Math.round(segments * 0.7)),
		);
		geometry.scale(...scale);
		return this.mesh(geometry, options);
	}

	capsule(
		radius: number,
		length: number,
		options: Surface,
		radial = 12,
	): THREE.Mesh {
		const geometry = new THREE.CapsuleGeometry(radius, length, 4, radial);
		scaleUv(geometry, Math.PI * 2 * radius, length + radius * 2);
		return this.mesh(geometry, options);
	}

	limb(
		radius: number,
		length: number,
		options: Surface,
		radial = 12,
	): THREE.Mesh {
		const mesh = this.capsule(radius, length, options, radial);
		mesh.position.y = -length / 2;
		return mesh;
	}

	box(
		width: number,
		height: number,
		depth: number,
		options: Surface,
	): THREE.Mesh {
		const geometry = new THREE.BoxGeometry(width, height, depth);
		return this.mesh(geometry, options);
	}

	cylinder(
		top: number,
		bottom: number,
		height: number,
		options: Surface,
		segments = 14,
	): THREE.Mesh {
		return this.mesh(
			new THREE.CylinderGeometry(top, bottom, height, segments),
			options,
		);
	}

	cone(
		radius: number,
		height: number,
		options: Surface,
		segments = 10,
	): THREE.Mesh {
		return this.mesh(new THREE.ConeGeometry(radius, height, segments), options);
	}

	tube(
		points: [number, number, number][],
		radius: (t: number) => number,
		options: Surface,
		tubular = 16,
		radial = 8,
	): THREE.Mesh {
		const curve = new THREE.CatmullRomCurve3(
			points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
		);
		const geometry = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
		const position = geometry.getAttribute("position") as THREE.BufferAttribute;
		const center = new THREE.Vector3();
		const vertex = new THREE.Vector3();
		for (let ring = 0; ring <= tubular; ring += 1) {
			curve.getPointAt(ring / tubular, center);
			const scale = radius(ring / tubular);
			for (let side = 0; side <= radial; side += 1) {
				const index = ring * (radial + 1) + side;
				vertex
					.fromBufferAttribute(position, index)
					.sub(center)
					.multiplyScalar(scale)
					.add(center);
				position.setXYZ(index, vertex.x, vertex.y, vertex.z);
			}
		}
		scaleUv(geometry, curve.getLength(), Math.PI * 2 * radius(0.5));
		return this.mesh(geometry, options);
	}

	pleatedLathe(
		profile: [number, number][],
		options: Surface,
		pleats: number,
		depth: (radius: number, height: number) => number,
		segments = 32,
	): THREE.Mesh {
		const geometry = meterLathe(
			profile.map(([radius, height]) => new THREE.Vector2(radius, height)),
			segments,
		);
		const position = geometry.getAttribute("position") as THREE.BufferAttribute;
		for (let index = 0; index < position.count; index += 1) {
			const x = position.getX(index);
			const y = position.getY(index);
			const z = position.getZ(index);
			const radius = Math.hypot(x, z);
			const fold = 1 + Math.sin(Math.atan2(z, x) * pleats) * depth(radius, y);
			position.setXYZ(index, x * fold, y, z * fold);
		}
		geometry.computeVertexNormals();
		const normal = geometry.getAttribute("normal") as THREE.BufferAttribute;
		const rows = profile.length;
		for (let row = 0; row < rows; row += 1) {
			const first = row;
			const last = segments * rows + row;
			const x = normal.getX(first) + normal.getX(last);
			const y = normal.getY(first) + normal.getY(last);
			const z = normal.getZ(first) + normal.getZ(last);
			const length = Math.hypot(x, y, z) || 1;
			normal.setXYZ(first, x / length, y / length, z / length);
			normal.setXYZ(last, x / length, y / length, z / length);
		}
		return this.mesh(geometry, options);
	}

	pivot(name: string, x = 0, y = 0, z = 0): THREE.Group {
		const group = new THREE.Group();
		group.name = name;
		group.position.set(x, y, z);
		return group;
	}
}

export function disposeObject(root: THREE.Object3D): void {
	root.traverse((object) => {
		if (object instanceof THREE.Mesh) {
			object.geometry.dispose();
		}
	});
}

export function setOpacity(root: THREE.Object3D, opacity: number): void {
	root.traverse((object) => {
		if (object instanceof THREE.Mesh) {
			object.visible = opacity > 0.02;
		}
	});
}

export function modelYaw(yaw: number): number {
	return yaw + Math.PI;
}
