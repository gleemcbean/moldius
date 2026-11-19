import { spawn } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashString } from "../shared/random.js";
import { OfflineAudioContext } from "./sounds/offlineAudio.js";
import { AMBIENCE_SOUNDS } from "./sounds/recipes/ambienceSounds.js";
import { ANOMALY_SOUNDS } from "./sounds/recipes/anomalySounds.js";
import { MUSIC_SOUNDS } from "./sounds/recipes/musicSounds.js";
import { PARTY_SOUNDS } from "./sounds/recipes/partySounds.js";
import { PLAYER_SOUNDS } from "./sounds/recipes/playerSounds.js";
import type { SoundRecipe } from "./sounds/recipes/types.js";
import { UI_SOUNDS } from "./sounds/recipes/uiSounds.js";
import { SynthKit } from "./sounds/synthKit.js";

const SAMPLE_RATE = 48000;
const BITRATE = "96k";
const LOOP_FADE_SECONDS = 0.25;
const LOOP_FILE = "loops.json";

const RECIPES: SoundRecipe[] = [
	...UI_SOUNDS,
	...MUSIC_SOUNDS,
	...PLAYER_SOUNDS,
	...ANOMALY_SOUNDS,
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

function encode(samples: Float32Array, file: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const ffmpeg = spawn(
			"ffmpeg",
			[
				"-hide_banner",
				"-loglevel",
				"error",
				"-y",
				"-f",
				"f32le",
				"-ar",
				String(SAMPLE_RATE),
				"-ac",
				"1",
				"-i",
				"pipe:0",
				"-c:a",
				"libopus",
				"-b:a",
				BITRATE,
				"-vbr",
				"on",
				"-application",
				"audio",
				"-map_metadata",
				"-1",
				"-fflags",
				"+bitexact",
				"-flags:a",
				"+bitexact",
				file,
			],
			{ stdio: ["pipe", "inherit", "inherit"] },
		);
		ffmpeg.on("error", (error) =>
			reject(
				new Error(
					`Impossible de lancer ffmpeg (requis pour encoder les sons) : ${error.message}`,
				),
			),
		);
		ffmpeg.on("close", (code) =>
			code === 0
				? resolve()
				: reject(new Error(`ffmpeg a échoué (code ${code}) sur ${file}`)),
		);
		ffmpeg.stdin.end(
			Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength),
		);
	});
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
			await encode(samples, path.join(outDir, fileName(recipe, variant)));
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
