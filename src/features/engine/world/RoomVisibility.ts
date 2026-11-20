import {
	distanceToPolygonBoundary,
	pointInPolygon,
} from "@shared/manor/polygon";
import type { ManorLayout } from "@shared/manor/types";
import * as THREE from "three";

const DOORWAY_REACH = 0.9;
const FLOOR_SLACK = 0.6;
const CEILING_SLACK = 0.6;
const PORTAL_SIDE_MARGIN = 0.25;
const PORTAL_DEPTH_MARGIN = 0.15;
const PORTAL_VERTICAL_MARGIN = 0.25;
const NEAR_W = 1e-3;

const BOX_EDGES = [
	0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7,
];

interface Portal {
	roomA: number;
	roomB: number;
	doorId: number | null;
	corners: Float64Array;
	stamp: number;
	hidden: boolean;
	rect: Float64Array;
}

export class RoomVisibility {
	readonly visible: Uint8Array;
	private readonly portals: Portal[] = [];
	private readonly links: number[][];
	private readonly rects: Float64Array;
	private readonly queued: Uint8Array;
	private readonly queue: number[] = [];
	private readonly starts: number[] = [];
	private readonly near: number[] = [];
	private readonly clip = new THREE.Matrix4();
	private readonly projected = new Float64Array(24);
	private stamp = 0;

	constructor(private readonly layout: ManorLayout) {
		const count = layout.rooms.length;

		this.visible = new Uint8Array(count);
		this.rects = new Float64Array(count * 4);
		this.queued = new Uint8Array(count);
		this.links = layout.rooms.map(() => []);

		for (const opening of layout.openings) {
			if (!layout.rooms[opening.roomA] || !layout.rooms[opening.roomB]) {
				continue;
			}

			const length = Math.max(1e-6, opening.width);

			const along = {
				x: (opening.end.x - opening.start.x) / length,
				z: (opening.end.z - opening.start.z) / length,
			};

			const center = {
				x:
					(opening.start.x + opening.end.x) / 2 +
					(opening.normal.x * opening.depth) / 2,
				z:
					(opening.start.z + opening.end.z) / 2 +
					(opening.normal.z * opening.depth) / 2,
			};

			const halfAlong = opening.width / 2 + PORTAL_SIDE_MARGIN;
			const halfAcross = opening.depth / 2 + PORTAL_DEPTH_MARGIN;

			const bottom =
				opening.floorY +
				(opening.kind === "window" ? opening.sill : 0) -
				PORTAL_VERTICAL_MARGIN;

			const top = opening.floorY + opening.height + PORTAL_VERTICAL_MARGIN;

			const footprint = [
				[-1, -1],
				[1, -1],
				[1, 1],
				[-1, 1],
			];

			const corners = new Float64Array(24);

			for (let level = 0; level < 2; level += 1) {
				footprint.forEach(([side, depth], index) => {
					const offset = (level * 4 + index) * 3;

					corners[offset] =
						center.x +
						along.x * side * halfAlong +
						opening.normal.x * depth * halfAcross;

					corners[offset + 1] = level === 0 ? bottom : top;

					corners[offset + 2] =
						center.z +
						along.z * side * halfAlong +
						opening.normal.z * depth * halfAcross;
				});
			}

			const index = this.portals.length;

			this.portals.push({
				roomA: opening.roomA,
				roomB: opening.roomB,
				doorId: opening.door?.id ?? null,
				corners,
				stamp: 0,
				hidden: true,
				rect: new Float64Array(4),
			});

			this.links[opening.roomA].push(index);

			if (opening.roomB !== opening.roomA) {
				this.links[opening.roomB].push(index);
			}
		}
	}

	update(
		camera: THREE.PerspectiveCamera,
		eye: THREE.Vector3,
		shut: (doorId: number) => boolean,
	): boolean {
		this.visible.fill(0);
		this.queued.fill(0);

		this.queue.length = 0;

		this.findStarts(eye);

		if (this.starts.length === 0) {
			return false;
		}

		this.stamp += 1;

		this.clip.multiplyMatrices(
			camera.projectionMatrix,
			camera.matrixWorldInverse,
		);

		const reach = Math.max(1, 1 / Math.max(0.01, camera.aspect));

		for (const room of this.starts) {
			this.grow(room, -reach, -1, reach, 1);
		}

		const rects = this.rects;
		let budget = this.visible.length * 24;

		while (this.queue.length > 0) {
			budget -= 1;

			if (budget < 0) {
				return false;
			}

			const room = this.queue.pop() as number;

			this.queued[room] = 0;

			const base = room * 4;
			const minX = rects[base];
			const minY = rects[base + 1];
			const maxX = rects[base + 2];
			const maxY = rects[base + 3];

			for (const index of this.links[room]) {
				const portal = this.portals[index];

				if (portal.doorId !== null && shut(portal.doorId)) {
					continue;
				}

				if (!this.project(portal)) {
					continue;
				}

				const rect = portal.rect;
				const left = Math.max(minX, rect[0]);
				const bottom = Math.max(minY, rect[1]);
				const right = Math.min(maxX, rect[2]);
				const top = Math.min(maxY, rect[3]);

				if (left >= right || bottom >= top) {
					continue;
				}

				this.grow(
					portal.roomA === room ? portal.roomB : portal.roomA,
					left,
					bottom,
					right,
					top,
				);
			}
		}

		return true;
	}

