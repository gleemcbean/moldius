import * as THREE from "three";
import type { ModelKit } from "../modelKit";
import {
	AnomalyModel,
	type AnomalyPoseInput,
	easeOut,
	type GlowSpec,
} from "./AnomalyModel";
import { PHALENE_BODY } from "./dimensions";

interface Wing {
	pivot: THREE.Object3D;
	side: number;
	hind: boolean;
}

const BLOOD = new THREE.Color(0xff2438);

export class PhaleneModel extends AnomalyModel {
	private readonly body: THREE.Object3D;
	private readonly head: THREE.Object3D;
	private readonly abdomen: THREE.Object3D;
	private readonly proboscis: THREE.Object3D;
	private readonly coil: THREE.Object3D;
	private readonly stinger: THREE.Object3D;
	private readonly gaze: THREE.Object3D;
	private readonly antennae: THREE.Object3D[] = [];
	private readonly legs: THREE.Object3D[] = [];
	private readonly wings: Wing[] = [];
	private readonly ocelli: THREE.MeshBasicMaterial;
	private readonly facets: THREE.MeshStandardMaterial;
	private readonly light: GlowSpec;
	private readonly shimmer = new THREE.Color();
	private flap = Math.random() * Math.PI * 2;
	private fury = 0;
	private menace = 0;

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/phalene");

		this.body = rig.node("body");
		this.head = rig.node("head");
		this.abdomen = rig.node("abdomen");
		this.proboscis = rig.node("proboscis");
		this.coil = rig.node("coil");
		this.stinger = rig.node("stinger");
		this.gaze = rig.node("gaze");
		this.ocelli = rig.material<THREE.MeshBasicMaterial>("ocelli");
		this.facets = rig.material<THREE.MeshStandardMaterial>("facets");

		for (let index = 0; index < 2; index += 1) {
			this.antennae.push(rig.node(`antenna_${index}`));
		}

		for (let index = 0; index < 6; index += 1) {
			this.legs.push(rig.node(`leg_${index}`));
		}

		for (let index = 0; index < 4; index += 1) {
			this.wings.push({
				pivot: rig.node(`wing_${index}`),
				side: index % 2 === 0 ? 1 : -1,
				hind: index >= 2,
			});
		}

		this.light = {
			color: 0x9a7aff,
			intensity: 0.5,
			radius: 3.4,
			offset: new THREE.Vector3(0, PHALENE_BODY, 0.3),
		};

		this.glow = this.light;

