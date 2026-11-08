import {
	AIR_ACCELERATION,
	AIR_STEP_HEIGHT,
	CROUCH_SPEED,
	CROUCH_TRANSITION_SPEED,
	DEV_FLY_FAST_SPEED,
	DEV_FLY_SPEED,
	DEV_FLY_VERTICAL_SPEED,
	GRAVITY,
	GROUND_ACCELERATION,
	JUMP_VELOCITY,
	MAX_FALL_SPEED,
	PLAYER_HEAD_CLEARANCE,
	PLAYER_HEIGHT_CROUCHED,
	PLAYER_HEIGHT_STANDING,
	PLAYER_RADIUS,
	RAMP_STICK_DISTANCE,
	SPRINT_SPEED,
	STEP_UP_HEIGHT,
	WALK_SPEED,
} from "../config/index.js";
import { pointInPolygon } from "../manor/polygon.js";
import { clamp, closestPointOnSegment, rotate2, type Vec2 } from "../math.js";
import type { CollisionWorld } from "./collisionWorld.js";

export interface CharacterState {
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	grounded: boolean;
	crouch: number;
	onRamp: boolean;
}

export interface CharacterInput {
	forward: number;
	strafe: number;
	yaw: number;
	sprint: boolean;
	crouch: boolean;
	jump: boolean;
	coyote?: boolean;
	rise?: number;
}

export interface MovementModifiers {
	speedFactor: number;
	externalVelocity: Vec2;
	sprintAllowed: boolean;
	fly?: boolean;
	passThrough?: boolean;
	/** Multiplie la pesanteur : moins de 1 pour flotter. */
	gravityFactor?: number;
}

export const DEFAULT_MODIFIERS: MovementModifiers = {
	speedFactor: 1,
	externalVelocity: { x: 0, z: 0 },
	sprintAllowed: true,
};

export const JUMP_BUFFER_SECONDS = 0.15;
export const COYOTE_SECONDS = 0.12;

export class JumpAssist {
	private buffered = 0;
	private airborne = 0;

	press(): void {
		this.buffered = JUMP_BUFFER_SECONDS;
	}

	request(state: CharacterState): { jump: boolean; coyote: boolean } {
		const coyote =
			!state.grounded && state.vy <= 0 && this.airborne <= COYOTE_SECONDS;
		const jump =
			this.buffered > 0 && state.crouch < 0.6 && (state.grounded || coyote);
		if (jump) {
			this.buffered = 0;
			this.airborne = Infinity;
		}
		return { jump, coyote: jump && !state.grounded };
	}

	settle(state: CharacterState, dt: number): void {
		this.buffered = Math.max(0, this.buffered - dt);
		this.airborne = state.grounded ? 0 : this.airborne + dt;
	}
}

export function createCharacterState(
	x: number,
	y: number,
	z: number,
): CharacterState {
	return {
		x,
		y,
		z,
		vx: 0,
		vy: 0,
		vz: 0,
		grounded: true,
		crouch: 0,
		onRamp: false,
	};
}

export function clearanceHeight(state: CharacterState): number {
	return Math.min(characterHeight(state), PLAYER_HEAD_CLEARANCE);
}

export function characterHeight(state: CharacterState): number {
	return (
		PLAYER_HEIGHT_STANDING +
		(PLAYER_HEIGHT_CROUCHED - PLAYER_HEIGHT_STANDING) * state.crouch
	);
}

export function isSprinting(
	input: CharacterInput,
	modifiers: MovementModifiers,
	state: CharacterState,
): boolean {
	const moving =
		Math.abs(input.forward) > 0.01 || Math.abs(input.strafe) > 0.01;
	return (
		input.sprint &&
		moving &&
		modifiers.sprintAllowed &&
		state.crouch < 0.5 &&
		input.forward > -0.2
	);
}

export function targetSpeed(
	input: CharacterInput,
	modifiers: MovementModifiers,
	state: CharacterState,
): number {
	const base =
		state.crouch > 0.5
			? CROUCH_SPEED
			: isSprinting(input, modifiers, state)
				? SPRINT_SPEED
				: WALK_SPEED;
	return base * modifiers.speedFactor;
}

