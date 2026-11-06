import { generateManor, layoutChecksum } from "@shared/manor/generateManor";
import type { MatchConfig } from "@shared/matchConfig";

interface GenerationRequest {
	seed: number;
	config: MatchConfig & { pickupTotal: number };
}

self.onmessage = (event: MessageEvent<GenerationRequest>) => {
	const layout = generateManor(event.data.seed, event.data.config);
	self.postMessage({ layout, checksum: layoutChecksum(layout) });
};
