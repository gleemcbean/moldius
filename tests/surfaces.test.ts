import { describe, expect, it } from "vitest";
import { SeededRandom } from "../shared/random.js";

interface Baked {
	width: number;
	height: number;
	albedo: Uint8Array;
	normal: Uint8Array;
	orm: Uint8Array;
}

interface Recipe {
	size: [number, number];
	tile: [number, number];
}

interface BlockHit {
	id: number;
	along: number;
	length: number;
	across: number;
	height: number;
}

interface HerringboneHit {
	id: number;
	horizontal: boolean;
	along: number;
	across: number;
	edge: number;
}

const surfaceRoot = "../scripts/textures/surface";

const recipes = (await import(`${surfaceRoot}/recipes.ts`)) as {
	FINE_RECIPES: Record<string, Recipe>;
	bakeRecipe: (key: string, detail: number) => Baked;
	fineSize: (recipe: Recipe, detail: number) => [number, number];
};
const layouts = (await import(`${surfaceRoot}/layouts.ts`)) as {
	courseLayout: (
		rng: SeededRandom,
		rows: number,
		blocks: number,
		options: Record<string, unknown>,
	) => { count: number };
	createBlockHit: () => BlockHit;
	locateBlock: (
		layout: unknown,
		u: number,
		v: number,
		hit: BlockHit,
	) => BlockHit;
	herringbone: (
		u: number,
		v: number,
		cells: number,
		ratio: number,
		hit: HerringboneHit,
	) => HerringboneHit;
};
const relief = (await import(`${surfaceRoot}/pixelRelief.ts`)) as {
	pixelNormals: (
		pixels: Uint8ClampedArray,
		width: number,
		height: number,
		strength: number,
	) => Uint8Array;
};

const DETAIL = 0.125;

describe("matières réalistes", () => {
	it.each(Object.keys(recipes.FINE_RECIPES))(
		"%s se cuit en cartes complètes",
		(key) => {
			const recipe = recipes.FINE_RECIPES[key];
			const baked = recipes.bakeRecipe(key, DETAIL);
			const [width, height] = recipes.fineSize(recipe, DETAIL);
			expect([baked.width, baked.height]).toEqual([width, height]);
			for (const layer of [baked.albedo, baked.normal, baked.orm]) {
				expect(layer.length).toBe(width * height * 4);
			}
			let outward = true;
			let lowest = 255;
			let highest = 0;
			for (let index = 0; index < baked.normal.length; index += 4) {
				outward &&= baked.normal[index + 2] >= 128;
				lowest = Math.min(lowest, baked.normal[index + 3]);
				highest = Math.max(highest, baked.normal[index + 3]);
			}
			expect(outward).toBe(true);
			expect(highest - lowest).toBeGreaterThan(4);
			const texelRatio =
				recipe.tile[0] / recipe.size[0] / (recipe.tile[1] / recipe.size[1]);
			expect(texelRatio).toBeGreaterThan(1 / 8);
			expect(texelRatio).toBeLessThan(8);
		},
	);

	it("produit toujours la même matière pour une même clé", () => {
		const first = recipes.bakeRecipe("brick", DETAIL);
		const second = recipes.bakeRecipe("brick", DETAIL);
		expect(Buffer.from(first.albedo).equals(Buffer.from(second.albedo))).toBe(
			true,
		);
		expect(Buffer.from(first.normal).equals(Buffer.from(second.normal))).toBe(
			true,
		);
	});
});

describe("agencements des surfaces", () => {
	it("chaque point d'une assise tombe dans un seul bloc", () => {
		const layout = layouts.courseLayout(new SeededRandom(9), 6, 4, {
			rowSpread: 0.2,
			lengthSpread: 0.3,
			stagger: "random",
		});
		const hit = layouts.createBlockHit();
		const random = new SeededRandom(3);
		for (let sample = 0; sample < 2000; sample += 1) {
			layouts.locateBlock(layout, random.next(), random.next(), hit);
			expect(hit.along).toBeGreaterThanOrEqual(0);
			expect(hit.along).toBeLessThanOrEqual(hit.length);
			expect(hit.across).toBeGreaterThanOrEqual(0);
			expect(hit.across).toBeLessThanOrEqual(hit.height);
			expect(hit.id).toBeLessThan(layout.count);
		}
	});

	it("le parquet en chevrons se raccorde d'un bord à l'autre", () => {
		const left: HerringboneHit = {
			id: 0,
			horizontal: true,
			along: 0,
			across: 0,
			edge: 0,
		};
		const right: HerringboneHit = { ...left };
		const random = new SeededRandom(5);
		for (let sample = 0; sample < 500; sample += 1) {
			const u = random.next();
			const v = random.next();
			layouts.herringbone(u, v, 16, 4, left);
			layouts.herringbone(u + 1, v + 1, 16, 4, right);
			expect(right.id).toBe(left.id);
			expect(right.horizontal).toBe(left.horizontal);
			expect(right.along).toBeCloseTo(left.along, 6);
		}
	});
});

describe("relief des textures pixel", () => {
	it("donne des normales orientées vers l'extérieur", () => {
		const pixels = new Uint8ClampedArray(8 * 8 * 4);
		for (let index = 0; index < 64; index += 1) {
			const bright = index % 9 === 0 ? 255 : 40;
			pixels.set([bright, bright, bright, 255], index * 4);
		}
		const normals = relief.pixelNormals(pixels, 8, 8, 2.4);
		expect(normals.length).toBe(256);
		for (let index = 0; index < 64; index += 1) {
			const x = normals[index * 4] / 127.5 - 1;
			const y = normals[index * 4 + 1] / 127.5 - 1;
			const z = normals[index * 4 + 2] / 127.5 - 1;
			expect(z).toBeGreaterThan(0);
			expect(Math.hypot(x, y, z)).toBeCloseTo(1, 1);
		}
	});
});
