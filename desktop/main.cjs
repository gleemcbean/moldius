const {
	app,
	BrowserWindow,
	Menu,
	ipcMain,
	session,
	shell,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { createDiscord } = require("./discord.cjs");

const config = JSON.parse(
	fs.readFileSync(path.join(__dirname, "app-config.json"), "utf8"),
);
const GAME_URL = new URL(process.env.MOLDIUS_URL || config.url);
const GAME_ORIGIN = GAME_URL.origin;
const LOGIN_HOSTS = new Set([
	"discord.com",
	"www.discord.com",
	"discordapp.com",
]);

const PERMISSIONS = new Set([
	"media",
	"pointerLock",
	"fullscreen",
	"clipboard-sanitized-write",
	"keyboardLock",
]);
const SMOKE_TEST = process.env.MOLDIUS_SMOKE_TEST || null;

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.setAppUserModelId("fr.moldius.game");

if (SMOKE_TEST) {
	app.setPath("userData", path.join(app.getPath("temp"), "moldius-smoke-test"));
} else if (!app.requestSingleInstanceLock()) {
	app.quit();
}

let window = null;

const discord = createDiscord({
	applicationId: String(
		process.env.MOLDIUS_DISCORD_APP_ID || config.discordApplicationId || "",
	),
	gameOrigin: GAME_ORIGIN,
	isGame: (url) => isGame(url),
	getWindow: () => window,
});

function isGame(url) {
	try {
		return new URL(url).origin === GAME_ORIGIN;
	} catch {
		return false;
	}
}

function isLogin(url) {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" && LOGIN_HOSTS.has(parsed.hostname);
	} catch {
		return false;
	}
}

function openOutside(url) {
	try {
		const parsed = new URL(url);
		if (
			parsed.protocol === "https:" ||
			parsed.protocol === "http:" ||
			parsed.protocol === "mailto:"
		) {
			void shell.openExternal(parsed.toString());
		}
	} catch {}
}

function showOffline() {
	if (!window) {
		return;
	}
	void window.loadFile(path.join(__dirname, "pages", "offline.html"), {
		query: {
			url: GAME_URL.toString(),
			lang: app.getLocale().startsWith("fr") ? "fr" : "en",
		},
	});
}

