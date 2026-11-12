const { app, ipcMain, net, safeStorage, session } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const BRIDGE_NAME =
	process.platform === "win32" ? "moldius-discord.exe" : "moldius-discord";
const MAX_RESTARTS = 3;
const INVITE_TIMEOUT_MS = 10_000;
const AUTHORIZE_TIMEOUT_MS = 180_000;
const ACCOUNT_TIMEOUT_MS = 15_000;
const ACCOUNT_INTENTS = new Set(["login", "link", "proof"]);
const MAX_FRIENDS = 1000;
const STATUSES = new Set([
	"unavailable",
	"signed-out",
	"authorizing",
	"connecting",
	"ready",
	"error",
]);
const FRIEND_STATUSES = new Set(["online", "idle", "dnd", "offline"]);

function bridgePath() {
	const candidate = app.isPackaged
		? path.join(process.resourcesPath, "discord", BRIDGE_NAME)
		: path.join(__dirname, "discord-bridge", "dist", BRIDGE_NAME);
	return fs.existsSync(candidate) ? candidate : null;
}

function shortText(value, max = 128) {
	return typeof value === "string" && value.length > 0
		? value.slice(0, max)
		: null;
}

function isDiscordId(value) {
	return typeof value === "string" && /^[0-9]{5,25}$/.test(value);
}

function cleanUser(user) {
	if (!user || typeof user !== "object" || !isDiscordId(user.id)) {
		return null;
	}
	return {
		id: user.id,
		username: shortText(user.username, 64) ?? "",
		displayName:
			shortText(user.displayName, 64) ?? shortText(user.username, 64) ?? "",
		avatarUrl:
			typeof user.avatarUrl === "string" &&
			user.avatarUrl.startsWith("https://cdn.discordapp.com/")
				? user.avatarUrl.slice(0, 256)
				: null,
		status: FRIEND_STATUSES.has(user.status) ? user.status : "offline",
		playing: user.playing === true,
		provisional: user.provisional === true,
	};
}

function cleanActivity(input) {
	if (!input || typeof input !== "object") {
		return null;
	}
	const activity = {};
	for (const key of [
		"state",
		"details",
		"largeImage",
		"largeText",
		"joinSecret",
	]) {
		const value = shortText(input[key]);
		if (value) {
			activity[key] = value;
		}
	}
	if (
		Number.isSafeInteger(input.startedAt) &&
		input.startedAt > 0 &&
		input.startedAt < 1e14
	) {
		activity.startedAt = input.startedAt;
	}
	const party = input.party;
	if (
		party &&
		typeof party === "object" &&
		shortText(party.id) &&
		party.id.length >= 2 &&
		Number.isInteger(party.size) &&
		Number.isInteger(party.max) &&
		party.size >= 1 &&
		party.max >= party.size &&
		party.max <= 100
	) {
		activity.party = {
			id: party.id.slice(0, 128),
			size: party.size,
			max: party.max,
			public: party.public === true,
		};
	} else {
		delete activity.joinSecret;
	}
	return activity;
}

