import { io as connect, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type RunningServer, startServer } from "../server/index.js";
import { dailyChallenge, dailyDateKey } from "../shared/dailyChallenge.js";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "../shared/protocol/events.js";
import type { MatchInit } from "../shared/protocol/game.js";
import type {
	LobbyError,
	LobbyState,
	SessionInfo,
} from "../shared/protocol/lobby.js";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type AckResult<T> = { ok: true; value: T } | { ok: false; error: LobbyError };

let server: RunningServer;
const sockets: ClientSocket[] = [];

beforeAll(async () => {
	process.env.HOST = "127.0.0.1";
	server = await startServer({ port: 0, dev: false, database: null });
});

afterAll(async () => {
	for (const socket of sockets) {
		socket.disconnect();
	}
	await server.close();
});

async function client(
	port = server.port,
): Promise<{ socket: ClientSocket; session: SessionInfo }> {
	const socket: ClientSocket = connect(`http://127.0.0.1:${port}`, {
		transports: ["websocket"],
		forceNew: true,
	});
	sockets.push(socket);
	await new Promise<void>((resolve, reject) => {
		socket.once("connect", () => resolve());
		socket.once("connect_error", reject);
	});
	const session = await new Promise<SessionInfo>((resolve, reject) => {
		socket.emit("session:hello", { sessionToken: null }, (response) =>
			response.ok
				? resolve(response.value)
				: reject(new Error(response.error.message)),
		);
	});
	return { socket, session };
}

function request<T>(
	send: (ack: (response: AckResult<T>) => void) => void,
): Promise<AckResult<T>> {
	return new Promise((resolve) => send(resolve));
}

function waitFor<E extends keyof ServerToClientEvents>(
	socket: ClientSocket,
	event: E,
	timeoutMs = 20_000,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`Délai dépassé pour ${String(event)}`)),
			timeoutMs,
		);
		const listener = ((payload: Parameters<ServerToClientEvents[E]>[0]) => {
			clearTimeout(timer);
			resolve(payload);
		}) as never;
		socket.once(event, listener);
	});
}

function waitForState(
	socket: ClientSocket,
	predicate: (state: LobbyState) => boolean,
	timeoutMs = 5000,
): Promise<LobbyState> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			socket.off("lobby:state", listener);
			reject(new Error("État de lobby attendu non reçu"));
		}, timeoutMs);
		const listener = (state: LobbyState) => {
			if (predicate(state)) {
				clearTimeout(timer);
				socket.off("lobby:state", listener);
				resolve(state);
			}
		};
		socket.on("lobby:state", listener);
	});
}

describe("serveur HTTP", () => {
	it("répond au contrôle de santé", async () => {
		const response = await fetch(`http://127.0.0.1:${server.port}/api/health`);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ ok: true });
	});

	it("fournit une archive zip des sources", async () => {
		const response = await fetch(
			`http://127.0.0.1:${server.port}/download/mycelium-source.zip`,
		);
		expect(response.status).toBe(200);
		const bytes = new Uint8Array(await response.arrayBuffer());
		expect(bytes[0]).toBe(0x50);
		expect(bytes[1]).toBe(0x4b);
		expect(bytes.length).toBeGreaterThan(10_000);
	});
});

