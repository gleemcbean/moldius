import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "@shared/protocol/events";
import { io, type Socket } from "socket.io-client";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
	if (!socket) {
		socket = io({
			transports: ["websocket", "polling"],
			reconnection: true,
			reconnectionDelay: 600,
			reconnectionDelayMax: 4000,
			autoConnect: true,
		});
	}
	return socket;
}
