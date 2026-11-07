import { DEFAULT_HAT_PATTERN, type HatPattern } from "@shared/hatPatterns";
import * as THREE from "three";
import type { MaterialOptions } from "../../world/MaterialLibrary";
import { MUSHROOM_CAP_REST, MushroomModel } from "../MushroomModel";
import type { ModelKit } from "../modelKit";
import {
	AnomalyModel,
	type AnomalyPoseInput,
	easeOut,
	type GlowSpec,
} from "./AnomalyModel";
import { deform, hoodGeometry, SOCKET, wobbleSphere } from "./parts";

const TEETH: MaterialOptions = { color: 0xd2c4a2, roughness: 0.4 };
const IRON: MaterialOptions = {
	texture: "iron",
	color: 0x5a524c,
	roughness: 0.6,
	metalness: 0.5,
};
const CAP_HINGE = 0.2;
const SAC_SCALE = 0.72;
const PORTRAIT_CAP_OPENING = 0.5;
const ARCHIVIST_ROBE: [number, number][] = [
	[0.001, 0.0],
	[0.35, 0.05],
	[0.28, 0.5],
	[0.22, 1.0],
	[0.18, 1.3],
	[0.001, 1.35],
];
const ARCHIVIST_ROBE_BASE = 0.55;
const BRAZIER_BOWL: [number, number][] = [
	[0.001, -0.3],
	[0.14, -0.28],
	[0.28, -0.19],
	[0.37, -0.05],
	[0.41, 0.07],
	[0.37, 0.1],
];
const BRAZIER_HEIGHT = 1.12;
const BRAZIER_THIGH = 0.6;
const BRAZIER_SHIN = 1.41;
const BRAZIER_LIFT = 2.5;
const BRAZIER_KNEE = -2.38;
const WISP_BELL: [number, number][] = [
	[0.001, 0.17],
	[0.1, 0.15],
	[0.17, 0.08],
	[0.2, -0.02],
	[0.19, -0.08],
	[0.21, -0.12],
];

interface BrazierLeg {
	hip: THREE.Group;
	thigh: THREE.Group;
	angle: number;
	group: number;
}

export class BrasierModel extends AnomalyModel {
	private readonly body: THREE.Group;
	private readonly fire: THREE.MeshBasicMaterial;
	private readonly coals = new THREE.Object3D();
	private readonly flames: THREE.Mesh[] = [];
	private readonly light: GlowSpec;
	private readonly legs: BrazierLeg[] = [];

