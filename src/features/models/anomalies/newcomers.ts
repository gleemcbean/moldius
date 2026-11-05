import { clearanceToward } from "@shared/anomalies/swarm";
import { RAT_KING_SWARM_RADIUS } from "@shared/config/index";
import * as THREE from "three";
import type { MaterialOptions } from "../../world/MaterialLibrary";
import type { ModelKit } from "../modelKit";
import {
	AnomalyModel,
	type AnomalyPoseInput,
	easeOut,
	type GlowSpec,
} from "./AnomalyModel";
import { SOCKET } from "./parts";

const IRON_PLATE: MaterialOptions = {
	texture: "armorPlate",
	color: 0x4e463e,
	roughness: 0.55,
	metalness: 0.6,
};
const CHAIN: MaterialOptions = {
	texture: "iron",
	color: 0x8a7a6a,
	roughness: 0.55,
	metalness: 0.7,
};
const BRASS_BODY: MaterialOptions = {
	texture: "brass",
	color: 0x9a845a,
	roughness: 0.45,
	metalness: 0.75,
};
const COPPER_BODY: MaterialOptions = {
	texture: "copper",
	color: 0x8a7060,
	roughness: 0.45,
	metalness: 0.7,
};
const DARK_IRON: MaterialOptions = {
	color: 0x221c18,
	roughness: 0.6,
	metalness: 0.5,
};

const WEEPER_ROBE: [number, number][] = [
	[0.25, 0],
	[0.24, 0.3],
	[0.2, 0.62],
	[0.16, 0.84],
	[0.19, 1.0],
	[0.2, 1.1],
	[0.12, 1.17],
	[0.001, 1.19],
];

function chainLinks(kit: ModelKit, count: number): THREE.Group {
	const chain = new THREE.Group();
	for (let index = 0; index < count; index += 1) {
		const link = kit.mesh(new THREE.TorusGeometry(0.055, 0.02, 6, 10), CHAIN);
		link.position.y = -index * 0.085;
		link.rotation.y = index % 2 === 0 ? 0 : Math.PI / 2;
		chain.add(link);
	}
	return chain;
}

export class ColosseModel extends AnomalyModel {
	private readonly hips: THREE.Group;
	private readonly torso: THREE.Group;
	private readonly head: THREE.Group;
	private readonly visor = new THREE.Object3D();
	private readonly knuckles = new THREE.Object3D();
	private readonly slit: THREE.MeshBasicMaterial;
	private readonly light: GlowSpec;
	private readonly legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
	private readonly arms: { shoulder: THREE.Group; elbow: THREE.Group }[] = [];
	private readonly chains: THREE.Group[] = [];