describe("lobbies Socket.IO", () => {
	it("lance le défi du jour à la bonne date, seul et avec les mêmes règles pour tous", async () => {
		const player = await client();
		const created = await request<LobbyState>((ack) =>
			player.socket.emit("lobby:createDaily", { name: "Morille" }, ack),
		);
		expect(created.ok).toBe(true);
		const lobby = (created as { value: LobbyState }).value;
		const challenge = dailyChallenge(dailyDateKey(Date.now()));
		expect(lobby.daily).toBe(challenge.date);
		expect(lobby.config).toEqual(challenge.config);
		expect(lobby.configEditable).toBe(false);
		expect(lobby.minPlayers).toBe(1);
		const refused = await request<LobbyState>((ack) =>
			player.socket.emit(
				"lobby:config",
				{ config: { ...lobby.config, simultaneousAnomalies: 1 } },
				ack,
			),
		);
		expect(refused.ok).toBe(false);
		player.socket.emit("lobby:microphone", { ready: true });
		player.socket.emit("lobby:ready", { ready: true });
		await waitForState(player.socket, (state) =>
			state.players.every((entry) => entry.ready),
		);
		const init = waitFor(player.socket, "game:init");
		const started = await request<null>((ack) =>
			player.socket.emit("lobby:start", ack),
		);
		expect(started.ok).toBe(true);
		expect(((await init) as MatchInit).seed).toBe(challenge.seed);
		player.socket.emit("lobby:leave");
	});

	it("isole les lobbies privés, protège la configuration et lance une partie complète", async () => {
		const host = await client();
		const guest = await client();
		const stranger = await client();

		const created = await request<LobbyState>((ack) =>
			host.socket.emit("lobby:createPrivate", { name: "Hôte" }, ack),
		);
		expect(created.ok).toBe(true);
		const lobby = (created as { value: LobbyState }).value;
		expect(lobby.visibility).toBe("private");
		expect(lobby.code).toMatch(/^[A-Z0-9]{5}$/);
		expect(lobby.capacity).toBe(8);

		const wrong = await request<LobbyState>((ack) =>
			guest.socket.emit(
				"lobby:joinPrivate",
				{ name: "Invité", code: "ZZZZZ" },
				ack,
			),
		);
		expect(wrong.ok).toBe(false);

		const joined = await request<LobbyState>((ack) =>
			guest.socket.emit(
				"lobby:joinPrivate",
				{ name: "Invité", code: lobby.code as string },
				ack,
			),
		);
		expect(joined.ok).toBe(true);
		expect((joined as { value: LobbyState }).value.id).toBe(lobby.id);
		expect(
			(joined as { value: LobbyState }).value.players
				.map((player) => player.id)
				.sort(),
		).toEqual([host.session.playerId, guest.session.playerId].sort());

		const publicLobby = await request<LobbyState>((ack) =>
			stranger.socket.emit("lobby:quickJoin", { name: "Passant" }, ack),
		);
		expect(publicLobby.ok).toBe(true);
		expect((publicLobby as { value: LobbyState }).value.id).not.toBe(lobby.id);
		expect((publicLobby as { value: LobbyState }).value.visibility).toBe(
			"public",
		);

		const publicConfig = await request<LobbyState>((ack) =>
			stranger.socket.emit(
				"lobby:config",
				{ config: { ...lobby.config, simultaneousAnomalies: 6 } },
				ack,
			),
		);
		expect(publicConfig).toMatchObject({
			ok: false,
			error: { code: "not-private" },
		});

		const guestConfig = await request<LobbyState>((ack) =>
			guest.socket.emit(
				"lobby:config",
				{ config: { ...lobby.config, simultaneousAnomalies: 6 } },
				ack,
			),
		);
		expect(guestConfig).toMatchObject({
			ok: false,
			error: { code: "not-host" },
		});

		const hostConfig = await request<LobbyState>((ack) =>
			host.socket.emit(
				"lobby:config",
				{
					config: {
						...lobby.config,
						simultaneousAnomalies: 99,
						manorSize: "small",
					},
				},
				ack,
			),
		);
		expect(hostConfig.ok).toBe(true);
		expect(
			(hostConfig as { value: LobbyState }).value.config.simultaneousAnomalies,
		).toBe(10);

		const early = await request<null>((ack) =>
			host.socket.emit("lobby:start", ack),
		);
		expect(early).toMatchObject({ ok: false, error: { code: "not-ready" } });

		const afterRefusal = waitForState(host.socket, () => true);
		guest.socket.emit("lobby:ready", { ready: true });
		const refused = await afterRefusal;
		expect(
			refused.players.find((player) => player.id === guest.session.playerId)
				?.ready,
		).toBe(false);

		for (const participant of [host, guest]) {
			participant.socket.emit("lobby:microphone", { ready: true });
			participant.socket.emit("lobby:ready", { ready: true });
		}
		await waitForState(
			host.socket,
			(state) =>
				state.players.length === 2 &&
				state.players.every((player) => player.ready && player.micReady),
		);

		const guestStart = await request<null>((ack) =>
			guest.socket.emit("lobby:start", ack),
		);
		expect(guestStart).toMatchObject({
			ok: false,
			error: { code: "not-host" },
		});

		let strangerInit = false;
		stranger.socket.on("game:init", () => {
			strangerInit = true;
		});
		const hostInit = waitFor(host.socket, "game:init");
		const guestInit = waitFor(guest.socket, "game:init");
		const started = await request<null>((ack) =>
			host.socket.emit("lobby:start", ack),
		);
		expect(started.ok).toBe(true);
		const [initA, initB] = (await Promise.all([hostInit, guestInit])) as [
			MatchInit,
			MatchInit,
		];
		expect(initA.matchId).toBe(initB.matchId);
		expect(initA.layoutChecksum).toBe(initB.layoutChecksum);
		expect(initA.config.simultaneousAnomalies).toBe(10);

		const beginA = waitFor(host.socket, "game:begin");
		const snapshot = waitFor(guest.socket, "game:snapshot");
		host.socket.emit("game:loaded", {
			matchId: initA.matchId,
			layoutChecksum: initA.layoutChecksum,
		});
		guest.socket.emit("game:loaded", {
			matchId: initB.matchId,
			layoutChecksum: initB.layoutChecksum,
		});
		const begin = await beginA;
		expect(begin.matchId).toBe(initA.matchId);
		expect(begin.endsAt - begin.startedAt).toBe(480_000);
		const firstSnapshot = await snapshot;
		expect(firstSnapshot.players).toHaveLength(2);
		expect(firstSnapshot.anomalies).toHaveLength(0);
		expect(strangerInit).toBe(false);

		const layoutReply = waitFor(guest.socket, "game:layout");
		guest.socket.emit("game:layoutRequest", { matchId: initB.matchId });
		const layout = await layoutReply;
		expect(layout.matchId).toBe(initB.matchId);
		expect(JSON.parse(layout.layoutJson).rooms.length).toBeGreaterThan(5);

		const busy = await request<LobbyState>((ack) =>
			stranger.socket.emit(
				"lobby:joinPrivate",
				{ name: "Passant", code: lobby.code as string },
				ack,
			),
		);
		expect(busy).toMatchObject({ ok: false, error: { code: "in-progress" } });
	}, 60_000);

	it("regroupe les joueurs publics dans le même lobby jusqu'à quatre", async () => {
		const players = await Promise.all([
			client(),
			client(),
			client(),
			client(),
			client(),
		]);
		const states: LobbyState[] = [];
		for (const [index, player] of players.entries()) {
			const result = await request<LobbyState>((ack) =>
				player.socket.emit(
					"lobby:quickJoin",
					{ name: `Public ${index + 1}` },
					ack,
				),
			);
			expect(result.ok).toBe(true);
			states.push((result as { value: LobbyState }).value);
		}
		const ids = states.map((state) => state.id);
		const counts = new Map<string, number>();
		for (const id of ids) {
			counts.set(id, (counts.get(id) ?? 0) + 1);
		}
		expect(Math.max(...counts.values())).toBeLessThanOrEqual(4);
		expect(counts.size).toBeGreaterThanOrEqual(2);
		for (const state of states) {
			expect(state.configEditable).toBe(false);
		}
	});

	it("attribue la couleur choisie, ou une autre si elle est déjà prise", async () => {
		const first = await client();
		const second = await client();
		const third = await client();
		const created = (await request<LobbyState>((ack) =>
			first.socket.emit(
				"lobby:createPrivate",
				{ name: "Bleu", color: 0x3f7fd6 },
				ack,
			),
		)) as { value: LobbyState };
		const code = created.value.code as string;
		expect(created.value.players[0].color).toBe(0x3f7fd6);
		const clash = (await request<LobbyState>((ack) =>
			second.socket.emit(
				"lobby:joinPrivate",
				{ name: "Aussi bleu", code, color: 0x3f7fd6 },
				ack,
			),
		)) as { value: LobbyState };
		const secondColor = clash.value.players.find(
			(player) => player.id === second.session.playerId,
		)?.color;
		expect(secondColor).not.toBe(0x3f7fd6);
		const invalid = (await request<LobbyState>((ack) =>
			third.socket.emit(
				"lobby:joinPrivate",
				{ name: "Fluo", code, color: 0x123456 },
				ack,
			),
		)) as { value: LobbyState };
		const colors = invalid.value.players.map((player) => player.color);
		expect(new Set(colors).size).toBe(3);
		expect(colors).not.toContain(0x123456);
	});

	it("transmet le motif du chapeau choisi, ou le motif par défaut s'il est inconnu", async () => {
		const first = await client();
		const created = await request<LobbyState>((ack) =>
			first.socket.emit(
				"lobby:createPrivate",
				{ name: "Étoilé", pattern: "stars" },
				ack,
			),
		);
		expect(created.ok && created.value.players[0].pattern).toBe("stars");
		const code = created.ok ? (created.value.code as string) : "";
		const second = await client();
		const joined = await request<LobbyState>((ack) =>
			second.socket.emit(
				"lobby:joinPrivate",
				{ name: "Inconnu", code, pattern: "licorne" as never },
				ack,
			),
		);
		expect(
			joined.ok && joined.value.players.map((player) => player.pattern),
		).toEqual(["stars", "spots"]);
	});

	it("refuse un pseudonyme invalide", async () => {
		const player = await client();
		const result = await request<LobbyState>((ack) =>
			player.socket.emit("lobby:quickJoin", { name: " " }, ack),
		);
		expect(result).toMatchObject({
			ok: false,
			error: { code: "invalid-name" },
		});
	});

	it("relaie la signalisation vocale uniquement entre membres du même lobby", async () => {
		const a = await client();
		const b = await client();
		const outsider = await client();
		const created = (await request<LobbyState>((ack) =>
			a.socket.emit("lobby:createPrivate", { name: "Voix A" }, ack),
		)) as { value: LobbyState };
		await request<LobbyState>((ack) =>
			b.socket.emit(
				"lobby:joinPrivate",
				{ name: "Voix B", code: created.value.code as string },
				ack,
			),
		);
		await request<LobbyState>((ack) =>
			outsider.socket.emit("lobby:createPrivate", { name: "Ailleurs" }, ack),
		);
		const received = waitFor(b.socket, "voice:signal", 3000);
		a.socket.emit("voice:signal", {
			peerId: b.session.playerId,
			signal: { kind: "offer", sdp: "v=0" },
		});
		const envelope = await received;
		expect(envelope.peerId).toBe(a.session.playerId);
		let leaked = false;
		outsider.socket.on("voice:signal", () => {
			leaked = true;
		});
		a.socket.emit("voice:signal", {
			peerId: outsider.session.playerId,
			signal: { kind: "offer", sdp: "v=0" },
		});
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(leaked).toBe(false);
	});
});