	constructor(kit: ModelKit) {
		super(kit);
		const charcoal: MaterialOptions = { color: 0x1a1412, roughness: 0.9 };
		this.fire = this.own(new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
		this.body = kit.pivot("body", 0, BRAZIER_HEIGHT, 0);
		this.root.add(this.body);
		this.body.add(
			kit.lathe(BRAZIER_BOWL, { ...IRON, side: THREE.DoubleSide }, 20),
		);
		const rim = kit.mesh(
			new THREE.TorusGeometry(0.395, 0.035, 6, 24).rotateX(Math.PI / 2),
			IRON,
		);
		rim.position.y = 0.085;
		this.body.add(rim);
		const bed = kit.sphere(0.36, this.fire, [1, 0.32, 1], 18);
		bed.position.y = 0.05;
		this.body.add(bed);
		for (const [x, z, size] of [
			[-0.12, 0.06, 0.11],
			[0.14, -0.1, 0.09],
			[0.03, 0.17, 0.08],
		]) {
			const lump = kit.sphere(size, charcoal, [1, 0.7, 1], 8);
			lump.position.set(x, 0.12, z);
			this.body.add(lump);
		}
		for (const [x, z, radius, height] of [
			[0, 0, 0.12, 0.42],
			[-0.16, 0.08, 0.09, 0.3],
			[0.15, 0.1, 0.085, 0.28],
			[0.02, -0.17, 0.09, 0.32],
		]) {
			const flame = kit.mesh(
				new THREE.ConeGeometry(radius, height, 8).translate(0, height / 2, 0),
				this.fire,
			);
			flame.position.set(x, 0.1, z);
			this.body.add(flame);
			this.flames.push(flame);
		}
		this.coals.position.y = 0.22;
		this.body.add(this.coals);
		for (let index = 0; index < 6; index += 1) {
			const angle = (index / 6) * Math.PI * 2;
			const hip = kit.pivot(
				"hip",
				Math.cos(angle) * 0.3,
				-0.06,
				Math.sin(angle) * 0.3,
			);
			hip.rotation.y = -angle;
			this.body.add(hip);
			const thigh = kit.pivot("thigh", 0, 0, 0);
			thigh.rotation.z = BRAZIER_LIFT;
			hip.add(thigh);
			thigh.add(kit.limb(0.045, BRAZIER_THIGH, IRON, 8));
			const knee = kit.pivot("knee", 0, -BRAZIER_THIGH, 0);
			knee.rotation.z = BRAZIER_KNEE;
			thigh.add(knee);
			knee.add(kit.sphere(0.062, IRON, [1, 1, 1], 8));
			knee.add(kit.limb(0.035, BRAZIER_SHIN, IRON, 8));
			const tip = kit.cone(0.036, 0.14, IRON, 6);
			tip.rotation.x = Math.PI;
			tip.position.y = -BRAZIER_SHIN - 0.07;
			knee.add(tip);
			this.legs.push({ hip, thigh, angle, group: index % 2 });
		}
		this.light = {
			color: 0xff6a20,
			intensity: 3,
			radius: 5,
			offset: new THREE.Vector3(0, BRAZIER_HEIGHT + 0.3, 0),
		};
		this.glow = this.light;
		this.emitters.push(
			{
				anchor: this.coals,
				rate: 12,
				color: 0xff8a30,
				speed: 0.6,
				up: 2.5,
				life: 1.2,
				size: 0.022,
				gravity: -1.2,
				spread: 0.35,
			},
			{
				anchor: this.coals,
				rate: 0,
				color: 0xffc060,
				speed: 1.6,
				up: 0.6,
				life: 0.5,
				size: 0.022,
				gravity: 2,
				spread: 0.3,
			},
		);
	}

	update(input: AnomalyPoseInput): void {
		const moving = Math.min(1, input.speed / 3);
		const phase = this.advanceWalk(input, 2.2);
		const windup = easeOut(this.windup(input, 900));
		const strike = this.strike(input, 320);
		for (const leg of this.legs) {
			const step = Math.sin(phase + leg.group * Math.PI);
			leg.hip.rotation.y = -leg.angle + step * 0.22 * moving;
			leg.thigh.rotation.z =
				BRAZIER_LIFT + Math.max(0, step) * 0.16 * moving + windup * 0.12;
		}
		this.body.position.y =
			BRAZIER_HEIGHT + Math.abs(Math.sin(phase)) * 0.03 * moving - windup * 0.1;
		this.body.rotation.x = -windup * 0.3 + strike * 0.4;
		this.body.rotation.z = Math.sin(phase) * 0.03 * moving;
		const heat =
			0.85 + windup * 1.3 + strike * 0.8 + Math.sin(input.time * 11) * 0.12;
		this.fire.color.setRGB(1.2 * heat, 0.42 * heat, 0.1 * heat);
		this.flames.forEach((flame, index) => {
			const flicker =
				Math.sin(input.time * (9 + index * 2.3) + index) * 0.18 +
				Math.sin(input.time * 17 + index * 4) * 0.08;
			flame.scale.set(1 - flicker * 0.3, 1 + flicker + windup * 0.6, 1);
			flame.rotation.z = Math.sin(input.time * 3 + index) * 0.12;
		});
		this.follow(this.coals, this.light.offset);
		this.light.intensity = 2.6 + windup * 5 + strike * 3;
		this.emitters[0].rate = 10 + windup * 25;
		this.emitters[1].rate = windup * 35 + strike * 60;
	}
}

export class SuinteurModel extends AnomalyModel {
	private readonly blob: THREE.Mesh;
	private readonly base: Float32Array;
	private readonly puddle: THREE.Mesh;
	private readonly skull: THREE.Group;

	constructor(kit: ModelKit) {
		super(kit);
		const slime: MaterialOptions = {
			color: 0x3e5a2a,
			emissive: 0x10300a,
			emissiveIntensity: 1,
			roughness: 0.12,
			transparent: true,
			opacity: 0.86,
		};
		const bone: MaterialOptions = { color: 0xc8bca0, roughness: 0.6 };
		this.skull = new THREE.Group();
		this.skull.position.set(0.08, 0.42, 0.02);
		this.skull.rotation.set(0.3, -0.5, 0.4);
		this.root.add(this.skull);
		this.skull.add(kit.sphere(0.12, bone, [1, 0.95, 1.1], 12));
		const jaw = kit.box(0.14, 0.06, 0.1, bone);
		jaw.position.set(0, -0.1, 0.05);
		this.skull.add(jaw);
		for (const side of [-1, 1]) {
			const hole = kit.sphere(0.04, SOCKET, [1, 1, 0.6], 8);
			hole.position.set(side * 0.045, 0.01, 0.11);
			this.skull.add(hole);
		}
		const { mesh, base } = wobbleSphere(kit, 0.6, slime, 24);
		this.blob = mesh;
		this.base = base;
		this.blob.position.y = 0.48;
		this.root.add(this.blob);
		this.puddle = kit.sphere(0.88, slime, [1, 0.07, 1], 20);
		this.puddle.position.y = 0.03;
		this.root.add(this.puddle);

		this.glow = {
			color: 0x6aff3a,
			intensity: 0.9,
			radius: 3.6,
			offset: new THREE.Vector3(0, 0.6, 0.4),
		};
		this.emitters.push({
			anchor: this.blob,
			rate: 6,
			color: 0x6ac83a,
			speed: 0.7,
			up: 0.9,
			life: 1,
			size: 0.022,
			gravity: 5,
			spread: 0.7,
		});
	}

