import {
	CROUCH_EYE_DROP,
	ENERGY_MAX,
	EYE_HEIGHT_STANDING,
	HEALTH_MAX,
	MATERIAL_IDS,
	type MaterialId,
	OCCULT_IDS,
	type OccultId,
} from "../../shared/config/index.js";
import { type DevModes, noDevModes } from "../../shared/devModes.js";
import {
	DEFAULT_HAT_PATTERN,
	type HatPattern,
} from "../../shared/hatPatterns.js";
import type { Vec3 } from "../../shared/math.js";
import {
	PLAYER_FLAG,
	type PlayerSnapshot,
	type SpawnPoint,
} from "../../shared/protocol/game.js";
import {
	DEFAULT_LANTERN_TINT,
	type LanternTint,
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
	team: number | null = null;
	devModes: DevModes = noDevModes();

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

	get hidden(): boolean {
		return this.hiddenSpot >= 0;
	}

	get carried(): boolean {
		return this.carriedBy >= 0;
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
		};
	}
}

function round(value: number): number {
	return Math.round(value * 1000) / 1000;
}
