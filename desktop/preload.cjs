const { contextBridge, ipcRenderer } = require("electron");

const listeners = new Set();

function measureFullscreen() {
	return (
		window.innerWidth >= screen.width - 1 &&
		window.innerHeight >= screen.height - 1
	);
}

let fullscreen = measureFullscreen();

function updateFullscreen() {
	const next = measureFullscreen();
	if (next === fullscreen) {
		return;
	}
	fullscreen = next;
	for (const listener of listeners) {
		listener(fullscreen);
	}
}

window.addEventListener("resize", updateFullscreen);
ipcRenderer.on("moldius:fullscreen-changed", () =>
	setTimeout(updateFullscreen, 120),
);

contextBridge.executeInMainWorld({
	func: () => {
		for (const name of ["SpeechRecognition", "webkitSpeechRecognition"]) {
			try {
				Object.defineProperty(window, name, {
					value: undefined,
					configurable: true,
					writable: true,
				});
			} catch {}
		}
	},
});

contextBridge.exposeInMainWorld("moldiusDesktop", {
	isDesktop: true,
	quit: () => ipcRenderer.send("moldius:quit"),
	minimize: () => ipcRenderer.send("moldius:minimize"),
	toggleFullscreen: () => ipcRenderer.send("moldius:fullscreen"),
	retry: () => ipcRenderer.send("moldius:retry"),
	isFullscreen: () => fullscreen,
	onFullscreenChange: (listener) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
	discord: {
		getState: () => ipcRenderer.invoke("moldius:discord-state"),
		onState: (listener) => {
			const handler = (_event, state) => listener(state);
			ipcRenderer.on("moldius:discord-state", handler);
			return () => ipcRenderer.removeListener("moldius:discord-state", handler);
		},
		account: (intent, language) =>
			ipcRenderer.invoke("moldius:discord-account", intent, language),
		disconnect: () => ipcRenderer.send("moldius:discord-disconnect"),
		setPresence: (activity) =>
			ipcRenderer.send("moldius:discord-presence", activity),
		invite: (userId, message) =>
			ipcRenderer.invoke("moldius:discord-invite", userId, message),
		onJoin: (listener) => {
			const take = () =>
				ipcRenderer
					.invoke("moldius:discord-take-joins")
					.then((secrets) => {
						for (const secret of secrets) {
							listener(secret);
						}
					})
					.catch(() => undefined);
			ipcRenderer.on("moldius:discord-join", take);
			take();
			return () => ipcRenderer.removeListener("moldius:discord-join", take);
		},
	},
});

const ICONS = {
	minimize: "M3 12h10v2H3z",
	enter: "M2 2h5v2H4v3H2zm7 0h5v5h-2V4H9zM2 9h2v3h3v2H2zm10 0h2v5H9v-2h3z",
	leave: "M5 2h2v5H2V5h3zm4 0h2v3h3v2H9zM2 9h5v5H5v-3H2zm7 0h5v2h-3v3H9z",
	close:
		"M3.4 2 8 6.6 12.6 2 14 3.4 9.4 8l4.6 4.6-1.4 1.4L8 9.4 3.4 14 2 12.6 6.6 8 2 3.4z",
};

const STYLE = `
:host { all: initial; }
.bar {
	position: fixed; inset: 0 0 auto 0; height: 34px; z-index: 2147483000;
	pointer-events: none; display: flex; justify-content: flex-end;
}
.bar.windowed { -webkit-app-region: drag; pointer-events: auto; }
.bar.hidden { display: none; }
.buttons { display: flex; pointer-events: auto; -webkit-app-region: no-drag; }
button {
	width: 46px; height: 34px; display: grid; place-items: center; padding: 0;
	border: 0; background: rgba(10, 12, 10, 0.72); color: #9fa894; cursor: pointer;
	transition: background 120ms, color 120ms; border-bottom: 1px solid #2f3a31;
}
button:first-child { border-left: 1px solid #2f3a31; }
button:hover, button:focus-visible { background: #1d231f; color: #dce54d; outline: none; }
button.close:hover, button.close:focus-visible { background: #e5533d; color: #111512; }
svg { width: 14px; height: 14px; fill: currentColor; }
`;

function button(name, label, onClick) {
	const element = document.createElement("button");
	element.type = "button";
	element.className = name;
	element.title = label;
	element.setAttribute("aria-label", label);
	element.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${ICONS[name === "fullscreen" ? "enter" : name]}"/></svg>`;
	element.addEventListener("click", onClick);
	return element;
}

function mountControls() {
	if (
		location.protocol === "file:" ||
		document.getElementById("moldius-window-controls")
	) {
		return;
	}
	const french =
		(navigator.language || "").toLowerCase().startsWith("fr") ||
		document.documentElement.lang === "fr";
	const host = document.createElement("div");
	host.id = "moldius-window-controls";
	const shadow = host.attachShadow({ mode: "closed" });
	const style = document.createElement("style");
	style.textContent = STYLE;
	const bar = document.createElement("div");
	bar.className = "bar";
	const buttons = document.createElement("div");
	buttons.className = "buttons";
	const minimize = button("minimize", french ? "Réduire" : "Minimise", () =>
		ipcRenderer.send("moldius:minimize"),
	);
	const toggle = button(
		"fullscreen",
		french ? "Plein écran" : "Fullscreen",
		() => ipcRenderer.send("moldius:fullscreen"),
	);
	const close = button(
		"close",
		french ? "Quitter vers le bureau" : "Exit to desktop",
		() => ipcRenderer.send("moldius:quit"),
	);
	buttons.append(minimize, toggle, close);
	bar.append(buttons);
	shadow.append(style, bar);
	document.documentElement.append(host);

	const refresh = () => {
		bar.classList.toggle(
			"hidden",
			fullscreen || Boolean(document.pointerLockElement),
		);
		bar.classList.toggle("windowed", !fullscreen);
		toggle
			.querySelector("path")
			.setAttribute("d", fullscreen ? ICONS.leave : ICONS.enter);
		toggle.title = fullscreen
			? french
				? "Quitter le plein écran"
				: "Exit fullscreen"
			: french
				? "Plein écran"
				: "Fullscreen";
	};
	document.addEventListener("pointerlockchange", refresh);
	listeners.add(refresh);
	refresh();
}

window.addEventListener("DOMContentLoaded", mountControls);
