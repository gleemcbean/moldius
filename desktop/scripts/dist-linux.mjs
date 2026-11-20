import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] || "AppImage";

const TARGETS = ["AppImage", "deb", "rpm", "dir"];

if (!TARGETS.includes(target)) {
	console.error(
		`Format invalide : ${target}\nFormats disponibles : ${TARGETS.join(", ")}`,
	);

	process.exit(1);
}

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		stdio: "inherit",
		...options,
	});

	if (result.error) {
		console.error(`${command} : ${result.error.message}`);
		process.exit(1);
	}

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

if (process.platform !== "linux") {
	console.error("La construction Linux doit être exécutée sous Linux.");
	process.exit(1);
}

run(process.execPath, [join(root, "scripts", "prepare.mjs")]);

const required = ["package.json", "main.cjs", "preload.cjs", "pages", "build"];

for (const entry of required) {
	if (!existsSync(join(root, entry))) {
		console.error(`Fichier ou dossier manquant : ${entry}`);
		process.exit(1);
	}
}

const releaseDir = join(root, "release");

rmSync(releaseDir, {
	recursive: true,
	force: true,
});

mkdirSync(releaseDir, {
	recursive: true,
});

console.log(`Construction Linux : ${target}`);

run("npx", ["electron-builder", "--linux", target], {
	cwd: root,
	shell: false,
});

console.log(`Construction terminée : ${releaseDir}`);
