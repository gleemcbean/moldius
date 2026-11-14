import {
	CROUCH_EYE_DROP,
	EYE_HEIGHT_STANDING,
	GHOST_FAST_SPEED,
	GHOST_SPEED,
	GHOST_VERTICAL_SPEED,
} from "@shared/config/index";
import type { DevModes } from "@shared/devModes";
import { clampToGhostBounds, type GhostBounds } from "@shared/ghost";
import { clamp, lerp, rotate2, type Vec2, type Vec3 } from "@shared/math";
import {
	type CharacterInput,
	type CharacterState,
	createCharacterState,
	isSprinting,
	JumpAssist,
	type MovementModifiers,
	stepCharacter,
} from "@shared/physics/character";
import type { CollisionWorld } from "@shared/physics/collisionWorld";
import type {
	ForcedMove,
	ForcedMoveKind,
	SpawnPoint,
} from "@shared/protocol/game";
import { MOUSE_LOOK_SCALE } from "../../../config/feel";

const STEP = 1 / 120;
const MAX_STEPS = 8;

export interface LocalControls {
	forward: number;
	strafe: number;
	sprint: boolean;
	crouch: boolean;
	jump: boolean;
	rise: number;
	lookX: number;
	lookY: number;
}

export interface LocalContext {
	sensitivity: number;
	invertY: boolean;
	sprintAllowed: boolean;
	jumpAllowed: boolean;
	speedFactor: number;
	gravityFactor: number;
	pull: Vec2;
	alive: boolean;
	carriedAnchor: Vec3 | null;
	hideInterior: Vec3 | null;
	hideFacing: number;
	devModes: DevModes;
	ghost: GhostBounds | null;
}

interface ForcedAnimation {
	kind: ForcedMoveKind;
	from: Vec3;
	to: Vec3;
	start: number;
	duration: number;
}

export class LocalPlayer {
	readonly character: CharacterState;
	private readonly previous: CharacterState;
	yaw: number;
	pitch = 0;
	moveAck = 0;
	jumps = 0;
	private accumulator = 0;
	private readonly jumpAssist = new JumpAssist();
	readonly events: {
		kind: "jump" | "land" | "tired" | "bounds";
		speed: number;
	}[] = [];
	private boundsWarnedAt = -Infinity;
	private cameraY: number;
	private forced: ForcedAnimation | null = null;
	private deathTilt = 0;
	private time = 0;
	lastInput: CharacterInput = {
		forward: 0,
		strafe: 0,
		yaw: 0,
		sprint: false,
		crouch: false,
		jump: false,
	};

	constructor(
		private readonly world: CollisionWorld,
		spawn: SpawnPoint,
	) {
		this.character = createCharacterState(spawn.x, spawn.y, spawn.z);
		this.previous = { ...this.character };
		this.yaw = spawn.yaw;
		this.cameraY = spawn.y + EYE_HEIGHT_STANDING;
	}

	get position(): Vec3 {
		return { x: this.character.x, y: this.character.y, z: this.character.z };
	}

	get physicsActive(): boolean {
		return this.forced === null;
	}

	applyForcedMove(move: ForcedMove): void {
		this.moveAck = Math.max(this.moveAck, move.moveId);
		const from = {
			x: this.character.x,
			y: this.character.y,
			z: this.character.z,
		};
		const to = { x: move.x, y: move.y, z: move.z };
		const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
		if (
			move.yaw !== null &&
			(move.kind === "respawn" ||
				move.kind === "spawn" ||
				move.kind === "hide" ||
				move.kind === "unhide" ||
				move.kind === "extract" ||
				move.kind === "drop")
		) {
			this.yaw = move.yaw;
			this.pitch = move.kind === "hide" ? 0 : this.pitch;
		}
		const reach = move.kind === "throw" ? 12 : 4;
		const animated =
			move.durationMs > 0 && distance < reach && move.kind !== "respawn";
		if (animated) {
			this.forced = {
				kind: move.kind,
				from,
				to,
				start: this.time,
				duration: move.durationMs / 1000,
			};
		} else {
			this.teleport(to);
		}
	}

