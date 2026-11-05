import { OCCULT_IDS, type OccultId } from "@shared/config/occult";
import { angleDifference } from "@shared/math";
import * as THREE from "three";
import {
	LANTERN_AIR_DRAG_TILT,
	LANTERN_AIR_DRAG_TURN,
	LANTERN_AIR_DRAG_WALK,
	LANTERN_MAX_TURN_RATE,
	LANTERN_PENDULUM_DAMPING,
	LANTERN_PENDULUM_STIFFNESS,
} from "../../../config/feel";
import {
	BOOK_PAGE_HEIGHT,
	BOOK_PAGE_WIDTH,
	GrimoireModel,
} from "../../grimoire/GrimoireModel";
import { LanternModel } from "../../models/LanternModel";
import {
	GRIP_HAND,
	type HandPose,
	MittenHand,
	orientHand,
	SUPPORT_HAND,
} from "../../models/MittenHand";
import type { ModelKit } from "../../models/modelKit";
import { createOccultModel } from "../../models/occultModels";
import type { MaterialOptions } from "../../world/MaterialLibrary";

export const FIRST_PERSON_LAYER = 1;

export interface RigInput {
	grimoireOpen: boolean;
	heldObject: OccultId | null;
	lanternOpen: boolean;
	speed: number;
	crouch: number;
	lookDeltaX: number;
	lookDeltaY: number;
	yaw: number;
	pitch: number;
	swing: number;
	headBob: boolean;
	visible: boolean;
	fov: number;
	aspect: number;
}

interface Arm {
	forearm: THREE.Mesh;
	hand: MittenHand;
}

const HAND_SIZE = 1.15;
const FOREARM_LENGTH = 0.3;
const BOOK_HOLD: HandPose = { curl: 0.35, thumb: 1.2 };
const UP = new THREE.Vector3(0, 1, 0);

const LANTERN_SCALE = 0.95;
const LANTERN_IDLE = new THREE.Vector3(0.27, -0.03, -0.5);
const LANTERN_READING = new THREE.Vector3(0.5, 0.15, -0.45);
const HELD_SIZE = 0.135;
const HELD_RAISED = new THREE.Vector3(-0.25, -0.2, -0.52);
const HELD_LOWERED = new THREE.Vector3(-0.3, -0.72, -0.4);
const HELD_PALM_DROP = 0.045;
const HELD_ELBOW = new THREE.Vector3(-0.46, -0.62, -0.12);
const BOOK_WIDTH = (BOOK_PAGE_WIDTH + 0.015) * 2;
const BOOK_HEIGHT = BOOK_PAGE_HEIGHT + 0.025;
const BOOK_HEIGHT_SHARE = 0.54;
const BOOK_MAX_WIDTH_SHARE = 0.9;
const BOOK_TOP_EDGE = 0.515;
const BOOK_STOWED = new THREE.Vector3(-0.06, -0.62, -0.38);
const BOOK_UPRIGHT_PITCH = -0.35;
const BOOK_FLAT_PITCH = 0.35;
const BOOK_FLAT_DROP = new THREE.Vector3(0, -0.02, 0.12);
const BOOK_LOWERED_PITCH = -0.35;
const BOOK_STRAIGHT_PITCH = -0.85;

function openBookPosition(fov: number, aspect: number): THREE.Vector3 {
	const slope = Math.tan((fov * Math.PI) / 360);
	const distance = Math.max(
		BOOK_HEIGHT / (2 * slope * BOOK_HEIGHT_SHARE),
		BOOK_WIDTH / (2 * slope * aspect * BOOK_MAX_WIDTH_SHARE),
	);
	const top = (0.5 - BOOK_TOP_EDGE) * 2 * slope * distance;
	return new THREE.Vector3(-0.005, top - BOOK_HEIGHT / 2, -distance);
}

