import {
	LANTERN_LIGHT_INTENSITY,
	LANTERN_LIGHT_RANGE,
} from "@shared/config/index";
import { DEFAULT_HAT_PATTERN, type HatPattern } from "@shared/hatPatterns";
import { generateManor } from "@shared/manor/generateManor";
import type { ManorLayout, Room, RoomType } from "@shared/manor/types";
import { PUBLIC_MATCH_CONFIG } from "@shared/matchConfig";
import { NavGrid } from "@shared/navigation/navGrid";
import { CollisionWorld } from "@shared/physics/collisionWorld";
import { lineOfSight } from "@shared/physics/lineOfSight";
import {
	DEFAULT_PLAYER_COLOR,
	PLAYER_COLOR_CHOICES,
} from "@shared/playerColors";
import { LANTERN_TINT_COLORS } from "@shared/rewards";
import * as THREE from "three";
import {
	LANTERN_COLOR,
	MANOR_AIR_COLOR,
	MANOR_AIR_DENSITY,
	MANOR_AMBIENT_INTENSITY,
	MANOR_GROUND_LIGHT,
	MANOR_SKY_LIGHT,
} from "../../config/feel";
import {
	DEFAULT_COLOR_LEVELS,
	DEFAULT_POST_EFFECT_PRESET,
	POST_EFFECT_PRESETS,
	QUALITY_PRESETS,
} from "../../config/graphics";
import { AmbientMotes } from "../engine/effects/AmbientMotes";
import { type DynamicLight, LightPool } from "../engine/lighting/LightPool";
import { PostEffects } from "../engine/render/PostEffects";
import { DoorViews } from "../engine/world/DoorViews";
import type { AnomalyModel } from "../models/anomalies/AnomalyModel";
import { createAnomalyModel } from "../models/anomalies/createAnomalyModel";
import { MushroomModel } from "../models/MushroomModel";
import { ModelKit, modelYaw } from "../models/modelKit";
import { ManorMeshBuilder } from "../world/ManorMeshBuilder";
import { MaterialLibrary } from "../world/MaterialLibrary";
import { TextureLibrary } from "../world/textures/TextureLibrary";

export type GameMode = "classic" | "daily" | "tutorial";
export type PresenceArt = "menu" | "lobby" | "match" | "daily";

const MODE_WIDTH = 336;
const MODE_HEIGHT = 392;
const PRESENCE_SIDE = 256;
const PRESENCE_SCALE = 4;
const FIELD_OF_VIEW = 46;
const ART_SEED = 0x5eed42;
const LIGHT_SETTLE_SECONDS = 0.4;

type Look = { color: number; pattern: HatPattern; lantern?: number | null };

const BASE_LOOK: Look = {
	color: DEFAULT_PLAYER_COLOR,
	pattern: DEFAULT_HAT_PATTERN,
	lantern: null,
};

const COMPANIONS: Look[] = [
	{ color: PLAYER_COLOR_CHOICES[4], pattern: "rings" },
	{ color: PLAYER_COLOR_CHOICES[3], pattern: "swirl" },
	{
		color: PLAYER_COLOR_CHOICES[1],
		pattern: "stars",
		lantern: LANTERN_TINT_COLORS.ice,
	},
	{
		color: PLAYER_COLOR_CHOICES[2],
		pattern: "speckles",
		lantern: LANTERN_TINT_COLORS.emerald,
	},
];

interface Mood {
	tension: number;
	desaturate: number;
}

const CALM: Mood = { tension: 0, desaturate: 0 };
const WATCHFUL: Mood = { tension: 0.2, desaturate: 0 };
const GAZED: Mood = { tension: 0.45, desaturate: 0.15 };
const SPOTTED: Mood = { tension: 0.8, desaturate: 0.6 };

interface Manor {
	layout: ManorLayout;
	world: CollisionWorld;
	grid: NavGrid;
	builder: ManorMeshBuilder;
	doors: DoorViews;
}

interface Actor {
	depth: number;
	side: number;
	facing: number;
}

type CastMember = Actor &
	(
		| { kind: "self"; grimoire?: boolean; run?: boolean }
		| { kind: "mate"; look: Look }
		| {
				kind: "monster";
				species: "veilleur" | "gorgone";
				state: "chase" | "idle";
		  }
	);

interface Plate {
	rooms: readonly RoomType[];
	cozy?: boolean;
	eye: number;
	focus: number;
	cast: readonly CastMember[];
	mood: Mood;
}

