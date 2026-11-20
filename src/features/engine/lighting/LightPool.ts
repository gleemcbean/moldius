import { EYE_HEIGHT_STANDING } from "@shared/config/index";
import { floorsSeenFromEye, levelForHeight } from "@shared/manor/levels";
import { pointInPolygon } from "@shared/manor/polygon";
import type { Level, LightSource, Room } from "@shared/manor/types";
import * as THREE from "three";

export interface DynamicLight {
	id: string;
	position: THREE.Vector3;
	color: number;
	intensity: number;
	radius: number;
	priority: number;
	flicker: number;
	pulse?: number;
	level?: Level;
	spansFloors?: boolean;
	openGallery?: boolean;
}

type FloorView = "seen" | "through" | "hidden";

interface Slot {
	light: THREE.PointLight;
	sourceId: string | null;
	source: DynamicLight | null;
	gain: number;
	weight: number;
}

interface Wanted {
	light: DynamicLight;
	gain: number;
}

interface RoomGroup {
	members: DynamicLight[];
	merged: DynamicLight;
	spread: number;
	total: number;
}

interface Unit {
	light: DynamicLight;
	group: RoomGroup | null;
	score: number;
}

const KIND_FLICKER: Record<LightSource["kind"], number> = {
	candle: 0.26,
	chandelier: 0.14,
	fire: 0.3,
	lamp: 0.06,
	cauldron: 0.12,
	glow: 0.04,
	moon: 0,
};

const KIND_PULSE: Partial<Record<LightSource["kind"], number>> = {
	glow: 0.32,
};

const PULSE_SPEED = 1.15;
const INTENSITY_SCALE = 4.2;
const SPANNING_LIGHT_REACH = 5;
const THROUGH_FLOOR_HEIGHT = 3.2;
const THROUGH_FLOOR_PENALTY = 0.25;
const REACH_BEYOND_RADIUS = 30;
const DETAIL_NEAR = 4;
const DETAIL_FAR = 10;
const MERGED_GAIN = 0.7;
const MERGED_GAIN_RANGE = [0.3, 1.2] as const;
const CALIBRATION_STEPS = 6;
const CALIBRATION_HEIGHTS = [0.4, 1.5];
const KEEP_BONUS = 1.35;
const DETAIL_SHARE = 1 / 3;
const CROWD_BONUS = 0.25;
const KEPT_DETAIL_BIAS = 0.8;
const FADE_PER_SECOND = 1.6;

function smoothstep(edge0: number, edge1: number, value: number): number {
	const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));

	return t * t * (3 - 2 * t);
}

function falloff(distance: number, radius: number): number {
	const fade = Math.min(1, Math.max(0, 1 - (distance / radius) ** 4));

	return (fade * fade) / Math.max(distance * distance, 0.01);
}

function calibrate(
	room: Room | undefined,
	members: DynamicLight[],
	merged: DynamicLight,
	total: number,
): number {
	if (!room) {
		return MERGED_GAIN;
	}

	const { bounds } = room;
	const point = new THREE.Vector3();
	let separate = 0;
	let joined = 0;

	for (let i = 0; i < CALIBRATION_STEPS; i += 1) {
		for (let j = 0; j < CALIBRATION_STEPS; j += 1) {
			const x =
				bounds.minX +
				((i + 0.5) / CALIBRATION_STEPS) * (bounds.maxX - bounds.minX);

			const z =
				bounds.minZ +
				((j + 0.5) / CALIBRATION_STEPS) * (bounds.maxZ - bounds.minZ);

			if (!pointInPolygon({ x, z }, room.polygon)) {
				continue;
			}

			for (const height of CALIBRATION_HEIGHTS) {
				point.set(x, room.floorY + height, z);

				for (const light of members) {
					separate +=
						light.intensity *
						falloff(point.distanceTo(light.position), light.radius);
				}

				joined +=
					total * falloff(point.distanceTo(merged.position), merged.radius);
			}
		}
	}

	if (separate <= 0 || joined <= 0) {
		return MERGED_GAIN;
	}

	return Math.min(
		MERGED_GAIN_RANGE[1],
		Math.max(MERGED_GAIN_RANGE[0], separate / joined),
	);
}