	constructor(kit: ModelKit) {
		super(kit);
		const skin: MaterialOptions = { color: 0x4a3e38, roughness: 0.8 };
		const leather: MaterialOptions = { color: 0x261810, roughness: 0.85 };
		this.slit = this.own(new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
		this.hips = kit.pivot("hips", 0, 1.0, 0);
		this.root.add(this.hips);
		this.hips.add(kit.sphere(0.32, leather, [1.3, 0.7, 1], 14));
		for (const side of [-1, 1]) {
			const hip = kit.pivot("hip", side * 0.24, -0.05, 0);
			this.hips.add(hip);
			hip.add(kit.limb(0.14, 0.42, leather, 10));
			const knee = kit.pivot("knee", 0, -0.48, 0);
			hip.add(knee);
			knee.add(kit.sphere(0.15, IRON_PLATE, [1, 1, 1], 10));
			knee.add(kit.limb(0.13, 0.36, IRON_PLATE, 10));
			const boot = kit.box(0.28, 0.18, 0.42, IRON_PLATE);
			boot.position.set(0, -0.44, 0.06);
			knee.add(boot);
			this.legs.push({ hip, knee });
		}
		this.torso = kit.pivot("torso", 0, 0.12, 0);
		this.hips.add(this.torso);
		this.torso.add(
			kit.lathe(
				[
					[0.001, 0],
					[0.36, 0.05],
					[0.47, 0.45],
					[0.55, 0.78],
					[0.36, 0.98],
					[0.001, 1.0],
				],
				IRON_PLATE,
				16,
			),
		);
		const belt = kit.mesh(
			new THREE.TorusGeometry(0.38, 0.055, 6, 22).rotateX(Math.PI / 2),
			leather,
		);
		belt.position.y = 0.09;
		this.torso.add(belt);
		const collar = kit.mesh(
			new THREE.TorusGeometry(0.28, 0.075, 6, 20).rotateX(Math.PI / 2),
			IRON_PLATE,
		);
		collar.position.y = 0.95;
		this.torso.add(collar);

		this.head = kit.pivot("head", 0, 1.12, 0.1);
		this.torso.add(this.head);
		this.head.add(kit.cylinder(0.17, 0.19, 0.34, IRON_PLATE, 14));
		const dome = kit.sphere(0.17, IRON_PLATE, [1, 0.55, 1], 14);
		dome.position.y = 0.17;
		this.head.add(dome);
		const slot = kit.box(0.3, 0.075, 0.06, SOCKET);
		slot.position.set(0, 0.03, 0.16);
		this.head.add(slot);
		const glare = kit.box(0.26, 0.036, 0.04, this.slit);
		glare.position.set(0, 0.03, 0.172);
		this.head.add(glare);
		const crest = kit.box(0.06, 0.12, 0.32, IRON_PLATE);
		crest.position.set(0, 0.26, 0);
		this.head.add(crest);
		this.visor.position.set(0, 0.03, 0.4);
		this.head.add(this.visor);

		for (const side of [-1, 1]) {
			const pauldron = kit.sphere(0.24, IRON_PLATE, [1.2, 0.85, 1.1], 12);
			pauldron.position.set(side * 0.56, 0.86, 0);
			this.torso.add(pauldron);
			for (const lean of [-0.45, 0, 0.45]) {
				const spike = kit.cone(0.05, 0.18, DARK_IRON, 6);
				spike.position.set(side * 0.62, 1.06, lean * 0.3);
				spike.rotation.set(lean * 0.6, 0, -side * 0.45);
				this.torso.add(spike);
			}
			const shoulder = kit.pivot("shoulder", side * 0.6, 0.78, 0);
			this.torso.add(shoulder);
			shoulder.add(kit.limb(0.13, 0.5, skin, 10));
			const elbow = kit.pivot("elbow", 0, -0.58, 0);
			shoulder.add(elbow);
			elbow.add(kit.limb(0.13, 0.46, IRON_PLATE, 10));
			const cuff = kit.cylinder(0.165, 0.165, 0.12, CHAIN, 12);
			cuff.position.y = -0.42;
			elbow.add(cuff);
			const fist = kit.sphere(0.18, skin, [1, 1.1, 1], 12);
			fist.position.y = -0.64;
			elbow.add(fist);
			if (side === 1) {
				this.knuckles.position.y = -0.7;
				elbow.add(this.knuckles);
			}
			const chain = chainLinks(kit, 3);
			chain.position.set(side * 0.1, -0.5, 0.05);
			elbow.add(chain);
			this.chains.push(chain);
			this.arms.push({ shoulder, elbow });
		}
		this.light = {
			color: 0xff6a20,
			intensity: 0.6,
			radius: 3,
			offset: new THREE.Vector3(0, 2.25, 0.5),
		};
		this.glow = this.light;
		this.emitters.push({
			anchor: this.knuckles,
			rate: 0,
			color: 0xffb050,
			speed: 2,
			up: 0.5,
			life: 0.4,
			size: 0.025,
			gravity: 6,
			spread: 0.15,
		});
	}

	update(input: AnomalyPoseInput): void {
		const moving = Math.min(1, input.speed / 2.5);
		const phase = this.advanceWalk(input, 1.1);
		const swing = Math.sin(phase) * 0.45 * moving;
		const windup = easeOut(this.windup(input, 900));
		const strike = this.strike(input, 380);
		this.legs[0].hip.rotation.x = swing;
		this.legs[1].hip.rotation.x = -swing;
		this.legs[0].knee.rotation.x = Math.max(0, -Math.sin(phase)) * 0.6 * moving;
		this.legs[1].knee.rotation.x = Math.max(0, Math.sin(phase)) * 0.6 * moving;
		this.hips.position.y =
			1.0 + Math.abs(Math.cos(phase)) * 0.06 * moving - windup * 0.12;
		this.torso.rotation.x = 0.3 + moving * 0.1 - windup * 0.2 + strike * 0.45;
		this.torso.rotation.z = Math.sin(phase) * 0.05 * moving;
		for (const [index, arm] of this.arms.entries()) {
			const side = index === 0 ? -1 : 1;
			arm.shoulder.rotation.x =
				-swing * side * 0.5 - windup * 2.6 + strike * 3.2;
			arm.shoulder.rotation.z = side * (0.25 + windup * 0.35 - strike * 0.2);
			arm.elbow.rotation.x = -0.35 - windup * 0.6 + strike * 0.3;
		}
		for (const [index, chain] of this.chains.entries()) {
			chain.rotation.x = Math.sin(input.time * 3 + index) * 0.25 * moving;
		}
		const angry = input.state === "chase" || input.state === "windup" ? 1 : 0;
		this.head.rotation.y =
			input.state === "search" || input.state === "idle"
				? Math.sin(input.time * 0.9) * 0.5
				: 0;
		this.head.rotation.x = -0.15 - angry * 0.1;
		const heat =
			0.7 + angry * 0.5 + windup * 0.6 + Math.sin(input.time * 7) * 0.05;
		this.slit.color.setRGB(heat, 0.42 * heat, 0.12 * heat);
		this.follow(this.visor, this.light.offset);
		this.light.intensity = 0.5 + angry * 1 + windup * 0.8;
		this.emitters[0].rate = windup * 18 + strike * 60;
	}
}

export class FulgurantModel extends AnomalyModel {
	private readonly body: THREE.Group;
	private readonly horn: THREE.Group;
	private readonly cannon: THREE.Group;
	private readonly coils: THREE.MeshStandardMaterial;
	private readonly lens: THREE.MeshBasicMaterial;
	private readonly muzzle = new THREE.Object3D();
	private readonly vent = new THREE.Object3D();
	private readonly legs: THREE.Group[] = [];

