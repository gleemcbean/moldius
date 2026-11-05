import { SeededRandom } from "@shared/random";

export type NoiseColor = "white" | "pink" | "brown";

export interface Envelope {
	time: number;
	value: number;
}

export class SynthKit {
	readonly rng: SeededRandom;

	constructor(
		readonly ctx: OfflineAudioContext,
		seed: number,
	) {
		this.rng = new SeededRandom(seed);
	}

	get out(): AudioNode {
		return this.ctx.destination;
	}

	noiseBuffer(color: NoiseColor, seconds: number): AudioBuffer {
		const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
		const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
		const data = buffer.getChannelData(0);
		let last = 0;
		let b0 = 0;
		let b1 = 0;
		let b2 = 0;
		for (let index = 0; index < length; index += 1) {
			const white = this.rng.next() * 2 - 1;
			if (color === "white") {
				data[index] = white;
			} else if (color === "brown") {
				last = (last + 0.02 * white) / 1.02;
				data[index] = last * 3.5;
			} else {
				b0 = 0.99765 * b0 + white * 0.099046;
				b1 = 0.963 * b1 + white * 0.2965164;
				b2 = 0.57 * b2 + white * 1.0526913;
				data[index] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
			}
		}
		return buffer;
	}

	noise(
		color: NoiseColor,
		start: number,
		duration: number,
		destination: AudioNode,
	): AudioBufferSourceNode {
		const source = this.ctx.createBufferSource();
		source.buffer = this.noiseBuffer(color, duration + 0.05);
		source.connect(destination);
		source.start(start);
		source.stop(start + duration);
		return source;
	}

	osc(
		type: OscillatorType,
		frequency: number,
		start: number,
		duration: number,
		destination: AudioNode,
	): OscillatorNode {
		const oscillator = this.ctx.createOscillator();
		oscillator.type = type;
		oscillator.frequency.value = frequency;
		oscillator.connect(destination);
		oscillator.start(start);
		oscillator.stop(start + duration);
		return oscillator;
	}

	gain(value: number, destination: AudioNode = this.out): GainNode {
		const node = this.ctx.createGain();
		node.gain.value = value;
		node.connect(destination);
		return node;
	}

	filter(
		type: BiquadFilterType,
		frequency: number,
		q: number,
		destination: AudioNode,
	): BiquadFilterNode {
		const node = this.ctx.createBiquadFilter();
		node.type = type;
		node.frequency.value = frequency;
		node.Q.value = q;
		node.connect(destination);
		return node;
	}

	shaper(amount: number, destination: AudioNode): WaveShaperNode {
		const node = this.ctx.createWaveShaper();
		const samples = 1024;
		const curve = new Float32Array(samples);
		for (let index = 0; index < samples; index += 1) {
			const x = (index / (samples - 1)) * 2 - 1;
			curve[index] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
		}
		node.curve = curve;
		node.connect(destination);
		return node;
	}

	envelope(param: AudioParam, points: Envelope[]): void {
		const [first, ...rest] = points;
		if (!first) {
			return;
		}
		param.setValueAtTime(first.value, first.time);
		for (const point of rest) {
			param.linearRampToValueAtTime(point.value, point.time);
		}
	}

	expEnvelope(param: AudioParam, points: Envelope[]): void {
		const [first, ...rest] = points;
		if (!first) {
			return;
		}
		param.setValueAtTime(Math.max(0.0001, first.value), first.time);
		for (const point of rest) {
			param.exponentialRampToValueAtTime(
				Math.max(0.0001, point.value),
				point.time,
			);
		}
	}

	hit(
		start: number,
		attack: number,
		decay: number,
		peak: number,
		destination: AudioNode,
	): GainNode {
		const node = this.ctx.createGain();
		node.gain.value = 0;
		this.envelope(node.gain, [
			{ time: start, value: 0 },
			{ time: start + attack, value: peak },
		]);
		node.gain.setTargetAtTime(0, start + attack, decay / 4);
		node.connect(destination);
		return node;
	}

	lfo(
		frequency: number,
		depth: number,
		param: AudioParam,
		start: number,
		duration: number,
		type: OscillatorType = "sine",
	): void {
		const oscillator = this.ctx.createOscillator();
		oscillator.type = type;
		oscillator.frequency.value = frequency;
		const depthNode = this.ctx.createGain();
		depthNode.gain.value = depth;
		oscillator.connect(depthNode).connect(param);
		oscillator.start(start);
		oscillator.stop(start + duration);
	}

	range(min: number, max: number): number {
		return this.rng.range(min, max);
	}
}
