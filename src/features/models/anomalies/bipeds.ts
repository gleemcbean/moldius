import * as THREE from "three";
import type { MaterialOptions } from "../../world/MaterialLibrary";
import type { ModelKit } from "../modelKit";
import {
	AnomalyModel,
	type AnomalyPoseInput,
	easeOut,
	type GlowSpec,
} from "./AnomalyModel";
import { claws, hoodGeometry, normalizeHeightUv, SOCKET } from "./parts";

const BRASS: MaterialOptions = {
	texture: "brass",
	color: 0x8a7a5c,
	roughness: 0.45,
	metalness: 0.75,
};
const BONE: MaterialOptions = { color: 0xbfb08e, roughness: 0.5 };

const REVERBERE_HIP = 1.0;
const REVERBERE_THIGH = 0.52;
const REVERBERE_SHIN = 0.6;
const REVERBERE_TORSO: [number, number][] = [
	[0.001, 0],
	[0.17, 0.04],
	[0.2, 0.18],
	[0.26, 0.38],
	[0.26, 0.5],
	[0.15, 0.62],
	[0.001, 0.64],
];
const REVERBERE_SHADE: [number, number][] = [
	[0.001, -0.2],
	[0.09, -0.19],
	[0.16, -0.13],
	[0.21, -0.02],
	[0.24, 0.08],
	[0.27, 0.13],
];
const REVERBERE_BEAMS: [number, number, number][] = [
	[1.05, 3.6, 0.1],
	[0.5, 3.1, 0.14],
];

const COLLECTEUR_COAT: [number, number][] = [
	[0.001, 0.84],
	[0.11, 0.82],
	[0.2, 0.74],
	[0.215, 0.5],
	[0.23, 0.15],
	[0.265, -0.15],
	[0.31, -0.42],
];

const SACK_PROFILE: [number, number][] = [
	[0.001, 0],
	[0.18, 0.03],
	[0.32, 0.18],
	[0.36, 0.4],
	[0.3, 0.6],
	[0.14, 0.74],
	[0.075, 0.8],
	[0.11, 0.9],
	[0.001, 0.88],
];

const MURMURE_CLOAK: [number, number][] = [
	[0.41, 0.02],
	[0.36, 0.35],
	[0.3, 0.8],
	[0.255, 1.15],
	[0.24, 1.35],
	[0.17, 1.42],
	[0.001, 1.44],
];
const ROD_HEIGHT = 1.37;

interface Leg {
	hip: THREE.Group;
	knee: THREE.Group;
	ankle: THREE.Group;
}

interface Arm {
	shoulder: THREE.Group;
	elbow: THREE.Group;
}

function hand(
	kit: ModelKit,
	skin: MaterialOptions,
	nails: MaterialOptions,
	side: number,
	length: number,
): THREE.Group {
	const wrist = new THREE.Group();
	wrist.add(kit.sphere(length * 0.24, skin, [1, 1.1, 0.7], 10));
	const fingers = claws(kit, nails, 3, length, length * 0.11, 0.32, 0.45);
	fingers.position.y = -length * 0.12;
	wrist.add(fingers);
	wrist.rotation.y = (-side * Math.PI) / 2;
	return wrist;
}

function saccade(time: number, rate: number, seed: number): number {
	const step = Math.floor(time * rate) + seed * 17;
	const noise = Math.sin(step * 12.9898) * 43758.5453;
	return (noise - Math.floor(noise)) * 2 - 1;
}

let beamFade: THREE.DataTexture | null = null;

function beamFadeTexture(): THREE.DataTexture {
	if (!beamFade) {
		const size = 32;
		const data = new Uint8Array(size * 4);
		for (let row = 0; row < size; row += 1) {
			const along = row / (size - 1);
			const value = Math.round(255 * along ** 1.6 * Math.min(1, row / 3));
			data.set([value, value, value, 255], row * 4);
		}
		beamFade = new THREE.DataTexture(data, 1, size);
		beamFade.needsUpdate = true;
	}
	return beamFade;
}

function beamCone(
	radius: number,
	length: number,
	material: THREE.Material,
): THREE.Mesh {
	const geometry = new THREE.ConeGeometry(radius, length, 24, 1, true)
		.translate(0, -length / 2, 0)
		.rotateX(-Math.PI / 2);
	const mesh = new THREE.Mesh(geometry, material);
	mesh.renderOrder = 2;
	return mesh;
}

