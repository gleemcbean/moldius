import type { OccultId } from "@shared/config/occult";
import type { EmoteId } from "@shared/config/party";
import {
	DEFAULT_HAT_PATTERN,
	type HatPattern,
	isHatPattern,
} from "@shared/hatPatterns";
import { angleDifference } from "@shared/math";
import { DEFAULT_PLAYER_COLOR, isPlayerColor } from "@shared/playerColors";
import * as THREE from "three";
import { capTextureKey } from "../world/textures/textureKeys";
import { CAMERA_BODY, createCameraModel } from "./cameraModel";
import { LanternModel } from "./LanternModel";
import {
	GRIP_HAND,
	MittenHand,
	RELAXED_HAND,
	SUPPORT_HAND,
} from "./MittenHand";
import type { ModelKit } from "./modelKit";
import { createOccultModel } from "./occultModels";
import { createWalkieModel } from "./walkieModel";

export interface MushroomPose {
	speed: number;
	crouch: number;
	grounded: boolean;
	sprinting: boolean;
	lanternOpen: boolean;
	grimoireOpen: boolean;
	dead: boolean;
	talking: number;
	camera?: 0 | 1 | 2;
	walkie?: boolean;
	heldObject?: OccultId | null;
	emote?: EmoteId | null;
	emoteTime?: number;
}

export const GHOST_MATERIAL = new THREE.MeshBasicMaterial({
	color: 0xa9dcff,
	transparent: true,
	opacity: 0.3,
	depthWrite: false,
	blending: THREE.AdditiveBlending,
});

const WALKIE_SCALE = 1.25;
const WALKIE_WORN = new THREE.Vector3(-0.17, 0.08, 0.3);
const HELD_OBJECT_SIZE = 0.2;

const CAMERA_SCALE = 1.5;
const CAMERA_WORN = new THREE.Vector3(0.3, -0.02, 0.2);
const CAMERA_AIMED = new THREE.Vector3(0.02, 0.26, 0.42);

interface Leg {
	hip: THREE.Object3D;
	knee: THREE.Object3D;
	ankle: THREE.Object3D;
}

interface Arm {
	shoulder: THREE.Object3D;
	elbow: THREE.Object3D;
	hand: MittenHand;
}

export const MUSHROOM_HIP_HEIGHT = 0.36;
export const MUSHROOM_CAP_REST = 0.72;

export const THIGH_LENGTH = 0.15;
export const SHIN_LENGTH = 0.13;

export function capTextureFor(
	color: number,
	pattern: HatPattern = DEFAULT_HAT_PATTERN,
): string {
	return capTextureKey(
		isPlayerColor(color) ? color : DEFAULT_PLAYER_COLOR,
		isHatPattern(pattern) ? pattern : DEFAULT_HAT_PATTERN,
	);
}

export class MushroomModel {
	readonly root: THREE.Object3D;
	readonly body: THREE.Object3D;
	private readonly figure: THREE.Object3D;
	readonly lantern: LanternModel;
	readonly capPivot: THREE.Object3D;
	readonly eyes: THREE.Object3D[];
	private readonly hips: THREE.Object3D;
	private readonly legs: Leg[] = [];
	private readonly arms: Arm[] = [];
	private readonly book: THREE.Object3D;
	private readonly stowedBook: THREE.Object3D;
	private phase = Math.random() * Math.PI * 2;
	private deathBlend = 0;
	private crouchBlend = 0;
	private airBlend = 0;
	private readBlend = 0;
	private aimBlend = 0;
	private readonly camera: THREE.Object3D;
	private readonly walkie: THREE.Group;
	private readonly heldHolder: THREE.Object3D;
	private readonly heldModels = new Map<OccultId, THREE.Group>();
	private heldShown: OccultId | null = null;
	private time = Math.random() * 10;
	private lastYaw: number | null = null;
	private turnRate = 0;
	private swing = 0;
	private swingVelocity = 0;
	private emoteBlend = 0;
	private lastEmote: EmoteId | null = null;
	private ghostly = false;
	private readonly originalMaterials = new Map<
		THREE.Mesh,
		THREE.Material | THREE.Material[]
	>();

