import { NAV_AGENT_RADIUS, NAV_CELL_SIZE } from "../config/index.js";
import { levelForHeight } from "../manor/levels.js";
import type { Level, Opening } from "../manor/types.js";
import type { Vec2, Vec3 } from "../math.js";
import { circleBoxPenetration } from "../physics/character.js";
import type { CollisionWorld, FloorRegion } from "../physics/collisionWorld.js";

export interface PortalNode {
	x: number;
	y: number;
	z: number;
	openingId: number;
	doorId: number | null;
	role: "frontA" | "center" | "frontB";
	gridLevel: Level;
}

const NEIGHBOR_OFFSETS = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
	[1, 1],
	[1, -1],
	[-1, 1],
	[-1, -1],
] as const;

function acrossOpening(opening: Opening, point: Vec2): number {
	return (
		(point.x - opening.start.x) * opening.normal.x +
		(point.z - opening.start.z) * opening.normal.z
	);
}

export class NavGrid {
	readonly cellSize = NAV_CELL_SIZE;
	readonly originX: number;
	readonly originZ: number;
	readonly columns: number;
	readonly rows: number;
	readonly cellsPerLevel: number;
	readonly levelCount: number;
	readonly walkable: Uint8Array;
	readonly heights: Float32Array;
	readonly cellRoom: Int16Array;
	readonly portals: PortalNode[] = [];
	readonly links = new Map<number, number[]>();
	readonly roomCells = new Map<number, number[]>();
	readonly component: Int32Array;
	readonly mainComponent: number;

	constructor(readonly world: CollisionWorld) {
		const bounds = world.layout.bounds;
		this.originX = Math.floor(bounds.minX) - 1;
		this.originZ = Math.floor(bounds.minZ) - 1;
		this.columns = Math.ceil((bounds.maxX - this.originX + 1) / this.cellSize);
		this.rows = Math.ceil((bounds.maxZ - this.originZ + 1) / this.cellSize);
		this.cellsPerLevel = this.columns * this.rows;
		this.levelCount = Math.max(...world.layout.levels) + 1;
		this.walkable = new Uint8Array(this.cellsPerLevel * this.levelCount);
		this.heights = new Float32Array(this.cellsPerLevel * this.levelCount);
		this.cellRoom = new Int16Array(this.cellsPerLevel * this.levelCount).fill(
			-1,
		);
		const doorways = world.layout.openings.filter((opening) => opening.door);
		for (const level of this.gridLevels()) {
			this.buildLevel(level, doorways);
		}
		this.buildPortals();
		this.component = new Int32Array(this.nodeCount).fill(-1);
		this.mainComponent = this.labelComponents();
	}

	*neighbors(node: number): Generator<number> {
		const links = this.links.get(node);
		if (links) {
			yield* links;
		}
		if (this.isPortal(node)) {
			return;
		}
		const level = Math.floor(node / this.cellsPerLevel);
		const index = node - level * this.cellsPerLevel;
		const column = index % this.columns;
		const row = (index - column) / this.columns;
		const height = this.heights[node];
		for (const [dc, dr] of NEIGHBOR_OFFSETS) {
			const c = column + dc;
			const r = row + dr;
			if (c < 0 || r < 0 || c >= this.columns || r >= this.rows) {
				continue;
			}
			const neighbor = level * this.cellsPerLevel + r * this.columns + c;
			const stepDistance =
				dc !== 0 && dr !== 0 ? this.cellSize * Math.SQRT2 : this.cellSize;
			if (
				!this.walkable[neighbor] ||
				Math.abs(this.heights[neighbor] - height) > 0.12 + stepDistance
			) {
				continue;
			}
			if (dc !== 0 && dr !== 0) {
				const sideA = level * this.cellsPerLevel + row * this.columns + c;
				const sideB = level * this.cellsPerLevel + r * this.columns + column;
				if (!this.walkable[sideA] || !this.walkable[sideB]) {
					continue;
				}
			}
			yield neighbor;
		}
	}

