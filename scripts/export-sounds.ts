import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashString } from "../shared/random.js";
import { encodeOpus } from "./sounds/encodeOpus.js";
import { OfflineAudioContext } from "./sounds/offlineAudio.js";
import { AMBIENCE_SOUNDS } from "./sounds/recipes/ambienceSounds.js";
import { ANOMALY_SOUNDS } from "./sounds/recipes/anomalySounds.js";
import { CINEMA_SOUNDS } from "./sounds/recipes/cinemaSounds.js";
import { INFECTION_SOUNDS } from "./sounds/recipes/infectionSounds.js";
import { PARTY_SOUNDS } from "./sounds/recipes/partySounds.js";
import { PLAYER_SOUNDS } from "./sounds/recipes/playerSounds.js";
import type { SoundRecipe } from "./sounds/recipes/types.js";
import { UI_SOUNDS } from "./sounds/recipes/uiSounds.js";
import { VISION_SOUNDS } from "./sounds/recipes/visionSounds.js";
import { SynthKit } from "./sounds/synthKit.js";

const SAMPLE_RATE = 48000;
const LOOP_FADE_SECONDS = 0.25;
const LOOP_FILE = "loops.json";

const RECIPES: SoundRecipe[] = [
	...UI_SOUNDS,
	...PLAYER_SOUNDS,
	...ANOMALY_SOUNDS,
	...INFECTION_SOUNDS,
	...CINEMA_SOUNDS,
	...VISION_SOUNDS,
	...AMBIENCE_SOUNDS,
	...PARTY_SOUNDS,
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function render(
	recipe: SoundRecipe,
	variant: number,
): Promise<Float32Array> {
	const context = new OfflineAudioContext(
		1,
		Math.ceil(SAMPLE_RATE * recipe.duration),
		SAMPLE_RATE,
	);

	recipe.render(
		new SynthKit(context, hashString(`${recipe.id}:${variant}`)),
		variant,
	);

	const buffer = await context.startRendering();

	return buffer.getChannelData(0);
}

function crossfadeLoop(data: Float32Array): number {
	const fade = Math.min(
		Math.floor(SAMPLE_RATE * LOOP_FADE_SECONDS),
		Math.floor(data.length / 4),
	);

	for (let index = 0; index < fade; index += 1) {
		const t = index / fade;

		data[index] = data[index] * t + data[data.length - fade + index] * (1 - t);
	}

	return (data.length - fade) / SAMPLE_RATE;
}

function fileName(recipe: SoundRecipe, variant: number): string {
	return recipe.variants === 1
		? `${recipe.id}.ogg`
		: `${recipe.id}.${variant}.ogg`;
}

async function main(): Promise<void> {
	const outDir = path.resolve(
		process.argv[2] ?? path.join(root, "src/assets/sounds"),
	);

	const ids = RECIPES.map((recipe) => recipe.id);
	const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);

	if (duplicate) {
		throw new Error(`Identifiant de son en double : ${duplicate}`);
	}

	await mkdir(outDir, { recursive: true });

	for (const entry of await readdir(outDir)) {
		if (entry.endsWith(".ogg") || entry === LOOP_FILE) {
			await rm(path.join(outDir, entry));
		}
	}

	const loops: Record<string, number> = {};
	let files = 0;
	let seconds = 0;

	for (const recipe of RECIPES) {
		for (let variant = 0; variant < recipe.variants; variant += 1) {
			const samples = await render(recipe, variant);

			if (recipe.loop) {
				loops[recipe.id] = crossfadeLoop(samples);
			}

			await encodeOpus(samples, path.join(outDir, fileName(recipe, variant)), {
				sampleRate: SAMPLE_RATE,
				channels: 1,
				bitrate: "96k",
			});

			files += 1;
			seconds += samples.length / SAMPLE_RATE;
		}
	}

	await writeFile(
		path.join(outDir, LOOP_FILE),
		`${JSON.stringify(loops, null, "\t")}\n`,
	);

	console.log(
		`${files} fichiers (${RECIPES.length} sons, ${seconds.toFixed(1)} s) écrits dans ${path.relative(root, outDir) || "."}`,
	);
}

main().catch((error: unknown) => {
	console.error(error);

	process.exitCode = 1;
});
