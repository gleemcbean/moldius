import { MEZZANINE_POST_RADIUS, SLAB_THICKNESS } from "@shared/config/index";
import { DOOR_FRAME_WIDTH, DOOR_THICKNESS } from "@shared/manor/doors";
import { furnitureDefinition } from "@shared/manor/furnitureCatalog";
import { openingPassage } from "@shared/manor/layoutBuilder";
import {
	edgeLength,
	pointInPolygon,
	tessellateOutline,
} from "@shared/manor/polygon";
import type {
	FurnitureItem,
	ManorLayout,
	MezzanineSpec,
	Opening,
	OutlineEdge,
	Room,
	StairSpec,
} from "@shared/manor/types";
import {
	clipProfile,
	type ReliefNode,
	wallProfile,
} from "@shared/manor/wallRelief";
import { SeededRandom } from "@shared/random";
import * as THREE from "three";
import type { AnimatedDecor } from "./DecorAnimator";
import { builderFor } from "./furniture";
import {
	carvedForSeed,
	type Part,
	type PartAnimation,
} from "./furniture/parts";
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

const COPLANAR_SEPARATION = 0.00025;
const ROOF_CHANCE = 42;
const ROOF_MIN_EAVES = 2.7;
const ROOF_DECK_CLEARANCE = 2.75;
const ROOF_MIN_DROP = 0.35;
const ROOF_RAFTER_SPACING = 1.5;
const ROOF_RAFTER_SIZE = 0.15;
const ROOFLESS_ROOMS = new Set(["corridor", "stairwell", "closet", "toilets"]);
const PILASTER_BOTTOM = 2.6;
const PILASTER_MIN_AREA = 45;
const PILASTER_MIN_WALL = 4;
const PILASTER_SPACING = 3.6;
const ROOF_IGNORED_ITEMS = new Set([
	"hangingFern",
	"cobweb",
	"pillar",
	"valveStation",
]);

interface Roof {
	across: { x: number; z: number };
	center: number;
	half: number;
	gable: boolean;
	heightAt: (x: number, z: number) => number;
}

function clipPolygon(
	polygon: { x: number; z: number }[],
	normal: { x: number; z: number },
	offset: number,
): { x: number; z: number }[] {
	const kept: { x: number; z: number }[] = [];
	polygon.forEach((a, index) => {
		const b = polygon[(index + 1) % polygon.length];
		const inA = a.x * normal.x + a.z * normal.z - offset;
		const inB = b.x * normal.x + b.z * normal.z - offset;
		if (inA >= 0) {
			kept.push(a);
		}
		if (inA * inB < 0) {
			const t = inA / (inA - inB);
			kept.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
		}
	});
	return kept;
}

function separateCoplanarFaces(
	geometry: THREE.BufferGeometry,
	index: number,
): void {
	geometry.computeBoundingBox();
	const center = (geometry.boundingBox as THREE.Box3).getCenter(
		new THREE.Vector3(),
	);
	const scale = 1 + COPLANAR_SEPARATION * ((index % 5) + 1);
	geometry.translate(-center.x, -center.y, -center.z);
	geometry.scale(scale, scale, scale);
	geometry.translate(center.x, center.y, center.z);
}

export interface RoomMeshes {
	room: Room;
	group: THREE.Group;
	center: THREE.Vector3;
	animated: AnimatedDecor[];
}

const CEILING_SWING: Record<string, { amplitude: number; speed: number }> = {
	chandelier: { amplitude: 0.018, speed: 0.75 },
	hangingCage: { amplitude: 0.05, speed: 1.15 },
	hangingLantern: { amplitude: 0.05, speed: 1.3 },
	hangingChains: { amplitude: 0.035, speed: 1.05 },
	hangingPots: { amplitude: 0.03, speed: 1.2 },
	hangingFern: { amplitude: 0.04, speed: 0.9 },
};

