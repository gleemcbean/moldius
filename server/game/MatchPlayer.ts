import {
	CROUCH_EYE_DROP,
	ENERGY_MAX,
	EYE_HEIGHT_STANDING,
	HEALTH_MAX,
	MATERIAL_IDS,
	type MaterialId,
	OCCULT_IDS,
	type OccultId,
	VOICE_AUDIBLE_LEVEL,
	VOICE_AUDIBLE_SUSTAIN_MS,
	VOICE_AUDIBLE_WINDOW_MS,
} from "../../shared/config/index.js";
import { type DevModes, noDevModes } from "../../shared/devModes.js";
import {
	DEFAULT_HAT_PATTERN,
	type HatPattern,
} from "../../shared/hatPatterns.js";
import type { BrewEffect } from "../../shared/manor/brews.js";
import type { Vec3 } from "../../shared/math.js";
import { FILM_BASE_LEVEL } from "../../shared/minigames/filmRunner.js";
import {
	type CompulsionKind,
	PLAYER_FLAG,
	type PlayerSnapshot,
	type SpawnPoint,
} from "../../shared/protocol/game.js";
import {
	DEFAULT_LANTERN_TINT,
	type LanternTint,
	type Tagline,
} from "../../shared/rewards.js";
import { PoseHistory } from "./history.js";

export interface VoiceSample {
	t: number;
	level: number;
	activeMs: number;
}

export interface CastingState {
	since: number;
}

export interface CompulsionState {
	kind: CompulsionKind;
	until: number;
}

export class MatchPlayer {
	connected = true;
	loaded = false;
	position: Vec3;
	yaw: number;
	pitch = 0;
	velocity: Vec3 = { x: 0, y: 0, z: 0 };
	grounded = true;
	crouch = 0;
	sprintIntent = false;
	moveInput = false;
	grimoireOpen = false;
	lanternOpen = false;
	energy = ENERGY_MAX;
	energyRegenPause = 0;
	jumpsSeen = 0;
	sprintLocked = false;
	health = HEALTH_MAX;
	alive = true;
	respawnAt = 0;
	protectedUntil = 0;
	petrifiedUntil = 0;
	hiddenSpot = -1;
	carriedBy = -1;
	slimed = false;
	brew: BrewEffect | null = null;
	brewUntil = 0;
	brewCauldron: number | null = null;

	slimeDamageAt = -Infinity;
	lastStateAt = 0;
	lastSeq = -1;
	lastForcedMoveId = 0;
	forcedMoveSettledAt = 0;
	movementBudget = 1.5;
	fallPeakY: number | null = null;
	readonly voice: VoiceSample[] = [];
	casting: CastingState | null = null;
	held: OccultId | null = null;
	walkie = -1;
	camera = -1;
	cameraRaised = false;
	radioOn = false;
	radioNoiseAt = -Infinity;

	readonly materials = Object.fromEntries(
		MATERIAL_IDS.map((id) => [id, 0]),
	) as Record<MaterialId, number>;

	readonly objects = Object.fromEntries(
		OCCULT_IDS.map((id) => [id, 0]),
	) as Record<OccultId, number>;

	castBlockedUntil = 0;
	sabotageProtectedUntil = 0;
	pushCooldownUntil = 0;
	shoutCooldownUntil = 0;
	shoutingUntil = 0;
	voiceSabotageCooldownUntil = 0;
	lastDamageAt = -Infinity;
	score = 0;
	captures = 0;
	deaths = 0;
	roomId: number | null = null;
	disconnectedAt: number | null = null;
	readonly history = new PoseHistory();
	pattern: HatPattern = DEFAULT_HAT_PATTERN;
	lantern: LanternTint = DEFAULT_LANTERN_TINT;
	tagline: Tagline | null = null;
	team: number | null = null;
	devModes: DevModes = noDevModes();
	possessed = false;
	ghostDoorReadyAt = 0;
	ghostKnockReadyAt = 0;
	pingReadyAt = 0;
	readonly pingTimes: number[] = [];
	emoteReadyAt = 0;
	emoteUntil = 0;
	giftReadyAt = 0;
	powerReadyAt = 0;
	bountyHolder = false;
	bountyPushedBy: string | null = null;
	bountyPushedAt = -Infinity;
	bountyPushReadyAt = 0;
	infectedUntil = 0;
	infectedBy: number | null = null;
	immuneUntil = 0;
	nextCompulsionAt = 0;
	compulsion: CompulsionState | null = null;
	lastCompulsion: CompulsionKind | null = null;
	entrancedBy = -1;
	hallucinatingUntil = 0;
	hallucinatedBy: number | null = null;
	filmLevel = FILM_BASE_LEVEL;
	filmsPlayed = 0;

	constructor(
		readonly id: string,
		readonly name: string,
		readonly color: number,
		spawn: SpawnPoint,
		now: number,
	) {
		this.position = { x: spawn.x, y: spawn.y, z: spawn.z };
		this.yaw = spawn.yaw;
		this.lastStateAt = now;
	}

	get crouching(): boolean {
		return this.crouch >= 0.6;
	}

	brewActive(effect: BrewEffect, now: number): boolean {
		return this.brew === effect && now < this.brewUntil;
	}

	get hidden(): boolean {
		return this.hiddenSpot >= 0;
	}

	get carried(): boolean {
		return this.carriedBy >= 0;
	}

	get entranced(): boolean {
		return this.entrancedBy >= 0;
	}

	infected(now: number): boolean {
		return this.infectedUntil > now;
	}

	compelled(now: number): boolean {
		return this.compulsion !== null && this.compulsion.until > now;
	}