	constructor(kit: ModelKit) {
		super(kit);
		this.coils = this.own(
			kit.unique({
				color: 0x3a2014,
				emissive: 0xff3a1a,
				emissiveIntensity: 0,
				roughness: 0.5,
				metalness: 0.4,
			}),
		) as THREE.MeshStandardMaterial;
		this.lens = this.own(new THREE.MeshBasicMaterial({ color: 0x5a2a20 }));
		this.body = kit.pivot("body", 0, 0.95, 0);
		this.root.add(this.body);
		for (let index = 0; index < 3; index += 1) {
			const angle = (index / 3) * Math.PI * 2 + Math.PI / 2;
			const leg = kit.pivot(
				"leg",
				Math.cos(angle) * 0.12,
				0,
				Math.sin(angle) * 0.12,
			);
			this.body.add(leg);
			leg.add(kit.limb(0.055, 0.92, COPPER_BODY, 8));
			leg.rotation.set(-Math.sin(angle) * 0.35, 0, Math.cos(angle) * 0.35);
			const knee = kit.sphere(0.075, BRASS_BODY, [1, 1, 1], 10);
			knee.position.y = -0.45;
			leg.add(knee);
			const foot = kit.cone(0.09, 0.14, DARK_IRON, 6);
			foot.rotation.x = Math.PI;
			foot.position.y = -0.98;
			leg.add(foot);
			this.legs.push(leg);
		}
		this.body.add(
			kit.lathe(
				[
					[0.001, -0.05],
					[0.26, 0],
					[0.32, 0.25],
					[0.3, 0.5],
					[0.2, 0.62],
					[0.001, 0.64],
				],
				BRASS_BODY,
				16,
			),
		);
		const band = kit.mesh(
			new THREE.TorusGeometry(0.322, 0.03, 6, 24).rotateX(Math.PI / 2),
			COPPER_BODY,
		);
		band.position.y = 0.25;
		this.body.add(band);
		this.vent.position.y = 0.66;
		this.body.add(this.vent);
		this.horn = kit.pivot("horn", 0, 0.62, 0);
		this.body.add(this.horn);
		const neck = kit.cylinder(0.06, 0.08, 0.16, BRASS_BODY, 10);
		neck.position.y = 0.08;
		this.horn.add(neck);
		const bell = kit.lathe(
			[
				[0.05, 0],
				[0.07, 0.12],
				[0.14, 0.24],
				[0.3, 0.34],
				[0.34, 0.36],
			],
			{ ...BRASS_BODY, side: THREE.DoubleSide },
			18,
		);
		bell.rotation.x = Math.PI / 2 - 0.25;
		bell.position.set(0, 0.17, 0.02);
		this.horn.add(bell);
		const throat = kit.mesh(new THREE.CircleGeometry(0.075, 12), SOCKET);
		throat.rotation.x = -Math.PI / 2;
		throat.position.y = 0.04;
		bell.add(throat);
		this.cannon = kit.pivot("cannon", 0.32, 0.42, 0.02);
		this.body.add(this.cannon);
		this.cannon.add(kit.sphere(0.11, BRASS_BODY, [1, 1, 1], 10));
		const barrel = kit.cylinder(0.065, 0.085, 0.62, COPPER_BODY, 12);
		barrel.rotation.x = Math.PI / 2;
		barrel.position.set(0, 0, 0.32);
		this.cannon.add(barrel);
		for (let index = 0; index < 4; index += 1) {
			const coil = kit.mesh(
				new THREE.TorusGeometry(0.095, 0.026, 6, 14),
				this.coils,
			);
			coil.position.set(0, 0, 0.12 + index * 0.13);
			this.cannon.add(coil);
		}
		const tip = kit.cylinder(0.06, 0.05, 0.06, DARK_IRON, 10);
		tip.rotation.x = Math.PI / 2;
		tip.position.set(0, 0, 0.66);
		this.cannon.add(tip);
		const crystal = kit.sphere(0.045, this.lens, [1, 1, 1], 10);
		crystal.position.set(0, 0, 0.7);
		this.cannon.add(crystal);
		this.muzzle.position.set(0, 0, 0.74);
		this.cannon.add(this.muzzle);
		this.glow = {
			color: 0xff4a2a,
			intensity: 0,
			radius: 3.5,
			offset: new THREE.Vector3(0.32, 1.37, 0.7),
		};
		this.emitters.push(
			{
				anchor: this.muzzle,
				rate: 0,
				color: 0xff6a3a,
				speed: 1.2,
				up: 0.2,
				life: 0.35,
				size: 0.022,
				gravity: 0,
				spread: 0.08,
			},
			{
				anchor: this.vent,
				rate: 0,
				color: 0xffa060,
				speed: 0.5,
				up: 2,
				life: 1.1,
				size: 0.022,
				gravity: -1,
				spread: 0.2,
			},
		);
	}