export class ReverbereModel extends AnomalyModel {
	private readonly pelvis: THREE.Group;
	private readonly torso: THREE.Group;
	private readonly neck: THREE.Group;
	private readonly lamp: THREE.Group;
	private readonly flame: THREE.MeshBasicMaterial;
	private readonly beams: THREE.MeshBasicMaterial[] = [];
	private readonly cones: THREE.Mesh[] = [];
	private readonly beamEnd = new THREE.Object3D();
	private readonly wick = new THREE.Object3D();
	private readonly light: GlowSpec;
	private readonly rage = new THREE.Color();
	private readonly legs: Leg[] = [];
	private readonly arms: Arm[] = [];
	private fury = 0;

	constructor(kit: ModelKit) {
		super(kit);
		const soot: MaterialOptions = { color: 0x1d1917, roughness: 0.75 };
		const iron: MaterialOptions = {
			color: 0x15110f,
			roughness: 0.5,
			metalness: 0.55,
		};
		const shade: MaterialOptions = { ...iron, side: THREE.DoubleSide };
		this.pelvis = kit.pivot("pelvis", 0, REVERBERE_HIP, 0);
		this.root.add(this.pelvis);
		this.pelvis.add(kit.sphere(0.19, soot, [1.15, 0.75, 0.95], 12));
		this.torso = kit.pivot("torso", 0, 0.05, 0);
		this.pelvis.add(this.torso);
		const chest = kit.lathe(REVERBERE_TORSO, soot, 14);
		chest.scale.z = 0.82;
		this.torso.add(chest);

		this.neck = kit.pivot("neck", 0, 0.6, 0.02);
		this.torso.add(this.neck);
		this.neck.add(
			kit.tube(
				[
					[0, -0.06, 0],
					[0, 0.26, -0.02],
					[0, 0.5, 0.12],
					[0, 0.55, 0.35],
					[0, 0.44, 0.5],
				],
				(t) => 0.085 - t * 0.025,
				iron,
				20,
				8,
			),
		);
		this.lamp = kit.pivot("lamp", 0, 0.41, 0.53);
		this.neck.add(this.lamp);
		const hood = kit.lathe(REVERBERE_SHADE, shade, 18);
		hood.rotation.x = Math.PI / 2;
		this.lamp.add(hood);
		this.flame = this.own(new THREE.MeshBasicMaterial({ color: 0xd0d0d0 }));
		const bulb = kit.sphere(0.11, this.flame, [1, 1, 0.8], 12);
		bulb.position.z = 0.02;
		this.lamp.add(bulb);
		for (const [radius, length, opacity] of REVERBERE_BEAMS) {
			const material = this.own(
				new THREE.MeshBasicMaterial({
					color: 0xffffff,
					transparent: true,
					opacity,
					alphaMap: beamFadeTexture(),
					blending: THREE.AdditiveBlending,
					depthWrite: false,
					side: THREE.DoubleSide,
				}),
			);
			const beam = beamCone(radius, length, material);
			beam.position.z = 0.04;
			this.lamp.add(beam);
			this.beams.push(material);
			this.cones.push(beam);
		}
		this.beamEnd.position.set(0, 0, 2.2);
		this.wick.position.set(0, 0, 0.16);
		this.lamp.add(this.beamEnd, this.wick);

		for (const side of [-1, 1]) {
			const hip = kit.pivot("hip", side * 0.15, -0.02, 0);
			this.pelvis.add(hip);
			hip.add(kit.limb(0.09, REVERBERE_THIGH, soot, 10));
			const knee = kit.pivot("knee", 0, -REVERBERE_THIGH, 0);
			hip.add(knee);
			knee.add(kit.limb(0.07, REVERBERE_SHIN, soot, 10));
			const ankle = kit.pivot("ankle", 0, -REVERBERE_SHIN, 0);
			knee.add(ankle);
			const foot = kit.sphere(0.09, iron, [0.9, 0.45, 2.1], 10);
			foot.position.set(0, -0.02, 0.1);
			ankle.add(foot);
			this.legs.push({ hip, knee, ankle });

			const shoulder = kit.pivot("shoulder", side * 0.25, 0.5, 0.02);
			this.torso.add(shoulder);
			shoulder.add(kit.limb(0.085, 0.56, soot, 10));
			const elbow = kit.pivot("elbow", 0, -0.56, 0);
			shoulder.add(elbow);
			elbow.add(kit.limb(0.07, 0.52, soot, 10));
			const fist = kit.sphere(0.105, iron, [0.75, 1.45, 0.62], 10);
			fist.position.y = -0.62;
			elbow.add(fist);
			this.arms.push({ shoulder, elbow });
		}
		this.light = {
			color: 0xd0d0d0,
			intensity: 0.6,
			radius: 4.5,
			offset: new THREE.Vector3(0, 0.6, 2.4),
		};
		this.glow = this.light;
		this.emitters.push(
			{
				anchor: this.wick,
				rate: 3,
				color: 0xbab4a8,
				speed: 0.3,
				up: 0.1,
				life: 1.6,
				size: 0.02,
				gravity: 0,
				spread: 0.5,
			},
			{
				anchor: this.wick,
				rate: 0,
				color: 0xff3a1a,
				speed: 0.5,
				up: 0.5,
				life: 0.9,
				size: 0.024,
				gravity: -0.4,
				spread: 0.35,
			},
		);
	}

