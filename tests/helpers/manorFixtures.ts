import {
	generateManor,
	type ManorOptions,
} from "../../shared/manor/generateManor.js";
import { MAX_UPPER_FLOORS } from "../../shared/config/index.js";
import { spansLevelAbove } from "../../shared/manor/roomCatalog.js";
import type { ManorLayout, Room } from "../../shared/manor/types.js";
import {
	type ManorSize,
	PUBLIC_MATCH_CONFIG,
} from "../../shared/matchConfig.js";
import { NavGrid } from "../../shared/navigation/navGrid.js";
import { PathFinder } from "../../shared/navigation/pathfinding.js";
import { CollisionWorld } from "../../shared/physics/collisionWorld.js";

export interface ManorFixture {
	seed: number;
	size: ManorSize;
	floors: number;
	layout: ManorLayout;
	world: CollisionWorld;
	grid: NavGrid;
	finder: PathFinder;
}

const cache = new Map<string, ManorFixture>();

export function manorOptions(size: ManorSize, floors = 1): ManorOptions {
	return {
		...PUBLIC_MATCH_CONFIG,
		manorSize: size,
		upperFloorSize: size,
		floors,
	};
}

export function fixture(
	seed: number,
	size: ManorSize,
	floors = 1,
): ManorFixture {
	const key = `${seed}:${size}:${floors}`;
	const cached = cache.get(key);
	if (cached) {
		return cached;
	}
	const layout = generateManor(seed, manorOptions(size, floors));
	const world = new CollisionWorld(layout);
	const grid = new NavGrid(world);
	const created = {
		seed,
		size,
		floors,
		layout,
		world,
		grid,
		finder: new PathFinder(grid),
	};
	cache.set(key, created);
	return created;
}

export const SEEDS: readonly number[] = Array.from(
	{ length: 12 },
	(_, index) => 1009 + index * 7919,
);
export const SIZES: readonly ManorSize[] = ["small", "medium", "large"];

export function allFixtures(seeds: readonly number[] = SEEDS): ManorFixture[] {
	return seeds.flatMap((seed, index) => [
		fixture(seed, SIZES[index % SIZES.length], index % 4),
	]);
}

export function occupiedLevels(room: Room): number[] {
	if (room.style.ceiling === "glass") {
		return Array.from(
			{ length: MAX_UPPER_FLOORS - room.level + 1 },
			(_, index) => room.level + index,
		);
	}
	return spansLevelAbove(room.type, room.height)
		? [room.level, room.level + 1]
		: [room.level];
}

export function navComponents(fixture: ManorFixture): Int32Array {
	return fixture.grid.component;
}

export function mainComponent(fixture: ManorFixture): number {
	return fixture.grid.mainComponent;
}