	constructor(
		kit: ModelKit,
		color: number,
		pattern: HatPattern = DEFAULT_HAT_PATTERN,
		lanternTint: number | null = null,
	) {
		const rig = kit.rig("player/mushroom");
		this.root = rig.root;
		this.figure = rig.node("figure");
		this.hips = rig.node("hips");
		this.body = rig.node("body");
		this.capPivot = rig.node("cap");
		rig.mesh("cap_shell").material = kit.material({
			texture: capTextureFor(color, pattern),
			roughness: 0.6,
			fixedRepeat: true,
		});
		this.eyes = rig.list("eye");
		for (let index = 0; index < 2; index += 1) {
			this.legs.push({
				hip: rig.node(`hip_${index}`),
				knee: rig.node(`knee_${index}`),
				ankle: rig.node(`ankle_${index}`),
			});
			this.arms.push({
				shoulder: rig.node(`shoulder_${index}`),
				elbow: rig.node(`elbow_${index}`),
				hand: MittenHand.from(rig, `hand_${index}`, index === 0 ? 1 : -1),
			});
		}
		this.lantern = new LanternModel(kit, 0.8, lanternTint);
		this.arms[0].hand.root.add(this.lantern.root);
		this.book = rig.node("book");
		this.stowedBook = rig.node("stowed_book");
		this.camera = createCameraModel(kit).root;
		this.camera.scale.setScalar(CAMERA_SCALE);
		this.camera.visible = false;
		this.body.add(this.camera);
		this.walkie = createWalkieModel(kit);
		this.walkie.scale.setScalar(WALKIE_SCALE);
		this.walkie.position.copy(WALKIE_WORN);
		this.walkie.rotation.set(-0.25, 0.35, 0.12);
		this.walkie.visible = false;
		this.body.add(this.walkie);
		this.heldHolder = rig.node("held");
		this.kit = kit;
	}

	private readonly kit: ModelKit;

	private heldModel(id: OccultId): THREE.Group {
		let model = this.heldModels.get(id);
		if (!model) {
			const inner = createOccultModel(this.kit, id);
			const box = new THREE.Box3().setFromObject(inner);
			const size = box.getSize(new THREE.Vector3());
			const center = box.getCenter(new THREE.Vector3());
			const scale = HELD_OBJECT_SIZE / Math.max(size.x, size.y, size.z);
			inner.scale.setScalar(scale);
			inner.position.set(
				-center.x * scale,
				-center.y * scale,
				-center.z * scale,
			);
			model = new THREE.Group();
			model.add(inner);
			this.heldModels.set(id, model);
			this.heldHolder.add(model);
		}
		return model;
	}

	private updateHeldItems(pose: MushroomPose): void {
		this.walkie.visible = pose.walkie === true && !pose.dead;
		const busy =
			this.readBlend > 0.3 || this.aimBlend > 0.3 || pose.dead === true;
		const wanted = busy ? null : (pose.heldObject ?? null);
		if (wanted !== this.heldShown) {
			for (const model of this.heldModels.values()) {
				model.visible = false;
			}
			if (wanted) {
				this.heldModel(wanted).visible = true;
			}
			this.heldShown = wanted;
		}
		if (wanted) {
			const hand = this.arms[1].hand.root;
			const handQuaternion = hand.getWorldQuaternion(new THREE.Quaternion());
			const upright = this.figure.getWorldQuaternion(new THREE.Quaternion());
			this.heldHolder.quaternion.copy(
				handQuaternion.invert().multiply(upright),
			);
		}
	}

