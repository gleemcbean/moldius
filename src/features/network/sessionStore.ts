import type { IceServerConfig } from "@shared/protocol/lobby";
import { createStore } from "../../utils/store";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface SessionState {
	status: ConnectionStatus;
	playerId: string | null;
	iceServers: IceServerConfig[];
	dev: boolean;
}

export const sessionStore = createStore<SessionState>({
	status: "connecting",
	playerId: null,
	iceServers: [],
	dev: false,
});
