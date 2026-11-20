import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelRoot = path.join(root, "src/assets/models");
const textureRoot = path.join(root, "src/assets/textures");

interface Gltf {
	images?: { uri?: string }[];
	materials?: { extras?: { surface?: { texture?: string } } }[];
	nodes?: { name?: string; extras?: Record<string, unknown> }[];
	scenes?: { nodes: number[] }[];
}

interface TextureManifest {
	lowDetail: number;
	surfaces: Record<
		string,
		{
			category: string;
			fine: boolean;
			size: number[];
			lowSize?: number[];
			normal?: boolean;
		}
	>;
	special: Record<string, { category: string; color: boolean }>;
}

type TextureMap = "albedo" | "normal" | "orm";

const CATEGORIES = [
	"architecture",
	"materials",
	"fabrics",
	"decor",
	"plants",
	"creatures",
	"caps",
	"occult",
	"effects",
];

interface PixelData {
	width: number;
	height: number;
	data: Uint8ClampedArray;
}

function walk(directory: string): string[] {
	return readdirSync(directory).flatMap((entry) => {
		const target = path.join(directory, entry);

		return statSync(target).isDirectory() ? walk(target) : [target];
	});
}

function readGlb(file: string): Gltf {
	const buffer = readFileSync(file);

	expect(buffer.toString("ascii", 0, 4)).toBe("glTF");

	const length = buffer.readUInt32LE(12);

	return JSON.parse(buffer.subarray(20, 20 + length).toString("utf8")) as Gltf;
}

const models = walk(modelRoot).filter((file) => file.endsWith(".glb"));

const textures = JSON.parse(
	readFileSync(path.join(textureRoot, "textures.json"), "utf8"),
) as TextureManifest;

const { textureFile } = (await import(
	`${root}/src/features/world/textures/textureKeys.ts`
)) as {
	textureFile: (
		category: string,
		key: string,
		map?: TextureMap,
		low?: boolean,
	) => string;
};

function surfacePath(key: string, map: TextureMap = "albedo", low = false) {
	return path.join(
		textureRoot,
		textureFile(textures.surfaces[key].category, key, map, low),
	);
}

const png = (await import(`${root}/scripts/textures/png.ts`)) as {
	decodePng: (bytes: Uint8Array) => PixelData;
	flipRows: (pixels: PixelData) => PixelData;
};

describe("modèles exportés", () => {
	it("contient chaque modèle attendu par le jeu", () => {
		const ids = new Set(
			models.map((file) =>
				path
					.relative(modelRoot, file)
					.replaceAll("\\", "/")
					.replace(/\.glb$/, ""),
			),
		);

		for (const id of [
			"player/mushroom",
			"player/first_person_body",
			"player/first_person_arms",
			"tools/lantern",
			"tools/camera",
			"tools/walkie",
			"tools/grimoire",
			"world/door",
			"world/door_3panel",
			"world/altar_book",
			"world/stake_orb",
			"furniture/stoneSlab",
		]) {
			expect(ids.has(id), id).toBe(true);
		}
	});

	it.each(models.map((file) => path.relative(modelRoot, file)))(
		"%s ne référence que des textures existantes",
		(relative) => {
			const file = path.join(modelRoot, relative);
			const json = readGlb(file);

			for (const image of json.images ?? []) {
				expect(image.uri, relative).toBeDefined();

				const target = path.resolve(path.dirname(file), image.uri as string);

				expect(existsSync(target), `${relative} → ${image.uri}`).toBe(true);
			}

			for (const material of json.materials ?? []) {
				const key = material.extras?.surface?.texture;

				if (key) {
					expect(textures.surfaces[key], `${relative} → ${key}`).toBeDefined();
				}
			}
		},
	);
});

describe("textures exportées", () => {
	it("range chaque texture par fonction puis par type de carte", () => {
		const files = walk(textureRoot)
			.filter((file) => file.endsWith(".png"))
			.map((file) => path.relative(textureRoot, file).replaceAll("\\", "/"));

		for (const file of files) {
			expect(file, file).toMatch(
				new RegExp(
					`^((${CATEGORIES.join("|")})/(low/)?(albedo|normal|orm)/[^/]+|reflections/[0-5])\\.png$`,
				),
			);
		}

		for (const [key, info] of Object.entries(textures.surfaces)) {
			expect(CATEGORIES, key).toContain(info.category);
		}
	});

	it("fournit chaque fichier listé dans le manifeste", () => {
		for (const [key, info] of Object.entries(textures.surfaces)) {
			const expected: [TextureMap, boolean][] = info.fine
				? [
						["albedo", false],
						["normal", false],
						["orm", false],
						["albedo", true],
						["normal", true],
						["orm", true],
					]
				: info.normal
					? [
							["albedo", false],
							["normal", false],
						]
					: [["albedo", false]];

			for (const [map, low] of expected) {
				const file = surfacePath(key, map, low);

				expect(existsSync(file), file).toBe(true);
			}

			const albedo = png.decodePng(readFileSync(surfacePath(key)));

			expect([albedo.width, albedo.height], key).toEqual(info.size);
		}

		for (const [key, info] of Object.entries(textures.special)) {
			expect(
				existsSync(path.join(textureRoot, textureFile(info.category, key))),
				key,
			).toBe(true);
		}

		for (let face = 0; face < 6; face += 1) {
			expect(
				existsSync(path.join(textureRoot, `reflections/${face}.png`)),
			).toBe(true);
		}
	});

	it("reste à jour avec les recettes procédurales", async () => {
		const catalog = (await import(`${root}/scripts/textures/catalog.ts`)) as {
			paintPixelRecipe: (key: string) => PixelData;
		};

		const recipes = (await import(
			`${root}/scripts/textures/surface/recipes.ts`
		)) as {
			bakeRecipe: (
				key: string,
				detail: number,
			) => {
				width: number;
				height: number;
				albedo: Uint8Array;
				orm: Uint8Array;
			};
		};

		for (const key of ["wallpaperGreen", "cap-d8442f-spots", "flame"]) {
			const painted = catalog.paintPixelRecipe(key);
			const stored = png.decodePng(readFileSync(surfacePath(key)));

			expect(
				Buffer.from(stored.data).equals(Buffer.from(painted.data)),
				key,
			).toBe(true);
		}

		const baked = recipes.bakeRecipe("brass", 1);

		const stored = png.flipRows(
			png.decodePng(readFileSync(surfacePath("brass", "orm"))),
		);

		expect(Buffer.from(stored.data).equals(Buffer.from(baked.orm))).toBe(true);
	});
});
