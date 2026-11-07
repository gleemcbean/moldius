import type { Vec3 } from "@shared/math";
import { pullBackToSight } from "@shared/physics/lineOfSight";
import type { Highlight } from "@shared/protocol/game";
import * as THREE from "three";
import { audioEngine } from "../../audio/audioEngine";
import { replayStore } from "../replayStore";
import { ReplayVoices } from "./ReplayVoices";
import type { LoadedWorld } from "./SessionLoader";

const FRAME_LOOKAHEAD_MS = 150;
const ORBIT_RADIUS = 3.9;
const ORBIT_HEIGHT = 1.7;
const ORBIT_SPEED = 0.1;
const CAMERA_FOLLOW = 3.2;
const FOCUS_HEIGHT = 0.9;
const FRAME_BOTH_RANGE = 10;
const AUDIO_LEAD_SECONDS = 0.06;
const VOICE_HEIGHT = 1.5;
const FILL_LIGHT = { color: 0xfff0d8, intensity: 7, range: 13 };
const VOICE_PUBLISH_MS = 70;
/** Trop près du joueur, on ne voit plus que son chapeau : on cherche un meilleur angle. */
const ROOMY_DISTANCE = 3;
const ORBIT_TRIES = 8;
const LOOK_AROUND_SECONDS = 0.8;

/**
 * Rejoue un extrait comme une partie en direct : les images du serveur passent par
 * les mêmes tampons et les mêmes événements, seule l'horloge est celle de l'extrait.
 */
export class ReplayDirector {
	private index = -1;
	private clip: Highlight | null = null;
	private time = 0;
	private endT = 0;
	private frameIndex = 0;
	private eventIndex = 0;
	private tick = 0;
	private orbit = 0;
	private fresh = true;
	private voice = 0;
	private voicePublishedAt = 0;
	private lookAroundIn = 0;
	private startT = 0;
	private audioStart = 0;
	private readonly voices = new ReplayVoices();
	private readonly look = new THREE.Vector3();
	private readonly focus = new THREE.Vector3();

	constructor(
		private readonly loaded: LoadedWorld,
		private readonly highlights: Highlight[],
	) {}

	/** Faux tant qu'il reste un extrait à montrer. */
	next(): boolean {
		this.voices.stop();
		this.index += 1;
		const clip = this.highlights[this.index];
		if (!clip || clip.frames.length === 0) {
			this.clip = null;
			return false;
		}
		this.clip = clip;
		this.startT = clip.frames[0].t;
		this.time = this.startT;
		this.endT = clip.frames[clip.frames.length - 1].t;
		this.frameIndex = 0;
		this.eventIndex = 0;
		this.fresh = true;
		this.voice = 0;
		const { state, doors, remotePlayers } = this.loaded;
		state.resetForReplay(clip.doorsOpen);
		for (const [doorId, door] of state.doors) {
			doors.setOpen(doorId, door.open);
			doors.snap(doorId);
		}
		remotePlayers.resetPoses();
		const subject = clip.frames[0].players.find(
			(player) => player.id === clip.playerId,
		);
		this.orbit = (subject?.yaw ?? 0) + 0.5;
		this.publish();
		this.pushFrames();
		this.audioStart = audioEngine.ctx.currentTime + AUDIO_LEAD_SECONDS;
		this.voices.play(
			new Set(
				clip.frames.flatMap((frame) =>
					frame.players.map((player) => player.id),
				),
			),
			this.startT,
			this.endT,
			this.audioStart,
		);
		return true;
	}

	stop(): void {
		this.voices.stop();
	}

	/** L'horloge du son mène : l'image suit la voix même si le rendu rame. */
	private tickClock(dt: number): void {
		const context = audioEngine.ctx;
		this.time =
			context.state === "running"
				? this.startT +
					Math.max(0, context.currentTime - this.audioStart) * 1000
				: this.time + dt * 1000;
	}

	private placeVoices(): void {
		for (const player of this.loaded.state.players.values()) {
			const sample = player.buffer.sample(this.time);
			if (sample) {
				this.voices.place(
					player.id,
					sample.x,
					sample.y + VOICE_HEIGHT,
					sample.z,
				);
			}
		}
	}

	private publish(): void {
		const clip = this.clip;
		if (!clip) {
			return;
		}
		const players = this.loaded.state.players;
		const subject = players.get(clip.playerId);
		replayStore.replace({
			active: true,
			index: this.index,
			total: this.highlights.length,
			voice: 0,
			moment: {
				kind: clip.kind,
				name: subject?.name ?? "?",
				other: clip.otherId ? (players.get(clip.otherId)?.name ?? null) : null,
				species: clip.species,
				value: clip.value,
				color: subject?.color ?? 0xffffff,
			},
		});
	}

