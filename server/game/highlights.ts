import { VOICE_AUDIBLE_LEVEL } from "../../shared/config/index.js";
import type { SpeciesId } from "../../shared/config/species.js";
import {
	ANOMALY_STATES,
	type GameEvent,
	type Highlight,
	type HighlightFrame,
	type HighlightKind,
	type TimedEvent,
	type WorldSnapshot,
} from "../../shared/protocol/game.js";
import type { TimeWindow } from "../../shared/voiceTimeline.js";

export const HIGHLIGHT_LEAD_MS = 6_000;
export const HIGHLIGHT_TAIL_MS = 3_500;
export const HIGHLIGHT_COUNT = 3;

const BUFFER_MS = HIGHLIGHT_LEAD_MS + HIGHLIGHT_TAIL_MS + 1_000;
const MERGE_MS = 5_000;
const MAX_CANDIDATES = 10;
const NEARBY_RANGE = 30;
const SCREAM_LEVEL = 0.55;
const SCREAM_MIN_MS = 500;
const ESCAPE_MIN_MS = 8_000;
const DOUBLE_CHAT_RANGE = 5;
const DOUBLE_CHAT_MIN_MS = 1_500;
const BETRAYAL_MS = 6_000;
const RADIO_BETRAYAL_MS = 12_000;
const LOW_HEALTH = 30;
/** Le même joueur ou le même type de moment trois fois de suite, c'est moins drôle. */
const REPEAT_PENALTY = 25;
const WINDOWS_INTERVAL_MS = 1_000;

const REPLAYED_EVENTS: ReadonlySet<GameEvent["type"]> = new Set([
	"door",
	"valve",
	"puddle",
	"puddleRemoved",
	"projectile",
	"projectileEnd",
	"damage",
	"death",
	"respawn",
	"capture",
	"anomalySpawn",
	"anomalyRemoved",
	"explosion",
	"attack",
	"pulse",
	"scream",
	"shout",
	"push",
	"reveal",
	"carry",
	"thrown",
	"laserCharge",
	"laser",
	"stake",
] satisfies GameEvent["type"][]);

const CHASING = new Set(["chase", "windup"]);

export interface RecorderPlayer {
	id: string;
	alive: boolean;
	hidden: boolean;
	health: number;
	radioNoiseAt: number;
	position: { x: number; y: number; z: number };
	voiceLevelNow(now: number): number;
}

export interface RecorderMatch {
	now: number;
	players: ReadonlyMap<string, RecorderPlayer>;
	openDoors(): number[];
}

interface MomentInput {
	kind: HighlightKind;
	playerId: string;
	score: number;
	otherId?: string | null;
	anomalyId?: number | null;
	species?: SpeciesId | null;
	value?: number;
}

interface Candidate extends Required<MomentInput> {
	focusT: number;
	startT: number;
	doorsOpen: number[];
	clip: Pick<Highlight, "frames" | "events"> | null;
}

interface PlayerTrack {
	loudMs: number;
	peak: number;
	chaseMs: number;
	chaser: number | null;
	doubleMs: number;
	doubleBlockedUntil: number;
}

function newTrack(): PlayerTrack {
	return {
		loudMs: 0,
		peak: 0,
		chaseMs: 0,
		chaser: null,
		doubleMs: 0,
		doubleBlockedUntil: 0,
	};
}

/**
 * Garde en mémoire les dernières secondes de la partie et les recopie quand un
 * moment mérite d'être revu. Le son ne passe jamais par ici : le serveur indique
 * seulement quelles périodes garder, et chaque joueur garde la voix de son côté.
 */
export class HighlightRecorder {
	private readonly frames: HighlightFrame[] = [];
	private readonly log: TimedEvent[] = [];
	private readonly candidates: Candidate[] = [];
	private readonly tracks = new Map<string, PlayerTrack>();
	private readonly pushedBy = new Map<string, { by: string; at: number }>();
	private readonly speciesOf: (anomalyId: number) => SpeciesId | null;
	private readonly onWindows: (windows: TimeWindow[]) => void;
	private windowsChanged = false;
	private windowsSentAt = -Infinity;

	constructor(
		speciesOf: (anomalyId: number) => SpeciesId | null,
		onWindows: (windows: TimeWindow[]) => void = () => undefined,
	) {
		this.speciesOf = speciesOf;
		this.onWindows = onWindows;
	}

