import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
	SPEECH_SAMPLE_RATE,
	type SpeechReply,
} from "../shared/protocol/speech.js";
import {
	findVoskDirectory,
	type SpeechClient,
	SpeechService,
} from "../server/speech/SpeechService.js";

// Les modèles ne sont pas dans le dépôt (npm run vosk:setup) : sans eux, rien à tester.
const directory = findVoskDirectory([
	resolve(import.meta.dirname, "../public/vosk"),
]);
const service = new SpeechService(directory, 2);

afterAll(() => service.dispose());

function client(id: string): SpeechClient & { replies: SpeechReply[] } {
	const replies: SpeechReply[] = [];
	return { id, replies, reply: (reply) => replies.push(reply) };
}

async function until(check: () => boolean, ms = 10_000): Promise<void> {
	const end = Date.now() + ms;
	while (!check()) {
		if (Date.now() > end) {
			throw new Error("délai dépassé");
		}
		await new Promise((done) => setTimeout(done, 20));
	}
}

describe("reconnaissance vocale serveur", () => {
	it("refuse proprement sans modèles", async () => {
		const empty = new SpeechService(null);
		const listener = client("a");
		expect(await empty.prepare("fr")).toBe("unavailable");
		expect(
			empty.start(listener, { id: "x", language: "fr", grammar: [] }),
		).toBe("unavailable");
		empty.end(listener, "x");
		expect(listener.replies).toEqual([
			{ id: "x", event: "error", error: "unknown" },
		]);
		empty.dispose();
	});

	it.skipIf(!directory)(
		"répond une fois par bloc, puis une fois à la fin",
		async () => {
			expect(await service.prepare("en")).toBe("ready");
			const listener = client("b");
			expect(
				service.start(listener, {
					id: "s1",
					language: "en",
					grammar: ["one zero", "[unk]"],
				}),
			).toBeNull();
			const block = Buffer.alloc((SPEECH_SAMPLE_RATE / 10) * 2);
			for (let index = 0; index < 5; index += 1) {
				service.audio(listener, "s1", block);
			}
			// Bloc invalide (taille impaire) : réponse vide, mais réponse quand même.
			service.audio(listener, "s1", Buffer.alloc(3));
			service.end(listener, "s1");
			await until(() => listener.replies.length >= 7);
			await new Promise((done) => setTimeout(done, 200));
			expect(listener.replies).toHaveLength(7);
			expect(listener.replies.every((reply) => reply.id === "s1")).toBe(true);
			expect(listener.replies.at(-1)?.event).toBe("result");
			// L'écoute est close : un nouvel « end » ne l'attend plus.
			service.end(listener, "s1");
			await until(() => listener.replies.length === 8);
			expect(listener.replies.at(-1)).toMatchObject({ event: "error" });
		},
		90_000,
	);

	it.skipIf(!directory)(
		"limite le nombre d'écoutes simultanées",
		async () => {
			expect(await service.prepare("en")).toBe("ready");
			const request = { language: "en" as const, grammar: [] };
			expect(service.start(client("c1"), { ...request, id: "a" })).toBeNull();
			expect(service.start(client("c2"), { ...request, id: "b" })).toBeNull();
			expect(service.start(client("c3"), { ...request, id: "c" })).toBe("busy");
		},
		90_000,
	);
});