	override preparePortrait(): void {
		for (const cone of this.cones) {
			cone.visible = false;
		}
	}

	update(input: AnomalyPoseInput): void {
		const moving = Math.min(1, input.speed / 3);
		const phase = this.advanceWalk(input, 1.5);
		const swing = Math.sin(phase) * 0.5 * moving;
		const windup = easeOut(this.windup(input, 850));
		const strike = this.strike(input);
		const hunting =
			input.state === "chase" ||
			input.state === "windup" ||
			input.state === "recover";
		this.fury += ((hunting ? 1 : 0) - this.fury) * Math.min(1, input.dt * 4);
		const fury = this.fury;
		for (const [index, leg] of this.legs.entries()) {
			const stride = index === 0 ? swing : -swing;
			const lift =
				Math.max(0, (index === 0 ? -1 : 1) * Math.sin(phase)) * 0.7 * moving;
			leg.hip.rotation.x = 0.55 + stride;
			leg.knee.rotation.x = -1.1 - lift * 0.6 + windup * 0.2;
			leg.ankle.rotation.x = -(leg.hip.rotation.x + leg.knee.rotation.x);
		}
		this.pelvis.position.y =
			REVERBERE_HIP + Math.abs(Math.cos(phase)) * 0.05 * moving - windup * 0.1;
		this.torso.rotation.x =
			0.5 + fury * 0.2 + moving * 0.08 - windup * 0.3 + strike * 0.35;
		for (const [index, arm] of this.arms.entries()) {
			const side = index === 0 ? -1 : 1;
			arm.shoulder.rotation.x =
				-0.25 - fury * 0.35 - swing * side * 0.3 - windup * 1.7 + strike * 2.4;
			arm.shoulder.rotation.z = side * (0.05 + windup * 0.12);
			arm.elbow.rotation.x = -0.25 - fury * 0.35 - windup * 0.6 + strike * 0.7;
		}
		const sweeping = !hunting;
		this.neck.rotation.x = -this.torso.rotation.x * 0.75 + windup * 0.2;
		this.neck.rotation.y = sweeping ? Math.sin(input.time * 0.55) * 0.65 : 0;
		this.lamp.rotation.x = 0.42 - windup * 0.3 + strike * 0.2;
		this.lamp.rotation.z = Math.sin(input.time * 1.3) * 0.05;
		const flicker =
			1 +
			Math.sin(input.time * 23) * 0.04 * fury +
			Math.sin(input.time * 7.3) * 0.03;
		this.rage.setRGB(0.62 + fury * 0.38, 0.62 - fury * 0.43, 0.6 - fury * 0.48);
		this.flame.color.copy(this.rage).multiplyScalar(0.9 + windup * 0.3);
		for (const beam of this.beams) {
			beam.color
				.copy(this.rage)
				.multiplyScalar(flicker * (0.75 + fury * 0.5 + windup));
		}
		this.light.color = this.rage.getHex();
		this.follow(this.beamEnd, this.light.offset);
		this.light.intensity = (0.55 + fury * 1.1 + windup * 1.4) * flicker;
		this.emitters[0].rate = (1 - fury) * 3;
		this.emitters[1].rate = fury * 5 + windup * 14;
	}
}