interface Shot {
	room: Room;
	eye: THREE.Vector3;
	target: THREE.Vector3;
	place: (actor: Actor) => { position: THREE.Vector3; yaw: number };
}

const CANDIDATE_STEP = 0.6;

function walkable(
	grid: NavGrid,
	room: Room,
	x: number,
	z: number,
): THREE.Vector3 | null {
	for (let ring = 0; ring <= 4; ring += 1) {
		const steps = ring === 0 ? 1 : ring * 8;
		for (let step = 0; step < steps; step += 1) {
			const angle = (step / steps) * Math.PI * 2;
			const px = x + Math.cos(angle) * ring * 0.12;
			const pz = z + Math.sin(angle) * ring * 0.12;
			if (grid.isWalkablePoint({ x: px, y: room.floorY, z: pz })) {
				return new THREE.Vector3(px, room.floorY, pz);
			}
		}
	}
	return null;
}

function placements(
	manor: Manor,
	room: Room,
	eye: THREE.Vector3,
	forward: THREE.Vector2,
	cast: readonly Actor[],
): THREE.Vector3[] | null {
	const right = new THREE.Vector2(-forward.y, forward.x);
	const placed: THREE.Vector3[] = [];
	for (const actor of cast) {
		const position = walkable(
			manor.grid,
			room,
			eye.x + forward.x * actor.depth + right.x * actor.side,
			eye.z + forward.y * actor.depth + right.y * actor.side,
		);
		if (
			!position ||
			manor.world.roomAt({ x: position.x, z: position.z }, room.floorY) !==
				room ||
			placed.some((other) => other.distanceTo(position) < 0.75)
		) {
			return null;
		}
		const visible = [0.25, 0.8, 1.3].every((height) =>
			lineOfSight(
				manor.world,
				eye,
				{ x: position.x, y: position.y + height, z: position.z },
				{ ignoreFurniture: false },
			),
		);
		if (!visible) {
			return null;
		}
		placed.push(position);
	}
	return placed;
}

function furnitureAhead(
	manor: Manor,
	room: Room,
	eye: THREE.Vector3,
	forward: THREE.Vector2,
): boolean {
	return manor.layout.furniture.some((item) => {
		if (
			item.roomId !== room.id ||
			item.parentId !== null ||
			item.height < 0.45
		) {
			return false;
		}
		const dx = item.x - eye.x;
		const dz = item.z - eye.z;
		const along = dx * forward.x + dz * forward.y;
		const across = Math.abs(dx * -forward.y + dz * forward.x);
		const size = Math.max(item.width, item.depth) / 2;
		return along > -size && along < 2.7 + size && across < along * 0.5 + size;
	});
}

function frame(
	manor: Manor,
	room: Room,
	plate: Plate,
	strict: boolean,
): Shot | null {
	const { cast } = plate;
	const center = new THREE.Vector2(room.labelPoint.x, room.labelPoint.z);
	const { minX, minZ, maxX, maxZ } = room.bounds;
	let best: {
		eye: THREE.Vector3;
		forward: THREE.Vector2;
		placed: THREE.Vector3[];
		score: number;
	} | null = null;
	for (let x = minX + 0.4; x <= maxX - 0.4; x += CANDIDATE_STEP) {
		for (let z = minZ + 0.4; z <= maxZ - 0.4; z += CANDIDATE_STEP) {
			const ground = walkable(manor.grid, room, x, z);
			if (
				!ground ||
				manor.world.roomAt({ x: ground.x, z: ground.z }, room.floorY) !== room
			) {
				continue;
			}
			const forward = center.clone().sub(new THREE.Vector2(ground.x, ground.z));
			if (forward.length() < 1.5) {
				continue;
			}
			forward.normalize();
			const eye = new THREE.Vector3(
				ground.x,
				room.floorY + Math.min(plate.eye, room.height - 0.4),
				ground.z,
			);
			const right = new THREE.Vector2(-forward.y, forward.x);
			const clear = [1, 1.8, 2.4].every((ahead) =>
				[-0.75, -0.35, 0, 0.35, 0.75].every((spread) =>
					(strict ? [0.3, 0.6, 1.5] : [0.6, 1.5]).every((height) =>
						lineOfSight(
							manor.world,
							eye,
							{
								x: eye.x + forward.x * ahead + right.x * spread * ahead,
								y: room.floorY + height,
								z: eye.z + forward.y * ahead + right.y * spread * ahead,
							},
							{ ignoreFurniture: false },
						),
					),
				),
			);
			if (!clear || (strict && furnitureAhead(manor, room, eye, forward))) {
				continue;
			}
			const placed = placements(manor, room, eye, forward, cast);
			if (!placed) {
				continue;
			}
			const score = center.distanceTo(new THREE.Vector2(eye.x, eye.z));
			if (!best || score > best.score) {
				best = { eye, forward, placed, score };
			}
		}
	}
	if (!best) {
		return null;
	}
	const { eye, forward, placed } = best;
	const focus = cast.reduce((sum, actor) => sum + actor.depth, 0) / cast.length;
	const target = new THREE.Vector3(
		eye.x + forward.x * focus,
		room.floorY + plate.focus,
		eye.z + forward.y * focus,
	);
	return {
		room,
		eye,
		target,
		place: (actor) => {
			const index = cast.indexOf(actor as CastMember);
			const position = (placed[index] ?? placed[0]).clone();
			const toCamera = Math.atan2(eye.x - position.x, eye.z - position.z);
			return { position, yaw: toCamera + actor.facing + Math.PI };
		},
	};
}

