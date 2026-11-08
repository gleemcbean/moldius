import { PLAYER_NAME_MAX_LENGTH } from "../../shared/config/index.js";
import type {
	CastRequest,
	ClientStateMessage,
	InteractRequest,
} from "../../shared/protocol/game.js";
import type {
	VoiceSignal,
	VoiceSignalEnvelope,
} from "../../shared/protocol/lobby.js";
import {
	VOICE_RELAY_MAX_BYTES,
	VOICE_RELAY_MAX_PEERS,
} from "../../shared/voiceRelay.js";

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function finiteNumber(
	value: unknown,
	min: number,
	max: number,
): number | null {
	if (
		typeof value !== "number" ||
		!Number.isFinite(value) ||
		value < min ||
		value > max
	) {
		return null;
	}
	return value;
}

function bool(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

export function sanitizeName(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const cleaned = value
		.normalize("NFC")
		.replace(/[\u0000-\u001f\u007f<>]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, PLAYER_NAME_MAX_LENGTH);
	return cleaned.length >= 2 ? cleaned : null;
}

export function sanitizeToken(value: unknown): string | null {
	if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(value)) {
		return null;
	}
	return value;
}

export function parseClientState(payload: unknown): ClientStateMessage | null {
	if (!isRecord(payload)) {
		return null;
	}
	const seq = finiteNumber(payload.seq, 0, 1e9);
	const x = finiteNumber(payload.x, -500, 500);
	const y = finiteNumber(payload.y, -20, 40);
	const z = finiteNumber(payload.z, -500, 500);
	const yaw = finiteNumber(payload.yaw, -100, 100);
	const pitch = finiteNumber(payload.pitch, -2, 2);
	const vx = finiteNumber(payload.vx, -40, 40);
	const vy = finiteNumber(payload.vy, -40, 40);
	const vz = finiteNumber(payload.vz, -40, 40);
	const crouch = finiteNumber(payload.crouch, 0, 1);
	const voiceLevel = finiteNumber(payload.voiceLevel, 0, 1);
	const voicePeakMs = finiteNumber(payload.voicePeakMs, 0, 2000);
	const moveAck = finiteNumber(payload.moveAck, 0, 1e9);
	const jumps = finiteNumber(payload.jumps, 0, 1e9);
	const held = finiteNumber(payload.held, -1, 64);
	const grounded = bool(payload.grounded);
	const sprint = bool(payload.sprint);
	const moveInput = bool(payload.moveInput);
	const grimoire = bool(payload.grimoire);
	const camera = bool(payload.camera);
	if (
		seq === null ||
		x === null ||
		y === null ||
		z === null ||
		yaw === null ||
		pitch === null ||
		vx === null ||
		vy === null ||
		vz === null ||
		crouch === null ||
		voiceLevel === null ||
		voicePeakMs === null ||
		moveAck === null ||
		jumps === null ||
		grounded === null ||
		sprint === null ||
		moveInput === null ||
		grimoire === null
	) {
		return null;
	}
	return {
		seq,
		x,
		y,
		z,
		yaw,
		pitch,
		vx,
		vy,
		vz,
		grounded,
		crouch,
		sprint,
		moveInput,
		grimoire,
		camera: camera ?? false,
		voiceLevel,
		voicePeakMs,
		held: held === null ? -1 : Math.round(held),
		moveAck,
		jumps: Math.round(jumps),
	};
}

export function parseInteract(payload: unknown): InteractRequest | null {
	if (!isRecord(payload)) {
		return null;
	}
	const kind = payload.kind;
	const id = finiteNumber(payload.id, -1, 100000);
	if (
		(kind !== "door" &&
			kind !== "hide" &&
			kind !== "unhide" &&
			kind !== "valve" &&
			kind !== "pickup" &&
			kind !== "walkie" &&
			kind !== "camera" &&
			kind !== "stake") ||
		id === null
	) {
		return null;
	}
	return { kind, id: Math.round(id) };
}

export function parseCast(payload: unknown): CastRequest | null {
	if (!isRecord(payload)) {
		return null;
	}
	const method = payload.method;
	const transcripts = Array.isArray(payload.transcripts)
		? payload.transcripts
				.filter((entry): entry is string => typeof entry === "string")
				.slice(0, 6)
				.map((entry) => entry.slice(0, 160))
		: null;
	if (transcripts === null || transcripts.length === 0 || method !== "speech") {
		return null;
	}
	return { transcripts, method };
}

export function parseVoiceRelay(
	payload: unknown,
): { peerIds: string[]; data: Buffer } | null {
	if (
		!isRecord(payload) ||
		!Array.isArray(payload.peerIds) ||
		payload.peerIds.length > VOICE_RELAY_MAX_PEERS ||
		!payload.peerIds.every((id) => typeof id === "string") ||
		!Buffer.isBuffer(payload.data) ||
		payload.data.length === 0 ||
		payload.data.length > VOICE_RELAY_MAX_BYTES
	) {
		return null;
	}
	return { peerIds: payload.peerIds as string[], data: payload.data };
}

export function parseVoiceSignal(payload: unknown): VoiceSignalEnvelope | null {
	if (
		!isRecord(payload) ||
		typeof payload.peerId !== "string" ||
		!isRecord(payload.signal)
	) {
		return null;
	}
	const signal = payload.signal;
	let parsed: VoiceSignal | null = null;
	if (
		(signal.kind === "offer" || signal.kind === "answer") &&
		typeof signal.sdp === "string" &&
		signal.sdp.length < 20000
	) {
		parsed = { kind: signal.kind, sdp: signal.sdp };
	} else if (
		signal.kind === "candidate" &&
		typeof signal.candidate === "string" &&
		signal.candidate.length < 2000
	) {
		parsed = {
			kind: "candidate",
			candidate: signal.candidate,
			sdpMid:
				typeof signal.sdpMid === "string" ? signal.sdpMid.slice(0, 64) : null,
			sdpMLineIndex:
				typeof signal.sdpMLineIndex === "number" &&
				Number.isInteger(signal.sdpMLineIndex)
					? signal.sdpMLineIndex
					: null,
		};
	}
	if (!parsed) {
		return null;
	}
	return { peerId: payload.peerId.slice(0, 64), signal: parsed };
}