function mergeRoom(
	roomId: number,
	members: DynamicLight[],
	room: Room | undefined,
): RoomGroup {
	const total = members.reduce((sum, light) => sum + light.intensity, 0) || 1;
	const position = new THREE.Vector3();
	const color = new THREE.Color(0, 0, 0);
	const tint = new THREE.Color();
	let flicker = 0;
	let pulse = 0;

	for (const light of members) {
		const share = light.intensity / total;

		position.addScaledVector(light.position, share);
		color.add(tint.setHex(light.color).multiplyScalar(share));

		flicker += light.flicker * share;
		pulse += (light.pulse ?? 0) * share;
	}

	const spread = Math.max(
		...members.map((light) => light.position.distanceTo(position)),
	);

	const first = members[0];

	const merged: DynamicLight = {
		id: `room-${roomId}`,
		position,
		color: color.getHex(),
		intensity: total,
		radius: Math.max(
			...members.map(
				(light) => light.radius + light.position.distanceTo(position),
			),
		),
		priority: Math.max(...members.map((light) => light.priority)),
		flicker: flicker * 0.5,
		pulse: pulse * 0.6,
		level: first.level,
		spansFloors: first.spansFloors,
		openGallery: first.openGallery,
	};

	merged.intensity = total * calibrate(room, members, merged, total);

	return { members, spread, merged, total };
}

export class LightPool {
	private readonly slots: Slot[] = [];
	private readonly staticLights: DynamicLight[];
	private readonly groups: RoomGroup[] = [];
	private readonly scratch = new THREE.Vector3();
	private time = 0;
	reduceFlicker = false;

	constructor(
		scene: THREE.Scene,
		size: number,
		sources: LightSource[],
		rooms: readonly Room[] = [],
	) {
		const spanning = new Set(
			rooms
				.filter((room) => room.type === "stairwell" || room.mezzanine)
				.map((room) => room.id),
		);

		const galleries = new Set(
			rooms.filter((room) => room.mezzanine).map((room) => room.id),
		);

		for (let index = 0; index < size; index += 1) {
			const light = new THREE.PointLight(0xffffff, 0, 6, 2);

			light.visible = true;

			scene.add(light);

			this.slots.push({
				light,
				sourceId: null,
				source: null,
				gain: 0,
				weight: 0,
			});
		}

		this.staticLights = sources.map((source) => ({
			id: `static-${source.id}`,
			position: new THREE.Vector3(
				source.position.x,
				source.position.y,
				source.position.z,
			),
			color: source.color,
			intensity: source.intensity * INTENSITY_SCALE,
			radius: source.radius,
			priority: source.kind === "moon" ? 0.7 : 1,
			flicker: KIND_FLICKER[source.kind],
			pulse: KIND_PULSE[source.kind] ?? 0,
			level: source.level,
			spansFloors: spanning.has(source.roomId),
			openGallery: galleries.has(source.roomId),
		}));

		const byRoom = new Map<number, DynamicLight[]>();

		sources.forEach((source, index) => {
			const list = byRoom.get(source.roomId);

			if (list) {
				list.push(this.staticLights[index]);
			} else {
				byRoom.set(source.roomId, [this.staticLights[index]]);
			}
		});

		for (const [roomId, members] of byRoom) {
			this.groups.push(
				members.length > 1
					? mergeRoom(
							roomId,
							members,
							rooms.find((room) => room.id === roomId),
						)
					: {
							members,
							merged: members[0],
							spread: 0,
							total: members[0].intensity,
						},
			);
		}
	}

	update(
		camera: THREE.Vector3,
		dynamicLights: DynamicLight[],
		dt: number,
	): void {
		this.time += dt;

		const size = this.slots.length;
		const units: Unit[] = [];

		for (const light of dynamicLights) {
			const score =
				this.score(light, camera) * (this.holds(light.id) ? KEEP_BONUS : 1);

			if (score > 0) {
				units.push({ light, group: null, score });
			}
		}

		for (const group of this.groups) {
			const kept =
				this.holds(group.merged.id) ||
				group.members.some((light) => this.holds(light.id));

			const strongest = Math.max(
				...group.members.map((light) => this.score(light, camera)),
			);

			const score =
				strongest *
				(1 + Math.log2(group.members.length) * CROWD_BONUS) *
				(kept ? KEEP_BONUS : 1);

			if (score > 0) {
				units.push({ light: group.merged, group, score });
			}
		}

		units.sort((a, b) => b.score - a.score);

		const chosen = units.slice(
			0,
			Math.max(1, size - Math.floor(size * DETAIL_SHARE)),
		);

		let spare = size - chosen.length;
		const wanted = new Map<string, Wanted>();

		for (const unit of chosen) {
			const group = unit.group;

			if (!group || group.members.length === 1) {
				wanted.set(unit.light.id, { light: unit.light, gain: 1 });
				continue;
			}

			spare = this.detail(group, camera, spare, wanted);
		}

		const fade = dt * FADE_PER_SECOND;

		for (const slot of this.slots) {
			if (slot.sourceId && !wanted.has(slot.sourceId)) {
				slot.weight = Math.max(0, slot.weight - fade);

				if (slot.weight === 0 || !slot.source) {
					slot.sourceId = null;
					slot.source = null;
					slot.light.intensity = 0;
				} else {
					this.apply(slot, slot.source, slot.gain);
				}
			}
		}

		for (const [id, entry] of wanted) {
			let slot = this.slots.find((candidate) => candidate.sourceId === id);

			if (slot) {
				slot.gain += Math.max(-fade, Math.min(fade, entry.gain - slot.gain));
			} else {
				slot = this.slots.find((candidate) => candidate.sourceId === null);

				if (!slot) {
					continue;
				}

				slot.sourceId = id;
				slot.weight = 0;
				slot.gain = entry.gain;

				slot.light.position.copy(entry.light.position);
			}

			slot.weight = Math.min(1, slot.weight + fade);
			slot.source = entry.light;

			this.apply(slot, entry.light, slot.gain);
		}
	}

