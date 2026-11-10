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
import {
	CAMERA_BODY,
	CAMERA_SCREEN_SIZE,
	type CameraModel,
	createCameraModel,
} from "../../models/cameraModel";
import { LanternModel } from "../../models/LanternModel";
import type { ModelKit } from "../../models/modelKit";
import { createOccultModel } from "../../models/occultModels";
import type { DynamicLight } from "../lighting/LightPool";
import { OccultAura } from "./OccultAura";

export const FIRST_PERSON_LAYER = 1;

type ArmMesh = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

export interface RigInput {
	grimoireOpen: boolean;
	heldObject: OccultId | null;
	/** De 0 à 1 : l'objet tenu est à portée d'un monstre qu'il peut capturer. */
	heldResonance?: number;
	/** L'appareil photo levé devant soi : il prend la place de l'objet occulte. */
	cameraRaised: boolean;
	/** En visée : l'appareil devant les yeux, son écran au centre et en grand. */
	cameraAimed: boolean;
	lanternOpen: boolean;
	speed: number;
	crouch: number;
	lookDeltaX: number;
	lookDeltaY: number;
	yaw: number;
	pitch: number;
	swing: number;
	headBob: boolean;
	reduceMotion: boolean;
	visible: boolean;
	fov: number;
	aspect: number;
}

const ARM_ELBOW_RADIUS = 0.085;
const ARM_HAND_RADIUS = 0.062;
const ARM_LENGTH = 0.6;
const ARM_TIP_STEPS = 6;
const ARM_DARK = new THREE.Color(0x4e4a44);
const ARM_LIT = new THREE.Color(0xa58a6a);
const ARM_VERTEX_SHADER = `
varying vec3 vArmNormal;
void main() {
	vArmNormal = normalMatrix * normal;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const ARM_FRAGMENT_SHADER = `
