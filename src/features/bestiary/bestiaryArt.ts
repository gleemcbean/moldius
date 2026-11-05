import { ENABLED_SPECIES_IDS } from "@shared/config/monsters";
import type { SpeciesId } from "@shared/config/species";
import * as THREE from "three";
import { renderIllustrations } from "../grimoire/illustrations";
import { ModelKit } from "../models/modelKit";
import { MaterialLibrary } from "../world/MaterialLibrary";
import { TextureLibrary } from "../world/textures/TextureLibrary";

export type BestiaryArt = ReadonlyMap<SpeciesId, string>;

let pending: Promise<BestiaryArt> | null = null;

export function loadBestiaryArt(): Promise<BestiaryArt> {
	pending ??= drawAll().catch((error: unknown) => {
		pending = null;
		throw error;
	});
	return pending;
}

async function drawAll(): Promise<BestiaryArt> {
	const renderer = new THREE.WebGLRenderer({
		antialias: true,
		alpha: true,
		powerPreference: "low-power",
	});
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	const textures = new TextureLibrary(1);
	const materials = new MaterialLibrary(textures);
	try {
		const canvases = await renderIllustrations(
			renderer,
			new ModelKit(materials),
			ENABLED_SPECIES_IDS,
			() => {},
			"color",
		);
		return new Map(
			[...canvases].map(([id, canvas]) => [id, canvas.toDataURL("image/png")]),
		);
	} finally {
		materials.dispose();
		textures.dispose();
		renderer.dispose();
		renderer.forceContextLoss();
	}
}
