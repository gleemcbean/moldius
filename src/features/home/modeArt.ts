import type { HatPattern } from "@shared/hatPatterns";
import { generateManor } from "@shared/manor/generateManor";
import type { ManorLayout, Room, RoomType } from "@shared/manor/types";
import { PUBLIC_MATCH_CONFIG } from "@shared/matchConfig";
import { NavGrid } from "@shared/navigation/navGrid";
import { CollisionWorld } from "@shared/physics/collisionWorld";
import { lineOfSight } from "@shared/physics/lineOfSight";
import { PLAYER_COLOR_CHOICES } from "@shared/playerColors";
import * as THREE from "three";
import { DoorViews } from "../engine/world/DoorViews";
import type { AnomalyModel } from "../models/anomalies/AnomalyModel";
import { createAnomalyModel } from "../models/anomalies/createAnomalyModel";
import { MushroomModel } from "../models/MushroomModel";
import { ModelKit, modelYaw } from "../models/modelKit";
import { ManorMeshBuilder } from "../world/ManorMeshBuilder";
import { MaterialLibrary } from "../world/MaterialLibrary";
import { TextureLibrary } from "../world/textures/TextureLibrary";

export type GameMode = "classic" | "daily" | "tutorial";

export interface ModeArtLook {
	color: number;
	pattern: HatPattern;
	/** La couleur de la flamme (null : celle d'origine). */
	lantern: number | null;
}

/** Petites images, agrandies sans lissage : le même grain que le jeu. */
const WIDTH = 168;
const HEIGHT = 196;
const DEFAULT_FLAME = 0xffb060;
/** Comme le pool de lumières du jeu (LightPool). */
const LIGHT_SCALE = 4.2;
const ART_SEED = 0x5eed42;

type Look = { color: number; pattern: HatPattern; lantern?: number | null };

/** Les autres chasseurs des illustrations, chacun son chapeau. */
const COMPANIONS: Look[] = [
	{ color: PLAYER_COLOR_CHOICES[4], pattern: "rings" },
	{ color: PLAYER_COLOR_CHOICES[3], pattern: "swirl" },
];

/** Le genre de salle de chaque mode, par ordre de préférence. */
const ROOMS: Record<GameMode, readonly RoomType[]> = {
	classic: ["salon", "dining", "library", "hall", "music"],
	daily: ["gallery", "hall", "chapel", "ritual", "salon"],
	tutorial: ["study", "library", "alchemy", "bedroom", "curiosities"],
};

interface Manor {
	layout: ManorLayout;
	world: CollisionWorld;
	grid: NavGrid;
	builder: ManorMeshBuilder;
	doors: DoorViews;
}

