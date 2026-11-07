import { swarmClearance } from "@shared/anomalies/swarm";
import {
	ARCHIVIST_CIRCLE_RADIUS,
	LANTERN_LIGHT_INTENSITY,
	LANTERN_LIGHT_RANGE,
	RAT_KING_SWARM_RADIUS,
	VOICE_PROXIMITY_MAX_RANGE,
} from "@shared/config/index";
import { SPECIES, type SpeciesId } from "@shared/config/species";
import type { DisguiseBody } from "@shared/doubleDisguise";
import { DEFAULT_HAT_PATTERN, type HatPattern } from "@shared/hatPatterns";
import type { Room } from "@shared/manor/types";
import type { CollisionWorld } from "@shared/physics/collisionWorld";
import {
	countWallsBetween,
	lineOfSight,
	pullBackToSight,
} from "@shared/physics/lineOfSight";
import { POSE_SMOOTHING_LAG_MS, PoseSmoother } from "@shared/poseSmoother";
import {
	type AnomalyState,
	type GameEvent,
	PLAYER_FLAG,
} from "@shared/protocol/game";
import {
	DEFAULT_LANTERN_TINT,
	LANTERN_TINT_COLORS,
	type LanternTint,
} from "@shared/rewards";
import * as THREE from "three";
import { type SoundHandle, soundBank } from "../../audio/soundBank";
import type { AnomalyModel } from "../../models/anomalies/AnomalyModel";
import { createAnomalyModel } from "../../models/anomalies/createAnomalyModel";
import { DoubleModel } from "../../models/anomalies/creatures";
import type { ModelKit } from "../../models/modelKit";
import { modelYaw } from "../../models/modelKit";
import {
	doubleVoices,
	speakClip,
	type VoicePlayback,
} from "../../voice/doubleVoices";
import { voiceChat } from "../../voice/voiceChat";
import type { TextureLibrary } from "../../world/textures/TextureLibrary";
import { footstepSound } from "../audio/AmbientAudio";
import type { DynamicLight } from "../lighting/LightPool";
import type { ClientWorldState } from "../state/ClientWorldState";
import { nameTag } from "./nameTag";

export interface PlayerAppearance {
	color: number;
	pattern: HatPattern;
	lantern: LanternTint;
}

import type { ParticleSystem } from "../effects/Particles";

const IDLE_SOUNDS: Partial<Record<SpeciesId, string>> = {
	murmure: "murmure-idle",
	veilleur: "veilleur-idle",
	"crache-cendre": "cendre-idle",
	collecteur: "collecteur-idle",
	archiviste: "archiviste-idle",
	luciole: "luciole-idle",
	hurleur: "hurleur-wings",
	suinteur: "suinteur-idle",
	boursoufle: "boursoufle-idle",
	colosse: "colosse-idle",
	fulgurant: "fulgurant-idle",
	gorgone: "gorgone-idle",
	brume: "brume-idle",
	"rat-roi": "ratroi-idle",
};

const WINDUP_SOUNDS: Partial<Record<SpeciesId, string>> = {
	murmure: "murmure-attack",
	veilleur: "veilleur-windup",
	"crache-cendre": "cendre-windup",
	collecteur: "collecteur-windup",
	suinteur: "suinteur-windup",
	boursoufle: "boursoufle-inflate",
	double: "melee-swing",
	colosse: "colosse-windup",
	fulgurant: "fulgurant-charge",
	gorgone: "melee-swing",
	"rat-roi": "ratroi-bite",
};

interface Beam {
	anomalyId: number;
	mesh: THREE.Mesh;
	glow: THREE.Mesh | null;
	from: THREE.Vector3;
	to: THREE.Vector3;
	kind: "telegraph" | "shot";
	born: number;
	life: number;
}

export interface AnomalyRenderInfo {
	id: number;
	species: SpeciesId;
	position: THREE.Vector3;
	center: THREE.Vector3;
	radius: number;
	state: AnomalyState;
	targetId: string | null;
	aware: boolean;
	extra: number;
	mimic: string | null;
	impersonated: string | null;
	renderTime: number;
}

