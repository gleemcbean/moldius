import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashString, SeededRandom } from "../shared/random.js";
import { encodeOpus } from "./sounds/encodeOpus.js";
import { OfflineAudioContext } from "./sounds/offlineAudio.js";
import {
	CHORD_S,
	MUSIC_CHORD,
	MUSIC_NOTE,
	NEXT_CHORDS,
} from "./sounds/recipes/musicSounds.js";
import type { SoundRecipe } from "./sounds/recipes/types.js";
import { SynthKit } from "./sounds/synthKit.js";

const SAMPLE_RATE = 48000;
const TRACK_ID = "ambient";
const CHORD_COUNT = 10;
const FIRST_NOTE_S = 3;
const NOTE_CHANCE = 0.7;
const NOTE_GAP_MIN_S = 2.2;
const NOTE_GAP_SPREAD_S = 4.5;
const NOTE_PAN = 0.4;
const PEAK_LIMIT = 0.95;
const CONFIG_FILE = "music.json";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface TrackConfig {
	loopStart?: number;
	loopEnd?: number;
	volume?: number;
}

async function renderVariants(recipe: SoundRecipe): Promise<Float32Array[]> {
	const variants: Float32Array[] = [];

	for (let variant = 0; variant < recipe.variants; variant += 1) {
		const context = new OfflineAudioContext(
			1,
			Math.ceil(SAMPLE_RATE * recipe.duration),
			SAMPLE_RATE,
		);

		recipe.render(
			new SynthKit(context, hashString(`${recipe.id}:${variant}`)),
			variant,
		);

		variants.push((await context.startRendering()).getChannelData(0));
	}

	return variants;
}

function chordSequence(rng: SeededRandom): number[] {
	for (;;) {
		const sequence = [0];

		while (sequence.length < CHORD_COUNT) {
			sequence.push(rng.pick(NEXT_CHORDS[sequence[sequence.length - 1]]));
		}

		const closes = NEXT_CHORDS[sequence[sequence.length - 1]].includes(0);
		const varied = new Set(sequence).size === NEXT_CHORDS.length;

		if (closes && varied) {
			return sequence;
		}
	}
}

function mixInto(
	left: Float32Array,
	right: Float32Array,
	samples: Float32Array,
	at: number,
	pan: number,
): void {
	const angle = ((pan + 1) * Math.PI) / 4;
	const gainLeft = pan === 0 ? 1 : Math.cos(angle);
	const gainRight = pan === 0 ? 1 : Math.sin(angle);

	for (let index = 0; index < samples.length; index += 1) {
		left[at + index] += samples[index] * gainLeft;
		right[at + index] += samples[index] * gainRight;
	}
}

function foldTail(channel: Float32Array, loopLength: number): Float32Array {
	const folded = channel.slice(0, loopLength);

	for (let index = loopLength; index < channel.length; index += 1) {
		folded[index % loopLength] += channel[index];
	}

	return folded;
}

async function readConfig(file: string): Promise<Record<string, TrackConfig>> {
	try {
		return JSON.parse(await readFile(file, "utf8"));
	} catch {
		return {};
	}
}

async function main(): Promise<void> {
	const outDir = path.resolve(
		process.argv[2] ?? path.join(root, "src/assets/music"),
	);

	const rng = SeededRandom.fromString("moldius-ambient");
	const chords = await renderVariants(MUSIC_CHORD);
	const notes = await renderVariants(MUSIC_NOTE);
	const loopSeconds = CHORD_COUNT * CHORD_S;
	const loopLength = Math.round(loopSeconds * SAMPLE_RATE);

	const tail = Math.max(
		...chords.map((chord) => chord.length),
		...notes.map((note) => note.length),
	);

	const left = new Float32Array(loopLength + tail);
	const right = new Float32Array(loopLength + tail);

	for (const [index, chord] of chordSequence(rng).entries()) {
		mixInto(
			left,
			right,
			chords[chord],
			Math.round(index * CHORD_S * SAMPLE_RATE),
			0,
		);
	}

	for (
		let time = FIRST_NOTE_S;
		time < loopSeconds;
		time += NOTE_GAP_MIN_S + rng.next() * NOTE_GAP_SPREAD_S
	) {
		const note = rng.pick(notes);
		const pan = rng.range(-NOTE_PAN, NOTE_PAN);

		if (rng.chance(NOTE_CHANCE)) {
			mixInto(left, right, note, Math.round(time * SAMPLE_RATE), pan);
		}
	}

	const loopLeft = foldTail(left, loopLength);
	const loopRight = foldTail(right, loopLength);
	let peak = 0;

	for (let index = 0; index < loopLength; index += 1) {
		peak = Math.max(
			peak,
			Math.abs(loopLeft[index]),
			Math.abs(loopRight[index]),
		);
	}

	const gain = peak > PEAK_LIMIT ? PEAK_LIMIT / peak : 1;
	const interleaved = new Float32Array(loopLength * 2);

	for (let index = 0; index < loopLength; index += 1) {
		interleaved[index * 2] = loopLeft[index] * gain;
		interleaved[index * 2 + 1] = loopRight[index] * gain;
	}

	await mkdir(outDir, { recursive: true });

	await encodeOpus(interleaved, path.join(outDir, `${TRACK_ID}.ogg`), {
		sampleRate: SAMPLE_RATE,
		channels: 2,
		bitrate: "128k",
	});

	const configFile = path.join(outDir, CONFIG_FILE);
	const config = await readConfig(configFile);

	config[TRACK_ID] = {
		...config[TRACK_ID],
		loopStart: 0,
		loopEnd: loopSeconds,
	};

	await writeFile(configFile, `${JSON.stringify(config, null, "\t")}\n`);

	console.log(
		`${TRACK_ID}.ogg : boucle de ${loopSeconds} s (crête ${peak.toFixed(2)}, gain ${gain.toFixed(2)}) écrite dans ${path.relative(root, outDir) || "."}`,
	);
}

main().catch((error: unknown) => {
	console.error(error);

	process.exitCode = 1;
});
