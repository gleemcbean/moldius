import type { Level } from "../manor/types.js";
import type { Vec3 } from "../math.js";
import type { NavGrid } from "./navGrid.js";

export interface PathOptions {
	canOpenDoors: boolean;
	isDoorClosed: (doorId: number) => boolean;
	maxExpansions?: number;
}

export interface PathPoint extends Vec3 {
	portal: boolean;
	doorId: number | null;
	level: Level;
}

class MinHeap {
	private readonly nodes: number[] = [];
	private readonly scores: number[] = [];

	get size(): number {
		return this.nodes.length;
	}

	clear(): void {
		this.nodes.length = 0;
		this.scores.length = 0;
	}

	push(node: number, score: number): void {
		this.nodes.push(node);
		this.scores.push(score);
		let index = this.nodes.length - 1;
		while (index > 0) {
			const parent = (index - 1) >> 1;
			if (this.scores[parent] <= score) {
				break;
			}
			this.swap(index, parent);
			index = parent;
		}
	}

	pop(): number {
		const top = this.nodes[0];
		const lastNode = this.nodes.pop() as number;
		const lastScore = this.scores.pop() as number;
		if (this.nodes.length > 0) {
			this.nodes[0] = lastNode;
			this.scores[0] = lastScore;
			let index = 0;
			for (;;) {
				const left = index * 2 + 1;
				const right = left + 1;
				let smallest = index;
				if (
					left < this.nodes.length &&
					this.scores[left] < this.scores[smallest]
				) {
					smallest = left;
				}
				if (
					right < this.nodes.length &&
					this.scores[right] < this.scores[smallest]
				) {
					smallest = right;
				}
				if (smallest === index) {
					break;
				}
				this.swap(index, smallest);
				index = smallest;
			}
		}
		return top;
	}

	private swap(a: number, b: number): void {
		[this.nodes[a], this.nodes[b]] = [this.nodes[b], this.nodes[a]];
		[this.scores[a], this.scores[b]] = [this.scores[b], this.scores[a]];
	}
}

export class PathFinder {
	private readonly gScore: Float32Array;
	private readonly cameFrom: Int32Array;
	private readonly stamp: Uint32Array;
	private readonly closed: Uint32Array;
	private generation = 0;
	private readonly heap = new MinHeap();

	constructor(readonly grid: NavGrid) {
		const count = grid.nodeCount;
		this.gScore = new Float32Array(count);
		this.cameFrom = new Int32Array(count);
		this.stamp = new Uint32Array(count);
		this.closed = new Uint32Array(count);
	}

	findPath(from: Vec3, to: Vec3, options: PathOptions): PathPoint[] | null {
		const start = this.grid.nearestNode(from, 4);
		const goal = this.grid.nearestNode(to, 4);
		if (start === null || goal === null) {
			return null;
		}
		const nodes = this.search(start, goal, options);
		if (!nodes) {
			return null;
		}
		const points = nodes.map((node) => this.toPathPoint(node));
		return this.smooth({ ...from, level: this.levelOfNode(start) }, points);
	}

	private levelOfNode(node: number): Level {
		return this.grid.levelOfNode(node);
	}

	private toPathPoint(node: number): PathPoint {
		const position = this.grid.nodePosition(node);
		const level = this.levelOfNode(node);
		if (this.grid.isPortal(node)) {
			const portal = this.grid.portalAt(node);
			return {
				...position,
				portal: true,
				doorId: portal.role === "center" ? portal.doorId : null,
				level,
			};
		}
		return { ...position, portal: false, doorId: null, level };
	}

