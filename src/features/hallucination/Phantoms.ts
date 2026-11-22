import {
	HOVER_HEIGHTS,
	LANTERN_LIGHT_INTENSITY,
	LANTERN_LIGHT_RANGE,
	WALK_SPEED,
} from "@shared/config/index";
import { MATERIAL_IDS } from "@shared/config/occult";
import { SPECIES, type SpeciesId } from "@shared/config/species";
import { levelForHeight } from "@shared/manor/levels";
import { approachAngle, directionToYaw, type Vec3 } from "@shared/math";
import {
	type CharacterState,
	createCharacterState,
	stepCharacter,
} from "@shared/physics/character";
import type { CollisionWorld } from "@shared/physics/collisionWorld";
import { countWallsBetween, lineOfSight } from "@shared/physics/lineOfSight";
import { type AnomalyState, PLAYER_FLAG } from "@shared/protocol/game";
import { DEFAULT_LANTERN_TINT, LANTERN_TINT_COLORS } from "@shared/rewards";
import { TEAM_COLORS } from "@shared/teams";
import * as THREE from "three";
import { type SoundHandle, soundBank } from "../audio/soundBank";
import { footstepSound } from "../engine/audio/AmbientAudio";
import type { ParticleSystem } from "../engine/effects/Particles";
import type { AnomalyRenderInfo } from "../engine/entities/AnomalyViews";
import {
	ANOMALY_IDLE_SOUNDS,
	ANOMALY_WINDUP_SOUNDS,
} from "../engine/entities/anomalySounds";
import { nameTag } from "../engine/entities/nameTag";
import type { RemotePlayers } from "../engine/entities/RemotePlayers";
import type { DynamicLight } from "../engine/lighting/LightPool";
import type {
	ClientWorldState,
	RemotePlayerState,
} from "../engine/state/ClientWorldState";
import { rumble } from "../gamepad/rumble";
import type { MapMarker } from "../map/MapRenderer";
import type { AnomalyModel } from "../models/anomalies/AnomalyModel";
import { createAnomalyModel } from "../models/anomalies/createAnomalyModel";
import { MushroomModel } from "../models/MushroomModel";
import { type ModelKit, modelYaw } from "../models/modelKit";
import { createMaterialModel } from "../models/occultModels";
import {
	doubleVoices,
	speakClip,
	type VoicePlayback,
} from "../voice/doubleVoices";
import { PhantomEchoes } from "./phantomEchoes";
import {
	findSpawn,
	inView,
	type SpawnRule,
	type Viewpoint,
} from "./phantomPlacement";

type Mood = "stalk" | "watch" | "wander" | "beckon" | "flee" | "glint";

export interface PhantomFrame {
	dt: number;
	strength: number;
	eye: THREE.Vector3;
	forward: THREE.Vector3;
	feet: Vec3;
	yaw: number;
	selfId: string;
	lights: DynamicLight[];
}

interface Phantom {
	id: number;
	mood: Mood;
	holder: THREE.Group;
	body: CharacterState;
	yaw: number;
	heading: number;
	pace: number;
	goal: { x: number; z: number } | null;
	age: number;
	life: number;
	appear: number;
	vanishing: number;
	state: AnomalyState;
	stateMs: number;
	watched: number;
	progressAt: number;
	progress: { x: number; z: number };
	hover: number;
	species: SpeciesId | null;
	anomaly: AnomalyModel | null;
	mushroom: MushroomModel | null;
	relic: THREE.Object3D | null;
	playerId: string | null;
	name: string;
	color: number;
	tag: THREE.Sprite | null;
	light: DynamicLight | null;
	glow: DynamicLight | null;
	idle: SoundHandle | null;
	voice: VoicePlayback | null;
	spoke: boolean;
	occlusion: number;
	occlusionAt: number;
	stepPhase: number;
	emitted: number[];
	emoteTime: number;
}

interface Mask {
	playerId: string;
	holder: THREE.Group;
	model: AnomalyModel;
	hover: number;
	until: number;
	stateMs: number;
}

