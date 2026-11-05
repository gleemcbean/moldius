import { spawn, spawnSync } from "node:child_process";
import {
	devEnvironment,
	PROJECT_ROOT,
	startDevDatabase,
} from "./devDatabase.mjs";

const lan = process.argv.includes("--lan");
const shell = process.platform === "win32";
const environment = devEnvironment(PROJECT_ROOT);
const dev = environment.DEV === "true";

let database = null;
if (
	dev &&
	!environment.DATABASE_URL?.trim() &&
	environment.DEV_DATABASE !== "false"
) {
	try {
		database = await startDevDatabase(PROJECT_ROOT, {
			port: environment.DEV_DATABASE_PORT
				? Number(environment.DEV_DATABASE_PORT)
				: undefined,
		});
		const state = database.reused
			? "déjà lancé, réutilisé"
			: database.created
				? "créé"
				: "démarré";
		console.log(
			`MOLDIUS : PostgreSQL de développement ${state} sur 127.0.0.1:${database.port} (données dans .dev-postgres/)`,
		);
	} catch (error) {
		console.error(
			`MOLDIUS : PostgreSQL de développement indisponible (${error instanceof Error ? error.message : error}). Les comptes seront désactivés.`,
		);
	}
}

const databaseEnvironment = database
	? { DATABASE_URL: database.url, DATABASE_SSL: "false" }
	: {};

function run(script, lanEnvironment) {
	return spawn("npm", ["run", script], {
		stdio: "inherit",
		shell,
		detached: !shell,
		env: {
			...process.env,
			...(script === "dev:server" ? databaseEnvironment : {}),
			...(lan ? lanEnvironment : {}),
		},
	});
}

const processes = [
	run("dev:server", { HOST: "127.0.0.1", TRUST_PROXY: "true" }),
	run("dev:client", { MYCELIUM_LAN: "true" }),
];

let stopping = false;

function terminate(child) {
	if (
		child.exitCode !== null ||
		child.signalCode !== null ||
		child.pid === undefined
	) {
		return;
	}
	if (shell) {
		spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
		return;
	}
	try {
		process.kill(-child.pid, "SIGTERM");
	} catch {
		child.kill("SIGTERM");
	}
}

function exited(child) {
	return new Promise((resolve) => {
		if (child.exitCode !== null || child.signalCode !== null) {
			resolve();
			return;
		}
		child.once("exit", resolve);
		setTimeout(resolve, 5000).unref();
	});
}

async function stop(code = 0) {
	if (stopping) {
		return;
	}
	stopping = true;
	processes.forEach(terminate);
	await Promise.all(processes.map(exited));
	await database?.stop().catch(() => undefined);
	process.exit(code);
}

for (const child of processes) {
	child.on("exit", (code) => {
		if (code !== 0 && code !== null) {
			void stop(code);
		}
	});
}

process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
