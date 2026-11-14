import {
	LANTERN_LIGHT_INTENSITY,
	LANTERN_LIGHT_RANGE,
	VOICE_PROXIMITY_FULL_RANGE,
} from "@shared/config/index";
import { OCCULT_IDS, type OccultId } from "@shared/config/occult";
import type { EmoteId } from "@shared/config/party";
import { type LiquidVolume, liquidAt } from "@shared/manor/liquids";
import type { CollisionWorld } from "@shared/physics/collisionWorld";
import {
	countWallsBetween,
	lineOfSight,
	pullBackToSight,
} from "@shared/physics/lineOfSight";
import { PoseSmoother } from "@shared/poseSmoother";
import { PLAYER_FLAG } from "@shared/protocol/game";
import { DEFAULT_LANTERN_TINT, LANTERN_TINT_COLORS } from "@shared/rewards";
import { TEAM_COLORS } from "@shared/teams";
import * as THREE from "three";
import { soundBank } from "../../audio/soundBank";
import { MushroomModel } from "../../models/MushroomModel";
import type { ModelKit } from "../../models/modelKit";
import { modelYaw } from "../../models/modelKit";
import { voiceChat } from "../../voice/voiceChat";
import { footstepSound } from "../audio/AmbientAudio";
import type { DynamicLight } from "../lighting/LightPool";
import type {
	ClientWorldState,
	RemotePlayerState,
} from "../state/ClientWorldState";
import { bountyTag, nameTag } from "./nameTag";

export interface SelfPose {
	x: number;
	y: number;
	z: number;
	yaw: number;
	emote: EmoteId | null;
	emoteTime: number;
	lanternOpen: boolean;
	ghost: boolean;
	talking: number;
	walkie: boolean;
	heldObject: OccultId | null;
}

interface RemoteView {
	id: string;
	model: MushroomModel;
	tag: THREE.Sprite;
	light: DynamicLight;
	stepPhase: number;
	occlusion: number;
	occlusionAt: number;
	position: THREE.Vector3;
	visible: boolean;
	pose: PoseSmoother;
	liquidId: number | null;
	crown: THREE.Sprite;
	wasDead: boolean;
	corpse: THREE.Vector3 | null;
	corpseYaw: number;
}

export class RemotePlayers {
	readonly group = new THREE.Group();
	private readonly views = new Map<string, RemoteView>();
	private readonly replayVoices = new Map<string, number>();
	private spectating = false;
	private time = 0;
	private readonly ghosts: boolean;
	private readonly megaphone: boolean;
	voiceOpen = false;
	private selfPose: SelfPose | null = null;
	radioSpeakers: string[] = [];

	constructor(
		private readonly state: ClientWorldState,
		kit: ModelKit,
		private readonly world: CollisionWorld,
		private readonly liquids: readonly LiquidVolume[] = [],
	) {
		this.ghosts = !state.init.tutorial;
		this.megaphone = state.init.config.mutators?.includes("megaphone") ?? false;
		for (const player of state.players.values()) {
			const lanternColor = LANTERN_TINT_COLORS[player.lantern];
			const model = new MushroomModel(
				kit,
				player.color,
				player.pattern,
				player.lantern === DEFAULT_LANTERN_TINT ? null : lanternColor,
			);
			const tag = nameTag(
				player.name,
				player.team === null ? player.color : TEAM_COLORS[player.team],
			);
			const crown = bountyTag();
			crown.visible = false;
			this.group.add(model.root, tag, crown);
			this.views.set(player.id, {
				id: player.id,
				model,
				tag,
				light: {
					id: `player-${player.id}`,
					position: new THREE.Vector3(),
					color: lanternColor,
					intensity: 0,
					radius: LANTERN_LIGHT_RANGE,
					priority: 4,
					flicker: 0.12,
				},
				stepPhase: 0,
				occlusion: 0,
				occlusionAt: 0,
				position: new THREE.Vector3(),
				visible: false,
				pose: new PoseSmoother(),
				liquidId: null,
				crown,
				wasDead: false,
				corpse: null,
				corpseYaw: 0,
			});
			if (player.id === state.selfId) {
				model.root.visible = false;
				tag.visible = false;
			}
		}
	}

	spectate(): void {
		this.spectating = true;
		this.radioSpeakers = [];
	}

	setReplayVoice(playerId: string, level: number): void {
		this.replayVoices.set(playerId, level);
	}

	resetPoses(): void {
		for (const view of this.views.values()) {
			view.pose.reset();
			view.corpse = null;
			view.wasDead = false;
		}
		this.replayVoices.clear();
	}

	showSelf(pose: SelfPose | null): void {
		this.selfPose = pose;
	}

	selfLanternPosition(): THREE.Vector3 | null {
		const view = this.views.get(this.state.selfId);
		if (!view?.visible || !this.selfPose?.lanternOpen) {
			return null;
		}
		view.model.root.updateMatrixWorld(true);
		return view.model.lanternLightPosition;
	}

