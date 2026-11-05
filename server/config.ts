import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IceServerConfig } from "../shared/protocol/lobby.js";
import type { SmtpOptions } from "./mail/mailer.js";

export interface ServerConfig {
	port: number;
	host: string;
	production: boolean;
	allowedOrigins: string[];
	iceServers: IceServerConfig[];
	projectRoot: string;
	clientDistDir: string;
	sourceArchivePath: string;
	trustProxy: boolean;
	dev: boolean;
	databaseUrl: string | null;
	databaseSsl: boolean | "no-verify";
	cookieSecure: boolean;
	publicUrl: string | null;
	mailFrom: string;
	smtp: SmtpOptions | null;
	devMailDir: string;
	discord: { clientId: string; clientSecret: string } | null;
}

function findProjectRoot(start: string): string {
	let current = start;
	for (let depth = 0; depth < 6; depth += 1) {
		if (existsSync(resolve(current, "package.json"))) {
			return current;
		}
		current = dirname(current);
	}
	return process.cwd();
}

function loadDotEnv(root: string): void {
	const file = resolve(root, ".env");
	if (!existsSync(file)) {
		return;
	}
	for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
		const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
		if (!match || line.trimStart().startsWith("#")) {
			continue;
		}
		const [, key, rawValue] = match;
		if (key && process.env[key] === undefined) {
			process.env[key] = (rawValue ?? "").replace(/^['"]|['"]$/g, "");
		}
	}
}

function parseList(value: string | undefined): string[] {
	return (value ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function parseIceServers(): IceServerConfig[] {
	const stun = parseList(
		process.env.STUN_URLS ??
			"stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302",
	);
	const servers: IceServerConfig[] = stun.length > 0 ? [{ urls: stun }] : [];
	const turn = parseList(process.env.TURN_URLS);
	if (turn.length > 0) {
		servers.push({
			urls: turn,
			...(process.env.TURN_USERNAME
				? { username: process.env.TURN_USERNAME }
				: {}),
			...(process.env.TURN_CREDENTIAL
				? { credential: process.env.TURN_CREDENTIAL }
				: {}),
		});
	}
	return servers;
}

function parseSsl(value: string | undefined): boolean | "no-verify" {
	if (value === "no-verify") {
		return "no-verify";
	}
	return value === "true";
}

function parsePublicUrl(value: string | undefined): string | null {
	const raw = value?.trim();
	if (!raw) {
		return null;
	}
	const url = new URL(raw);
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new Error(
			"PUBLIC_URL doit commencer par https:// (ou http:// en local).",
		);
	}
	return url.origin;
}

function parseSmtp(): SmtpOptions | null {
	const host = process.env.SMTP_HOST?.trim();
	if (!host) {
		return null;
	}
	const port = Number(process.env.SMTP_PORT ?? 465);
	return {
		host,
		port,
		secure: process.env.SMTP_SECURE
			? process.env.SMTP_SECURE === "true"
			: port === 465,
		user: process.env.SMTP_USER?.trim() || null,
		password: process.env.SMTP_PASSWORD ?? null,
	};
}

export function loadServerConfig(): ServerConfig {
	const here = dirname(fileURLToPath(import.meta.url));
	const projectRoot = findProjectRoot(here);
	loadDotEnv(projectRoot);
	const production = process.env.NODE_ENV === "production";
	return {
		port: Number(process.env.PORT ?? 3001),
		host: process.env.HOST ?? "0.0.0.0",
		production,
		allowedOrigins: parseList(process.env.ALLOWED_ORIGINS),
		iceServers: parseIceServers(),
		projectRoot,
		clientDistDir: resolve(projectRoot, process.env.CLIENT_DIST_DIR ?? "dist"),
		sourceArchivePath: resolve(
			projectRoot,
			process.env.SOURCE_ARCHIVE ?? "release/mycelium-source.zip",
		),
		trustProxy: process.env.TRUST_PROXY === "true",
		dev: process.env.DEV === "true",
		databaseUrl: process.env.DATABASE_URL?.trim() || null,
		databaseSsl: parseSsl(process.env.DATABASE_SSL),
		cookieSecure:
			process.env.COOKIE_SECURE === "true" ||
			(process.env.COOKIE_SECURE !== "false" && production),
		publicUrl: parsePublicUrl(process.env.PUBLIC_URL),
		mailFrom:
			process.env.MAIL_FROM?.trim() || "MOLDIUS <noreply@mycelium.gacht.xyz>",
		smtp: parseSmtp(),
		devMailDir: resolve(projectRoot, ".dev-mail"),
		discord:
			process.env.DISCORD_CLIENT_ID?.trim() &&
			process.env.DISCORD_CLIENT_SECRET?.trim()
				? {
						clientId: process.env.DISCORD_CLIENT_ID.trim(),
						clientSecret: process.env.DISCORD_CLIENT_SECRET.trim(),
					}
				: null,
	};
}
