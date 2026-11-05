import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceEntries } from "../server/source/sourceFiles.js";
import { createZip } from "../server/source/zipArchive.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(
	root,
	process.env.SOURCE_ARCHIVE ?? "release/mycelium-source.zip",
);
const entries = sourceEntries(root);
const archive = createZip(entries);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, archive);
const kilobytes = (archive.length / 1024).toFixed(1);
console.log(
	`Archive des sources : ${relative(root, target)} (${entries.length} fichiers, ${kilobytes} Kio)`,
);
