import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
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

const SIGNING_CONFIG = "electron-builder.signed.json";
const SIGNING_VARIABLES = {
	endpoint: "AZURE_SIGN_ENDPOINT",
	codeSigningAccountName: "AZURE_SIGN_ACCOUNT",
	certificateProfileName: "AZURE_SIGN_PROFILE",
	publisherName: "AZURE_SIGN_PUBLISHER",
};
const CREDENTIAL_VARIABLES = [
	"AZURE_TENANT_ID",
	"AZURE_CLIENT_ID",
	"AZURE_CLIENT_SECRET",
];

function azureSignOptions() {
	const names = [...Object.values(SIGNING_VARIABLES), ...CREDENTIAL_VARIABLES];
	const missing = names.filter((name) => !process.env[name]?.trim());
	if (missing.length === names.length) {
		console.warn(
			"Signature Azure non configurée : l'installateur ne sera pas signé.",
		);
		return null;
	}
	if (missing.length > 0) {
		console.error(
			`Signature Azure incomplète, variables manquantes : ${missing.join(", ")}`,
		);
		process.exit(1);
	}
	return Object.fromEntries(
		Object.entries(SIGNING_VARIABLES).map(([key, name]) => [
			key,
			process.env[name].trim(),
		]),
	);
}

function writeSigningConfig(directory, options) {
	if (!options) {
		return [];
	}
	const config = JSON.parse(
		readFileSync(join(root, "package.json"), "utf8"),
	).build;
	config.forceCodeSigning = true;
	config.win = { ...config.win, azureSignOptions: options };
	writeFileSync(join(directory, SIGNING_CONFIG), JSON.stringify(config));
	return ["--config", SIGNING_CONFIG];
}

const signing = azureSignOptions();

run(process.execPath, [join(root, "scripts", "prepare.mjs")]);

if (process.platform === "win32") {
	const configArgs = writeSigningConfig(root, signing);
	try {
		run("npx", ["electron-builder", "--win", target, ...configArgs], {
			cwd: root,
			shell: true,
		});
	} finally {
		rmSync(join(root, SIGNING_CONFIG), { force: true });
	}
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
rmSync(join(linuxDir, SIGNING_CONFIG), { force: true });
for (const entry of SOURCES) {
	const source = join(root, entry);
	if (existsSync(source)) {
		cpSync(source, join(linuxDir, entry), { recursive: true });
	}
}

const configArgs = writeSigningConfig(linuxDir, signing);
const wslenv = [process.env.WSLENV, ...(signing ? CREDENTIAL_VARIABLES : [])]
	.filter(Boolean)
	.join(":");

console.log(`Construction sous Windows dans ${windowsDir}`);
const quoted = windowsDir.replace(/'/g, "''");
run(
	"powershell.exe",
	[
		"-NoProfile",
		"-ExecutionPolicy",
		"Bypass",
		"-Command",
		[
			`Set-Location -LiteralPath '${quoted}'`,
			"npm install --no-audit --no-fund",
			"if ($LASTEXITCODE) { exit $LASTEXITCODE }",
			`npx electron-builder --win ${target} ${configArgs.join(" ")}`,
			"exit $LASTEXITCODE",
		].join("; "),
	],
	{ env: { ...process.env, WSLENV: wslenv } },
);

const built = join(linuxDir, "release");
mkdirSync(join(root, "release"), { recursive: true });
cpSync(built, join(root, "release"), { recursive: true });
console.log(`Installateur copié dans ${join(root, "release")}`);