export class CollecteurModel extends AnomalyModel {
	private readonly hips: THREE.Group;
	private readonly torso: THREE.Group;
	private readonly neck: THREE.Group;
	private readonly head: THREE.Group;
	private readonly sack: THREE.Mesh;
	private readonly gaze = new THREE.Object3D();
	private readonly embers: THREE.MeshBasicMaterial;
	private readonly light: GlowSpec;
	private readonly legs: (Leg & { foot: THREE.Group })[] = [];
	private readonly arms: Arm[] = [];

	constructor(kit: ModelKit) {
		super(kit);
		const coat: MaterialOptions = {
			color: 0x17111a,
			roughness: 0.95,
			side: THREE.DoubleSide,
		};
		const skin: MaterialOptions = { color: 0x3a3430, roughness: 0.75 };
		const scaly: MaterialOptions = { color: 0x241c18, roughness: 0.6 };
		const skull: MaterialOptions = { color: 0xcfc4ac, roughness: 0.55 };
		const felt: MaterialOptions = { color: 0x0e0b0c, roughness: 0.85 };
		const burlap: MaterialOptions = {
			texture: "burlap",
			color: 0x9a8466,
			roughness: 1,
		};
		this.embers = this.own(new THREE.MeshBasicMaterial({ color: 0xffd040 }));

		this.hips = kit.pivot("hips", 0, 1.2, 0);
		this.root.add(this.hips);
		for (const side of [-1, 1]) {
			const hip = kit.pivot("hip", side * 0.1, 0, 0);
			this.hips.add(hip);
			hip.add(kit.limb(0.065, 0.3, coat, 8));
			const knee = kit.pivot("knee", 0, -0.3, 0);
			hip.add(knee);
			knee.add(kit.sphere(0.056, scaly, [1, 1, 1], 8));
			knee.add(kit.limb(0.042, 0.5, scaly, 8));
			const ankle = kit.pivot("ankle", 0, -0.5, 0);
			knee.add(ankle);
			ankle.add(kit.sphere(0.046, scaly, [1, 1, 1], 8));
			ankle.add(kit.limb(0.035, 0.5, scaly, 8));
			const foot = kit.pivot("foot", 0, -0.5, 0);
			ankle.add(foot);
			foot.add(kit.sphere(0.048, scaly, [1, 0.7, 1], 8));
			for (const angle of [-0.5, 0, 0.5, Math.PI]) {
				const length = angle === Math.PI ? 0.1 : 0.18;
				const toe = kit.mesh(
					new THREE.ConeGeometry(0.028, length, 6).translate(0, length / 2, 0),
					scaly,
				);
				toe.rotation.set(Math.PI / 2 - 0.12, 0, angle);
				toe.position.y = -0.02;
				foot.add(toe);
			}
			this.legs.push({ hip, knee, ankle, foot });
		}

		this.torso = kit.pivot("torso", 0, 0.02, 0);
		this.hips.add(this.torso);
		this.torso.add(
			kit.pleatedLathe(
				COLLECTEUR_COAT,
				coat,
				8,
				(_radius, height) => Math.max(0, 0.2 - height) * 0.16,
				24,
			),
		);
		const collar = kit.cylinder(0.095, 0.13, 0.12, coat, 14);
		collar.position.y = 0.84;
		this.torso.add(collar);
		this.sack = kit.pleatedLathe(
			SACK_PROFILE,
			burlap,
			7,
			(_radius, height) => (height > 0.6 ? (height - 0.6) * 0.5 : 0.03),
			18,
		);
		this.sack.position.set(0, -0.05, -0.36);
		this.sack.rotation.x = -0.25;
		this.torso.add(this.sack);
		const tie = kit.mesh(new THREE.TorusGeometry(0.085, 0.024, 6, 12), {
			...burlap,
			color: 0x5a4a38,
		});
		tie.rotation.x = Math.PI / 2;
		tie.position.y = 0.8;
		this.sack.add(tie);
		const stain = kit.sphere(
			0.2,
			{ color: 0x2a0c0a, roughness: 0.9 },
			[1.25, 0.35, 1.25],
		);
		stain.position.y = 0.06;
		this.sack.add(stain);

		this.neck = kit.pivot("neck", 0, 0.82, 0.04);
		this.torso.add(this.neck);
		this.neck.add(
			kit.tube(
				[
					[0, -0.04, 0],
					[0, 0.1, 0.06],
					[0, 0.2, 0.18],
				],
				(t) => 0.045 - t * 0.008,
				skin,
				8,
				7,
			),
		);
		this.head = kit.pivot("head", 0, 0.24, 0.22);
		this.neck.add(this.head);
		this.head.add(kit.sphere(0.1, skull, [0.8, 0.95, 1.15], 14));
		this.head.add(
			kit.tube(
				[
					[0, -0.02, 0.07],
					[0, -0.045, 0.24],
					[0, -0.13, 0.36],
				],
				(t) => 0.048 * (1 - t) + 0.005,
				skull,
				10,
				8,
			),
		);
		for (const side of [-1, 1]) {
			const eye = kit.sphere(0.038, this.embers, [1, 0.9, 0.5], 10);
			eye.position.set(side * 0.05, 0.035, 0.075);
			eye.rotation.y = side * 0.5;
			this.head.add(eye);
		}
		this.gaze.position.set(0, 0.03, 0.26);
		this.head.add(this.gaze);
		const hat = kit.pivot("hat", 0, 0.085, -0.01);
		hat.rotation.x = -0.12;
		this.head.add(hat);
		hat.add(kit.cylinder(0.19, 0.19, 0.026, felt, 18));
		const crown = kit.cylinder(0.1, 0.112, 0.34, felt, 14);
		crown.position.y = 0.18;
		hat.add(crown);
		const band = kit.cylinder(0.115, 0.115, 0.065, { color: 0x4a0c0c }, 14);
		band.position.y = 0.05;
		hat.add(band);

		for (const side of [-1, 1]) {
			const shoulder = kit.pivot("shoulder", side * 0.21, 0.72, 0.02);
			this.torso.add(shoulder);
			shoulder.add(kit.sphere(0.068, coat, [1, 1, 1], 10));
			shoulder.add(kit.limb(0.05, 0.5, coat, 8));
			const elbow = kit.pivot("elbow", 0, -0.5, 0);
			shoulder.add(elbow);
			elbow.add(kit.limb(0.042, 0.44, coat, 8));
			const fist = hand(kit, skin, BONE, side, 0.28);
			fist.position.y = -0.47;
			elbow.add(fist);
			this.arms.push({ shoulder, elbow });
		}
		this.light = {
			color: 0xffc040,
			intensity: 0.5,
			radius: 2.4,
			offset: new THREE.Vector3(0, 2.3, 0.4),
		};
		this.glow = this.light;
	}

