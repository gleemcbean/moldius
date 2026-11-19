import * as THREE from "three";
import { specialTexture } from "../../world/textures/textureFiles";
import type { ModelKit } from "../modelKit";
import {
	AnomalyModel,
	type AnomalyPoseInput,
	easeOut,
	type GlowSpec,
} from "./AnomalyModel";
import { COLLECTEUR_HIPS, REVERBERE_BEAMS, REVERBERE_HIP } from "./dimensions";
import { basePositions } from "./parts";

interface Leg {
	hip: THREE.Object3D;
	knee: THREE.Object3D;
	ankle: THREE.Object3D;
}

interface Arm {
	shoulder: THREE.Object3D;
	elbow: THREE.Object3D;
}

function saccade(time: number, rate: number, seed: number): number {
	const step = Math.floor(time * rate) + seed * 17;
	const noise = Math.sin(step * 12.9898) * 43758.5453;
	return (noise - Math.floor(noise)) * 2 - 1;
}

export class ReverbereModel extends AnomalyModel {
	private readonly pelvis: THREE.Object3D;
	private readonly torso: THREE.Object3D;
	private readonly neck: THREE.Object3D;
	private readonly lamp: THREE.Object3D;
	private readonly flame: THREE.MeshBasicMaterial;
	private readonly beams: THREE.MeshBasicMaterial[] = [];
	private readonly cones: THREE.Mesh[];
	private readonly beamEnd: THREE.Object3D;
	private readonly wick: THREE.Object3D;
	private readonly light: GlowSpec;
	private readonly rage = new THREE.Color();
	private readonly legs: Leg[] = [];
	private readonly arms: Arm[] = [];
	private fury = 0;

	constructor(kit: ModelKit) {
		super(kit);
		const rig = this.load("anomalies/veilleur");
		this.pelvis = rig.node("pelvis");
		this.torso = rig.node("torso");
		this.neck = rig.node("neck");
		this.lamp = rig.node("lamp");
		this.flame = rig.material<THREE.MeshBasicMaterial>("flame");
		this.cones = rig.meshes("beam");
		this.cones.forEach((cone, index) => {
			const material = this.own(
				new THREE.MeshBasicMaterial({
					color: 0xffffff,
					transparent: true,
					opacity: REVERBERE_BEAMS[index][2],
					alphaMap: specialTexture("beamFade"),
					blending: THREE.AdditiveBlending,
					depthWrite: false,
					side: THREE.DoubleSide,
				}),
			);
			cone.material = material;
			this.beams.push(material);
		});
		this.beamEnd = rig.node("beam_end");
		this.wick = rig.node("wick");
		for (let index = 0; index < 2; index += 1) {
			this.legs.push({
				hip: rig.node(`hip_${index}`),
				knee: rig.node(`knee_${index}`),
				ankle: rig.node(`ankle_${index}`),
			});
			this.arms.push({
				shoulder: rig.node(`shoulder_${index}`),
				elbow: rig.node(`elbow_${index}`),
			});
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
	private readonly hips: THREE.Object3D;
	private readonly torso: THREE.Object3D;
	private readonly neck: THREE.Object3D;
	private readonly head: THREE.Object3D;
	private readonly sack: THREE.Object3D;
	private readonly gaze: THREE.Object3D;
	private readonly embers: THREE.MeshBasicMaterial;
	private readonly light: GlowSpec;
	private readonly legs: (Leg & { foot: THREE.Object3D })[] = [];
	private readonly arms: Arm[] = [];

	constructor(kit: ModelKit) {
		super(kit);
		const rig = this.load("anomalies/collecteur");
		this.embers = rig.material<THREE.MeshBasicMaterial>("embers");
		this.hips = rig.node("hips");
		this.torso = rig.node("torso");
		this.neck = rig.node("neck");
		this.head = rig.node("head");
		this.sack = rig.node("sack");
		this.gaze = rig.node("gaze");
		for (let index = 0; index < 2; index += 1) {
			this.legs.push({
				hip: rig.node(`hip_${index}`),
				knee: rig.node(`knee_${index}`),
				ankle: rig.node(`ankle_${index}`),
				foot: rig.node(`foot_${index}`),
			});
			this.arms.push({
				shoulder: rig.node(`shoulder_${index}`),
				elbow: rig.node(`elbow_${index}`),
			});
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
			COLLECTEUR_HIPS +
			Math.abs(Math.sin(phase)) * 0.04 * moving -
			windup * 0.08;
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
	private readonly body: THREE.Object3D;
	private readonly cloak: THREE.Mesh;
	private readonly basePositions: Float32Array;
	private readonly head: THREE.Object3D;
	private readonly face: THREE.Object3D;
	private readonly dust: THREE.Object3D;
	private readonly light: GlowSpec;
	private readonly arms: Arm[] = [];

	constructor(kit: ModelKit) {
		super(kit);
		const rig = this.load("anomalies/murmure");
		this.body = rig.node("body");
		this.cloak = rig.mesh("cloak");
		rig.ownGeometry(this.cloak);
		this.basePositions = basePositions(this.cloak);
		this.dust = rig.node("dust");
		this.head = rig.node("head");
		this.face = rig.node("face");
		for (let index = 0; index < 2; index += 1) {
			this.arms.push({
				shoulder: rig.node(`shoulder_${index}`),
				elbow: rig.node(`elbow_${index}`),
			});
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
