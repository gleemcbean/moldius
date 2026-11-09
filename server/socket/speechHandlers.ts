import type { Socket } from "socket.io";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "../../shared/protocol/events.js";
import {
	parseSpeechAudio,
	parseSpeechId,
	parseSpeechLanguage,
	parseSpeechStart,
} from "../net/validation.js";
import type { Session } from "../sessions/SessionRegistry.js";
import type { SpeechClient, SpeechService } from "../speech/SpeechService.js";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** La reconnaissance des incantations par le serveur (voir SpeechService). */
export function registerSpeechHandlers(
	socket: GameSocket,
	speech: SpeechService,
	session: () => Session | null,
	allow: (event: string) => boolean,
): void {
	const client: SpeechClient = {
		id: socket.id,
		reply: (reply) => socket.emit("speech:reply", reply),
	};

	socket.on("speech:prepare", async (payload, ack) => {
		const language = parseSpeechLanguage(payload);
		if (typeof ack !== "function") {
			return;
		}
		if (!language || !session() || !allow("speech:prepare")) {
			ack("unavailable");
			return;
		}
		ack(await speech.prepare(language));
	});

	socket.on("speech:start", (payload) => {
		const request = parseSpeechStart(payload);
		if (!request) {
			return;
		}
		const refused = !session()
			? "no-session"
			: !allow("speech:start")
				? "rate-limited"
				: speech.start(client, request);
		if (refused) {
			client.reply({ id: request.id, event: "error", error: refused });
		}
	});

	socket.on("speech:audio", (payload) => {
		const audio = parseSpeechAudio(payload);
		if (audio) {
			// Un bloc refusé reçoit quand même sa réponse (vide) : le client les compte.
			speech.audio(
				client,
				audio.id,
				allow("speech:audio") ? audio.data : Buffer.alloc(0),
			);
		}
	});

	socket.on("speech:end", (payload) => {
		const id = parseSpeechId(payload);
		if (id) {
			speech.end(client, id);
		}
	});

	socket.on("speech:cancel", (payload) => {
		const id = parseSpeechId(payload);
		if (id) {
			speech.cancel(client, id);
		}
	});

	socket.on("disconnect", () => speech.cancel(client));
}
