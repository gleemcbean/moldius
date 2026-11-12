export const WALKIE_SPOT_COUNT = 8;
export const WALKIE_RETURN_MS = 30_000;
export const WALKIE_RECEIVER_LOUDNESS = 3;
export const WALKIE_VOICE_LOUDNESS = 11;

export function walkieCount(players: number): number {
	return Math.min(WALKIE_SPOT_COUNT, Math.max(2, Math.ceil(players / 2)));
}

export const CAMERA_RETURN_MS = 30_000;
export const MAX_PHOTOS_PER_MATCH = 24;
export const PHOTO_SIZE = 1024;

export function cameraCount(players: number): number {
	return Math.min(WALKIE_SPOT_COUNT, Math.max(1, Math.ceil(players / 2)));
}

export const FALL_FRAGMENT_LOSS = 3;

export const STAKE_KINDS = ["sanctuary", "reliquary", "pact"] as const;

export type StakeKind = (typeof STAKE_KINDS)[number];

export const STAKE_FURNITURE: Record<StakeKind, string> = {
	sanctuary: "stakeSanctuary",
	reliquary: "stakeReliquary",
	pact: "stakePact",
};

export const STAKE_COLORS: Record<StakeKind, number> = {
	sanctuary: 0x8fe3a4,
	reliquary: 0xffc857,
	pact: 0xff4d5e,
};

export const STAKE_INTERACT_RANGE = 2.7;
export const STAKE_ROOMS_PER_ROOM = 9;
export const STAKE_MAX_ROOMS = 6;

export const SANCTUARY_DURATION_MS = 15_000;
export const SANCTUARY_COOLDOWN_MS = 90_000;
export const SANCTUARY_HEAL_PER_SECOND = 7;
export const SANCTUARY_CALL_INTERVAL_MS = 4_000;

export const RELIQUARY_FRAGMENTS = 4;
export const RELIQUARY_COOLDOWN_MS = 150_000;

export const PACT_HEALTH_COST = 50;
export const PACT_COOLDOWN_MS = 60_000;

export function stakeRoomCount(rooms: number): number {
	return Math.min(
		STAKE_MAX_ROOMS,
		Math.max(STAKE_KINDS.length, Math.round(rooms / STAKE_ROOMS_PER_ROOM)),
	);
}
