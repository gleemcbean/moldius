import { describe, expect, it } from "vitest";
import { MatchPlayer } from "../server/game/MatchPlayer.js";
import { stepEnergy } from "../server/game/systems/energy.js";
import {
	CROUCH_SPEED,
	EYE_HEIGHT_STANDING,
	MAX_FALL_SPEED,
	SPRINT_SPEED,
	WALK_SPEED,
} from "../shared/config/index.js";
import type { FurnitureCollider } from "../shared/manor/types.js";
import { rotate2 } from "../shared/math.js";
import {
	type CharacterInput,
	type CharacterState,
	COYOTE_SECONDS,
	createCharacterState,
	DEFAULT_MODIFIERS,
	JUMP_BUFFER_SECONDS,
	JumpAssist,
	stepCharacter,
} from "../shared/physics/character.js";
import { CollisionWorld } from "../shared/physics/collisionWorld.js";
import { PLAYER_FLAG } from "../shared/protocol/game.js";
import { allFixtures, SEEDS } from "./helpers/manorFixtures.js";
import {
	findClearLine,
	placeBot,
	silenceAnomalies,
} from "./helpers/scenarios.js";
import { MatchSimulation } from "./helpers/simulation.js";

function input(partial: Partial<CharacterInput> = {}): CharacterInput {
	return {
		forward: 0,
		strafe: 0,
		yaw: 0,
		sprint: false,
		crouch: false,
		jump: false,
		...partial,
	};
}

function simulate(
	world: CollisionWorld,
	state: CharacterState,
	control: CharacterInput,
	seconds: number,
	dt = 1 / 60,
): void {
	for (let time = 0; time < seconds; time += dt) {
		stepCharacter(world, state, control, DEFAULT_MODIFIERS, dt);
	}
}

interface JumpCase {
	world: CollisionWorld;
	collider: FurnitureCollider;
	start: { x: number; y: number; z: number };
	yaw: number;
}

function jumpCases(): JumpCase[] {
	const cases: JumpCase[] = [];
	for (const fixture of allFixtures(SEEDS.slice(0, 4))) {
		const world = new CollisionWorld(fixture.layout);
		for (const item of fixture.layout.furniture) {
			if (item.level !== 0 || item.colliders.length !== 1) {
				continue;
			}
			const collider = item.colliders[0];
			const height = collider.yMax - collider.yMin;
			if (
				!collider.walkable ||
				height < 0.6 ||
				height > 1 ||
				collider.hx < 0.45 ||
				collider.hz < 0.45
			) {
				continue;
			}
			for (const side of [0, 1, 2, 3]) {
				const local =
					side === 0
						? { x: 0, z: 1 }
						: side === 1
							? { x: 0, z: -1 }
							: side === 2
								? { x: 1, z: 0 }
								: { x: -1, z: 0 };
				const extent = side < 2 ? collider.hz : collider.hx;
				const direction = rotate2(local, collider.rotation);
				const start = {
					x: collider.cx + direction.x * (extent + 1.4),
					y: item.y,
					z: collider.cz + direction.z * (extent + 1.4),
				};
				if (
					world.regionAt({ x: start.x, z: start.z }, start.y) === null ||
					world.distanceToWalls(start, start.y, start.y + 2, 1) < 0.6
				) {
					continue;
				}
				const yaw = Math.atan2(direction.x, direction.z);
				cases.push({ world, collider, start, yaw });
				break;
			}
		}
	}
	return cases;
}

function openGround(): { x: number; y: number; z: number } {
	const { grid, finder } = fixture;
	for (let node = 0; node < grid.cellsPerLevel; node += 1) {
		if (!grid.walkable[node] || !grid.isInMainComponent(node)) {
			continue;
		}
		const point = grid.nodePosition(node);
		const ahead = { x: point.x, y: point.y, z: point.z - 4 };
		const roomId = world.regionAt(point, point.y)?.roomId;
		const tall = roomId != null && fixture.layout.rooms[roomId].height >= 3.4;
		if (tall && point.y === 0 && finder.walkableLine(point, ahead, 0)) {
			const clear = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].every(
				(distance) =>
					world.distanceToWalls(
						{ x: point.x, z: point.z - distance },
						0.1,
						2,
						1,
					) > 0.45,
			);
			if (clear && world.distanceToWalls(point, 0.1, 2, 1) > 0.6) {
				return point;
			}
		}
	}
	throw new Error("Aucun sol dégagé");
}

const fixture = allFixtures(SEEDS.slice(0, 1))[0];
const world = new CollisionWorld(fixture.layout);