	update(dt: number, pose: MushroomPose): void {
		this.time += dt;
		const speedFactor = Math.min(1, pose.speed / 3.2);
		this.phase += dt * (2.6 + pose.speed * 2.7);
		const ease = (current: number, target: number, rate: number) =>
			current + (target - current) * Math.min(1, dt * rate);
		this.crouchBlend = ease(this.crouchBlend, pose.crouch, 12);
		this.airBlend = ease(this.airBlend, pose.grounded || pose.dead ? 0 : 1, 10);
		this.readBlend = ease(
			this.readBlend,
			pose.grimoireOpen && !pose.dead ? 1 : 0,
			8,
		);
		this.deathBlend = ease(this.deathBlend, pose.dead ? 1 : 0, 3);
		this.aimBlend = ease(
			this.aimBlend,
			pose.camera === 2 && !pose.dead && !pose.grimoireOpen ? 1 : 0,
			9,
		);

		const emote = pose.dead ? null : (pose.emote ?? null);
		if (emote) {
			this.lastEmote = emote;
		}
		this.emoteBlend = ease(this.emoteBlend, emote ? 1 : 0, 7);

		this.updateLegs(speedFactor);
		this.updateBody(speedFactor, pose);
		this.updateArms(speedFactor, pose);
		this.applyEmote(pose.emoteTime ?? 0);

		this.lantern.update(dt, pose.lanternOpen && !pose.dead);
		this.updateSwing(dt);
		this.keepLanternUpright();
		this.updateHeldItems(pose);
		this.figure.rotation.x = -this.deathBlend * Math.PI * 0.47;
		this.figure.position.y = this.deathBlend * 0.18;
	}

	private updateLegs(speedFactor: number): void {
		const crouch = this.crouchBlend;
		const swing = Math.sin(this.phase) * 0.7 * speedFactor;
		for (const [index, leg] of this.legs.entries()) {
			const phase = this.phase + index * Math.PI;
			const legSwing = index === 0 ? swing : -swing;
			const lift =
				Math.max(0, Math.sin(phase - Math.PI / 2)) * 1.1 * speedFactor;
			const tuck = index === 0 ? 0.8 : 0.35;
			const thigh = -legSwing - crouch * 1.1 - this.airBlend * tuck;
			const knee = lift + crouch * 1.8 + this.airBlend * tuck * 1.5;
			leg.hip.rotation.set(thigh, 0, (index === 0 ? -1 : 1) * 0.05);
			leg.knee.rotation.x = knee;
			leg.ankle.rotation.x = -(thigh + knee) * 0.85;
		}
	}

	private updateBody(speedFactor: number, pose: MushroomPose): void {
		const reach = (item: Leg) =>
			Math.cos(item.hip.rotation.x) * THIGH_LENGTH +
			Math.cos(item.hip.rotation.x + item.knee.rotation.x) * SHIN_LENGTH;
		const legHeight = Math.max(reach(this.legs[0]), reach(this.legs[1]));
		const restLeg = THIGH_LENGTH + SHIN_LENGTH;
		const bounce = Math.abs(Math.cos(this.phase)) * 0.035 * speedFactor;
		this.hips.position.y =
			MUSHROOM_HIP_HEIGHT -
			Math.max(0, restLeg - legHeight) * (1 - this.airBlend) +
			bounce;
		this.hips.position.z = this.crouchBlend * -0.04;
		this.body.rotation.x =
			this.crouchBlend * 0.28 + (pose.sprinting ? 0.14 : 0.04) * speedFactor;
		this.body.rotation.z = Math.sin(this.phase) * 0.05 * speedFactor;
		const squash = 1 - Math.abs(Math.cos(this.phase)) * 0.03 * speedFactor;
		this.body.scale.set(2 - squash, squash, 2 - squash);
		this.capPivot.rotation.z = Math.sin(this.phase + 0.6) * 0.05 * speedFactor;
		this.capPivot.rotation.x =
			-Math.abs(Math.sin(this.phase)) * 0.035 * speedFactor;
	}