	private updateSelf(view: RemoteView, dt: number): void {
		const pose = this.selfPose;
		if (!pose) {
			this.setVisible(view, false);
			return;
		}
		this.setVisible(view, true);
		view.tag.visible = false;
		view.crown.visible = false;
		view.position.set(pose.x, pose.y, pose.z);
		view.model.root.position.copy(view.position);
		view.model.root.rotation.y = modelYaw(pose.yaw);
		view.model.setGhost(pose.ghost);
		view.model.update(dt, {
			speed: 0,
			crouch: 0,
			grounded: true,
			sprinting: false,
			lanternOpen: pose.lanternOpen,
			grimoireOpen: false,
			dead: false,
			talking: pose.talking,
			walkie: pose.walkie,
			heldObject: pose.heldObject,
			emote: pose.emote,
			emoteTime: pose.emoteTime,
		});
	}

	corpseOf(playerId: string): THREE.Vector3 | null {
		return this.views.get(playerId)?.corpse ?? null;
	}

	nameTagAnchor(playerId: string): THREE.Vector3 | null {
		const view = this.views.get(playerId);
		return view?.visible ? view.tag.position : null;
	}

	positionOf(playerId: string): THREE.Vector3 | null {
		const view = this.views.get(playerId);
		return view?.visible ? view.position : null;
	}

	update(
		dt: number,
		renderTime: number,
		listener: THREE.Vector3,
		eye: THREE.Vector3,
		dynamicLights: DynamicLight[],
	): void {
		this.time += dt;
		const listening = !this.spectating && this.state.selfHasWalkie;
		this.radioSpeakers = [];
		for (const view of this.views.values()) {
			if (view.id === this.state.selfId && !this.spectating) {
				this.updateSelf(view, dt);
				continue;
			}
			const player = this.state.players.get(view.id) as RemotePlayerState;
			const sample = player.buffer.sample(renderTime);
			if (!sample) {
				this.setVisible(view, false);
				if (!this.spectating) {
					voiceChat.updateSpatial(view.id, null, 0, Infinity);
				}
				continue;
			}
			const flags = sample.value.flags;
			const hidden =
				(flags & PLAYER_FLAG.hidden) !== 0 ||
				(flags & PLAYER_FLAG.carried) !== 0;
			const dead = (flags & PLAYER_FLAG.dead) !== 0;
			const selfGhost = this.ghosts && !this.spectating && this.state.selfDead;
			const ghost = this.ghosts && dead;
			const ghostVisible = ghost && selfGhost;
			if (dead !== view.wasDead || hidden) {
				view.pose.reset();
			}
			if (dead && !view.wasDead) {
				view.corpse = new THREE.Vector3(
					sample.value.x,
					sample.value.y,
					sample.value.z,
				);
				view.corpseYaw = sample.value.yaw;
			} else if (!dead) {
				view.corpse = null;
			}
			view.wasDead = dead;
			view.pose.update(sample, dt);
			const lying = ghost && !ghostVisible && view.corpse !== null;
			if (lying && view.corpse) {
				view.position.copy(view.corpse);
			} else {
				view.position.set(view.pose.x, view.pose.y, view.pose.z);
			}
			view.model.setGhost(ghostVisible);
			this.setVisible(view, !hidden);
			view.model.root.position.copy(view.position);
			view.model.root.rotation.y = modelYaw(
				lying ? view.corpseYaw : view.pose.yaw,
			);
			const lanternOpen = (flags & PLAYER_FLAG.lantern) !== 0;
			const talking = this.spectating
				? (this.replayVoices.get(view.id) ?? 0)
				: voiceChat.levelOf(view.id);
			const onRadio = listening && (flags & PLAYER_FLAG.radio) !== 0;
			if (!this.spectating) {
				voiceChat.setRadio(view.id, onRadio);
			}
			if (onRadio && talking > 0.12) {
				this.radioSpeakers.push(player.name);
			}
			const emote = this.state.emoteOf(view.id, renderTime);
			view.model.update(dt, {
				speed: ghostVisible ? 0 : view.pose.speed,
				crouch: sample.value.crouch,
				grounded: ghostVisible || (flags & PLAYER_FLAG.airborne) === 0,
				sprinting: (flags & PLAYER_FLAG.sprint) !== 0,
				lanternOpen,
				grimoireOpen: (flags & PLAYER_FLAG.grimoire) !== 0,
				dead: dead && !ghostVisible,
				talking: ghost && !selfGhost && !this.spectating ? 0 : talking,
				emote: emote?.emote ?? null,
				emoteTime: emote?.time ?? 0,
				camera:
					(flags & PLAYER_FLAG.cameraHeld) === 0
						? 0
						: (flags & PLAYER_FLAG.camera) !== 0
							? 2
							: 1,
				walkie: (flags & PLAYER_FLAG.walkieHeld) !== 0,
				heldObject: OCCULT_IDS[sample.value.held ?? -1] ?? null,
			});
			const distance = view.position.distanceTo(listener);
			view.tag.position.set(
				view.position.x,
				view.position.y + 2.05 - sample.value.crouch * 0.5,
				view.position.z,
			);
			view.tag.visible =
				!hidden &&
				(!dead || ghostVisible) &&
				distance < 11 &&
				(ghostVisible || lineOfSight(this.world, eye, view.tag.position));
			view.crown.position.set(
				view.tag.position.x,
				view.tag.position.y + 0.32,
				view.tag.position.z,
			);
			view.crown.visible =
				(flags & PLAYER_FLAG.bounty) !== 0 &&
				!hidden &&
				!dead &&
				distance < 32 &&
				lineOfSight(this.world, eye, view.crown.position);
			if (!hidden && lanternOpen) {
				view.model.root.updateMatrixWorld(true);
				const held = view.model.lanternLightPosition;
				const body = { x: view.position.x, y: held.y, z: view.position.z };
				view.light.position.copy(pullBackToSight(this.world, body, held, 0.06));
				view.light.intensity = LANTERN_LIGHT_INTENSITY;
				dynamicLights.push(view.light);
			}
			if (this.time - view.occlusionAt > 0.25) {
				view.occlusionAt = this.time;
				view.occlusion =
					distance < 30
						? countWallsBetween(
								this.world,
								eye,
								new THREE.Vector3(
									view.position.x,
									view.position.y + 1.5,
									view.position.z,
								),
								3,
							)
						: 3;
			}
			if (!this.spectating && !this.voiceOpen) {
				this.routeVoice(view, listener, distance, ghost, selfGhost);
			}
			const liquid =
				hidden || dead ? null : liquidAt(this.liquids, view.position);
			this.splash(view, liquid, distance);
			this.footsteps(view, view.pose.speed, dt, flags, distance, liquid);
		}
	}