	frame(snapshot: WorldSnapshot, match: RecorderMatch): void {
		this.frames.push({
			t: snapshot.t,
			players: snapshot.players.map((player) => ({
				...player,
				v:
					Math.round(
						(match.players.get(player.id)?.voiceLevelNow(snapshot.t) ?? 0) *
							100,
					) / 100,
			})),
			anomalies: snapshot.anomalies,
		});
		const cutoff = snapshot.t - BUFFER_MS;
		while (this.frames.length > 0 && this.frames[0].t < cutoff) {
			this.frames.shift();
		}
		while (this.log.length > 0 && this.log[0].t < cutoff) {
			this.log.shift();
		}
		this.scan(snapshot, match);
		this.seal(snapshot.t);
		this.announceWindows(snapshot.t);
	}

	/** Un hurlement déplace son moment à chaque image : une annonce par seconde suffit. */
	private announceWindows(now: number): void {
		if (
			!this.windowsChanged ||
			now - this.windowsSentAt < WINDOWS_INTERVAL_MS
		) {
			return;
		}
		this.windowsChanged = false;
		this.windowsSentAt = now;
		this.onWindows(
			this.candidates.map((candidate) => ({
				from: candidate.startT,
				to: candidate.focusT + HIGHLIGHT_TAIL_MS,
			})),
		);
	}

	private scan(snapshot: WorldSnapshot, match: RecorderMatch): void {
		const elapsed = 100;
		for (const player of match.players.values()) {
			const track = this.track(player.id);
			const chaser = snapshot.anomalies.find(
				(anomaly) =>
					anomaly.target === player.id &&
					CHASING.has(ANOMALY_STATES[anomaly.state] ?? ""),
			);
			const level = player.voiceLevelNow(snapshot.t);
			if (chaser && player.alive) {
				track.chaseMs += elapsed;
				track.chaser = chaser.id;
				if (level >= SCREAM_LEVEL) {
					track.loudMs += elapsed;
					track.peak = Math.max(track.peak, level);
					if (track.loudMs >= SCREAM_MIN_MS) {
						this.mark(match, {
							kind: "scream",
							playerId: player.id,
							anomalyId: chaser.id,
							species: this.speciesOf(chaser.id),
							value: track.peak,
							score: 55 + track.peak * 20 + Math.min(25, track.loudMs / 100),
						});
					}
				}
			} else {
				if (player.alive && track.chaseMs >= ESCAPE_MIN_MS) {
					this.mark(match, {
						kind: "escape",
						playerId: player.id,
						anomalyId: track.chaser,
						species:
							track.chaser === null ? null : this.speciesOf(track.chaser),
						value: track.chaseMs,
						score: 20 + Math.min(25, track.chaseMs / 800),
					});
				}
				track.chaseMs = 0;
				track.chaser = null;
				track.loudMs = 0;
				track.peak = 0;
			}
			this.scanDoubleChat(snapshot, match, player, track, level);
		}
	}

	private scanDoubleChat(
		snapshot: WorldSnapshot,
		match: RecorderMatch,
		player: RecorderPlayer,
		track: PlayerTrack,
		level: number,
	): void {
		if (
			!player.alive ||
			level < VOICE_AUDIBLE_LEVEL ||
			snapshot.t < track.doubleBlockedUntil
		) {
			return;
		}
		const double = snapshot.anomalies.find(
			(anomaly) =>
				anomaly.mimic !== null &&
				anomaly.mimic !== player.id &&
				Math.hypot(
					anomaly.x - player.position.x,
					anomaly.y - player.position.y,
					anomaly.z - player.position.z,
				) < DOUBLE_CHAT_RANGE,
		);
		if (!double) {
			return;
		}
		track.doubleMs += 100;
		if (track.doubleMs >= DOUBLE_CHAT_MIN_MS) {
			track.doubleMs = 0;
			track.doubleBlockedUntil = snapshot.t + 20_000;
			this.mark(match, {
				kind: "doubleChat",
				playerId: player.id,
				otherId: double.mimic,
				anomalyId: double.id,
				species: this.speciesOf(double.id),
				score: 62,
			});
		}
	}

