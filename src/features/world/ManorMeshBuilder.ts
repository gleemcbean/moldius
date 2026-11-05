import { DOOR_FRAME_WIDTH, DOOR_THICKNESS } from "@shared/manor/doors";
import { openingPassage } from "@shared/manor/layoutBuilder";
import {
	edgeLength,
	pointInPolygon,
	tessellateOutline,
} from "@shared/manor/polygon";
import type {
	ManorLayout,
	Opening,
	OutlineEdge,
	Room,
	StairSpec,
} from "@shared/manor/types";
import { SeededRandom } from "@shared/random";
import * as THREE from "three";
import { builderFor } from "./furniture";
import { GeometryBucket } from "./GeometryBucket";
import { meterBox, meterCylinder } from "./geometryUtils";
import type { MaterialLibrary, MaterialOptions } from "./MaterialLibrary";

const WAINSCOT_HEIGHT = 1.0;
const BASEBOARD_HEIGHT = 0.14;
const TRIM: MaterialOptions = { texture: "woodDark", roughness: 0.8 };
const WINDOW_GLASS: MaterialOptions = {
	color: 0xa9c6c0,
	roughness: 0.05,
	metalness: 0.1,
	transparent: true,
	opacity: 0.22,
	depthWrite: false,
	side: THREE.DoubleSide,
};
const WINDOW_FRAME = 0.06;

const CEILING_TEXTURES: Record<string, string> = {
	plaster: "ceilingPlaster",
	beams: "ceilingPlaster",
	glass: "ceilingPlaster",
	vault: "vaultStone",
	coffered: "coffer",
	planks: "darkPlanks",
};

export interface RoomMeshes {
	room: Room;
	group: THREE.Group;
	center: THREE.Vector3;
}

function wallMaterial(room: Room): MaterialOptions {
	return { texture: room.style.wall, roughness: 1 };
}

const UNTRIMMED_WALLS = new Set([
	"stoneBlocks",
	"brick",
	"greenhouseBrick",
	"rubbleStone",
	"mossyBrick",
]);

function hasTrim(room: Room): boolean {
	return !UNTRIMMED_WALLS.has(room.style.wall);
}

export class ManorMeshBuilder {
	constructor(
		private readonly layout: ManorLayout,
		private readonly materials: MaterialLibrary,
	) {}

	buildRoom(room: Room): RoomMeshes {
		const bucket = new GeometryBucket(this.materials);
		this.addFloor(bucket, room);
		this.addCeiling(bucket, room);
		this.addWalls(bucket, room);
		if (room.stair) {
			this.addStairs(bucket, room, room.stair);
		}
		this.addFurniture(bucket, room);
		for (const openingId of room.openingIds) {
			const opening = this.layout.openings[openingId];
			if (opening.roomA === room.id) {
				this.addOpening(bucket, opening);
			}
		}
		const group = new THREE.Group();
		group.name = `room-${room.id}`;
		for (const mesh of bucket.toMeshes()) {
			group.add(mesh);
		}
		const center = new THREE.Vector3(
			room.labelPoint.x,
			room.floorY + room.height / 2,
			room.labelPoint.z,
		);
		return { room, group, center };
	}

	private floorGeometry(
		room: Room,
		y: number,
		facingDown: boolean,
	): THREE.BufferGeometry {
		const sign = facingDown ? 1 : -1;
		const shape = new THREE.Shape(
			room.polygon.map((point) => new THREE.Vector2(point.x, sign * point.z)),
		);
		const geometry = new THREE.ShapeGeometry(shape);
		geometry.rotateX((sign * Math.PI) / 2);
		geometry.translate(0, y, 0);
		return geometry;
	}

	private addFloor(bucket: GeometryBucket, room: Room): void {
		bucket.add(
			{ texture: room.style.floor, roughness: 0.9 },
			this.floorGeometry(room, room.floorY, false),
		);
	}

