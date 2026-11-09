import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import express, { type Express } from "express";
import type { AdminLiveStats } from "../shared/protocol/admin.js";
import type { AccountModule } from "./accounts/AccountModule.js";
import { createAdminRouter } from "./accounts/adminRoutes.js";
import { createAccountRouter } from "./accounts/routes.js";
import type { ServerConfig } from "./config.js";
import type { LobbyManager } from "./lobby/LobbyManager.js";
import { sourceEntries } from "./source/sourceFiles.js";
import { createZip } from "./source/zipArchive.js";

const CONTENT_SECURITY_POLICY = [
	"default-src 'self'",
	"script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https://cdn.discordapp.com",
	"font-src 'self'",
	"connect-src 'self'",
	"media-src 'self' blob: mediastream:",
	"worker-src 'self' blob:",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
].join("; ");

const SPEECH_WORKER_POLICY = [
	"default-src 'none'",
	"script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
	"connect-src 'self'",
].join("; ");

const SHARE_URL_TAG =
	/(<meta (?:property|name)="(?:og|twitter):(?:url|image)" content=")\//g;

export function absoluteShareUrls(html: string, origin: string): string {
	return html.replace(SHARE_URL_TAG, `$1${origin.replace(/\/+$/, "")}/`);
}

export interface AppHandle {
	app: Express;
	dispose(): void;
}

export function createApp(
	config: ServerConfig,
	lobbies: () => LobbyManager | null,
	accounts: AccountModule,
	liveStats: () => AdminLiveStats | null = () => null,
): AppHandle {
	const app = express();
	app.disable("x-powered-by");
	if (config.trustProxy) {
		app.set("trust proxy", 1);
	}
	app.use((request, response, next) => {
		response.setHeader("X-Content-Type-Options", "nosniff");
		response.setHeader("Referrer-Policy", "same-origin");
		response.setHeader(
			"Permissions-Policy",
			"microphone=(self), camera=(), geolocation=()",
		);
		response.setHeader("X-Frame-Options", "DENY");
		response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
		response.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
		if (request.secure) {
			response.setHeader("Strict-Transport-Security", "max-age=15552000");
		}
		next();
	});

	const accountRouter = createAccountRouter(accounts);
	app.use("/api/account", accountRouter.router);
	app.use(
		"/api/admin",
		createAdminRouter(accounts, config.adminEmails, liveStats),
	);

	app.get("/api/health", (_request, response) => {
		response.json({
			ok: true,
			...(lobbies()?.stats() ?? { lobbies: 0, matches: 0 }),
		});
	});

	// L'installateur Windows le plus récent de l'application de bureau.
	app.get("/download/MOLDIUS-Setup.exe", (_request, response) => {
		const installer = latestInstaller(config.desktopReleaseDir);
		if (!installer) {
			response.status(404).json({ error: "Installateur indisponible." });
			return;
		}
		response.setHeader(
			"Content-Type",
			"application/vnd.microsoft.portable-executable",
		);
		response.setHeader(
			"Content-Disposition",
			`attachment; filename="${basename(installer)}"`,
		);
		response.setHeader("Cache-Control", "no-cache");
		response.sendFile(installer);
	});

	app.get("/download/mycelium-source.zip", (_request, response) => {
		const sendArchive = (send: () => void) => {
			response.setHeader("Content-Type", "application/zip");
			response.setHeader(
				"Content-Disposition",
				'attachment; filename="mycelium-source.zip"',
			);
			send();
		};
		if (existsSync(config.sourceArchivePath)) {
			sendArchive(() => response.sendFile(config.sourceArchivePath));
			return;
		}
		if (
			existsSync(resolve(config.projectRoot, "src")) &&
			existsSync(resolve(config.projectRoot, "server"))
		) {
			sendArchive(() =>
				response.send(createZip(sourceEntries(config.projectRoot))),
			);
			return;
		}
		response.status(404).json({
			error:
				"Archive des sources indisponible : exécutez npm run export:source.",
		});
	});

	if (existsSync(config.clientDistDir)) {
		app.use(
			express.static(config.clientDistDir, {
				index: false,
				maxAge: config.production ? "7d" : 0,
				setHeaders: (response, path) => {
					if (
						path.endsWith(".html") ||
						path.endsWith(".webmanifest") ||
						basename(path) === "sw.js"
					) {
						response.setHeader("Cache-Control", "no-cache");
					}
					if (
						basename(path) === "worker.js" &&
						basename(dirname(path)) === "vosk"
					) {
						response.setHeader("Content-Security-Policy", SPEECH_WORKER_POLICY);
						// Même adresse d'une version à l'autre : sans revalidation, l'application de
						// bureau (qui ne se recharge pas) et Cloudflare gardent l'ancien sept jours.
						response.setHeader("Cache-Control", "no-cache");
					}
				},
			}),
		);
		const indexPath = resolve(config.clientDistDir, "index.html");
		let indexPage: { mtimeMs: number; html: string } | null = null;
		app.get(/^\/(?!socket\.io|api|download).*/, (request, response) => {
			const mtimeMs = statSync(indexPath).mtimeMs;
			if (indexPage?.mtimeMs !== mtimeMs) {
				indexPage = { mtimeMs, html: readFileSync(indexPath, "utf8") };
			}
			const origin =
				config.publicUrl ?? `${request.protocol}://${request.get("host")}`;
			response.setHeader("Cache-Control", "no-cache");
			response.type("html").send(absoluteShareUrls(indexPage.html, origin));
		});
	}
	return { app, dispose: accountRouter.dispose };
}

/** Le plus récent des MOLDIUS-Setup-<version>.exe du dossier, s'il y en a un. */
export function latestInstaller(directory: string): string | null {
	if (!existsSync(directory)) {
		return null;
	}
	const candidates = readdirSync(directory)
		.filter((name) => /^MOLDIUS-Setup-[\w.-]+\.exe$/.test(name))
		.map((name) => resolve(directory, name))
		.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
	return candidates[0] ?? null;
}