interface View {
	id: number;
	species: SpeciesId;
	model: AnomalyModel;
	mimicKey: string | null;
	gen: number;
	idle: SoundHandle | null;
	lastState: AnomalyState | null;
	glow: DynamicLight | null;
	info: AnomalyRenderInfo | null;
	occlusion: number;
	occlusionCheckedAt: number;
	circle: THREE.Mesh | null;
	tag: THREE.Sprite | null;
	pose: PoseSmoother;
	emitted: number[];
	lantern: DynamicLight | null;
	stepPhase: number;
	voice: VoicePlayback | null;
	nextVoiceAt: number;
}

const TAG_RANGE = 11;
const DOUBLE_VOICE_MIN_GAP = 7;
const DOUBLE_VOICE_EXTRA_GAP = 12;

function disguiseKey(
	impersonated: string | null,
	mimic: PlayerAppearance | null,
): string | null {
	return impersonated && mimic
		? `${impersonated}-${mimic.color}-${mimic.pattern}-${mimic.lantern}`
		: null;
}

export class AnomalyViews {
	readonly group = new THREE.Group();
	private readonly views = new Map<number, View>();
	private readonly beams: Beam[] = [];
	private time = 0;
	private voicesSilenced = false;
	private readonly standIns = new Map<number, string>();

	private readonly swarms = new Map<
		number,
		{ x: number; y: number; z: number; yaw: number; clearance: number[] }
	>();

	private swarmClearance(
		view: { id: number },
		pose: { x: number; y: number; z: number; yaw: number },
	): number[] {
		const cached = this.swarms.get(view.id);
		if (
			cached &&
			Math.hypot(cached.x - pose.x, cached.z - pose.z) < 0.1 &&
			Math.abs(cached.y - pose.y) < 0.1 &&
			Math.abs(cached.yaw - pose.yaw) < 0.05
		) {
			return cached.clearance;
		}
		const clearance = swarmClearance(
			this.world,
			{ x: pose.x, y: pose.y, z: pose.z },
			modelYaw(pose.yaw),
			RAT_KING_SWARM_RADIUS,
		);
		this.swarms.set(view.id, { ...pose, clearance });
		return clearance;
	}

	constructor(
		private readonly state: ClientWorldState,
		private readonly kit: ModelKit,
		private readonly textures: TextureLibrary,
		private readonly world: CollisionWorld,
		private readonly particles: ParticleSystem,
		private readonly playerAppearance: (playerId: string) => PlayerAppearance,
	) {
		state.listeners.add((event) => this.onEvent(event));
	}

	prewarm(species: SpeciesId[]): void {
		for (const id of species) {
			const model = createAnomalyModel(id, this.kit);
			model.root.position.set(0, -100, 0);
			this.group.add(model.root);
			model.update({
				state: "idle",
				stateMs: 0,
				extra: 0,
				speed: 0,
				dt: 0.016,
				time: 0,
			});
			this.group.remove(model.root);
			model.dispose();
		}
	}

	infos(): AnomalyRenderInfo[] {
		return [...this.views.values()]
			.map((view) => view.info)
			.filter((info): info is AnomalyRenderInfo => info !== null);
	}

	info(id: number): AnomalyRenderInfo | null {
		return this.views.get(id)?.info ?? null;
	}