	update(input: AnomalyPoseInput): void {
		const moving = Math.min(1, input.speed / 1.6);
		const phase = this.advanceWalk(input, 2.2);
		for (const [index, leg] of this.legs.entries()) {
			leg.position.y =
				Math.max(0, Math.sin(phase + (index * Math.PI * 2) / 3)) *
				0.06 *
				moving;
		}
		const charging = input.state === "windup";
		const overheated = input.state === "special";
		const listening = input.state === "investigate" || input.state === "chase";
		const charge = charging ? input.extra : 0;
		const heat = overheated ? input.extra : 0;
		this.body.position.y =
			0.95 + Math.sin(input.time * 6) * 0.01 + charge * 0.02;
		this.body.rotation.z = Math.sin(phase) * 0.04 * moving;
		this.cannon.rotation.x = charging ? -0.15 : overheated ? 0.55 : 0.25;
		this.cannon.rotation.z = charging
			? Math.sin(input.time * 40) * 0.02 * charge
			: 0;
		this.horn.rotation.y = overheated
			? 0
			: Math.sin(input.time * (listening ? 3 : 1.2)) * 0.6;
		this.horn.rotation.x = overheated ? 0.4 : 0;
		this.coils.emissive.setHex(charging ? 0xff3a1a : 0xff7a2a);
		this.coils.emissiveIntensity = charging
			? 0.5 + charge * 3.5
			: heat * 2.2 + (overheated ? Math.sin(input.time * 9) * 0.2 : 0);
		const glowing = charging ? 0.4 + charge * 1.4 : heat * 0.8;
		this.lens.color.setRGB(
			0.35 + glowing,
			0.16 + glowing * 0.45,
			0.12 + glowing * 0.2,
		);
		if (this.glow) {
			this.glow.color = charging ? 0xff4a2a : 0xff8a3a;
			this.glow.intensity = charging ? charge * 2.6 : heat * 0.9;
		}
		this.emitters[0].rate = charging ? charge * 40 : 0;
		this.emitters[1].rate = heat * 22;
	}
}

interface WeeperArm {
	shoulder: THREE.Group;
	elbow: THREE.Group;
}

export class PleureuseModel extends AnomalyModel {
	private readonly statue: THREE.Group;
	private readonly head: THREE.Group;
	private readonly face: THREE.MeshBasicMaterial;
	private readonly arms: WeeperArm[] = [];
	private readonly chin = new THREE.Object3D();
	private readonly gaze = new THREE.Object3D();
	private readonly light: GlowSpec;