	update(input: AnomalyPoseInput): void {
		const windup = easeOut(this.windup(input, 750));
		const strike = this.strike(input, 300);
		const moving = Math.min(1, input.speed / 3);
		deform(
			this.blob,
			this.base,
			input.time,
			0.04 + moving * 0.03 + windup * 0.05,
			3 + moving * 3,
			0.25,
		);
		this.blob.scale.set(
			1 - windup * 0.1 + strike * 0.15,
			1 + windup * 0.22 - strike * 0.2,
			1 - windup * 0.1 + strike * 0.15,
		);
		this.blob.position.y = 0.48 + windup * 0.1;
		this.puddle.scale.setScalar(1 + Math.sin(input.time * 1.7) * 0.03);
		this.skull.position.y = 0.42 + Math.sin(input.time * 1.3) * 0.04;
		this.skull.rotation.y = -0.5 + Math.sin(input.time * 0.6) * 0.3;
		if (this.glow) {
			this.glow.intensity = 0.8 + windup * 1.4 + strike;
		}
		this.emitters[0].rate = 5 + moving * 6 + windup * 20 + strike * 40;
	}
}

export class BoursoufleModel extends AnomalyModel {
	private readonly sac: THREE.Mesh;
	private readonly base: Float32Array;
	private readonly pores: THREE.MeshBasicMaterial;
	private readonly crown = new THREE.Object3D();
	private readonly figure = new THREE.Group();
	private readonly legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
	private readonly arms: THREE.Group[] = [];
	private readonly light: GlowSpec;

	constructor(kit: ModelKit) {
		super(kit);
		const flesh: MaterialOptions = { color: 0x8a706e, roughness: 0.42 };
		const bruise: MaterialOptions = { color: 0x3a1a2a, roughness: 0.6 };
		this.pores = this.own(new THREE.MeshBasicMaterial({ color: 0xff9a40 }));
		this.figure.scale.setScalar(SAC_SCALE);
		this.root.add(this.figure);
		const { mesh, base } = wobbleSphere(kit, 0.6, flesh, 24);
		this.sac = mesh;
		this.base = base;
		this.sac.position.y = 1.05;
		this.figure.add(this.sac);
		this.crown.position.y = 0.6;
		this.sac.add(this.crown);
		for (const [x, y, z, size] of [
			[-0.4, 0.18, 0.06, 0.25],
			[0.18, -0.22, -0.42, 0.24],
			[0.24, 0.46, -0.22, 0.14],
		]) {
			const tumor = kit.sphere(size, flesh, [1, 0.9, 1], 14);
			tumor.position.set(x, y, z);
			this.sac.add(tumor);
		}
		for (const [theta, phi, size] of [
			[1.7, 1.2, 0.2],
			[-2.4, 1.0, 0.24],
			[2.6, 1.9, 0.18],
			[-1.5, 1.8, 0.16],
			[3.1, 0.7, 0.15],
		]) {
			const patch = kit.sphere(size, bruise, [1, 1, 0.12], 10);
			const direction = new THREE.Vector3(
				Math.sin(phi) * Math.sin(theta),
				Math.cos(phi),
				Math.sin(phi) * Math.cos(theta),
			);
			patch.position.copy(direction).multiplyScalar(0.585);
			patch.lookAt(direction.clone().multiplyScalar(2));
			this.sac.add(patch);
		}
		for (const [theta, phi, size] of [
			[0.95, 0.7, 0.09],
			[-1.1, 0.8, 0.08],
			[2.4, 1.2, 0.1],
			[-2.2, 0.6, 0.085],
			[3.1, 1.9, 0.07],
			[1.6, 2.1, 0.08],
			[-1.7, 2.0, 0.075],
		]) {
			const pore = kit.sphere(size, this.pores, [1, 1, 0.6], 8);
			const direction = new THREE.Vector3(
				Math.sin(phi) * Math.sin(theta),
				Math.cos(phi),
				Math.sin(phi) * Math.cos(theta),
			);
			pore.position.copy(direction).multiplyScalar(0.585);
			pore.lookAt(direction.clone().multiplyScalar(2));
			this.sac.add(pore);
		}
		for (const side of [-1, 1]) {
			const leg = kit.pivot("leg", side * 0.17, 0.64, 0);
			this.figure.add(leg);
			leg.add(kit.limb(0.04, 0.34, flesh, 8));
			const knee = kit.pivot("knee", 0, -0.34, 0);
			leg.add(knee);
			knee.add(kit.sphere(0.05, flesh, [1, 1, 1], 8));
			knee.add(kit.limb(0.034, 0.3, flesh, 8));
			const foot = kit.sphere(0.05, flesh, [1, 0.5, 1.7], 8);
			foot.position.set(0, -0.32, 0.04);
			knee.add(foot);
			this.legs.push({ hip: leg, knee });
			const arm = kit.pivot("arm", side * 0.5, 1.12, 0.12);
			this.figure.add(arm);
			arm.add(kit.limb(0.034, 0.26, flesh, 8));
			this.arms.push(arm);
		}
		this.light = {
			color: 0xff6a2a,
			intensity: 0.3,
			radius: 4,
			offset: new THREE.Vector3(0, 1.1 * SAC_SCALE, 0.75 * SAC_SCALE),
		};
		this.glow = this.light;
		this.emitters.push({
			anchor: this.crown,
			rate: 2,
			color: 0xffa040,
			speed: 0.8,
			up: 0.6,
			life: 0.9,
			size: 0.022,
			gravity: 0.5,
			spread: 0.8,
		});
	}