function posed(model: AnomalyModel, state: "chase" | "idle"): void {
	for (let step = 0; step < 8; step += 1) {
		model.update({
			state,
			stateMs: 900,
			extra: 0,
			speed: state === "chase" ? 2.5 : 0,
			dt: 0.05,
			time: 1.3 + step * 0.05,
		});
	}
}

class Stage {
	readonly scene = new THREE.Scene();
	readonly camera: THREE.PerspectiveCamera;
	private readonly lights: DynamicLight[] = [];
	private readonly pool: LightPool;
	private readonly motes = new AmbientMotes();
	private readonly disposers: (() => void)[] = [];

	constructor(
		private readonly manor: Manor,
		private readonly kit: ModelKit,
		readonly shot: Shot,
		aspect: number,
	) {
		this.camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, aspect, 0.05, 40);
		this.scene.background = new THREE.Color(MANOR_AIR_COLOR);
		this.scene.fog = new THREE.FogExp2(MANOR_AIR_COLOR, MANOR_AIR_DENSITY);
		this.scene.add(
			new THREE.HemisphereLight(
				MANOR_SKY_LIGHT,
				MANOR_GROUND_LIGHT,
				MANOR_AMBIENT_INTENSITY,
			),
		);
		const { layout, builder } = manor;
		const shown = new Set([shot.room.id]);
		for (const openingId of shot.room.openingIds) {
			const opening = layout.openings[openingId];
			shown.add(opening.roomA);
			shown.add(opening.roomB);
		}
		for (const id of shown) {
			const room = layout.rooms[id];
			if (room) {
				this.scene.add(builder.buildRoom(room).group);
			}
		}
		this.scene.add(manor.doors.group);
		this.pool = new LightPool(
			this.scene,
			QUALITY_PRESETS.high.lightPool,
			layout.lights.filter((light) => shown.has(light.roomId)),
			layout.rooms,
		);
		this.scene.add(this.motes.points);
		this.camera.position.copy(shot.eye);
		this.camera.lookAt(shot.target);
	}

	addMushroom(
		look: Look,
		actor: Actor,
		pose: { grimoire?: boolean; run?: boolean } = {},
	): MushroomModel {
		const model = new MushroomModel(
			this.kit,
			look.color,
			look.pattern,
			look.lantern ?? null,
		);
		for (let step = 0; step < 10; step += 1) {
			model.update(0.05, {
				speed: pose.run ? 5.2 : 0,
				crouch: 0,
				grounded: true,
				sprinting: pose.run ?? false,
				lanternOpen: true,
				grimoireOpen: pose.grimoire ?? false,
				dead: false,
				talking: 0,
			});
		}
		const { position, yaw } = this.shot.place(actor);
		model.root.position.copy(position);
		model.root.rotation.y = modelYaw(yaw);
		this.scene.add(model.root);
		model.root.updateMatrixWorld(true);
		this.lights.push({
			id: `lantern-${this.lights.length}`,
			position: model.lanternLightPosition.clone(),
			color: look.lantern ?? LANTERN_COLOR,
			intensity: LANTERN_LIGHT_INTENSITY,
			radius: LANTERN_LIGHT_RANGE,
			priority: 4,
			flicker: 0.12,
		});
		this.disposers.push(() => model.dispose());
		return model;
	}

	addMonster(
		species: "veilleur" | "gorgone",
		actor: Actor,
		state: "chase" | "idle",
	): AnomalyModel {
		const model = createAnomalyModel(species, this.kit);
		posed(model, state);
		const { position, yaw } = this.shot.place(actor);
		model.root.position.copy(position);
		model.root.rotation.y = modelYaw(yaw);
		this.scene.add(model.root);
		model.root.updateMatrixWorld(true);
		const glow = model.glow;
		if (glow) {
			this.lights.push({
				id: `anomaly-${this.lights.length}`,
				position: glow.offset
					.clone()
					.applyQuaternion(model.root.quaternion)
					.add(model.root.position),
				color: glow.color,
				intensity: glow.intensity,
				radius: glow.radius,
				priority: 2,
				flicker: 0.1,
			});
		}
		this.disposers.push(() => model.dispose());
		return model;
	}

	settle(): void {
		this.pool.update(this.camera.position, this.lights, LIGHT_SETTLE_SECONDS);
		this.motes.update(LIGHT_SETTLE_SECONDS, this.camera.position);
	}

	dispose(): void {
		this.scene.remove(this.manor.doors.group);
		this.pool.dispose(this.scene);
		this.motes.dispose();
		for (const dispose of this.disposers) {
			dispose();
		}
		this.scene.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
			}
		});
	}
}