const ROCKING: Record<string, { amplitude: number; speed: number }> = {
	rockingChair: { amplitude: 0.05, speed: 1.1 },
	rockingHorse: { amplitude: 0.045, speed: 1.3 },
};

function wholeItemAnimation(item: FurnitureItem): PartAnimation | null {
	const phase = (item.seed % 628) / 100;
	const swing = CEILING_SWING[item.kind];
	if (swing) {
		return {
			kind: "swing",
			pivot: [0, item.height, 0],
			axis: [Math.cos(phase), 0, Math.sin(phase)],
			speed: swing.speed,
			amplitude: swing.amplitude,
			phase,
		};
	}
	const rock = ROCKING[item.kind];
	if (rock) {
		return {
			kind: "swing",
			pivot: [0, 0, 0],
			axis: [1, 0, 0],
			speed: rock.speed,
			amplitude: rock.amplitude,
			phase,
		};
	}
	return null;
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
	private readonly roofs = new Map<number, Roof | null>();

	constructor(
		private readonly layout: ManorLayout,
		private readonly materials: MaterialLibrary,
	) {}

	buildRoom(room: Room): RoomMeshes {
		const bucket = new GeometryBucket(this.materials);
		const animated: AnimatedDecor[] = [];
		const group = new THREE.Group();
		this.addFloor(bucket, room);
		this.addCeiling(bucket, room);
		this.addWalls(bucket, room);
		if (room.stair) {
			this.addStairs(bucket, room, room.stair);
		}
		if (room.mezzanine) {
			this.addMezzanine(bucket, room, room.mezzanine);
		}
		this.addPilasters(bucket, room);
		this.addFurniture(bucket, room, group, animated);
		for (const openingId of room.openingIds) {
			const opening = this.layout.openings[openingId];
			if (opening.roomA === room.id) {
				this.addOpening(bucket, opening);
			}
		}
		group.name = `room-${room.id}`;
		for (const mesh of bucket.toMeshes()) {
			group.add(mesh);
		}
		const center = new THREE.Vector3(
			room.labelPoint.x,
			room.floorY + room.height / 2,
			room.labelPoint.z,
		);
		return { room, group, center, animated };
	}

	private floorGeometry(
		room: Room,
		y: number,
		facingDown: boolean,
	): THREE.BufferGeometry {
		return this.polygonGeometry(room.polygon, y, facingDown);
	}

	private polygonGeometry(
		polygon: { x: number; z: number }[],
		y: number,
		facingDown: boolean,
	): THREE.BufferGeometry {
		const sign = facingDown ? 1 : -1;
		const shape = new THREE.Shape(
			polygon.map((point) => new THREE.Vector2(point.x, sign * point.z)),
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
		const roof = this.roofFor(room);
		if (roof) {
			this.addRoof(bucket, room, roof);
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

	private roofFor(room: Room): Roof | null {
		const known = this.roofs.get(room.id);
		if (known !== undefined) {
			return known;
		}
		const roof = this.planRoof(room);
		this.roofs.set(room.id, roof);
		return roof;
	}

	private planRoof(room: Room): Roof | null {
		if (
			room.style.ceiling === "glass" ||
			ROOFLESS_ROOMS.has(room.type) ||
			(!room.mezzanine &&
				room.type !== "attic" &&
				room.seed % 100 >= ROOF_CHANCE)
		) {
			return null;
		}
		const axis = {
			x: Math.cos(room.axisAngle),
			z: Math.sin(room.axisAngle),
		};
		const spanOf = (direction: { x: number; z: number }) => {
			const values = room.polygon.map(
				(point) => point.x * direction.x + point.z * direction.z,
			);
			return { min: Math.min(...values), max: Math.max(...values) };
		};
		const cross = { x: -axis.z, z: axis.x };
		const axisSpan = spanOf(axis);
		const crossSpan = spanOf(cross);
		const shorter = axisSpan.max - axisSpan.min < crossSpan.max - crossSpan.min;
		const across = shorter ? axis : cross;
		const span = shorter ? axisSpan : crossSpan;
		const half = (span.max - span.min) / 2;
		const center = (span.min + span.max) / 2;
		const gable = room.mezzanine !== null || room.seed % 3 !== 0;
		const lowest = room.mezzanine
			? room.mezzanine.floorY + ROOF_DECK_CLEARANCE
			: room.floorY + ROOF_MIN_EAVES;
		const fraction = (distance: number) =>
			gable
				? Math.min(1, Math.abs(distance) / half)
				: Math.min(1, Math.max(0, (half - distance) / (half * 2)));
		let drop = Math.min(room.ceilingY - lowest, half * (gable ? 0.8 : 0.6));
		for (const item of this.layout.furniture) {
			if (
				item.roomId !== room.id ||
				item.parentId !== null ||
				ROOF_IGNORED_ITEMS.has(item.kind)
			) {
				continue;
			}
			const definition = furnitureDefinition(item.kind);
			const top =
				item.y +
				(definition.placement === "ceiling"
					? definition.variants[item.variant].height
					: item.height);
			const reach = Math.max(item.width, item.depth) / 2;
			const distance = item.x * across.x + item.z * across.z - center;
			const lowered = Math.max(
				fraction(distance - reach),
				fraction(distance + reach),
			);
			if (lowered > 0.001) {
				drop = Math.min(drop, (room.ceilingY - top - 0.05) / lowered);
			}
		}
		if (drop < ROOF_MIN_DROP) {
			return null;
		}
		return {
			across,
			center,
			half,
			gable,
			heightAt: (x, z) =>
				room.ceilingY - fraction(x * across.x + z * across.z - center) * drop,
		};
	}

	private addRoof(bucket: GeometryBucket, room: Room, roof: Roof): void {
		const material: MaterialOptions = {
			texture: CEILING_TEXTURES[room.style.ceiling] ?? "ceilingPlaster",
			roughness: 1,
		};
		const { across, center } = roof;
		const pieces = roof.gable
			? [1, -1].map((side) =>
					clipPolygon(
						room.polygon,
						{ x: across.x * side, z: across.z * side },
						center * side,
					),
				)
			: [room.polygon];
		for (const piece of pieces) {
			if (piece.length < 3) {
				continue;
			}
			const geometry = this.polygonGeometry(piece, 0, true);
			const position = geometry.getAttribute(
				"position",
			) as THREE.BufferAttribute;
			for (let index = 0; index < position.count; index += 1) {
				position.setY(
					index,
					roof.heightAt(position.getX(index), position.getZ(index)),
				);
			}
			geometry.computeVertexNormals();
			bucket.add(material, geometry);
		}
		this.addRafters(bucket, room, roof);
	}

	private addRafters(bucket: GeometryBucket, room: Room, roof: Roof): void {
		const { across, center } = roof;
		const along = { x: -across.z, z: across.x };
		const { minX, maxX, minZ, maxZ } = room.bounds;
		const middle = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
		const shift = center - (middle.x * across.x + middle.z * across.z);
		const base = {
			x: middle.x + across.x * shift,
			z: middle.z + across.z * shift,
		};
		const extent = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 1;
		const beam = (
			from: { x: number; z: number },
			to: { x: number; z: number },
		) => {
			const start = new THREE.Vector3(
				from.x,
				roof.heightAt(from.x, from.z) - ROOF_RAFTER_SIZE / 2,
				from.z,
			);
			const end = new THREE.Vector3(
				to.x,
				roof.heightAt(to.x, to.z) - ROOF_RAFTER_SIZE / 2,
				to.z,
			);
			const length = start.distanceTo(end);
			if (length < 0.3) {
				return;
			}
			bucket.add(
				TRIM,
				meterBox(length, ROOF_RAFTER_SIZE, ROOF_RAFTER_SIZE),
				new THREE.Matrix4().compose(
					start.clone().add(end).multiplyScalar(0.5),
					new THREE.Quaternion().setFromUnitVectors(
						new THREE.Vector3(1, 0, 0),
						end.clone().sub(start).normalize(),
					),
					new THREE.Vector3(1, 1, 1),
				),
			);
		};
		for (
			let offset = -extent;
			offset <= extent;
			offset += ROOF_RAFTER_SPACING
		) {
			const origin = {
				x: base.x + along.x * offset,
				z: base.z + along.z * offset,
			};
			const at = (t: number) => ({
				x: origin.x + across.x * t,
				z: origin.z + across.z * t,
			});
			for (const [from, to] of this.insideIntervals(
				room,
				origin,
				across,
				extent,
			)) {
				if (roof.gable && from < 0 && to > 0) {
					beam(at(from), at(0));
					beam(at(0), at(to));
				} else {
					beam(at(from), at(to));
				}
			}
		}
		if (roof.gable) {
			for (const [from, to] of this.insideIntervals(
				room,
				base,
				along,
				extent,
			)) {
				beam(
					{ x: base.x + along.x * from, z: base.z + along.z * from },
					{ x: base.x + along.x * to, z: base.z + along.z * to },
				);
			}
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
		const profile = wallProfile(room);
		for (const piece of pieces) {
			for (const band of this.wallBands(room)) {
				const bottom = Math.max(piece.bottom, band.from);
				const top = Math.min(piece.top, band.to);
				if (top - bottom < 0.005) {
					continue;
				}
				this.addProfiledWall(
					bucket,
					band.material,
					clipProfile(profile, bottom, top),
					room.floorY,
					edge.a,
					direction,
					piece.from,
					piece.to,
					perimeter,
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

	private addProfiledWall(
		bucket: GeometryBucket,
		material: MaterialOptions,
		nodes: ReliefNode[],
		floorY: number,
		origin: { x: number; z: number },
		direction: { x: number; z: number },
		from: number,
		to: number,
		perimeter: number,
	): void {
		const normal = { x: -direction.z, z: direction.x };
		const positions: number[] = [];
		const normals: number[] = [];
		const uvs: number[] = [];
		const indices: number[] = [];
		const at = (along: number, depth: number) => ({
			x: origin.x + direction.x * along + normal.x * depth,
			z: origin.z + direction.z * along + normal.z * depth,
		});
		const quad = (
			corners: [number, number, number][],
			faceNormal: [number, number, number],
			quadUv: [number, number][],
		) => {
			const base = positions.length / 3;
			for (const [index, corner] of corners.entries()) {
				positions.push(...corner);
				normals.push(...faceNormal);
				uvs.push(...quadUv[index]);
			}
			indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
		};
		const u0 = perimeter + from;
		const u1 = perimeter + to;
		for (let index = 1; index < nodes.length; index += 1) {
			const low = nodes[index - 1];
			const high = nodes[index];
			const rise = high.y - low.y;
			const reach = high.depth - low.depth;
			const size = Math.hypot(rise, reach) || 1;
			const a0 = at(from, low.depth);
			const b0 = at(to, low.depth);
			const a1 = at(from, high.depth);
			const b1 = at(to, high.depth);
			const v0 = low.y + low.depth;
			const v1 = high.y + high.depth;
			quad(
				[
					[a0.x, floorY + low.y, a0.z],
					[b0.x, floorY + low.y, b0.z],
					[b1.x, floorY + high.y, b1.z],
					[a1.x, floorY + high.y, a1.z],
				],
				[(normal.x * rise) / size, -reach / size, (normal.z * rise) / size],
				[
					[u0, v0],
					[u1, v0],
					[u1, v1],
					[u0, v1],
				],
			);
			if (low.depth < 0.002 && high.depth < 0.002) {
				continue;
			}
			for (const [along, sign] of [
				[from, -1],
				[to, 1],
			] as const) {
				const wall = at(along, 0);
				const lowOut = at(along, low.depth);
				const highOut = at(along, high.depth);
				const corners: [number, number, number][] = [
					[wall.x, floorY + low.y, wall.z],
					[lowOut.x, floorY + low.y, lowOut.z],
					[highOut.x, floorY + high.y, highOut.z],
					[wall.x, floorY + high.y, wall.z],
				];
				quad(
					sign > 0 ? corners : [...corners].reverse(),
					[direction.x * sign, 0, direction.z * sign],
					[
						[0, low.y],
						[low.depth, low.y],
						[high.depth, high.y],
						[0, high.y],
					],
				);
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
		geometry.setIndex(indices);
		bucket.add(material, geometry);
	}

	private addPilasters(bucket: GeometryBucket, room: Room): void {
		if (room.area < PILASTER_MIN_AREA || room.type === "corridor") {
			return;
		}
		const material = hasTrim(room) ? TRIM : wallMaterial(room);
		const profile = wallProfile(room);
		const topDepthStart =
			[...profile].reverse().find((node) => node.depth < 0.002)?.y ??
			room.height;
		const top = Math.min(topDepthStart, room.height);
		if (top - PILASTER_BOTTOM < 0.7) {
			return;
		}
		const standing = this.layout.furniture.filter(
			(item) =>
				item.roomId === room.id &&
				item.parentId === null &&
				furnitureDefinition(item.kind).placement !== "ceiling",
		);
		room.edges.forEach((edge, edgeIndex) => {
			const length = edgeLength(edge);
			if (edge.kind !== "line" || length < PILASTER_MIN_WALL) {
				return;
			}
			const direction = {
				x: (edge.b.x - edge.a.x) / length,
				z: (edge.b.z - edge.a.z) / length,
			};
			const normal = { x: -direction.z, z: direction.x };
			const count = Math.max(1, Math.floor(length / PILASTER_SPACING));
			for (let index = 1; index <= count; index += 1) {
				const along = (length * index) / (count + 1);
				const clearOfOpening = room.edgeOpenings[edgeIndex].every(
					(slot) => along < slot.from - 0.45 || along > slot.to + 0.45,
				);
				const x = edge.a.x + direction.x * along;
				const z = edge.a.z + direction.z * along;
				const clearOfFurniture = standing.every(
					(item) =>
						Math.hypot(item.x - x, item.z - z) >
						Math.max(item.width, item.depth) / 2 + 0.45,
				);
				if (!clearOfOpening || !clearOfFurniture) {
					continue;
				}
				const rotation = new THREE.Quaternion().setFromEuler(
					new THREE.Euler(0, -Math.atan2(direction.z, direction.x), 0),
				);
				const piece = (
					width: number,
					depth: number,
					from: number,
					to: number,
				) => {
					bucket.add(
						material,
						meterBox(width, to - from, depth),
						new THREE.Matrix4().compose(
							new THREE.Vector3(
								x + normal.x * (depth / 2),
								room.floorY + (from + to) / 2,
								z + normal.z * (depth / 2),
							),
							rotation,
							new THREE.Vector3(1, 1, 1),
						),
					);
				};
				piece(0.28, 0.07, PILASTER_BOTTOM, PILASTER_BOTTOM + 0.1);
				piece(0.36, 0.1, PILASTER_BOTTOM + 0.1, top - 0.3);
				piece(0.46, 0.14, top - 0.3, top - 0.18);
				piece(0.56, 0.18, top - 0.18, top);
			}
		});
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
		const profile = wallProfile(room);
		const sign = edge.sweep > 0 ? -1 : 1;
		for (const band of this.wallBands(room)) {
			const nodes = clipProfile(profile, band.from, band.to);
			const positions: number[] = [];
			const normals: number[] = [];
			const uvs: number[] = [];
			const indices: number[] = [];
			for (let index = 1; index < nodes.length; index += 1) {
				const low = nodes[index - 1];
				const high = nodes[index];
				const rise = high.y - low.y;
				const reach = high.depth - low.depth;
				const size = Math.hypot(rise, reach) || 1;
				const start = positions.length / 3;
				for (let step = 0; step <= segments; step += 1) {
					const t = step / segments;
					const angle = edge.startAngle + edge.sweep * t;
					const cos = Math.cos(angle);
					const sin = Math.sin(angle);
					const nx = cos * sign;
					const nz = sin * sign;
					const x = edge.center.x + cos * edge.radius;
					const z = edge.center.z + sin * edge.radius;
					const u = perimeter + Math.abs(edge.sweep) * edge.radius * t;
					positions.push(
						x + nx * low.depth,
						room.floorY + low.y,
						z + nz * low.depth,
						x + nx * high.depth,
						room.floorY + high.y,
						z + nz * high.depth,
					);
					const ny = -reach / size;
					const across = rise / size;
					normals.push(
						nx * across,
						ny,
						nz * across,
						nx * across,
						ny,
						nz * across,
					);
					uvs.push(u, low.y + low.depth, u, high.y + high.depth);
					if (step < segments) {
						const base = start + step * 2;
						indices.push(base, base + 3, base + 2, base, base + 1, base + 3);
					}
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

	private addMezzanine(
		bucket: GeometryBucket,
		room: Room,
		spec: MezzanineSpec,
	): void {
		const underside = spec.floorY - SLAB_THICKNESS;
		bucket.add(
			{ texture: "oakPlanks", roughness: 0.85 },
			this.polygonGeometry(spec.deck, spec.floorY, false),
		);
		bucket.add(
			{ texture: "darkPlanks", roughness: 1 },
			this.polygonGeometry(spec.deck, underside, true),
		);
		const rail: MaterialOptions = { texture: "woodRed", roughness: 0.6 };
		const segment = (
			a: { x: number; z: number },
			b: { x: number; z: number },
			y: number,
			height: number,
			thickness: number,
			material: MaterialOptions,
		) => {
			const length = Math.hypot(b.x - a.x, b.z - a.z);
			bucket.add(
				material,
				meterBox(length, height, thickness),
				new THREE.Matrix4().compose(
					new THREE.Vector3((a.x + b.x) / 2, y, (a.z + b.z) / 2),
					new THREE.Quaternion().setFromEuler(
						new THREE.Euler(0, -Math.atan2(b.z - a.z, b.x - a.x), 0),
					),
					new THREE.Vector3(1, 1, 1),
				),
			);
		};
		for (const { a, b } of spec.rails) {
			segment(
				a,
				b,
				spec.floorY - SLAB_THICKNESS / 2,
				SLAB_THICKNESS,
				0.14,
				TRIM,
			);
			segment(a, b, spec.floorY + 1.02, 0.07, 0.11, rail);
			segment(a, b, spec.floorY + 0.14, 0.05, 0.07, rail);
			const length = Math.hypot(b.x - a.x, b.z - a.z);
			const balusters = Math.floor(length / 0.42);
			for (let index = 1; index < balusters; index += 1) {
				const t = index / balusters;
				bucket.add(
					rail,
					meterBox(0.05, 0.86, 0.05),
					new THREE.Matrix4().makeTranslation(
						a.x + (b.x - a.x) * t,
						spec.floorY + 0.58,
						a.z + (b.z - a.z) * t,
					),
				);
			}
		}
		const stone = carvedForSeed(room.seed);
		const roof = this.roofFor(room);
		for (const post of spec.posts) {
			const top = roof ? roof.heightAt(post.x, post.z) : room.ceilingY;
			const upper = top - spec.floorY;
			bucket.add(
				stone,
				meterCylinder(
					MEZZANINE_POST_RADIUS * 0.82,
					MEZZANINE_POST_RADIUS * 0.9,
					upper,
					12,
				),
				new THREE.Matrix4().makeTranslation(
					post.x,
					spec.floorY + upper / 2,
					post.z,
				),
			);
			bucket.add(
				TRIM,
				meterBox(0.5, 0.14, 0.5),
				new THREE.Matrix4().makeTranslation(post.x, spec.floorY + 0.07, post.z),
			);
			bucket.add(
				TRIM,
				meterBox(0.46, 0.14, 0.46),
				new THREE.Matrix4().makeTranslation(post.x, top - 0.07, post.z),
			);
			const height = underside - room.floorY;
			bucket.add(
				stone,
				meterCylinder(
					MEZZANINE_POST_RADIUS,
					MEZZANINE_POST_RADIUS + 0.04,
					height,
					12,
				),
				new THREE.Matrix4().makeTranslation(
					post.x,
					room.floorY + height / 2,
					post.z,
				),
			);
			bucket.add(
				TRIM,
				meterBox(0.56, 0.16, 0.56),
				new THREE.Matrix4().makeTranslation(post.x, underside - 0.08, post.z),
			);
		}
		const inner = {
			x: (spec.stairSide.a.x + spec.stairSide.b.x) / 2 - spec.stair.origin.x,
			z: (spec.stairSide.a.z + spec.stairSide.b.z) / 2 - spec.stair.origin.z,
		};
		this.addStairs(
			bucket,
			room,
			spec.stair,
			spec.stairSideOuter
				? 0
				: inner.x * spec.stair.right.x + inner.z * spec.stair.right.z >= 0
					? 1
					: -1,
		);
	}

	private addStairs(
		bucket: GeometryBucket,
		room: Room,
		stair: StairSpec,
		railDirection: 1 | -1 | 0 = 1,
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
		for (const direction of railDirection === 0 ? [1, -1] : [railDirection]) {
			const railSide = (stair.width / 2 - 0.08) * direction;
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
	}

	private addFurniture(
		bucket: GeometryBucket,
		room: Room,
		group: THREE.Group,
		animated: AnimatedDecor[],
	): void {
		const items = this.layout.furniture.filter(
			(item) => item.roomId === room.id,
		);
		for (const item of items) {
			const builder = builderFor(item.kind);
			const parts = builder({ item, room, rng: new SeededRandom(item.seed) });
			const quaternion = new THREE.Quaternion().setFromEuler(
				new THREE.Euler(0, -item.rotation, 0),
			);
			const position = new THREE.Vector3(item.x, item.y, item.z);
			const matrix = new THREE.Matrix4().compose(
				position,
				quaternion,
				new THREE.Vector3(1, 1, 1),
			);
			const whole = wholeItemAnimation(item);
			const moving = new Map<PartAnimation, Part[]>();
			parts.forEach((part, index) => {
				separateCoplanarFaces(part.geometry, index);
				const animation = whole ?? part.animation;
				if (animation) {
					moving.set(animation, [...(moving.get(animation) ?? []), part]);
				} else {
					bucket.add(part.material, part.geometry, matrix);
				}
			});
			for (const [animation, moved] of moving) {
				const [px, py, pz] = animation.pivot;
				const assembly = new GeometryBucket(this.materials);
				for (const part of moved) {
					part.geometry.translate(-px, -py, -pz);
					assembly.add(part.material, part.geometry);
				}
				const holder = new THREE.Group();
				holder.position
					.set(px, py, pz)
					.applyQuaternion(quaternion)
					.add(position);
				holder.quaternion.copy(quaternion);
				for (const mesh of assembly.toMeshes()) {
					holder.add(mesh);
				}
				group.add(holder);
				animated.push({ holder, base: quaternion.clone(), animation });
			}
		}
	}
}

export function roomOutlinePoints(room: Room): { x: number; z: number }[] {
	return tessellateOutline(room.edges);
}