interface Impostor {
	id: string;
	name: string;
	color: number;
	tag: number;
	player: RemotePlayerState;
}

const MAX_PHANTOMS = 4;
const APPEAR_SECONDS = 0.45;
const VANISH_SECONDS = 0.35;
const TURN_RATE = 5;
const TAG_RANGE = 11;
const STILL = { x: 0, z: 0 };
const DUST_COLORS = [0xc8b8ff, 0x9ae8ff, 0xffb8e8];
const GONE = PLAYER_FLAG.dead | PLAYER_FLAG.hidden | PLAYER_FLAG.carried;

const IGNORED: ReadonlySet<SpeciesId> = new Set([
	"archiviste",
	"double",
	"cinematographe",
	"hurleur",
	"luciole",
	"brume",
]);

const RULES: Record<Mood, SpawnRule> = {
	stalk: { near: 6, far: 11, sight: "hidden", walk: true },
	watch: { near: 7, far: 13, sight: "hidden", walk: false },
	wander: { near: 5, far: 11, sight: "any", walk: false },
	beckon: { near: 5, far: 10, sight: "hidden", walk: false },
	flee: { near: 4, far: 8, sight: "any", walk: false },
	glint: { near: 2.5, far: 6, sight: "visible", walk: false },
};

const MOODS: readonly [Mood, number][] = [
	["stalk", 3],
	["watch", 2],
	["wander", 1.5],
	["beckon", 2.5],
	["flee", 1.2],
	["glint", 1],
];

const LIVES: Record<Mood, number> = {
	stalk: 9,
	watch: 10,
	wander: 9,
	beckon: 11,
	flee: 6,
	glint: 14,
};

function pick<T>(items: readonly T[]): T {
	return items[Math.floor(Math.random() * items.length)];
}

function pickMood(): Mood {
	const total = MOODS.reduce((sum, [, weight]) => sum + weight, 0);
	let roll = Math.random() * total;

	for (const [mood, weight] of MOODS) {
		roll -= weight;

		if (roll <= 0) {
			return mood;
		}
	}

	return "stalk";
}

function easeOut(t: number): number {
	return 1 - (1 - t) * (1 - t);
}

export class Phantoms {
	readonly group = new THREE.Group();
	private readonly phantoms: Phantom[] = [];
	private readonly masks: Mask[] = [];
	private readonly echoes: PhantomEchoes;
	private readonly species: SpeciesId[];
	private time = 0;
	private counter = 0;
	private nextSpawnAt = 0;
	private nextMaskAt = 4;
	private nextSparkAt = 0;

	constructor(
		private readonly state: ClientWorldState,
		private readonly kit: ModelKit,
		private readonly world: CollisionWorld,
		private readonly particles: ParticleSystem,
		private readonly players: RemotePlayers,
	) {
		this.echoes = new PhantomEchoes(world);

		this.species = [
			...state.init.pool.filter((id) => !IGNORED.has(id)),
			"phalene",
			"phalene",
		];
	}

	update(frame: PhantomFrame): void {
		this.time += frame.dt;

		const view: Viewpoint = {
			eye: frame.eye,
			forward: frame.forward,
			feet: frame.feet,
		};

		const active = frame.strength > 0.3;

		this.sparkle(frame);
		this.echoes.update(frame.dt, active, frame.feet, frame.yaw, Math.random);

		if (active) {
			this.summon(view, frame);
			this.disguise(frame);
		} else {
			this.dismiss();
		}

		for (const phantom of [...this.phantoms]) {
			this.step(phantom, view, frame);
		}

		this.stepMasks(frame, active);
	}

	infos(selfId: string): AnomalyRenderInfo[] {
		return this.phantoms.flatMap((phantom) => {
			if (
				phantom.mood !== "stalk" ||
				phantom.vanishing >= 0 ||
				!phantom.species
			) {
				return [];
			}

			const definition = SPECIES[phantom.species];
			const position = phantom.holder.position.clone();

			return [
				{
					id: -1 - phantom.id,
					species: phantom.species,
					position,
					center: position
						.clone()
						.setY(position.y + definition.bodyHeight * 0.55),
					radius: definition.aimRadius,
					state: phantom.state,
					targetId: selfId,
					aware: true,
					extra: 0,
					mimic: null,
					impersonated: null,
					renderTime: 0,
				},
			];
		});
	}