const CHASE: CastMember[] = [
	{ kind: "self", run: true, depth: 2.9, side: 0.45, facing: 0.1 },
	{
		kind: "monster",
		species: "veilleur",
		state: "chase",
		depth: 4.8,
		side: -0.8,
		facing: -0.15,
	},
];

const STANDOFF: CastMember[] = [
	{
		kind: "monster",
		species: "gorgone",
		state: "idle",
		depth: 5.2,
		side: -0.1,
		facing: 0,
	},
	{ kind: "self", depth: 3, side: 0.9, facing: Math.PI + 0.3 },
	{
		kind: "mate",
		look: COMPANIONS[0],
		depth: 3.3,
		side: -0.95,
		facing: Math.PI - 0.3,
	},
	{
		kind: "mate",
		look: COMPANIONS[1],
		depth: 4.3,
		side: 1.3,
		facing: Math.PI + 0.6,
	},
];

const READING: CastMember[] = [
	{ kind: "self", grimoire: true, depth: 2.8, side: 0, facing: -0.4 },
];

const LANTERN_BEARER: CastMember[] = [
	{ kind: "self", depth: 2.2, side: 0, facing: 0.35 },
];

const GATHERING: CastMember[] = [
	{ kind: "self", depth: 2.6, side: -0.15, facing: 0.15 },
	{
		kind: "mate",
		look: COMPANIONS[2],
		depth: 3.2,
		side: -1.05,
		facing: -0.5,
	},
	{
		kind: "mate",
		look: COMPANIONS[0],
		depth: 3.3,
		side: 0.9,
		facing: 0.6,
	},
	{
		kind: "mate",
		look: COMPANIONS[3],
		depth: 4.1,
		side: 0.05,
		facing: -0.1,
	},
];

const MODE_PLATES: Record<GameMode, Plate> = {
	classic: {
		rooms: ["salon", "dining", "library", "hall", "music"],
		eye: 1.35,
		focus: 0.9,
		cast: CHASE,
		mood: SPOTTED,
	},
	daily: {
		rooms: ["gallery", "hall", "chapel", "ritual", "salon"],
		eye: 2.45,
		focus: 0.55,
		cast: STANDOFF,
		mood: GAZED,
	},
	tutorial: {
		rooms: ["study", "library", "alchemy", "bedroom", "curiosities"],
		cozy: true,
		eye: 0.85,
		focus: 0.85,
		cast: READING,
		mood: CALM,
	},
};

const PRESENCE_PLATES: Record<PresenceArt, Plate> = {
	menu: {
		rooms: ["salon", "library", "hall", "study"],
		eye: 1.05,
		focus: 0.85,
		cast: LANTERN_BEARER,
		mood: WATCHFUL,
	},
	lobby: {
		rooms: ["hall", "dining", "ballroom", "salon"],
		eye: 1.7,
		focus: 0.7,
		cast: GATHERING,
		mood: CALM,
	},
	match: { ...MODE_PLATES.classic, rooms: ["dining", "hall", "salon"] },
	daily: { ...MODE_PLATES.daily, rooms: ["chapel", "ritual", "gallery"] },
};