	private addCeiling(bucket: GeometryBucket, room: Room): void {
		const style = room.style.ceiling;
		if (style === "glass") {
			this.addGlassCeiling(bucket, room);
			return;
		}
		bucket.add(
			{ texture: CEILING_TEXTURES[style] ?? "ceilingPlaster", roughness: 1 },
			this.floorGeometry(room, room.ceilingY, true),
		);
		if (style === "beams" || style === "vault" || style === "planks") {
			this.addBeams(
				bucket,
				room,
				style === "vault" ? { texture: "vaultStone", roughness: 1 } : TRIM,
				style === "vault" ? 0.3 : 0.22,
				style === "vault" ? 2.2 : 1.4,
			);
		}
		if (style === "coffered") {
			this.addBeams(bucket, room, TRIM, 0.12, 1.5);
			this.addBeams(bucket, room, TRIM, 0.12, 1.5, Math.PI / 2);
		}
	}

	private addGlassCeiling(bucket: GeometryBucket, room: Room): void {
		bucket.add(
			{
				color: 0x9fb8c0,
				roughness: 0.1,
				metalness: 0.2,
				transparent: true,
				opacity: 0.18,
				depthWrite: false,
			},
			this.floorGeometry(room, room.ceilingY, true),
		);
		bucket.add(
			{ texture: "skyNight", unlit: true, color: 0xb8c4e0 },
			this.floorGeometry(room, room.ceilingY + 2.5, true),
		);
		const iron: MaterialOptions = {
			texture: "iron",
			color: 0x4a5a4a,
			roughness: 0.6,
			metalness: 0.5,
		};
		this.addBeams(bucket, room, iron, 0.07, 0.9);
		this.addBeams(bucket, room, iron, 0.07, 1.8, Math.PI / 2);
		for (let index = 0; index < room.polygon.length; index += 1) {
			const a = room.polygon[index];
			const b = room.polygon[(index + 1) % room.polygon.length];
			const length = Math.hypot(b.x - a.x, b.z - a.z);
			if (length < 0.05) {
				continue;
			}
			const geometry = meterBox(length, 0.12, 0.12);
			const matrix = new THREE.Matrix4().compose(
				new THREE.Vector3(
					(a.x + b.x) / 2,
					room.ceilingY - 0.04,
					(a.z + b.z) / 2,
				),
				new THREE.Quaternion().setFromEuler(
					new THREE.Euler(0, -Math.atan2(b.z - a.z, b.x - a.x), 0),
				),
				new THREE.Vector3(1, 1, 1),
			);
			bucket.add(iron, geometry, matrix);
		}
	}