	update(input: AnomalyPoseInput): void {
		const moving = Math.min(1, input.speed / 2.5);
		const phase = this.advanceWalk(input, 2);
		const swell = input.extra;
		const arming =
			input.state === "windup" ? Math.min(1, input.stateMs / 1200) : 0;
		const pulse =
			arming > 0
				? Math.sin(input.time * (12 + arming * 30)) * 0.04 * (0.5 + arming)
				: Math.sin(input.time * 2) * 0.015;
		const scale = 1 + swell * 0.45 + pulse;
		deform(
			this.sac,
			this.base,
			input.time,
			0.02 + arming * 0.05,
			2 + arming * 8,
		);
		this.sac.scale.setScalar(scale);
		this.sac.position.y = 1.05 + swell * 0.18;
		for (const [index, leg] of this.legs.entries()) {
			const step = Math.sin(phase + index * Math.PI);
			leg.hip.rotation.x = step * 0.5 * moving - 0.12;
			leg.knee.rotation.x = 0.25 + Math.max(0, -step) * 0.6 * moving;
		}
		this.figure.rotation.z = Math.sin(phase) * 0.07 * moving;
		for (const [index, arm] of this.arms.entries()) {
			arm.rotation.z =
				(index === 0 ? -1 : 1) *
				(0.6 + swell * 0.8 + Math.sin(input.time * 6 + index) * 0.1);
			arm.position.y = 1.12 + swell * 0.15;
		}
		const strain = swell * 0.5 + arming;
		const heat =
			0.5 +
			strain * 0.9 +
			Math.max(0, pulse) * 8 +
			Math.sin(input.time * 3) * 0.08;
		this.pores.color.setRGB(1.1 * heat, 0.55 * heat, 0.2 * heat);
		this.light.intensity = 0.25 + arming * 4 + swell;
		this.emitters[0].rate = 1 + swell * 6 + arming * 30;
	}
}

export class FeuFolletModel extends AnomalyModel {
	private readonly body = new THREE.Group();
	private readonly bell: THREE.Mesh;
	private readonly heart: THREE.MeshBasicMaterial;
	private readonly veils: THREE.Mesh[] = [];

	constructor(kit: ModelKit) {
		super(kit);
		this.heart = this.own(new THREE.MeshBasicMaterial({ color: 0xe8ff9a }));
		const glass: MaterialOptions = {
			color: 0xb8ff8a,
			unlit: true,
			transparent: true,
			opacity: 0.26,
			side: THREE.DoubleSide,
			depthWrite: false,
		};
		const veil: MaterialOptions = { ...glass, color: 0xd8ff9a, opacity: 0.2 };
		this.root.add(this.body);
		const core = kit.sphere(0.06, this.heart, [1, 1.15, 1], 12);
		core.position.y = 0.02;
		this.body.add(core);
		const flame = kit.sphere(0.045, this.heart, [0.75, 1.7, 0.75], 10);
		flame.position.y = 0.09;
		this.body.add(flame);
		this.bell = kit.pleatedLathe(
			WISP_BELL,
			glass,
			8,
			(_radius, height) => (height < 0 ? 0.1 : 0.02),
			24,
		);
		this.body.add(this.bell);
		for (let index = 0; index < 5; index += 1) {
			const angle = (index / 5) * Math.PI * 2;
			const ribbon = kit.mesh(
				new THREE.PlaneGeometry(0.07, 0.42).translate(0, -0.21, 0),
				veil,
			);
			ribbon.rotation.order = "YXZ";
			ribbon.position.set(Math.cos(angle) * 0.16, -0.1, Math.sin(angle) * 0.16);
			ribbon.rotation.y = Math.PI / 2 - angle;
			this.bell.add(ribbon);
			this.veils.push(ribbon);
		}
		this.glow = {
			color: 0xd8ff6a,
			intensity: 1.6,
			radius: 4,
			offset: new THREE.Vector3(0, 0, 0),
		};
		this.emitters.push({
			anchor: core,
			rate: 6,
			color: 0xd8ff6a,
			speed: 0.15,
			up: -0.2,
			life: 1.6,
			size: 0.022,
			gravity: 0.1,
			spread: 0.15,
		});
	}

