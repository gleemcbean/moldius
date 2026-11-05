import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { MaterialLibrary, MaterialOptions } from "./MaterialLibrary";

export class GeometryBucket {
	private readonly groups = new Map<
		string,
		{ options: MaterialOptions; geometries: THREE.BufferGeometry[] }
	>();

	constructor(private readonly materials: MaterialLibrary) {}

	add(
		options: MaterialOptions,
		geometry: THREE.BufferGeometry,
		matrix?: THREE.Matrix4,
	): void {
		const prepared = geometry;
		if (!prepared.index) {
			const count = prepared.getAttribute("position").count;
			prepared.setIndex(Array.from({ length: count }, (_, vertex) => vertex));
		}
		if (matrix) {
			prepared.applyMatrix4(matrix);
		}
		for (const name of Object.keys(prepared.attributes)) {
			if (name !== "position" && name !== "normal" && name !== "uv") {
				prepared.deleteAttribute(name);
			}
		}
		if (!prepared.getAttribute("uv")) {
			prepared.setAttribute(
				"uv",
				new THREE.Float32BufferAttribute(
					new Float32Array(prepared.getAttribute("position").count * 2),
					2,
				),
			);
		}
		if (!prepared.getAttribute("normal")) {
			prepared.computeVertexNormals();
		}
		const key = this.materials.key(options);
		const group = this.groups.get(key);
		if (group) {
			group.geometries.push(prepared);
		} else {
			this.groups.set(key, { options, geometries: [prepared] });
		}
	}

	get isEmpty(): boolean {
		return this.groups.size === 0;
	}

	toMeshes(): THREE.Mesh[] {
		const meshes: THREE.Mesh[] = [];
		for (const { options, geometries } of this.groups.values()) {
			const merged =
				geometries.length === 1
					? geometries[0]
					: mergeGeometries(geometries, false);
			if (geometries.length > 1) {
				for (const geometry of geometries) {
					geometry.dispose();
				}
			}
			if (!merged) {
				continue;
			}
			merged.computeBoundingSphere();
			merged.computeBoundingBox();
			const mesh = new THREE.Mesh(merged, this.materials.get(options));
			mesh.matrixAutoUpdate = false;
			mesh.updateMatrix();
			if (options.transparent) {
				mesh.renderOrder = 2;
			}
			meshes.push(mesh);
		}
		this.groups.clear();
		return meshes;
	}
}