	update(
		dt: number,
		renderTime: number,
		listener: THREE.Vector3,
		dynamicLights: DynamicLight[],
	): void {
		this.time += dt;
		this.recordVoices();
		for (const anomaly of this.state.anomalies.values()) {
			let view = this.views.get(anomaly.id);
			if (!anomaly.active || anomaly.buffer.size === 0) {
				if (view) {
					this.hide(view);
				}
				continue;
			}
			const sample = anomaly.buffer.sample(renderTime);
			if (!sample) {
				continue;
			}
			const impersonated =
				anomaly.roster.species === "double"
					? this.impersonate(anomaly.id, sample.value.mimic, sample.value)
					: null;
			const mimic = impersonated ? this.playerAppearance(impersonated) : null;
			const mimicKey = disguiseKey(impersonated, mimic);
			if (
				!view ||
				(anomaly.roster.species === "double" &&
					mimicKey !== null &&
					view.mimicKey !== mimicKey)
			) {
				if (view) {
					this.destroy(view);
				}
				view = this.create(
					anomaly.id,
					anomaly.roster.species,
					mimic,
					impersonated,
				);
			}
			if (view.gen !== anomaly.gen) {
				view.gen = anomaly.gen;
				view.lastState = null;
				view.pose.reset();
			}
			const state = this.state.anomalyState(sample.value);
			const definition = SPECIES[view.species];
			const pose = view.pose;
			pose.update(sample, dt);
			view.model.root.visible = true;
			view.model.root.position.set(pose.x, pose.y, pose.z);
			view.model.root.rotation.y = modelYaw(pose.yaw);
			view.model.update({
				state,
				stateMs:
					sample.value.stateMs +
					(renderTime - this.state.latestSnapshotTime) * 0,
				extra: sample.value.extra,
				speed: pose.speed,
				dt,
				time: this.time + view.id,
				clearance:
					view.species === "rat-roi" && sample.value.extra > 0
						? this.swarmClearance(view, pose)
						: undefined,
			});
			const center = new THREE.Vector3(
				pose.x,
				pose.y + definition.bodyHeight * 0.55,
				pose.z,
			);
			view.info = {
				id: view.id,
				species: view.species,
				position: view.model.root.position.clone(),
				center,
				radius: definition.aimRadius,
				state,
				targetId: sample.value.target,
				aware: sample.value.aware,
				extra: sample.value.extra,
				mimic: sample.value.mimic,
				impersonated,
				renderTime: renderTime - POSE_SMOOTHING_LAG_MS,
			};
			if (view.tag) {
				view.tag.position.set(pose.x, pose.y + 2.05, pose.z);
				view.tag.visible =
					sample.value.mimic !== null &&
					sample.value.extra < 1 &&
					state !== "special" &&
					view.tag.position.distanceTo(listener) < TAG_RANGE &&
					lineOfSight(this.world, listener, view.tag.position);
			}
			this.updateSound(view, state, center, listener);
			this.updateDisguise(
				view,
				impersonated,
				sample.value.mimic !== null &&
					sample.value.extra < 1 &&
					state !== "special",
				listener,
				dt,
				dynamicLights,
			);
			this.updateGlow(view, dynamicLights);
			this.emitParticles(view, dt);
			this.updateCircle(view, sample.value.extra);
			view.lastState = state;
		}
		this.updateBeams(dynamicLights);
	}

	private emitParticles(view: View, dt: number): void {
		view.model.emitters.forEach((emitter, index) => {
			const debt = (view.emitted[index] ?? 0) + emitter.rate * dt;
			const count = Math.floor(debt);
			view.emitted[index] = debt - count;
			if (count > 0) {
				this.particles.emit(
					emitter.anchor.getWorldPosition(new THREE.Vector3()),
					count,
					emitter,
				);
			}
		});
	}

	private addBeam(
		anomalyId: number,
		from: THREE.Vector3,
		to: THREE.Vector3,
		kind: Beam["kind"],
	): void {
		const length = Math.max(0.01, from.distanceTo(to));
		const direction = new THREE.Vector3().subVectors(to, from).normalize();
		const orientation = new THREE.Quaternion().setFromUnitVectors(
			new THREE.Vector3(0, 1, 0),
			direction,
		);
		const middle = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
		const make = (radius: number, color: number, opacity: number) => {
			const mesh = new THREE.Mesh(
				new THREE.CylinderGeometry(radius, radius, length, 8, 1, true),
				new THREE.MeshBasicMaterial({
					color,
					transparent: true,
					opacity,
					depthWrite: false,
					blending: THREE.AdditiveBlending,
				}),
			);
			mesh.position.copy(middle);
			mesh.quaternion.copy(orientation);
			mesh.renderOrder = 2;
			this.group.add(mesh);
			return mesh;
		};
		const shot = kind === "shot";
		this.beams.push({
			anomalyId,
			mesh: make(
				shot ? 0.05 : 0.012,
				shot ? 0xffe0b0 : 0xff3020,
				shot ? 1 : 0.5,
			),
			glow: shot ? make(0.16, 0xff5030, 0.45) : null,
			from: from.clone(),
			to: to.clone(),
			kind,
			born: this.time,
			life: shot ? 0.35 : 2.4,
		});
	}

