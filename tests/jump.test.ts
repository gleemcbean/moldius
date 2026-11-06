import { describe, expect, it } from "vitest";
import { generateManor } from "../shared/manor/generateManor.js";
import { TUTORIAL_MATCH_CONFIG, TUTORIAL_SEED } from "../shared/matchConfig.js";
import { NavGrid } from "../shared/navigation/navGrid.js";
import {
	type CharacterInput,
	createCharacterState,
	DEFAULT_MODIFIERS,
	stepCharacter,
} from "../shared/physics/character.js";
import { CollisionWorld } from "../shared/physics/collisionWorld.js";

const STEP = 1 / 60;
const FULL_JUMP = 0.75;

function input(overrides: Partial<CharacterInput> = {}): CharacterInput {
	return {
		forward: 0,
		strafe: 0,
		yaw: 0,
		sprint: false,
		crouch: false,
		jump: false,
		...overrides,
	};
}

function jumpHeight(
	world: CollisionWorld,
	point: { x: number; y: number; z: number },
	moving: Partial<CharacterInput>,
): number | null {
	const state = createCharacterState(point.x, point.y, point.z);
	for (let step = 0; step < 12; step += 1) {
		stepCharacter(world, state, input(moving), DEFAULT_MODIFIERS, STEP);
	}
	if (!state.grounded) {
		return null;
	}
	const start = state.y;
	stepCharacter(
		world,
		state,
		input({ ...moving, jump: true }),
		DEFAULT_MODIFIERS,
		STEP,
	);
	let peak = state.y;
	for (let step = 0; step < 34; step += 1) {
		stepCharacter(world, state, input(moving), DEFAULT_MODIFIERS, STEP);
		peak = Math.max(peak, state.y);
	}
	return peak - start;
}

describe("saut", () => {
	const layout = generateManor(TUTORIAL_SEED, TUTORIAL_MATCH_CONFIG);
	const world = new CollisionWorld(layout);
	const grid = new NavGrid(world);
	const spots: { x: number; y: number; z: number }[] = [];
	for (let node = 0; node < grid.cellsPerLevel * grid.levelCount; node += 3) {
		if (grid.walkable[node] && grid.isInMainComponent(node)) {
			spots.push(grid.nodePosition(node));
		}
	}

	it("décolle franchement partout, même près d'une porte ou dans un couloir bas", () => {
		const low = spots.filter((spot) => {
			const height = jumpHeight(world, spot, {});
			return height !== null && height < FULL_JUMP;
		});
		expect(low.length).toBeLessThan(spots.length * 0.005);
	});

	it("n'est pas coupé en marchant le long d'un meuble bas", () => {
		let total = 0;
		let low = 0;
		for (const spot of spots) {
			for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
				const height = jumpHeight(world, spot, { forward: 1, yaw });
				if (height !== null) {
					total += 1;
					low += height < FULL_JUMP ? 1 : 0;
				}
			}
		}
		expect(low / total).toBeLessThan(0.02);
	});
});
