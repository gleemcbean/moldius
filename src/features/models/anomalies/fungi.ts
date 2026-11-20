import * as THREE from "three";
import type { ModelKit } from "../modelKit";
import {
	AnomalyModel,
	type AnomalyPoseInput,
	type EmitterSpec,
	easeOut,
	type GlowSpec,
} from "./AnomalyModel";
import { ANT_HIP_HEIGHT, ANT_LEGS } from "./dimensions";

interface AntLegRig {
	hip: THREE.Object3D;
	knee: THREE.Object3D;
	side: number;
	tripod: number;
}

interface Feeler {
	antenna: THREE.Object3D;
	flagellum: THREE.Object3D;
	side: number;
}

const STRIDE = 3.6;
const SWING = 0.34;
const LIFT = 0.42;

function twitch(time: number, offset: number): number {
	return Math.max(0, Math.sin(time * 1.3 + offset)) ** 14;
}

export class CordycepsModel extends AnomalyModel {
	private readonly body: THREE.Object3D;
	private readonly gaster: THREE.Object3D;
	private readonly neck: THREE.Object3D;
	private readonly head: THREE.Object3D;
	private readonly stalk: THREE.Object3D;
	private readonly club: THREE.Object3D;
	private readonly mandibles: THREE.Object3D[];
	private readonly feelers: Feeler[] = [];
	private readonly legs: AntLegRig[] = [];
	private readonly tips: THREE.MeshStandardMaterial;
	private readonly light: GlowSpec;
	private readonly spores: EmitterSpec;

	constructor(kit: ModelKit) {
		super(kit);

		const rig = this.load("anomalies/cordyceps");

		this.body = rig.node("body");
		this.gaster = rig.node("gaster");
		this.neck = rig.node("neck");
		this.head = rig.node("head");
		this.stalk = rig.node("stalk");
		this.club = rig.node("club");
		this.mandibles = rig.list("mandible");
		this.tips = rig.material<THREE.MeshStandardMaterial>("tips");

		for (const index of [0, 1]) {
			this.feelers.push({
				antenna: rig.node(`antenna_${index}`),
				flagellum: rig.node(`flagellum_${index}`),
				side: index === 0 ? 1 : -1,
			});
		}

		ANT_LEGS.forEach((leg, index) => {
			const hip = rig.node(`hip_${index}`);

			this.legs.push({
				hip,
				knee: rig.node(`knee_${index}`),
				side: leg.side,
				tripod: (leg.pair + (leg.side > 0 ? 0 : 1)) % 2,
			});
		});

		this.light = {
			color: 0xff8a2a,
			intensity: 0.2,
			radius: 3.2,
			offset: new THREE.Vector3(0, 1.75, 0.5),
		};

		this.glow = this.light;

		this.spores = {
			anchor: this.club,
			rate: 0.4,
			color: 0xffb060,
			speed: 0.25,
			up: 0.35,
			life: 2.2,
			size: 0.022,
			gravity: -0.04,
			spread: 0.6,
		};

		this.emitters.push(this.spores);
	}

	update(input: AnomalyPoseInput): void {
		const moving = Math.min(1, input.speed / 2.5);
		const phase = this.advanceWalk(input, STRIDE);
		const windup = easeOut(this.windup(input, 650));
		const strike = this.strike(input);
		const ripe = Math.min(1, Math.max(0, input.extra));
		const time = input.time;

		const hunting =
			input.state === "chase" ||
			input.state === "investigate" ||
			input.state === "windup";

		for (const leg of this.legs) {
			const legPhase = phase + leg.tripod * Math.PI;
			const swing = Math.sin(legPhase) * SWING * moving;
			const lift = Math.max(0, Math.cos(legPhase)) * LIFT * moving;
			const rear = windup * (leg.tripod === 0 ? 0.08 : -0.05);

			leg.hip.rotation.y = -leg.side * swing;
			leg.hip.rotation.z = lift + rear - strike * 0.12;
			leg.knee.rotation.z = -lift * 0.6 + windup * 0.1;
		}

		const bob = Math.abs(Math.sin(phase * 2)) * 0.025 * moving;

		this.body.position.y = ANT_HIP_HEIGHT + bob + windup * 0.12 - strike * 0.05;
		this.body.position.z = strike * 0.16 - windup * 0.06;
		this.body.rotation.x = -windup * 0.42 + strike * 0.3;
		this.body.rotation.z = Math.sin(phase) * 0.035 * moving;

		this.gaster.rotation.x = 0.22 + Math.sin(time * 1.6) * 0.03 + windup * 0.25;

		this.gaster.scale.setScalar(1 + Math.sin(time * 1.6) * 0.025);

		const jerk = twitch(time, 0.7) * 0.45 - twitch(time, 2.9) * 0.3;

		this.neck.rotation.x = -windup * 0.25 + strike * 0.35;
		this.neck.rotation.y = hunting ? 0 : Math.sin(time * 0.6) * 0.3;
		this.head.rotation.z = jerk + Math.sin(time * 1.9) * (hunting ? 0.04 : 0.1);

		for (const feeler of this.feelers) {
			const sweep = hunting
				? Math.sin(time * 15 + feeler.side) * 0.08
				: Math.sin(time * 2.4 + feeler.side * 1.7) * 0.3;

			feeler.antenna.rotation.x = (hunting ? 0.25 : 0) + sweep;

			feeler.antenna.rotation.z =
				feeler.side * (0.1 + Math.sin(time * 1.1) * 0.12);

			feeler.flagellum.rotation.x = hunting ? 0.45 : 0.15 + sweep * 0.6;
		}

		const bite = Math.max(windup * 0.7, strike > 0 ? -0.15 : 0);
		const chew = hunting ? 0 : Math.sin(time * 2.2) * 0.08;

		this.mandibles.forEach((mandible, index) => {
			const side = index === 0 ? 1 : -1;

			mandible.rotation.y = side * (0.1 + bite + chew);
		});

		this.stalk.rotation.z = Math.sin(time * 1.7) * 0.07 + jerk * 0.3;
		this.stalk.rotation.x = Math.sin(time * 1.2) * 0.05 - windup * 0.2;

		const pulse = 0.6 + Math.sin(time * (ripe >= 1 ? 6 : 2)) * 0.4;
		const swell = 0.75 + ripe * 0.4 + (ripe >= 1 ? pulse * 0.06 : 0);

		this.club.scale.setScalar(swell);

		this.tips.emissiveIntensity = 0.25 + ripe * (0.9 + pulse * 0.9);
		this.light.intensity = 0.08 + ripe * (0.35 + pulse * 0.35);
		this.spores.rate = ripe >= 1 ? 7 : ripe * 1.2;
	}
}