	private updateArms(speedFactor: number, pose: MushroomPose): void {
		const swing = Math.sin(this.phase) * 0.6 * speedFactor;
		const read = this.readBlend;
		const aim = this.aimBlend;
		const lift = Math.max(read, aim);
		const lanternArm = this.arms[0];
		const bookArm = this.arms[1];
		const lanternRaise = pose.lanternOpen ? 0.3 : 0;
		lanternArm.shoulder.rotation.set(
			-0.3 - lanternRaise + swing * 0.3 - read * 0.95,
			0,
			-0.32 + read * 0.15,
		);
		lanternArm.elbow.rotation.set(-0.8 - read * 0.5, 0, 0);
		lanternArm.hand.setPose(GRIP_HAND);
		bookArm.shoulder.rotation.set(
			-swing * 0.9 * (1 - lift) - lift * 1.0 - aim * 0.25,
			0,
			0.32 - lift * 0.12 - aim * 0.1,
		);
		bookArm.elbow.rotation.set(
			-0.25 - speedFactor * 0.3 * (1 - lift) - lift * 0.8,
			0,
			0,
		);
		bookArm.hand.setPose(lift > 0.5 ? SUPPORT_HAND : RELAXED_HAND);
		this.camera.visible = (pose.camera ?? 0) > 0 && read < 0.5;
		if (this.camera.visible) {
			this.camera.position.lerpVectors(CAMERA_WORN, CAMERA_AIMED, aim);
			this.camera.position.y -= (CAMERA_SCALE * CAMERA_BODY.height) / 2;
			this.camera.rotation.set(
				(1 - aim) * 0.25,
				Math.PI + (1 - aim) * 0.9,
				(1 - aim) * 0.15,
			);
		}
		this.book.visible = read > 0.2;
		this.stowedBook.visible = !this.book.visible;
		this.book.scale.setScalar(Math.max(0.01, read));
	}

	private applyEmote(time: number): void {
		const blend = this.emoteBlend;
		this.figure.rotation.y = 0;
		if (blend < 0.01 || !this.lastEmote) {
			return;
		}
		const mix = (current: number, target: number) =>
			current + (target - current) * blend;
		const [left, right] = this.arms;
		switch (this.lastEmote) {
			case "wave": {
				const wave = Math.sin(time * 9);
				right.shoulder.rotation.set(
					mix(right.shoulder.rotation.x, -2.7),
					0,
					mix(right.shoulder.rotation.z, 0.35 + wave * 0.35),
				);
				right.elbow.rotation.x = mix(
					right.elbow.rotation.x,
					-0.45 + wave * 0.25,
				);
				break;
			}
			case "dance": {
				const beat = Math.sin(time * 6.5);
				this.hips.position.y += Math.abs(beat) * 0.06 * blend;
				this.body.rotation.z = mix(this.body.rotation.z, beat * 0.2);
				this.figure.rotation.y = Math.sin(time * 3.2) * 0.6 * blend;
				this.capPivot.rotation.z = mix(this.capPivot.rotation.z, -beat * 0.12);
				for (const [index, arm] of this.arms.entries()) {
					const swing = Math.sin(time * 6.5 + index * Math.PI);
					arm.shoulder.rotation.x = mix(
						arm.shoulder.rotation.x,
						-2.1 + swing * 0.5,
					);
					arm.shoulder.rotation.z = mix(
						arm.shoulder.rotation.z,
						(index === 0 ? -1 : 1) * (0.5 + swing * 0.2),
					);
					arm.elbow.rotation.x = mix(arm.elbow.rotation.x, -0.9);
				}
				break;
			}
			case "bow": {
				const depth = Math.min(1, time * 2.2) * Math.min(1, (2.2 - time) * 2.5);
				this.body.rotation.x = mix(
					this.body.rotation.x,
					0.85 * Math.max(0, depth),
				);
				this.capPivot.rotation.x = mix(this.capPivot.rotation.x, 0.2 * depth);
				right.shoulder.rotation.x = mix(right.shoulder.rotation.x, -0.9);
				right.shoulder.rotation.z = mix(right.shoulder.rotation.z, -0.2);
				right.elbow.rotation.x = mix(right.elbow.rotation.x, -1.4);
				break;
			}
			case "point": {
				right.shoulder.rotation.set(
					mix(right.shoulder.rotation.x, -1.55),
					0,
					mix(right.shoulder.rotation.z, 0.05),
				);
				right.elbow.rotation.x = mix(right.elbow.rotation.x, -0.05);
				right.hand.setPose(GRIP_HAND);
				break;
			}
			case "laugh": {
				const shake = Math.sin(time * 20);
				this.body.rotation.x = mix(this.body.rotation.x, -0.22 + shake * 0.05);
				this.capPivot.rotation.x = mix(
					this.capPivot.rotation.x,
					-0.1 + shake * 0.06,
				);
				this.hips.position.y += Math.abs(shake) * 0.02 * blend;
				for (const arm of this.arms) {
					arm.shoulder.rotation.x = mix(arm.shoulder.rotation.x, -0.5);
					arm.elbow.rotation.x = mix(arm.elbow.rotation.x, -1.5);
				}
				break;
			}
			case "panic": {
				const shiver = Math.sin(time * 34);
				this.body.rotation.z = mix(this.body.rotation.z, shiver * 0.07);
				this.capPivot.rotation.z = mix(
					this.capPivot.rotation.z,
					-shiver * 0.08,
				);
				for (const [index, arm] of [left, right].entries()) {
					arm.shoulder.rotation.x = mix(
						arm.shoulder.rotation.x,
						-2.9 + shiver * 0.12,
					);
					arm.shoulder.rotation.z = mix(
						arm.shoulder.rotation.z,
						(index === 0 ? -1 : 1) * 0.25,
					);
					arm.elbow.rotation.x = mix(arm.elbow.rotation.x, -0.7);
				}
				break;
			}
		}
	}

