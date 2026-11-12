import { describe, expect, it } from "vitest";

type ActionId = string;
type Keys = Record<ActionId, string>;
const clientRoot = "../src";
const { DEFAULT_KEYS } = (await import(
	`${clientRoot}/config/defaultKeys.ts`
)) as {
	DEFAULT_KEYS: Keys;
};
const { migrateAimKey } = (await import(
	`${clientRoot}/features/settings/settingsStore.ts`
)) as {
	migrateAimKey: (keys: Keys, saved: Partial<Keys> | undefined) => void;
};

function savedBeforeAim(overrides: Keys = {}): Keys {
	const saved: Keys = { ...DEFAULT_KEYS, photo: "MouseLeft", ...overrides };
	delete saved.aim;
	return saved;
}

function duplicates(keys: Keys): string[] {
	const codes = Object.values(keys);
	return codes.filter((code, index) => codes.indexOf(code) !== index);
}

describe("visée avec l'appareil photo", () => {
	it("vise au clic gauche et photographie au clic droit par défaut", () => {
		expect(DEFAULT_KEYS.aim).toBe("MouseLeft");
		expect(DEFAULT_KEYS.photo).toBe("MouseRight");
		expect(duplicates({ ...DEFAULT_KEYS })).toEqual([]);
	});

	it("passe la photo au clic droit dans d'anciens réglages", () => {
		const saved = savedBeforeAim();
		const keys: Keys = { ...DEFAULT_KEYS, ...saved };
		migrateAimKey(keys, saved);
		expect(keys.aim).toBe("MouseLeft");
		expect(keys.photo).toBe("MouseRight");
		expect(duplicates(keys)).toEqual([]);
	});

	it("garde une photo déplacée ailleurs par le joueur", () => {
		const saved = savedBeforeAim({ photo: "KeyP" });
		const keys: Keys = { ...DEFAULT_KEYS, ...saved };
		migrateAimKey(keys, saved);
		expect(keys.photo).toBe("KeyP");
		expect(keys.aim).toBe("MouseLeft");
	});

	it("trouve une touche libre quand les deux clics sont déjà pris", () => {
		const saved = savedBeforeAim({ interact: "MouseRight" });
		const keys: Keys = { ...DEFAULT_KEYS, ...saved };
		migrateAimKey(keys, saved);
		expect(keys.photo).toBe("MouseLeft");
		expect(keys.aim).toBe("MouseMiddle");
		expect(duplicates(keys)).toEqual([]);
	});

	it("ne touche pas des réglages qui connaissent déjà la visée", () => {
		const saved: Keys = { ...DEFAULT_KEYS, aim: "KeyQ", photo: "MouseLeft" };
		const keys: Keys = { ...saved };
		migrateAimKey(keys, saved);
		expect(keys).toEqual(saved);
	});
});
