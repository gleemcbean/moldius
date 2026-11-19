import * as THREE from "three";
import type { MaterialOptions } from "../world/MaterialLibrary";
import type { ModelKit } from "./modelKit";

export const GLASS: MaterialOptions = {
	color: 0xffe6b0,
	roughness: 0.1,
	transparent: true,
	opacity: 0.22,
	depthWrite: false,
	side: THREE.DoubleSide,
};
export const FLAME: MaterialOptions = {
	texture: "flame",
	unlit: true,
	transparent: true,
	alphaTest: 0.15,
	side: THREE.DoubleSide,
	depthWrite: false,
	fixedRepeat: true,
};
export const HANDLE_Y = 0.2225 + 0.08;
export const FLAME_HEIGHT = 0.115;
export const CORE_HEIGHT = 0.102;

function towardWhite(color: number, amount: number): number {
	return new THREE.Color(color)
		.lerp(new THREE.Color(0xffffff), amount)
		.getHex();
}

export class LanternModel {
	readonly root: THREE.Object3D;
	readonly lightAnchor: THREE.Object3D;
	readonly handle: THREE.Object3D;
	private readonly shutter: THREE.Object3D;
	private readonly flames: THREE.Mesh[];
	private readonly core: THREE.Mesh;
	private openness = 0;
	private time = Math.random() * 10;

	constructor(kit: ModelKit, scale = 1, tint: number | null = null) {
		const rig = kit.rig("tools/lantern");
		this.root = rig.root;
		this.lightAnchor = rig.node("light");
		this.handle = rig.node("handle");
		this.shutter = rig.node("shutter");
		this.flames = rig.meshes("flame");
		this.core = rig.mesh("core");
		if (tint !== null) {
			rig.mesh("glass").material = kit.material({
				...GLASS,
				color: towardWhite(tint, 0.55),
			});
			const flame = kit.material({
				...FLAME,
				texture: "flameNeutral",
				color: tint,
			});
			for (const mesh of this.flames) {
				mesh.material = flame;
			}
			this.core.material = kit.material({
				color: towardWhite(tint, 0.6),
				unlit: true,
			});
		}
		this.root.scale.setScalar(scale);
	}

	get height(): number {
		return HANDLE_Y * this.root.scale.y;
	}

	update(dt: number, open: boolean): number {
		this.time += dt;
		const target = open ? 1 : 0;
		this.openness += (target - this.openness) * Math.min(1, dt * 10);
		this.shutter.scale.y = Math.max(0.06, 1 - this.openness * 0.94);
		this.shutter.rotation.y = this.openness * 0.6;
		const flicker =
			0.85 +
			Math.sin(this.time * 17) * 0.06 +
			Math.sin(this.time * 31 + 1.3) * 0.05;
		for (const flame of this.flames) {
			flame.scale.set(0.9 + Math.sin(this.time * 23) * 0.08, flicker, 1);
			flame.visible = this.openness > 0.05;
		}
		this.core.visible = true;
		return this.openness * flicker;
	}
}