	mapMarkers(top: number): MapMarker[] {
		return this.phantoms.flatMap((phantom) =>
			phantom.mushroom && phantom.vanishing < 0
				? [
						{
							x: phantom.body.x,
							z: phantom.body.z,
							yaw: phantom.yaw,
							level: levelForHeight(phantom.body.y, top, 1.8),
							color: `#${phantom.color.toString(16).padStart(6, "0")}`,
							name: phantom.name,
							dead: false,
						},
					]
				: [],
		);
	}

	clear(): void {
		for (const phantom of [...this.phantoms]) {
			this.remove(phantom);
		}

		for (const mask of [...this.masks]) {
			this.unmask(mask, false);
		}
	}

	private living(): number {
		return this.phantoms.filter((phantom) => phantom.vanishing < 0).length;
	}

	private summon(view: Viewpoint, frame: PhantomFrame): void {
		if (this.time < this.nextSpawnAt || this.living() >= MAX_PHANTOMS) {
			return;
		}

		this.nextSpawnAt = this.time + 1.4 + Math.random() * 2.4;

		const mood = pickMood();

		const taken = this.phantoms.map((phantom) => ({
			x: phantom.body.x,
			y: phantom.body.y,
			z: phantom.body.z,
		}));

		const spot = findSpawn(this.world, view, RULES[mood], taken, Math.random);

		if (!spot) {
			return;
		}

		const phantom =
			mood === "glint"
				? this.relicAt(spot, view)
				: mood === "beckon" || mood === "flee"
					? this.figureAt(spot, mood, view, frame.selfId)
					: this.monsterAt(spot, mood, view);

		this.phantoms.push(phantom);
	}

	private base(
		mood: Mood,
		spot: Vec3,
		view: Viewpoint,
		root: THREE.Object3D,
	): Phantom {
		const holder = new THREE.Group();

		holder.add(root);
		holder.position.set(spot.x, spot.y, spot.z);
		holder.scale.setScalar(0.001);

		this.group.add(holder);

		const yaw = directionToYaw({
			x: view.feet.x - spot.x,
			z: view.feet.z - spot.z,
		});

		this.counter += 1;

		return {
			id: this.counter,
			mood,
			holder,
			body: createCharacterState(spot.x, spot.y, spot.z),
			yaw,
			heading: yaw,
			pace: 0,
			goal: null,
			age: 0,
			life: LIVES[mood] * (0.8 + Math.random() * 0.4),
			appear: 0,
			vanishing: -1,
			state: "idle",
			stateMs: 0,
			watched: 0,
			progressAt: 1.5,
			progress: { x: spot.x, z: spot.z },
			hover: 0,
			species: null,
			anomaly: null,
			mushroom: null,
			relic: null,
			playerId: null,
			name: "",
			color: 0xffffff,
			tag: null,
			light: null,
			glow: null,
			idle: null,
			voice: null,
			spoke: false,
			occlusion: 0,
			occlusionAt: -1,
			stepPhase: 0,
			emitted: [],
			emoteTime: 0,
		};
	}

	private across(spot: Vec3, view: Viewpoint, reach: number) {
		const dx = view.feet.x - spot.x;
		const dz = view.feet.z - spot.z;
		const length = Math.hypot(dx, dz) || 1;
		const side = Math.random() < 0.5 ? -1 : 1;

		return {
			x: spot.x + (-dz / length) * side * reach + (dx / length) * 1.5,
			z: spot.z + (dx / length) * side * reach + (dz / length) * 1.5,
		};
	}