	private teleport(to: Vec3): void {
		this.character.x = to.x;
		this.character.y = to.y;
		this.character.z = to.z;
		this.character.vx = 0;
		this.character.vy = 0;
		this.character.vz = 0;
		this.character.grounded = true;
		Object.assign(this.previous, this.character);
		this.cameraY =
			to.y + EYE_HEIGHT_STANDING - CROUCH_EYE_DROP * this.character.crouch;
		this.forced = null;
	}

	update(dt: number, controls: LocalControls, context: LocalContext): void {
		this.time += dt;
		this.updateLook(controls, context);
		if (this.forced) {
			this.updateForced();
			return;
		}
		if (!context.alive && context.ghost) {
			this.deathTilt = 0;
			this.updateGhost(dt, controls, context.ghost);
			return;
		}
		if (!context.alive || context.carriedAnchor || context.hideInterior) {
			this.character.vx = 0;
			this.character.vz = 0;
			if (context.carriedAnchor) {
				this.character.x = context.carriedAnchor.x;
				this.character.y = context.carriedAnchor.y;
				this.character.z = context.carriedAnchor.z;
				Object.assign(this.previous, this.character);
			}
			this.deathTilt = context.alive
				? 0
				: Math.min(1, this.deathTilt + dt * 1.5);
			return;
		}
		this.deathTilt = 0;
		const input: CharacterInput = {
			forward: controls.forward,
			strafe: controls.strafe,
			yaw: this.yaw,
			sprint: controls.sprint,
			crouch: controls.crouch,
			jump: controls.jump,
			rise: controls.rise,
		};
		this.lastInput = input;
		const modifiers: MovementModifiers = {
			speedFactor: context.speedFactor,
			gravityFactor: context.gravityFactor,
			externalVelocity: { x: context.pull.x, z: context.pull.z },
			sprintAllowed: context.sprintAllowed,
			fly: context.devModes.fly,
			passThrough: context.devModes.passThrough,
		};
		this.accumulator = Math.min(this.accumulator + dt, STEP * MAX_STEPS);
		if (input.jump) {
			if (context.jumpAllowed) {
				this.jumpAssist.press();
			} else {
				this.events.push({ kind: "tired", speed: 0 });
			}
		}
		while (this.accumulator >= STEP) {
			Object.assign(this.previous, this.character);
			const wasGrounded = this.character.grounded;
			const fallSpeed = -this.character.vy;
			const jump = this.jumpAssist.request(this.character);
			stepCharacter(
				this.world,
				this.character,
				{ ...input, ...jump },
				modifiers,
				STEP,
			);
			this.jumpAssist.settle(this.character, STEP);
			if (jump.jump) {
				this.jumps += 1;
				this.events.push({ kind: "jump", speed: 0 });
			} else if (!wasGrounded && this.character.grounded) {
				this.events.push({ kind: "land", speed: fallSpeed });
			}
			this.accumulator -= STEP;
		}
	}

	private updateGhost(
		dt: number,
		controls: LocalControls,
		bounds: GhostBounds,
	): void {
		Object.assign(this.previous, this.character);
		let forward = clamp(controls.forward, -1, 1);
		let strafe = clamp(controls.strafe, -1, 1);
		const length = Math.hypot(forward, strafe);
		if (length > 1) {
			forward /= length;
			strafe /= length;
		}
		const speed = controls.sprint ? GHOST_FAST_SPEED : GHOST_SPEED;
		const world = rotate2({ x: strafe, z: -forward }, -this.yaw);
		const blend = Math.min(1, dt * 7);
		this.character.vx += (world.x * speed - this.character.vx) * blend;
		this.character.vz += (world.z * speed - this.character.vz) * blend;
		this.character.vy +=
			(clamp(controls.rise, -1, 1) * GHOST_VERTICAL_SPEED - this.character.vy) *
			blend;
		const wanted = {
			x: this.character.x + this.character.vx * dt,
			y: this.character.y + this.character.vy * dt,
			z: this.character.z + this.character.vz * dt,
		};
		const kept = clampToGhostBounds(wanted, bounds);
		if (
			Math.hypot(kept.x - wanted.x, kept.y - wanted.y, kept.z - wanted.z) >
				0.001 &&
			this.time - this.boundsWarnedAt > 3
		) {
			this.boundsWarnedAt = this.time;
			this.events.push({ kind: "bounds", speed: 0 });
		}
		this.character.x = kept.x;
		this.character.y = kept.y;
		this.character.z = kept.z;
		this.character.grounded = false;
		this.character.crouch = 0;
		this.cameraY = kept.y + EYE_HEIGHT_STANDING;
		this.lastInput = {
			forward: controls.forward,
			strafe: controls.strafe,
			yaw: this.yaw,
			sprint: false,
			crouch: false,
			jump: false,
		};
	}

