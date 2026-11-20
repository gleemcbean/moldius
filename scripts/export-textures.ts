import { mkdir, readdir, rm, rmdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	type TextureMap,
	textureFile,
} from "../src/features/world/textures/textureKeys";
import {
	PIXEL_RECIPES,
	paintPixelRecipe,
	pixelTile,
	SPECIAL_TEXTURES,
} from "./textures/catalog";
import { type TextureCategory, textureCategory } from "./textures/categories";
import type { PixelData } from "./textures/PixelPainter";
import { encodePng, flipRows } from "./textures/png";
import { reflectionFaces } from "./textures/reflections";
import {
	pixelNormals,
	pixelReliefStrength,
} from "./textures/surface/pixelRelief";
import { bakeRecipe, FINE_RECIPES, fineSize } from "./textures/surface/recipes";

const MANIFEST_FILE = "textures.json";
const REFLECTION_DIR = "reflections";
const LOW_DETAIL = 0.5;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface PixelEntry {
	category: TextureCategory;
	fine: false;
	size: [number, number];
	tile: [number, number];
	normal: boolean;
}

interface FineEntry {
	category: TextureCategory;
	fine: true;
	size: [number, number];
	lowSize: [number, number];
	tile: [number, number];
	metallic: boolean;
	depth: number;
	parallax: boolean;
}

function glOrder(width: number, height: number, data: Uint8Array): PixelData {
	return flipRows({ width, height, data: new Uint8ClampedArray(data) });
}

async function clean(directory: string): Promise<void> {
	await mkdir(directory, { recursive: true });

	for (const entry of await readdir(directory)) {
		const target = path.join(directory, entry);

		if ((await stat(target)).isDirectory()) {
			await clean(target);

			if ((await readdir(target)).length === 0) {
				await rmdir(target);
			}
		} else if (entry.endsWith(".png") || entry === MANIFEST_FILE) {
			await rm(target);
		}
	}
}

async function main(): Promise<void> {
	const outDir = path.resolve(
		process.argv[2] ?? path.join(root, "src/assets/textures"),
	);

	await clean(outDir);

	const overlap = Object.keys(PIXEL_RECIPES).filter(
		(key) => key in FINE_RECIPES || key in SPECIAL_TEXTURES,
	);

	if (overlap.length > 0) {
		throw new Error(`Textures en double : ${overlap.join(", ")}`);
	}

	let files = 0;
	let bytes = 0;
	const counts = new Map<TextureCategory, number>();

	const write = async (
		key: string,
		map: TextureMap,
		pixels: PixelData,
		low = false,
	) => {
		const category = textureCategory(key);
		const file = path.join(outDir, textureFile(category, key, map, low));

		await mkdir(path.dirname(file), { recursive: true });

		const png = encodePng(pixels);

		await writeFile(file, png);

		files += 1;
		bytes += png.byteLength;

		counts.set(category, (counts.get(category) ?? 0) + 1);
	};

	const surfaces: Record<string, PixelEntry | FineEntry> = {};

	for (const [key, recipe] of Object.entries(PIXEL_RECIPES)) {
		const albedo = paintPixelRecipe(key);

		await write(key, "albedo", albedo);

		const strength = pixelReliefStrength(key);

		if (strength > 0) {
			const normal = pixelNormals(
				albedo.data,
				albedo.width,
				albedo.height,
				strength,
			);

			await write(key, "normal", glOrder(albedo.width, albedo.height, normal));
		}

		surfaces[key] = {
			category: textureCategory(key),
			fine: false,
			size: [albedo.width, albedo.height],
			tile: pixelTile(recipe),
			normal: strength > 0,
		};
	}

	for (const [key, recipe] of Object.entries(FINE_RECIPES)) {
		for (const low of [false, true]) {
			const baked = bakeRecipe(key, low ? LOW_DETAIL : 1);
			const { width, height } = baked;

			await write(key, "albedo", glOrder(width, height, baked.albedo), low);
			await write(key, "normal", glOrder(width, height, baked.normal), low);
			await write(key, "orm", glOrder(width, height, baked.orm), low);
		}

		surfaces[key] = {
			category: textureCategory(key),
			fine: true,
			size: fineSize(recipe, 1),
			lowSize: fineSize(recipe, LOW_DETAIL),
			tile: recipe.tile,
			metallic: recipe.metallic === true,
			depth: recipe.depth,
			parallax: recipe.parallax,
		};
	}

	await mkdir(path.join(outDir, REFLECTION_DIR), { recursive: true });

	for (const [index, face] of reflectionFaces().entries()) {
		const png = encodePng(face);

		await writeFile(path.join(outDir, REFLECTION_DIR, `${index}.png`), png);

		files += 1;
		bytes += png.byteLength;
	}

	const special: Record<string, { category: TextureCategory; color: boolean }> =
		{};

	for (const [key, { paint, color }] of Object.entries(SPECIAL_TEXTURES)) {
		await write(key, "albedo", paint());

		special[key] = { category: textureCategory(key), color };
	}

	await writeFile(
		path.join(outDir, MANIFEST_FILE),
		`${JSON.stringify({ lowDetail: LOW_DETAIL, surfaces, special }, null, "\t")}\n`,
	);

	console.log(
		`${files} textures (${(bytes / 1e6).toFixed(1)} Mo) écrites dans ${path.relative(root, outDir) || "."}`,
	);

	console.log(
		[...counts]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([category, count]) => `  ${category} : ${count}`)
			.join("\n"),
	);
}

main().catch((error: unknown) => {
	console.error(error);

	process.exitCode = 1;
});
