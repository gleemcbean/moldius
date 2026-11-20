import * as THREE from "three";
import type { ModelKit } from "../modelKit";
import {
	AnomalyModel,
	type AnomalyPoseInput,
	type EmitterSpec,
	easeOut,
	type GlowSpec,
} from "./AnomalyModel";
import { CINEMA_BODY_HEIGHT } from "./dimensions";

const LENS_COLOR = new THREE.Color(0xfff0c8);
const EYE_COLOR = new THREE.Color(0xff5a2a);
const LAMP_COLOR = new THREE.Color(0xffa050);
const BULB_COLOR = new THREE.Color(0xffd890);
const DARK = new THREE.Color(0x0c0a08);

interface Mood {
	reelSpeed: number;
	crankSpeed: number;
	lens: number;
	lamp: number;
	bulbs: number;
	slump: number;
}

export class CinematographeModel extends AnomalyModel {
	private readonly body: THREE.Object3D;
	private readonly snout: THREE.Object3D;
	private readonly crank: THREE.Object3D;
	private readonly lensAnchor: THREE.Object3D;
	private readonly legs: THREE.Object3D[];
	private readonly shins: THREE.Object3D[];
	private readonly reels: THREE.Object3D[];
	private readonly sights: THREE.Object3D[];
	private readonly lens: THREE.MeshBasicMaterial;
	private readonly eye: THREE.MeshBasicMaterial;
	private readonly lamp: THREE.MeshBasicMaterial;
	private readonly bulbs: THREE.MeshBasicMaterial;
	private readonly light: GlowSpec;
	private readonly smoke: EmitterSpec;
	private readonly sparks: EmitterSpec;
	private readonly snoutZ: number;
	private reelAngle = 0;
	private crankAngle = 0;
	private shownLens = 0.3;

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/cinematographe");

		this.body = rig.node("body");
		this.snout = rig.node("snout");
		this.snoutZ = this.snout.position.z;
		this.crank = rig.node("crank");
		this.lensAnchor = rig.node("lens");
		this.legs = rig.list("leg");
		this.shins = rig.list("shin");
		this.reels = rig.list("reel");
		this.sights = rig.list("sight");
		this.lens = rig.material<THREE.MeshBasicMaterial>("lens");
		this.eye = rig.material<THREE.MeshBasicMaterial>("eye");
		this.lamp = rig.material<THREE.MeshBasicMaterial>("lamp");
		this.bulbs = rig.material<THREE.MeshBasicMaterial>("bulbs");

		this.light = {
			color: 0xffe2b0,
			intensity: 0.2,
			radius: 4,
			offset: new THREE.Vector3(0, CINEMA_BODY_HEIGHT + 0.05, 1),
		};

		this.glow = this.light;

		this.smoke = {
			anchor: rig.node("chimney"),
			rate: 0.6,
			color: 0x6a625a,
			speed: 0.3,
			up: 0.6,
			life: 2.4,
			size: 0.04,
			gravity: -0.15,
			spread: 0.25,
		};

		this.sparks = {
			anchor: this.lensAnchor,
			rate: 0,
			color: 0xffc070,
			speed: 1.1,
			up: 0.4,
			life: 0.5,
			size: 0.015,
			gravity: 2,
			spread: 0.5,
		};

