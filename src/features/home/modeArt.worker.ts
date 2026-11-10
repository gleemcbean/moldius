import { drawModeArt, type ModeArtLook } from "./modeArt";

self.onmessage = async (event: MessageEvent<ModeArtLook>) => {
	try {
		self.postMessage({ art: await drawModeArt(event.data) });
	} catch (error) {
		self.postMessage({
			error: error instanceof Error ? error.message : String(error),
		});
	}
};
