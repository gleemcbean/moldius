import { afterEach, describe, expect, it } from "vitest";
import { LobbyManager } from "../server/lobby/LobbyManager.js";
import {
	type Session,
	SessionRegistry,
} from "../server/sessions/SessionRegistry.js";

const fakeIo = {
	sockets: { sockets: new Map() },
	to: () => ({ emit: () => true, volatile: { emit: () => true } }),
} as unknown as ConstructorParameters<typeof LobbyManager>[0];

const managers: LobbyManager[] = [];

function setup(dev: boolean) {
	const sessions = new SessionRegistry();
	const lobbies = new LobbyManager(fakeIo, sessions, () => 0, {
		minPlayers: 2,
		dev,
	});
	managers.push(lobbies);
	const tab = (socketId: string, accountId: string | null): Session => {
		const session = sessions.hello(socketId, null);
		session.account = accountId
			? { accountId, tokenHash: `h-${socketId}` }
			: null;
		return session;
	};
	return { sessions, lobbies, tab };
}

afterEach(() => {
	for (const manager of managers.splice(0)) {
		manager.dispose();
	}
});

describe("un compte, une seule partie", () => {
	it("refuse qu'un compte rejoigne une seconde partie depuis un autre onglet", () => {
		const { lobbies, tab } = setup(false);
		const first = tab("s1", "acc-1");
		const created = lobbies.createPrivate(first, "Amanite");
		expect(created.ok).toBe(true);
		const code = created.ok ? (created.value.code as string) : "";
		const second = tab("s2", "acc-1");
		for (const result of [
			lobbies.joinPrivate(second, "Bolet", code),
			lobbies.quickJoin(second, "Bolet"),
			lobbies.createPrivate(second, "Bolet"),
		]) {
			expect(result).toMatchObject({
				ok: false,
				error: { code: "already-playing" },
			});
		}
		expect(second.lobbyId).toBeNull();
		const other = tab("s3", "acc-2");
		expect(lobbies.joinPrivate(other, "Morille", code).ok).toBe(true);
		const guest = tab("s4", null);
		expect(lobbies.joinPrivate(guest, "Girolle", code).ok).toBe(true);
	});

	it("laisse la place au nouvel onglet quand l'ancien est déconnecté", () => {
		const { sessions, lobbies, tab } = setup(false);
		const first = tab("s1", "acc-1");
		const created = lobbies.createPrivate(first, "Amanite");
		const code = created.ok ? (created.value.code as string) : "";
		sessions.detach("s1", 0);
		const second = tab("s2", "acc-1");
		expect(lobbies.joinPrivate(second, "Amanite", code).ok).toBe(false);
		expect(first.lobbyId).toBeNull();
		expect(lobbies.quickJoin(second, "Amanite").ok).toBe(true);
	});

	it("autorise plusieurs onglets du même compte en mode DEV", () => {
		const { lobbies, tab } = setup(true);
		const first = tab("s1", "acc-1");
		const created = lobbies.createPrivate(first, "Amanite");
		const code = created.ok ? (created.value.code as string) : "";
		expect(lobbies.joinPrivate(tab("s2", "acc-1"), "Bolet", code).ok).toBe(
			true,
		);
	});
});