describe("déplacements du joueur", () => {
	const origin = openGround();
	const room = { labelPoint: { x: origin.x, z: origin.z }, floorY: origin.y };

	it("respecte les vitesses de marche, sprint et accroupi", () => {
		for (const [control, expected] of [
			[input({ forward: 1 }), WALK_SPEED],
			[input({ forward: 1, sprint: true }), SPRINT_SPEED],
			[input({ forward: 1, crouch: true }), CROUCH_SPEED],
		] as const) {
			const state = createCharacterState(
				room.labelPoint.x,
				room.floorY,
				room.labelPoint.z,
			);
			simulate(world, state, control, 0.6);
			expect(Math.hypot(state.vx, state.vz)).toBeCloseTo(expected, 1);
		}
	});

	it("anime l'accroupissement progressivement", () => {
		const state = createCharacterState(
			room.labelPoint.x,
			room.floorY,
			room.labelPoint.z,
		);
		stepCharacter(
			world,
			state,
			input({ crouch: true }),
			DEFAULT_MODIFIERS,
			1 / 60,
		);
		expect(state.crouch).toBeGreaterThan(0);
		expect(state.crouch).toBeLessThan(1);
		simulate(world, state, input({ crouch: true }), 1);
		expect(state.crouch).toBe(1);
		simulate(world, state, input(), 1);
		expect(state.crouch).toBe(0);
	});

	it("saute à 5,2 m/s et retombe au sol sous une gravité de 12", () => {
		const state = createCharacterState(
			room.labelPoint.x,
			room.floorY,
			room.labelPoint.z,
		);
		stepCharacter(
			world,
			state,
			input({ jump: true }),
			DEFAULT_MODIFIERS,
			1 / 120,
		);
		expect(state.grounded).toBe(false);
		let apex = state.y;
		for (let step = 0; step < 240; step += 1) {
			stepCharacter(world, state, input(), DEFAULT_MODIFIERS, 1 / 120);
			apex = Math.max(apex, state.y);
		}
		expect(apex - room.floorY).toBeCloseTo((5.2 * 5.2) / (2 * 12), 1);
		expect(state.grounded).toBe(true);
		expect(state.y).toBeCloseTo(room.floorY, 3);
	});

	it("monte sur des tables basses en sautant puis tombe continûment en quittant le support", () => {
		const cases = jumpCases();
		expect(cases.length).toBeGreaterThan(3);
		let landed = 0;
		for (const { world: caseWorld, collider, start, yaw } of cases.slice(
			0,
			25,
		)) {
			const state = createCharacterState(start.x, start.y, start.z);
			const forward = input({ forward: 1, yaw });
			let jumped = false;
			for (let step = 0; step < 150; step += 1) {
				const distance = Math.hypot(
					state.x - collider.cx,
					state.z - collider.cz,
				);
				const jump: boolean =
					!jumped && distance < Math.max(collider.hx, collider.hz) + 1.0;
				jumped ||= jump;
				stepCharacter(
					caseWorld,
					state,
					{
						...forward,
						jump,
						forward:
							Math.hypot(state.x - collider.cx, state.z - collider.cz) > 0.2
								? 1
								: 0,
					},
					DEFAULT_MODIFIERS,
					1 / 60,
				);
			}
			if (Math.abs(state.y - collider.yMax) > 0.05 || !state.grounded) {
				continue;
			}
			const top = state.y;
			const heights: number[] = [state.y];
			for (let step = 0; step < 120; step += 1) {
				stepCharacter(
					caseWorld,
					state,
					input({ forward: 1, yaw }),
					DEFAULT_MODIFIERS,
					1 / 60,
				);
				heights.push(state.y);
			}
			if (heights[heights.length - 1] > top - 0.2) {
				continue;
			}
			landed += 1;
			expect(state.grounded).toBe(true);
			for (let index = 1; index < heights.length; index += 1) {
				const drop = heights[index - 1] - heights[index];
				expect(drop).toBeGreaterThanOrEqual(-0.37);
				expect(drop).toBeLessThanOrEqual(MAX_FALL_SPEED / 60 + 0.37);
			}
			const falling = heights.filter(
				(height, index) => index > 0 && height < heights[index - 1] - 1e-4,
			).length;
			expect(falling).toBeGreaterThan(5);
		}
		expect(landed).toBeGreaterThanOrEqual(3);
	});

	it("les murs bloquent le joueur", () => {
		const state = createCharacterState(
			room.labelPoint.x,
			room.floorY,
			room.labelPoint.z,
		);
		simulate(world, state, input({ forward: 1, sprint: true, yaw: 0 }), 12);
		expect(
			world.roomAt({ x: state.x, z: state.z }, state.y) ??
				world.regionAt({ x: state.x, z: state.z }, state.y),
		).not.toBeNull();
		expect(state.y + EYE_HEIGHT_STANDING).toBeGreaterThan(room.floorY);
	});
});

