import * as THREE from "three";
import type { MaterialOptions } from "../world/MaterialLibrary";
import type { ModelKit } from "./modelKit";

const BRASS: MaterialOptions = {
	texture: "brass",
	roughness: 0.38,
	metalness: 0.8,
};
const IRON: MaterialOptions = {
	texture: "iron",
	roughness: 0.55,
	metalness: 0.55,
	side: THREE.DoubleSide,
};
const GLASS: MaterialOptions = {
	color: 0xffe6b0,
	roughness: 0.1,
	transparent: true,
	opacity: 0.22,
	depthWrite: false,
	side: THREE.DoubleSide,
};
const FLAME: MaterialOptions = {
	texture: "flame",
	unlit: true,
	transparent: true,
	alphaTest: 0.15,
	side: THREE.DoubleSide,
	depthWrite: false,
	fixedRepeat: true,
};

const SEGMENTS = 20;
const GLASS_RADIUS = 0.058;
const SHUTTER_RADIUS = 0.066;
const GLASS_BOTTOM = 0.03;
const GLASS_TOP = 0.19;
const RIBS = 6;
const BAIL_Y = 0.2225;
const HANDLE_Y = BAIL_Y + 0.08;

export class LanternModel {
	readonly root = new THREE.Group();
	readonly lightAnchor = new THREE.Object3D();
	readonly handle = new THREE.Object3D();
	private readonly shutter: THREE.Mesh;
	private readonly flames: THREE.Mesh[] = [];
	private readonly core: THREE.Mesh;
	private openness = 0;
	private time = Math.random() * 10;

	constructor(kit: ModelKit, scale = 1) {
		const base = kit.lathe(
			[
				[0.001, 0],
				[0.072, 0],
				[0.078, 0.006],
				[0.078, 0.014],
				[0.07, 0.02],
				[0.068, GLASS_BOTTOM],
				[0.001, GLASS_BOTTOM],
			],
			BRASS,
			SEGMENTS,
		);
		this.root.add(base);

		const glass = kit.mesh(
			new THREE.CylinderGeometry(
				GLASS_RADIUS,
				GLASS_RADIUS,
				GLASS_TOP - GLASS_BOTTOM,
				SEGMENTS,
				1,
				true,
			),
			GLASS,
		);
		glass.position.y = (GLASS_TOP + GLASS_BOTTOM) / 2;
		this.root.add(glass);

		for (const y of [GLASS_BOTTOM + 0.004, GLASS_TOP - 0.002]) {
			const ring = kit.mesh(
				new THREE.TorusGeometry(GLASS_RADIUS + 0.003, 0.004, 6, SEGMENTS),
				BRASS,
			);
			ring.rotation.x = Math.PI / 2;
			ring.position.y = y;
			this.root.add(ring);
		}
		for (let index = 0; index < RIBS; index += 1) {
			const angle = (index / RIBS) * Math.PI * 2;
			const rib = kit.cylinder(
				0.0035,
				0.0035,
				GLASS_TOP - GLASS_BOTTOM,
				BRASS,
				6,
			);
			rib.position.set(
				Math.cos(angle) * (GLASS_RADIUS + 0.002),
				(GLASS_TOP + GLASS_BOTTOM) / 2,
				Math.sin(angle) * (GLASS_RADIUS + 0.002),
			);
			this.root.add(rib);
		}

		const shutterHeight = GLASS_TOP - GLASS_BOTTOM;
		const shutterGeometry = new THREE.CylinderGeometry(
			SHUTTER_RADIUS,
			SHUTTER_RADIUS,
			shutterHeight,
			SEGMENTS,
			1,
			true,
		);
		shutterGeometry.translate(0, -shutterHeight / 2, 0);
		this.shutter = kit.mesh(shutterGeometry, IRON);
		this.shutter.position.y = GLASS_TOP;
		this.root.add(this.shutter);
		const shutterLip = kit.mesh(
			new THREE.TorusGeometry(SHUTTER_RADIUS, 0.003, 5, SEGMENTS),
			BRASS,
		);
		shutterLip.rotation.x = Math.PI / 2;
		shutterLip.position.y = -shutterHeight;
		this.shutter.add(shutterLip);

		const roof = kit.lathe(
			[
				[0.001, GLASS_TOP],
				[0.074, GLASS_TOP],
				[0.08, GLASS_TOP + 0.008],
				[0.076, GLASS_TOP + 0.016],
				[0.052, GLASS_TOP + 0.038],
				[0.024, GLASS_TOP + 0.056],
				[0.02, GLASS_TOP + 0.058],
				[0.001, GLASS_TOP + 0.058],
			],
			BRASS,
			SEGMENTS,
		);
		this.root.add(roof);
		const chimney = kit.cylinder(0.016, 0.018, 0.026, BRASS, 12);
		chimney.position.y = GLASS_TOP + 0.07;
		this.root.add(chimney);
		const cap = kit.lathe(
			[
				[0.001, GLASS_TOP + 0.08],
				[0.026, GLASS_TOP + 0.08],
				[0.022, GLASS_TOP + 0.088],
				[0.001, GLASS_TOP + 0.094],
			],
			BRASS,
			12,
		);
		this.root.add(cap);

		const candle = kit.cylinder(
			0.014,
			0.016,
			0.05,
			{ texture: "wax", roughness: 0.6 },
			10,
		);
		candle.position.y = 0.055;
		this.root.add(candle);
		for (const rotation of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
			const flame = kit.mesh(new THREE.PlaneGeometry(0.04, 0.075), FLAME);
			flame.position.y = 0.115;
			flame.rotation.y = rotation;
			this.root.add(flame);
			this.flames.push(flame);
		}
		this.core = kit.sphere(
			0.015,
			{ color: 0xffe8a0, unlit: true },
			[1, 1.6, 1],
			8,
		);
		this.core.position.y = 0.102;
		this.root.add(this.core);

		const bail = kit.mesh(
			new THREE.TorusGeometry(0.058, 0.0045, 6, 18, Math.PI),
			BRASS,
		);
		bail.position.y = BAIL_Y;
		this.root.add(bail);
		for (const side of [-1, 1]) {
			const lug = kit.sphere(0.008, BRASS, [1, 1, 1], 8);
			lug.position.set(side * 0.058, BAIL_Y, 0);
			this.root.add(lug);
		}
		const ring = kit.mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 12), BRASS);
		ring.position.y = BAIL_Y + 0.072;
		this.root.add(ring);
		this.handle.position.y = HANDLE_Y;
		this.root.add(this.handle);
		this.lightAnchor.position.y = 0.115;
		this.root.add(this.lightAnchor);
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