	update(input: AnomalyPoseInput): void {
		this.body.position.y = Math.sin(input.time * 2.2) * 0.07;
		this.body.rotation.z = Math.sin(input.time * 1.3) * 0.12;
		this.body.rotation.x = Math.sin(input.time * 0.9) * 0.1;
		const pulse = 0.75 + Math.sin(input.time * 3) * 0.25;
		this.bell.scale.set(1 + pulse * 0.06, 1 - pulse * 0.05, 1 + pulse * 0.06);
		this.veils.forEach((veil, index) => {
			veil.rotation.x = Math.sin(input.time * 2.6 + index * 1.3) * 0.35;
		});
		this.heart.color.setRGB(0.8 * pulse + 0.2, pulse + 0.1, 0.5 * pulse + 0.1);
		if (this.glow) {
			this.glow.intensity = 1.1 + pulse * 0.6;
		}
	}
}

export class HurleurModel extends AnomalyModel {
	private readonly head = new THREE.Group();
	private readonly flesh: THREE.MeshStandardMaterial;
	private readonly spout = new THREE.Object3D();
	private readonly wings: THREE.Group[] = [];
	private readonly light: GlowSpec;

	constructor(kit: ModelKit) {
		super(kit);
		const dark: MaterialOptions = { color: 0x2a1e1c, roughness: 0.85 };
		const membrane: MaterialOptions = {
			color: 0x1e1414,
			roughness: 0.85,
			side: THREE.DoubleSide,
		};
		this.flesh = this.own(
			kit.unique({
				color: 0x6e605c,
				roughness: 0.8,
				emissive: 0xff2a10,
				emissiveIntensity: 0,
			}),
		) as THREE.MeshStandardMaterial;
		this.root.add(this.head);
		this.head.add(kit.sphere(0.22, this.flesh, [1, 0.95, 1.1], 16));
		this.spout.position.z = 0.26;
		this.head.add(this.spout);
		for (const side of [-1, 1]) {
			const ear = kit.cone(0.1, 0.3, dark, 8);
			ear.scale.z = 0.4;
			ear.position.set(side * 0.13, 0.23, -0.04);
			ear.rotation.z = -side * 0.5;
			this.head.add(ear);
			const wing = new THREE.Group();
			wing.position.set(side * 0.18, 0.04, -0.05);
			this.head.add(wing);
			const skin = kit.mesh(
				new THREE.ShapeGeometry(
					new THREE.Shape([
						new THREE.Vector2(0, 0.02),
						new THREE.Vector2(0.52, 0.14),
						new THREE.Vector2(0.68, -0.04),
						new THREE.Vector2(0.52, -0.06),
						new THREE.Vector2(0.46, -0.17),
						new THREE.Vector2(0.33, -0.06),
						new THREE.Vector2(0.22, -0.19),
						new THREE.Vector2(0.1, -0.07),
						new THREE.Vector2(0, -0.08),
					]),
				),
				membrane,
			);
			skin.rotation.x = -Math.PI / 2;
			skin.scale.x = side;
			wing.add(skin);
			wing.add(
				kit.tube(
					[
						[0, 0, 0],
						[side * 0.3, 0.01, -0.1],
						[side * 0.52, 0, -0.14],
						[side * 0.68, 0, 0.04],
					],
					(t) => 0.026 - t * 0.012,
					dark,
					10,
					6,
				),
			);
			this.wings.push(wing);
		}
		for (const side of [-1, 1]) {
			const fang = kit.cone(0.024, 0.075, TEETH, 6);
			fang.rotation.x = Math.PI;
			fang.position.set(side * 0.05, -0.21, 0.12);
			this.head.add(fang);
		}
		this.head.add(
			kit.tube(
				[
					[0, -0.05, -0.18],
					[0, -0.1, -0.34],
					[0, -0.02, -0.5],
				],
				(t) => 0.045 * (1 - t) + 0.006,
				dark,
				10,
				6,
			),
		);
		this.light = {
			color: 0xff4a1a,
			intensity: 0.3,
			radius: 3.5,
			offset: new THREE.Vector3(0, -0.05, 0.3),
		};
		this.glow = this.light;
		this.emitters.push({
			anchor: this.spout,
			rate: 0,
			color: 0xffb060,
			speed: 2.6,
			up: 0,
			life: 0.35,
			size: 0.022,
			gravity: 0,
			spread: 0.12,
		});
	}

