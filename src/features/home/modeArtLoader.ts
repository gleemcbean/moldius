import type { GameMode, ModeArtLook } from "./modeArt";

export type { GameMode, ModeArtLook };

type ModeArt = Record<GameMode, string>;

let cached: { key: string; art: Promise<ModeArt> } | null = null;

/** Les trois images, une fois par apparence du joueur (il y figure). */
export function loadModeArt(look: ModeArtLook): Promise<ModeArt> {
	const key = `${look.color}-${look.pattern}-${look.lantern}`;
	if (cached?.key !== key) {
		const art = drawInWorker(look).catch(async (error: unknown) => {
			// Sans OffscreenCanvas WebGL (vieux Safari) : sur place, quitte à figer l'accueil un instant.
			console.warn("Illustrations des modes : repli hors worker", error);
			const { drawModeArt } = await import("./modeArt");
			return drawModeArt(look);
		});
		art.catch(() => {
			if (cached?.art === art) {
				cached = null;
			}
		});
		cached = { key, art };
	}
	return cached.art;
}

/**
 * Le manoir, les meshes, les textures et les shaders : plusieurs centaines de
 * millisecondes de calcul, qui figeraient la scène d'accueil sur le thread principal.
 */
async function drawInWorker(look: ModeArtLook): Promise<ModeArt> {
	if (typeof OffscreenCanvas === "undefined") {
		throw new Error("OffscreenCanvas indisponible");
	}
	const worker = new Worker(new URL("./modeArt.worker.ts", import.meta.url), {
		type: "module",
	});
	try {
		return await new Promise<ModeArt>((resolve, reject) => {
			worker.onmessage = (
				event: MessageEvent<{ art?: ModeArt; error?: string }>,
			) => {
				if (event.data.art) {
					resolve(event.data.art);
				} else {
					reject(new Error(event.data.error));
				}
			};
			worker.onerror = (event) => reject(new Error(event.message));
			worker.postMessage(look);
		});
	} finally {
		worker.terminate();
	}
}