	private search(
		start: number,
		goal: number,
		options: PathOptions,
	): number[] | null {
		this.generation += 1;
		const generation = this.generation;
		const grid = this.grid;
		const goalPosition = grid.nodePosition(goal);
		const maxExpansions = options.maxExpansions ?? 60_000;
		this.heap.clear();
		this.stamp[start] = generation;
		this.gScore[start] = 0;
		this.cameFrom[start] = -1;
		this.heap.push(start, this.heuristic(start, goalPosition));
		let expansions = 0;

		while (this.heap.size > 0) {
			const current = this.heap.pop();
			if (current === goal) {
				return this.reconstruct(goal);
			}
			if (this.closed[current] === generation) {
				continue;
			}
			this.closed[current] = generation;
			expansions += 1;
			if (expansions > maxExpansions) {
				return null;
			}
			const currentPosition = grid.nodePosition(current);
			for (const neighbor of this.neighbors(current)) {
				if (this.closed[neighbor] === generation) {
					continue;
				}
				let penalty = 0;
				if (grid.isPortal(neighbor)) {
					const portal = grid.portalAt(neighbor);
					if (portal.doorId !== null && options.isDoorClosed(portal.doorId)) {
						if (!options.canOpenDoors) {
							continue;
						}
						penalty = 2.5;
					}
				}
				const neighborPosition = grid.nodePosition(neighbor);
				const cost =
					Math.hypot(
						neighborPosition.x - currentPosition.x,
						neighborPosition.z - currentPosition.z,
						(neighborPosition.y - currentPosition.y) * 1.5,
					) + penalty;
				const tentative = this.gScore[current] + cost;
				if (
					this.stamp[neighbor] === generation &&
					tentative >= this.gScore[neighbor]
				) {
					continue;
				}
				this.stamp[neighbor] = generation;
				this.gScore[neighbor] = tentative;
				this.cameFrom[neighbor] = current;
				this.heap.push(
					neighbor,
					tentative + this.heuristic(neighbor, goalPosition),
				);
			}
		}
		return null;
	}

	private heuristic(node: number, goal: Vec3): number {
		const position = this.grid.nodePosition(node);
		return Math.hypot(
			position.x - goal.x,
			position.z - goal.z,
			position.y - goal.y,
		);
	}

	private reconstruct(goal: number): number[] {
		const path: number[] = [];
		let current = goal;
		while (current !== -1) {
			path.push(current);
			current = this.cameFrom[current];
		}
		return path.reverse();
	}

	private neighbors(node: number): Generator<number> {
		return this.grid.neighbors(node);
	}

	private smooth(
		from: Vec3 & { level: Level },
		points: PathPoint[],
	): PathPoint[] {
		if (points.length <= 2) {
			return points;
		}
		const result: PathPoint[] = [];
		let anchor: Vec3 & { level: Level } = from;
		let index = 0;
		while (index < points.length) {
			const point = points[index];
			if (point.portal) {
				result.push(point);
				anchor = point;
				index += 1;
				continue;
			}
			let furthest = index;
			for (let probe = index + 1; probe < points.length; probe += 1) {
				const candidate = points[probe];
				if (candidate.portal) {
					break;
				}
				if (
					candidate.level === anchor.level &&
					this.walkableLine(anchor, candidate, anchor.level)
				) {
					furthest = probe;
				} else {
					break;
				}
			}
			const chosen = points[furthest];
			result.push(chosen);
			anchor = chosen;
			index = furthest + 1;
		}
		return result;
	}

	walkableLine(from: Vec3, to: Vec3, level: Level): boolean {
		const grid = this.grid;
		const distance = Math.hypot(to.x - from.x, to.z - from.z);
		const steps = Math.max(1, Math.ceil(distance / (grid.cellSize * 0.5)));
		let previousHeight = from.y;
		for (let step = 1; step <= steps; step += 1) {
			const t = step / steps;
			const point = {
				x: from.x + (to.x - from.x) * t,
				z: from.z + (to.z - from.z) * t,
			};
			const node = grid.cellNode(level, point);
			if (node === null || !grid.walkable[node]) {
				return false;
			}
			const height = grid.heights[node];
			if (Math.abs(height - previousHeight) > 0.4) {
				return false;
			}
			previousHeight = height;
		}
		return true;
	}
}
