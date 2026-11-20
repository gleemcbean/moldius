import { describe, expect, it } from "vitest";
import { furnitureDefinition } from "../shared/manor/furnitureCatalog.js";
import { generateManor } from "../shared/manor/generateManor.js";
import type { FurnitureItem, Room } from "../shared/manor/types.js";
import { PUBLIC_MATCH_CONFIG } from "../shared/matchConfig.js";
import { SeededRandom } from "../shared/random.js";

interface BuiltPart {
	geometry: {
		getAttribute: (name: string) => { count: number; array: ArrayLike<number> };
	};
	material: Record<string, unknown>;
}

type Builder = (context: {
	item: FurnitureItem;
	room: Room;
	rng: SeededRandom;
}) => BuiltPart[];

const furnitureRoot = "../scripts/models/furniture";

const { FURNITURE_BUILDERS } = (await import(`${furnitureRoot}/index.ts`)) as {
	FURNITURE_BUILDERS: Record<string, Builder>;
};

const layout = generateManor(7, { ...PUBLIC_MATCH_CONFIG, pickupTotal: 0 });
const room = layout.rooms[0];

function catalogued(kind: string): boolean {
	try {
		furnitureDefinition(kind);

		return true;
	} catch {
		return false;
	}
}

const kinds = Object.keys(FURNITURE_BUILDERS).filter(catalogued);

describe("modèles de meubles", () => {
	it.each(kinds)("%s ne produit que des sommets finis", (kind) => {
		const definition = furnitureDefinition(kind);

		for (const [variantIndex, variant] of definition.variants.entries()) {
			for (const seed of [3, 11, 29]) {
				const item: FurnitureItem = {
					id: 0,
					kind,
					variant: variantIndex,
					roomId: room.id,
					level: room.level,
					x: 0,
					y: room.floorY,
					z: 0,
					rotation: 0,
					width: variant.width,
					depth: variant.depth,
					height: variant.height,
					colliders: [],
					hideSpotId: null,
					valveId: null,
					parentId: null,
					seed,
				};

				const parts = FURNITURE_BUILDERS[kind]({
					item,
					room,
					rng: new SeededRandom(seed),
				});

				expect(parts.length).toBeGreaterThan(0);

				parts.forEach((piece, index) => {
					const position = piece.geometry.getAttribute("position");
					let finite = true;

					for (let value = 0; value < position.array.length; value += 1) {
						finite &&= Number.isFinite(position.array[value]);
					}

					expect(
						finite,
						`${kind} variante ${variantIndex} pièce ${index}`,
					).toBe(true);
				});
			}
		}
	});
});
