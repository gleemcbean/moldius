import {
	LANTERN_LIGHT_INTENSITY,
	LANTERN_LIGHT_RANGE,
} from "@shared/config/index";
import { OCCULT_IDS } from "@shared/config/occult";
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
import { nameTag } from "./nameTag";

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
}

export class RemotePlayers {
	readonly group = new THREE.Group();
	private readonly views = new Map<string, RemoteView>();
	private readonly replayVoices = new Map<string, number>();
	private spectating = false;
	private time = 0;
	/** Les joueurs entendus au talkie en ce moment, pour les afficher. */
	radioSpeakers: string[] = [];

	constructor(
		private readonly state: ClientWorldState,
		kit: ModelKit,
		private readonly world: CollisionWorld,
	) {
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
			this.group.add(model.root, tag);
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
			});
			if (player.id === state.selfId) {
				model.root.visible = false;
				tag.visible = false;
			}
		}
	}

	/** Dans les meilleurs moments, on se voit aussi soi-même, sans le son du tchat. */
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
		}
		this.replayVoices.clear();
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
			if (hidden || dead) {
				view.pose.reset();
			}
			view.pose.update(sample, dt);
			view.position.set(view.pose.x, view.pose.y, view.pose.z);
			this.setVisible(view, !hidden);
			view.model.root.position.copy(view.position);
			view.model.root.rotation.y = modelYaw(view.pose.yaw);
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
			view.model.update(dt, {
				speed: view.pose.speed,
				crouch: sample.value.crouch,
				grounded: (flags & PLAYER_FLAG.airborne) === 0,
				sprinting: (flags & PLAYER_FLAG.sprint) !== 0,
				lanternOpen,
				grimoireOpen: (flags & PLAYER_FLAG.grimoire) !== 0,
				dead,
				talking,
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
				!dead &&
				distance < 11 &&
				lineOfSight(this.world, eye, view.tag.position);
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
			if (!this.spectating) {
				voiceChat.updateSpatial(
					view.id,
					{ x: view.position.x, y: view.position.y + 1.5, z: view.position.z },
					view.occlusion,
					distance,
				);
			}
			this.footsteps(view, view.pose.speed, dt, flags, distance);
		}
	}

	private footsteps(
		view: RemoteView,
		speed: number,
		dt: number,
		flags: number,
		distance: number,
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
			soundBank.play(footstepSound(room?.style.floor), {
				position: view.position,
				volume: crouch ? 0.25 : 0.55,
				refDistance: 1.5,
				maxDistance: 22,
				occlusion: view.occlusion,
			});
		}
	}

	private setVisible(view: RemoteView, visible: boolean): void {
		view.visible = visible;
		view.model.root.visible = visible;
		if (!visible) {
			view.tag.visible = false;
		}
	}

	dispose(): void {
		for (const view of this.views.values()) {
			view.model.dispose();
			(view.tag.material as THREE.SpriteMaterial).map?.dispose();
			(view.tag.material as THREE.SpriteMaterial).dispose();
		}
		this.views.clear();
	}
}