	private monsterAt(spot: Vec3, mood: Mood, view: Viewpoint): Phantom {
		const species = pick(this.species);
		const model = createAnomalyModel(species, this.kit);
		const phantom = this.base(mood, spot, view, model.root);
		const definition = SPECIES[species];

		phantom.species = species;
		phantom.anomaly = model;
		phantom.hover = HOVER_HEIGHTS[species] ?? 0;

		if (mood === "stalk") {
			phantom.state = "chase";

			phantom.pace = Math.min(
				4.6,
				Math.max(2.6, definition.hostileSpeed * 0.9),
			);
		} else if (mood === "wander") {
			phantom.state = "patrol";
			phantom.pace = Math.max(1.2, definition.calmSpeed);
			phantom.goal = this.across(spot, view, 8);
		} else {
			phantom.state = Math.random() < 0.5 ? "idle" : "search";
		}

		return phantom;
	}

	private impostor(selfId: string): Impostor {
		const others = [...this.state.players.values()].filter(
			(player) =>
				player.id !== selfId &&
				((player.latest?.flags ?? 0) & PLAYER_FLAG.dead) === 0,
		);

		const player =
			others.length > 0
				? pick(others)
				: (this.state.players.get(selfId) as RemotePlayerState);

		return {
			id: player.id,
			name: player.name,
			color: player.color,
			tag: player.team === null ? player.color : TEAM_COLORS[player.team],
			player,
		};
	}

	private figureAt(
		spot: Vec3,
		mood: Mood,
		view: Viewpoint,
		selfId: string,
	): Phantom {
		const impostor = this.impostor(selfId);
		const tint = impostor.player.lantern;

		const model = new MushroomModel(
			this.kit,
			impostor.color,
			impostor.player.pattern,
			tint === DEFAULT_LANTERN_TINT ? null : LANTERN_TINT_COLORS[tint],
		);

		const phantom = this.base(mood, spot, view, model.root);
		const tag = nameTag(impostor.name, impostor.tag);

		tag.visible = false;

		this.group.add(tag);

		phantom.mushroom = model;
		phantom.playerId = impostor.id;
		phantom.name = impostor.name;
		phantom.color = impostor.tag;
		phantom.tag = tag;

		phantom.light = {
			id: `phantom-lantern-${phantom.id}`,
			position: new THREE.Vector3(),
			color: LANTERN_TINT_COLORS[tint],
			intensity: LANTERN_LIGHT_INTENSITY,
			radius: LANTERN_LIGHT_RANGE,
			priority: 3,
			flicker: 0.12,
		};

		if (mood === "flee") {
			phantom.pace = 4.6;
			phantom.goal = this.across(spot, view, 9);
		}

		return phantom;
	}

	private relicAt(spot: Vec3, view: Viewpoint): Phantom {
		const model = createMaterialModel(this.kit, pick(MATERIAL_IDS));

		model.scale.setScalar(1.25);

		const phantom = this.base("glint", spot, view, model);

		phantom.relic = model;

		return phantom;
	}

	private step(phantom: Phantom, view: Viewpoint, frame: PhantomFrame): void {
		phantom.age += frame.dt;
		phantom.stateMs += frame.dt * 1000;

		if (phantom.vanishing >= 0) {
			phantom.vanishing += frame.dt / VANISH_SECONDS;

			if (phantom.vanishing >= 1) {
				this.remove(phantom);

				return;
			}

			const fade = phantom.vanishing;

			phantom.holder.scale.set(
				1 + fade * 0.5,
				Math.max(0.001, 1 - fade),
				1 + fade * 0.5,
			);

			this.pose(phantom, frame, Infinity);

			return;
		}

		phantom.appear = Math.min(1, phantom.appear + frame.dt / APPEAR_SECONDS);

		phantom.holder.scale.setScalar(Math.max(0.001, easeOut(phantom.appear)));

		const distance = Math.hypot(
			view.feet.x - phantom.body.x,
			view.feet.z - phantom.body.z,
		);

		const head = new THREE.Vector3(
			phantom.body.x,
			phantom.body.y + phantom.hover + 1.2,
			phantom.body.z,
		);

		const stared =
			inView(view, head, 0.93) && lineOfSight(this.world, view.eye, head);

		phantom.watched = stared
			? phantom.watched + frame.dt
			: Math.max(0, phantom.watched - frame.dt * 0.5);

		this.behave(phantom, view, distance, frame.dt);

		if (phantom.vanishing < 0 && !phantom.relic) {
			this.walk(phantom, frame.dt);
		}

		this.pose(phantom, frame, distance);
		this.listen(phantom, frame, distance);

		if (
			phantom.age >= phantom.life ||
			distance > 30 ||
			Math.abs(view.feet.y - phantom.body.y) > 2.5
		) {
			this.vanish(phantom, false);
		}
	}

