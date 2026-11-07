export interface RadioFilter {
	input: AudioNode;
	output: AudioNode;
	dispose(): void;
}

function crackleCurve(): Float32Array<ArrayBuffer> {
	const samples = 512;
	const curve = new Float32Array(new ArrayBuffer(samples * 4));
	for (let index = 0; index < samples; index += 1) {
		const x = (index / (samples - 1)) * 2 - 1;
		curve[index] = Math.tanh(x * 3.2);
	}
	return curve;
}

/** Voix serrée et saturée, comme dans un vrai talkie : on sait que ça vient de la radio. */
export function createRadioFilter(context: BaseAudioContext): RadioFilter {
	const high = context.createBiquadFilter();
	high.type = "highpass";
	high.frequency.value = 420;
	const low = context.createBiquadFilter();
	low.type = "lowpass";
	low.frequency.value = 2600;
	const shaper = context.createWaveShaper();
	shaper.curve = crackleCurve();
	high.connect(low);
	low.connect(shaper);
	return {
		input: high,
		output: shaper,
		dispose() {
			high.disconnect();
			low.disconnect();
			shaper.disconnect();
		},
	};
}
