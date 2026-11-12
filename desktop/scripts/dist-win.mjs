import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] === "dir" ? "dir" : "nsis";
const SOURCES = [
	"package.json",
	"main.cjs",
	"discord.cjs",
	"preload.cjs",
	"app-config.json",
	"pages",
	"build",
	"discord-bridge/dist",
];

function run(command, args, options = {}) {
	const result = spawnSync(command, args, { stdio: "inherit", ...options });
	if (result.error) {
		console.error(`${command} : ${result.error.message}`);
		process.exit(1);
	}
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function output(command, args) {
	const result = spawnSync(command, args, { encoding: "utf8" });
	return result.status === 0 ? result.stdout.replace(/\r/g, "").trim() : null;
}

function isWsl() {
	try {
		return /microsoft/i.test(readFileSync("/proc/version", "utf8"));
	} catch {
		return false;
	}
}

run(process.execPath, [join(root, "scripts", "prepare.mjs")]);

if (process.platform === "win32") {
	run("npx", ["electron-builder", "--win", target], { cwd: root, shell: true });
	process.exit(0);
}

if (!isWsl()) {
	console.error(
		"L'installateur Windows se construit sous Windows (ou depuis WSL). Ailleurs, electron-builder demande Wine.",
	);
	process.exit(1);
}

const localAppData = output("powershell.exe", [
	"-NoProfile",
	"-Command",
	"[Environment]::GetFolderPath('LocalApplicationData')",
]);
if (!localAppData) {
	console.error(
		"PowerShell est injoignable depuis WSL : lancez npm run dist:win depuis Windows.",
	);
	process.exit(1);
}
if (!output("powershell.exe", ["-NoProfile", "-Command", "node --version"])) {
	console.error(
		"Node.js n'est pas installé côté Windows : installez-le (nodejs.org) puis relancez.",
	);
	process.exit(1);
}

const windowsDir = `${localAppData}\\moldius-desktop-build`;
const linuxDir = output("wslpath", ["-u", windowsDir]);
if (!linuxDir) {
	console.error(`Dossier de construction Windows introuvable : ${windowsDir}`);
	process.exit(1);
}

mkdirSync(linuxDir, { recursive: true });
for (const entry of [...SOURCES, "release"]) {
	const destination = resolve(linuxDir, entry);
	if (relative(linuxDir, destination).startsWith("..")) {
		throw new Error(`Chemin hors du dossier de construction : ${entry}`);
	}
	rmSync(destination, { recursive: true, force: true });
}
for (const entry of SOURCES) {
	const source = join(root, entry);
	if (existsSync(source)) {
		cpSync(source, join(linuxDir, entry), { recursive: true });
	}
}

console.log(`Construction sous Windows dans ${windowsDir}`);
const quoted = windowsDir.replace(/'/g, "''");
run("powershell.exe", [
	"-NoProfile",
	"-ExecutionPolicy",
	"Bypass",
	"-Command",
	[
		`Set-Location -LiteralPath '${quoted}'`,
		"npm install --no-audit --no-fund",
		"if ($LASTEXITCODE) { exit $LASTEXITCODE }",
		`npx electron-builder --win ${target}`,
		"exit $LASTEXITCODE",
	].join("; "),
]);

const built = join(linuxDir, "release");
mkdirSync(join(root, "release"), { recursive: true });
cpSync(built, join(root, "release"), { recursive: true });
console.log(`Installateur copié dans ${join(root, "release")}`);
