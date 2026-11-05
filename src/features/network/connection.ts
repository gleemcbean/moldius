import { readSession, writeSession } from "../../utils/storage";
import { clockSync } from "./clockSync";
import { sessionStore } from "./sessionStore";
import { getSocket } from "./socket";

const TOKEN_KEY = "mycelium.session";

let initialized = false;

export function initConnection(): void {
	if (initialized) {
		return;
	}
	initialized = true;
	const socket = getSocket();
	const hello = () => {
		socket.emit(
			"session:hello",
			{ sessionToken: readSession(TOKEN_KEY) },
			(response) => {
				if (!response.ok) {
					return;
				}
				writeSession(TOKEN_KEY, response.value.sessionToken);
				sessionStore.set({
					status: "connected",
					playerId: response.value.playerId,
					iceServers: response.value.iceServers,
					dev: response.value.dev,
				});
			},
		);
	};
	socket.on("connect", hello);
	socket.on("disconnect", () => sessionStore.set({ status: "disconnected" }));
	if (socket.connected) {
		hello();
	}
	clockSync.start();
}

export function reconnectSocket(): void {
	const socket = getSocket();
	socket.disconnect();
	sessionStore.set({ status: "connecting" });
	socket.connect();
}