	update(input: AnomalyPoseInput): void {
		const screaming = input.extra > 0.5;
		const flap = Math.sin(input.time * (screaming ? 26 : 18));
		this.wings.forEach((wing, index) => {
			wing.rotation.z = (index === 0 ? 1 : -1) * flap * 0.7;
		});
		this.head.scale.setScalar(
			screaming ? 1.08 + Math.sin(input.time * 30) * 0.04 : 1,
		);
		this.head.position.y = Math.sin(input.time * 5) * 0.06;
		this.head.position.x = screaming ? Math.sin(input.time * 47) * 0.015 : 0;
		this.head.rotation.x = Math.min(0.4, input.speed * 0.04);
		this.flesh.emissiveIntensity = screaming
			? 0.8 + Math.sin(input.time * 40) * 0.25
			: 0.04;
		this.follow(this.spout, this.light.offset);
		this.light.intensity = screaming ? 2.8 : 0.3;
		this.emitters[0].rate = screaming ? 45 : 0;
	}
}

export class ArchivisteModel extends AnomalyModel {
	private readonly books: THREE.Mesh[] = [];
	private readonly pages: THREE.Mesh[] = [];
	private readonly figure = new THREE.Group();
	private readonly tome = new THREE.Group();
	private readonly leaves: THREE.MeshBasicMaterial;
	private readonly sight: THREE.MeshBasicMaterial;
	private readonly light: GlowSpec;

	constructor(kit: ModelKit) {
		super(kit);
		this.root.add(this.figure);
		const paper: MaterialOptions = {
			texture: "paperPages",
			color: 0x6e5c48,
			roughness: 0.95,
			side: THREE.DoubleSide,
			fixedRepeat: true,
		};
		this.leaves = this.own(new THREE.MeshBasicMaterial({ color: 0xffe090 }));
		this.sight = this.own(new THREE.MeshBasicMaterial({ color: 0xffc840 }));
		const robe = kit.lathe(ARCHIVIST_ROBE, paper, 20);
		robe.position.y = ARCHIVIST_ROBE_BASE;
		this.figure.add(robe);
		const hood = kit.mesh(hoodGeometry(0.22, 0.9), paper);
		hood.scale.set(0.95, 1.12, 1);
		hood.position.set(0, 2.0, 0.02);
		this.figure.add(hood);
		const shadow = kit.sphere(0.2, SOCKET, [0.92, 1.05, 0.9], 14);
		shadow.position.set(0, 2.0, 0.02);
		this.figure.add(shadow);
		for (const side of [-1, 1]) {
			const eye = kit.sphere(0.032, this.sight, [1, 0.75, 0.5], 10);
			eye.position.set(side * 0.056, 2.0, 0.185);
			this.figure.add(eye);
		}
		for (const side of [-1, 1]) {
			this.figure.add(
				kit.tube(
					[
						[side * 0.17, 1.66, 0.02],
						[side * 0.24, 1.52, 0.16],
						[side * 0.2, 1.47, 0.3],
					],
					(t) => 0.065 - t * 0.012,
					paper,
					8,
					8,
				),
			);
		}
		this.tome.position.set(0, 1.45, 0.34);
		this.tome.rotation.x = -0.5;
		this.figure.add(this.tome);
		const cover = kit.box(0.5, 0.025, 0.34, {
			texture: "leather",
			color: 0x5a1a14,
			roughness: 0.7,
		});
		this.tome.add(cover);
		for (const side of [-1, 1]) {
			const leaf = kit.box(0.22, 0.04, 0.31, this.leaves);
			leaf.position.set(side * 0.115, 0.03, 0);
			leaf.rotation.z = -side * 0.14;
			this.tome.add(leaf);
		}

		const colors = [0x5a1a16, 0x1a2a4a, 0x1e3a1e, 0x4a3414, 0x2a1a34];
		for (let index = 0; index < 9; index += 1) {
			const book = kit.box(0.24, 0.32, 0.07, {
				texture: "leather",
				color: colors[index % colors.length],
				roughness: 0.75,
			});
			this.figure.add(book);
			this.books.push(book);
		}
		for (let index = 0; index < 12; index += 1) {
			const page = kit.mesh(new THREE.PlaneGeometry(0.18, 0.24), paper);
			this.figure.add(page);
			this.pages.push(page);
		}
		this.light = {
			color: 0xffc050,
			intensity: 2.5,
			radius: 6,
			offset: new THREE.Vector3(0, 1.75, 0.5),
		};
		this.glow = this.light;
		this.emitters.push({
			anchor: this.tome,
			rate: 8,
			color: 0xffc060,
			speed: 0.5,
			up: 1.2,
			life: 1.4,
			size: 0.022,
			gravity: -0.6,
			spread: 0.4,
		});
	}

