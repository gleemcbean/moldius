import { Worker } from "node:worker_threads";

/**
 * Le moteur de vosk-browser (public/vosk/worker.js, le même que dans le navigateur) dans un
 * thread de Node. Ce code est fait pour un Web Worker : on lui donne ce qu'il attend d'un
 * navigateur (self, postMessage, fetch du modèle sur le disque) et on retire IndexedDB, que
 * Node n'a pas — le modèle est décompressé en mémoire à chaque chargement.
 */
const THREAD_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const vm = require("node:vm");
const listeners = [];
// La décompression du modèle écrit une ligne par fichier : rien à garder.
console.log = () => undefined;
console.info = () => undefined;
globalThis.self = globalThis;
globalThis.location = { href: "http://vosk.local/worker.js" };
globalThis.postMessage = (message) => parentPort.postMessage(message);
globalThis.addEventListener = (type, listener) => {
	if (type === "message") listeners.push(listener);
};
globalThis.close = () => process.exit(0);
globalThis.fetch = async (url) => {
	const file = path.join(workerData.dir, path.basename(new URL(url).pathname));
	const size = fs.statSync(file).size;
	return new Response(Readable.toWeb(fs.createReadStream(file)), {
		headers: { "Content-Length": String(size) },
	});
};
let source = fs.readFileSync(path.join(workerData.dir, "worker.js"), "utf8");
for (const [from, to] of [
	["this.Vosk.FS.mount(this.Vosk.IDBFS, {}, storagePath);", ""],
	["return this.Vosk.syncFilesystem(true);", "return undefined;"],
	["return this.Vosk.syncFilesystem(false);", "return undefined;"],
]) {
	if (!source.includes(from)) throw new Error("worker Vosk inattendu : " + from);
	source = source.replace(from, to);
}
vm.runInThisContext(source, { filename: "vosk-worker.js" });
parentPort.on("message", (data) => {
	for (const listener of listeners) listener({ data });
});
`;

export type EngineReply =
	| { event: "partialresult"; text: string }
	| { event: "result"; text: string }
	| { event: "error"; error: string };

type WorkerReply =
	| undefined
	| { event: "load"; result: boolean }
	| { event: "error"; recognizerId?: string; error: string }
	| { event: "result"; recognizerId: string; result: { text?: string } }
	| {
			event: "partialresult";
			recognizerId: string;
			result: { partial?: string };
	  };

export class VoskEngine {
	readonly loaded: Promise<boolean>;
	ready = false;
	failed = false;
	/** Dernière activité : un modèle inutilisé est déchargé (voir SpeechService). */
	usedAt = Date.now();
	private readonly worker: Worker;
	private readonly listeners = new Map<string, (reply: EngineReply) => void>();
	private readonly sampleRate: number;
	private disposed = false;

	constructor(directory: string, modelFile: string, sampleRate: number) {
		this.sampleRate = sampleRate;
		this.worker = new Worker(THREAD_SOURCE, {
			eval: true,
			workerData: { dir: directory },
		});
		this.worker.unref();
		this.loaded = new Promise<boolean>((resolve) => {
			const fail = (reason: string) => {
				if (!this.failed && !this.disposed) {
					console.warn(
						`MOLDIUS : reconnaissance vocale serveur en panne (${reason})`,
					);
				}
				this.failed = true;
				this.ready = false;
				for (const listener of this.listeners.values()) {
					listener({ event: "error", error: reason });
				}
				this.listeners.clear();
				resolve(false);
			};
			this.worker.on("message", (reply: WorkerReply) => {
				if (!reply) {
					return;
				}
				if (reply.event === "load") {
					this.ready = reply.result;
					if (reply.result) {
						resolve(true);
					} else {
						fail("modèle non chargé");
					}
					return;
				}
				if (!reply.recognizerId) {
					if (reply.event === "error" && !this.ready) {
						fail(reply.error);
					}
					return;
				}
				const listener = this.listeners.get(reply.recognizerId);
				if (!listener) {
					return;
				}
				if (reply.event === "error") {
					listener({ event: "error", error: reply.error });
				} else if (reply.event === "partialresult") {
					listener({
						event: "partialresult",
						text: reply.result.partial ?? "",
					});
				} else {
					listener({ event: "result", text: reply.result.text ?? "" });
				}
			});
			this.worker.on("error", (error) => fail(error.message));
			this.worker.on("exit", (code) => fail(`thread arrêté (${code})`));
		});
		this.worker.postMessage({ action: "set", key: "logLevel", value: -2 });
		this.worker.postMessage({
			action: "load",
			modelUrl: `http://vosk.local/${modelFile}`,
		});
	}

	open(
		recognizerId: string,
		grammar: readonly string[],
		listener: (reply: EngineReply) => void,
	): void {
		this.usedAt = Date.now();
		this.listeners.set(recognizerId, listener);
		this.worker.postMessage({
			action: "create",
			recognizerId,
			sampleRate: this.sampleRate,
			...(grammar.length > 0 ? { grammar: JSON.stringify(grammar) } : {}),
		});
	}

	/** samples : PCM 16 bits, que vosk-browser attend en flottants à l'échelle d'un Int16. */
	feed(recognizerId: string, samples: Int16Array): void {
		this.usedAt = Date.now();
		const data = Float32Array.from(samples);
		this.worker.postMessage(
			{
				action: "audioChunk",
				recognizerId,
				data,
				sampleRate: this.sampleRate,
			},
			[data.buffer],
		);
	}

	finish(recognizerId: string): void {
		this.worker.postMessage({ action: "retrieveFinalResult", recognizerId });
	}

	close(recognizerId: string): void {
		if (this.listeners.delete(recognizerId)) {
			this.worker.postMessage({ action: "remove", recognizerId });
		}
	}

	get streams(): number {
		return this.listeners.size;
	}

	dispose(): void {
		this.disposed = true;
		this.listeners.clear();
		void this.worker.terminate();
	}
}
