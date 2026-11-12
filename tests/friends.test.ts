import { io, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	summarizeDays,
	summarizePresence,
} from "../server/accounts/adminStats.js";
import type { Database } from "../server/accounts/database.js";
import {
	createSessionToken,
	hashSessionToken,
} from "../server/accounts/tokens.js";
import { type RunningServer, startServer } from "../server/index.js";
import type {
	ClientToServerEvents,
	ServerToClientEvents,
} from "../shared/protocol/events.js";
import type {
	FriendInvite,
	FriendsOverview,
	PublicLobbyPreview,
} from "../shared/protocol/friends.js";
import type { LobbyState } from "../shared/protocol/lobby.js";
import { createTestDatabase } from "./helpers/testDatabase.js";

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const COOKIE = "mycelium_session";

describe("amis, invitations et admin", () => {
	let server: RunningServer;
	let database: Database;
	const clients: Client[] = [];

	beforeEach(async () => {
		database = await createTestDatabase();
		server = await startServer({
			port: 0,
			dev: true,
			database,
			cookieSecure: false,
			mailer: null,
			adminEmails: ["admin@moldius.test"],
		});
	});

	afterEach(async () => {
		for (const client of clients.splice(0)) {
			client.disconnect();
		}
		await server.close();
	});

	let counter = 0;
	async function createAccount(
		name: string,
		email = `${name.toLowerCase()}@moldius.test`,
	): Promise<{ id: string; cookie: string }> {
		counter += 1;
		const id = `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
		const token = createSessionToken();
		const now = new Date();
		await database.query(
			`INSERT INTO accounts (id, email, email_key, email_verified_at, display_name,
         hat_color, created_at, updated_at, last_login_at)
       VALUES ($1, $2, $2, $3, $4, 16711680, $3, $3, $3)`,
			[id, email, now, name],
		);
		await database.query(
			`INSERT INTO auth_sessions (token_hash, account_id, created_at, last_used_at, expires_at)
       VALUES ($1, $2, $3, $3, $4)`,
			[hashSessionToken(token), id, now, new Date(now.getTime() + 3_600_000)],
		);
		return { id, cookie: `${COOKIE}=${token}` };
	}

	async function connect(cookie?: string): Promise<Client> {
		const client: Client = io(`http://127.0.0.1:${server.port}`, {
			transports: ["websocket"],
			forceNew: true,
			...(cookie ? { extraHeaders: { Cookie: cookie } } : {}),
		});
		clients.push(client);
		await new Promise<void>((resolve) => {
			client.on("connect", () =>
				client.emit("session:hello", { sessionToken: null }, () => resolve()),
			);
		});
		return client;
	}

	type Reply<T> =
		| { ok: true; value: T }
		| { ok: false; error: { code: string } };

	const list = (client: Client) =>
		new Promise<Reply<FriendsOverview>>((resolve) =>
			client.emit("friends:list", resolve),
		);
	const add = (client: Client, code: string) =>
		new Promise<Reply<FriendsOverview>>((resolve) =>
			client.emit("friends:add", { code }, resolve),
		);
	const accept = (client: Client, accountId: string, value = true) =>
		new Promise<Reply<FriendsOverview>>((resolve) =>
			client.emit("friends:respond", { accountId, accept: value }, resolve),
		);
	const invite = (client: Client, accountId: string) =>
		new Promise<Reply<null>>((resolve) =>
			client.emit("friends:invite", { accountId }, resolve),
		);
	const value = <T>(reply: Reply<T>): T => {
		if (!reply.ok) {
			throw new Error(reply.error.code);
		}
		return reply.value;
	};
	const code = (reply: Reply<unknown>) => (reply.ok ? null : reply.error.code);

	async function befriend() {
		const alice = await createAccount("Alice");
		const bob = await createAccount("Bob");
		const aliceSocket = await connect(alice.cookie);
		const bobSocket = await connect(bob.cookie);
		const bobCode = value(await list(bobSocket)).friendCode;
		value(await add(aliceSocket, bobCode));
		value(await accept(bobSocket, alice.id));
		return { alice, bob, aliceSocket, bobSocket };
	}

	it("refuse les amis aux invités", async () => {
		const guest = await connect();
		expect(code(await list(guest))).toBe("sign-in-required");
	});

	it("gère demande, acceptation et statut en ligne", async () => {
		const alice = await createAccount("Alice");
		const bob = await createAccount("Bob");
		const aliceSocket = await connect(alice.cookie);
		const bobSocket = await connect(bob.cookie);
		const bobView = value(await list(bobSocket));
		expect(bobView.friendCode).toMatch(/^[A-Z2-9]{8}$/);
		expect(code(await add(bobSocket, bobView.friendCode))).toBe("friend-self");
		expect(code(await add(aliceSocket, "ZZZZZZZZ"))).toBe("friend-not-found");

		const changed = new Promise<void>((resolve) =>
			bobSocket.once("friends:changed", () => resolve()),
		);
		const sent = value(await add(aliceSocket, bobView.friendCode));
		expect(sent.outgoing.map((person) => person.name)).toEqual(["Bob"]);
		await changed;
		expect(code(await add(aliceSocket, bobView.friendCode))).toBe(
			"friend-exists",
		);

		const received = value(await list(bobSocket));
		expect(received.incoming.map((person) => person.name)).toEqual(["Alice"]);
		value(await accept(aliceSocket, bob.id));
		expect(value(await list(aliceSocket)).friends).toEqual([]);

		const accepted = value(await accept(bobSocket, alice.id));
		expect(accepted.friends[0]).toMatchObject({
			name: "Alice",
			status: "online",
		});

		const gone = new Promise<void>((resolve) =>
			aliceSocket.once("friends:changed", () => resolve()),
		);
		bobSocket.disconnect();
		await gone;
		expect(value(await list(aliceSocket)).friends[0].status).toBe("offline");
	});

	it("le mode hors ligne masque le joueur et refuse ses invitations", async () => {
		const { bob, aliceSocket, bobSocket } = await befriend();
		await new Promise((resolve) =>
			aliceSocket.emit("lobby:createPrivate", { name: "Alice" }, resolve),
		);
		const changed = new Promise<void>((resolve) =>
			aliceSocket.once("friends:changed", () => resolve()),
		);
		const mine = await new Promise<Reply<FriendsOverview>>((resolve) =>
			bobSocket.emit("friends:setOffline", { offline: true }, resolve),
		);
		expect(value(mine).appearOffline).toBe(true);
		await changed;
		expect(value(await list(aliceSocket)).friends[0].status).toBe("offline");
		expect(code(await invite(aliceSocket, bob.id))).toBe("friend-offline");
	});

	it("invite un ami dans un lobby privé ou public", async () => {
		const { bob, aliceSocket, bobSocket } = await befriend();
		expect(code(await invite(aliceSocket, bob.id))).toBe("lobby-not-invitable");

		await new Promise((resolve) =>
			aliceSocket.emit("lobby:createPrivate", { name: "Alice" }, resolve),
		);
		const received = new Promise<FriendInvite>((resolve) =>
			bobSocket.once("friends:invited", resolve),
		);
		value(await invite(aliceSocket, bob.id));
		const privateInvite = await received;
		expect(privateInvite.fromName).toBe("Alice");
		expect(privateInvite.code).toBeTruthy();

		aliceSocket.emit("lobby:leave");
		await new Promise((resolve) =>
			aliceSocket.emit("lobby:quickJoin", { name: "Alice" }, resolve),
		);
		const publicReceived = new Promise<FriendInvite>((resolve) =>
			bobSocket.once("friends:invited", resolve),
		);
		value(await invite(aliceSocket, bob.id));
		const publicInvite = await publicReceived;
		expect(publicInvite.code).toBeNull();
		const joined = await new Promise<Reply<{ id: string }>>((resolve) =>
			bobSocket.emit(
				"lobby:joinPublic",
				{ name: "Bob", lobbyId: publicInvite.lobbyId },
				resolve,
			),
		);
		expect(value(joined).id).toBe(publicInvite.lobbyId);
		expect(code(await invite(aliceSocket, bob.id))).toBe("friend-busy");
	});

	it("n'invite que de vrais amis", async () => {
		const alice = await createAccount("Alice");
		const carol = await createAccount("Carol");
		const aliceSocket = await connect(alice.cookie);
		await connect(carol.cookie);
		await new Promise((resolve) =>
			aliceSocket.emit("lobby:createPrivate", { name: "Alice" }, resolve),
		);
		expect(code(await invite(aliceSocket, carol.id))).toBe("friend-not-found");
	});

	const linkDiscord = (accountId: string, discordId: string) =>
		database.query("UPDATE accounts SET discord_id = $2 WHERE id = $1", [
			accountId,
			discordId,
		]);
	const discordSync = (
		client: Client,
		discordId: string,
		friendIds: string[],
	) =>
		new Promise<Reply<FriendsOverview>>((resolve) =>
			client.emit("friends:discordSync", { discordId, friendIds }, resolve),
		);
	const createPrivate = (client: Client, name: string) =>
		new Promise<Reply<LobbyState>>((resolve) =>
			client.emit("lobby:createPrivate", { name }, resolve),
		);
	const openToFriends = (client: Client, open: boolean) =>
		new Promise<Reply<LobbyState>>((resolve) =>
			client.emit("lobby:openToFriends", { open }, resolve),
		);
	const joinFriend = (client: Client, name: string, lobbyId: string) =>
		new Promise<Reply<LobbyState>>((resolve) =>
			client.emit("lobby:joinFriend", { name, lobbyId }, resolve),
		);

	it("ne lie les amis Discord que si chacun a déclaré l'autre", async () => {
		const alice = await createAccount("Alice");
		const bob = await createAccount("Bob");
		const carol = await createAccount("Carol");
		await linkDiscord(alice.id, "100000000000000001");
		await linkDiscord(bob.id, "100000000000000002");
		const aliceSocket = await connect(alice.cookie);
		const bobSocket = await connect(bob.cookie);
		const carolSocket = await connect(carol.cookie);

		expect(code(await discordSync(carolSocket, "100000000000000003", []))).toBe(
			"discord-not-linked",
		);
		expect(code(await discordSync(aliceSocket, "100000000000000009", []))).toBe(
			"discord-mismatch",
		);

		const first = value(
			await discordSync(aliceSocket, "100000000000000001", [
				"100000000000000002",
				"100000000000000002",
				"pas-un-id",
			]),
		);
		expect(first.discordSynced).toBe(true);
		expect(first.friends).toEqual([]);

		const changed = new Promise<void>((resolve) =>
			aliceSocket.once("friends:changed", () => resolve()),
		);
		const second = value(
			await discordSync(bobSocket, "100000000000000002", [
				"100000000000000001",
			]),
		);
		await changed;
		expect(second.friends).toHaveLength(1);
		expect(second.friends[0]).toMatchObject({
			accountId: alice.id,
			discord: true,
			codeFriend: false,
			discordId: "100000000000000001",
			status: "online",
		});
		expect(value(await list(aliceSocket)).friends[0].accountId).toBe(bob.id);

		value(
			await new Promise<Reply<FriendsOverview>>((resolve) =>
				aliceSocket.emit("friends:remove", { accountId: bob.id }, resolve),
			),
		);
		expect(value(await list(aliceSocket)).friends).toHaveLength(1);
		value(await discordSync(bobSocket, "100000000000000002", []));
		expect(value(await list(aliceSocket)).friends).toEqual([]);
	});

	it("ouvre un lobby privé aux seuls amis de l'hôte", async () => {
		const { alice, aliceSocket, bobSocket } = await befriend();
		const carol = await createAccount("Carol");
		const carolSocket = await connect(carol.cookie);
		const guest = await connect();

		const lobby = value(await createPrivate(aliceSocket, "Alice"));
		expect(lobby.openToFriends).toBe(false);
		const bobView = value(await list(bobSocket));
		expect(bobView.friends[0]).toMatchObject({
			accountId: alice.id,
			status: "lobby",
			lobbyId: null,
		});
		expect(code(await joinFriend(bobSocket, "Bob", lobby.id))).toBe(
			"lobby-friends-only",
		);

		expect(value(await openToFriends(aliceSocket, true)).openToFriends).toBe(
			true,
		);
		expect(value(await list(bobSocket)).friends[0].lobbyId).toBe(lobby.id);
		expect(code(await joinFriend(carolSocket, "Carol", lobby.id))).toBe(
			"lobby-friends-only",
		);
		expect(code(await joinFriend(guest, "Invité", lobby.id))).toBe(
			"sign-in-required",
		);
		const joined = value(await joinFriend(bobSocket, "Bob", lobby.id));
		expect(joined.players.map((player) => player.name)).toEqual([
			"Alice",
			"Bob",
		]);
		expect(code(await openToFriends(bobSocket, false))).toBe("not-host");
		expect(value(await list(bobSocket)).friends[0].lobbyId).toBeNull();
	});

	it("laisse rejoindre le lobby public d'un ami sans condition", async () => {
		const { bobSocket } = await befriend();
		const stranger = await connect();
		const lobby = value(
			await new Promise<Reply<LobbyState>>((resolve) =>
				bobSocket.emit("lobby:quickJoin", { name: "Bob" }, resolve),
			),
		);
		expect(code(await openToFriends(bobSocket, true))).toBe("not-private");
		expect(value(await joinFriend(stranger, "Zoé", lobby.id)).id).toBe(
			lobby.id,
		);
		expect(code(await joinFriend(stranger, "Zoé", "l_inconnu"))).toBe(
			"not-found",
		);
	});

	it("montre le lobby public à tout le monde", async () => {
		const peek = (client: Client) =>
			new Promise<Reply<PublicLobbyPreview>>((resolve) =>
				client.emit("lobby:peekPublic", resolve),
			);
		const guest = await connect();
		expect(value(await peek(guest)).players).toEqual([]);
		const player = await connect();
		await new Promise((resolve) =>
			player.emit("lobby:quickJoin", { name: "Zoé" }, resolve),
		);
		const preview = value(await peek(guest));
		expect(preview.players.map((entry) => entry.name)).toEqual(["Zoé"]);
		expect(preview.capacity).toBe(4);
		await new Promise((resolve) =>
			player.emit("lobby:createPrivate", { name: "Zoé" }, resolve),
		);
		expect(value(await peek(guest)).players).toEqual([]);
	});

	describe("panel admin", () => {
		const overview = (cookie?: string) =>
			fetch(`http://127.0.0.1:${server.port}/api/admin/overview`, {
				headers: cookie ? { Cookie: cookie } : {},
			});

		it("répond 404 à tout sauf l'admin vérifié", async () => {
			expect((await overview()).status).toBe(404);
			const player = await createAccount("Bob");
			expect((await overview(player.cookie)).status).toBe(404);
			const unverified = await createAccount("Faux", "admin2@moldius.test");
			expect((await overview(unverified.cookie)).status).toBe(404);
			const admin = await createAccount("Patron", "admin@moldius.test");
			await database.query(
				"UPDATE accounts SET email_verified_at = NULL WHERE id = $1",
				[admin.id],
			);
			expect((await overview(admin.cookie)).status).toBe(404);
		});

		it("donne comptes, parties et présence sans e-mail", async () => {
			const admin = await createAccount("Patron", "admin@moldius.test");
			const player = await createAccount("Bob");
			const now = new Date();
			await database.query(
				`INSERT INTO match_history (id, account_id, match_id, played_at, duration_ms, visibility,
           player_name, color, rank, player_count, score, captures, deaths, won)
         VALUES ('00000000-0000-4000-8000-999999999999', $1, 'm1', $2, 600000, 'public', 'Bob', 1, 1, 3, 10, 0, 0, true)`,
				[player.id, now],
			);
			await database.query(
				"INSERT INTO presence_samples (sampled_at, connected, signed_in, in_match) VALUES ($1, 7, 2, 1)",
				[now],
			);
			await connect(player.cookie);
			const response = await overview(admin.cookie);
			expect(response.status).toBe(200);
			expect(response.headers.get("cache-control")).toBe("no-store");
			const text = await response.text();
			expect(text).not.toContain("@moldius.test");
			const body = JSON.parse(text);
			expect(body.totals.accounts).toBe(2);
			expect(body.totals.matches).toBe(1);
			expect(body.totals.averagePlayers).toBe(3);
			expect(body.presence.samples).toBe(1);
			expect(body.presence.peak.connected).toBe(7);
			expect(body.live.signedIn).toBe(1);
			const bob = body.players.find(
				(entry: { name: string }) => entry.name === "Bob",
			);
			expect(bob).toMatchObject({ online: true, playtimeMs: 600000 });
			expect(bob.lastMatchAt).toBe(now.toISOString());
			expect(body.daily).toHaveLength(30);
			expect(body.daily.at(-1).matches).toBe(1);
		});
	});

	it("regroupe la présence à l'heure de Paris", () => {
		const summary = summarizePresence([
			{ at: new Date("2025-01-06T20:30:00Z"), connected: 4 },
			{ at: new Date("2025-01-06T20:35:00Z"), connected: 8 },
			{ at: new Date("2025-01-07T03:00:00Z"), connected: 1 },
		]);
		expect(summary.byHour[21]).toEqual({ hour: 21, average: 6, peak: 8 });
		expect(summary.heatmap[0][21]).toBe(6);
		expect(summary.bestSlot).toEqual({ weekday: 0, hour: 21, average: 6 });
		expect(summary.peak?.connected).toBe(8);
		const summer = summarizePresence([
			{ at: new Date("2025-07-07T20:00:00Z"), connected: 2 },
		]);
		expect(summer.byHour[22].average).toBe(2);
	});

	it("compte chaque partie une seule fois par jour", () => {
		const now = new Date("2025-03-10T12:00:00Z");
		const days = summarizeDays(
			now,
			[
				{ matchId: "a", at: now },
				{ matchId: "a", at: now },
				{ matchId: "b", at: now },
			],
			[now, new Date("2020-01-01T00:00:00Z")],
			3,
		);
		expect(days.map((day) => day.date)).toEqual([
			"2025-03-08",
			"2025-03-09",
			"2025-03-10",
		]);
		expect(days[2]).toEqual({
			date: "2025-03-10",
			matches: 2,
			registrations: 1,
		});
	});
});