	update(input: AnomalyPoseInput): void {
		const charge = input.extra;
		const speed = 0.6 + charge * 3;
		this.figure.position.y = 0.25 + Math.sin(input.time * 1.2) * 0.08;
		this.books.forEach((book, index) => {
			const angle =
				input.time * speed + (index / this.books.length) * Math.PI * 2;
			const radius = 0.86 + Math.sin(input.time + index) * 0.08 - charge * 0.15;
			book.position.set(
				Math.cos(angle) * radius,
				1.35 + Math.sin(angle * 2 + index) * 0.25,
				Math.sin(angle) * radius,
			);
			book.rotation.set(angle, angle * 0.5, 0);
		});
		this.pages.forEach((page, index) => {
			const angle = -input.time * speed * 1.3 + index * 0.9;
			const radius = 1.2 + (index % 3) * 0.25;
			page.position.set(
				Math.cos(angle) * radius,
				0.6 + ((index * 0.37 + input.time * 0.3) % 2.2),
				Math.sin(angle) * radius,
			);
			page.rotation.set(
				input.time * 2 + index,
				angle,
				Math.sin(input.time + index),
			);
		});
		this.tome.position.y = 1.45 + Math.sin(input.time * 2) * 0.02;
		const shine = 0.85 + charge * 0.9 + Math.sin(input.time * 6) * 0.08;
		this.leaves.color.setRGB(shine, 0.85 * shine, 0.52 * shine);
		const stare = 0.7 + charge * 0.8 + Math.sin(input.time * 2.3) * 0.1;
		this.sight.color.setRGB(stare, 0.78 * stare, 0.25 * stare);
		this.follow(this.tome, this.light.offset);
		this.light.offset.y += 0.3;
		this.light.intensity = 2 + charge * 9;
		this.emitters[0].rate = 6 + charge * 30;
	}

	override preparePortrait(): void {
		this.figure.position.y = 0.25;
		this.books.forEach((book, index) => {
			const angle = index * 0.7 + 0.4;
			const radius = 0.8 + (index % 3) * 0.1;
			book.position.set(
				Math.cos(angle) * radius,
				0.85 + (index % 4) * 0.28,
				Math.sin(angle) * radius,
			);
			book.rotation.set(
				index * 0.6,
				Math.PI / 2 - angle,
				(index % 3) * 0.3 - 0.3,
			);
		});
		for (const page of this.pages) {
			page.visible = false;
		}
	}
}

const MAW_GLOW_OFFSET = new THREE.Vector3(0, 0.12, 0.42);

export class DoubleModel extends AnomalyModel {
	readonly mushroom: MushroomModel;
	copiedLantern = true;
	copiedTalking = 0;
	private readonly core = new THREE.Group();
	private readonly upperTeeth = new THREE.Group();
	private readonly eyes = new THREE.Group();
	private readonly claws: THREE.Mesh[] = [];
	private readonly maw = new THREE.Object3D();
	private readonly throat: THREE.MeshBasicMaterial;
	private readonly hate: THREE.MeshBasicMaterial;
	private readonly light: GlowSpec = {
		color: 0xff2a14,
		intensity: 0,
		radius: 3.2,
		offset: new THREE.Vector3(),
	};