	isInMainComponent(node: number): boolean {
		return this.component[node] === this.mainComponent;
	}

	private labelComponents(): number {
		const sizes: number[] = [];
		for (let start = 0; start < this.nodeCount; start += 1) {
			if (
				this.component[start] !== -1 ||
				(!this.isPortal(start) && !this.walkable[start])
			) {
				continue;
			}
			const label = sizes.length;
			let size = 0;
			const queue = [start];
			this.component[start] = label;
			while (queue.length > 0) {
				const node = queue.pop() as number;
				size += 1;
				for (const neighbor of this.neighbors(node)) {
					if (this.component[neighbor] === -1) {
						this.component[neighbor] = label;
						queue.push(neighbor);
					}
				}
			}
			sizes.push(size);
		}
		let best = 0;
		sizes.forEach((size, label) => {
			if (size > (sizes[best] ?? 0)) {
				best = label;
			}
		});
		return best;
	}

	get portalBase(): number {
		return this.cellsPerLevel * this.levelCount;
	}

	get nodeCount(): number {
		return this.portalBase + this.portals.length;
	}

	gridLevels(): Level[] {
		return Array.from(
			{ length: this.levelCount },
			(_, level) => level as Level,
		);
	}

	levelOfNode(node: number): Level {
		if (this.isPortal(node)) {
			return this.portalAt(node).gridLevel;
		}
		return Math.floor(node / this.cellsPerLevel) as Level;
	}

	levelForHeight(y: number, margin = 1.4): Level {
		return levelForHeight(y, this.levelCount - 1, margin);
	}

	isPortal(node: number): boolean {
		return node >= this.portalBase;
	}

	portalAt(node: number): PortalNode {
		return this.portals[node - this.portalBase];
	}

	nodePosition(node: number): Vec3 {
		if (this.isPortal(node)) {
			const portal = this.portalAt(node);
			return { x: portal.x, y: portal.y, z: portal.z };
		}
		const level = Math.floor(node / this.cellsPerLevel);
		const index = node - level * this.cellsPerLevel;
		const column = index % this.columns;
		const row = (index - column) / this.columns;
		return {
			x: this.originX + (column + 0.5) * this.cellSize,
			y: this.heights[node],
			z: this.originZ + (row + 0.5) * this.cellSize,
		};
	}

	cellNode(level: Level, point: Vec2): number | null {
		if (level >= this.levelCount) {
			return null;
		}
		const column = Math.floor((point.x - this.originX) / this.cellSize);
		const row = Math.floor((point.z - this.originZ) / this.cellSize);
		if (column < 0 || row < 0 || column >= this.columns || row >= this.rows) {
			return null;
		}
		return level * this.cellsPerLevel + row * this.columns + column;
	}

	nearestNode(position: Vec3, maxRadius = 5, mainOnly = true): number | null {
		let best: number | null = null;
		let bestScore = Infinity;
		for (const level of this.gridLevels()) {
			const center = this.cellNode(level, position);
			if (center === null) {
				continue;
			}
			const index = center - level * this.cellsPerLevel;
			const column = index % this.columns;
			const row = (index - column) / this.columns;
			for (let dr = -maxRadius; dr <= maxRadius; dr += 1) {
				for (let dc = -maxRadius; dc <= maxRadius; dc += 1) {
					const r = row + dr;
					const c = column + dc;
					if (r < 0 || c < 0 || r >= this.rows || c >= this.columns) {
						continue;
					}
					const node = level * this.cellsPerLevel + r * this.columns + c;
					if (
						!this.walkable[node] ||
						(mainOnly &&
							this.component &&
							this.component[node] !== this.mainComponent)
					) {
						continue;
					}
					const heightGap = Math.abs(this.heights[node] - position.y);
					if (heightGap > 1.3) {
						continue;
					}
					const score = Math.hypot(dr, dc) * this.cellSize + heightGap * 2;
					if (score < bestScore) {
						bestScore = score;
						best = node;
					}
				}
			}
		}
		return best;
	}