	private removeBeam(beam: Beam): void {
		for (const mesh of [beam.mesh, beam.glow]) {
			if (!mesh) {
				continue;
			}
			this.group.remove(mesh);
			mesh.geometry.dispose();
			(mesh.material as THREE.Material).dispose();
		}
		this.beams.splice(this.beams.indexOf(beam), 1);
	}

	private updateBeams(dynamicLights: DynamicLight[]): void {
		for (const beam of [...this.beams]) {
			const age = this.time - beam.born;
			if (age >= beam.life) {
				this.removeBeam(beam);
				continue;
			}
			const material = beam.mesh.material as THREE.MeshBasicMaterial;
			if (beam.kind === "telegraph") {
				material.opacity = 0.3 + 0.35 * Math.abs(Math.sin(age * 14));
				continue;
			}
			const fade = 1 - age / beam.life;
			material.opacity = fade;
			if (beam.glow) {
				(beam.glow.material as THREE.MeshBasicMaterial).opacity = fade * 0.45;
			}
			if (age < 0.18) {
				dynamicLights.push({
					id: `laser-${beam.anomalyId}`,
					position: beam.to,
					color: 0xff6a3a,
					intensity: 3 * fade,
					radius: 6,
					priority: 3,
					flicker: 0,
				});
			}
		}
	}

	/** Ce que la carte doit montrer : les Doubles encore déguisés et qui ils imitent. */
	disguises(): DisguiseBody[] {
		const bodies: DisguiseBody[] = [];
		for (const view of this.views.values()) {
			const info = view.info;
			if (
				info?.mimic &&
				info.impersonated &&
				info.impersonated !== this.state.selfId
			) {
				bodies.push({
					anomalyId: view.id,
					playerId: info.impersonated,
					x: info.position.x,
					y: info.position.y,
					z: info.position.z,
					yaw: view.pose.yaw,
				});
			}
		}
		return bodies;
	}

	/**
	 * On ne peut pas se croiser soi-même : si le Double imite celui qui regarde,
	 * il prend pour lui les traits d'un autre joueur vivant, le plus loin possible.
	 */
	private impersonate(
		anomalyId: number,
		mimic: string | null,
		at: { x: number; z: number },
	): string | null {
		if (!mimic || mimic !== this.state.selfId) {
			this.standIns.delete(anomalyId);
			return mimic;
		}
		const alive = (id: string) =>
			((this.state.players.get(id)?.latest?.flags ?? 0) & PLAYER_FLAG.dead) ===
			0;
		const cached = this.standIns.get(anomalyId);
		if (cached && this.state.players.has(cached) && alive(cached)) {
			return cached;
		}
		const others = [...this.state.players.keys()]
			.filter((id) => id !== this.state.selfId)
			.sort();
		if (others.length === 0) {
			return mimic;
		}
		const away = (id: string) => {
			const latest = this.state.players.get(id)?.latest;
			return latest ? Math.hypot(latest.x - at.x, latest.z - at.z) : 0;
		};
		const pool = others.some(alive) ? others.filter(alive) : others;
		const standIn = pool.reduce((best, id) =>
			away(id) > away(best) ? id : best,
		);
		this.standIns.set(anomalyId, standIn);
		return standIn;
	}

	/** En fin de partie, la voix prêtée au Double n'est plus ni gardée ni rejouée. */
	silenceVoices(): void {
		if (this.voicesSilenced) {
			return;
		}
		this.voicesSilenced = true;
		for (const view of this.views.values()) {
			view.voice?.stop();
		}
		doubleVoices.clear();
	}

	private recordVoices(): void {
		if (this.voicesSilenced) {
			return;
		}
		doubleVoices.update(
			new Set(
				[...this.state.players.keys()].filter((id) => id !== this.state.selfId),
			),
		);
	}