		this.emitters.push(this.smoke, this.sparks);
	}

	lensPosition(target: THREE.Vector3): THREE.Vector3 {
		return this.lensAnchor.getWorldPosition(target);
	}

	private mood(input: AnomalyPoseInput): Mood {
		const charge = input.state === "windup" ? easeOut(input.extra) : 0;
		const flicker = 0.85 + (Math.sin(input.time * 113) > 0 ? 0.35 : 0);

		switch (input.state) {
			case "windup":
				return {
					reelSpeed: 3 + charge * 9,
					crankSpeed: 4 + charge * 6,
					lens: 0.4 + charge * 1.1,
					lamp: 0.7 + charge * 0.5,
					bulbs: 0.6 + charge * 0.6,
					slump: 0,
				};

			case "special":
				return {
					reelSpeed: 9,
					crankSpeed: 7,
					lens: 1.25 * flicker,
					lamp: 1.2,
					bulbs: 1.1,
					slump: 0,
				};

			case "recover":
				return {
					reelSpeed: -14,
					crankSpeed: -9,
					lens: 0.25,
					lamp: 0.6,
					bulbs: 0.3,
					slump: 0,
				};

			case "stalled":
				return {
					reelSpeed: 0,
					crankSpeed: 0,
					lens: 0.03,
					lamp: 0.05,
					bulbs: 0,
					slump: 1,
				};

			default:
				return {
					reelSpeed: input.state === "chase" ? 2.2 : 0.6,
					crankSpeed: input.state === "chase" ? 2 : 0,
					lens: 0.3 + Math.sin(input.time * 1.4) * 0.08,
					lamp: 0.55,
					bulbs: 0.35,
					slump: 0,
				};
		}
	}

	update(input: AnomalyPoseInput): void {
		const mood = this.mood(input);
		const moving = Math.min(1, input.speed / 1.1);
		const phase = this.advanceWalk(input, 2.6);
		const time = input.time;
		const charge = input.state === "windup" ? easeOut(input.extra) : 0;
		const rolling = input.state === "special" ? 1 : 0;

		this.reelAngle += mood.reelSpeed * input.dt;
		this.crankAngle += mood.crankSpeed * input.dt;

		this.reels.forEach((reel, index) => {
			reel.rotation.x = this.reelAngle * (index === 0 ? 1 : 1.35);
		});

		this.crank.rotation.x = this.crankAngle;

		this.legs.forEach((leg, index) => {
			const step = Math.max(0, Math.sin(phase + (index * Math.PI * 2) / 3));

			leg.rotation.z = step * 0.32 * moving - mood.slump * 0.16;
			this.shins[index].rotation.z = -step * 0.38 * moving + mood.slump * 0.2;
		});

		const shiver = rolling * Math.sin(time * 47) * 0.004;
		const bob = Math.abs(Math.sin(phase * 1.5)) * 0.03 * moving;

		this.body.position.y =
			CINEMA_BODY_HEIGHT + bob + shiver - mood.slump * 0.2 + charge * 0.03;

		this.body.rotation.x = charge * 0.08 + rolling * 0.06 + mood.slump * 0.32;
		this.body.rotation.z = Math.sin(phase) * 0.05 * moving + mood.slump * 0.12;

		this.snout.position.z = this.snoutZ + charge * 0.07 + rolling * 0.07;
		this.snout.rotation.x = mood.slump * 0.4;

		this.sights.forEach((sight, index) => {
			sight.rotation.y =
				Math.sin(time * 0.9 + index * 2) * 0.25 * (1 - mood.slump);
		});

		this.shownLens += (mood.lens - this.shownLens) * Math.min(1, input.dt * 6);

		this.lens.color.copy(DARK).lerp(LENS_COLOR, Math.min(1, this.shownLens));

		const stare = THREE.MathUtils.clamp(
			0.3 + charge + rolling - mood.slump,
			0,
			1,
		);

		this.eye.color.copy(DARK).lerp(EYE_COLOR, stare);
		this.lamp.color.copy(DARK).lerp(LAMP_COLOR, Math.min(1, mood.lamp));

		const chase = Math.floor(time * (rolling ? 12 : 3)) % 2 === 0 ? 1 : 0.55;

		this.bulbs.color
			.copy(DARK)
			.lerp(BULB_COLOR, Math.min(1, mood.bulbs * chase));

		this.light.intensity = this.shownLens * 1.4;
		this.smoke.rate = mood.slump > 0 ? 7 : 0.6 + rolling * 2;
		this.sparks.rate = mood.slump > 0 && Math.sin(time * 3.1) > 0.92 ? 30 : 0;
	}
}