interface Actor {
	/** Distance à la caméra, en mètres. */
	depth: number;
	/** Décalage vers la droite de l'image, en mètres. */
	side: number;
	/** 0 : face à la caméra ; Math.PI : de dos. */
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

interface Shot {
	room: Room;
	eye: THREE.Vector3;
	target: THREE.Vector3;
	place: (actor: Actor) => { position: THREE.Vector3; yaw: number };
}

/** Assez haut pour voir par-dessus les chapeaux ; plus bas pour une fuite, face au champignon. */
const EYE_HEIGHTS: Record<GameMode, number> = {
	classic: 1.35,
	daily: 2.45,
	tutorial: 2.45,
};
const CANDIDATE_STEP = 0.6;

/** Le point marchable le plus proche, à moins d'un demi-mètre : sinon, pas de place. */
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

/** Où chacun se tient vu de cette caméra, ou null si un meuble ou un mur le cache. */
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

/** Un meuble assez haut au premier plan (une table, un lit) : il boucherait l'image. */
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

/**
 * La caméra : un point de la salle d'où toute la scène se voit, sans meuble ni mur devant.
 * On essaie chaque point marchable, tourné vers le centre de la salle.
 */
function frame(
	manor: Manor,
	room: Room,
	cast: readonly Actor[],
	strict: boolean,
	eyeHeight: number,
): Shot | null {
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
				room.floorY + Math.min(eyeHeight, room.height - 0.4),
				ground.z,
			);
			// Rien juste devant l'objectif : un meuble de près mangerait l'image.
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
			// Le plus de profondeur derrière la scène : le fond de la salle se voit.
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
		room.floorY + (eyeHeight > 2 ? 0.55 : 1),
		eye.z + forward.y * focus,
	);
	return {
		room,
		eye,
		target,
		place: (actor) => {
			const index = cast.indexOf(actor);
			const position = (placed[index] ?? placed[0]).clone();
			const toCamera = Math.atan2(eye.x - position.x, eye.z - position.z);
			// Les modèles regardent à l'opposé de leur angle : on retourne pour que 0 fasse face.
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
	readonly camera = new THREE.PerspectiveCamera(46, WIDTH / HEIGHT, 0.05, 40);
	private readonly disposers: (() => void)[] = [];

	constructor(
		private readonly manor: Manor,
		private readonly kit: ModelKit,
		readonly shot: Shot,
	) {
		this.scene.background = new THREE.Color(0x140c07);
		this.scene.fog = new THREE.FogExp2(0x140c07, 0.06);
		this.scene.add(new THREE.HemisphereLight(0xa4907c, 0x44301e, 1.5));
		const { layout, builder } = manor;
		// La salle et ses voisines, qu'on aperçoit par les portes.
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
		for (const light of layout.lights) {
			if (light.roomId !== shot.room.id) {
				continue;
			}
			const point = new THREE.PointLight(
				light.color,
				light.intensity * LIGHT_SCALE * 0.8,
				light.radius,
				2,
			);
			point.position.set(light.position.x, light.position.y, light.position.z);
			this.scene.add(point);
		}
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
		const light = new THREE.PointLight(
			look.lantern ?? DEFAULT_FLAME,
			4.5,
			6,
			1.6,
		);
		light.position.copy(model.lanternLightPosition);
		this.scene.add(light);
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
			const light = new THREE.PointLight(
				glow.color,
				glow.intensity * 2.4,
				glow.radius * 1.4,
				1.6,
			);
			light.position
				.copy(glow.offset)
				.applyQuaternion(model.root.quaternion)
				.add(model.root.position);
			this.scene.add(light);
		}
		this.disposers.push(() => model.dispose());
		return model;
	}

	addLight(color: number, intensity: number, at: THREE.Vector3): void {
		const light = new THREE.PointLight(color, intensity, 7, 1.6);
		light.position.copy(at);
		this.scene.add(light);
	}

	dispose(): void {
		// Les portes servent aux trois images : on les retire avant de tout libérer.
		this.scene.remove(this.manor.doors.group);
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

/** Partie classique : un champignon fuit vers nous, lanterne au poing, un Réverbère sur ses talons. */
const CLASSIC: CastMember[] = [
	{ kind: "self", run: true, depth: 2.9, side: 0.3, facing: 0.1 },
	{
		kind: "monster",
		species: "veilleur",
		state: "chase",
		depth: 5.3,
		side: -0.45,
		facing: -0.15,
	},
];

/** Mode du jour : le même manoir pour tous, plusieurs chasseurs devant une Pleureuse. */
const DAILY: CastMember[] = [
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

/** Tutoriel : seul dans un cabinet, grimoire ouvert à la lumière de la lanterne. */
const TUTORIAL: CastMember[] = [
	{ kind: "self", grimoire: true, depth: 2.9, side: 0, facing: 0.5 },
];

const CASTS: Record<GameMode, CastMember[]> = {
	classic: CLASSIC,
	daily: DAILY,
	tutorial: TUTORIAL,
};

/** Une salle du bon genre où la scène tient, sinon la plus grande où elle tient. */
function stageFor(
	manor: Manor,
	mode: GameMode,
	taken: Set<number>,
): Shot | null {
	const rooms = manor.layout.rooms.filter(
		(room) =>
			room.level === 0 && room.type !== "corridor" && !taken.has(room.id),
	);
	const preferred = ROOMS[mode].flatMap((type) =>
		rooms
			.filter((room) => room.type === type)
			.sort((a, b) =>
				mode === "tutorial" ? a.area - b.area : b.area - a.area,
			),
	);
	const others = rooms
		.filter((room) => !preferred.includes(room))
		.sort((a, b) => b.area - a.area);
	for (const strict of [true, false]) {
		for (const room of [...preferred, ...others]) {
			const shot = frame(manor, room, CASTS[mode], strict, EYE_HEIGHTS[mode]);
			if (shot) {
				return shot;
			}
		}
	}
	return null;
}

function perform(stage: Stage, mode: GameMode, look: ModeArtLook): void {
	for (const member of CASTS[mode]) {
		if (member.kind === "monster") {
			stage.addMonster(member.species, member, member.state);
			if (member.species === "veilleur") {
				// Une lueur froide sur lui : sa silhouette se découpe au fond de la salle.
				const above = stage.shot.place(member).position;
				above.y += 2.2;
				stage.addLight(0x8fa6c8, 6, above);
			}
			if (member.species === "gorgone") {
				const above = stage.shot.place(member).position;
				above.y += 2.6;
				stage.addLight(0xffd36a, 9, above);
			}
		} else {
			const model = stage.addMushroom(
				member.kind === "self" ? look : member.look,
				member,
				member.kind === "self"
					? { grimoire: member.grimoire, run: member.run }
					: {},
			);
			if (member.kind === "self" && member.grimoire) {
				const page = model.root.position.clone();
				page.y += 1.1;
				stage.addLight(0xb9a8ff, 1.6, page);
			}
		}
	}
}

function lookKey(look: ModeArtLook): string {
	return `${look.color}-${look.pattern}-${look.lantern}`;
}

let cached: { key: string; art: Promise<Record<GameMode, string>> } | null =
	null;

/** Les trois images, une fois par apparence du joueur (il y figure). */
export function loadModeArt(
	look: ModeArtLook,
): Promise<Record<GameMode, string>> {
	const key = lookKey(look);
	if (cached?.key !== key) {
		const art = drawAll(look);
		art.catch(() => {
			if (cached?.art === art) {
				cached = null;
			}
		});
		cached = { key, art };
	}
	return cached.art;
}

async function drawAll(look: ModeArtLook): Promise<Record<GameMode, string>> {
	const canvas = document.createElement("canvas");
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: false,
		powerPreference: "low-power",
		preserveDrawingBuffer: true,
	});
	renderer.setPixelRatio(1);
	renderer.setSize(WIDTH, HEIGHT, false);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.2;
	const textures = new TextureLibrary(1);
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
		const result = {} as Record<GameMode, string>;
		const taken = new Set<number>();
		for (const mode of Object.keys(CASTS) as GameMode[]) {
			const shot = stageFor(manor, mode, taken);
			if (!shot) {
				throw new Error(`Pas de salle pour l'illustration ${mode}`);
			}
			taken.add(shot.room.id);
			const stage = new Stage(manor, kit, shot);
			perform(stage, mode, look);
			renderer.render(stage.scene, stage.camera);
			result[mode] = canvas.toDataURL("image/png");
			stage.dispose();
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		return result;
	} finally {
		materials.dispose();
		textures.dispose();
		renderer.dispose();
		renderer.forceContextLoss();
	}
}
