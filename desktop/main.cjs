// MOLDIUS en application de bureau : une fenêtre de jeu qui charge le serveur du jeu,
// sans barre de navigateur, avec plein écran, micro et verrouillage de la souris.
const { app, BrowserWindow, Menu, ipcMain, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "app-config.json"), "utf8"));
const GAME_URL = new URL(process.env.MOLDIUS_URL || config.url);
const GAME_ORIGIN = GAME_URL.origin;
/** La connexion Discord passe par ses pages : elles s'ouvrent dans la fenêtre du jeu. */
const LOGIN_HOSTS = new Set(["discord.com", "www.discord.com", "discordapp.com"]);
const PERMISSIONS = new Set([
	"media",
	"pointerLock",
	"fullscreen",
	"clipboard-sanitized-write",
	"keyboardLock",
]);
const SMOKE_TEST = process.env.MOLDIUS_SMOKE_TEST || null;

// Le son du menu démarre sans attendre un clic, comme dans un jeu installé.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.setAppUserModelId("fr.moldius.game");

if (SMOKE_TEST) {
	// Un test tourne à part : ses propres données, sans gêner un MOLDIUS déjà ouvert.
	app.setPath("userData", path.join(app.getPath("temp"), "moldius-smoke-test"));
} else if (!app.requestSingleInstanceLock()) {
	app.quit();
}

let window = null;

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
		if (parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:") {
			void shell.openExternal(parsed.toString());
		}
	} catch {
		// Adresse illisible : on ne l'ouvre pas.
	}
}

function showOffline() {
	if (!window) {
		return;
	}
	void window.loadFile(path.join(__dirname, "pages", "offline.html"), {
		query: { url: GAME_URL.toString(), lang: app.getLocale().startsWith("fr") ? "fr" : "en" },
	});
}

function createWindow() {
	window = new BrowserWindow({
		width: 1600,
		height: 900,
		minWidth: 1100,
		minHeight: 640,
		show: false,
		title: "MOLDIUS",
		backgroundColor: "#111512",
		icon: path.join(__dirname, "build", "icon.png"),
		// Pas de cadre Windows : le jeu dessine ses propres boutons (voir preload.cjs).
		frame: false,
		autoHideMenuBar: true,
		// Lancé en plein écran, comme un jeu ; F11, Alt+Entrée ou le bouton du jeu en sortent.
		fullscreen: SMOKE_TEST ? Boolean(process.env.MOLDIUS_SMOKE_FULLSCREEN) : true,
		webPreferences: {
			preload: path.join(__dirname, "preload.cjs"),
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
			spellcheck: false,
			// Une partie continue quand la fenêtre passe derrière une autre.
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
	const sendFullscreen = () => contents.send("moldius:fullscreen-changed", window.isFullScreen());
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
		const fullscreenKey = input.key === "F11" || (input.alt && input.key === "Enter");
		if (fullscreenKey) {
			event.preventDefault();
			window.setFullScreen(!window.isFullScreen());
			return;
		}
		// Ni zoom de page ni rechargement accidentel en pleine partie.
		const zoomKey = input.control && ["+", "=", "-", "0"].includes(input.key);
		const reloadKey = input.key === "F5" || (input.control && input.key.toLowerCase() === "r");
		if (zoomKey || (app.isPackaged && reloadKey)) {
			event.preventDefault();
		}
		if (!app.isPackaged && input.control && input.shift && input.key.toLowerCase() === "i") {
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
	contents.on("did-fail-load", (_event, code, _description, url, isMainFrame) => {
		// -3 : chargement interrompu par une nouvelle navigation, pas une panne.
		if (isMainFrame && code !== -3 && isGame(url)) {
			showOffline();
		}
	});

	const workerLogs = [];
	if (SMOKE_TEST && process.env.MOLDIUS_SMOKE_VOSK && !process.env.MOLDIUS_SMOKE_NODEBUG) {
		// Diagnostic : la console des workers, via le protocole de débogage de Chromium.
		try {
			contents.debugger.attach("1.3");
			contents.debugger.on("message", (_event, method, params, sessionId) => {
				if (method === "Target.attachedToTarget") {
					void contents.debugger.sendCommand("Runtime.enable", {}, params.sessionId).catch(() => undefined);
					void contents.debugger.sendCommand("Runtime.runIfWaitingForDebugger", {}, params.sessionId).catch(() => undefined);
				}
				if (method === "Runtime.consoleAPICalled" && sessionId) {
					workerLogs.push(`${params.type}: ${params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ")}`.slice(0, 400));
				}
				if (method === "Runtime.exceptionThrown" && sessionId) {
					workerLogs.push(`exception: ${params.exceptionDetails.exception?.description ?? params.exceptionDetails.text}`.slice(0, 400));
				}
			});
			void contents.debugger.sendCommand("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
		} catch (error) {
			workerLogs.push(`debugger: ${error}`);
		}
	}
	if (SMOKE_TEST) {
		contents.once("did-finish-load", () => {
			setTimeout(async () => {
				// Diagnostic de la reconnaissance hors ligne : tout ce que dit le worker, avec un délai partout.
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
				// Une phrase enregistrée, transcrite par le modèle anglais comme le ferait une incantation.
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
				const mic = process.env.MOLDIUS_SMOKE_VOSK
					? await contents.executeJavaScript(`navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => { stream.getTracks().forEach((track) => track.stop()); return "micro ok"; }, (error) => "micro: " + error.name)`)
					: "";
				const image = await contents.capturePage();
				const page = await contents.executeJavaScript(
					`JSON.stringify({ controls: Boolean(document.getElementById("moldius-window-controls")), desktop: Boolean(window.moldiusDesktop), root: document.getElementById("root")?.childElementCount ?? 0, boot: Boolean(document.getElementById("boot")), title: document.querySelector("h1")?.textContent ?? null, fullscreen: window.moldiusDesktop?.isFullscreen() ?? null, nativeSpeech: typeof window.webkitSpeechRecognition, wasm: typeof WebAssembly, worker: typeof Worker })`,
				);
				fs.writeFileSync(SMOKE_TEST, image.toPNG());
				fs.writeFileSync(
					`${SMOKE_TEST}.txt`,
					`${contents.getURL()}\n${contents.getTitle()}\n${image.isEmpty() ? "image vide" : "image ok"}\n${JSON.stringify({ bounds: window.getBounds(), visible: window.isVisible(), fullscreen: window.isFullScreen(), crashed: contents.isCrashed(), size: image.getSize() })}\n${page}\n${vosk}\n${mic}\n${heard}\n${workerLogs.join("\n")}\n`,
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
	gameSession.setPermissionRequestHandler((contents, permission, callback, details) => {
		const origin = details.requestingUrl || contents.getURL();
		callback(isGame(origin) && PERMISSIONS.has(permission));
	});
	gameSession.setPermissionCheckHandler((_contents, permission, origin) =>
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
});

app.on("window-all-closed", () => {
	app.quit();
});