	private holds(id: string): boolean {
		return this.slots.some((slot) => slot.sourceId === id);
	}

	private detail(
		group: RoomGroup,
		camera: THREE.Vector3,
		spare: number,
		wanted: Map<string, Wanted>,
	): number {
		const away = Math.max(
			0,
			group.merged.position.distanceTo(camera) - group.spread,
		);

		const blend = smoothstep(DETAIL_NEAR, DETAIL_FAR, away);
		const count = blend < 1 ? Math.min(group.members.length, spare) : 0;

		const shown = group.members
			.map((light) => ({
				light,
				distance:
					light.position.distanceTo(camera) *
					(this.holds(light.id) ? KEPT_DETAIL_BIAS : 1),
			}))
			.sort((a, b) => a.distance - b.distance)
			.slice(0, count)
			.map((entry) => entry.light);

		let visible = 0;

		for (const light of shown) {
			wanted.set(light.id, { light, gain: 1 - blend });

			visible += light.intensity;
		}

		const remainder = blend + (1 - blend) * (1 - visible / group.total);

		if (remainder > 0.001) {
			wanted.set(group.merged.id, { light: group.merged, gain: remainder });

			return spare - count;
		}

		return spare - count + 1;
	}

	private floorView(light: DynamicLight, camera: THREE.Vector3): FloorView {
		const { lowest, highest } = floorsSeenFromEye(
			camera.y,
			EYE_HEIGHT_STANDING,
		);

		const level = light.level ?? levelForHeight(light.position.y - 1);

		if (level >= lowest && level <= highest) {
			return "seen";
		}

		return light.spansFloors &&
			Math.hypot(light.position.x - camera.x, light.position.z - camera.z) <=
				light.radius + SPANNING_LIGHT_REACH
			? "through"
			: "hidden";
	}

	private score(light: DynamicLight, camera: THREE.Vector3): number {
		const view = this.floorView(light, camera);

		if (view === "hidden") {
			return 0;
		}

		const distance = this.scratch.copy(light.position).distanceTo(camera);

		const verticalPenalty =
			view === "through" &&
			!light.openGallery &&
			Math.abs(light.position.y - camera.y) > THROUGH_FLOOR_HEIGHT
				? THROUGH_FLOOR_PENALTY
				: 1;

		if (distance > light.radius + REACH_BEYOND_RADIUS) {
			return 0;
		}

		return (
			(light.priority * verticalPenalty * light.intensity) /
			(1 + distance * distance * 0.08)
		);
	}

	private apply(slot: Slot, light: DynamicLight, gain: number): void {
		const flickerAmount = this.reduceFlicker
			? light.flicker * 0.25
			: light.flicker;

		const seed = light.position.x * 3.1 + light.position.z * 1.7;

		const flicker =
			1 -
			flickerAmount *
				(0.5 +
					0.5 *
						Math.sin(this.time * 13 + seed) *
						Math.sin(this.time * 7.3 + seed * 2));

		const breath = light.pulse
			? 1 -
				light.pulse *
					(0.5 + 0.5 * Math.sin(this.time * PULSE_SPEED + seed * 0.7))
			: 1;

		slot.light.position.copy(light.position);
		slot.light.color.setHex(light.color);

		slot.light.distance = light.radius;

		slot.light.intensity =
			light.intensity * gain * flicker * breath * slot.weight;
	}

	dispose(scene: THREE.Scene): void {
		for (const slot of this.slots) {
			scene.remove(slot.light);
			slot.light.dispose();
		}
	}
}