	constructor(
		kit: ModelKit,
		color: number,
		pattern: HatPattern = DEFAULT_HAT_PATTERN,
		lanternTint: number | null = null,
	) {
		super(kit);
		this.mushroom = new MushroomModel(kit, color, pattern, lanternTint);
		this.root.add(this.mushroom.root);
		this.throat = this.own(new THREE.MeshBasicMaterial({ color: 0xff3a1a }));
		this.hate = this.own(new THREE.MeshBasicMaterial({ color: 0xff2a14 }));
		this.core.position.y = 0.7;
		this.core.add(
			kit.sphere(0.2, { color: 0x2a0505, roughness: 0.55 }, [1, 0.35, 1], 16),
		);
		const glowing = kit.sphere(0.15, this.throat, [1, 0.32, 1], 12);
		glowing.position.y = 0.03;
		this.core.add(glowing);
		for (let index = 0; index < 9; index += 1) {
			const angle = (index / 9) * Math.PI * 2;
			const fang = kit.cone(0.032, index % 2 === 0 ? 0.15 : 0.1, TEETH, 5);
			fang.position.set(Math.sin(angle) * 0.17, 0.07, Math.cos(angle) * 0.17);
			this.core.add(fang);
		}
		this.maw.position.set(0, 0.06, 0.1);
		this.core.add(this.maw);
		this.mushroom.body.add(this.core);
		for (let index = 0; index < 12; index += 1) {
			const angle = (index / 12) * Math.PI * 2;
			const fang = kit.cone(0.036, index % 3 === 0 ? 0.2 : 0.12, TEETH, 5);
			fang.rotation.x = Math.PI;
			fang.position.set(Math.sin(angle) * 0.3, -0.08, Math.cos(angle) * 0.28);
			this.upperTeeth.add(fang);
		}
		this.mushroom.capPivot.add(this.upperTeeth);
		for (const side of [-1, 1]) {
			const eye = kit.sphere(0.042, this.hate, [0.8, 1.25, 0.5], 10);
			eye.position.set(side * 0.088, 0.49, 0.245);
			eye.rotation.y = side * 0.22;
			this.eyes.add(eye);
		}
		this.mushroom.body.add(this.eyes);
		for (const side of [-1, 1]) {
			for (const lean of [-0.25, 0.25]) {
				const claw = kit.cone(0.04, 0.32, { color: 0x140f0c }, 5);
				claw.position.set(side * (0.3 + lean * 0.08), 0.25, 0.15 + lean * 0.1);
				claw.rotation.set(Math.PI * 0.8, 0, side * lean);
				this.mushroom.body.add(claw);
				this.claws.push(claw);
			}
		}
		this.emitters.push({
			anchor: this.maw,
			rate: 0,
			color: 0xff3a1a,
			speed: 0.6,
			up: 0.8,
			life: 0.8,
			size: 0.022,
			gravity: -0.2,
			spread: 0.25,
		});
		this.applyReveal(0);
	}

	update(input: AnomalyPoseInput): void {
		const reveal =
			input.extra >= 1
				? 1
				: input.state === "special"
					? Math.min(1, input.stateMs / 900)
					: 0;
		const windup = this.windup(input, 750);
		const strike = this.strike(input);
		this.mushroom.update(input.dt, {
			speed: input.speed,
			crouch: windup * 0.4,
			grounded: true,
			sprinting: reveal > 0.5 && input.speed > 4,
			lanternOpen: reveal < 0.5 && this.copiedLantern,
			grimoireOpen: false,
			dead: false,
			talking: reveal < 0.5 ? this.copiedTalking : 0,
		});
		const chomp =
			reveal >= 1 && input.state === "chase"
				? Math.sin(input.time * 7) * 0.2
				: 0;
		this.openCap(
			reveal * (1.25 + chomp + windup * 0.35) - strike * reveal * 0.9,
		);
		this.applyReveal(reveal);
		const transforming = reveal > 0 && reveal < 1;
		this.mushroom.body.scale.set(
			1 + reveal * 0.1,
			1 + reveal * 0.3,
			1 + reveal * 0.1,
		);
		this.mushroom.body.rotation.z = transforming
			? Math.sin(input.time * 45) * 0.14
			: 0;
		this.mushroom.body.position.x = transforming
			? Math.sin(input.time * 61) * 0.03
			: 0;
		const heat = 0.7 + reveal * 0.6 + Math.sin(input.time * 9) * 0.1;
		this.throat.color.setRGB(1.2 * heat, 0.25 * heat, 0.1 * heat);
		this.hate.color.setRGB(heat, 0.14 * heat, 0.06 * heat);
		this.follow(this.maw, this.light.offset);
		this.light.offset.add(MAW_GLOW_OFFSET);
		this.light.intensity = 1.6 * reveal;
		this.glow = reveal > 0.4 ? this.light : null;
		this.emitters[0].rate = reveal > 0.4 ? 10 * reveal : 0;
	}

	private applyReveal(reveal: number): void {
		const size = Math.max(0.001, reveal);
		this.core.visible = reveal > 0.02;
		this.upperTeeth.visible = reveal > 0.02;
		this.eyes.visible = reveal > 0.3;
		for (const eye of this.mushroom.eyes) {
			eye.root.visible = reveal <= 0.3;
		}
		this.core.scale.setScalar(size);
		this.upperTeeth.scale.setScalar(size);
		for (const claw of this.claws) {
			claw.visible = reveal > 0.3;
			claw.scale.setScalar(size);
		}
	}

	override preparePortrait(): void {
		this.openCap(PORTRAIT_CAP_OPENING);
	}

	private openCap(open: number): void {
		this.mushroom.capPivot.position.set(
			0,
			MUSHROOM_CAP_REST + CAP_HINGE * Math.sin(open),
			-CAP_HINGE * (1 - Math.cos(open)),
		);
		this.mushroom.capPivot.rotation.x = -open;
	}
}