	constructor(kit: ModelKit) {
		super(kit);
		const stone: MaterialOptions = {
			texture: "stoneSmooth",
			color: 0xa29e94,
			roughness: 0.95,
		};
		const plinthStone: MaterialOptions = {
			texture: "stoneSmooth",
			color: 0x6a665e,
			roughness: 1,
		};
		this.face = this.own(new THREE.MeshBasicMaterial({ color: 0x6affd8 }));
		this.root.add(kit.box(0.64, 0.24, 0.64, plinthStone));
		this.root.children[0].position.y = 0.12;
		const slab = kit.box(0.54, 0.07, 0.54, plinthStone);
		slab.position.y = 0.275;
		this.root.add(slab);

		this.statue = kit.pivot("statue", 0, 0.31, 0);
		this.statue.scale.setScalar(1.12);
		this.root.add(this.statue);
		const robe = kit.pleatedLathe(
			WEEPER_ROBE,
			stone,
			9,
			(_radius, height) => 0.07 * Math.max(0, 1 - height / 1.1),
			30,
		);
		this.statue.add(robe);

		this.head = kit.pivot("head", 0, 1.27, 0.03);
		this.statue.add(this.head);
		this.head.add(kit.sphere(0.15, stone, [0.9, 1.08, 0.95], 16));
		const nape = kit.sphere(0.13, stone, [1, 1.05, 1], 12);
		nape.position.set(0, -0.02, -0.07);
		this.head.add(nape);
		const glow = kit.sphere(0.12, this.face, [0.86, 1.05, 0.42], 14);
		glow.position.set(0, -0.01, 0.1);
		this.head.add(glow);
		this.chin.position.set(0, -0.14, 0.16);
		this.gaze.position.set(0, 0, 0.5);
		this.head.add(this.chin, this.gaze);

		for (const side of [-1, 1]) {
			const shoulder = kit.pivot("shoulder", side * 0.2, 1.1, 0);
			this.statue.add(shoulder);
			shoulder.add(kit.limb(0.062, 0.3, stone, 10));
			const elbow = kit.pivot("elbow", 0, -0.3, 0);
			shoulder.add(elbow);
			elbow.add(kit.limb(0.055, 0.28, stone, 10));
			const palm = kit.sphere(0.09, stone, [0.72, 1.2, 0.48], 12);
			palm.position.y = -0.32;
			elbow.add(palm);
			this.arms.push({ shoulder, elbow });
		}
		this.light = {
			color: 0x6affd8,
			intensity: 0.2,
			radius: 3.2,
			offset: new THREE.Vector3(0, 1.75, 0.45),
		};
		this.glow = this.light;
		this.emitters.push({
			anchor: this.chin,
			rate: 1,
			color: 0x8affe4,
			speed: 0.08,
			up: 0,
			life: 1.4,
			size: 0.022,
			gravity: 1.2,
			spread: 0.25,
		});
	}

	update(input: AnomalyPoseInput): void {
		const shriek = input.state === "special" ? 1 : 0;
		const lunge = input.state === "chase" ? 1 : 0;
		const windup = easeOut(this.windup(input, 420));
		const strike = this.strike(input, 260);
		const unveiled = Math.max(shriek, lunge, windup, strike);
		const stare = unveiled > 0 ? 1 : input.extra;
		const tremble = stare * (1 - unveiled) * Math.sin(input.time * 31) * 0.012;
		this.statue.rotation.x =
			lunge * 0.32 + windup * 0.18 + strike * 0.12 - shriek * 0.08;
		this.statue.rotation.z = tremble;
		this.head.rotation.x = 0.32 * (1 - unveiled) - shriek * 0.42 - lunge * 0.1;
		const part = stare * 0.12 * (1 - unveiled);
		const covered = 1 - unveiled;
		for (const [index, arm] of this.arms.entries()) {
			const side = index === 0 ? -1 : 1;
			const openX = 0.15 * shriek - lunge * 1.35 - windup * 2.3 + strike * 1.8;
			const openZ = side * (0.32 * shriek + 0.16 * (1 - shriek));
			arm.shoulder.rotation.x = -0.885 * covered + openX * unveiled;
			arm.shoulder.rotation.z =
				-side * (0.27 - part) * covered + openZ * unveiled;
			arm.elbow.rotation.x =
				-2.22 * covered + (-0.35 * shriek - 0.2 - windup * 0.3) * unveiled;
			arm.elbow.rotation.z = -side * (0.38 + part) * covered;
		}
		const burn = Math.min(
			1,
			0.35 + stare * 0.35 + unveiled * 0.3 + Math.sin(input.time * 5) * 0.04,
		);
		this.face.color.setRGB(0.3 * burn, burn, 0.8 * burn);
		this.follow(this.gaze, this.light.offset);
		this.light.intensity = 0.15 + stare * 0.6 + unveiled * 1.4;
		this.emitters[0].rate = 1 + stare * 7 + unveiled * 12;
	}
}

const MIST_PUFFS: [number, number, number, number][] = [
	[0, 1.02, 0.02, 0.27],
	[-0.21, 0.86, -0.04, 0.24],
	[0.22, 0.84, -0.02, 0.23],
	[0, 0.72, -0.05, 0.3],
	[-0.05, 0.48, -0.1, 0.24],
	[0.04, 0.29, -0.16, 0.18],
	[-0.03, 0.14, -0.24, 0.12],
	[0.02, 0.04, -0.32, 0.075],
];
const MIST_SHELL_COUNT = 4;
const MIST_TAIL_START = 4;

export class BrumeModel extends AnomalyModel {
	private readonly figure = new THREE.Group();
	private readonly puffs: THREE.Mesh[] = [];
	private readonly shells: THREE.Mesh[] = [];
	private readonly eyes: THREE.Mesh[] = [];
	private readonly sight: THREE.MeshBasicMaterial;
	private readonly brow = new THREE.Object3D();
	private readonly tail = new THREE.Object3D();
	private readonly light: GlowSpec;