	update(input: AnomalyPoseInput): void {
		const moving = Math.min(1, input.speed / 3);
		const phase = this.advanceWalk(input, 1.2);
		const windup = easeOut(this.windup(input, 1000));
		const strike = this.strike(input, 400);
		const carrying = input.extra > 0.5;
		for (const [index, leg] of this.legs.entries()) {
			const step = phase + index * Math.PI;
			const lift = Math.max(0, Math.cos(step)) * moving;
			leg.hip.rotation.x = -0.45 - Math.sin(step) * 0.38 * moving;
			leg.knee.rotation.x = 1.0 + lift * 0.55;
			leg.ankle.rotation.x = -0.85 - lift * 0.5;
			leg.foot.rotation.x =
				-(leg.hip.rotation.x + leg.knee.rotation.x + leg.ankle.rotation.x) +
				lift * 0.35;
		}
		this.hips.position.y =
			1.2 + Math.abs(Math.sin(phase)) * 0.04 * moving - windup * 0.08;
		this.torso.rotation.x = 0.5 + windup * 0.3 - strike * 0.2;
		this.neck.rotation.x =
			-0.35 + Math.sin(input.time * 0.8) * 0.08 - windup * 0.3;
		this.head.rotation.x =
			0.2 - this.torso.rotation.x - this.neck.rotation.x + windup * 0.15;
		this.head.rotation.z = saccade(input.time, 0.8, 3) * 0.25 * (1 - windup);
		for (const [index, arm] of this.arms.entries()) {
			const side = index === 0 ? -1 : 1;
			const swing = Math.sin(phase) * 0.45 * moving;
			arm.shoulder.rotation.x = carrying
				? 2.6
				: -swing * side * 0.5 - windup * 1.6 + strike * 1.2 - 0.25;
			arm.shoulder.rotation.z = side * (0.12 + windup * 0.4);
			arm.elbow.rotation.x = carrying ? -1.4 : -0.35 - windup * 0.5;
		}
		const wriggle = carrying ? Math.sin(input.time * 14) * 0.08 : 0;
		const fill = carrying ? 1 : 0;
		this.sack.scale.set(
			0.72 + fill * 0.33 + wriggle,
			0.8 + fill * 0.25 - wriggle,
			0.42 + fill * 0.6,
		);
		this.sack.position.z = -0.2 - 0.34 * this.sack.scale.z;
		const flare = 0.8 + windup * 0.9 + Math.sin(input.time * 13) * 0.06;
		this.embers.color.setRGB(flare, 0.78 * flare, 0.22 * flare);
		this.follow(this.gaze, this.light.offset);
		this.light.intensity = 0.45 + windup * 0.9 + (carrying ? 0.3 : 0);
	}
}