function stageFor(manor: Manor, plate: Plate, taken: Set<number>): Shot | null {
	const rooms = manor.layout.rooms.filter(
		(room) =>
			room.level === 0 && room.type !== "corridor" && !taken.has(room.id),
	);
	const preferred = plate.rooms.flatMap((type) =>
		rooms
			.filter((room) => room.type === type)
			.sort((a, b) => (plate.cozy ? a.area - b.area : b.area - a.area)),
	);
	const others = rooms
		.filter((room) => !preferred.includes(room))
		.sort((a, b) => b.area - a.area);
	for (const strict of [true, false]) {
		for (const room of [...preferred, ...others]) {
			const shot = frame(manor, room, plate, strict);
			if (shot) {
				return shot;
			}
		}
	}
	return null;
}

function perform(stage: Stage, cast: readonly CastMember[]): void {
	for (const member of cast) {
		if (member.kind === "monster") {
			stage.addMonster(member.species, member, member.state);
		} else {
			stage.addMushroom(
				member.kind === "self" ? BASE_LOOK : member.look,
				member,
				member.kind === "self"
					? { grimoire: member.grimoire, run: member.run }
					: {},
			);
		}
	}
	stage.settle();
}

function enlarge(source: HTMLCanvasElement, scale: number): string {
	if (scale === 1) {
		return source.toDataURL("image/png");
	}
	const canvas = document.createElement("canvas");
	canvas.width = source.width * scale;
	canvas.height = source.height * scale;
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Contexte 2D indisponible");
	}
	context.imageSmoothingEnabled = false;
	context.drawImage(source, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL("image/png");
}

async function drawPlates<Name extends string>(
	plates: Record<Name, Plate>,
	width: number,
	height: number,
	scale = 1,
): Promise<Record<Name, string>> {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: false,
		powerPreference: "low-power",
		preserveDrawingBuffer: true,
	});
	renderer.setPixelRatio(1);
	renderer.setSize(width, height, false);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1;
	const post = new PostEffects(renderer, 0);
	const textures = new TextureLibrary(
		Math.min(
			QUALITY_PRESETS.high.textureAnisotropy,
			renderer.capabilities.getMaxAnisotropy(),
		),
	);
	const materials = new MaterialLibrary(textures);
	const kit = new ModelKit(materials);
	const layout = generateManor(ART_SEED, {
		...PUBLIC_MATCH_CONFIG,
		manorSize: "medium",
		floors: 0,
	});
	const doors = new DoorViews(layout, kit);
	doors.update(10);
	const world = new CollisionWorld(layout);
	const manor: Manor = {
		layout,
		world,
		grid: new NavGrid(world),
		builder: new ManorMeshBuilder(layout, materials),
		doors,
	};
	try {
		const result = {} as Record<Name, string>;
		const taken = new Set<number>();
		for (const name of Object.keys(plates) as Name[]) {
			const plate = plates[name];
			const shot = stageFor(manor, plate, taken);
			if (!shot) {
				throw new Error(`Pas de salle pour l'illustration ${name}`);
			}
			taken.add(shot.room.id);
			const stage = new Stage(manor, kit, shot, width / height);
			perform(stage, plate.cast);
			post.render(
				{
					dt: 1,
					effects: POST_EFFECT_PRESETS[DEFAULT_POST_EFFECT_PRESET],
					tension: plate.mood.tension,
					animated: false,
					colorLevels: DEFAULT_COLOR_LEVELS,
					desaturate: plate.mood.desaturate,
				},
				() => renderer.render(stage.scene, stage.camera),
			);
			result[name] = enlarge(canvas, scale);
			stage.dispose();
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		return result;
	} finally {
		post.dispose();
		materials.dispose();
		textures.dispose();
		renderer.dispose();
		renderer.forceContextLoss();
	}
}

export function drawModeArt(): Promise<Record<GameMode, string>> {
	return drawPlates(MODE_PLATES, MODE_WIDTH, MODE_HEIGHT);
}

export function drawPresenceArt(): Promise<Record<PresenceArt, string>> {
	return drawPlates(
		PRESENCE_PLATES,
		PRESENCE_SIDE,
		PRESENCE_SIDE,
		PRESENCE_SCALE,
	);
}