	private behave(
		phantom: Phantom,
		view: Viewpoint,
		distance: number,
		dt: number,
	): void {
		const toward = directionToYaw({
			x: view.feet.x - phantom.body.x,
			z: view.feet.z - phantom.body.z,
		});

		switch (phantom.mood) {
			case "stalk":
				this.stalk(phantom, toward, distance);
				break;

			case "watch":
				phantom.heading = toward;

				if (distance < 3.5 || phantom.watched > 1.4) {
					this.vanish(phantom, false);
				}

				break;

			case "beckon":
				phantom.heading = toward;
				phantom.emoteTime += dt;

				if (phantom.emoteTime > 3.2) {
					phantom.emoteTime = 0;
				}

				if (distance < 3.2) {
					this.vanish(phantom, false);
				}

				break;

			case "wander":
			case "flee":
				this.roam(phantom, distance);
				break;

			case "glint":
				if (distance < 1.8 || phantom.watched > 5) {
					this.vanish(phantom, false);
				}

				break;
		}
	}

	private stuck(phantom: Phantom): boolean {
		if (phantom.age < phantom.progressAt) {
			return false;
		}

		const moved = Math.hypot(
			phantom.body.x - phantom.progress.x,
			phantom.body.z - phantom.progress.z,
		);

		phantom.progressAt = phantom.age + 1.5;
		phantom.progress = { x: phantom.body.x, z: phantom.body.z };

		return moved < 0.35;
	}

	private stalk(phantom: Phantom, toward: number, distance: number): void {
		const species = phantom.species as SpeciesId;
		const definition = SPECIES[species];

		const reach = Math.min(1.9, Math.max(1.3, definition.attackRange + 0.3));

		phantom.heading = toward;

		if (phantom.state === "windup") {
			phantom.pace = 0;

			if (
				phantom.stateMs >= THREE.MathUtils.clamp(definition.windupMs, 450, 900)
			) {
				phantom.state = "recover";
				phantom.stateMs = 0;

				soundBank.play("melee-swing", {
					position: phantom.holder.position,
					volume: 1,
				});

				rumble("scare", { scale: 0.35 });

				this.vanish(phantom, true);
			}

			return;
		}

		if (distance <= reach) {
			phantom.state = "windup";
			phantom.stateMs = 0;
			phantom.pace = 0;

			const windup = ANOMALY_WINDUP_SOUNDS[species];

			if (windup) {
				soundBank.play(windup, {
					position: phantom.holder.position,
					refDistance: 2,
					maxDistance: 34,
				});
			}

			return;
		}

		if (this.stuck(phantom)) {
			this.vanish(phantom, false);
		}
	}

	private roam(phantom: Phantom, distance: number): void {
		const goal = phantom.goal;

		if (!goal) {
			this.vanish(phantom, false);

			return;
		}

		const gap = Math.hypot(goal.x - phantom.body.x, goal.z - phantom.body.z);

		phantom.heading = directionToYaw({
			x: goal.x - phantom.body.x,
			z: goal.z - phantom.body.z,
		});

		if (
			gap < 0.5 ||
			(phantom.mood === "wander" && distance < 3) ||
			this.stuck(phantom)
		) {
			this.vanish(phantom, false);
		}
	}

