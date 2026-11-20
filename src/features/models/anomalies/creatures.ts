import { DEFAULT_HAT_PATTERN, type HatPattern } from "@shared/hatPatterns";
import * as THREE from "three";
import { MUSHROOM_CAP_REST, MushroomModel } from "../MushroomModel";
import type { ModelKit } from "../modelKit";
import {
	AnomalyModel,
	type AnomalyPoseInput,
	easeOut,
	type GlowSpec,
} from "./AnomalyModel";
import { BRAZIER_HEIGHT, BRAZIER_LIFT, SAC_SCALE } from "./dimensions";
import { basePositions, deform } from "./parts";

const CAP_HINGE = 0.2;
const PORTRAIT_CAP_OPENING = 0.5;

interface BrazierLeg {
	hip: THREE.Object3D;
	thigh: THREE.Object3D;
	angle: number;
	group: number;
}

export class BrasierModel extends AnomalyModel {
	private readonly body: THREE.Object3D;
	private readonly fire: THREE.MeshBasicMaterial;
	private readonly coals: THREE.Object3D;
	private readonly flames: THREE.Mesh[];
	private readonly light: GlowSpec;
	private readonly legs: BrazierLeg[] = [];

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/crache-cendre");

		this.fire = rig.material<THREE.MeshBasicMaterial>("fire");
		this.body = rig.node("body");
		this.flames = rig.meshes("flame");
		this.coals = rig.node("coals");

		for (let index = 0; index < 6; index += 1) {
			this.legs.push({
				hip: rig.node(`hip_${index}`),
				thigh: rig.node(`thigh_${index}`),
				angle: (index / 6) * Math.PI * 2,
				group: index % 2,
			});
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
	private readonly puddle: THREE.Object3D;
	private readonly skull: THREE.Object3D;

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/suinteur");

		this.skull = rig.node("skull");
		this.blob = rig.mesh("blob");

		rig.ownGeometry(this.blob);

		this.base = basePositions(this.blob);
		this.puddle = rig.node("puddle");

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
	private readonly crown: THREE.Object3D;
	private readonly figure: THREE.Object3D;
	private readonly legs: { hip: THREE.Object3D; knee: THREE.Object3D }[] = [];
	private readonly arms: THREE.Object3D[] = [];
	private readonly light: GlowSpec;

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/boursoufle");

		this.pores = rig.material<THREE.MeshBasicMaterial>("pores");
		this.figure = rig.node("figure");
		this.sac = rig.mesh("sac");

		rig.ownGeometry(this.sac);

		this.base = basePositions(this.sac);
		this.crown = rig.node("crown");

		for (let index = 0; index < 2; index += 1) {
			this.legs.push({
				hip: rig.node(`leg_${index}`),
				knee: rig.node(`knee_${index}`),
			});

			this.arms.push(rig.node(`arm_${index}`));
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
	private readonly body: THREE.Object3D;
	private readonly bell: THREE.Object3D;
	private readonly heart: THREE.MeshBasicMaterial;
	private readonly veils: THREE.Object3D[];

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/luciole");

		this.heart = rig.material<THREE.MeshBasicMaterial>("heart");
		this.body = rig.node("body");
		this.bell = rig.node("bell");
		this.veils = rig.list("veil");

		this.glow = {
			color: 0xd8ff6a,
			intensity: 1.6,
			radius: 4,
			offset: new THREE.Vector3(0, 0, 0),
		};

		this.emitters.push({
			anchor: rig.node("core"),
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
	private readonly head: THREE.Object3D;
	private readonly flesh: THREE.MeshStandardMaterial;
	private readonly spout: THREE.Object3D;
	private readonly wings: THREE.Object3D[];
	private readonly light: GlowSpec;

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/hurleur");

		this.flesh = rig.material<THREE.MeshStandardMaterial>("flesh");
		this.head = rig.node("head");
		this.spout = rig.node("spout");
		this.wings = rig.list("wing");

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
	private readonly books: THREE.Object3D[];
	private readonly pages: THREE.Object3D[];
	private readonly figure: THREE.Object3D;
	private readonly tome: THREE.Object3D;
	private readonly leaves: THREE.MeshBasicMaterial;
	private readonly sight: THREE.MeshBasicMaterial;
	private readonly light: GlowSpec;

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/archiviste");

		this.leaves = rig.material<THREE.MeshBasicMaterial>("leaves");
		this.sight = rig.material<THREE.MeshBasicMaterial>("sight");
		this.figure = rig.node("figure");
		this.tome = rig.node("tome");
		this.books = rig.list("book");
		this.pages = rig.list("page");

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
	private readonly core: THREE.Object3D;
	private readonly upperTeeth: THREE.Object3D;
	private readonly eyes: THREE.Object3D;
	private readonly claws: THREE.Object3D[];
	private readonly maw: THREE.Object3D;
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

		const rig = this.load("anomalies/double");

		this.throat = rig.material<THREE.MeshBasicMaterial>("throat");
		this.hate = rig.material<THREE.MeshBasicMaterial>("hate");
		this.core = rig.node("core");
		this.upperTeeth = rig.node("upper_teeth");
		this.eyes = rig.node("eyes");
		this.maw = rig.node("maw");
		this.claws = rig.list("claw");

		this.mushroom.body.add(this.core, this.eyes, ...this.claws);
		this.mushroom.capPivot.add(this.upperTeeth);
		rig.root.removeFromParent();

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
			eye.visible = reveal <= 0.3;
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