describe("nombre minimal de joueurs", () => {
	async function readyAlone(port?: number) {
		const host = await client(port);
		const created = await request<LobbyState>((ack) =>
			host.socket.emit("lobby:createPrivate", { name: "Solitaire" }, ack),
		);
		expect(created.ok).toBe(true);
		host.socket.emit("lobby:microphone", { ready: true });
		host.socket.emit("lobby:ready", { ready: true });
		const state = await waitForState(host.socket, (current) =>
			current.players.every((player) => player.ready && player.micReady),
		);
		return { host, state };
	}

	it("refuse de lancer une partie en solo hors mode DEV", async () => {
		const { host, state } = await readyAlone();
		expect(state.minPlayers).toBe(2);
		const start = await request<null>((ack) =>
			host.socket.emit("lobby:start", ack),
		);
		expect(start).toMatchObject({
			ok: false,
			error: { code: "not-enough-players" },
		});
	});

	it("autorise une partie en solo quand DEV vaut true", async () => {
		const devServer = await startServer({ port: 0, dev: true, database: null });
		try {
			const { host, state } = await readyAlone(devServer.port);
			expect(state.minPlayers).toBe(1);
			const init = waitFor(host.socket, "game:init");
			const start = await request<null>((ack) =>
				host.socket.emit("lobby:start", ack),
			);
			expect(start.ok).toBe(true);
			expect((await init).players).toHaveLength(1);
			host.socket.disconnect();
		} finally {
			await devServer.close();
		}
	});

	it("lance le tutoriel en solo, sans lobby à attendre ni points enregistrés", async () => {
		const { socket } = await client();
		const init = waitFor(socket, "game:init");
		const response = await request<LobbyState>((ack) =>
			socket.emit("lobby:startTutorial", { name: "Amanite" }, ack),
		);
		expect(response.ok).toBe(true);
		const match = await init;
		expect(match.tutorial).toBe(true);
		expect(match.roster).toHaveLength(1);
		expect(match.roster[0].species).toBe("murmure");
		expect(match.roster[0].occult).not.toBeNull();
		socket.emit("game:leave");
	});
});
