import type { OccultId } from "@shared/config/occult";
import {
	DEFAULT_HAT_PATTERN,
	type HatPattern,
	isHatPattern,
} from "@shared/hatPatterns";
import { angleDifference } from "@shared/math";
import { DEFAULT_PLAYER_COLOR, isPlayerColor } from "@shared/playerColors";
import * as THREE from "three";
import type { MaterialOptions } from "../world/MaterialLibrary";
import { capTextureKey } from "../world/textures/creatureTextures";
import { CAMERA_BODY, createCameraModel } from "./cameraModel";
import { Eyeball } from "./eyes";
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
	/** 0 sans appareil photo, 1 porté à la ceinture, 2 levé pour viser. */
	camera?: 0 | 1 | 2;
	/** Un talkie accroché à la poitrine. */
	walkie?: boolean;
	/** L'objet occulte tenu dans la main libre. */
	heldObject?: OccultId | null;
}

const WALKIE_SCALE = 1.25;
const WALKIE_WORN = new THREE.Vector3(-0.17, 0.08, 0.3);
const HELD_OBJECT_SIZE = 0.2;

const CAMERA_SCALE = 1.5;
const CAMERA_WORN = new THREE.Vector3(0.3, -0.02, 0.2);
const CAMERA_AIMED = new THREE.Vector3(0.02, 0.26, 0.42);

interface Leg {
	hip: THREE.Group;
	knee: THREE.Group;
	ankle: THREE.Group;
}

interface Arm {
	shoulder: THREE.Group;
	elbow: THREE.Group;
	hand: MittenHand;
}

export const MUSHROOM_HIP_HEIGHT = 0.36;
export const MUSHROOM_CAP_REST = 0.72;

const THIGH_LENGTH = 0.15;
const SHIN_LENGTH = 0.13;
const UPPER_ARM_LENGTH = 0.12;
const FOREARM_LENGTH = 0.11;
const EYE_HEIGHT = 0.49;
const EYE_SPACING = 0.088;
const EYE_RADIUS = 0.042;
const EYE_SHAPE: [number, number, number] = [1, 1.2, 0.82];
const STRAP_CENTER = 0.25;
const STRAP_RADIUS = 0.3;
const STRAP_TILT = -0.74;
const STRAP_WIDTH = 0.034;

const BODY_PROFILE: [number, number][] = [
	[0.001, -0.08],
	[0.16, -0.07],
	[0.255, -0.005],
	[0.295, 0.11],
	[0.3, 0.25],
	[0.282, 0.4],
	[0.248, 0.53],
	[0.215, 0.63],
	[0.2, 0.7],
	[0.001, 0.73],
];

const CAP_PROFILE: [number, number][] = [
	[0.001, 0.66],
	[0.14, 0.645],
	[0.27, 0.59],
	[0.38, 0.49],
	[0.46, 0.36],
	[0.515, 0.21],
	[0.54, 0.08],
	[0.535, 0.0],
	[0.505, -0.045],
	[0.46, -0.04],
];

const GILL_PROFILE: [number, number][] = [
	[0.46, -0.04],
	[0.34, -0.012],
	[0.23, 0.0],
	[0.19, 0.004],
	[0.001, 0.012],
];

export function capTextureFor(
	color: number,
	pattern: HatPattern = DEFAULT_HAT_PATTERN,
): string {
	return capTextureKey(
		isPlayerColor(color) ? color : DEFAULT_PLAYER_COLOR,
		isHatPattern(pattern) ? pattern : DEFAULT_HAT_PATTERN,
	);
}

function bodyRadiusAt(height: number): number {
	for (let index = 1; index < BODY_PROFILE.length; index += 1) {
		const [r0, y0] = BODY_PROFILE[index - 1];
		const [r1, y1] = BODY_PROFILE[index];
		if (height >= y0 && height <= y1) {
			return r0 + ((r1 - r0) * (height - y0)) / (y1 - y0);
		}
	}
	return 0.2;
}

function latheGeometry(
	profile: [number, number][],
	segments: number,
	repeat: number,
): THREE.LatheGeometry {
	let area = 0;
	profile.forEach(([radius, height], index) => {
		const [nextRadius, nextHeight] = profile[(index + 1) % profile.length];
		area += radius * nextHeight - nextRadius * height;
	});
	const ordered = area < 0 ? [...profile].reverse() : profile;
	const geometry = new THREE.LatheGeometry(
		ordered.map(([radius, height]) => new THREE.Vector2(radius, height)),
		segments,
	);
	const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
	for (let index = 0; index < uv.count; index += 1) {
		uv.setXY(index, uv.getX(index) * repeat, uv.getY(index));
	}
	return geometry;
}