	event(event: GameEvent, match: RecorderMatch): void {
		if (REPLAYED_EVENTS.has(event.type)) {
			this.log.push({ t: match.now, event });
		}
		switch (event.type) {
			case "push":
				this.pushedBy.set(event.targetId, {
					by: event.fromId,
					at: match.now,
				});
				break;
			case "death":
				this.onDeath(event, match);
				break;
			case "explosion": {
				const first = event.killed[0];
				if (first) {
					this.mark(match, {
						kind: "explosion",
						playerId: first,
						anomalyId: event.anomalyId,
						species: this.speciesOf(event.anomalyId),
						value: event.killed.length,
						score: 45 + event.killed.length * 18,
					});
				}
				break;
			}
			case "extractWarning": {
				const player = match.players.get(event.playerId);
				const radio =
					player !== undefined &&
					match.now - player.radioNoiseAt < RADIO_BETRAYAL_MS;
				this.mark(match, {
					kind: radio ? "radioBetrayal" : "extracted",
					playerId: event.playerId,
					anomalyId: event.anomalyId,
					species: this.speciesOf(event.anomalyId),
					score: radio ? 82 : 58,
				});
				break;
			}
			case "carry":
				if (event.active) {
					this.mark(match, {
						kind: "carried",
						playerId: event.playerId,
						anomalyId: event.anomalyId,
						species: this.speciesOf(event.anomalyId),
						score: 40,
					});
				}
				break;
			case "thrown":
				this.mark(match, {
					kind: "thrown",
					playerId: event.playerId,
					anomalyId: event.anomalyId,
					species: this.speciesOf(event.anomalyId),
					score: 52,
				});
				break;
			case "capture": {
				const player = match.players.get(event.playerId);
				const track = this.track(event.playerId);
				const clutch =
					(player !== undefined && player.health <= LOW_HEALTH) ||
					(track.chaser !== null && track.chaser !== event.anomalyId);
				this.mark(match, {
					kind: clutch ? "clutch" : "capture",
					playerId: event.playerId,
					anomalyId: event.anomalyId,
					species: event.species,
					value: event.points,
					score: clutch ? 68 : 16 + Math.min(14, event.points / 20),
				});
				break;
			}
			case "stake":
				if (event.playerId && event.stake === "reliquary") {
					this.mark(match, {
						kind: "heist",
						playerId: event.playerId,
						score: 46,
					});
				} else if (event.playerId && event.stake === "pact") {
					this.mark(match, {
						kind: "pact",
						playerId: event.playerId,
						score: 28,
					});
				}
				break;
			default:
				break;
		}
	}

	private onDeath(
		event: Extract<GameEvent, { type: "death" }>,
		match: RecorderMatch,
	): void {
		const track = this.track(event.playerId);
		if (event.cause === "fall" || event.cause === "explosion") {
			return;
		}
		if (event.cause === "pact") {
			this.mark(match, {
				kind: "pactDeath",
				playerId: event.playerId,
				score: 74,
			});
			return;
		}
		const push = this.pushedBy.get(event.playerId);
		if (push && match.now - push.at < BETRAYAL_MS) {
			this.mark(match, {
				kind: "betrayed",
				playerId: event.playerId,
				otherId: push.by,
				anomalyId: track.chaser,
				species: event.cause,
				score: 88,
			});
			return;
		}
		this.mark(match, {
			kind: "death",
			playerId: event.playerId,
			anomalyId: track.chaser,
			species: event.cause,
			score: 30,
		});
	}

	fall(
		playerId: string,
		drop: number,
		lethal: boolean,
		match: RecorderMatch,
	): void {
		this.mark(match, {
			kind: lethal ? "fallDeath" : "fall",
			playerId,
			value: Math.round(drop * 10) / 10,
			score: 32 + drop * 5 + (lethal ? 32 : 0),
		});
	}

	private mark(match: RecorderMatch, moment: MomentInput): void {
		const now = match.now;
		const close = this.candidates.find(
			(other) =>
				other.playerId === moment.playerId &&
				Math.abs(other.focusT - now) < MERGE_MS,
		);
		if (close) {
			if (close.score >= moment.score) {
				return;
			}
			this.candidates.splice(this.candidates.indexOf(close), 1);
		}
		const startT = now - HIGHLIGHT_LEAD_MS;
		this.windowsChanged = true;
		this.candidates.push({
			kind: moment.kind,
			playerId: moment.playerId,
			score: moment.score,
			otherId: moment.otherId ?? null,
			anomalyId: moment.anomalyId ?? null,
			species: moment.species ?? null,
			value: moment.value ?? 0,
			focusT: now,
			startT,
			doorsOpen: this.openDoorsAt(startT, match),
			clip: null,
		});
		if (this.candidates.length > MAX_CANDIDATES) {
			const weakest = this.candidates.reduce((low, other) =>
				other.score < low.score ? other : low,
			);
			this.candidates.splice(this.candidates.indexOf(weakest), 1);
		}
	}

