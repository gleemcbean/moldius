import { audioEngine } from "../audio/audioEngine";

const WORKLET_URL = "/voice-capture.worklet.js";

let ready: Promise<boolean> | null = null;

/** Un module ne se charge qu'une fois : le navigateur refuse le second. */
export function loadVoiceWorklet(): Promise<boolean> {
	ready ??= (async () => {
		const worklet = audioEngine.ctx.audioWorklet;
		if (!worklet) {
			return false;
		}
		try {
			await worklet.addModule(WORKLET_URL);
			return true;
		} catch {
			return false;
		}
	})();
	return ready;
}