	private updateLook(controls: LocalControls, context: LocalContext): void {
		const scale = MOUSE_LOOK_SCALE * context.sensitivity;
		this.yaw -= controls.lookX * scale;
		this.pitch -= controls.lookY * scale * (context.invertY ? -1 : 1);
		this.pitch = clamp(this.pitch, -1.45, 1.45);
		if (context.hideInterior) {
			const offset = Math.atan2(
				Math.sin(this.yaw - context.hideFacing),
				Math.cos(this.yaw - context.hideFacing),
			);
			this.yaw = context.hideFacing + clamp(offset, -1.0, 1.0);
			this.pitch = clamp(this.pitch, -0.55, 0.45);
		}
	}

	private updateForced(): void {
		const forced = this.forced as ForcedAnimation;
		const t =
			forced.duration <= 0
				? 1
				: Math.min(1, (this.time - forced.start) / forced.duration);
		const thrown = forced.kind === "throw";
		const eased = thrown ? t * t * (3 - 2 * t) : 1 - (1 - t) * (1 - t);
		this.character.x = lerp(forced.from.x, forced.to.x, eased);
		this.character.y =
			lerp(forced.from.y, forced.to.y, eased) +
			(thrown ? Math.sin(Math.PI * t) * 1.2 : 0);
		this.character.z = lerp(forced.from.z, forced.to.z, eased);
		this.character.vx = 0;
		this.character.vz = 0;
		Object.assign(this.previous, this.character);
		if (t >= 1) {
			this.teleport(forced.to);
		}
	}

	eyePosition(context: LocalContext, dt: number): Vec3 {
		if (!context.alive && context.ghost && !this.forced) {
			return {
				x: this.character.x,
				y: this.character.y + EYE_HEIGHT_STANDING,
				z: this.character.z,
			};
		}
		if (context.hideInterior && !this.forced) {
			this.cameraY = context.hideInterior.y;
			return { ...context.hideInterior };
		}
		const alpha = this.accumulator / STEP;
		const x = lerp(this.previous.x, this.character.x, alpha);
		const z = lerp(this.previous.z, this.character.z, alpha);
		const y = lerp(this.previous.y, this.character.y, alpha);
		const eye = EYE_HEIGHT_STANDING - CROUCH_EYE_DROP * this.character.crouch;
		let target = y + eye;
		if (this.deathTilt > 0) {
			target = y + lerp(eye, 0.35, this.deathTilt);
		}
		if (context.carriedAnchor) {
			target = context.carriedAnchor.y + 1.9;
		}
		const gap = target - this.cameraY;
		if (Math.abs(gap) > 0.7 || !this.character.grounded) {
			this.cameraY = target;
		} else {
			this.cameraY += gap * (1 - Math.exp(-dt * 16));
		}
		return { x, y: this.cameraY, z };
	}

	get deathRoll(): number {
		return this.deathTilt * 1.1;
	}

	get speed(): number {
		return Math.hypot(this.character.vx, this.character.vz);
	}

	sprinting(context: LocalContext): boolean {
		return isSprinting(
			this.lastInput,
			{
				speedFactor: 1,
				externalVelocity: { x: 0, z: 0 },
				sprintAllowed: context.sprintAllowed,
			},
			this.character,
		);
	}
}
