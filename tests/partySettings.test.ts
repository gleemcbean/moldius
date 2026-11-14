import { describe, expect, it } from "vitest";

type Keys = Record<string, string>;
const clientRoot = "../src";
const { DEFAULT_KEYS } = (await import(
	`${clientRoot}/config/defaultKeys.ts`
)) as { DEFAULT_KEYS: Keys };
const {
	assignFreshKeys,
	matchingStatsPreset,
	migratePingKey,
	statsMetrics,
	defaultStats,
} = (await import(`${clientRoot}/features/settings/settingsStore.ts`)) as {
	assignFreshKeys: (keys: Keys, saved: Partial<Keys> | undefined) => void;
	migratePingKey: (keys: Keys, revision: unknown) => void;
	matchingStatsPreset: (stats: unknown) => string | null;
	statsMetrics: (enabled: readonly string[]) => Record<string, boolean>;
	defaultStats: () => Record<string, unknown>;
};

function duplicates(keys: Keys): string[] {
	const codes = Object.values(keys);
	return codes.filter((code, index) => codes.indexOf(code) !== index);
}

describe("réglages entre amis", () => {
	it("attribue aux nouvelles actions des touches libres", () => {
		expect(duplicates({ ...DEFAULT_KEYS })).toEqual([]);
		const saved: Keys = { ...DEFAULT_KEYS, jump: "KeyQ", crouch: "KeyB" };
		delete saved.ping;
		delete saved.emote;
		delete saved.power;
		const keys: Keys = { ...DEFAULT_KEYS, jump: "KeyQ", crouch: "KeyB" };
		assignFreshKeys(keys, saved);
		expect(keys.jump).toBe("KeyQ");
		expect(keys.ping).not.toBe("KeyQ");
		expect(keys.emote).not.toBe("KeyB");
		expect(duplicates(keys)).toEqual([]);
	});

	it("signale au clic molette, y compris pour les anciens réglages", () => {
		expect(DEFAULT_KEYS.ping).toBe("MouseMiddle");
		const previous: Keys = { ...DEFAULT_KEYS, ping: "KeyQ" };
		migratePingKey(previous, 2);
		expect(previous.ping).toBe("MouseMiddle");
		const chosen: Keys = { ...DEFAULT_KEYS, ping: "KeyQ" };
		migratePingKey(chosen, 3);
		expect(chosen.ping).toBe("KeyQ");
		const busy: Keys = { ...DEFAULT_KEYS, ping: "KeyQ", photo: "MouseMiddle" };
		migratePingKey(busy, 2);
		expect(busy.ping).toBe("KeyQ");
	});

	it("reconnaît les préréglages de statistiques", () => {
		expect(matchingStatsPreset(defaultStats())).toBe("off");
		expect(
			matchingStatsPreset({
				...defaultStats(),
				metrics: statsMetrics(["fps", "ping"]),
			}),
		).toBe("minimal");
		expect(
			matchingStatsPreset({
				...defaultStats(),
				metrics: statsMetrics(["fps", "memory"]),
			}),
		).toBeNull();
	});
});