	constructor(kit: ModelKit) {
		super(kit);
		const body: MaterialOptions = {
			color: 0x262a32,
			roughness: 1,
			fog: false,
		};
		const inner: MaterialOptions = { ...body, color: 0x343944 };
		const shell: MaterialOptions = {
			color: 0x8a94a6,
			roughness: 1,
			transparent: true,
			opacity: 0.2,
			depthWrite: false,
			fog: false,
		};
		this.sight = this.own(
			new THREE.MeshBasicMaterial({ color: 0xbfe4ff, fog: false }),
		);
		this.root.add(this.figure);
		this.figure.scale.setScalar(0.66);
		MIST_PUFFS.forEach(([x, y, z, radius], index) => {
			const puff = kit.sphere(
				radius,
				index % 2 ? inner : body,
				[1, 0.92, 1],
				12,
			);
			puff.position.set(x, y, z);
			this.figure.add(puff);
			this.puffs.push(puff);
			if (index < MIST_SHELL_COUNT) {
				const halo = kit.sphere(radius * 1.28, shell, [1, 0.95, 1], 12);
				halo.position.set(x, y, z);
				this.figure.add(halo);
				this.shells.push(halo);
			}
		});
		for (const side of [-1, 1]) {
			const eye = kit.sphere(0.036, this.sight, [0.62, 1.55, 0.45], 8);
			eye.position.set(side * 0.085, 1.0, 0.26);
			eye.rotation.y = side * 0.25;
			this.figure.add(eye);
			this.eyes.push(eye);
		}
		this.brow.position.set(0, 1.0, 0.45);
		this.tail.position.set(0, 0.06, -0.34);
		this.figure.add(this.brow, this.tail);
		this.light = {
			color: 0x9ab8ff,
			intensity: 0.35,
			radius: 3,
			offset: new THREE.Vector3(0, 1.45, 0.45),
		};
		this.glow = this.light;
		this.emitters.push(
			{
				anchor: this.tail,
				rate: 5,
				color: 0x6e7888,
				speed: 0.22,
				up: 0.3,
				life: 1.8,
				size: 0.045,
				gravity: -0.12,
				spread: 0.35,
			},
			{
				anchor: this.figure,
				rate: 0,
				color: 0x7e889a,
				speed: 0.35,
				up: 0.5,
				life: 1.4,
				size: 0.05,
				gravity: -0.1,
				spread: 0.9,
			},
		);
	}