export class MushroomModel {
	readonly root = new THREE.Group();
	readonly body = new THREE.Group();
	private readonly figure = new THREE.Group();
	readonly lantern: LanternModel;
	readonly capPivot: THREE.Group;
	readonly eyes: Eyeball[] = [];
	private readonly hips: THREE.Group;
	private readonly legs: Leg[] = [];
	private readonly arms: Arm[] = [];
	private readonly book: THREE.Group;
	private stowedBook: THREE.Mesh | null = null;
	private phase = Math.random() * Math.PI * 2;
	private deathBlend = 0;
	private crouchBlend = 0;
	private airBlend = 0;
	private readBlend = 0;
	private aimBlend = 0;
	private readonly camera: THREE.Group;
	private readonly walkie: THREE.Group;
	private readonly heldHolder = new THREE.Group();
	private readonly heldModels = new Map<OccultId, THREE.Group>();
	private heldShown: OccultId | null = null;
	private time = Math.random() * 10;
	private lastYaw: number | null = null;
	private turnRate = 0;
	private swing = 0;
	private swingVelocity = 0;

	constructor(
		kit: ModelKit,
		color: number,
		pattern: HatPattern = DEFAULT_HAT_PATTERN,
		lanternTint: number | null = null,
	) {
		const skin: MaterialOptions = { texture: "mushroomStem", roughness: 0.85 };
		const limbs: MaterialOptions = { texture: "mushroomSkin", roughness: 0.85 };
		const boot: MaterialOptions = {
			texture: "tanLeather",
			color: 0x8a6448,
			roughness: 0.75,
		};
		this.hips = kit.pivot("hips", 0, MUSHROOM_HIP_HEIGHT, 0);
		this.root.add(this.figure);
		this.figure.add(this.hips);
		this.hips.add(this.body);
		this.body.add(
			kit.mesh(latheGeometry(BODY_PROFILE, 28, 1).rotateY(Math.PI), skin),
		);

		this.addEyes(kit);
		this.addSatchel(kit);

		this.capPivot = kit.pivot("cap", 0, MUSHROOM_CAP_REST, 0);
		this.body.add(this.capPivot);
		this.capPivot.add(
			kit.mesh(latheGeometry(CAP_PROFILE, 36, 2), {
				texture: capTextureFor(color, pattern),
				roughness: 0.6,
				fixedRepeat: true,
			}),
		);
		this.capPivot.add(
			kit.mesh(latheGeometry(GILL_PROFILE, 36, 6), {
				texture: "gills",
				roughness: 1,
				fixedRepeat: true,
				side: THREE.DoubleSide,
			}),
		);

		for (const side of [-1, 1] as const) {
			this.legs.push(this.buildLeg(kit, side, limbs, boot));
			this.arms.push(this.buildArm(kit, side, limbs));
		}

		this.lantern = new LanternModel(kit, 0.8, lanternTint);
		this.arms[0].hand.root.add(this.lantern.root);
		this.book = this.buildBook(kit);
		this.body.add(this.book);
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
		this.heldHolder.position.copy(MittenHand.gripCenter(1));
		this.arms[1].hand.root.add(this.heldHolder);
		this.kit = kit;
	}

	private readonly kit: ModelKit;

	/** Créé à la première prise en main : la plupart des champignons n'en tiennent jamais. */
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

	private addEyes(kit: ModelKit): void {
		const radius = bodyRadiusAt(EYE_HEIGHT);
		for (const side of [-1, 1]) {
			const x = side * EYE_SPACING;
			const eye = new Eyeball(kit, {
				radius: EYE_RADIUS,
				sclera: { color: 0x0b0908, roughness: 0.22 },
			});
			eye.root.scale.set(...EYE_SHAPE);
			eye.root.position.set(
				x,
				EYE_HEIGHT,
				Math.sqrt(radius * radius - x * x) - 0.012,
			);
			eye.root.rotation.y = side * 0.22;
			this.body.add(eye.root);
			this.eyes.push(eye);
		}
	}

	private addSatchel(kit: ModelKit): void {
		const leather: MaterialOptions = { texture: "tanLeather", roughness: 0.7 };
		const strapPoint = (angle: number) => {
			const y =
				STRAP_CENTER + Math.cos(angle) * Math.sin(STRAP_TILT) * STRAP_RADIUS;
			const x = Math.cos(angle) * Math.cos(STRAP_TILT);
			const z = Math.sin(angle);
			const reach = (bodyRadiusAt(y) + 0.006) / Math.hypot(x, z);
			return new THREE.Vector3(x * reach, y, z * reach);
		};
		const positions: number[] = [];
		const normals: number[] = [];
		const uvs: number[] = [];
		const indices: number[] = [];
		const samples = 64;
		for (let step = 0; step <= samples; step += 1) {
			const angle = (step / samples) * Math.PI * 2;
			const point = strapPoint(angle);
			const tangent = strapPoint(angle + 0.01)
				.sub(point)
				.normalize();
			const outward = new THREE.Vector3(point.x, 0, point.z).normalize();
			const across = new THREE.Vector3()
				.crossVectors(tangent, outward)
				.multiplyScalar(STRAP_WIDTH / 2);
			for (const sign of [-1, 1]) {
				positions.push(
					point.x + across.x * sign,
					point.y + across.y * sign,
					point.z + across.z * sign,
				);
				normals.push(outward.x, outward.y, outward.z);
				uvs.push((step / samples) * 1.8, (sign + 1) * 0.02);
			}
			if (step < samples) {
				const first = step * 2;
				indices.push(
					first,
					first + 2,
					first + 1,
					first + 1,
					first + 2,
					first + 3,
				);
			}
		}
		const strap = new THREE.BufferGeometry();
		strap.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(positions, 3),
		);
		strap.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
		strap.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
		strap.setIndex(indices);
		this.body.add(
			kit.mesh(strap, { ...leather, color: 0xc49a78, side: THREE.DoubleSide }),
		);