		this.emitters.push(
			{
				anchor: rig.node("dust_0"),
				rate: 3,
				color: 0xc8b8ff,
				speed: 0.18,
				up: -0.35,
				life: 1.7,
				size: 0.022,
				gravity: 0.3,
				spread: 0.6,
			},
			{
				anchor: rig.node("dust_1"),
				rate: 3,
				color: 0x9ae8ff,
				speed: 0.18,
				up: -0.35,
				life: 1.7,
				size: 0.022,
				gravity: 0.3,
				spread: 0.6,
			},
		);
	}

	update(input: AnomalyPoseInput): void {
		const dt = Math.min(input.dt, 0.1);
		const time = input.time;
		const moving = Math.min(1, input.speed / 3);

		const hunting =
			input.state === "chase" ||
			input.state === "windup" ||
			input.state === "recover" ||
			input.state === "special";

		this.fury += ((hunting ? 1 : 0) - this.fury) * Math.min(1, dt * 3);

		this.menace +=
			((input.extra >= 0.5 ? 1 : 0) - this.menace) * Math.min(1, dt * 4);

		const windup = easeOut(this.windup(input, 900));
		const strike = this.strike(input, 420);
		const display = windup * (1 - this.menace);
		const dive = windup * this.menace;
		const burst = strike * (1 - this.menace);
		const lunge = strike * this.menace;
		const retreat = input.state === "special" ? 1 : 0;

		const glide =
			Math.max(0, Math.sin(time * 0.45 + this.flap * 0.01) - 0.55) *
			(1 - this.fury);

		const beats =
			2.2 +
			moving * 1.6 +
			this.fury * 1.4 +
			retreat * 2.4 -
			display * 1.6 +
			dive * 2.5 +
			burst * 4;

		this.flap += dt * beats * Math.PI * 2 * (1 - glide * 0.85);

		const beat = Math.sin(this.flap);

		const amplitude =
			(0.5 + moving * 0.12 + retreat * 0.1 + burst * 0.35) *
				(1 - glide * 0.8) *
				(1 - display * 0.75) -
			dive * 0.3;

		for (const wing of this.wings) {
			const lag = wing.hind ? 0.5 : 0;

			const lift =
				0.16 + Math.sin(this.flap - lag) * amplitude - display * 0.12;

			const sweep =
				(wing.hind ? 0.1 : 0.02) +
				dive * 0.7 +
				lunge * 0.5 -
				display * (wing.hind ? 0.05 : 0.22);

			wing.pivot.rotation.z = wing.side * lift;
			wing.pivot.rotation.y = wing.side * sweep;
			wing.pivot.rotation.x = 0;
		}

		const rear = display + burst * 0.6;

		this.body.position.y =
			PHALENE_BODY +
			Math.sin(time * 2.1) * 0.05 -
			beat * 0.025 * (1 - glide) +
			rear * 0.22 -
			dive * 0.12;

		this.body.position.z = dive * 0.12 + lunge * 0.32 - retreat * 0.05;

		this.body.rotation.x =
			0.04 +
			moving * 0.14 -
			rear * 1.12 +
			dive * 0.42 +
			lunge * 0.2 -
			retreat * 0.22;

		this.body.rotation.z = Math.sin(time * 1.1) * 0.07 * (1 - rear);

		this.abdomen.rotation.x =
			-0.1 + Math.sin(time * 1.7) * 0.07 - rear * 0.45 + dive * 0.18;

		this.head.rotation.x = -this.body.rotation.x * 0.75 + dive * 0.2;
		this.head.rotation.y = Math.sin(time * 0.8) * 0.12 * (1 - this.fury);

		this.antennae.forEach((antenna, index) => {
			const side = index === 0 ? 1 : -1;

			antenna.rotation.x =
				Math.sin(time * 3.1 + index) * 0.09 - this.fury * 0.3 - dive * 0.2;

			antenna.rotation.z =
				side * (Math.sin(time * 2.3 + index * 1.7) * 0.08 + display * 0.25);
		});

		this.legs.forEach((leg, index) => {
			leg.rotation.x =
				Math.sin(time * 2.4 + index * 0.9) * 0.1 + moving * 0.35 - dive * 0.45;
		});

		const extend = Math.max(dive, lunge);

		this.coil.scale.setScalar(1 - extend * 0.85);

		this.stinger.visible = extend > 0.02;
		this.stinger.scale.z = Math.max(0.05, extend);
		this.proboscis.rotation.x = 0.3 * extend;

		const hue =
			0.58 + Math.sin(time * 0.9) * 0.1 + Math.sin(time * 2.3 + 1.3) * 0.05;

		const pulse = display * (0.5 + 0.5 * Math.sin(time * 14));

		this.shimmer.setHSL(hue, 0.85, 0.55 + pulse * 0.2);
		this.shimmer.lerp(BLOOD, this.menace * 0.9);

		this.ocelli.color
			.copy(this.shimmer)
			.multiplyScalar(0.85 + display * 0.9 + burst * 0.8);

		this.facets.emissive.copy(this.shimmer).multiplyScalar(0.6);

		this.facets.emissiveIntensity = 0.2 + this.fury * 0.2 + windup * 0.3;

		this.follow(this.gaze, this.light.offset);

		this.light.color = this.shimmer.getHex();

		this.light.intensity =
			0.45 + this.fury * 0.3 + display * 1.6 + burst * 1.8 + dive * 0.6;

		for (const emitter of this.emitters) {
			emitter.color = this.shimmer.getHex();
			emitter.rate = 2.5 + moving * 3 + display * 24 + burst * 70;
		}
	}
}