	/** Reprend ce qui se voit et s'entend chez le joueur imité : lanterne, pas et voix. */
	private updateDisguise(
		view: View,
		impersonated: string | null,
		disguised: boolean,
		listener: THREE.Vector3,
		dt: number,
		dynamicLights: DynamicLight[],
	): void {
		const model = view.model;
		if (!(model instanceof DoubleModel)) {
			return;
		}
		const position = model.root.position;
		const flags =
			(impersonated && this.state.players.get(impersonated)?.latest?.flags) ||
			0;
		const lanternOpen = disguised && (flags & PLAYER_FLAG.lantern) !== 0;
		model.copiedLantern = lanternOpen;
		if (lanternOpen) {
			model.root.updateMatrixWorld(true);
			const held = model.mushroom.lanternLightPosition;
			view.lantern ??= {
				id: `double-lantern-${view.id}`,
				position: new THREE.Vector3(),
				color:
					LANTERN_TINT_COLORS[
						(impersonated && this.state.players.get(impersonated)?.lantern) ||
							DEFAULT_LANTERN_TINT
					],
				intensity: LANTERN_LIGHT_INTENSITY,
				radius: LANTERN_LIGHT_RANGE,
				priority: 4,
				flicker: 0.12,
			};
			view.lantern.position.copy(
				pullBackToSight(
					this.world,
					{ x: position.x, y: held.y, z: position.z },
					held,
					0.06,
				),
			);
			dynamicLights.push(view.lantern);
		}
		if (view.voice?.ended) {
			view.voice = null;
		}
		const distance = position.distanceTo(listener);
		if (!disguised) {
			view.voice?.stop();
			view.voice = null;
			model.copiedTalking = 0;
			return;
		}
		const speed = view.pose.speed;
		if (speed >= 0.6 && distance <= 22) {
			view.stepPhase += dt * speed * 0.9;
			if (view.stepPhase >= 1) {
				view.stepPhase = 0;
				const room = this.world.roomAt(
					{ x: position.x, z: position.z },
					position.y + 0.1,
				);
				soundBank.play(footstepSound(room?.style.floor), {
					position,
					volume: 0.55,
					refDistance: 1.5,
					maxDistance: 22,
					occlusion: view.occlusion,
				});
			}
		}
		if (
			!this.voicesSilenced &&
			!view.voice &&
			impersonated &&
			this.time >= view.nextVoiceAt &&
			distance <= VOICE_PROXIMITY_MAX_RANGE &&
			voiceChat.levelOf(impersonated) < 0.12
		) {
			view.nextVoiceAt =
				this.time +
				DOUBLE_VOICE_MIN_GAP +
				Math.random() * DOUBLE_VOICE_EXTRA_GAP;
			const clip = doubleVoices.clipFor(impersonated);
			if (clip) {
				view.voice = speakClip(clip);
			}
		}
		view.voice?.place(
			{ x: position.x, y: position.y + 1.5, z: position.z },
			view.occlusion,
		);
		model.copiedTalking = view.voice ? 0.5 + Math.sin(this.time * 14) * 0.3 : 0;
	}

	private create(
		id: number,
		species: SpeciesId,
		mimic: PlayerAppearance | null,
		impersonated: string | null = null,
	): View {
		const disguise =
			impersonated && impersonated !== this.state.selfId
				? this.state.players.get(impersonated)
				: undefined;
		const tag = disguise ? nameTag(disguise.name, disguise.color) : null;
		if (tag) {
			tag.visible = false;
			this.group.add(tag);
		}
		const model = createAnomalyModel(
			species,
			this.kit,
			mimic?.color ?? 0xd8442f,
			mimic?.pattern ?? DEFAULT_HAT_PATTERN,
		);
		this.group.add(model.root);
		const view: View = {
			id,
			species,
			model,
			mimicKey: disguiseKey(impersonated, mimic),
			gen: -1,
			idle: null,
			lastState: null,
			glow: null,
			info: null,
			occlusion: 0,
			occlusionCheckedAt: 0,
			circle: null,
			tag,
			pose: new PoseSmoother(),
			emitted: [],
			lantern: null,
			stepPhase: 0,
			voice: null,
			nextVoiceAt: 4 + Math.random() * 8,
		};
		this.views.set(id, view);
		return view;
	}

