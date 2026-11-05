import type { LobbyState } from "@shared/protocol/lobby";
import { createStore } from "../../utils/store";

export interface LobbyStoreState {
	lobby: LobbyState | null;
	pending: boolean;
	error: string | null;
}

export const lobbyStore = createStore<LobbyStoreState>({
	lobby: null,
	pending: false,
	error: null,
});