	isWalkablePoint(position: Vec3): boolean {
		const node = this.nearestNode(position, 0, true);
		return node !== null && Math.abs(this.heights[node] - position.y) < 0.5;
	}

	private buildLevel(level: Level, doorways: Opening[]): void {
		for (let row = 0; row < this.rows; row += 1) {
			for (let column = 0; column < this.columns; column += 1) {
				const point = {
					x: this.originX + (column + 0.5) * this.cellSize,
					z: this.originZ + (row + 0.5) * this.cellSize,
				};
				const region = this.regionForLevel(point, level);
				if (!region) {
					continue;
				}
				const node = level * this.cellsPerLevel + row * this.columns + column;
				const floor = this.world.regionFloorY(region, point);
				const height = this.surfaceHeight(point, floor);
				if (height === null) {
					continue;
				}
				if (
					doorways.some((opening) => this.inDoorway(opening, point, height))
				) {
					continue;
				}
				if (
					this.world.distanceToWalls(
						point,
						height + 0.3,
						height + 1.7,
						NAV_AGENT_RADIUS + 0.05,
					) < NAV_AGENT_RADIUS
				) {
					continue;
				}
				this.walkable[node] = 1;
				this.heights[node] = height;
				const roomId =
					region.roomId ??
					this.world.layout.openings[region.openingId as number].roomA;
				this.cellRoom[node] = roomId;
				if (region.roomId !== null) {
					const list = this.roomCells.get(roomId);
					if (list) {
						list.push(node);
					} else {
						this.roomCells.set(roomId, [node]);
					}
				}
			}
		}
	}

	private inDoorway(opening: Opening, point: Vec2, height: number): boolean {
		if (Math.abs(height - opening.floorY) > 1) {
			return false;
		}
		const along =
			(point.x - (opening.start.x + opening.end.x) / 2) *
				((opening.end.x - opening.start.x) / opening.width) +
			(point.z - (opening.start.z + opening.end.z) / 2) *
				((opening.end.z - opening.start.z) / opening.width);
		const across = acrossOpening(opening, point) - opening.depth / 2;
		return (
			Math.abs(along) <= (opening.width + this.cellSize) / 2 &&
			Math.abs(across) <= (opening.depth + this.cellSize) / 2
		);
	}

	private regionForLevel(point: Vec2, level: Level): FloorRegion | null {
		for (const region of this.world.regionsAt(point)) {
			if (region.level === level) {
				return region;
			}
		}
		return null;
	}

	private surfaceHeight(point: Vec2, floor: number): number | null {
		let height = floor;
		const radius = NAV_AGENT_RADIUS;
		const bounds = {
			minX: point.x - radius,
			maxX: point.x + radius,
			minZ: point.z - radius,
			maxZ: point.z + radius,
		};
		for (const id of this.world.queryBoxes(bounds)) {
			const box = this.world.boxes[id];
			if (
				box.kind !== "furniture" ||
				box.yMax <= floor + 0.02 ||
				box.yMin > floor + 1.8
			) {
				continue;
			}
			if (!circleBoxPenetration(point.x, point.z, radius, box)) {
				continue;
			}
			if (
				box.yMax <= floor + 0.36 &&
				box.walkable &&
				circleBoxPenetration(point.x, point.z, 0.05, box)
			) {
				height = Math.max(height, box.yMax);
				continue;
			}
			if (box.yMax <= floor + 0.36 && box.walkable) {
				continue;
			}
			return null;
		}
		return height;
	}