	private hide(view: View): void {
		view.model.root.visible = false;
		if (view.tag) {
			view.tag.visible = false;
		}
		view.info = null;
		view.idle?.stop(0.4);
		view.idle = null;
		view.voice?.stop();
		view.voice = null;
		if (view.circle) {
			view.circle.visible = false;
		}
	}

	private destroy(view: View): void {
		this.hide(view);
		this.group.remove(view.model.root);
		view.model.dispose();
		if (view.circle) {
			this.group.remove(view.circle);
			view.circle.geometry.dispose();
			(view.circle.material as THREE.Material).dispose();
		}
		if (view.tag) {
			this.group.remove(view.tag);
			(view.tag.material as THREE.SpriteMaterial).map?.dispose();
			(view.tag.material as THREE.SpriteMaterial).dispose();
		}
		this.views.delete(view.id);
	}

	private updateSound(
		view: View,
		state: AnomalyState,
		center: THREE.Vector3,
		listener: THREE.Vector3,
	): void {
		const distance = center.distanceTo(listener);
		if (this.time - view.occlusionCheckedAt > 0.25) {
			view.occlusionCheckedAt = this.time;
			view.occlusion =
				distance < 30 ? countWallsBetween(this.world, center, listener, 3) : 3;
		}
		const idleKey = IDLE_SOUNDS[view.species];
		if (idleKey && distance < 26) {
			if (!view.idle || view.idle.ended) {
				view.idle = soundBank.play(idleKey, {
					position: center,
					loop: true,
					volume: 0.7,
					refDistance: 1.4,
					maxDistance: 30,
					rolloff: 1.5,
				});
			}
			view.idle?.setPosition(center.x, center.y, center.z);
			view.idle?.setOcclusion(view.occlusion);
		} else if (view.idle) {
			view.idle.stop(0.5);
			view.idle = null;
		}
		if (state !== view.lastState && view.lastState !== null) {
			const options = {
				position: center,
				refDistance: 2,
				maxDistance: 34,
				occlusion: view.occlusion,
			};
			if (state === "windup") {
				const windup = WINDUP_SOUNDS[view.species];
				if (windup) {
					soundBank.play(windup, options);
				}
			}
			if (
				state === "chase" &&
				view.lastState !== "recover" &&
				view.lastState !== "windup"
			) {
				if (view.species === "veilleur" || view.species === "collecteur") {
					soundBank.playThrottled(
						"veilleur-chase",
						4000,
						{ ...options, rate: view.species === "collecteur" ? 0.75 : 1 },
						`chase-${view.id}`,
					);
				}
			}
			if (state === "special" && view.species === "brume") {
				soundBank.play("brume-cling", options);
			}
			if (state === "special" && view.species === "rat-roi") {
				soundBank.play("ratroi-scatter", options);
			}
			if (state === "special" && view.species === "murmure") {
				soundBank.play("murmure-awaken", options);
			}
			if (state === "special" && view.species === "fulgurant") {
				soundBank.play("fulgurant-vent", options);
			}
			if (
				state === "chase" &&
				view.species === "colosse" &&
				view.lastState !== "recover" &&
				view.lastState !== "windup"
			) {
				soundBank.playThrottled(
					"veilleur-chase",
					4000,
					{ ...options, rate: 0.6 },
					`chase-${view.id}`,
				);
			}
		}
	}

	private updateGlow(view: View, dynamicLights: DynamicLight[]): void {
		const glow = view.model.glow;
		if (!glow) {
			return;
		}
		if (!view.glow) {
			view.glow = {
				id: `anomaly-${view.id}`,
				position: new THREE.Vector3(),
				color: glow.color,
				intensity: glow.intensity,
				radius: glow.radius,
				priority: 2,
				flicker: 0.1,
			};
		}
		view.glow.position
			.copy(glow.offset)
			.applyQuaternion(view.model.root.quaternion)
			.add(view.model.root.position);
		view.glow.intensity = glow.intensity;
		dynamicLights.push(view.glow);
	}

