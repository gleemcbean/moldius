export interface MarkerBody {
	x: number;
	y: number;
	z: number;
	yaw: number;
}

export interface DisguiseBody extends MarkerBody {
	anomalyId: number;
	playerId: string;
}

type Point = { x: number; y: number; z: number };

const SWITCH_MARGIN = 2;
const SLIDE_MS = 1200;

function distance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

interface MarkerTrack {
	source: number | null;
	shownX: number;
	shownZ: number;
	fromX: number;
	fromZ: number;
	slideStart: number;
}

/**
 * Chaque joueur garde un seul point sur la carte : celui de son corps ou d'un
 * Doppelgänger qui l'imite, selon lequel est le plus proche de celui qui regarde.
 * On voit donc toujours le bon nombre de points, et celui du faux est bien là
 * quand on le croise. Le point glisse au changement au lieu de sauter.
 */
export class PlayerMarkerBlender {
	private readonly tracks = new Map<string, MarkerTrack>();

	place(
		playerId: string,
		viewer: Point,
		real: MarkerBody,
		disguises: readonly DisguiseBody[],
		now: number,
		realIsDead = false,
	): MarkerBody {
		const own = realIsDead
			? []
			: disguises.filter((body) => body.playerId === playerId);
		const bodyOf = (source: number | null): MarkerBody | null =>
			source === null
				? real
				: (own.find((body) => body.anomalyId === source) ?? null);
		const track = this.tracks.get(playerId) ?? {
			source: null,
			shownX: real.x,
			shownZ: real.z,
			fromX: real.x,
			fromZ: real.z,
			slideStart: -SLIDE_MS,
		};
		this.tracks.set(playerId, track);
		let nearest: number | null = null;
		let nearestDistance = distance(real, viewer);
		for (const body of own) {
			const away = distance(body, viewer);
			if (away < nearestDistance) {
				nearest = body.anomalyId;
				nearestDistance = away;
			}
		}
		const current = bodyOf(track.source);
		if (
			nearest !== track.source &&
			(!current || nearestDistance + SWITCH_MARGIN < distance(current, viewer))
		) {
			track.source = nearest;
			track.fromX = track.shownX;
			track.fromZ = track.shownZ;
			track.slideStart = now;
		}
		const body = bodyOf(track.source) ?? real;
		const t = Math.min(1, (now - track.slideStart) / SLIDE_MS);
		const eased = t * t * (3 - 2 * t);
		track.shownX = track.fromX + (body.x - track.fromX) * eased;
		track.shownZ = track.fromZ + (body.z - track.fromZ) * eased;
		return { ...body, x: track.shownX, z: track.shownZ };
	}
}

const CLIP_START_LEVEL = 0.22;
const CLIP_KEEP_LEVEL = 0.12;
const CLIP_SILENCE_MS = 400;
const CLIP_MIN_MS = 600;
const CLIP_MAX_MS = 3000;

export type ClipGateAction = "start" | "keep" | "discard" | null;

/** Repère un bout de phrase dans le niveau d'une voix. */
export class VoiceClipGate {
	private startedAt: number | null = null;
	private lastLoudAt = 0;

	step(level: number, now: number): ClipGateAction {
		if (this.startedAt === null) {
			if (level < CLIP_START_LEVEL) {
				return null;
			}
			this.startedAt = now;
			this.lastLoudAt = now;
			return "start";
		}
		if (level >= CLIP_KEEP_LEVEL) {
			this.lastLoudAt = now;
		}
		if (now - this.startedAt >= CLIP_MAX_MS) {
			this.startedAt = null;
			return "keep";
		}
		if (now - this.lastLoudAt < CLIP_SILENCE_MS) {
			return null;
		}
		const spoken = this.lastLoudAt - this.startedAt;
		this.startedAt = null;
		return spoken >= CLIP_MIN_MS ? "keep" : "discard";
	}
}