export class MurmureModel extends AnomalyModel {
	private readonly body: THREE.Group;
	private readonly cloak: THREE.Mesh;
	private readonly basePositions: Float32Array;
	private readonly head: THREE.Group;
	private readonly face = new THREE.Object3D();
	private readonly dust = new THREE.Object3D();
	private readonly light: GlowSpec;
	private readonly arms: Arm[] = [];

	constructor(kit: ModelKit) {
		super(kit);
		const cloth: MaterialOptions = {
			texture: "curtainPale",
			color: 0xa89e8c,
			roughness: 1,
			side: THREE.DoubleSide,
			fixedRepeat: true,
		};
		const dark: MaterialOptions = { color: 0x120d0e, roughness: 0.9 };
		this.body = kit.pivot("body", 0, 0, 0);
		this.root.add(this.body);
		this.cloak = kit.pleatedLathe(
			MURMURE_CLOAK,
			cloth,
			7,
			(_radius, height) => 0.04 + Math.max(0, 1.2 - height) * 0.08,
			28,
		);
		normalizeHeightUv(this.cloak);
		this.body.add(this.cloak);
		this.basePositions = new Float32Array(
			(this.cloak.geometry.getAttribute("position") as THREE.BufferAttribute)
				.array,
		);

		const rod = kit.cylinder(0.032, 0.032, 0.8, BRASS, 10);
		rod.rotation.z = Math.PI / 2;
		rod.position.set(0, ROD_HEIGHT, -0.02);
		this.body.add(rod);
		for (const side of [-1, 1]) {
			const finial = kit.cone(0.06, 0.16, BRASS, 8);
			finial.rotation.z = (-side * Math.PI) / 2;
			finial.position.set(side * 0.47, ROD_HEIGHT, -0.02);
			this.body.add(finial);
			const ring = kit.mesh(new THREE.TorusGeometry(0.06, 0.017, 6, 14), BRASS);
			ring.rotation.y = Math.PI / 2;
			ring.position.set(side * 0.31, ROD_HEIGHT - 0.02, -0.02);
			this.body.add(ring);
		}
		this.dust.position.set(0, ROD_HEIGHT, 0.1);
		this.body.add(this.dust);

		this.head = kit.pivot("head", 0, 1.52, 0.06);
		this.body.add(this.head);
		const hood = kit.mesh(hoodGeometry(0.2, 0.95), cloth);
		hood.scale.set(0.88, 1.1, 1);
		hood.rotation.x = 0.12;
		this.head.add(hood);
		const tip = kit.cone(0.08, 0.24, cloth, 10);
		tip.position.set(0, 0.16, -0.1);
		tip.rotation.x = -1.1;
		this.head.add(tip);
		const hollow = kit.sphere(0.18, SOCKET, [0.9, 1.05, 0.85], 14);
		hollow.position.z = -0.045;
		this.head.add(hollow);
		const mask = kit.sphere(0.12, cloth, [0.84, 1.3, 0.55], 14);
		mask.position.set(0, -0.035, 0.07);
		this.head.add(mask);
		for (const side of [-1, 1]) {
			const socket = kit.sphere(0.036, SOCKET, [0.75, 1.4, 0.55], 10);
			socket.position.set(side * 0.044, 0.012, 0.12);
			socket.rotation.y = side * 0.25;
			this.head.add(socket);
		}
		this.face.position.z = 0.3;
		this.head.add(this.face);

		for (const side of [-1, 1]) {
			const shoulder = kit.pivot("shoulder", side * 0.35, ROD_HEIGHT - 0.03, 0);
			this.body.add(shoulder);
			shoulder.add(
				kit.tube(
					[
						[0, 0.03, 0],
						[0, -0.2, 0.01],
						[0, -0.42, 0.02],
					],
					(t) => 0.045 + t * 0.03,
					cloth,
					8,
					10,
				),
			);
			const elbow = kit.pivot("elbow", 0, -0.4, 0.02);
			shoulder.add(elbow);
			elbow.add(
				kit.tube(
					[
						[0, 0.02, 0],
						[0, -0.26, 0.02],
						[0, -0.54, 0.07],
					],
					(t) => 0.032 * (1 - t) + 0.005,
					dark,
					8,
					6,
				),
			);
			this.arms.push({ shoulder, elbow });
		}
		this.light = {
			color: 0xb8c8ff,
			intensity: 0.4,
			radius: 3.2,
			offset: new THREE.Vector3(0, 1.5, 0.4),
		};
		this.glow = this.light;
		this.emitters.push({
			anchor: this.dust,
			rate: 3,
			color: 0xc8c0a8,
			speed: 0.25,
			up: -0.3,
			life: 1.8,
			size: 0.022,
			gravity: 0.25,
			spread: 0.8,
		});
	}

