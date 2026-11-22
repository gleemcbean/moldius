import { readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MATERIAL_IDS, OCCULT_IDS } from "@shared/config/occult";
import type * as THREE from "three";
import {
	buildCollecteur,
	buildMurmure,
	buildReverbere,
} from "./models/anomalies/bipeds";
import {
	buildArchiviste,
	buildBoursoufle,
	buildBrasier,
	buildDoubleParts,
	buildFeuFollet,
	buildHurleur,
	buildSuinteur,
} from "./models/anomalies/creatures";
import { buildCordyceps } from "./models/anomalies/fungi";
import { buildPhalene } from "./models/anomalies/insects";
import { buildCinematographe } from "./models/anomalies/machines";
import {
	buildBrume,
	buildColosse,
	buildFulgurant,
	buildPleureuse,
	buildRatRoi,
} from "./models/anomalies/newcomers";
import { exportFurniture } from "./models/furniture/export";
import { type GlbReport, type TextureManifest, writeGlb } from "./models/glb";
import { BuildKit } from "./models/kit";
import { createMaterialModel, createOccultModel } from "./models/occult";
import {
	buildFirstPersonArms,
	buildFirstPersonBody,
} from "./models/player/firstPerson";
import { buildMushroom } from "./models/player/mushroom";
import { buildCamera, buildWalkie } from "./models/tools/camera";
import { buildGrimoire } from "./models/tools/grimoire";
import { buildLantern } from "./models/tools/lantern";
import { buildAltarBook, buildStakeOrb } from "./models/world/altarBook";
import { buildDoor } from "./models/world/door";

const MANIFEST_FILE = "manifest.json";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface ManifestEntry {
	path: string;
	category: string;
	bytes: number;
	nodes: string[];
	bbox: GlbReport["bbox"];
	notes?: string[];
}

async function clean(directory: string): Promise<void> {
	let entries: string[];

	try {
		entries = await readdir(directory);
	} catch {
		return;
	}

	for (const entry of entries) {
		const target = path.join(directory, entry);

		if ((await stat(target)).isDirectory()) {
			await clean(target);
		} else if (entry.endsWith(".glb") || entry === MANIFEST_FILE) {
			await rm(target);
		}
	}
}

function entityModels(kit: BuildKit): [string, () => THREE.Object3D][] {
	return [
		["anomalies/veilleur", () => buildReverbere(kit)],
		["anomalies/collecteur", () => buildCollecteur(kit)],
		["anomalies/murmure", () => buildMurmure(kit)],
		["anomalies/crache-cendre", () => buildBrasier(kit)],
		["anomalies/suinteur", () => buildSuinteur(kit)],
		["anomalies/boursoufle", () => buildBoursoufle(kit)],
		["anomalies/luciole", () => buildFeuFollet(kit)],
		["anomalies/hurleur", () => buildHurleur(kit)],
		["anomalies/archiviste", () => buildArchiviste(kit)],
		["anomalies/double", () => buildDoubleParts(kit)],
		["anomalies/colosse", () => buildColosse(kit)],
		["anomalies/fulgurant", () => buildFulgurant(kit)],
		["anomalies/gorgone", () => buildPleureuse(kit)],
		["anomalies/brume", () => buildBrume(kit)],
		["anomalies/rat-roi", () => buildRatRoi(kit)],
		["anomalies/cordyceps", () => buildCordyceps(kit)],
		["anomalies/cinematographe", () => buildCinematographe(kit)],
		["anomalies/phalene", () => buildPhalene(kit)],
		["player/mushroom", () => buildMushroom(kit)],
		["player/first_person_body", () => buildFirstPersonBody(kit)],
		["player/first_person_arms", () => buildFirstPersonArms(kit)],
		["tools/lantern", () => buildLantern(kit)],
		["tools/camera", () => buildCamera(kit)],
		["tools/walkie", () => buildWalkie(kit)],
		["tools/grimoire", () => buildGrimoire(kit)],
		...OCCULT_IDS.map((id): [string, () => THREE.Object3D] => [
			`occult/${id}`,
			() => {
				const model = createOccultModel(kit, id);

				model.name = id;

				return model;
			},
		]),
		...MATERIAL_IDS.map((id): [string, () => THREE.Object3D] => [
			`pickups/${id}`,
			() => {
				const model = createMaterialModel(kit, id);

				model.name = id;

				return model;
			},
		]),
		["world/door", () => buildDoor(kit, 2, "door").root],
		["world/door_3panel", () => buildDoor(kit, 3, "door_3panel").root],
		["world/altar_book", () => buildAltarBook(kit)],
		["world/stake_orb", () => buildStakeOrb(kit)],
	];
}

async function main(): Promise<void> {
	const outRoot = path.resolve(
		process.argv[2] ?? path.join(root, "src/assets/models"),
	);

	const textureRoot = path.join(root, "src/assets/textures");

	const textures = JSON.parse(
		await readFile(path.join(textureRoot, "textures.json"), "utf8"),
	) as TextureManifest;

	await clean(outRoot);

	const kit = new BuildKit();
	const entries: ManifestEntry[] = [];

	const write = async (
		id: string,
		object: THREE.Object3D,
		notes?: string[],
	) => {
		const report = await writeGlb(
			object,
			path.join(outRoot, `${id}.glb`),
			textureRoot,
			textures,
		);

		entries.push({
			path: `${id}.glb`,
			category: id.split("/")[0],
			bytes: report.byteLength,
			nodes: report.nodes,
			bbox: report.bbox,
			...(notes && notes.length > 0 ? { notes } : {}),
		});
	};

	for (const [id, create] of entityModels(kit)) {
		await write(id, create());
	}

	for (const { stem, root: model, notes } of exportFurniture()) {
		await write(`furniture/${stem}`, model, notes);
	}

	entries.sort((a, b) => a.path.localeCompare(b.path));

	await writeFile(
		path.join(outRoot, MANIFEST_FILE),
		`${JSON.stringify({ totalModels: entries.length, models: entries }, null, "\t")}\n`,
	);

	const bytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);

	console.log(
		`${entries.length} modèles (${(bytes / 1e6).toFixed(1)} Mo) écrits dans ${path.relative(root, outRoot) || "."}`,
	);
}

main().catch((error: unknown) => {
	console.error(error);

	process.exitCode = 1;
});