	update(input: AnomalyPoseInput): void {
		const cling = input.extra;
		const time = input.time;
		this.figure.position.y = Math.sin(time * 1.8) * 0.04;
		this.figure.rotation.x = Math.min(0.35, input.speed * 0.08);
		this.figure.rotation.z = Math.sin(time * 0.9) * 0.05;
		this.puffs.forEach((puff, index) => {
			const breath =
				1 +
				Math.sin(time * (1.6 + cling) + index * 1.3) * (0.05 + cling * 0.04);
			puff.scale.setScalar(breath * (1 + cling * 0.08));
			if (index >= MIST_TAIL_START) {
				const sway = (index - MIST_TAIL_START + 1) * 0.035;
				puff.position.x =
					MIST_PUFFS[index][0] + Math.sin(time * 2.1 + index * 0.8) * sway;
			}
		});
		this.shells.forEach((shell, index) => {
			shell.scale.setScalar(
				1 + Math.sin(time * 1.1 + index * 2.1) * 0.08 + cling * 0.15,
			);
		});
		const glint = 0.55 + cling * 0.45 + Math.sin(time * 2.7) * 0.06;
		this.sight.color.setRGB(0.75 * glint, 0.89 * glint, glint);
		for (const eye of this.eyes) {
			eye.scale.y = 1 + cling * 0.25;
		}
		this.follow(this.brow, this.light.offset);
		this.light.intensity = 0.3 + cling * 0.55;
		this.emitters[1].rate = cling * 10;
	}
}

const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3();
const RAT_SCALE = 0.9;
const RAT_KNOT_HEIGHT = 0.2;
const RAT_MOUND = 0.32;

const RAT_PROFILE: [number, number][] = [
	[0.001, -0.02],
	[0.08, 0.02],
	[0.13, 0.1],
	[0.135, 0.18],
	[0.11, 0.26],
	[0.075, 0.31],
	[0.08, 0.35],
	[0.06, 0.41],
	[0.03, 0.46],
	[0.001, 0.49],
];
const RAT_LAYOUT: [number, number, number][] = [
	[0, 0.05, 0.3],
	[1.05, 0.02, -0.4],
	[2.1, 0.06, 0.5],
	[3.15, 0.03, -0.2],
	[4.2, 0.05, 0.45],
	[5.25, 0.02, -0.5],
	[0.5, 0.62, -0.7],
	[1.75, 0.58, 0.6],
	[3.0, 0.66, -0.5],
	[4.25, 0.6, 0.8],
	[5.5, 0.64, -0.3],
	[1.1, 1.15, 1.2],
	[3.2, 1.2, -1.1],
	[5.2, 1.1, 0.9],
];

interface SwarmRat {
	root: THREE.Group;
	perch: THREE.Vector3;
	direction: THREE.Vector3;
	lane: number;
	turn: number;
}

export class RatRoiModel extends AnomalyModel {
	private readonly knot = new THREE.Group();
	private readonly heart: THREE.MeshBasicMaterial;
	private readonly rats: SwarmRat[] = [];
	private readonly floor = new THREE.Object3D();
	private readonly light: GlowSpec;
	private churn = 0;
	private readonly matrix = new THREE.Matrix4();
	private readonly gathered = new THREE.Quaternion();
	private readonly running = new THREE.Quaternion();
	private readonly wriggle = new THREE.Quaternion();
	private readonly euler = new THREE.Euler();
	private readonly spot = new THREE.Vector3();
	private readonly heading = new THREE.Vector3();
	private readonly origin = new THREE.Vector3();

	constructor(kit: ModelKit) {
		super(kit);
		const fur: MaterialOptions = { color: 0x1c1816, roughness: 0.9 };
		const flank: MaterialOptions = { color: 0x2a2320, roughness: 0.85 };
		const tail: MaterialOptions = { color: 0x5a3e3c, roughness: 0.5 };
		const skin: MaterialOptions = { color: 0x3a2a28, roughness: 0.7 };
		this.heart = this.own(new THREE.MeshBasicMaterial({ color: 0xb070ff }));
		this.knot.position.y = RAT_KNOT_HEIGHT;
		this.root.add(this.knot);
		for (const [x, y, z] of [
			[Math.PI / 2, 0, 0],
			[0, Math.PI / 2, 0.6],
			[0.7, 0, Math.PI / 2],
		]) {
			const loop = kit.mesh(new THREE.TorusGeometry(0.12, 0.05, 8, 18), tail);
			loop.rotation.set(x, y, z);
			this.knot.add(loop);
		}
		this.knot.add(kit.sphere(0.11, this.heart, [1, 1, 1], 10));

		RAT_LAYOUT.forEach(([azimuth, elevation, twist], index) => {
			const root = new THREE.Group();
			root.scale.setScalar(RAT_SCALE * (0.88 + (index % 3) * 0.07));
			const body = kit.lathe(RAT_PROFILE, index % 2 ? flank : fur, 12);
			body.rotation.x = Math.PI / 2;
			body.scale.set(1, 1, 0.8);
			root.add(body);
			for (const side of [-1, 1]) {
				const ear = kit.sphere(0.042, skin, [1, 1, 0.45], 8);
				ear.position.set(side * 0.05, 0.075, 0.33);
				ear.rotation.z = side * 0.4;
				root.add(ear);
			}
			root.add(
				kit.tube(
					[
						[0, 0, 0.02],
						[0.03, -0.05, -0.1],
						[-0.02, -0.13, -0.2],
					],
					(t) => 0.04 - t * 0.02,
					tail,
					8,
					6,
				),
			);
			this.root.add(root);
			const slope = 0.12 + Math.sin(elevation) * 0.4;
			const heading = azimuth + twist;
			this.rats.push({
				root,
				perch: new THREE.Vector3(
					Math.cos(elevation) * Math.sin(azimuth),
					Math.sin(elevation),
					Math.cos(elevation) * Math.cos(azimuth),
				).multiplyScalar(RAT_MOUND),
				direction: new THREE.Vector3(
					Math.sin(heading) * Math.cos(slope),
					-Math.sin(slope),
					Math.cos(heading) * Math.cos(slope),
				),
				lane: 0.3 + ((index * 5) % 14) / 19,
				turn: (index % 2 ? 1 : -1) * (0.7 + (index % 3) * 0.25),
			});
		});
		this.floor.position.y = 0.05;
		this.root.add(this.floor);
		this.light = {
			color: 0xb070ff,
			intensity: 0.5,
			radius: 3,
			offset: new THREE.Vector3(0, RAT_KNOT_HEIGHT + 0.2, 0.3),
		};
		this.glow = this.light;
		this.emitters.push(
			{
				anchor: this.floor,
				rate: 2,
				color: 0x4e4236,
				speed: 0.4,
				up: 0.25,
				life: 0.9,
				size: 0.04,
				gravity: 0.2,
				spread: 0.6,
			},
			{
				anchor: this.knot,
				rate: 2,
				color: 0xc890ff,
				speed: 0.25,
				up: 0.35,
				life: 1,
				size: 0.022,
				gravity: -0.15,
				spread: 0.3,
			},
		);
	}