	private walk(phantom: Phantom, dt: number): void {
		phantom.yaw = approachAngle(phantom.yaw, phantom.heading, TURN_RATE * dt);

		const moving = phantom.pace > 0.05;

		stepCharacter(
			this.world,
			phantom.body,
			{
				forward: moving ? 1 : 0,
				strafe: 0,
				yaw: phantom.yaw,
				sprint: false,
				crouch: false,
				jump: false,
			},
			{
				speedFactor: Math.max(0.05, phantom.pace / WALK_SPEED),
				externalVelocity: STILL,
				sprintAllowed: false,
			},
			dt,
		);
	}

	private pose(phantom: Phantom, frame: PhantomFrame, distance: number): void {
		const speed = Math.hypot(phantom.body.vx, phantom.body.vz);

		phantom.holder.position.set(
			phantom.body.x,
			phantom.body.y + phantom.hover,
			phantom.body.z,
		);

		if (phantom.anomaly) {
			phantom.anomaly.root.rotation.y = modelYaw(phantom.yaw);

			phantom.anomaly.update({
				state: phantom.state,
				stateMs: phantom.stateMs,
				extra: 0,
				speed,
				dt: frame.dt,
				time: this.time + phantom.id,
			});

			this.shine(phantom, frame.lights);
			this.emit(phantom, frame.dt);
		}

		if (phantom.mushroom) {
			this.dress(phantom, frame, speed, distance);
		}

		if (phantom.relic) {
			phantom.relic.rotation.y += frame.dt * 0.8;
			phantom.relic.position.y = 0.04 + Math.sin(this.time * 2.2) * 0.03;

			if (Math.random() < frame.dt * 3) {
				this.particles.emit(
					phantom.holder.position
						.clone()
						.setY(phantom.holder.position.y + 0.15),
					1,
					{
						color: pick(DUST_COLORS),
						speed: 0.3,
						up: 1.2,
						life: 1,
						size: 0.025,
						gravity: -0.2,
						spread: 0.2,
					},
				);
			}
		}
	}

	private dress(
		phantom: Phantom,
		frame: PhantomFrame,
		speed: number,
		distance: number,
	): void {
		const model = phantom.mushroom as MushroomModel;

		model.root.rotation.y = modelYaw(phantom.yaw);

		model.update(frame.dt, {
			speed,
			crouch: 0,
			grounded: true,
			sprinting: phantom.mood === "flee",
			lanternOpen: true,
			grimoireOpen: false,
			dead: false,
			talking: phantom.voice ? 0.5 + Math.sin(this.time * 14) * 0.3 : 0,
			emote: phantom.mood === "beckon" ? "wave" : null,
			emoteTime: phantom.emoteTime,
		});

		const visible = phantom.vanishing < 0;

		if (phantom.light && visible) {
			phantom.holder.updateMatrixWorld(true);
			phantom.light.position.copy(model.lanternLightPosition);
			frame.lights.push(phantom.light);
		}

		if (phantom.tag) {
			phantom.tag.position.set(
				phantom.body.x,
				phantom.body.y + 2.05,
				phantom.body.z,
			);

			phantom.tag.visible =
				visible &&
				distance < TAG_RANGE &&
				lineOfSight(this.world, frame.eye, phantom.tag.position);
		}
	}

	private shine(phantom: Phantom, lights: DynamicLight[]): void {
		const glow = phantom.anomaly?.glow;

		if (!glow || phantom.vanishing >= 0) {
			return;
		}

		phantom.glow ??= {
			id: `phantom-${phantom.id}`,
			position: new THREE.Vector3(),
			color: glow.color,
			intensity: glow.intensity,
			radius: glow.radius,
			priority: 1,
			flicker: 0.1,
		};

		const root = phantom.anomaly?.root as THREE.Object3D;

		phantom.glow.position
			.copy(glow.offset)
			.applyQuaternion(root.quaternion)
			.add(phantom.holder.position);

		phantom.glow.color = glow.color;
		phantom.glow.intensity = glow.intensity;

		lights.push(phantom.glow);
	}