export function stepCharacter(
	world: CollisionWorld,
	state: CharacterState,
	input: CharacterInput,
	modifiers: MovementModifiers,
	dt: number,
): void {
	if (modifiers.fly) {
		stepFlying(world, state, input, modifiers, dt);
		return;
	}
	updateCrouch(world, state, input, dt);
	updateHorizontalVelocity(state, input, modifiers, dt);

	const external = modifiers.externalVelocity;
	state.x += (state.vx + external.x) * dt;
	state.z += (state.vz + external.z) * dt;
	if (!modifiers.passThrough) {
		resolveHorizontal(world, state, dt);
	}

	if (input.jump && (state.grounded || input.coyote) && state.crouch < 0.6) {
		state.vy = JUMP_VELOCITY;
		state.grounded = false;
	}
	updateVertical(
		world,
		state,
		dt,
		modifiers.passThrough ?? false,
		modifiers.gravityFactor ?? 1,
	);
}

function stepFlying(
	world: CollisionWorld,
	state: CharacterState,
	input: CharacterInput,
	modifiers: MovementModifiers,
	dt: number,
): void {
	state.crouch = Math.max(0, state.crouch - CROUCH_TRANSITION_SPEED * dt);
	const speed = input.sprint ? DEV_FLY_FAST_SPEED : DEV_FLY_SPEED;
	state.grounded = true;
	updateHorizontalVelocity(
		state,
		{ ...input, sprint: false },
		{ ...modifiers, speedFactor: speed / WALK_SPEED },
		dt,
	);
	state.vy = clamp(input.rise ?? 0, -1, 1) * DEV_FLY_VERTICAL_SPEED;
	state.x += state.vx * dt;
	state.z += state.vz * dt;
	state.y += state.vy * dt;
	state.grounded = false;
	state.onRamp = false;
	if (modifiers.passThrough) {
		return;
	}
	resolveHorizontal(world, state, dt);
	const support = supportHeight(world, state.x, state.z, state.y, 0);
	if (support.height !== null && state.y < support.height) {
		state.y = support.height;
		state.grounded = true;
	}
	const ceiling = world.ceilingAt(
		{ x: state.x, z: state.z },
		PLAYER_RADIUS,
		state.y,
	);
	const height = characterHeight(state);
	if (state.y + height > ceiling) {
		state.y = ceiling - height;
	}
}

function updateCrouch(
	world: CollisionWorld,
	state: CharacterState,
	input: CharacterInput,
	dt: number,
): void {
	const wantsCrouch = input.crouch;
	if (wantsCrouch) {
		state.crouch = Math.min(1, state.crouch + CROUCH_TRANSITION_SPEED * dt);
		return;
	}
	if (state.crouch <= 0) {
		return;
	}
	const ceiling = world.ceilingAt(
		{ x: state.x, z: state.z },
		PLAYER_RADIUS,
		state.y,
	);
	const next = Math.max(0, state.crouch - CROUCH_TRANSITION_SPEED * dt);
	const nextHeight =
		PLAYER_HEIGHT_STANDING +
		(PLAYER_HEIGHT_CROUCHED - PLAYER_HEIGHT_STANDING) * next;
	if (
		state.y + nextHeight <= ceiling - 0.02 &&
		!headBlockedByBoxes(world, state, nextHeight)
	) {
		state.crouch = next;
	}
}

function headBlockedByBoxes(
	world: CollisionWorld,
	state: CharacterState,
	height: number,
): boolean {
	const radius = PLAYER_RADIUS - 0.05;
	const bounds = {
		minX: state.x - radius,
		maxX: state.x + radius,
		minZ: state.z - radius,
		maxZ: state.z + radius,
	};
	for (const id of world.queryBoxes(bounds)) {
		const box = world.boxes[id];
		if (
			!box.enabled ||
			box.yMin <= state.y + 0.2 ||
			box.yMin >= state.y + height
		) {
			continue;
		}
		if (circleBoxPenetration(state.x, state.z, radius, box)) {
			return true;
		}
	}
	return false;
}