	private buildPortals(): void {
		const layout = this.world.layout;
		for (const opening of layout.openings) {
			if (opening.kind === "window") {
				continue;
			}
			const middleA = {
				x: (opening.start.x + opening.end.x) / 2,
				z: (opening.start.z + opening.end.z) / 2,
			};
			const center = {
				x: middleA.x + opening.normal.x * (opening.depth / 2),
				z: middleA.z + opening.normal.z * (opening.depth / 2),
			};
			const roomA = layout.rooms[opening.roomA];
			const roomB = layout.rooms[opening.roomB];
			const frontDistance = 0.55;
			const frontA = {
				x: middleA.x - opening.normal.x * frontDistance,
				z: middleA.z - opening.normal.z * frontDistance,
			};
			const frontB = {
				x: middleA.x + opening.normal.x * (opening.depth + frontDistance),
				z: middleA.z + opening.normal.z * (opening.depth + frontDistance),
			};
			const doorId = opening.door?.id ?? null;
			const gridA = roomA.level;
			const gridB = roomB.level;
			const y = opening.floorY;
			const base = this.portalBase + this.portals.length;
			this.portals.push(
				{
					...frontA,
					y,
					openingId: opening.id,
					doorId: null,
					role: "frontA",
					gridLevel: gridA,
				},
				{
					...center,
					y,
					openingId: opening.id,
					doorId,
					role: "center",
					gridLevel: gridA,
				},
				{
					...frontB,
					y,
					openingId: opening.id,
					doorId: null,
					role: "frontB",
					gridLevel: gridB,
				},
			);
			this.link(base, base + 1);
			this.link(base + 1, base + 2);
			this.linkToCells(
				base,
				frontA,
				gridA,
				y,
				(cell) => acrossOpening(opening, cell) < 0,
			);
			this.linkToCells(
				base + 2,
				frontB,
				gridB,
				y,
				(cell) => acrossOpening(opening, cell) > opening.depth,
			);
		}
	}

	private linkToCells(
		portalNode: number,
		point: Vec2,
		level: Level,
		y: number,
		onSide: (cell: Vec2) => boolean,
	): void {
		const radiusCells = 3;
		const center = this.cellNode(level, point);
		if (center === null) {
			return;
		}
		const index = center - level * this.cellsPerLevel;
		const column = index % this.columns;
		const row = (index - column) / this.columns;
		for (let dr = -radiusCells; dr <= radiusCells; dr += 1) {
			for (let dc = -radiusCells; dc <= radiusCells; dc += 1) {
				const r = row + dr;
				const c = column + dc;
				if (r < 0 || c < 0 || r >= this.rows || c >= this.columns) {
					continue;
				}
				const node = level * this.cellsPerLevel + r * this.columns + c;
				if (!this.walkable[node] || Math.abs(this.heights[node] - y) > 0.5) {
					continue;
				}
				const position = this.nodePosition(node);
				const distance = Math.hypot(position.x - point.x, position.z - point.z);
				if (
					distance > 1.35 ||
					!onSide(position) ||
					!this.clearStraight(point, position, y)
				) {
					continue;
				}
				this.link(portalNode, node);
			}
		}
	}

	clearStraight(from: Vec2, to: Vec2, y: number, clearance = 0.3): boolean {
		const distance = Math.hypot(to.x - from.x, to.z - from.z);
		const steps = Math.max(1, Math.ceil(distance / 0.15));
		for (let step = 0; step <= steps; step += 1) {
			const t = step / steps;
			const point = {
				x: from.x + (to.x - from.x) * t,
				z: from.z + (to.z - from.z) * t,
			};
			if (
				this.world.distanceToWalls(point, y + 0.3, y + 1.6, clearance + 0.05) <
				clearance
			) {
				return false;
			}
		}
		return true;
	}

	private link(a: number, b: number): void {
		for (const [from, to] of [
			[a, b],
			[b, a],
		] as const) {
			const list = this.links.get(from);
			if (list) {
				if (!list.includes(to)) {
					list.push(to);
				}
			} else {
				this.links.set(from, [to]);
			}
		}
	}
}