function createWindow() {
	window = new BrowserWindow({
		width: 1600,
		height: 900,
		minWidth: 1100,
		minHeight: 640,
		show: false,
		title: "Moldius",
		backgroundColor: "#111512",
		icon: path.join(__dirname, "build", "icon.png"),
		frame: false,
		autoHideMenuBar: true,
		fullscreen: SMOKE_TEST
			? Boolean(process.env.MOLDIUS_SMOKE_FULLSCREEN)
			: true,
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
			spellcheck: false,
			backgroundThrottling: false,
		},
	});

	const contents = window.webContents;
	contents.setVisualZoomLevelLimits(1, 1);

	window.once("ready-to-show", () => {
		if (!SMOKE_TEST) {
			window.show();
		}
	});

	const sendFullscreen = () =>
		contents.send("moldius:fullscreen-changed", window.isFullScreen());
	window.on("enter-full-screen", sendFullscreen);
	window.on("leave-full-screen", sendFullscreen);
	contents.on("did-finish-load", sendFullscreen);
	window.on("closed", () => {
		window = null;
	});

	contents.on("before-input-event", (event, input) => {
		if (input.type !== "keyDown") {
			return;
		}
		const fullscreenKey =
			input.key === "F11" || (input.alt && input.key === "Enter");
		if (fullscreenKey) {
			event.preventDefault();
			window.setFullScreen(!window.isFullScreen());
			return;
		}

		const zoomKey = input.control && ["+", "=", "-", "0"].includes(input.key);
		const reloadKey =
			input.key === "F5" || (input.control && input.key.toLowerCase() === "r");
		if (zoomKey || (app.isPackaged && reloadKey)) {
			event.preventDefault();
		}
		if (
			!app.isPackaged &&
			input.control &&
			input.shift &&
			input.key.toLowerCase() === "i"
		) {
			contents.toggleDevTools();
		}
	});

	contents.setWindowOpenHandler(({ url }) => {
		openOutside(url);
		return { action: "deny" };
	});

	contents.on("will-navigate", (event, url) => {
		if (isGame(url) || isLogin(url)) {
			return;
		}
		event.preventDefault();
		openOutside(url);
	});

	contents.on(
		"did-fail-load",
		(_event, code, _description, url, isMainFrame) => {
			if (isMainFrame && code !== -3 && isGame(url)) {
				showOffline();
			}
		},
	);

	const workerLogs = [];
	if (
		SMOKE_TEST &&
		process.env.MOLDIUS_SMOKE_VOSK &&
		!process.env.MOLDIUS_SMOKE_NODEBUG
	) {
		try {
			contents.debugger.attach("1.3");
			contents.debugger.on("message", (_event, method, params, sessionId) => {
				if (method === "Target.attachedToTarget") {
					void contents.debugger
						.sendCommand("Runtime.enable", {}, params.sessionId)
						.catch(() => undefined);
					void contents.debugger
						.sendCommand(
							"Runtime.runIfWaitingForDebugger",
							{},
							params.sessionId,
						)
						.catch(() => undefined);
				}
				if (method === "Runtime.consoleAPICalled" && sessionId) {
					workerLogs.push(
						`${params.type}: ${params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ")}`.slice(
							0,
							400,
						),
					);
				}
				if (method === "Runtime.exceptionThrown" && sessionId) {
					workerLogs.push(
						`exception: ${params.exceptionDetails.exception?.description ?? params.exceptionDetails.text}`.slice(
							0,
							400,
						),
					);
				}
			});
			void contents.debugger.sendCommand("Target.setAutoAttach", {
				autoAttach: true,
				waitForDebuggerOnStart: false,
				flatten: true,
			});
		} catch (error) {
			workerLogs.push(`debugger: ${error}`);
		}
	}

	if (SMOKE_TEST) {
		contents.once("did-finish-load", () => {
			setTimeout(async () => {
				const vosk = process.env.MOLDIUS_SMOKE_VOSK
					? await contents.executeJavaScript(`new Promise((resolve) => {
						const started = performance.now();
						const log = [];
						const done = (step) => resolve(JSON.stringify({ step, ms: Math.round(performance.now() - started), log }));
						let worker;
						try { worker = new Worker("/vosk/worker.js"); } catch (error) { done("worker: " + error); return; }
						worker.onerror = (event) => { log.push("onerror " + (event.message || "?") + " " + (event.filename || "") + ":" + (event.lineno || "")); done("worker-error"); };
						worker.onmessageerror = () => log.push("messageerror");
						worker.onmessage = (event) => { log.push(JSON.stringify(event.data).slice(0, 300)); if (event.data && (event.data.event === "load" || event.data.event === "error")) done(event.data.event); };
						if (${JSON.stringify(process.env.MOLDIUS_SMOKE_LOGLEVEL || "")}) worker.postMessage({ action: "set", key: "logLevel", value: Number(${JSON.stringify(process.env.MOLDIUS_SMOKE_LOGLEVEL || "")}) });
						worker.postMessage({ action: "load", modelUrl: new URL(${JSON.stringify(process.env.MOLDIUS_SMOKE_MODEL || "/vosk/vosk-model-small-fr-0.22.tar.gz")}, location.href).href });
						setTimeout(() => done("timeout"), 120000);
					})`)
					: "";

				const heard = process.env.MOLDIUS_SMOKE_WAV
					? await contents.executeJavaScript(`(async () => {
						const bytes = Uint8Array.from(atob("${fs.readFileSync(process.env.MOLDIUS_SMOKE_WAV).toString("base64")}"), (c) => c.charCodeAt(0));
						const audio = await new AudioContext().decodeAudioData(bytes.buffer);
						const worker = new Worker("/vosk/worker.js");
						const reply = (wanted) => Promise.race([
							new Promise((resolve) => worker.addEventListener("message", function listener(event) {
								if (wanted.includes(event.data.event)) { worker.removeEventListener("message", listener); resolve(event.data); }
							})),
							new Promise((resolve) => setTimeout(() => resolve({ event: "timeout" }), 60000)),
						]);
						worker.postMessage({ action: "load", modelUrl: new URL("/vosk/vosk-model-small-en-us-0.15.tar.gz", location.href).href });
						const loaded = await reply(["load", "error"]);
						if (loaded.event !== "load") return JSON.stringify(loaded);
						worker.postMessage({ action: "create", recognizerId: "test", sampleRate: audio.sampleRate });
						const samples = audio.getChannelData(0);
						for (let start = 0; start < samples.length; start += 4096) {
							const chunk = samples.slice(start, start + 4096).map((value) => value * 32768);
							worker.postMessage({ action: "audioChunk", recognizerId: "test", data: chunk, sampleRate: audio.sampleRate }, [chunk.buffer]);
						}
						worker.postMessage({ action: "retrieveFinalResult", recognizerId: "test" });
						return JSON.stringify(await reply(["result", "error"]));
					})()`)
					: "";

				const many = process.env.MOLDIUS_SMOKE_WAVS
					? await contents.executeJavaScript(`(async () => {
						const files = ${JSON.stringify(
							fs
								.readdirSync(process.env.MOLDIUS_SMOKE_WAVS)
								.filter((name) => name.endsWith(".wav"))
								.sort()
								.map((name) =>
									fs
										.readFileSync(
											path.join(process.env.MOLDIUS_SMOKE_WAVS, name),
										)
										.toString("base64"),
								),
						)};
						const context = new AudioContext();
						const worker = new Worker("/vosk/worker.js");
						const reply = (wanted, id) => Promise.race([
							new Promise((resolve) => worker.addEventListener("message", function listener(event) {
								if (wanted.includes(event.data.event) && (!id || event.data.recognizerId === id)) { worker.removeEventListener("message", listener); resolve(event.data); }
							})),
							new Promise((resolve) => setTimeout(() => resolve({ event: "timeout" }), 60000)),
						]);
						worker.postMessage({ action: "load", modelUrl: new URL(${JSON.stringify(process.env.MOLDIUS_SMOKE_HEAR_MODEL || "/vosk/vosk-model-small-en-us-0.15.tar.gz")}, location.href).href });
						const loaded = await reply(["load", "error"]);
						if (loaded.event !== "load") return JSON.stringify(loaded);
						const heard = [];
						for (const [index, file] of files.entries()) {
							const bytes = Uint8Array.from(atob(file), (c) => c.charCodeAt(0));
							const audio = await context.decodeAudioData(bytes.buffer);
							const id = "test" + index;
							worker.postMessage({ action: "create", recognizerId: id, sampleRate: audio.sampleRate${process.env.MOLDIUS_SMOKE_GRAMMAR ? ", grammar: " + JSON.stringify(fs.readFileSync(process.env.MOLDIUS_SMOKE_GRAMMAR, "utf8")) : ""} });
							const samples = audio.getChannelData(0);
							const texts = [];
							const collect = (event) => { if (event.data.recognizerId === id && event.data.event === "result" && event.data.result.text) texts.push(event.data.result.text); };
							worker.addEventListener("message", collect);
							for (let start = 0; start < samples.length; start += 4096) {
								const chunk = samples.slice(start, start + 4096).map((value) => value * 32768);
								worker.postMessage({ action: "audioChunk", recognizerId: id, data: chunk, sampleRate: audio.sampleRate }, [chunk.buffer]);
							}
							worker.postMessage({ action: "retrieveFinalResult", recognizerId: id });
							await new Promise((resolve) => setTimeout(resolve, 1500));
							worker.removeEventListener("message", collect);
							heard.push(texts.join(" "));
							worker.postMessage({ action: "remove", recognizerId: id });
						}
						return JSON.stringify(heard);
					})()`)
					: "";

				const mic = process.env.MOLDIUS_SMOKE_VOSK
					? await contents.executeJavaScript(
							`navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => { stream.getTracks().forEach((track) => track.stop()); return "micro ok"; }, (error) => "micro: " + error.name)`,
						)
					: "";

				const image = await contents.capturePage();
				const page = await contents.executeJavaScript(
					`JSON.stringify({ controls: Boolean(document.getElementById("moldius-window-controls")), desktop: Boolean(window.moldiusDesktop), root: document.getElementById("root")?.childElementCount ?? 0, boot: Boolean(document.getElementById("boot")), title: document.querySelector("h1")?.textContent ?? null, fullscreen: window.moldiusDesktop?.isFullscreen() ?? null, nativeSpeech: typeof window.webkitSpeechRecognition, wasm: typeof WebAssembly, worker: typeof Worker })`,
				);

				fs.writeFileSync(SMOKE_TEST, image.toPNG());
				fs.writeFileSync(
					`${SMOKE_TEST}.txt`,
					`${contents.getURL()}\n${contents.getTitle()}\n${image.isEmpty() ? "image vide" : "image ok"}\n${JSON.stringify({ bounds: window.getBounds(), visible: window.isVisible(), fullscreen: window.isFullScreen(), crashed: contents.isCrashed(), size: image.getSize() })}\n${page}\n${vosk}\n${mic}\n${heard}\n${many}\n${workerLogs.join("\n")}\n`,
				);

				app.quit();
			}, 6000);
		});
	}

	void window.loadURL(GAME_URL.toString());
}

app.on("second-instance", () => {
	if (window) {
		if (window.isMinimized()) {
			window.restore();
		}
		window.focus();
	}
});

app.whenReady().then(() => {
	Menu.setApplicationMenu(null);
	const gameSession = session.defaultSession;

	gameSession.setPermissionRequestHandler(
		(contents, permission, callback, details) => {
			const origin = details.requestingUrl || contents.getURL();
			callback(isGame(origin) && PERMISSIONS.has(permission));
		},
	);

	gameSession.setPermissionCheckHandler(
		(_contents, permission, origin) =>
			isGame(origin) && PERMISSIONS.has(permission),
	);

	ipcMain.on("moldius:quit", () => app.quit());
	ipcMain.on("moldius:minimize", () => {
		if (window) {
			window.minimize();
		}
	});

	ipcMain.on("moldius:fullscreen", () => {
		if (window) {
			window.setFullScreen(!window.isFullScreen());
		}
	});

	ipcMain.on("moldius:retry", () => {
		if (window) {
			void window.loadURL(GAME_URL.toString());
		}
	});
	createWindow();
	if (!SMOKE_TEST) {
		discord.start();
	}
});

app.on("will-quit", () => discord.stop());

app.on("window-all-closed", () => {
	app.quit();
});
