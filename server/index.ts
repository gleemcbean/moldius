import { createServer } from "node:http";
import { Server } from "socket.io";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "../shared/protocol/events.js";
import { AccountModule } from "./accounts/AccountModule.js";
import { createDatabase, type Database } from "./accounts/database.js";
import { createDiscordClient, type DiscordClient } from "./accounts/discord.js";
import type { ScryptParameters } from "./accounts/passwords.js";
import { createApp } from "./app.js";
import { serverNow } from "./clock.js";
import { loadServerConfig } from "./config.js";
import { LobbyManager } from "./lobby/LobbyManager.js";
import {
	createFileMailer,
	createSmtpMailer,
	type Mailer,
} from "./mail/mailer.js";
import { SessionRegistry } from "./sessions/SessionRegistry.js";
import { registerSocketHandlers } from "./socket/registerHandlers.js";

export interface ServerOverrides {
	port?: number;
	dev?: boolean;
	database?: Database | null;
	cookieSecure?: boolean;
	scrypt?: ScryptParameters;
	mailer?: Mailer | null;
	publicUrl?: string | null;
	discord?: DiscordClient | null;
}

export interface RunningServer {
	port: number;
	close(): Promise<void>;
}

export async function startServer(
	overrides: ServerOverrides = {},
): Promise<RunningServer> {
	const config = loadServerConfig();
	const dev = overrides.dev ?? config.dev;
	const publicUrl =
		overrides.publicUrl !== undefined ? overrides.publicUrl : config.publicUrl;
	const database =
		overrides.database !== undefined
			? overrides.database
			: config.databaseUrl
				? createDatabase({
						connectionString: config.databaseUrl,
						ssl: config.databaseSsl,
						maxConnections: 10,
					})
				: null;
	const mailer =
		overrides.mailer !== undefined
			? overrides.mailer
			: config.smtp
				? createSmtpMailer(config.smtp, config.mailFrom)
				: dev
					? createFileMailer(config.devMailDir, config.mailFrom)
					: null;
	const accounts = new AccountModule(
		database,
		overrides.cookieSecure ?? config.cookieSecure,
		{
			...(overrides.scrypt ? { scrypt: overrides.scrypt } : {}),
			mailer,
			publicUrl,
			dev,
			discord:
				overrides.discord !== undefined
					? overrides.discord
					: config.discord
						? createDiscordClient(
								config.discord.clientId,
								config.discord.clientSecret,
							)
						: null,
		},
	);
	await accounts.start();
	let lobbies: LobbyManager | null = null;
	const { app, dispose: disposeApp } = createApp(
		config,
		() => lobbies,
		accounts,
	);
	const httpServer = createServer(app);
	const io = new Server<ClientToServerEvents, ServerToClientEvents>(
		httpServer,
		{
			cors:
				config.allowedOrigins.length > 0
					? { origin: config.allowedOrigins, credentials: false }
					: undefined,
			perMessageDeflate: { threshold: 2048 },
			pingInterval: 10_000,
			pingTimeout: 15_000,
			maxHttpBufferSize: 1_000_000,
			serveClient: false,
		},
	);
	const sessions = new SessionRegistry();
	accounts.onRevoke = (revocation) => sessions.revoke(revocation);
	lobbies = new LobbyManager(io, sessions, serverNow, {
		minPlayers: dev ? 1 : 2,
		dev,
		onMatchRecords: (records) => accounts.record(records),
	});
	registerSocketHandlers({
		io,
		sessions,
		lobbies,
		iceServers: config.iceServers,
		dev,
		clock: serverNow,
		identify: (cookieHeader) => accounts.identify(cookieHeader),
	});
	if (dev) {
		console.log(
			"MOLDIUS : mode DEV actif, les parties peuvent se lancer en solo",
		);
	}
	if (!accounts.enabled) {
		console.log(
			"MOLDIUS : DATABASE_URL absent, les comptes joueurs sont désactivés",
		);
	} else if (!mailer) {
		console.log(
			"MOLDIUS : SMTP non configuré, inscriptions et réinitialisations impossibles",
		);
	} else if (mailer.kind === "file") {
		console.log(
			"MOLDIUS : e-mails de développement écrits dans .dev-mail/ (SMTP non configuré)",
		);
	}

	const port = overrides.port ?? config.port;
	await new Promise<void>((resolve) =>
		httpServer.listen(port, config.host, resolve),
	);
	const address = httpServer.address();
	const actualPort =
		typeof address === "object" && address ? address.port : port;
	return {
		port: actualPort,
		close: async () => {
			lobbies?.dispose();
			disposeApp();
			await new Promise<void>((resolve) => {
				void io.close(() => resolve());
			});
			await accounts.close();
		},
	};
}