	private emit(phantom: Phantom, dt: number): void {
		phantom.anomaly?.emitters.forEach((emitter, index) => {
			const debt = (phantom.emitted[index] ?? 0) + emitter.rate * dt;
			const count = Math.floor(debt);

			phantom.emitted[index] = debt - count;

			if (count > 0) {
				this.particles.emit(
					emitter.anchor.getWorldPosition(new THREE.Vector3()),
					count,
					emitter,
				);
			}
		});
	}

	private listen(
		phantom: Phantom,
		frame: PhantomFrame,
		distance: number,
	): void {
		const center = phantom.holder.position.clone();

		center.y += 1;

		if (this.time - phantom.occlusionAt > 0.3) {
			phantom.occlusionAt = this.time;

			phantom.occlusion =
				distance < 30 ? countWallsBetween(this.world, center, frame.eye, 3) : 3;
		}

		const idleKey = phantom.species
			? ANOMALY_IDLE_SOUNDS[phantom.species]
			: null;

		if (idleKey && distance < 24) {
			if (!phantom.idle || phantom.idle.ended) {
				phantom.idle = soundBank.play(idleKey, {
					position: center,
					loop: true,
					volume: 0.6,
					refDistance: 1.4,
					maxDistance: 28,
					rolloff: 1.5,
				});
			}

			phantom.idle?.setPosition(center.x, center.y, center.z);
			phantom.idle?.setOcclusion(phantom.occlusion);
		}

		if (!phantom.mushroom) {
			return;
		}

		this.footsteps(phantom, frame.dt, distance);

		if (
			!phantom.spoke &&
			phantom.mood === "beckon" &&
			phantom.age > 1.2 &&
			phantom.playerId
		) {
			phantom.spoke = true;

			const clip = doubleVoices.clipFor(phantom.playerId);

			if (clip) {
				phantom.voice = speakClip(clip);
			}
		}

		if (phantom.voice?.ended) {
			phantom.voice = null;
		}

		phantom.voice?.place(
			{ x: center.x, y: center.y + 0.5, z: center.z },
			phantom.occlusion,
		);
	}

	private footsteps(phantom: Phantom, dt: number, distance: number): void {
		const speed = Math.hypot(phantom.body.vx, phantom.body.vz);

		if (speed < 0.6 || distance > 22) {
			return;
		}

		phantom.stepPhase += dt * speed * 0.9;

		if (phantom.stepPhase < 1) {
			return;
		}

		phantom.stepPhase = 0;

		const room = this.world.roomAt(
			{ x: phantom.body.x, z: phantom.body.z },
			phantom.body.y + 0.1,
		);

		soundBank.play(footstepSound(room?.style.floor), {
			position: phantom.holder.position,
			volume: 0.55,
			refDistance: 1.5,
			maxDistance: 22,
			occlusion: phantom.occlusion,
		});
	}

	private puff(center: THREE.Vector3, amount: number): void {
		for (const color of DUST_COLORS) {
			this.particles.emit(center, amount, {
				color,
				speed: 1.4,
				up: 0.4,
				life: 1.3,
				size: 0.035,
				gravity: -0.2,
				spread: 0.7,
			});
		}
	}

	private vanish(phantom: Phantom, loud: boolean): void {
		if (phantom.vanishing >= 0) {
			return;
		}

		phantom.vanishing = 0;

		phantom.idle?.stop(0.25);
		phantom.voice?.stop();

		phantom.idle = null;
		phantom.voice = null;

		if (phantom.tag) {
			phantom.tag.visible = false;
		}

		const center = phantom.holder.position.clone();

		center.y += 0.9;

		this.puff(center, loud ? 22 : 12);

		soundBank.play("phantom-vanish", {
			position: center,
			volume: loud ? 1 : 0.5,
			refDistance: 2,
			maxDistance: 22,
			occlusion: phantom.occlusion,
		});
	}