describe("énergie et cadence", () => {
	it("donne le même résultat à 20, 30, 60 et 144 images par seconde", () => {
		const results = [30, 60, 144, 20].map((rate) => {
			const player = new MatchPlayer(
				"p",
				"P",
				0,
				{ x: 0, y: 0, z: 0, yaw: 0 },
				0,
			);
			player.sprintIntent = true;
			player.moveInput = true;
			player.lanternOpen = true;
			for (let frame = 0; frame < rate * 3; frame += 1) {
				stepEnergy(player, 1 / rate);
			}
			return player.energy;
		});
		for (const value of results) {
			expect(value).toBeCloseTo(results[0], 6);
		}
	});
});

describe("saut", () => {
	const grounded = () => {
		const state = createCharacterState(0, 0, 0);
		state.grounded = true;
		return state;
	};

	it("garde un appui un court instant pour sauter dès l'atterrissage", () => {
		const assist = new JumpAssist();
		const state = grounded();
		state.grounded = false;
		state.vy = -2;
		assist.settle(state, 0.5);
		assist.press();
		expect(assist.request(state).jump).toBe(false);
		assist.settle(state, 0.08);
		state.grounded = true;
		state.vy = 0;
		expect(assist.request(state).jump).toBe(true);
		expect(assist.request(state).jump).toBe(false);
	});

	it("oublie un appui trop ancien", () => {
		const assist = new JumpAssist();
		const state = grounded();
		state.grounded = false;
		assist.settle(state, 0.5);
		assist.press();
		assist.settle(state, JUMP_BUFFER_SECONDS + 0.05);
		state.grounded = true;
		expect(assist.request(state).jump).toBe(false);
	});

	it("laisse sauter juste après avoir quitté le sol en courant", () => {
		const assist = new JumpAssist();
		const state = grounded();
		assist.settle(state, 1 / 120);
		state.grounded = false;
		state.vy = -0.5;
		assist.settle(state, COYOTE_SECONDS / 2);
		assist.press();
		expect(assist.request(state)).toEqual({ jump: true, coyote: true });
		const later = new JumpAssist();
		later.settle(state, COYOTE_SECONDS * 3);
		later.press();
		expect(later.request(state).jump).toBe(false);
	});

	it("saute à chaque appui sur un sol plat même à pleine course", () => {
		const world = new CollisionWorld(allFixtures([SEEDS[0]])[0].layout);
		const room = world.layout.rooms.find(
			(candidate) =>
				candidate.level === 0 &&
				candidate.type !== "stairwell" &&
				candidate.area > 30,
		);
		if (!room) {
			throw new Error("No room found for the test.");
		}
		const state = createCharacterState(
			room.labelPoint.x,
			room.floorY,
			room.labelPoint.z,
		);
		const assist = new JumpAssist();
		const input = {
			forward: 1,
			strafe: 0,
			yaw: 0,
			sprint: true,
			crouch: false,
			jump: false,
		};
		let jumps = 0;
		for (let frame = 0; frame < 480; frame += 1) {
			if (frame % 120 === 0) {
				assist.press();
			}
			const request = assist.request(state);
			stepCharacter(
				world,
				state,
				{ ...input, ...request },
				DEFAULT_MODIFIERS,
				1 / 120,
			);
			assist.settle(state, 1 / 120);
			if (request.jump) {
				jumps += 1;
			}
		}
		expect(jumps).toBe(4);
	});
});

describe("saut vu par les autres joueurs", () => {
	it("les instantanés portent la hauteur du saut et le drapeau en l'air", () => {
		const sim = new MatchSimulation({ seed: 4242, players: 2 });
		silenceAnomalies(sim);
		const line = findClearLine(sim, 4);
		placeBot(sim, "p1", line.origin, line.yaw);
		const bot = sim.bot("p1");
		const floor = line.origin.y;
		let peak = 0;
		let airborne = 0;
		let tick = 0;
		sim.run(1.5, () => {
			tick += 1;
			bot.input.jump = tick === 3;
			const snapshot = sim.match
				.snapshot()
				.players.find((player) => player.id === "p1");
			if (!snapshot) {
				return;
			}
			peak = Math.max(peak, snapshot.y - floor);
			if ((snapshot.flags & PLAYER_FLAG.airborne) !== 0) {
				airborne += 1;
			}
		});
		expect(peak).toBeGreaterThan(1);
		expect(airborne).toBeGreaterThan(10);
		const landed = sim.match.snapshot().players.find((p) => p.id === "p1");
		expect((landed?.flags ?? 0) & PLAYER_FLAG.airborne).toBe(0);
	});
});
