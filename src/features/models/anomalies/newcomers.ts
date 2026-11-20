import { clearanceToward } from "@shared/anomalies/swarm";
import { RAT_KING_SWARM_RADIUS } from "@shared/config/index";
import * as THREE from "three";
import type { ModelKit } from "../modelKit";
import {
	AnomalyModel,
	type AnomalyPoseInput,
	easeOut,
	type GlowSpec,
} from "./AnomalyModel";
import { MIST_PUFFS, RAT_KNOT_HEIGHT, RAT_LAYOUT } from "./dimensions";

export class ColosseModel extends AnomalyModel {
	private readonly hips: THREE.Object3D;
	private readonly torso: THREE.Object3D;
	private readonly head: THREE.Object3D;
	private readonly visor: THREE.Object3D;
	private readonly knuckles: THREE.Object3D;
	private readonly slit: THREE.MeshBasicMaterial;
	private readonly light: GlowSpec;
	private readonly legs: { hip: THREE.Object3D; knee: THREE.Object3D }[] = [];

	private readonly arms: {
		shoulder: THREE.Object3D;
		elbow: THREE.Object3D;
	}[] = [];

	private readonly chains: THREE.Object3D[];

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/colosse");

		this.slit = rig.material<THREE.MeshBasicMaterial>("slit");
		this.hips = rig.node("hips");
		this.torso = rig.node("torso");
		this.head = rig.node("head");
		this.visor = rig.node("visor");
		this.knuckles = rig.node("knuckles");
		this.chains = rig.list("chain");

		for (let index = 0; index < 2; index += 1) {
			this.legs.push({
				hip: rig.node(`hip_${index}`),
				knee: rig.node(`knee_${index}`),
			});

			this.arms.push({
				shoulder: rig.node(`shoulder_${index}`),
				elbow: rig.node(`elbow_${index}`),
			});
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
	private readonly body: THREE.Object3D;
	private readonly horn: THREE.Object3D;
	private readonly cannon: THREE.Object3D;
	private readonly coils: THREE.MeshStandardMaterial;
	private readonly lens: THREE.MeshBasicMaterial;
	private readonly muzzle: THREE.Object3D;
	private readonly vent: THREE.Object3D;
	private readonly legs: THREE.Object3D[];

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/fulgurant");

		this.coils = rig.material<THREE.MeshStandardMaterial>("coils");
		this.lens = rig.material<THREE.MeshBasicMaterial>("lens");
		this.body = rig.node("body");
		this.legs = rig.list("leg");
		this.vent = rig.node("vent");
		this.horn = rig.node("horn");
		this.cannon = rig.node("cannon");
		this.muzzle = rig.node("muzzle");

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
	shoulder: THREE.Object3D;
	elbow: THREE.Object3D;
}

export class PleureuseModel extends AnomalyModel {
	private readonly statue: THREE.Object3D;
	private readonly head: THREE.Object3D;
	private readonly face: THREE.MeshBasicMaterial;
	private readonly arms: WeeperArm[] = [];
	private readonly chin: THREE.Object3D;
	private readonly gaze: THREE.Object3D;
	private readonly light: GlowSpec;

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/gorgone");

		this.face = rig.material<THREE.MeshBasicMaterial>("face");
		this.statue = rig.node("statue");
		this.head = rig.node("head");
		this.chin = rig.node("chin");
		this.gaze = rig.node("gaze");

		for (let index = 0; index < 2; index += 1) {
			this.arms.push({
				shoulder: rig.node(`shoulder_${index}`),
				elbow: rig.node(`elbow_${index}`),
			});
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

const MIST_TAIL_START = 4;

export class BrumeModel extends AnomalyModel {
	private readonly figure: THREE.Object3D;
	private readonly puffs: THREE.Object3D[];
	private readonly shells: THREE.Object3D[];
	private readonly eyes: THREE.Object3D[];
	private readonly sight: THREE.MeshBasicMaterial;
	private readonly brow: THREE.Object3D;
	private readonly tail: THREE.Object3D;
	private readonly light: GlowSpec;

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/brume");

		this.sight = rig.material<THREE.MeshBasicMaterial>("sight");
		this.figure = rig.node("figure");
		this.puffs = rig.list("puff");
		this.shells = rig.list("shell");
		this.eyes = rig.list("eye");
		this.brow = rig.node("brow");
		this.tail = rig.node("tail");

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
const RAT_MOUND = 0.32;

interface SwarmRat {
	root: THREE.Object3D;
	perch: THREE.Vector3;
	direction: THREE.Vector3;
	lane: number;
	turn: number;
}

export class RatRoiModel extends AnomalyModel {
	private readonly knot: THREE.Object3D;
	private readonly heart: THREE.MeshBasicMaterial;
	private readonly rats: SwarmRat[] = [];
	private readonly floor: THREE.Object3D;
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

		const rig = this.load("anomalies/rat-roi");

		this.heart = rig.material<THREE.MeshBasicMaterial>("heart");
		this.knot = rig.node("knot");
		this.floor = rig.node("floor");

		RAT_LAYOUT.forEach(([azimuth, elevation, twist], index) => {
			const slope = 0.12 + Math.sin(elevation) * 0.4;
			const heading = azimuth + twist;

			this.rats.push({
				root: rig.node(`rat_${index}`),
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