	update(input: AnomalyPoseInput): void {
		const spread = input.extra * input.extra * (3 - 2 * input.extra);
		const gathered = 1 - spread;
		const time = input.time;
		const windup = easeOut(this.windup(input, 600));
		const strike = this.strike(input, 260);
		this.churn += input.dt * (0.35 + input.speed * 0.6) * gathered;
		const lunge = windup * 0.12 + strike * 0.35;
		this.knot.position.set(
			0,
			RAT_KNOT_HEIGHT + Math.abs(Math.sin(time * 6)) * 0.03 * gathered,
			lunge,
		);
		this.knot.rotation.set(time * 0.4, this.churn * 1.3, time * 0.25);
		this.knot.scale.setScalar(Math.max(0.001, 1 - spread * 1.2));
		for (const [index, rat] of this.rats.entries()) {
			this.heading.copy(rat.direction).applyAxisAngle(UP, this.churn);
			const crawl =
				Math.sin(time * 4 + index) * 0.03 +
				windup * 0.12 * Math.max(0, this.heading.z) -
				0.22;
			this.origin
				.copy(rat.perch)
				.applyAxisAngle(UP, this.churn)
				.add(this.knot.position)
				.addScaledVector(this.heading, crawl);
			this.gathered.setFromRotationMatrix(
				this.matrix.lookAt(this.heading, ORIGIN, UP),
			);
			this.wriggle.setFromEuler(
				this.euler.set(
					Math.sin(time * 5.3 + index) * 0.14,
					Math.sin(time * 7 + index * 1.7) * 0.28,
					0,
				),
			);
			this.gathered.multiply(this.wriggle);

			const angle = index * 0.7 + time * rat.turn;
			const room = input.clearance
				? clearanceToward(input.clearance, angle)
				: RAT_KING_SWARM_RADIUS;
			const radius = Math.min(
				room,
				RAT_KING_SWARM_RADIUS * rat.lane +
					Math.sin(time * 3 + index * 2) * 0.25,
			);
			this.spot.set(Math.sin(angle) * radius, 0.1, Math.cos(angle) * radius);
			this.heading
				.set(Math.cos(angle), 0, -Math.sin(angle))
				.multiplyScalar(Math.sign(rat.turn));
			this.running.setFromRotationMatrix(
				this.matrix.lookAt(this.heading, ORIGIN, UP),
			);

			rat.root.position.lerpVectors(this.origin, this.spot, spread);
			rat.root.position.y += Math.sin(Math.PI * spread) * 0.35;
			rat.root.quaternion.slerpQuaternions(this.gathered, this.running, spread);
		}
		const pulse = Math.sin(time * 3.1) * 0.5 + 0.5;
		const burn = 0.6 + pulse * 0.4;
		this.heart.color.setRGB(0.69 * burn, 0.44 * burn, burn);
		this.follow(this.knot, this.light.offset);
		this.light.intensity =
			0.15 + gathered * (0.4 + pulse * 0.15) + windup * 0.4;
		this.emitters[0].rate = 2 + input.speed * 3 + spread * 16;
		this.emitters[1].rate = gathered * 3;
	}
}