	private updateCircle(view: View, charge: number): void {
		if (view.species !== "archiviste") {
			return;
		}
		if (!view.circle) {
			const room = this.roomAt(view.model.root.position);
			if (!room) {
				return;
			}
			view.circle = this.buildCircle(room, view.model.root.position);
			this.group.add(view.circle);
		}
		view.circle.visible = true;
		const material = view.circle.material as THREE.MeshStandardMaterial;
		material.emissiveIntensity =
			0.4 + charge * 2.6 + Math.sin(this.time * 2) * 0.1;
	}

	private roomAt(position: THREE.Vector3): Room | null {
		return this.world.roomAt(
			{ x: position.x, z: position.z },
			position.y + 0.1,
		);
	}

	private buildCircle(room: Room, center: THREE.Vector3): THREE.Mesh {
		const shape = new THREE.Shape(
			room.polygon.map((point) => new THREE.Vector2(point.x, -point.z)),
		);
		const geometry = new THREE.ShapeGeometry(shape);
		geometry.rotateX(-Math.PI / 2);
		const positions = geometry.getAttribute(
			"position",
		) as THREE.BufferAttribute;
		const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
		const size = ARCHIVIST_CIRCLE_RADIUS * 2;
		for (let index = 0; index < positions.count; index += 1) {
			uv.setXY(
				index,
				(positions.getX(index) - center.x) / size + 0.5,
				(positions.getZ(index) - center.z) / size + 0.5,
			);
		}
		geometry.translate(0, room.floorY + 0.03, 0);
		const texture = this.textures.get("archivistCircle").clone();
		texture.wrapS = THREE.ClampToEdgeWrapping;
		texture.wrapT = THREE.ClampToEdgeWrapping;
		texture.repeat.set(1, 1);
		texture.needsUpdate = true;
		const material = new THREE.MeshStandardMaterial({
			map: texture,
			emissiveMap: texture,
			emissive: 0xf2d36a,
			emissiveIntensity: 0.6,
			transparent: true,
			depthWrite: false,
			alphaTest: 0.05,
			roughness: 1,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.renderOrder = 1;
		return mesh;
	}

	private onEvent(event: GameEvent): void {
		if (event.type === "attack" && event.phase === "strike") {
			const view = this.views.get(event.anomalyId);
			if (view?.info) {
				if (view.species === "crache-cendre") {
					soundBank.play("cendre-spit", {
						position: view.info.center,
						occlusion: view.occlusion,
					});
				} else if (view.species === "suinteur") {
					soundBank.play("slime-spit", {
						position: view.info.center,
						occlusion: view.occlusion,
					});
				} else if (view.species === "collecteur" && event.hit) {
					soundBank.play("collecteur-grab", { position: view.info.center });
				} else if (view.species === "colosse" || view.species === "fulgurant") {
					if (!event.hit && view.species === "colosse") {
						soundBank.play("melee-swing", {
							position: view.info.center,
							occlusion: view.occlusion,
						});
					}
				} else if (event.hit) {
					soundBank.play(
						view.species === "double" ? "double-bite" : "melee-hit",
						{
							position: view.info.center,
						},
					);
				} else if (view.species !== "boursoufle") {
					soundBank.play("melee-swing", {
						position: view.info.center,
						occlusion: view.occlusion,
					});
				}
			}
		}
		if (event.type === "laserCharge") {
			for (const beam of this.beams.filter(
				(candidate) =>
					candidate.anomalyId === event.anomalyId &&
					candidate.kind === "telegraph",
			)) {
				this.removeBeam(beam);
			}
			this.addBeam(
				event.anomalyId,
				new THREE.Vector3(event.from.x, event.from.y, event.from.z),
				new THREE.Vector3(event.target.x, event.target.y, event.target.z),
				"telegraph",
			);
		}
		if (event.type === "laser") {
			for (const beam of this.beams.filter(
				(candidate) =>
					candidate.anomalyId === event.anomalyId &&
					candidate.kind === "telegraph",
			)) {
				this.removeBeam(beam);
			}
			const from = new THREE.Vector3(event.from.x, event.from.y, event.from.z);
			const to = new THREE.Vector3(event.to.x, event.to.y, event.to.z);
			this.addBeam(event.anomalyId, from, to, "shot");
			soundBank.play("fulgurant-fire", {
				position: from,
				volume: 1.3,
				refDistance: 3,
				maxDistance: 40,
			});
			soundBank.play("ember-impact", { position: to, volume: 0.8 });
			this.particles.emit(to, 26, {
				color: 0xff8a50,
				speed: 3.5,
				up: 0.8,
				life: 0.5,
				size: 0.05,
				gravity: 6,
			});
		}
		if (event.type === "thrown") {
			const from = new THREE.Vector3(
				event.from.x,
				event.from.y + 1,
				event.from.z,
			);
			const to = new THREE.Vector3(event.to.x, event.to.y + 0.2, event.to.z);
			soundBank.play("colosse-throw", { position: from, volume: 1.1 });
			soundBank.play("throw-impact", { position: to, volume: 1.2 });
			this.particles.emit(to, 30, {
				color: 0x9a8a72,
				speed: 1.8,
				up: 0.6,
				life: 0.8,
				size: 0.07,
				gravity: 3,
				spread: 0.5,
			});
		}
		if (event.type === "scream") {
			const view = this.views.get(event.anomalyId);
			if (view?.info && view.species === "gorgone") {
				soundBank.play("gorgone-shriek", {
					position: view.info.center,
					volume: 1.4,
					refDistance: 3,
					maxDistance: 40,
					occlusion: view.occlusion * 0.5,
				});
			} else if (view?.info) {
				soundBank.play("hurleur-scream", {
					position: view.info.center,
					volume: 1.4,
					refDistance: 3,
					maxDistance: 40,
					occlusion: view.occlusion * 0.6,
				});
			}
		}
		if (event.type === "reveal") {
			const view = this.views.get(event.anomalyId);
			if (view?.info) {
				soundBank.play("double-reveal", { position: view.info.center });
			}
		}
		if (event.type === "pulse") {
			const position = new THREE.Vector3(event.x, event.y + 0.1, event.z);
			soundBank.play(
				event.phase === "charge" ? "archiviste-charge" : "archiviste-pulse",
				{
					position,
					refDistance: 3,
				},
			);
			if (event.phase === "release") {
				for (let index = 0; index < 24; index += 1) {
					const angle = (index / 24) * Math.PI * 2;
					this.particles.emit(
						new THREE.Vector3(
							event.x + Math.cos(angle) * event.radius * 0.9,
							event.y + 0.1,
							event.z + Math.sin(angle) * event.radius * 0.9,
						),
						2,
						{
							color: 0xf2d36a,
							speed: 1.2,
							up: 1.5,
							life: 0.7,
							size: 0.06,
							gravity: -1,
						},
					);
				}
			}
		}
		if (event.type === "explosion") {
			const position = new THREE.Vector3(event.x, event.y, event.z);
			soundBank.play("explosion", {
				position,
				volume: 1.6,
				refDistance: 4,
				maxDistance: 60,
			});
			this.particles.emit(position, 160, {
				color: 0xc86a5a,
				speed: 7,
				life: 1.2,
				size: 0.12,
				gravity: 9,
				spread: 0.6,
			});
			this.particles.emit(position, 60, {
				color: 0xffd080,
				speed: 4,
				life: 0.4,
				size: 0.18,
				gravity: 0,
				spread: 0.4,
			});
		}
		if (event.type === "projectileEnd") {
			const position = new THREE.Vector3(event.at.x, event.at.y, event.at.z);
			const projectile = this.state.projectiles.get(event.id);
			const ember = projectile ? projectile.kind === "ember" : true;
			soundBank.play(ember ? "ember-impact" : "slime-splat", { position });
			this.particles.emit(position, ember ? 30 : 24, {
				color: ember ? 0xff8a30 : 0x7aca3a,
				speed: ember ? 3 : 2,
				up: 0.6,
				life: 0.6,
				size: 0.06,
				gravity: 8,
			});
		}
	}

	dispose(): void {
		for (const view of [...this.views.values()]) {
			this.destroy(view);
		}
		for (const beam of [...this.beams]) {
			this.removeBeam(beam);
		}
	}
}
