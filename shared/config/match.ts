export const MATCH_DURATION_MS = 480_000;
export const MIN_MATCH_MINUTES = 3;
export const MAX_MATCH_MINUTES = 15;
export const ANOMALY_FIRST_SPAWN_DELAY_MS = 30_000;
export const ANOMALY_RETURN_DELAY_MS = 60_000;
/** Anomalies en attente au-delà de celles en jeu : elles prennent le relais après une capture. */
export const ANOMALY_ROSTER_RESERVE = 4;
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

export const PUBLIC_LOBBY_CAPACITY = 4;
export const PRIVATE_LOBBY_CAPACITY = 8;
export const PRIVATE_CODE_LENGTH = 5;
export const PLAYER_NAME_MAX_LENGTH = 18;

export const MIN_SIMULTANEOUS_ANOMALIES = 1;
export const MAX_SIMULTANEOUS_ANOMALIES = 10;
export const PUBLIC_SIMULTANEOUS_ANOMALIES = 3;

export function anomalyRosterSize(simultaneous: number): number {
	return simultaneous + ANOMALY_ROSTER_RESERVE;
}

/** Laisse de la place à chaque palier : trois à la fois, c'est au plus un monstre du palier 1. */
export function anomalyTierCaps(
	simultaneous: number,
): Record<1 | 2 | 3, number> {
	return {
		1: Math.ceil(simultaneous / 3),
		2: Math.ceil((simultaneous * 2) / 3),
		3: Math.ceil((simultaneous * 2) / 3),
	};
}
export const FORMULA_WORD_COUNT = 3;
