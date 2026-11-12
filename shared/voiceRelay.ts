export const VOICE_RELAY_AFTER_MS = 8000;
export const VOICE_RELAY_BLOCK_SAMPLES = 640;
export const VOICE_RELAY_MAX_BYTES = 2000;
export const VOICE_RELAY_MAX_PEERS = 16;

const MU_LAW_BIAS = 0x84;
const MU_LAW_CLIP = 32635;
const GATE_LEVEL = 180;
const GATE_HOLD_BLOCKS = 12;

export function encodeMuLaw(samples: Int16Array): Uint8Array {
	const encoded = new Uint8Array(samples.length);
	for (let index = 0; index < samples.length; index += 1) {
		let sample = samples[index];
		const sign = sample < 0 ? 0x80 : 0;
		if (sample < 0) {
			sample = -sample;
		}
		sample = Math.min(sample, MU_LAW_CLIP) + MU_LAW_BIAS;
		let exponent = 7;
		for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) {
			exponent -= 1;
		}
		const mantissa = (sample >> (exponent + 3)) & 0x0f;
		encoded[index] = ~(sign | (exponent << 4) | mantissa) & 0xff;
	}
	return encoded;
}

export function decodeMuLaw(encoded: Uint8Array): Int16Array {
	const samples = new Int16Array(encoded.length);
	for (let index = 0; index < encoded.length; index += 1) {
		const value = ~encoded[index] & 0xff;
		const exponent = (value >> 4) & 0x07;
		const magnitude =
			(((value & 0x0f) << 3) + MU_LAW_BIAS) * 2 ** exponent - MU_LAW_BIAS;
		samples[index] = value & 0x80 ? -magnitude : magnitude;
	}
	return samples;
}

export class VoiceRelayGate {
	private hold = 0;

	shouldSend(samples: Int16Array): boolean {
		let sum = 0;
		for (const sample of samples) {
			sum += sample * sample;
		}
		if (Math.sqrt(sum / Math.max(1, samples.length)) >= GATE_LEVEL) {
			this.hold = GATE_HOLD_BLOCKS;
			return true;
		}
		if (this.hold > 0) {
			this.hold -= 1;
			return true;
		}
		return false;
	}
}
