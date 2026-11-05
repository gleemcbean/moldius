import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { ZipEntry } from "./zipArchive.js";

const EXCLUDED_DIRECTORIES = new Set([
	"node_modules",
	"dist",
	"dist-server",
	"release",
	".git",
	".vite",
	"coverage",
	"test-results",
	".dev-postgres",
	".dev-mail",
	"vosk",
]);
const EXCLUDED_FILES = new Set([".env", ".DS_Store"]);
const EXCLUDED_EXTENSIONS = [
	".log",
	".zip",
	".tsbuildinfo",
	":Zone.Identifier",
];

function isExcludedFile(name: string): boolean {
	if (
		EXCLUDED_FILES.has(name) ||
		EXCLUDED_EXTENSIONS.some((extension) => name.endsWith(extension))
	) {
		return true;
	}
	return name.startsWith(".env") && name !== ".env.example";
}

export function collectSourceFiles(root: string): string[] {
	const files: string[] = [];
	const walk = (directory: string) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) {
				if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
					walk(path);
				}
				continue;
			}
			if (isExcludedFile(entry.name)) {
				continue;
			}
			files.push(path);
		}
	};
	walk(root);
	return files.sort();
}

export function sourceEntries(root: string, prefix = "mycelium"): ZipEntry[] {
	return collectSourceFiles(root).map((file) => ({
		path: `${prefix}/${relative(root, file).split(sep).join("/")}`,
		data: readFileSync(file),
		modified: statSync(file).mtime,
	}));
}