	update(input: AnomalyPoseInput): void {
		const awakening =
			input.state === "special" ? Math.min(1, input.stateMs / 1200) : 0;
		const hostile = input.extra >= 1 ? 1 : awakening;
		const windup = easeOut(this.windup(input, 700));
		const strike = this.strike(input);
		const sway = Math.sin(input.time * 1.4) * 0.08;
		this.body.rotation.x = 0.35 * (1 - hostile) + windup * 0.4 - strike * 0.2;
		this.body.rotation.z = sway * (1 - hostile * 0.5);
		this.body.scale.set(
			1 + hostile * 0.15,
			0.85 + hostile * 0.25 + windup * 0.05,
			1 + hostile * 0.15,
		);
		this.body.position.y = Math.sin(input.time * 2.1) * 0.03;
		const positions = this.cloak.geometry.getAttribute(
			"position",
		) as THREE.BufferAttribute;
		const ripple = 0.03 + hostile * 0.05 + Math.min(1, input.speed / 3) * 0.04;
		for (let index = 0; index < positions.count; index += 1) {
			const x = this.basePositions[index * 3];
			const y = this.basePositions[index * 3 + 1];
			const z = this.basePositions[index * 3 + 2];
			const lower = Math.max(0, 1 - y / 1.3);
			const wave =
				Math.sin(input.time * 4 + Math.atan2(z, x) * 5 + y * 3) *
				ripple *
				lower;
			positions.setXYZ(index, x * (1 + wave), y, z * (1 + wave));
		}
		positions.needsUpdate = true;
		for (const [index, arm] of this.arms.entries()) {
			const side = index === 0 ? -1 : 1;
			arm.shoulder.rotation.x =
				-0.25 -
				hostile * 0.5 -
				windup * 1.6 +
				strike * 2.2 +
				Math.sin(input.time * 2 + index) * 0.1;
			arm.shoulder.rotation.z = side * (0.05 + hostile * 0.6 + windup * 0.3);
			arm.elbow.rotation.x = -0.9 * (1 - hostile) - 0.3 - windup * 0.4;
		}
		const twitch = hostile * saccade(input.time, 6, 4) * 0.12;
		this.head.rotation.z =
			Math.sin(input.time * 0.7) * 0.3 * (1 - hostile) + twitch;
		this.head.rotation.x = -this.body.rotation.x * 0.6;
		this.follow(this.face, this.light.offset);
		this.light.intensity =
			0.35 + hostile * 1.4 + windup * 1.1 + Math.sin(input.time * 5) * 0.05;
		this.emitters[0].rate = 3 + hostile * 10;
	}
}