uniform vec3 color;
varying vec3 vArmNormal;
void main() {
	float light = dot(normalize(vArmNormal), normalize(vec3(-0.25, 0.75, 0.6)));
	gl_FragColor = vec4(color * (0.62 + 0.38 * light), 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;
const UP = new THREE.Vector3(0, 1, 0);

const LANTERN_SCALE = 0.95;
const LANTERN_IDLE = new THREE.Vector3(0.27, -0.03, -0.5);
const LANTERN_READING = new THREE.Vector3(0.5, 0.15, -0.45);
const HELD_SIZE = 0.15;
const HELD_RAISED = new THREE.Vector3(-0.25, -0.2, -0.52);
const HELD_LOWERED = new THREE.Vector3(-0.3, -0.72, -0.4);
const HELD_TIP_DROP = 0.035;
const HELD_GLOW_INTENSITY = 0.9;
const HELD_GLOW_RADIUS = 4.5;
const HELD_ARM_TINT = 0.24;
const HELD_ELBOW = new THREE.Vector3(-0.46, -0.62, -0.12);
const CAMERA_RAISED = new THREE.Vector3(-0.02, -0.15, -0.3);
const CAMERA_LOWERED = new THREE.Vector3(-0.08, -0.62, -0.32);
const CAMERA_ELBOW = new THREE.Vector3(-0.4, -0.55, -0.08);
const CAMERA_FLASH_MS = 160;
const CAMERA_BODY_HALF = CAMERA_BODY.height / 2;
/** En visée, l'écran de l'appareil occupe cette part de la hauteur de vue, quel que soit le FOV. */
const CAMERA_AIM_SCREEN_SHARE = 0.4;
/** Le centre de l'écran, vu depuis le centre de l'appareil (voir createCameraModel). */
const CAMERA_SCREEN_OFFSET_X = -0.012;
const CAMERA_AIM_SECONDS = 0.18;
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
	private readonly rightArm: ArmMesh;
	private readonly leftArm: ArmMesh;
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
	private readonly heldHeights = new Map<OccultId, number>();
	private readonly aura = new OccultAura();
	private readonly heldTint = new THREE.Color();
	readonly heldGlow: DynamicLight = {
		id: "held-object",
		position: new THREE.Vector3(),
		color: 0xffffff,
		intensity: 0,
		radius: HELD_GLOW_RADIUS,
		priority: 3,
		flicker: 0.08,
	};
	private heldShown: OccultId | null = null;
	private heldBlend = 0;
	private readonly photoCamera: CameraModel;
	private cameraBlend = 0;
	private aimBlend = 0;
	private flashUntil = 0;

	constructor(
		kit: ModelKit,
		lanternTint: number | null = null,
		cameraScreen: THREE.Texture | null = null,
	) {
		this.lantern = new LanternModel(kit, LANTERN_SCALE, lanternTint);
		this.root.add(this.lantern.root);
		this.grimoire = new GrimoireModel(kit);
		this.root.add(this.grimoire.root);
		for (const id of OCCULT_IDS) {
			const model = this.createHeldModel(kit, id);
			this.heldModels.set(id, model);
			this.heldRoot.add(model);
		}
		this.heldRoot.add(this.aura.root);
		this.root.add(this.heldRoot);
		this.photoCamera = createCameraModel(kit, cameraScreen);
		this.photoCamera.root.visible = false;
		this.root.add(this.photoCamera.root);
		this.rightArm = this.createArm();
		this.leftArm = this.createArm();
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
		this.heldHeights.set(id, size.y * scale);
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
		const wanted =
			this.bookBlend > 0.05 || input.cameraRaised ? null : input.heldObject;
		if (wanted !== null && wanted !== this.heldShown) {
			this.heldShown = wanted;
			this.aura.show(wanted, this.heldHeights.get(wanted) ?? HELD_SIZE);
			this.heldGlow.color = this.aura.color;
			this.heldTint.setHex(this.aura.color);
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
		const resonance = input.heldResonance ?? 0;
		this.aura.update(
			dt,
			input.visible ? this.heldBlend : 0,
			!input.reduceMotion,
			resonance,
		);
		this.heldGlow.intensity =
			input.visible && this.heldBlend > 0.01
				? HELD_GLOW_INTENSITY * this.heldBlend * (1 + resonance * 1.5)
				: 0;
		this.heldGlow.position.copy(position).add(this.aura.root.position);
		this.root.localToWorld(this.heldGlow.position);
		if (this.heldBlend > 0.01 && this.bookBlend <= 0.05) {
			const contact = position.clone();
			contact.y -= HELD_TIP_DROP;
			this.placeArm(this.leftArm, contact, HELD_ELBOW);
		}
	}

	/** Le petit éclair de l'appareil, au moment de la photo. */
	flashPhoto(): void {
		this.flashUntil = performance.now() + CAMERA_FLASH_MS;
	}

	get cameraUp(): boolean {
		return this.cameraBlend > 0.98;
	}

	private updateCamera(
		dt: number,
		input: RigInput,
		bobX: number,
		bobY: number,
	): void {
		const target = input.cameraRaised && this.bookBlend <= 0.05 ? 1 : 0;
		const step = dt / 0.22;
		this.cameraBlend =
			this.cameraBlend < target
				? Math.min(target, this.cameraBlend + step)
				: Math.max(target, this.cameraBlend - step);
		const aimTarget = input.cameraAimed && target === 1 ? 1 : 0;
		const aimStep = dt / CAMERA_AIM_SECONDS;
		this.aimBlend =
			this.aimBlend < aimTarget
				? Math.min(aimTarget, this.aimBlend + aimStep)
				: Math.max(aimTarget, this.aimBlend - aimStep);
		const model = this.photoCamera.root;
		model.visible = this.cameraBlend > 0.01;
		if (!model.visible) {
			return;
		}
		const aim = easeInOut(this.aimBlend);
		const position = new THREE.Vector3()
			.lerpVectors(CAMERA_LOWERED, CAMERA_RAISED, easeInOut(this.cameraBlend))
			.lerp(this.aimedCameraPosition(input.fov), aim);
		// En visée, les mains se calment : l'écran doit rester lisible.
		const steady = 0.5 - aim * 0.38;
		position.x += (this.sway.x + bobX) * steady;
		position.y += (this.sway.y - bobY) * steady - input.crouch * 0.01;
		model.position.copy(position);
		model.position.y -= CAMERA_BODY_HALF;
		model.rotation.set(
			(0.05 - (1 - this.cameraBlend) * 0.9) * (1 - aim),
			0.04 * (1 - aim),
			0,
		);
		const flashing = performance.now() < this.flashUntil;
		this.photoCamera.flash.material.color.setHex(
			flashing ? 0xffffff : 0xd8dde4,
		);
		const contact = position.clone();
		// En visée, la main tient l'appareil par en dessous, hors de l'écran.
		contact.x -= 0.075 + aim * 0.012;
		contact.y -= aim * 0.04;
		this.placeArm(this.leftArm, contact, CAMERA_ELBOW);
	}

	/** Devant les yeux, l'écran centré, assez près pour en occuper une bonne part. */
	private aimedCameraPosition(fov: number): THREE.Vector3 {
		const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
		const distance =
			CAMERA_SCREEN_SIZE / (viewHeight * CAMERA_AIM_SCREEN_SHARE);
		return new THREE.Vector3(
			-CAMERA_SCREEN_OFFSET_X,
			0,
			-(distance + CAMERA_BODY.depth / 2),
		);
	}

	private createArm(): ArmMesh {
		const half = ARM_LENGTH / 2;
		const tipHeight = ARM_HAND_RADIUS * 0.8;
		const profile = [
			new THREE.Vector2(0.001, -half),
			new THREE.Vector2(ARM_ELBOW_RADIUS, -half + 0.03),
		];
		for (let step = 0; step <= ARM_TIP_STEPS; step += 1) {
			const angle = (step / ARM_TIP_STEPS) * (Math.PI / 2);
			profile.push(
				new THREE.Vector2(
					Math.max(0.001, Math.cos(angle) * ARM_HAND_RADIUS),
					half - tipHeight + Math.sin(angle) * tipHeight,
				),
			);
		}
		const arm: ArmMesh = new THREE.Mesh(
			new THREE.LatheGeometry(profile, 20),
			new THREE.ShaderMaterial({
				uniforms: { color: { value: ARM_DARK.clone() } },
				vertexShader: ARM_VERTEX_SHADER,
				fragmentShader: ARM_FRAGMENT_SHADER,
			}),
		);
		this.root.add(arm);
		return arm;
	}

	private updateArmTones(): void {
		const right: THREE.Color = this.rightArm.material.uniforms.color.value;
		const left: THREE.Color = this.leftArm.material.uniforms.color.value;
		right.lerpColors(ARM_DARK, ARM_LIT, this.lanternLevel);
		left.copy(right).lerp(this.heldTint, HELD_ARM_TINT * this.heldBlend);
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

		this.placeArm(
			this.rightArm,
			lanternAnchor,
			new THREE.Vector3(
				0.62 + blend * 0.04,
				-0.44 + blend * 0.06,
				-0.16 - blend * 0.06,
			),
		);
		if (this.bookBlend > 0.05) {
			this.placeBookArm(bookPosition, this.grimoire.root.rotation);
		}
		this.updateHeld(dt, input, bobX, bobY);
		this.updateCamera(dt, input, bobX, bobY);
		this.leftArm.visible =
			this.bookBlend > 0.05 || this.heldBlend > 0.01 || this.cameraBlend > 0.01;

		this.lanternLevel = this.lantern.update(dt, input.lanternOpen);
		this.updateArmTones();
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

	private placeBookArm(
		bookPosition: THREE.Vector3,
		bookRotation: THREE.Euler,
	): void {
		const contact = new THREE.Vector3(
			-BOOK_PAGE_WIDTH - 0.012,
			-BOOK_PAGE_HEIGHT * 0.12,
			-0.03,
		)
			.applyEuler(bookRotation)
			.add(bookPosition);
		this.placeArm(this.leftArm, contact, new THREE.Vector3(-0.42, -0.5, -0.1));
	}

	private placeArm(
		arm: THREE.Mesh,
		contact: THREE.Vector3,
		elbow: THREE.Vector3,
	): void {
		const direction = new THREE.Vector3().subVectors(contact, elbow);
		const length = direction.length();
		arm.position.copy(elbow).addScaledVector(direction, 0.5);
		arm.quaternion.setFromUnitVectors(UP, direction.normalize());
		arm.scale.set(1, length / ARM_LENGTH, 1);
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
		this.aura.dispose();
		this.rightArm.material.dispose();
		this.leftArm.material.dispose();
		this.root.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
			}
		});
	}
}