	private remove(phantom: Phantom): void {
		phantom.idle?.stop(0.2);
		phantom.voice?.stop();

		this.group.remove(phantom.holder);

		phantom.anomaly?.dispose();
		phantom.mushroom?.dispose();

		if (phantom.tag) {
			this.group.remove(phantom.tag);

			const material = phantom.tag.material as THREE.SpriteMaterial;

			material.map?.dispose();
			material.dispose();
		}

		this.phantoms.splice(this.phantoms.indexOf(phantom), 1);
	}

	private dismiss(): void {
		for (const phantom of this.phantoms) {
			this.vanish(phantom, false);
		}
	}

	private sparkle(frame: PhantomFrame): void {
		if (this.time < this.nextSparkAt) {
			return;
		}

		this.nextSparkAt = this.time + 0.15;

		for (const player of this.state.players.values()) {
			const flags = player.latest?.flags ?? 0;

			if (
				player.id === frame.selfId ||
				(flags & PLAYER_FLAG.hallucinating) === 0
			) {
				continue;
			}

			const pose = this.players.poseOf(player.id);

			if (!pose || pose.position.distanceTo(frame.eye) > 22) {
				continue;
			}

			this.particles.emit(
				pose.position.clone().setY(pose.position.y + 1.6),
				2,
				{
					color: pick(DUST_COLORS),
					speed: 0.35,
					up: 0.6,
					life: 1.4,
					size: 0.03,
					gravity: -0.15,
					spread: 0.35,
				},
			);
		}
	}

	private disguise(frame: PhantomFrame): void {
		if (this.time < this.nextMaskAt || this.masks.length > 0) {
			return;
		}

		this.nextMaskAt = this.time + 6 + Math.random() * 6;

		const candidates = [...this.state.players.values()].filter((player) => {
			const pose = this.players.poseOf(player.id);

			return (
				player.id !== frame.selfId &&
				pose !== null &&
				((player.latest?.flags ?? 0) & GONE) === 0 &&
				pose.position.distanceTo(frame.eye) < 18 &&
				lineOfSight(
					this.world,
					frame.eye,
					pose.position.clone().setY(pose.position.y + 1.2),
				)
			);
		});

		if (candidates.length === 0) {
			return;
		}

		const player = pick(candidates);
		const species = pick(this.species);
		const model = createAnomalyModel(species, this.kit);
		const holder = new THREE.Group();

		holder.add(model.root);

		this.group.add(holder);
		this.players.mask(player.id, true);

		const mask: Mask = {
			playerId: player.id,
			holder,
			model,
			hover: HOVER_HEIGHTS[species] ?? 0,
			until: this.time + 3 + Math.random() * 2.5,
			stateMs: 0,
		};

		this.masks.push(mask);
		this.place(mask, frame.dt);

		const center = holder.position.clone();

		center.y += 1;

		this.puff(center, 10);
	}

	private place(mask: Mask, dt: number): boolean {
		const pose = this.players.poseOf(mask.playerId);

		if (!pose) {
			return false;
		}

		mask.stateMs += dt * 1000;

		mask.holder.position.set(
			pose.position.x,
			pose.position.y + mask.hover,
			pose.position.z,
		);

		mask.model.root.rotation.y = modelYaw(pose.yaw);

		mask.model.update({
			state: pose.speed > 0.6 ? "chase" : "idle",
			stateMs: mask.stateMs,
			extra: 0,
			speed: pose.speed,
			dt,
			time: this.time,
		});

		return true;
	}

	private stepMasks(frame: PhantomFrame, active: boolean): void {
		for (const mask of [...this.masks]) {
			if (!active || this.time >= mask.until || !this.place(mask, frame.dt)) {
				this.unmask(mask, true);
			}
		}
	}

	private unmask(mask: Mask, visible: boolean): void {
		if (visible) {
			const center = mask.holder.position.clone();

			center.y += 1;

			this.puff(center, 10);

			soundBank.play("phantom-vanish", {
				position: center,
				volume: 0.45,
				refDistance: 2,
				maxDistance: 22,
			});
		}

		this.players.mask(mask.playerId, false);
		this.group.remove(mask.holder);
		mask.model.dispose();
		this.masks.splice(this.masks.indexOf(mask), 1);
	}
}
