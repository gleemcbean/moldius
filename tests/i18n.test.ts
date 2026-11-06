import { describe, expect, it } from "vitest";
import { SPECIES_IDS } from "../shared/config/species.js";
import { FURNITURE } from "../shared/manor/furnitureCatalog.js";
import { ROOM_TYPES } from "../shared/manor/roomCatalog.js";
import type { RoomType } from "../shared/manor/types.js";

type Tree = Record<string, unknown>;

const SECTIONS: [string, string, string][] = [
	["common", "commonFr", "commonEn"],
	["home", "homeFr", "homeEn"],
	["home", "appearanceFr", "appearanceEn"],
	["lobby", "lobbyFr", "lobbyEn"],
	["settings", "settingsFr", "settingsEn"],
	["account", "accountFr", "accountEn"],
	["friends", "friendsFr", "friendsEn"],
	["game", "gameFr", "gameEn"],
	["grimoire", "grimoireFr", "grimoireEn"],
	["world", "worldFr", "worldEn"],
];

async function section(file: string): Promise<Tree> {
	return (await import(`../src/i18n/sections/${file}.ts`)) as Tree;
}

function differences(
	french: unknown,
	english: unknown,
	path: string,
): string[] {
	if (typeof french === "function" || typeof english === "function") {
		return typeof french === typeof english ? [] : [path];
	}
	if (Array.isArray(french) || Array.isArray(english)) {
		return Array.isArray(french) &&
			Array.isArray(english) &&
			french.length === english.length
			? []
			: [path];
	}
	if (typeof french === "object" && french !== null) {
		if (typeof english !== "object" || english === null) {
			return [path];
		}
		const keys = new Set([...Object.keys(french), ...Object.keys(english)]);
		return [...keys].flatMap((key) =>
			differences(
				(french as Tree)[key],
				(english as Tree)[key],
				`${path}.${key}`,
			),
		);
	}
	return typeof french === "string" &&
		typeof english === "string" &&
		english.length > 0
		? []
		: [path];
}

describe("traductions", () => {
	it("fournit chaque texte français en anglais", async () => {
		for (const [file, french, english] of SECTIONS) {
			const module = await section(file);
			expect(differences(module[french], module[english], french)).toEqual([]);
		}
	});

	it("traduit chaque nom de salle, espèce et cachette", async () => {
		const world = (await section("world")) as {
			worldEn: {
				rooms: Record<RoomType, string[]>;
				furniture: Record<string, string>;
			};
			HIDEABLE_KINDS: readonly string[];
		};
		for (const type of Object.keys(ROOM_TYPES) as RoomType[]) {
			expect(world.worldEn.rooms[type]).toHaveLength(
				ROOM_TYPES[type].names.length,
			);
		}
		const hideable = Object.values(FURNITURE)
			.filter((entry) => entry.hideable)
			.map((entry) => entry.kind);
		expect([...world.HIDEABLE_KINDS].sort()).toEqual(hideable.sort());
		const grimoire = (await section("grimoire")) as {
			grimoireEn: { species: Record<string, { name: string }> };
		};
		expect(Object.keys(grimoire.grimoireEn.species).sort()).toEqual(
			[...SPECIES_IDS].sort(),
		);
	});
});