function easeInOut(t: number): number {
	return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export class FirstPersonRig {
	readonly root = new THREE.Group();
	readonly lantern: LanternModel;
	readonly grimoire: GrimoireModel;
	readonly fpLight: THREE.PointLight;
	private readonly fpAmbient: THREE.HemisphereLight;
	private readonly rightArm: Arm;
	private readonly leftArm: Arm;
	private bookBlend = 0;
	private bookTilt = 0;
	private bookLowered = 0;
	private bobPhase = 0;
	private readonly sway = new THREE.Vector2();
	private readonly pendulum = new THREE.Vector2();
	private readonly pendulumVelocity = new THREE.Vector2();
	private readonly turnRate = new THREE.Vector2();
	private lastLook: { yaw: number; pitch: number } | null = null;
	private lanternLevel = 0;
	private readonly heldRoot = new THREE.Group();
	private readonly heldModels = new Map<OccultId, THREE.Group>();
	private heldShown: OccultId | null = null;
	private heldBlend = 0;

	constructor(kit: ModelKit) {
		const skin: MaterialOptions = { texture: "mushroomSkin", roughness: 0.85 };
		this.lantern = new LanternModel(kit, LANTERN_SCALE);
		this.root.add(this.lantern.root);
		this.grimoire = new GrimoireModel(kit);
		this.root.add(this.grimoire.root);
		for (const id of OCCULT_IDS) {
			const model = this.createHeldModel(kit, id);
			this.heldModels.set(id, model);
			this.heldRoot.add(model);
		}
		this.root.add(this.heldRoot);
		this.rightArm = this.createArm(kit, skin);
		this.leftArm = this.createArm(kit, skin);
		this.fpLight = new THREE.PointLight(0xffb468, 0, 1.6, 2);
		this.root.add(this.fpLight);
		this.fpAmbient = new THREE.HemisphereLight(0xaaaaae, 0x4c4c4e, 1.25);
		this.root.add(this.fpAmbient);
		this.root.traverse((object) => object.layers.set(FIRST_PERSON_LAYER));
	}

	private createHeldModel(kit: ModelKit, id: OccultId): THREE.Group {
		const model = createOccultModel(kit, id);
		const box = new THREE.Box3().setFromObject(model);
		const size = box.getSize(new THREE.Vector3());
		const center = box.getCenter(new THREE.Vector3());
		const scale = HELD_SIZE / Math.max(size.x, size.y, size.z);
		model.scale.setScalar(scale);
		model.position.set(
			-center.x * scale,
			-box.min.y * scale,
			-center.z * scale,
		);
		const holder = new THREE.Group();
		holder.add(model);
		holder.visible = false;
		return holder;
	}

	private updateHeld(
		dt: number,
		input: RigInput,
		bobX: number,
		bobY: number,
	): void {
		const wanted = this.bookBlend > 0.05 ? null : input.heldObject;
		if (wanted !== null) {
			this.heldShown = wanted;
		}
		const target = wanted === null ? 0 : 1;
		const step = dt / 0.2;
		this.heldBlend =
			this.heldBlend < target
				? Math.min(target, this.heldBlend + step)
				: Math.max(target, this.heldBlend - step);
		for (const [id, model] of this.heldModels) {
			model.visible = id === this.heldShown && this.heldBlend > 0.01;
		}
		const position = new THREE.Vector3().lerpVectors(
			HELD_LOWERED,
			HELD_RAISED,
			easeInOut(this.heldBlend),
		);
		position.x += this.sway.x + bobX;
		position.y += this.sway.y - bobY - input.crouch * 0.01;
		this.heldRoot.position.copy(position);
		this.heldRoot.rotation.set(0.12, 0.35, 0);
		if (this.heldBlend > 0.01 && this.bookBlend <= 0.05) {
			const contact = position.clone();
			contact.y -= HELD_PALM_DROP;
			const fingers = new THREE.Vector3()
				.subVectors(contact, HELD_ELBOW)
				.normalize();
			this.leftArm.hand.setPose(SUPPORT_HAND);
			this.placeArm(
				this.leftArm,
				contact,
				HELD_ELBOW,
				fingers,
				new THREE.Vector3(0.1, 1, 0.15),
				new THREE.Vector3(0, -0.06 * HAND_SIZE, 0),
			);
		}
	}

	private createArm(kit: ModelKit, skin: MaterialOptions): Arm {
		const forearm = kit.cylinder(0.045, 0.058, FOREARM_LENGTH, skin, 16);
		const elbowCap = kit.sphere(0.058, skin, [1, 1, 1], 14);
		elbowCap.position.y = -FOREARM_LENGTH / 2;
		forearm.add(elbowCap);
		this.root.add(forearm);
		const hand = new MittenHand(kit, skin, -1, HAND_SIZE);
		this.root.add(hand.root);
		return { forearm, hand };
	}

	update(dt: number, input: RigInput): void {
		this.root.visible = input.visible;
		const target = input.grimoireOpen ? 1 : 0;
		const step = dt / 0.36;
		if (this.bookBlend < target) {
			this.bookBlend = Math.min(target, this.bookBlend + step);
		} else if (this.bookBlend > target) {
			this.bookBlend = Math.max(target, this.bookBlend - step);
		}
		const blend = easeInOut(this.bookBlend);
		const moving = Math.min(1, input.speed / 3);
		if (input.headBob) {
			this.bobPhase += dt * (4 + input.speed * 1.8);
		}
		const bobX = input.headBob ? Math.cos(this.bobPhase) * 0.012 * moving : 0;
		const bobY = input.headBob
			? Math.abs(Math.sin(this.bobPhase)) * 0.014 * moving
			: 0;
		this.sway.x +=
			(-input.lookDeltaX * 0.0009 - this.sway.x) * Math.min(1, dt * 8);
		this.sway.y +=
			(input.lookDeltaY * 0.0009 - this.sway.y) * Math.min(1, dt * 8);
		this.sway.clampScalar(-0.04, 0.04);

		const lanternAnchor = new THREE.Vector3().lerpVectors(
			LANTERN_IDLE,
			LANTERN_READING,
			blend,
		);
		lanternAnchor.x += this.sway.x + bobX;
		lanternAnchor.y += this.sway.y - bobY - input.crouch * 0.01;
		this.updatePendulum(dt, input, blend);
		this.placeLantern(lanternAnchor);

		const open = openBookPosition(input.fov, input.aspect);
		const facing = Math.atan2(open.y, -open.z);
		const tiltTarget = THREE.MathUtils.smoothstep(
			input.pitch,
			BOOK_UPRIGHT_PITCH,
			BOOK_FLAT_PITCH,
		);
		this.bookTilt += (tiltTarget - this.bookTilt) * Math.min(1, dt * 10);
		const loweredTarget = THREE.MathUtils.smoothstep(
			-input.pitch,
			-BOOK_LOWERED_PITCH,
			-BOOK_STRAIGHT_PITCH,
		);
		this.bookLowered +=
			(loweredTarget - this.bookLowered) * Math.min(1, dt * 10);
		open.y *= 1 - this.bookLowered;
		const flat = -(Math.PI / 2 + Math.max(0, input.pitch));
		open.addScaledVector(BOOK_FLAT_DROP, this.bookTilt);
		const bookPosition = new THREE.Vector3().lerpVectors(
			BOOK_STOWED,
			open,
			blend,
		);
		const steady = 1 - blend * 0.6;
		bookPosition.x += (this.sway.x * 0.6 + bobX * 0.5) * steady;
		bookPosition.y += (this.sway.y * 0.6 - bobY * 0.6) * steady;
		this.grimoire.root.position.copy(bookPosition);
		this.grimoire.root.rotation.set(
			THREE.MathUtils.lerp(facing, flat, this.bookTilt) *
				(1 - this.bookLowered) -
				(1 - blend) * 1.1,
			0.02,
			0.03 * (1 - blend),
		);
		this.grimoire.root.visible = this.bookBlend > 0.01;
		this.grimoire.update(dt);

		this.placeLanternHand(
			lanternAnchor,
			new THREE.Vector3(
				0.36 + blend * 0.04,
				-0.5 + blend * 0.06,
				-0.12 - blend * 0.06,
			),
		);
		if (this.bookBlend > 0.05) {
			this.placeBookHand(bookPosition, this.grimoire.root.rotation);
		}
		this.updateHeld(dt, input, bobX, bobY);
		const leftHandBusy = this.bookBlend > 0.05 || this.heldBlend > 0.01;
		this.leftArm.forearm.visible = leftHandBusy;
		this.leftArm.hand.root.visible = leftHandBusy;

		this.lanternLevel = this.lantern.update(dt, input.lanternOpen);
		this.fpLight.position.copy(this.lanternLocalPosition());
		this.fpLight.position.z += 0.05;
		this.fpLight.intensity = this.lanternLevel * (0.55 + blend * 0.2);
	}

	get lanternLevelValue(): number {
		return this.lanternLevel;
	}

	private updatePendulum(dt: number, input: RigInput, blend: number): void {
		if (dt <= 0) {
			return;
		}
		const last = this.lastLook ?? { yaw: input.yaw, pitch: input.pitch };
		this.lastLook = { yaw: input.yaw, pitch: input.pitch };
		const smoothing = Math.min(1, dt * 20);
		const yawRate = THREE.MathUtils.clamp(
			angleDifference(last.yaw, input.yaw) / dt,
			-LANTERN_MAX_TURN_RATE,
			LANTERN_MAX_TURN_RATE,
		);
		const pitchRate = THREE.MathUtils.clamp(
			(input.pitch - last.pitch) / dt,
			-LANTERN_MAX_TURN_RATE,
			LANTERN_MAX_TURN_RATE,
		);
		this.turnRate.x += (yawRate - this.turnRate.x) * smoothing;
		this.turnRate.y += (pitchRate - this.turnRate.y) * smoothing;
		const rest = new THREE.Vector2(
			this.turnRate.x * LANTERN_AIR_DRAG_TURN,
			-this.turnRate.y * LANTERN_AIR_DRAG_TILT -
				input.speed * LANTERN_AIR_DRAG_WALK,
		).multiplyScalar(input.swing);
		this.pendulumVelocity.x +=
			(-(this.pendulum.x - rest.x) * LANTERN_PENDULUM_STIFFNESS -
				this.pendulumVelocity.x * LANTERN_PENDULUM_DAMPING) *
			dt;
		this.pendulumVelocity.y +=
			(-(this.pendulum.y - rest.y) * LANTERN_PENDULUM_STIFFNESS -
				this.pendulumVelocity.y * LANTERN_PENDULUM_DAMPING) *
			dt;
		this.pendulum.addScaledVector(this.pendulumVelocity, dt);
		this.pendulum.clampScalar(-0.5 + blend * 0.3, 0.5 - blend * 0.3);
	}

	private placeLantern(anchor: THREE.Vector3): void {
		const lantern = this.lantern.root;
		lantern.rotation.set(this.pendulum.y, 0, this.pendulum.x);
		lantern.updateMatrix();
		const handleOffset = this.lantern.handle.position
			.clone()
			.multiplyScalar(lantern.scale.x)
			.applyEuler(lantern.rotation);
		lantern.position.copy(anchor).sub(handleOffset);
	}

	private placeLanternHand(grip: THREE.Vector3, elbow: THREE.Vector3): void {
		const arm = this.rightArm;
		const reach = new THREE.Vector3().subVectors(grip, elbow).normalize();
		const fingers = reach.clone().addScaledVector(UP, -0.55).normalize();
		const palm = new THREE.Vector3(-0.25, -1, 0.15);
		arm.hand.setPose(GRIP_HAND);
		this.placeArm(
			arm,
			grip,
			elbow,
			fingers,
			palm,
			MittenHand.gripCenter(HAND_SIZE),
		);
	}

	private placeBookHand(
		bookPosition: THREE.Vector3,
		bookRotation: THREE.Euler,
	): void {
		const arm = this.leftArm;
		const toWorld = (x: number, y: number, z: number) =>
			new THREE.Vector3(x, y, z).applyEuler(bookRotation);
		const contact = toWorld(
			-BOOK_PAGE_WIDTH - 0.012,
			-BOOK_PAGE_HEIGHT * 0.12,
			-0.03,
		).add(bookPosition);
		const fingers = toWorld(1, 0.25, -0.12).normalize();
		const palm = toWorld(0, 0, 1);
		const elbow = new THREE.Vector3(-0.42, -0.5, -0.1);
		arm.hand.setPose(BOOK_HOLD);
		this.placeArm(
			arm,
			contact,
			elbow,
			fingers,
			palm,
			new THREE.Vector3(0, -0.055 * HAND_SIZE, 0),
		);
	}

	private placeArm(
		arm: Arm,
		contact: THREE.Vector3,
		elbow: THREE.Vector3,
		fingers: THREE.Vector3,
		palm: THREE.Vector3,
		contactInHand: THREE.Vector3,
	): void {
		const hand = arm.hand.root;
		orientHand(hand, fingers, palm);
		const wrist = contact
			.clone()
			.sub(contactInHand.clone().applyQuaternion(hand.quaternion));
		hand.position.copy(wrist);
		const direction = new THREE.Vector3().subVectors(wrist, elbow);
		const length = direction.length();
		arm.forearm.position.copy(elbow).addScaledVector(direction, 0.5);
		arm.forearm.quaternion.setFromUnitVectors(UP, direction.normalize());
		arm.forearm.scale.set(1, length / FOREARM_LENGTH, 1);
	}

	lanternLocalPosition(): THREE.Vector3 {
		const lantern = this.lantern.root;
		return this.lantern.lightAnchor.position
			.clone()
			.multiplyScalar(lantern.scale.x)
			.applyEuler(lantern.rotation)
			.add(lantern.position);
	}

	dispose(): void {
		this.grimoire.dispose();
		this.root.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
			}
		});
	}
}
