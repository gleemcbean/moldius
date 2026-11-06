import type { AdminLiveStats } from "../shared/protocol/admin.js";
import type { LobbyManager } from "./lobby/LobbyManager.js";
import type { SessionRegistry } from "./sessions/SessionRegistry.js";

export function computeLiveStats(
	sessions: SessionRegistry,
	lobbies: LobbyManager,
): AdminLiveStats {
	const connected = sessions.connected();
	const accounts = new Set<string>();
	let inLobby = 0;
	let inMatch = 0;
	for (const session of connected) {
		if (session.account) {
			accounts.add(session.account.accountId);
		}
		if (lobbies.matchOf(session)) {
			inMatch += 1;
		} else if (lobbies.lobbyOf(session)) {
			inLobby += 1;
		}
	}
	return {
		connected: connected.length,
		signedIn: accounts.size,
		inLobby,
		inMatch,
		...lobbies.stats(),
		onlineAccountIds: [...accounts],
	};
}