	hallucinating(now: number): boolean {
		return this.hallucinatingUntil > now;
	}

	get active(): boolean {
		return this.alive && this.connected && !this.hidden && !this.carried;
	}

	eyePosition(): Vec3 {
		return {
			x: this.position.x,
			y: this.position.y + EYE_HEIGHT_STANDING - CROUCH_EYE_DROP * this.crouch,
			z: this.position.z,
		};
	}

	bodyHeight(): number {
		return 1.78 - 0.6 * this.crouch;
	}

	recordVoice(sample: VoiceSample): void {
		this.voice.push(sample);

		const cutoff = sample.t - 8000;

		while (this.voice.length > 0 && this.voice[0].t < cutoff) {
			this.voice.shift();
		}
	}

	voiceLevelNow(now: number): number {
		const last = this.voice[this.voice.length - 1];

		if (!last || now - last.t > 400) {
			return 0;
		}

		return last.level;
	}

	audibleVoice(now: number): number | null {
		const level = this.voiceLevelNow(now);

		if (level < VOICE_AUDIBLE_LEVEL) {
			return null;
		}

		const sustained = this.voiceActivitySince(
			now - VOICE_AUDIBLE_WINDOW_MS,
			VOICE_AUDIBLE_LEVEL,
		);

		if (sustained < VOICE_AUDIBLE_SUSTAIN_MS) {
			return null;
		}

		return (level - VOICE_AUDIBLE_LEVEL) / (1 - VOICE_AUDIBLE_LEVEL);
	}

	voicePeakSince(since: number): number {
		return this.voice
			.filter((sample) => sample.t >= since)
			.reduce((peak, sample) => Math.max(peak, sample.level), 0);
	}

	voiceActivitySince(since: number, threshold: number): number {
		return this.voice
			.filter((sample) => sample.t >= since && sample.level >= threshold)
			.reduce((sum, sample) => sum + sample.activeMs, 0);
	}

	sustainedLevel(now: number, durationMs: number): number {
		const recent = this.voice.filter(
			(sample) => sample.t >= now - durationMs - 120,
		);

		if (recent.length === 0) {
			return 0;
		}

		const covered = recent.reduce((sum, sample) => sum + sample.activeMs, 0);

		if (covered < durationMs) {
			return 0;
		}

		return Math.min(...recent.map((sample) => sample.level));
	}

	flags(now: number): number {
		let flags = 0;

		if (
			this.sprintIntent &&
			this.moveInput &&
			!this.sprintLocked &&
			this.crouch < 0.5
		) {
			flags |= PLAYER_FLAG.sprint;
		}

		if (this.lanternOpen) {
			flags |= PLAYER_FLAG.lantern;
		}

		if (this.grimoireOpen) {
			flags |= PLAYER_FLAG.grimoire;
		}

		if (this.hidden) {
			flags |= PLAYER_FLAG.hidden;
		}

		if (!this.alive) {
			flags |= PLAYER_FLAG.dead;
		}

		if (this.carried) {
			flags |= PLAYER_FLAG.carried;
		}

		if (this.casting) {
			flags |= PLAYER_FLAG.casting;
		}

		if (this.protectedUntil > now) {
			flags |= PLAYER_FLAG.protected;
		}

		if (this.slimed) {
			flags |= PLAYER_FLAG.slimed;
		}

		if (this.sprintLocked) {
			flags |= PLAYER_FLAG.sprintLocked;
		}

		if (this.voiceLevelNow(now) > 0.12) {
			flags |= PLAYER_FLAG.speaking;
		}

		if (this.shoutingUntil > now) {
			flags |= PLAYER_FLAG.shouting;
		}

		if (this.alive && this.petrifiedUntil > now) {
			flags |= PLAYER_FLAG.petrified;
		}

		if (this.alive && !this.grounded && !this.hidden && !this.carried) {
			flags |= PLAYER_FLAG.airborne;
		}

		if (this.radioOn) {
			flags |= PLAYER_FLAG.radio;
		}

		if (this.cameraRaised && this.camera >= 0 && this.alive) {
			flags |= PLAYER_FLAG.camera;
		}

		if (this.walkie >= 0) {
			flags |= PLAYER_FLAG.walkieHeld;
		}

		if (this.camera >= 0) {
			flags |= PLAYER_FLAG.cameraHeld;
		}

		if (this.bountyHolder) {
			flags |= PLAYER_FLAG.bounty;
		}

		if (this.alive && this.infected(now)) {
			flags |= PLAYER_FLAG.infected;
		}

		if (this.alive && this.compelled(now)) {
			flags |= PLAYER_FLAG.compelled;
		}

		if (this.alive && this.entranced) {
			flags |= PLAYER_FLAG.entranced;
		}

		if (this.alive && this.hallucinating(now)) {
			flags |= PLAYER_FLAG.hallucinating;
		}

		return flags;
	}

	snapshot(now: number): PlayerSnapshot {
		return {
			id: this.id,
			x: round(this.position.x),
			y: round(this.position.y),
			z: round(this.position.z),
			yaw: round(this.yaw),
			pitch: round(this.pitch),
			crouch: round(this.crouch),
			speed: round(Math.hypot(this.velocity.x, this.velocity.z)),
			flags: this.flags(now),
			hp: Math.round(this.health * 10) / 10,
			en: Math.round(this.energy * 10) / 10,
			score: this.score,
			hideSpot: this.hiddenSpot,
			moveId: this.lastForcedMoveId,
			...(this.held && this.objects[this.held] > 0
				? { held: OCCULT_IDS.indexOf(this.held) }
				: {}),
		};
	}
}

function round(value: number): number {
	return Math.round(value * 1000) / 1000;
}