function createDiscord({ applicationId, gameOrigin, isGame, getWindow }) {
	const tokenFile = path.join(app.getPath("userData"), "discord-token.bin");
	const state = {
		available: false,
		status: "unavailable",
		error: null,
		user: null,
		friends: [],
	};
	const pendingJoins = [];
	const pendingInvites = new Map();
	let child = null;
	let restarts = 0;
	let stopping = false;
	let lastPresence = null;
	let accessToken = null;
	let pendingAuthorize = null;

	const fromGame = (event) => isGame(event.senderFrame?.url ?? "");

	function publish() {
		const window = getWindow();
		if (window && !window.isDestroyed()) {
			window.webContents.send("moldius:discord-state", state);
		}
	}

	function readToken() {
		try {
			if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(tokenFile)) {
				return null;
			}
			return safeStorage.decryptString(fs.readFileSync(tokenFile));
		} catch {
			return null;
		}
	}

	function writeToken(token) {
		try {
			if (!token) {
				fs.rmSync(tokenFile, { force: true });
			} else if (safeStorage.isEncryptionAvailable()) {
				fs.writeFileSync(tokenFile, safeStorage.encryptString(token));
			}
		} catch {}
	}

	function send(message) {
		if (child?.stdin.writable) {
			child.stdin.write(`${JSON.stringify(message)}\n`);
		}
	}

	function focusWindow() {
		const window = getWindow();
		if (window && !window.isDestroyed()) {
			if (window.isMinimized()) {
				window.restore();
			}
			window.focus();
		}
	}

	function onMessage(message) {
		switch (message?.type) {
			case "status":
				if (STATUSES.has(message.status)) {
					state.status = message.status;
					state.error = shortText(message.error, 300);
					if (message.status === "signed-out") {
						state.user = null;
						state.friends = [];
					}
					publish();
				}
				break;
			case "token":
				writeToken(
					typeof message.refreshToken === "string"
						? message.refreshToken
						: null,
				);
				accessToken =
					typeof message.accessToken === "string" ? message.accessToken : null;
				break;
			case "authorized":
				settleAuthorize({
					ok: message.ok === true,
					error: shortText(message.error, 300),
				});
				break;
			case "user":
				state.user = cleanUser(message.user);
				publish();
				break;
			case "friends":
				state.friends = Array.isArray(message.friends)
					? message.friends.slice(0, MAX_FRIENDS).map(cleanUser).filter(Boolean)
					: [];
				publish();
				break;
			case "join": {
				const secret = shortText(message.secret);
				if (secret) {
					pendingJoins.push(secret);
					const window = getWindow();
					if (window && !window.isDestroyed()) {
						window.webContents.send("moldius:discord-join");
					}
					focusWindow();
				}
				break;
			}
			case "invite": {
				const waiting = pendingInvites.get(message.userId);
				if (waiting) {
					pendingInvites.delete(message.userId);
					clearTimeout(waiting.timer);
					waiting.resolve({
						ok: message.ok === true,
						error: shortText(message.error, 300),
					});
				}
				break;
			}
			case "log":
				if (!app.isPackaged) {
					console.log(`[discord] ${message.level}: ${message.message}`);
				}
				break;
		}
	}

	function launchCommand() {
		return app.isPackaged
			? `"${process.execPath}"`
			: `"${process.execPath}" "${app.getAppPath()}"`;
	}

	function spawnBridge(executable) {
		child = spawn(executable, [], {
			cwd: path.dirname(executable),
			windowsHide: true,
			stdio: ["pipe", "pipe", "ignore"],
		});
		readline.createInterface({ input: child.stdout }).on("line", (line) => {
			try {
				onMessage(JSON.parse(line));
			} catch {}
		});
		child.on("error", () => {});
		child.on("exit", () => {
			child = null;
			accessToken = null;
			settleAuthorize({ ok: false, error: "bridge" });
			for (const waiting of pendingInvites.values()) {
				clearTimeout(waiting.timer);
				waiting.resolve({ ok: false, error: "bridge" });
			}
			pendingInvites.clear();
			if (stopping) {
				return;
			}
			if (restarts < MAX_RESTARTS) {
				restarts += 1;
				setTimeout(() => spawnBridge(executable), 2000 * restarts);
				return;
			}
			state.available = false;
			state.status = "unavailable";
			publish();
		});
		send({
			type: "init",
			applicationId,
			launchCommand: launchCommand(),
			refreshToken: readToken(),
		});
		if (lastPresence) {
			send({ type: "presence", activity: lastPresence });
		}
	}

	ipcMain.handle("moldius:discord-state", (event) =>
		fromGame(event) ? state : null,
	);
	ipcMain.handle("moldius:discord-take-joins", (event) =>
		fromGame(event) ? pendingJoins.splice(0) : [],
	);
	function settleAuthorize(result) {
		if (pendingAuthorize) {
			clearTimeout(pendingAuthorize.timer);
			pendingAuthorize.resolve(result);
			pendingAuthorize = null;
		}
	}

	function authorizeBridge() {
		if (pendingAuthorize) {
			return pendingAuthorize.promise;
		}
		let resolve;
		const promise = new Promise((done) => {
			resolve = done;
		});
		pendingAuthorize = {
			promise,
			resolve,
			timer: setTimeout(
				() => settleAuthorize({ ok: false, error: "timeout" }),
				AUTHORIZE_TIMEOUT_MS,
			),
		};
		send({ type: "authorize" });
		return promise;
	}

	function postAccount(body) {
		return new Promise((resolve) => {
			let request;
			try {
				request = net.request({
					method: "POST",
					url: `${gameOrigin}/api/account/discord/app`,
					session: session.defaultSession,
					useSessionCookies: true,
				});
			} catch {
				resolve({ status: 0, json: null });
				return;
			}
			const timer = setTimeout(() => {
				request.abort();
				resolve({ status: 0, json: null });
			}, ACCOUNT_TIMEOUT_MS);
			request.setHeader("Content-Type", "application/json");
			request.on("response", (response) => {
				const chunks = [];
				response.on("data", (chunk) => chunks.push(chunk));
				response.on("end", () => {
					clearTimeout(timer);
					let json = null;
					try {
						json = JSON.parse(Buffer.concat(chunks).toString("utf8"));
					} catch {}
					resolve({ status: response.statusCode, json });
				});
			});
			request.on("error", () => {
				clearTimeout(timer);
				resolve({ status: 0, json: null });
			});
			request.end(JSON.stringify(body));
		});
	}

	function accountResult(reply) {
		const json = reply.json && typeof reply.json === "object" ? reply.json : {};
		return {
			ok: reply.status === 200,
			outcome: shortText(json.outcome, 40),
			proof: shortText(json.proof, 64),
			discord: shortText(json.discord, 64),
			error: reply.status === 200 ? null : String(reply.status),
		};
	}

	ipcMain.handle("moldius:discord-account", async (event, intent, language) => {
		if (!fromGame(event) || !ACCOUNT_INTENTS.has(intent) || !child) {
			return { ok: false, error: "unavailable" };
		}
		const body = (token) => ({
			intent,
			accessToken: token,
			language: shortText(language, 8),
		});
		if (accessToken) {
			const reply = await postAccount(body(accessToken));
			if (reply.status !== 401) {
				return accountResult(reply);
			}
		}
		const authorized = await authorizeBridge();
		if (!authorized.ok || !accessToken) {
			return {
				ok: false,
				error:
					authorized.error === "timeout" || authorized.error === "bridge"
						? authorized.error
						: "cancelled",
			};
		}
		return accountResult(await postAccount(body(accessToken)));
	});
	ipcMain.on("moldius:discord-disconnect", (event) => {
		if (fromGame(event)) {
			send({ type: "logout" });
		}
	});
	ipcMain.on("moldius:discord-presence", (event, activity) => {
		if (fromGame(event)) {
			lastPresence = cleanActivity(activity);
			send({ type: "presence", activity: lastPresence });
		}
	});
	ipcMain.handle("moldius:discord-invite", (event, userId, message) => {
		if (!fromGame(event) || !isDiscordId(userId) || !child) {
			return { ok: false, error: "unavailable" };
		}
		return new Promise((resolve) => {
			pendingInvites.get(userId)?.resolve({ ok: false, error: "replaced" });
			const timer = setTimeout(() => {
				pendingInvites.delete(userId);
				resolve({ ok: false, error: "timeout" });
			}, INVITE_TIMEOUT_MS);
			pendingInvites.set(userId, { resolve, timer });
			send({ type: "invite", userId, message: shortText(message) ?? "" });
		});
	});

	return {
		start() {
			const executable = applicationId ? bridgePath() : null;
			if (!executable || !/^[0-9]{5,25}$/.test(applicationId)) {
				return;
			}
			state.available = true;
			state.status = "connecting";
			spawnBridge(executable);
		},
		stop() {
			stopping = true;
			child?.stdin.end();
			child?.kill();
		},
	};
}

module.exports = { createDiscord };