function updateHorizontalVelocity(
	state: CharacterState,
	input: CharacterInput,
	modifiers: MovementModifiers,
	dt: number,
): void {
	let forward = clamp(input.forward, -1, 1);
	let strafe = clamp(input.strafe, -1, 1);
	const length = Math.hypot(forward, strafe);
	if (length > 1) {
		forward /= length;
		strafe /= length;
	}
	const speed = targetSpeed(input, modifiers, state);
	const local = { x: strafe, z: -forward };
	const world = rotate2(local, -input.yaw);
	const desiredX = world.x * speed;
	const desiredZ = world.z * speed;
	const acceleration = state.grounded ? GROUND_ACCELERATION : AIR_ACCELERATION;
	const maxDelta = acceleration * dt;
	const deltaX = desiredX - state.vx;
	const deltaZ = desiredZ - state.vz;
	const deltaLength = Math.hypot(deltaX, deltaZ);
	if (deltaLength <= maxDelta || deltaLength < 1e-6) {
		state.vx = desiredX;
		state.vz = desiredZ;
	} else {
		state.vx += (deltaX / deltaLength) * maxDelta;
		state.vz += (deltaZ / deltaLength) * maxDelta;
	}
}

export function resolveHorizontal(
	world: CollisionWorld,
	state: CharacterState,
	dt: number,
): void {
	const height = clearanceHeight(state);
	const allowance = state.grounded ? STEP_UP_HEIGHT : AIR_STEP_HEIGHT;
	for (let iteration = 0; iteration < 4; iteration += 1) {
		let moved = false;
		const radius = PLAYER_RADIUS;
		const bounds = {
			minX: state.x - radius - 0.1,
			maxX: state.x + radius + 0.1,
			minZ: state.z - radius - 0.1,
			maxZ: state.z + radius + 0.1,
		};
		for (const id of world.queryWalls(bounds)) {
			const wall = world.walls[id];
			if (wall.yMax <= state.y + allowance || wall.yMin >= state.y + height) {
				continue;
			}
			const closest = closestPointOnSegment(
				{ x: state.x, z: state.z },
				wall.a,
				wall.b,
			);
			const dx = state.x - closest.x;
			const dz = state.z - closest.z;
			const distance = Math.hypot(dx, dz);
			if (distance >= radius) {
				continue;
			}
			const normal =
				distance > 1e-5
					? { x: dx / distance, z: dz / distance }
					: wallNormal(wall.a, wall.b);
			const push = radius - distance;
			state.x += normal.x * push;
			state.z += normal.z * push;
			removeVelocityInto(state, normal);
			moved = true;
		}
		for (const id of world.queryBoxes(bounds)) {
			const box = world.boxes[id];
			if (
				!box.enabled ||
				box.yMax <= state.y + allowance ||
				box.yMin >= state.y + height
			) {
				continue;
			}
			const penetration = circleBoxPenetration(state.x, state.z, radius, box);
			if (!penetration) {
				continue;
			}
			const limit = box.soft
				? Math.min(penetration.depth, 2.8 * dt)
				: penetration.depth;
			state.x += penetration.normal.x * limit;
			state.z += penetration.normal.z * limit;
			removeVelocityInto(state, penetration.normal);
			moved = true;
		}
		if (!moved) {
			return;
		}
	}
}

function wallNormal(a: Vec2, b: Vec2): Vec2 {
	const length = Math.hypot(b.x - a.x, b.z - a.z);
	return { x: -(b.z - a.z) / length, z: (b.x - a.x) / length };
}

function removeVelocityInto(state: CharacterState, normal: Vec2): void {
	const dot = state.vx * normal.x + state.vz * normal.z;
	if (dot < 0) {
		state.vx -= normal.x * dot;
		state.vz -= normal.z * dot;
	}
}

