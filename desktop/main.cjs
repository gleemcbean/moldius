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

	if (SMOKE_TEST) {
		contents.once("did-finish-load", () => {
			setTimeout(async () => {
				const image = await contents.capturePage();
				const page = await contents.executeJavaScript(
					`JSON.stringify({ controls: Boolean(document.getElementById("moldius-window-controls")), desktop: Boolean(window.moldiusDesktop), root: document.getElementById("root")?.childElementCount ?? 0, boot: Boolean(document.getElementById("boot")), title: document.querySelector("h1")?.textContent ?? null, fullscreen: window.moldiusDesktop?.isFullscreen() ?? null, nativeSpeech: typeof window.webkitSpeechRecognition, wasm: typeof WebAssembly, worker: typeof Worker })`,
				);
				fs.writeFileSync(SMOKE_TEST, image.toPNG());
				fs.writeFileSync(
					`${SMOKE_TEST}.txt`,
					`${contents.getURL()}\n${contents.getTitle()}\n${image.isEmpty() ? "image vide" : "image ok"}\n${JSON.stringify({ bounds: window.getBounds(), visible: window.isVisible(), fullscreen: window.isFullScreen(), crashed: contents.isCrashed(), size: image.getSize() })}\n${page}\n`,
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
