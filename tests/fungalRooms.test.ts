import { describe, expect, it } from "vitest";
import { generateManor } from "../shared/manor/generateManor.js";
import { ROOM_BLUEPRINTS, ROOM_TYPE_IDS } from "../shared/manor/rooms/index.js";
import type { RoomType } from "../shared/manor/types.js";
import { PUBLIC_MATCH_CONFIG } from "../shared/matchConfig.js";

const SIGNATURES: Partial<Record<RoomType, readonly string[]>> = {
	mushroomCellar: ["mushroomBed", "giantMushroom", "mushroomPatch"],
	fungalGreenhouse: ["giantMushroom", "mushroomPatch"],
	mycologyLab: ["alchemyTable", "specimenFrame", "displayCase"],
	fairyRing: ["mushroomRing", "runeStone", "fairyPortal"],
	collapsedWing: ["rubblePile", "fallenBeam", "floorDebris"],
	ruinedChapel: ["pew", "brokenColumn", "rubblePile"],
	crystalGrotto: ["crystalCluster", "floatingCrystal"],
	enchantedLibrary: ["bookcase", "floatingBooks"],
};

const NEW_ROOMS = Object.keys(SIGNATURES) as RoomType[];
const SEEDS = Array.from({ length: 40 }, (_, index) => (index + 1) * 7919);

const layouts = SEEDS.map((seed) =>
	generateManor(seed, { ...PUBLIC_MATCH_CONFIG, floors: 2, pickupTotal: 0 }),
);

describe("salles fongiques, ruines et féeriques", () => {
	it("sont toutes enregistrées avec un nom anglais par nom français", () => {
		for (const type of NEW_ROOMS) {
			const blueprint = ROOM_BLUEPRINTS[type];

			expect(ROOM_TYPE_IDS).toContain(type);

			expect(blueprint.englishNames.length).toBe(
				blueprint.catalog.names.length,
			);
		}
	});

	it("apparaissent dans les manoirs générés", () => {
		const seen = new Set(
			layouts.flatMap((layout) => layout.rooms.map((room) => room.type)),
		);

		for (const type of NEW_ROOMS) {
			expect(seen.has(type), type).toBe(true);
		}
	});

	it("reçoivent leur mobilier caractéristique", () => {
		for (const type of NEW_ROOMS) {
			const signature = SIGNATURES[type] ?? [];

			const furnished = layouts.flatMap((layout) =>
				layout.rooms
					.filter((room) => room.type === type)
					.map((room) =>
						layout.furniture
							.filter((item) => item.roomId === room.id)
							.map((item) => item.kind),
					),
			);

			const withSignature = furnished.filter((kinds) =>
				kinds.some((kind) => signature.includes(kind)),
			);

			expect(furnished.length, type).toBeGreaterThan(0);

			expect(withSignature.length / furnished.length, type).toBeGreaterThan(
				0.7,
			);
		}
	});
});
