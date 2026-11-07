import { describe, expect, it } from "vitest";
import { parseVoiceRelay } from "../server/net/validation.js";
import {
	decodeMuLaw,
	encodeMuLaw,
	VOICE_RELAY_MAX_BYTES,
	VOICE_RELAY_MAX_PEERS,
	VoiceRelayGate,
} from "../shared/voiceRelay.js";

describe("relais de la voix", () => {
	it("restitue le signal à quelques pourcents près", () => {
		const samples = Int16Array.from({ length: 640 }, (_, index) =>
			Math.round(Math.sin(index * 0.12) * 12000),
		);
		const decoded = decodeMuLaw(encodeMuLaw(samples));
		expect(encodeMuLaw(samples).length).toBe(samples.length);
		samples.forEach((sample, index) => {
			expect(Math.abs(decoded[index] - sample)).toBeLessThanOrEqual(
				Math.abs(sample) * 0.05 + 40,
			);
		});
		expect(
			decodeMuLaw(encodeMuLaw(Int16Array.of(-32768, 32767, 0)))[0],
		).toBeLessThan(-30000);
	});

	it("n'envoie rien pendant un silence, sans couper la fin des mots", () => {
		const gate = new VoiceRelayGate();
		const quiet = new Int16Array(640);
		const loud = new Int16Array(640).fill(4000);
		expect(gate.shouldSend(quiet)).toBe(false);
		expect(gate.shouldSend(loud)).toBe(true);
		expect(gate.shouldSend(quiet)).toBe(true);
		let sent = 0;
		for (let block = 0; block < 40; block += 1) {
			sent += gate.shouldSend(quiet) ? 1 : 0;
		}
		expect(sent).toBeLessThan(15);
		expect(gate.shouldSend(quiet)).toBe(false);
	});

	it("refuse les envois malformés ou trop lourds", () => {
		const data = Buffer.alloc(640);
		expect(parseVoiceRelay({ peerIds: ["p2"], data })).toEqual({
			peerIds: ["p2"],
			data,
		});
		for (const invalid of [
			null,
			{ peerIds: "p2", data },
			{ peerIds: [1], data },
			{ peerIds: ["p2"], data: "texte" },
			{ peerIds: ["p2"], data: Buffer.alloc(0) },
			{ peerIds: ["p2"], data: Buffer.alloc(VOICE_RELAY_MAX_BYTES + 1) },
			{ peerIds: Array(VOICE_RELAY_MAX_PEERS + 1).fill("p2"), data },
		]) {
			expect(parseVoiceRelay(invalid)).toBeNull();
		}
	});
});
