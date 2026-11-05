import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
	appendFile,
	chmod,
	lstat,
	mkdir,
	readFile,
	symlink,
	writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const DATABASE_NAME = "mycelium";
const DEFAULT_PORT = 54329;

async function restoreSymlinks(nativeDir) {
	const manifest = join(nativeDir, "pg-symlinks.json");
	if (!existsSync(manifest)) {
		return;
	}
	const packageDir = dirname(nativeDir);
	const links = JSON.parse(await readFile(manifest, "utf8"));
	for (const { source, target } of links) {
		const targetPath = resolve(packageDir, target);
		const exists = await lstat(targetPath).then(
			() => true,
			() => false,
		);
		if (!exists) {
			await symlink(
				relative(dirname(targetPath), resolve(packageDir, source)),
				targetPath,
			);
		}
	}
}

async function readCredentials(file, port) {
	if (existsSync(file)) {
		const saved = JSON.parse(await readFile(file, "utf8"));
		return { ...saved, port: port ?? saved.port };
	}
	const credentials = {
		user: "mycelium",
		password: randomBytes(18).toString("base64url"),
		port: port ?? DEFAULT_PORT,
	};
	await writeFile(file, JSON.stringify(credentials, null, 2), { mode: 0o600 });
	return credentials;
}

async function canConnect(pg, credentials, database) {
	const client = new pg.Client({
		host: "127.0.0.1",
		port: credentials.port,
		user: credentials.user,
		password: credentials.password,
		database,
		connectionTimeoutMillis: 1500,
	});
	try {
		await client.connect();
		await client.end();
		return true;
	} catch {
		await client.end().catch(() => undefined);
		return false;
	}
}

async function ensureDatabase(pg, credentials) {
	const client = new pg.Client({
		host: "127.0.0.1",
		port: credentials.port,
		user: credentials.user,
		password: credentials.password,
		database: "postgres",
	});
	await client.connect();
	try {
		const { rows } = await client.query(
			"SELECT 1 FROM pg_database WHERE datname = $1",
			[DATABASE_NAME],
		);
		if (rows.length === 0) {
			await client.query(`CREATE DATABASE ${DATABASE_NAME}`);
		}
	} finally {
		await client.end();
	}
}

export async function startDevDatabase(root, options = {}) {
	const [{ default: EmbeddedPostgres }, binaries, { default: pg }] =
		await Promise.all([
			import("embedded-postgres"),
			import(`@embedded-postgres/${process.platform}-${process.arch}`),
			import("pg"),
		]);
	await restoreSymlinks(resolve(dirname(binaries.postgres), ".."));
	const home = join(root, ".dev-postgres");
	const dataDir = join(home, "data");
	const logFile = join(home, "postgres.log");
	await mkdir(home, { recursive: true, mode: 0o700 });
	await chmod(home, 0o700);
	const credentials = await readCredentials(
		join(home, "credentials.json"),
		options.port,
	);
	const log = (message) =>
		appendFile(logFile, String(message)).catch(() => undefined);
	const server = new EmbeddedPostgres({
		databaseDir: dataDir,
		port: credentials.port,
		user: credentials.user,
		password: credentials.password,
		authMethod: "scram-sha-256",
		persistent: true,
		initdbFlags: ["--encoding=UTF8"],
		postgresFlags: [
			"-c",
			"listen_addresses=127.0.0.1",
			"-c",
			"unix_socket_directories=",
		],
		onLog: log,
		onError: log,
	});
	let created = false;
	if (!existsSync(join(dataDir, "PG_VERSION"))) {
		await server.initialise();
		created = true;
	}
	let owned = true;
	try {
		await server.start();
	} catch {
		if (!(await canConnect(pg, credentials, "postgres"))) {
			throw new Error(
				`PostgreSQL de développement impossible à démarrer sur le port ${credentials.port} (voir ${relative(root, logFile)}). Libérez ce port ou choisissez-en un autre avec DEV_DATABASE_PORT.`,
			);
		}
		owned = false;
	}
	await ensureDatabase(pg, credentials);
	const password = encodeURIComponent(credentials.password);
	return {
		url: `postgres://${credentials.user}:${password}@127.0.0.1:${credentials.port}/${DATABASE_NAME}`,
		port: credentials.port,
		created,
		reused: !owned,
		async stop() {
			if (owned) {
				await server.stop();
				return;
			}
			await run(binaries.pg_ctl, ["stop", "-D", dataDir, "-m", "fast"]).catch(
				() => undefined,
			);
		},
	};
}

function readDotEnv(root) {
	const file = join(root, ".env");
	const values = {};
	if (!existsSync(file)) {
		return values;
	}
	for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
		const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
		if (match && !line.trimStart().startsWith("#")) {
			values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
		}
	}
	return values;
}

export function devEnvironment(root) {
	return { ...readDotEnv(root), ...process.env };
}

export const PROJECT_ROOT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
);

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const environment = devEnvironment(PROJECT_ROOT);
	const port = environment.DEV_DATABASE_PORT
		? Number(environment.DEV_DATABASE_PORT)
		: undefined;
	const database = await startDevDatabase(PROJECT_ROOT, { port });
	console.log(
		`PostgreSQL de développement prêt sur 127.0.0.1:${database.port}`,
	);
	console.log(`DATABASE_URL=${database.url}`);
	const stop = () => {
		void database.stop().finally(() => process.exit(0));
	};
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
}
