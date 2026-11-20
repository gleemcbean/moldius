import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import express, { type Express } from "express";
import { parseLanguage } from "../shared/i18n/languages.js";
import type { AdminLiveStats } from "../shared/protocol/admin.js";
import type { AccountModule } from "./accounts/AccountModule.js";
import { createAdminRouter } from "./accounts/adminRoutes.js";
import { createAccountRouter } from "./accounts/routes.js";
import type { ServerConfig } from "./config.js";
import type { LobbyManager } from "./lobby/LobbyManager.js";

enum InstallerType {
	WIN = "exe",
	APPIMAGE = "AppImage",
	DEB = "deb",
	RPM = "rpm",
}

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

	app.get("/download/:type", (request, response) => {
		const installer = latestInstaller(
			config.desktopReleaseDir,
			{
				win: InstallerType.WIN,
				appimage: InstallerType.APPIMAGE,
				deb: InstallerType.DEB,
				rpm: InstallerType.RPM,
			}[request.params.type] as InstallerType,
		);

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
						response.setHeader("Cache-Control", "no-cache");
					}
				},
			}),
		);
		const indexPath = resolve(config.clientDistDir, "index.html");
		let indexPage: { mtimeMs: number; html: string } | null = null;
		app.get(/^\/(?!socket\.io|api|download).*/, (request, response) => {
			try {
				const mtimeMs = statSync(indexPath).mtimeMs;
				if (indexPage?.mtimeMs !== mtimeMs) {
					indexPage = { mtimeMs, html: readFileSync(indexPath, "utf8") };
				}
			} catch {
				if (!indexPage) {
					response.setHeader("Retry-After", "5");
					response
						.status(503)
						.type("text")
						.send(
							parseLanguage(request.get("accept-language")) === "fr"
								? "Mise à jour en cours, réessayez dans quelques secondes."
								: "Update in progress, please try again in a few seconds.",
						);
					return;
				}
			}
			const origin =
				config.publicUrl ?? `${request.protocol}://${request.get("host")}`;
			response.setHeader("Cache-Control", "no-cache");
			response.type("html").send(absoluteShareUrls(indexPage.html, origin));
		});
	}
	return { app, dispose: accountRouter.dispose };
}

export function latestInstaller(
	directory: string,
	type: InstallerType,
): string | null {
	if (!existsSync(directory)) {
		return null;
	}

	const regex = new RegExp(`^Moldius-Setup-.*\\.${type}$`, "i");

	const candidates = readdirSync(directory)
		.filter((name) => regex.test(name))
		.map((name) => resolve(directory, name))
		.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
	return candidates[0] ?? null;
}