	/** Remonte le journal pour retrouver les portes telles qu'elles étaient au début. */
	private openDoorsAt(t: number, match: RecorderMatch): number[] {
		const open = new Set(match.openDoors());
		for (let index = this.log.length - 1; index >= 0; index -= 1) {
			const entry = this.log[index];
			if (entry.t <= t) {
				break;
			}
			if (entry.event.type === "door") {
				if (entry.event.open) {
					open.delete(entry.event.doorId);
				} else {
					open.add(entry.event.doorId);
				}
			}
		}
		return [...open];
	}

	private seal(now: number): void {
		for (const candidate of this.candidates) {
			if (!candidate.clip && now >= candidate.focusT + HIGHLIGHT_TAIL_MS) {
				candidate.clip = this.cut(candidate);
			}
		}
	}

	private cut(candidate: Candidate): Pick<Highlight, "frames" | "events"> {
		const endT = candidate.focusT + HIGHLIGHT_TAIL_MS;
		const frames = this.frames.filter(
			(frame) => frame.t >= candidate.startT && frame.t <= endT,
		);
		const keptPlayers = new Set([candidate.playerId]);
		const keptAnomalies = new Set<number>();
		if (candidate.anomalyId !== null) {
			keptAnomalies.add(candidate.anomalyId);
		}
		if (candidate.otherId) {
			keptPlayers.add(candidate.otherId);
		}
		for (const frame of frames) {
			const subject = frame.players.find(
				(player) => player.id === candidate.playerId,
			);
			if (!subject) {
				continue;
			}
			const near = (other: { x: number; y: number; z: number }) =>
				Math.hypot(
					other.x - subject.x,
					other.y - subject.y,
					other.z - subject.z,
				) < NEARBY_RANGE;
			for (const player of frame.players) {
				if (near(player)) {
					keptPlayers.add(player.id);
				}
			}
			for (const anomaly of frame.anomalies) {
				if (near(anomaly)) {
					keptAnomalies.add(anomaly.id);
				}
			}
		}
		return {
			frames: frames.map((frame) => ({
				t: frame.t,
				players: frame.players.filter((player) => keptPlayers.has(player.id)),
				anomalies: frame.anomalies.filter((anomaly) =>
					keptAnomalies.has(anomaly.id),
				),
			})),
			events: this.log.filter(
				(entry) => entry.t >= candidate.startT && entry.t <= endT,
			),
		};
	}

	finish(): Highlight[] {
		for (const candidate of this.candidates) {
			candidate.clip ??= this.cut(candidate);
		}
		const usable = this.candidates.filter(
			(candidate) => (candidate.clip?.frames.length ?? 0) > 5,
		);
		const chosen: Candidate[] = [];
		while (chosen.length < HIGHLIGHT_COUNT && usable.length > 0) {
			const adjusted = (candidate: Candidate) =>
				candidate.score -
				chosen.filter((other) => other.kind === candidate.kind).length *
					REPEAT_PENALTY -
				(chosen.filter((other) => other.playerId === candidate.playerId)
					.length *
					REPEAT_PENALTY) /
					2;
			const best = usable.reduce((top, other) =>
				adjusted(other) > adjusted(top) ? other : top,
			);
			usable.splice(usable.indexOf(best), 1);
			chosen.push(best);
		}
		return chosen.map((candidate) => ({
			kind: candidate.kind,
			playerId: candidate.playerId,
			otherId: candidate.otherId,
			anomalyId: candidate.anomalyId,
			species: candidate.species,
			value: candidate.value,
			focusT: candidate.focusT,
			doorsOpen: candidate.doorsOpen,
			frames: candidate.clip?.frames ?? [],
			events: candidate.clip?.events ?? [],
		}));
	}

	private track(playerId: string): PlayerTrack {
		let track = this.tracks.get(playerId);
		if (!track) {
			track = newTrack();
			this.tracks.set(playerId, track);
		}
		return track;
	}
}