		const bag = new THREE.Group();
		bag.position.set(0.282, 0.035, -0.07);
		bag.rotation.set(0, 1.83, 0.05);
		this.body.add(bag);
		const pouch = kit.box(0.2, 0.13, 0.07, leather);
		bag.add(pouch);
		const bottom = kit.mesh(
			new THREE.CylinderGeometry(0.035, 0.035, 0.2, 12).rotateZ(Math.PI / 2),
			leather,
		);
		bottom.position.y = -0.065;
		bag.add(bottom);
		this.stowedBook = kit.box(0.15, 0.055, 0.045, {
			texture: "leather",
			color: 0xc24a32,
			roughness: 0.7,
		});
		this.stowedBook.position.set(0.008, 0.078, -0.004);
		this.stowedBook.rotation.z = 0.08;
		bag.add(this.stowedBook);
		const flap = kit.box(0.206, 0.085, 0.012, { ...leather, color: 0xc9a383 });
		flap.position.set(0, 0.028, 0.04);
		flap.rotation.x = 0.06;
		bag.add(flap);
		const buckle = kit.box(0.034, 0.032, 0.01, {
			texture: "brass",
			roughness: 0.4,
			metalness: 0.75,
		});
		buckle.position.set(0, -0.01, 0.048);
		bag.add(buckle);
	}

	private buildLeg(
		kit: ModelKit,
		side: -1 | 1,
		skin: MaterialOptions,
		boot: MaterialOptions,
	): Leg {
		const hip = kit.pivot("hip", side * 0.12, 0, 0);
		this.hips.add(hip);
		hip.add(kit.limb(0.066, THIGH_LENGTH, skin, 12));
		const knee = kit.pivot("knee", 0, -THIGH_LENGTH, 0);
		hip.add(knee);
		knee.add(kit.limb(0.062, SHIN_LENGTH, skin, 12));
		const ankle = kit.pivot("ankle", 0, -SHIN_LENGTH, 0);
		knee.add(ankle);
		const foot = kit.sphere(0.078, boot, [1, 0.72, 1.35], 16);
		foot.position.set(0, -0.02, 0.03);
		ankle.add(foot);
		const shaft = kit.cylinder(0.07, 0.074, 0.075, boot, 16);
		shaft.position.y = 0.02;
		ankle.add(shaft);
		const cuff = kit.mesh(new THREE.TorusGeometry(0.072, 0.017, 6, 18), {
			...boot,
			color: 0x8a5d3c,
		});
		cuff.rotation.x = Math.PI / 2;
		cuff.position.y = 0.058;
		ankle.add(cuff);
		return { hip, knee, ankle };
	}

	private buildArm(kit: ModelKit, side: -1 | 1, skin: MaterialOptions): Arm {
		const shoulder = kit.pivot("shoulder", side * 0.27, 0.36, 0);
		this.body.add(shoulder);
		shoulder.add(kit.limb(0.046, UPPER_ARM_LENGTH, skin, 12));
		const elbow = kit.pivot("elbow", 0, -UPPER_ARM_LENGTH, 0);
		shoulder.add(elbow);
		elbow.add(kit.limb(0.044, FOREARM_LENGTH, skin, 12));
		const hand = new MittenHand(kit, skin, side === 1 ? -1 : 1, 1.05);
		hand.root.position.y = -FOREARM_LENGTH;
		hand.root.rotation.y = (-side * Math.PI) / 2;
		elbow.add(hand.root);
		return { shoulder, elbow, hand };
	}

	private buildBook(kit: ModelKit): THREE.Group {
		const book = new THREE.Group();
		const leather: MaterialOptions = {
			texture: "leather",
			color: 0x7a2a1e,
			roughness: 0.7,
		};
		const paper: MaterialOptions = { texture: "paper", roughness: 1 };
		for (const side of [-1, 1]) {
			const cover = kit.box(0.15, 0.008, 0.21, leather);
			cover.position.set(side * 0.075, 0, 0);
			cover.rotation.z = -side * 0.12;
			book.add(cover);
			const pages = kit.box(0.137, 0.016, 0.196, paper);
			pages.position.set(side * 0.07, 0.011, 0);
			pages.rotation.z = -side * 0.12;
			book.add(pages);
		}
		book.position.set(0.04, 0.2, 0.4);
		book.rotation.set(-0.45, 0, 0);
		book.visible = false;
		return book;
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

		this.updateLegs(speedFactor);
		this.updateBody(speedFactor, pose);
		this.updateArms(speedFactor, pose);

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
		if (this.stowedBook) {
			this.stowedBook.visible = !this.book.visible;
		}
		this.book.scale.setScalar(Math.max(0.01, read));
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
		this.root.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
			}
		});
	}
}
