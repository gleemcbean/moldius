const OUTPUT_RATE = 16000;
const BLOCK_SAMPLES = 1600;

/** Réduit la voix à 16 kHz et l'envoie au jeu par petits blocs, sans rien garder. */
class VoiceCaptureProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.step = sampleRate / OUTPUT_RATE;
		this.progress = 0;
		this.sum = 0;
		this.count = 0;
		this.block = new Int16Array(BLOCK_SAMPLES);
		this.filled = 0;
	}

	process(inputs) {
		const channel = inputs[0]?.[0];
		if (!channel) {
			return true;
		}
		for (let index = 0; index < channel.length; index += 1) {
			this.sum += channel[index];
			this.count += 1;
			this.progress += 1;
			if (this.progress >= this.step) {
				this.progress -= this.step;
				const value = Math.max(-1, Math.min(1, this.sum / this.count));
				this.sum = 0;
				this.count = 0;
				this.block[this.filled] = value * 32767;
				this.filled += 1;
				if (this.filled === BLOCK_SAMPLES) {
					this.port.postMessage(this.block.slice(0));
					this.filled = 0;
				}
			}
		}
		return true;
	}
}

registerProcessor("voice-capture", VoiceCaptureProcessor);