	private findStarts(eye: THREE.Vector3): void {
		this.starts.length = 0;
		this.near.length = 0;

		const point = { x: eye.x, z: eye.z };

		for (const room of this.layout.rooms) {
			if (
				eye.y < room.floorY - FLOOR_SLACK ||
				eye.y > room.ceilingY + CEILING_SLACK
			) {
				continue;
			}

			const bounds = room.bounds;

			if (
				eye.x < bounds.minX - DOORWAY_REACH ||
				eye.x > bounds.maxX + DOORWAY_REACH ||
				eye.z < bounds.minZ - DOORWAY_REACH ||
				eye.z > bounds.maxZ + DOORWAY_REACH
			) {
				continue;
			}

			if (pointInPolygon(point, room.polygon)) {
				this.starts.push(room.id);
			} else if (
				distanceToPolygonBoundary(point, room.polygon) < DOORWAY_REACH
			) {
				this.near.push(room.id);
			}
		}

		if (this.starts.length === 0) {
			this.starts.push(...this.near);
		}
	}

	private grow(
		room: number,
		minX: number,
		minY: number,
		maxX: number,
		maxY: number,
	): void {
		const rects = this.rects;
		const base = room * 4;

		if (this.visible[room]) {
			if (
				rects[base] <= minX &&
				rects[base + 1] <= minY &&
				rects[base + 2] >= maxX &&
				rects[base + 3] >= maxY
			) {
				return;
			}

			rects[base] = Math.min(rects[base], minX);
			rects[base + 1] = Math.min(rects[base + 1], minY);
			rects[base + 2] = Math.max(rects[base + 2], maxX);
			rects[base + 3] = Math.max(rects[base + 3], maxY);
		} else {
			this.visible[room] = 1;
			rects[base] = minX;
			rects[base + 1] = minY;
			rects[base + 2] = maxX;
			rects[base + 3] = maxY;
		}

		if (!this.queued[room]) {
			this.queued[room] = 1;

			this.queue.push(room);
		}
	}

	private project(portal: Portal): boolean {
		if (portal.stamp === this.stamp) {
			return !portal.hidden;
		}

		portal.stamp = this.stamp;

		const matrix = this.clip.elements;
		const corners = portal.corners;
		const projected = this.projected;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		let behind = 0;

		for (let corner = 0; corner < 8; corner += 1) {
			const x = corners[corner * 3];
			const y = corners[corner * 3 + 1];
			const z = corners[corner * 3 + 2];
			const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
			const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
			const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];

			projected[corner * 3] = clipX;
			projected[corner * 3 + 1] = clipY;
			projected[corner * 3 + 2] = clipW;

			if (clipW > NEAR_W) {
				const screenX = clipX / clipW;
				const screenY = clipY / clipW;

				minX = Math.min(minX, screenX);
				minY = Math.min(minY, screenY);
				maxX = Math.max(maxX, screenX);
				maxY = Math.max(maxY, screenY);
			} else {
				behind += 1;
			}
		}

		if (behind === 8) {
			portal.hidden = true;

			return false;
		}

		if (behind > 0) {
			for (let edge = 0; edge < BOX_EDGES.length; edge += 2) {
				const a = BOX_EDGES[edge] * 3;
				const b = BOX_EDGES[edge + 1] * 3;
				const wa = projected[a + 2];
				const wb = projected[b + 2];

				if (wa > NEAR_W === wb > NEAR_W) {
					continue;
				}

				const t = (NEAR_W - wa) / (wb - wa);

				const screenX =
					(projected[a] + (projected[b] - projected[a]) * t) / NEAR_W;

				const screenY =
					(projected[a + 1] + (projected[b + 1] - projected[a + 1]) * t) /
					NEAR_W;

				minX = Math.min(minX, screenX);
				minY = Math.min(minY, screenY);
				maxX = Math.max(maxX, screenX);
				maxY = Math.max(maxY, screenY);
			}
		}

		portal.hidden = false;
		portal.rect[0] = minX;
		portal.rect[1] = minY;
		portal.rect[2] = maxX;
		portal.rect[3] = maxY;

		return true;
	}
}