export function circleBoxPenetration(
	x: number,
	z: number,
	radius: number,
	box: { cx: number; cz: number; hx: number; hz: number; rotation: number },
): { normal: Vec2; depth: number } | null {
	const local = rotate2({ x: x - box.cx, z: z - box.cz }, -box.rotation);
	const clampedX = clamp(local.x, -box.hx, box.hx);
	const clampedZ = clamp(local.z, -box.hz, box.hz);
	const dx = local.x - clampedX;
	const dz = local.z - clampedZ;
	const distanceSq = dx * dx + dz * dz;
	if (distanceSq > 1e-10) {
		if (distanceSq >= radius * radius) {
			return null;
		}
		const distance = Math.sqrt(distanceSq);
		const normal = rotate2(
			{ x: dx / distance, z: dz / distance },
			box.rotation,
		);
		return { normal, depth: radius - distance };
	}
	const exitX = box.hx - Math.abs(local.x);
	const exitZ = box.hz - Math.abs(local.z);
	const localNormal =
		exitX < exitZ
			? { x: Math.sign(local.x) || 1, z: 0 }
			: { x: 0, z: Math.sign(local.z) || 1 };
	return {
		normal: rotate2(localNormal, box.rotation),
		depth: Math.min(exitX, exitZ) + radius,
	};
}

function updateVertical(
	world: CollisionWorld,
	state: CharacterState,
	dt: number,
	passThrough: boolean,
	gravityFactor: number,
): void {
	const wasGrounded = state.grounded;
	state.vy = Math.max(-MAX_FALL_SPEED, state.vy - GRAVITY * gravityFactor * dt);
	const nextY = state.y + state.vy * dt;
	const rising = state.vy > 0;
	const tolerance = wasGrounded ? STEP_UP_HEIGHT : AIR_STEP_HEIGHT;
	const support = supportHeight(
		world,
		state.x,
		state.z,
		Math.max(state.y, nextY),
		tolerance,
	);
	state.onRamp = support.ramp;

	if (
		rising &&
		support.ramp &&
		support.height !== null &&
		nextY <= support.height
	) {
		state.y = support.height;
		state.grounded = false;
	} else if (!rising && support.height !== null && nextY <= support.height) {
		state.y = support.height;
		state.vy = 0;
		state.grounded = true;
	} else if (
		support.height !== null &&
		wasGrounded &&
		state.vy <= 0 &&
		support.ramp &&
		state.y - support.height <= RAMP_STICK_DISTANCE
	) {
		state.y = support.height;
		state.vy = 0;
		state.grounded = true;
	} else if (passThrough && support.height === null) {
		state.vy = 0;
		state.grounded = true;
		return;
	} else {
		state.y = nextY;
		state.grounded = false;
	}
	if (passThrough) {
		return;
	}

	const ceiling = world.ceilingAt(
		{ x: state.x, z: state.z },
		PLAYER_RADIUS,
		state.y,
	);
	const height = clearanceHeight(state);
	if (state.y + height > ceiling) {
		state.y = Math.max(ceiling - height, support.height ?? state.y);
		state.vy = Math.min(0, state.vy);
	}
}

export function supportHeight(
	world: CollisionWorld,
	x: number,
	z: number,
	feetY: number,
	tolerance: number,
): { height: number | null; ramp: boolean } {
	const point = { x, z };
	let best: number | null = null;
	let ramp = false;
	for (const region of world.regionsAt(point)) {
		const floor = world.regionFloorY(region, point);
		if (
			floor <= feetY + tolerance &&
			feetY < region.ceilingY &&
			(best === null || floor > best)
		) {
			best = floor;
			ramp = region.stair !== null;
		}
	}
	const footRadius = 0.18;
	const bounds = {
		minX: x - footRadius,
		maxX: x + footRadius,
		minZ: z - footRadius,
		maxZ: z + footRadius,
	};
	for (const id of world.queryBoxes(bounds)) {
		const box = world.boxes[id];
		if (
			!box.enabled ||
			box.yMax > feetY + tolerance ||
			(best !== null && box.yMax <= best)
		) {
			continue;
		}
		if (circleBoxPenetration(x, z, footRadius, box)) {
			best = box.yMax;
			ramp = false;
		}
	}
	return { height: best, ramp };
}

export function findSafeFloorPoint(
	world: CollisionWorld,
	point: Vec2,
	feetY: number,
): boolean {
	return world
		.regionsAt(point)
		.some(
			(region) =>
				pointInPolygon(point, region.polygon) &&
				Math.abs(region.floorY - feetY) < 2,
		);
}
