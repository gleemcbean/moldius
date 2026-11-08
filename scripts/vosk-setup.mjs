// Prépare la reconnaissance vocale hors ligne (Vosk) dans public/vosk : le worker, tiré de
// vosk-browser, et les deux petits modèles officiels, téléchargés puis réemballés en .tar.gz
// (le format que lit vosk-browser). Ne refait rien de ce qui est déjà là.
// Lancé par « npm run build:client » ; « npm run vosk:setup » le lance seul.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, inflateRawSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "public/vosk");
const MODELS = [
	{ file: "model-fr-0.22.tar.gz", source: "vosk-model-small-fr-0.22" },
	{ file: "model-en-us-0.15.tar.gz", source: "vosk-model-small-en-us-0.15" },
];
const MODEL_BASE = "https://alphacephei.com/vosk/models";

mkdirSync(target, { recursive: true });

function writeWorker() {
	const output = resolve(target, "worker.js");
	if (existsSync(output)) {
		return;
	}
	const library = resolve(root, "node_modules/vosk-browser/dist/vosk.js");
	const match = /createBase64WorkerFactory\('([A-Za-z0-9+/=]+)'/.exec(readFileSync(library, "utf8"));
	if (!match) {
		throw new Error(`Worker Vosk introuvable dans ${library}`);
	}
	writeFileSync(output, Buffer.from(match[1], "base64"));
	console.log("Vosk : worker écrit");
}

/** Les fichiers d'une archive zip (méthodes « stocké » et « deflate »), sans dépendance. */
function readZip(buffer) {
	const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
	if (end < 0) {
		throw new Error("Archive zip illisible");
	}
	const count = buffer.readUInt16LE(end + 10);
	let offset = buffer.readUInt32LE(end + 16);
	const files = [];
	for (let index = 0; index < count; index += 1) {
		if (buffer.readUInt32LE(offset) !== 0x02014b50) {
			throw new Error("Répertoire zip illisible");
		}
		const method = buffer.readUInt16LE(offset + 10);
		const compressed = buffer.readUInt32LE(offset + 20);
		const nameLength = buffer.readUInt16LE(offset + 28);
		const extraLength = buffer.readUInt16LE(offset + 30);
		const commentLength = buffer.readUInt16LE(offset + 32);
		const local = buffer.readUInt32LE(offset + 42);
		const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
		offset += 46 + nameLength + extraLength + commentLength;
		if (name.endsWith("/")) {
			continue;
		}
		if (name.startsWith("/") || name.split("/").includes("..")) {
			throw new Error(`Chemin refusé dans l'archive : ${name}`);
		}
		const dataStart = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
		const raw = buffer.subarray(dataStart, dataStart + compressed);
		const data = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null;
		if (!data) {
			throw new Error(`Compression zip non gérée (${method}) : ${name}`);
		}
		files.push({ name, data });
	}
	return files;
}

/** Une archive tar (format ustar) des fichiers donnés. */
function tar(files) {
	const blocks = [];
	for (const { name, data } of files) {
		if (Buffer.byteLength(name) > 99) {
			throw new Error(`Nom trop long pour tar : ${name}`);
		}
		const header = Buffer.alloc(512);
		header.write(name, 0, "utf8");
		header.write("0000644\0", 100);
		header.write("0000000\0", 108);
		header.write("0000000\0", 116);
		header.write(`${data.length.toString(8).padStart(11, "0")}\0`, 124);
		header.write(`${Math.floor(Date.now() / 1000).toString(8).padStart(11, "0")}\0`, 136);
		header.write("        ", 148);
		header.write("0", 156);
		header.write("ustar\0", 257);
		header.write("00", 263);
		let sum = 0;
		for (const byte of header) {
			sum += byte;
		}
		header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
		blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
	}
	blocks.push(Buffer.alloc(1024));
	return Buffer.concat(blocks);
}

async function writeModel({ file, source }) {
	const output = resolve(target, file);
	if (existsSync(output)) {
		return;
	}
	console.log(`Vosk : téléchargement de ${source}…`);
	const response = await fetch(`${MODEL_BASE}/${source}.zip`);
	if (!response.ok) {
		throw new Error(`Téléchargement de ${source} impossible (${response.status})`);
	}
	const files = readZip(Buffer.from(await response.arrayBuffer()));
	if (!files.every((entry) => entry.name.startsWith(`${source}/`))) {
		throw new Error(`Contenu inattendu dans ${source}.zip`);
	}
	const partial = `${output}.partial`;
	writeFileSync(partial, gzipSync(tar(files)));
	renameSync(partial, output);
	console.log(`Vosk : ${file} prêt`);
}

try {
	writeWorker();
	for (const model of MODELS) {
		await writeModel(model);
	}
} catch (error) {
	// Sans Vosk, le jeu reste jouable avec la reconnaissance du navigateur (Chrome) :
	// on prévient sans bloquer la construction.
	console.warn(`Vosk non préparé : ${error instanceof Error ? error.message : error}`);
}