	private addBeams(
		bucket: GeometryBucket,
		room: Room,
		material: MaterialOptions,
		size: number,
		spacing: number,
		extraRotation = 0,
	): void {
		const angle = room.axisAngle + extraRotation;
		const along = { x: Math.cos(angle), z: Math.sin(angle) };
		const across = { x: -along.z, z: along.x };
		const { minX, maxX, minZ, maxZ } = room.bounds;
		const center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
		const extent = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 1;
		for (let offset = -extent; offset <= extent; offset += spacing) {
			const origin = {
				x: center.x + across.x * offset,
				z: center.z + across.z * offset,
			};
			for (const [from, to] of this.insideIntervals(
				room,
				origin,
				along,
				extent,
			)) {
				const length = to - from - 0.02;
				if (length < 0.4) {
					continue;
				}
				const middle = (from + to) / 2;
				const geometry = meterBox(length, size, size);
				const matrix = new THREE.Matrix4().compose(
					new THREE.Vector3(
						origin.x + along.x * middle,
						room.ceilingY - size / 2,
						origin.z + along.z * middle,
					),
					new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -angle, 0)),
					new THREE.Vector3(1, 1, 1),
				);
				bucket.add(material, geometry, matrix);
			}
		}
	}

	private insideIntervals(
		room: Room,
		origin: { x: number; z: number },
		direction: { x: number; z: number },
		extent: number,
	): [number, number][] {
		const step = 0.1;
		const intervals: [number, number][] = [];
		let start: number | null = null;
		for (let t = -extent; t <= extent; t += step) {
			const inside = pointInPolygon(
				{ x: origin.x + direction.x * t, z: origin.z + direction.z * t },
				room.polygon,
			);
			if (inside && start === null) {
				start = t;
			} else if (!inside && start !== null) {
				intervals.push([start, t - step]);
				start = null;
			}
		}
		if (start !== null) {
			intervals.push([start, extent]);
		}
		return intervals;
	}

	private addWalls(bucket: GeometryBucket, room: Room): void {
		let perimeter = 0;
		room.edges.forEach((edge, edgeIndex) => {
			if (edge.kind === "arc") {
				this.addArcWall(bucket, room, edge, perimeter);
			} else {
				this.addLineWall(bucket, room, edgeIndex, edge, perimeter);
			}
			perimeter += edgeLength(edge);
		});
	}

	private wallBands(
		room: Room,
	): { from: number; to: number; material: MaterialOptions }[] {
		const top = room.height;
		if (room.style.wainscot) {
			return [
				{
					from: 0,
					to: WAINSCOT_HEIGHT,
					material: { texture: "wainscot", roughness: 0.85 },
				},
				{ from: WAINSCOT_HEIGHT, to: top, material: wallMaterial(room) },
			];
		}
		return [{ from: 0, to: top, material: wallMaterial(room) }];
	}

	private addLineWall(
		bucket: GeometryBucket,
		room: Room,
		edgeIndex: number,
		edge: Extract<OutlineEdge, { kind: "line" }>,
		perimeter: number,
	): void {
		const length = edgeLength(edge);
		const direction = {
			x: (edge.b.x - edge.a.x) / length,
			z: (edge.b.z - edge.a.z) / length,
		};
		const slots = [...room.edgeOpenings[edgeIndex]].sort(
			(a, b) => a.from - b.from,
		);
		const pieces: { from: number; to: number; bottom: number; top: number }[] =
			[];
		let cursor = 0;
		for (const slot of slots) {
			const opening = this.layout.openings[slot.openingId];
			if (slot.from > cursor) {
				pieces.push({
					from: cursor,
					to: slot.from,
					bottom: 0,
					top: room.height,
				});
			}
			const sill = opening.floorY + opening.sill - room.floorY;
			if (sill > 0.01) {
				pieces.push({ from: slot.from, to: slot.to, bottom: 0, top: sill });
			}
			const lintel = opening.floorY + opening.height - room.floorY;
			if (lintel < room.height - 0.01) {
				pieces.push({
					from: slot.from,
					to: slot.to,
					bottom: lintel,
					top: room.height,
				});
			}
			cursor = slot.to;
		}
		if (cursor < length) {
			pieces.push({ from: cursor, to: length, bottom: 0, top: room.height });
		}
		for (const piece of pieces) {
			for (const band of this.wallBands(room)) {
				const bottom = Math.max(piece.bottom, band.from);
				const top = Math.min(piece.top, band.to);
				if (top - bottom < 0.005) {
					continue;
				}
				bucket.add(
					band.material,
					this.wallQuad(
						edge.a,
						direction,
						piece.from,
						piece.to,
						room.floorY + bottom,
						room.floorY + top,
						perimeter,
					),
				);
			}
			if (hasTrim(room) && piece.bottom === 0 && piece.to - piece.from > 0.05) {
				this.addTrimStrip(
					bucket,
					edge.a,
					direction,
					piece.from,
					piece.to,
					room.floorY,
					BASEBOARD_HEIGHT,
					0.025,
				);
				if (room.style.wainscot && piece.top >= WAINSCOT_HEIGHT) {
					this.addTrimStrip(
						bucket,
						edge.a,
						direction,
						piece.from,
						piece.to,
						room.floorY + WAINSCOT_HEIGHT - 0.03,
						0.06,
						0.03,
					);
				}
			}
			if (
				hasTrim(room) &&
				piece.top >= room.height - 0.01 &&
				piece.to - piece.from > 0.05
			) {
				this.addTrimStrip(
					bucket,
					edge.a,
					direction,
					piece.from,
					piece.to,
					room.ceilingY - 0.12,
					0.12,
					0.05,
				);
			}
		}
	}

	private wallQuad(
		origin: { x: number; z: number },
		direction: { x: number; z: number },
		from: number,
		to: number,
		bottom: number,
		top: number,
		perimeter: number,
	): THREE.BufferGeometry {
		const ax = origin.x + direction.x * from;
		const az = origin.z + direction.z * from;
		const bx = origin.x + direction.x * to;
		const bz = origin.z + direction.z * to;
		const normal = { x: -direction.z, z: direction.x };
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(
				[ax, bottom, az, bx, bottom, bz, bx, top, bz, ax, top, az],
				3,
			),
		);
		geometry.setAttribute(
			"normal",
			new THREE.Float32BufferAttribute(
				[
					normal.x,
					0,
					normal.z,
					normal.x,
					0,
					normal.z,
					normal.x,
					0,
					normal.z,
					normal.x,
					0,
					normal.z,
				],
				3,
			),
		);
		const u0 = perimeter + from;
		const u1 = perimeter + to;
		geometry.setAttribute(
			"uv",
			new THREE.Float32BufferAttribute(
				[u0, bottom, u1, bottom, u1, top, u0, top],
				2,
			),
		);
		geometry.setIndex([0, 1, 2, 0, 2, 3]);
		return geometry;
	}

	private addTrimStrip(
		bucket: GeometryBucket,
		origin: { x: number; z: number },
		direction: { x: number; z: number },
		from: number,
		to: number,
		y: number,
		height: number,
		depth: number,
	): void {
		const length = to - from;
		const normal = { x: -direction.z, z: direction.x };
		const middle = (from + to) / 2;
		const geometry = meterBox(length, height, depth);
		const matrix = new THREE.Matrix4().compose(
			new THREE.Vector3(
				origin.x + direction.x * middle + normal.x * (depth / 2),
				y + height / 2,
				origin.z + direction.z * middle + normal.z * (depth / 2),
			),
			new THREE.Quaternion().setFromEuler(
				new THREE.Euler(0, -Math.atan2(direction.z, direction.x), 0),
			),
			new THREE.Vector3(1, 1, 1),
		);
		bucket.add(TRIM, geometry, matrix);
	}

	private addArcWall(
		bucket: GeometryBucket,
		room: Room,
		edge: Extract<OutlineEdge, { kind: "arc" }>,
		perimeter: number,
	): void {
		const segments = 8;
		for (const band of this.wallBands(room)) {
			const positions: number[] = [];
			const normals: number[] = [];
			const uvs: number[] = [];
			const indices: number[] = [];
			for (let step = 0; step <= segments; step += 1) {
				const t = step / segments;
				const angle = edge.startAngle + edge.sweep * t;
				const x = edge.center.x + Math.cos(angle) * edge.radius;
				const z = edge.center.z + Math.sin(angle) * edge.radius;
				const sign = edge.sweep > 0 ? -1 : 1;
				const nx = Math.cos(angle) * sign;
				const nz = Math.sin(angle) * sign;
				const u = perimeter + Math.abs(edge.sweep) * edge.radius * t;
				positions.push(
					x,
					room.floorY + band.from,
					z,
					x,
					room.floorY + band.to,
					z,
				);
				normals.push(nx, 0, nz, nx, 0, nz);
				uvs.push(u, band.from, u, band.to);
				if (step < segments) {
					const base = step * 2;
					indices.push(base, base + 3, base + 2, base, base + 1, base + 3);
				}
			}
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute(
				"position",
				new THREE.Float32BufferAttribute(positions, 3),
			);
			geometry.setAttribute(
				"normal",
				new THREE.Float32BufferAttribute(normals, 3),
			);
			geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
			geometry.setIndex(this.orientIndices(indices, positions, normals));
			bucket.add(band.material, geometry);
		}
	}

	private orientIndices(
		indices: number[],
		positions: number[],
		normals: number[],
	): number[] {
		const a = new THREE.Vector3().fromArray(positions, indices[0] * 3);
		const b = new THREE.Vector3().fromArray(positions, indices[1] * 3);
		const c = new THREE.Vector3().fromArray(positions, indices[2] * 3);
		const face = new THREE.Vector3()
			.subVectors(b, a)
			.cross(new THREE.Vector3().subVectors(c, a));
		const normal = new THREE.Vector3().fromArray(normals, indices[0] * 3);
		if (face.dot(normal) >= 0) {
			return indices;
		}
		const flipped: number[] = [];
		for (let index = 0; index < indices.length; index += 3) {
			flipped.push(indices[index], indices[index + 2], indices[index + 1]);
		}
		return flipped;
	}

	private addOpening(bucket: GeometryBucket, opening: Opening): void {
		const roomA = this.layout.rooms[opening.roomA];
		const passage = openingPassage(opening);
		const along = {
			x: (opening.end.x - opening.start.x) / opening.width,
			z: (opening.end.z - opening.start.z) / opening.width,
		};
		if (opening.kind === "window") {
			this.addWindow(bucket, opening, passage, along, wallMaterial(roomA));
			return;
		}
		const revealMaterial: MaterialOptions = opening.door
			? TRIM
			: wallMaterial(
					roomA.type === "stairwell" ? this.layout.rooms[opening.roomB] : roomA,
				);
		const floor = opening.floorY;
		const top = opening.floorY + opening.height;
		const startA = passage[0];
		const startB = passage[1];
		const endB = passage[2];
		const endA = passage[3];
		bucket.add(revealMaterial, this.quad(startA, startB, floor, top, along));
		bucket.add(
			revealMaterial,
			this.quad(endB, endA, floor, top, { x: -along.x, z: -along.z }),
		);
		bucket.add(
			revealMaterial,
			this.horizontalQuad([startA, endA, endB, startB], top, -1),
		);
		bucket.add(
			{
				texture: opening.door ? "darkPlanks" : roomA.style.floor,
				roughness: 0.9,
			},
			this.horizontalQuad([startA, startB, endB, endA], floor + 0.002, 1),
		);
		this.addCasing(bucket, opening, along);
		if (opening.door) {
			this.addDoorFrame(bucket, opening, along);
		}
	}

	private addWindow(
		bucket: GeometryBucket,
		opening: Opening,
		passage: { x: number; z: number }[],
		along: { x: number; z: number },
		reveal: MaterialOptions,
	): void {
		const [startA, startB, endB, endA] = passage;
		const sill = opening.floorY + opening.sill;
		const top = opening.floorY + opening.height;
		bucket.add(reveal, this.quad(startA, startB, sill, top, along));
		bucket.add(
			reveal,
			this.quad(endB, endA, sill, top, { x: -along.x, z: -along.z }),
		);
		bucket.add(
			reveal,
			this.horizontalQuad([startA, endA, endB, startB], top, -1),
		);
		bucket.add(
			TRIM,
			this.horizontalQuad([startA, startB, endB, endA], sill + 0.002, 1),
		);
		const rotation = new THREE.Quaternion().setFromEuler(
			new THREE.Euler(0, -Math.atan2(along.z, along.x), 0),
		);
		const unit = new THREE.Vector3(1, 1, 1);
		const height = top - sill;
		const place = (alongOffset: number, y: number) =>
			new THREE.Vector3(
				opening.start.x +
					along.x * alongOffset +
					(opening.normal.x * opening.depth) / 2,
				sill + y,
				opening.start.z +
					along.z * alongOffset +
					(opening.normal.z * opening.depth) / 2,
			);
		const bars: [number, number, number, number][] = [
			[WINDOW_FRAME / 2, height / 2, WINDOW_FRAME, height],
			[opening.width - WINDOW_FRAME / 2, height / 2, WINDOW_FRAME, height],
			[opening.width / 2, WINDOW_FRAME / 2, opening.width, WINDOW_FRAME],
			[
				opening.width / 2,
				height - WINDOW_FRAME / 2,
				opening.width,
				WINDOW_FRAME,
			],
			[opening.width / 2, height / 2, 0.035, height],
			[opening.width / 2, height * 0.62, opening.width, 0.035],
		];
		for (const [alongOffset, y, width, barHeight] of bars) {
			bucket.add(
				TRIM,
				meterBox(width, barHeight, 0.07),
				new THREE.Matrix4().compose(place(alongOffset, y), rotation, unit),
			);
		}
		bucket.add(
			WINDOW_GLASS,
			meterBox(opening.width, height, 0.008),
			new THREE.Matrix4().compose(
				place(opening.width / 2, height / 2),
				rotation,
				unit,
			),
		);
	}

	private addDoorFrame(
		bucket: GeometryBucket,
		opening: Opening,
		along: { x: number; z: number },
	): void {
		const rotation = new THREE.Quaternion().setFromEuler(
			new THREE.Euler(0, -Math.atan2(along.z, along.x), 0),
		);
		const depth = opening.depth + 0.01;
		const place = (alongOffset: number, y: number) =>
			new THREE.Vector3(
				opening.start.x +
					along.x * alongOffset +
					(opening.normal.x * opening.depth) / 2,
				opening.floorY + y,
				opening.start.z +
					along.z * alongOffset +
					(opening.normal.z * opening.depth) / 2,
			);
		const unit = new THREE.Vector3(1, 1, 1);
		const jambs: [number, number, number, number][] = [
			[
				DOOR_FRAME_WIDTH / 2,
				opening.height / 2,
				DOOR_FRAME_WIDTH,
				opening.height,
			],
			[
				opening.width - DOOR_FRAME_WIDTH / 2,
				opening.height / 2,
				DOOR_FRAME_WIDTH,
				opening.height,
			],
			[
				opening.width / 2,
				opening.height - DOOR_FRAME_WIDTH / 2,
				opening.width,
				DOOR_FRAME_WIDTH,
			],
		];
		for (const [alongOffset, y, width, height] of jambs) {
			bucket.add(
				TRIM,
				meterBox(width, height, depth),
				new THREE.Matrix4().compose(place(alongOffset, y), rotation, unit),
			);
		}
		const stopDepth = 0.018;
		const stopOffset =
			(opening.door?.swingIntoA ? 1 : -1) *
			(DOOR_THICKNESS / 2 + stopDepth / 2);
		const stops: [number, number, number, number][] = [
			[
				DOOR_FRAME_WIDTH + 0.012,
				opening.height / 2,
				0.024,
				opening.height - DOOR_FRAME_WIDTH,
			],
			[
				opening.width - DOOR_FRAME_WIDTH - 0.012,
				opening.height / 2,
				0.024,
				opening.height - DOOR_FRAME_WIDTH,
			],
			[
				opening.width / 2,
				opening.height - DOOR_FRAME_WIDTH - 0.012,
				opening.width,
				0.024,
			],
		];
		for (const [alongOffset, y, width, height] of stops) {
			const center = place(alongOffset, y);
			center.x += opening.normal.x * stopOffset;
			center.z += opening.normal.z * stopOffset;
			bucket.add(
				TRIM,
				meterBox(width, height, stopDepth),
				new THREE.Matrix4().compose(center, rotation, unit),
			);
		}
	}

	private quad(
		a: { x: number; z: number },
		b: { x: number; z: number },
		bottom: number,
		top: number,
		normal: { x: number; z: number },
	): THREE.BufferGeometry {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(
				[a.x, bottom, a.z, b.x, bottom, b.z, b.x, top, b.z, a.x, top, a.z],
				3,
			),
		);
		geometry.setAttribute(
			"normal",
			new THREE.Float32BufferAttribute(
				[
					normal.x,
					0,
					normal.z,
					normal.x,
					0,
					normal.z,
					normal.x,
					0,
					normal.z,
					normal.x,
					0,
					normal.z,
				],
				3,
			),
		);
		const width = Math.hypot(b.x - a.x, b.z - a.z);
		geometry.setAttribute(
			"uv",
			new THREE.Float32BufferAttribute(
				[0, bottom, width, bottom, width, top, 0, top],
				2,
			),
		);
		const face = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).cross(
			new THREE.Vector3(0, 1, 0),
		);
		const facing = face.x * normal.x + face.z * normal.z;
		geometry.setIndex(facing > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
		return geometry;
	}

	private horizontalQuad(
		points: { x: number; z: number }[],
		y: number,
		normalY: 1 | -1,
	): THREE.BufferGeometry {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			"position",
			new THREE.Float32BufferAttribute(
				points.flatMap((point) => [point.x, y, point.z]),
				3,
			),
		);
		geometry.setAttribute(
			"normal",
			new THREE.Float32BufferAttribute(
				points.flatMap(() => [0, normalY, 0]),
				3,
			),
		);
		geometry.setAttribute(
			"uv",
			new THREE.Float32BufferAttribute(
				points.flatMap((point) => [point.x, point.z]),
				2,
			),
		);
		const a = new THREE.Vector3(points[0].x, y, points[0].z);
		const b = new THREE.Vector3(points[1].x, y, points[1].z);
		const c = new THREE.Vector3(points[2].x, y, points[2].z);
		const face = new THREE.Vector3()
			.subVectors(b, a)
			.cross(new THREE.Vector3().subVectors(c, a));
		geometry.setIndex(
			face.y * normalY > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2],
		);
		return geometry;
	}

	private addCasing(
		bucket: GeometryBucket,
		opening: Opening,
		along: { x: number; z: number },
	): void {
		const casing: MaterialOptions = opening.door
			? TRIM
			: { texture: "woodMedium", roughness: 0.85 };
		const width = opening.door ? 0.11 : 0.08;
		const depth = 0.035;
		const rotation = new THREE.Quaternion().setFromEuler(
			new THREE.Euler(0, -Math.atan2(along.z, along.x), 0),
		);
		for (const side of [-1, 1] as const) {
			const offset = side === -1 ? -depth / 2 : opening.depth + depth / 2;
			const base = {
				x: opening.start.x + opening.normal.x * offset,
				z: opening.start.z + opening.normal.z * offset,
			};
			const parts: [number, number, number, number][] = [
				[-width / 2, opening.height / 2, width, opening.height + width],
				[
					opening.width + width / 2,
					opening.height / 2,
					width,
					opening.height + width,
				],
				[
					opening.width / 2,
					opening.height + width / 2,
					opening.width + width * 2,
					width,
				],
			];
			for (const [alongOffset, y, partWidth, partHeight] of parts) {
				const geometry = meterBox(partWidth, partHeight, depth);
				const matrix = new THREE.Matrix4().compose(
					new THREE.Vector3(
						base.x + along.x * alongOffset,
						opening.floorY + y,
						base.z + along.z * alongOffset,
					),
					rotation,
					new THREE.Vector3(1, 1, 1),
				);
				bucket.add(casing, geometry, matrix);
			}
		}
	}

	private addStairs(
		bucket: GeometryBucket,
		room: Room,
		stair: StairSpec,
	): void {
		const tread: MaterialOptions = { texture: "oakPlanks", roughness: 0.85 };
		const stringer: MaterialOptions = { texture: "stoneBlocks", roughness: 1 };
		const treadDepth = stair.run / stair.stepCount;
		const rotation = new THREE.Quaternion().setFromEuler(
			new THREE.Euler(0, -Math.atan2(stair.right.z, stair.right.x), 0),
		);
		const place = (alongDistance: number, y: number) =>
			new THREE.Vector3(
				stair.origin.x + stair.forward.x * alongDistance,
				y,
				stair.origin.z + stair.forward.z * alongDistance,
			);
		for (let step = 0; step < stair.stepCount; step += 1) {
			const height = (step + 1) * stair.rise;
			const center = stair.bottomLanding + (step + 0.5) * treadDepth;
			const geometry = meterBox(stair.width, height, treadDepth);
			bucket.add(
				step % 2 === 0 ? tread : { ...tread, color: 0xd8d0c8 },
				geometry,
				new THREE.Matrix4().compose(
					place(center, room.floorY + height / 2),
					rotation,
					new THREE.Vector3(1, 1, 1),
				),
			);
			const nose = meterBox(stair.width, 0.03, 0.04);
			bucket.add(
				TRIM,
				nose,
				new THREE.Matrix4().compose(
					place(
						stair.bottomLanding + step * treadDepth + 0.02,
						room.floorY + height - 0.015,
					),
					rotation,
					new THREE.Vector3(1, 1, 1),
				),
			);
		}
		const landingStart = stair.bottomLanding + stair.run;
		const landingDepth = stair.length - landingStart;
		const landing = meterBox(stair.width, stair.topY, landingDepth);
		bucket.add(
			stringer,
			landing,
			new THREE.Matrix4().compose(
				place(landingStart + landingDepth / 2, room.floorY + stair.topY / 2),
				rotation,
				new THREE.Vector3(1, 1, 1),
			),
		);
		const landingTop = meterBox(stair.width, 0.04, landingDepth);
		bucket.add(
			{ texture: "darkPlanks", roughness: 0.85 },
			landingTop,
			new THREE.Matrix4().compose(
				place(
					landingStart + landingDepth / 2,
					room.floorY + stair.topY - 0.02 + 0.021,
				),
				rotation,
				new THREE.Vector3(1, 1, 1),
			),
		);
		const railSide = stair.width / 2 - 0.08;
		const railMaterial: MaterialOptions = {
			texture: "woodRed",
			roughness: 0.6,
		};
		const startPoint = new THREE.Vector3(
			stair.origin.x +
				stair.forward.x * stair.bottomLanding +
				stair.right.x * railSide,
			room.floorY + 0.95,
			stair.origin.z +
				stair.forward.z * stair.bottomLanding +
				stair.right.z * railSide,
		);
		const endPoint = new THREE.Vector3(
			stair.origin.x +
				stair.forward.x * landingStart +
				stair.right.x * railSide,
			room.floorY + stair.topY + 0.95,
			stair.origin.z +
				stair.forward.z * landingStart +
				stair.right.z * railSide,
		);
		const railLength = startPoint.distanceTo(endPoint);
		const rail = meterCylinder(0.03, 0.03, railLength, 10);
		const railQuaternion = new THREE.Quaternion().setFromUnitVectors(
			new THREE.Vector3(0, 1, 0),
			new THREE.Vector3().subVectors(endPoint, startPoint).normalize(),
		);
		bucket.add(
			railMaterial,
			rail,
			new THREE.Matrix4().compose(
				startPoint.clone().add(endPoint).multiplyScalar(0.5),
				railQuaternion,
				new THREE.Vector3(1, 1, 1),
			),
		);
		for (let index = 0; index <= 6; index += 1) {
			const t = index / 6;
			const along = stair.bottomLanding + t * stair.run;
			const baseY = room.floorY + t * stair.topY + stair.rise * 0.5;
			const post = meterCylinder(0.025, 0.025, 0.95 - stair.rise * 0.5, 8);
			bucket.add(
				railMaterial,
				post,
				new THREE.Matrix4().makeTranslation(
					stair.origin.x + stair.forward.x * along + stair.right.x * railSide,
					baseY + (0.95 - stair.rise * 0.5) / 2,
					stair.origin.z + stair.forward.z * along + stair.right.z * railSide,
				),
			);
		}
	}

	private addFurniture(bucket: GeometryBucket, room: Room): void {
		const items = this.layout.furniture.filter(
			(item) => item.roomId === room.id,
		);
		for (const item of items) {
			const builder = builderFor(item.kind);
			const parts = builder({ item, room, rng: new SeededRandom(item.seed) });
			const matrix = new THREE.Matrix4().compose(
				new THREE.Vector3(item.x, item.y, item.z),
				new THREE.Quaternion().setFromEuler(
					new THREE.Euler(0, -item.rotation, 0),
				),
				new THREE.Vector3(1, 1, 1),
			);
			for (const part of parts) {
				bucket.add(part.material, part.geometry, matrix);
			}
		}
	}
}

export function roomOutlinePoints(room: Room): { x: number; z: number }[] {
	return tessellateOutline(room.edges);
}
