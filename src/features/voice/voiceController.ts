import { reportMicrophone } from "../lobby/lobbyClient";
import { lobbyStore } from "../lobby/lobbyStore";
import { sessionStore } from "../network/sessionStore";
import { settingsStore } from "../settings/settingsStore";
import { micIsUsable, micManager, micStore } from "./micManager";
import { voiceChat } from "./voiceChat";

let initialized = false;
let lastReported: boolean | null = null;

export function initVoiceController(): void {
	if (initialized) {
		return;
	}
	initialized = true;
	voiceChat.listen();
	micManager.onTrackChange((track) => voiceChat.setLocalTrack(track));
	micStore.subscribe((state) => reportStatus(micIsUsable(state.status)));
	lobbyStore.subscribe(() => syncPeers());
	sessionStore.subscribe(() => syncPeers());
	syncPeers();
}

function reportStatus(ready: boolean): void {
	if (!lobbyStore.get().lobby) {
		lastReported = null;
		return;
	}
	if (lastReported === ready) {
		return;
	}
	lastReported = ready;
	reportMicrophone(ready);
}

function syncPeers(): void {
	const session = sessionStore.get();
	const lobby = lobbyStore.get().lobby;
	if (!session.playerId) {
		return;
	}
	voiceChat.start(session.playerId, session.iceServers);
	const peers = lobby
		? lobby.players
				.filter((player) => player.connected)
				.map((player) => player.id)
		: [];
	voiceChat.sync(peers);
	if (lobby) {
		reportStatus(micIsUsable(micStore.get().status));
	}
}

export async function ensureMicrophone(): Promise<void> {
	const status = micStore.get().status;
	if (status === "ready" || status === "silent" || status === "requesting") {
		lastReported = null;
		reportStatus(micIsUsable(status));
		return;
	}
	await micManager.acquire(settingsStore.get().micDeviceId);
}

export function leaveVoice(): void {
	voiceChat.stopAll();
	voiceChat.setMode("lobby");
	lastReported = null;
}