	setGhost(ghostly: boolean): void {
		if (ghostly === this.ghostly) {
			return;
		}
		this.ghostly = ghostly;
		this.root.traverse((object) => {
			if (!(object instanceof THREE.Mesh)) {
				return;
			}
			if (ghostly) {
				if (!this.originalMaterials.has(object)) {
					this.originalMaterials.set(object, object.material);
				}
				object.material = GHOST_MATERIAL;
			} else {
				const original = this.originalMaterials.get(object);
				if (original) {
					object.material = original;
				}
			}
		});
	}

	private updateSwing(dt: number): void {
		if (dt <= 0) {
			return;
		}
		this.root.updateMatrixWorld(true);
		const yaw = new THREE.Euler().setFromQuaternion(
			this.figure.getWorldQuaternion(new THREE.Quaternion()),
			"YXZ",
		).y;
		const rate = THREE.MathUtils.clamp(
			angleDifference(this.lastYaw ?? yaw, yaw) / dt,
			-12,
			12,
		);
		this.lastYaw = yaw;
		this.turnRate += (rate - this.turnRate) * Math.min(1, dt * 12);
		this.swingVelocity +=
			(-(this.swing + this.turnRate * 0.04) * 40 - this.swingVelocity * 3.2) *
			dt;
		this.swing = THREE.MathUtils.clamp(
			this.swing + this.swingVelocity * dt,
			-0.45,
			0.45,
		);
	}

	private keepLanternUpright(): void {
		const hand = this.arms[0].hand.root;
		this.root.updateMatrixWorld(true);
		const handQuaternion = hand.getWorldQuaternion(new THREE.Quaternion());
		const rootQuaternion = this.figure.getWorldQuaternion(
			new THREE.Quaternion(),
		);
		const sway = new THREE.Quaternion().setFromEuler(
			new THREE.Euler(
				Math.sin(this.phase * 0.5) * 0.08,
				0,
				Math.sin(this.time * 1.7) * 0.04 + this.swing,
			),
		);
		this.lantern.root.quaternion.copy(
			handQuaternion.invert().multiply(rootQuaternion).multiply(sway),
		);
		const handle = this.lantern.handle.position
			.clone()
			.multiplyScalar(this.lantern.root.scale.x)
			.applyQuaternion(this.lantern.root.quaternion);
		this.lantern.root.position.copy(MittenHand.gripCenter(1)).sub(handle);
	}

	get lanternLightPosition(): THREE.Vector3 {
		return this.lantern.lightAnchor.getWorldPosition(new THREE.Vector3());
	}

	dispose(): void {
		this.root.removeFromParent();
	}
}