	private pushFrames(): void {
		const clip = this.clip as Highlight;
		const { state, remotePlayers } = this.loaded;
		while (
			this.frameIndex < clip.frames.length &&
			clip.frames[this.frameIndex].t <= this.time + FRAME_LOOKAHEAD_MS
		) {
			const frame = clip.frames[this.frameIndex];
			this.tick += 1;
			state.applySnapshot({
				tick: this.tick,
				t: frame.t,
				remainingMs: 0,
				players: frame.players,
				anomalies: frame.anomalies,
			});
			for (const player of frame.players) {
				remotePlayers.setReplayVoice(player.id, player.v);
				if (player.id === clip.playerId) {
					this.voice = player.v;
				}
			}
			this.frameIndex += 1;
		}
	}

	/** Avance l'extrait et rend l'heure à afficher, ou null quand tout est montré. */
	advance(dt: number): number | null {
		let clip = this.clip;
		if (!clip) {
			return null;
		}
		this.tickClock(dt);
		if (this.time >= this.endT) {
			if (!this.next()) {
				return null;
			}
			clip = this.clip as Highlight;
		}
		this.pushFrames();
		while (
			this.eventIndex < clip.events.length &&
			clip.events[this.eventIndex].t <= this.time
		) {
			const entry = clip.events[this.eventIndex];
			this.loaded.state.applyEvents([entry.event], entry.t);
			this.eventIndex += 1;
		}
		this.moveCamera(dt, clip);
		this.placeVoices();
		const now = performance.now();
		if (now - this.voicePublishedAt > VOICE_PUBLISH_MS) {
			this.voicePublishedAt = now;
			replayStore.set({ voice: this.voice });
		}
		return this.time;
	}

	/** Le mur le plus proche ramène la caméra vers le joueur. */
	private cameraSpot(angle: number): Vec3 {
		return pullBackToSight(
			this.loaded.world,
			this.focus,
			{
				x: this.focus.x + Math.sin(angle) * ORBIT_RADIUS,
				y: this.focus.y + ORBIT_HEIGHT,
				z: this.focus.z + Math.cos(angle) * ORBIT_RADIUS,
			},
			0.3,
		);
	}

	private distanceToFocus(spot: Vec3): number {
		return Math.hypot(
			spot.x - this.focus.x,
			spot.y - this.focus.y,
			spot.z - this.focus.z,
		);
	}

	private moveCamera(dt: number, clip: Highlight): void {
		const { camera, state, worldLantern } = this.loaded;
		const subject = state.players.get(clip.playerId)?.buffer.sample(this.time);
		if (subject) {
			this.focus.set(subject.x, subject.y + FOCUS_HEIGHT, subject.z);
		}
		const other =
			clip.anomalyId === null
				? null
				: state.anomalies.get(clip.anomalyId)?.buffer.sample(this.time);
		if (
			other &&
			subject &&
			Math.hypot(other.x - subject.x, other.z - subject.z) < FRAME_BOTH_RANGE
		) {
			this.focus.lerp(
				new THREE.Vector3(other.x, other.y + FOCUS_HEIGHT, other.z),
				0.35,
			);
		}
		this.orbit += dt * ORBIT_SPEED;
		let clear = this.cameraSpot(this.orbit);
		this.lookAroundIn -= dt;
		if (
			(this.fresh || this.lookAroundIn <= 0) &&
			this.distanceToFocus(clear) < ROOMY_DISTANCE
		) {
			this.lookAroundIn = LOOK_AROUND_SECONDS;
			for (let step = 1; step < ORBIT_TRIES; step += 1) {
				const angle = this.orbit + (step / ORBIT_TRIES) * Math.PI * 2;
				const spot = this.cameraSpot(angle);
				if (this.distanceToFocus(spot) > this.distanceToFocus(clear) + 0.3) {
					clear = spot;
					this.orbit = angle;
				}
			}
		}
		const follow = this.fresh ? 1 : 1 - Math.exp(-dt * CAMERA_FOLLOW);
		this.fresh = false;
		camera.position.lerp(new THREE.Vector3(clear.x, clear.y, clear.z), follow);
		this.look.lerp(this.focus, follow);
		camera.lookAt(this.look);
		worldLantern.position.set(this.focus.x, this.focus.y + 1.1, this.focus.z);
		worldLantern.color.setHex(FILL_LIGHT.color);
		worldLantern.intensity = FILL_LIGHT.intensity;
		worldLantern.distance = FILL_LIGHT.range;
	}
}
