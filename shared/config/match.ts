export const MATCH_DURATION_MS = 480_000;
export const MIN_MATCH_MINUTES = 3;
export const MAX_MATCH_MINUTES = 15;
export const ANOMALY_FIRST_SPAWN_DELAY_MS = 30_000;
export const ANOMALY_RETURN_DELAY_MS = 60_000;
export const ANOMALY_MAX_ACTIVE = 3;
export const ANOMALY_MAX_ACTIVE_PER_TIER: Record<1 | 2 | 3, number> = {
	1: 1,
	2: 2,
	3: 2,
};
export const ANOMALY_NEXT_DELAY_MS = 4_000;
export const ANOMALY_SPAWN_RETRY_MS = 1_000;
export const ANOMALY_PURSUERS_PER_PLAYER = 2;
export const ANOMALY_ROOM_CAPACITY = 2;
export const ANOMALY_DISINTEREST_MS = 9_000;
export const PLAYER_RESPAWN_DELAY_MS = 20_000;
export const PLAYER_SPAWN_PROTECTION_MS = 2_000;
export const PLAYER_RESPAWN_PROTECTION_MS = 5_000;
export const MATCH_LOADING_TIMEOUT_MS = 60_000;
export const PUBLIC_START_COUNTDOWN_MS = 5_000;
export const RECONNECT_GRACE_MS = 60_000;

export const LOBBY_CAPACITY = 4;
export const PRIVATE_CODE_LENGTH = 5;
export const PLAYER_NAME_MAX_LENGTH = 18;

export const MIN_ANOMALY_COUNT = 1;
export const MAX_ANOMALY_COUNT = 20;
export const PUBLIC_ANOMALY_COUNT = 7;
export const FORMULA_WORD_COUNT = 3;