	private routeVoice(
		view: RemoteView,
		listener: THREE.Vector3,
		distance: number,
		ghost: boolean,
		selfGhost: boolean,
	): void {
		if (ghost && !selfGhost) {
			voiceChat.updateSpatial(view.id, null, 0, Infinity);
			return;
		}
		const mouth = new THREE.Vector3(
			view.position.x,
			view.position.y + 1.5,
			view.position.z,
		);
		if ((ghost && selfGhost) || this.megaphone) {
			const offset = mouth.sub(listener);
			const reach = Math.min(offset.length(), VOICE_PROXIMITY_FULL_RANGE * 0.5);
			const near = listener
				.clone()
				.add(offset.normalize().multiplyScalar(reach));
			voiceChat.updateSpatial(view.id, near, 0, reach);
			return;
		}
		voiceChat.updateSpatial(view.id, mouth, view.occlusion, distance);
	}

	private footsteps(
		view: RemoteView,
		speed: number,
		dt: number,
		flags: number,
		distance: number,
		liquid: LiquidVolume | null,
	): void {
		if (
			speed < 0.6 ||
			distance > 22 ||
			(flags &
				(PLAYER_FLAG.hidden | PLAYER_FLAG.dead | PLAYER_FLAG.carried)) !==
				0
		) {
			return;
		}
		view.stepPhase += dt * speed * 0.9;
		if (view.stepPhase >= 1) {
			view.stepPhase = 0;
			const crouch = speed < 2;
			const room = this.world.roomAt(
				{ x: view.position.x, z: view.position.z },
				view.position.y + 0.1,
			);
			soundBank.play(liquid ? "step-water" : footstepSound(room?.style.floor), {
				position: view.position,
				volume: crouch ? 0.25 : 0.55,
				refDistance: 1.5,
				maxDistance: 22,
				occlusion: view.occlusion,
			});
		}
	}

	private splash(
		view: RemoteView,
		liquid: LiquidVolume | null,
		distance: number,
	): void {
		const id = liquid?.itemId ?? null;
		if (id === view.liquidId) {
			return;
		}
		view.liquidId = id;
		if (!liquid || distance > 24) {
			return;
		}
		const shallow = liquid.kind === "pond" || liquid.kind === "birdbath";
		soundBank.play(shallow ? "step-water" : "splash", {
			position: view.position,
			volume: shallow ? 0.5 : 0.85,
			refDistance: 2,
			maxDistance: 24,
			occlusion: view.occlusion,
		});
	}

	private setVisible(view: RemoteView, visible: boolean): void {
		view.visible = visible;
		view.model.root.visible = visible;
		if (!visible) {
			view.tag.visible = false;
			view.crown.visible = false;
		}
	}

	dispose(): void {
		for (const view of this.views.values()) {
			view.model.dispose();
			(view.tag.material as THREE.SpriteMaterial).map?.dispose();
			(view.tag.material as THREE.SpriteMaterial).dispose();
			(view.crown.material as THREE.SpriteMaterial).map?.dispose();
			(view.crown.material as THREE.SpriteMaterial).dispose();
		}
		this.views.clear();
	}
}
