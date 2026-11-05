import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const library = resolve(root, "node_modules/vosk-browser/dist/vosk.js");
const target = resolve(root, "public/vosk/worker.js");
const match = /createBase64WorkerFactory\('([A-Za-z0-9+/=]+)'/.exec(
	readFileSync(library, "utf8"),
);
if (!match) {
	console.error(`Worker Vosk introuvable dans ${library}`);
	process.exit(1);
}
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, Buffer.from(match[1], "base64"));
console.log(`Worker Vosk écrit dans ${target}`);
