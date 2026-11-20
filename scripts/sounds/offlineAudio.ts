const BLOCK = 128;
const WAVE_SIZE = 4096;
const BANDS_PER_OCTAVE = 3;

export type OscillatorType = "sine" | "square" | "sawtooth" | "triangle";
export type BiquadFilterType = "lowpass" | "highpass" | "bandpass";

type EventKind = "set" | "linear" | "exp" | "target";

interface ParamEvent {
	kind: EventKind;
	time: number;
	value: number;
	tau: number;
	from: number;
}

interface AudioSink {
	readonly inputs: AudioNode[];
}

export class AudioBuffer {
	private readonly data: Float32Array;

	constructor(
		readonly length: number,
		readonly sampleRate: number,
	) {
		this.data = new Float32Array(length);
	}

	get duration(): number {
		return this.length / this.sampleRate;
	}

	getChannelData(channel: number): Float32Array {
		if (channel !== 0) {
			throw new RangeError(`Canal ${channel} absent : rendu mono uniquement.`);
		}

		return this.data;
	}
}

export class AudioParam implements AudioSink {
	readonly inputs: AudioNode[] = [];
	private readonly events: ParamEvent[] = [];
	private readonly values = new Float32Array(BLOCK);
	private cursor = -1;
	private prepared = false;

	constructor(
		private readonly context: OfflineAudioContext,
		public value: number,
		private readonly min: number,
		private readonly max: number,
	) {}

	setValueAtTime(value: number, time: number): AudioParam {
		return this.insert("set", time, value, 0);
	}

	linearRampToValueAtTime(value: number, time: number): AudioParam {
		return this.insert("linear", time, value, 0);
	}

	exponentialRampToValueAtTime(value: number, time: number): AudioParam {
		if (value === 0) {
			throw new RangeError("Une rampe exponentielle ne peut pas viser 0.");
		}

		return this.insert("exp", time, value, 0);
	}

	setTargetAtTime(target: number, time: number, tau: number): AudioParam {
		return this.insert("target", time, target, tau);
	}

	read(frame: number): Float32Array {
		const values = this.values;

		if (this.events.length === 0) {
			values.fill(this.value);
		} else {
			if (!this.prepared) {
				this.prepare();
			}

			const rate = this.context.sampleRate;

			for (let index = 0; index < BLOCK; index += 1) {
				values[index] = this.at((frame + index) / rate);
			}
		}

		for (const input of this.inputs) {
			const signal = input.pull(frame);

			for (let index = 0; index < BLOCK; index += 1) {
				values[index] += signal[index];
			}
		}

		for (let index = 0; index < BLOCK; index += 1) {
			values[index] = Math.min(this.max, Math.max(this.min, values[index]));
		}

		return values;
	}

	private insert(
		kind: EventKind,
		time: number,
		value: number,
		tau: number,
	): AudioParam {
		const event: ParamEvent = {
			kind,
			time: Math.max(0, time),
			value,
			tau,
			from: 0,
		};

		let index = 0;

		while (
			index < this.events.length &&
			this.events[index].time <= event.time
		) {
			if (
				this.events[index].time === event.time &&
				this.events[index].kind === kind
			) {
				this.events[index] = event;
				this.prepared = false;

				return this;
			}

			index += 1;
		}

		this.events.splice(index, 0, event);

		this.prepared = false;

		return this;
	}

	private prepare(): void {
		for (let index = 0; index < this.events.length; index += 1) {
			this.events[index].from = this.settle(index - 1, this.events[index].time);
		}

		this.cursor = -1;
		this.prepared = true;
	}

	private settle(index: number, time: number): number {
		if (index < 0) {
			return this.value;
		}

		const event = this.events[index];

		if (event.kind !== "target") {
			return event.value;
		}

		if (event.tau <= 0) {
			return event.value;
		}

		return (
			event.value +
			(event.from - event.value) * Math.exp(-(time - event.time) / event.tau)
		);
	}

	private at(time: number): number {
		const events = this.events;

		while (
			this.cursor + 1 < events.length &&
			events[this.cursor + 1].time <= time
		) {
			this.cursor += 1;
		}

		const next = events[this.cursor + 1];

		if (next && (next.kind === "linear" || next.kind === "exp")) {
			let startTime = 0;
			let startValue = this.value;

			if (this.cursor >= 0) {
				const previous = events[this.cursor];

				startTime = previous.time;

				startValue =
					previous.kind === "target" ? previous.from : previous.value;
			}

			const span = next.time - startTime;
			const progress = span > 0 ? (time - startTime) / span : 1;

			if (next.kind === "linear") {
				return startValue + (next.value - startValue) * progress;
			}

			if (startValue === 0 || startValue * next.value < 0) {
				return startValue;
			}

			return startValue * (next.value / startValue) ** progress;
		}

		return this.settle(this.cursor, time);
	}
}

export abstract class AudioNode implements AudioSink {
	readonly inputs: AudioNode[] = [];
	protected readonly output = new Float32Array(BLOCK);
	private mixed: Float32Array | null = null;
	private renderedFrame = -1;

	constructor(readonly context: OfflineAudioContext) {}

	connect<T extends AudioSink>(destination: T): T {
		if (!destination.inputs.includes(this)) {
			destination.inputs.push(this);
		}

		return destination;
	}

	pull(frame: number): Float32Array {
		if (this.renderedFrame !== frame) {
			this.renderedFrame = frame;

			this.process(frame);
		}

		return this.output;
	}

	protected mix(frame: number): Float32Array {
		if (this.inputs.length === 1) {
			return this.inputs[0].pull(frame);
		}

		this.mixed ??= new Float32Array(BLOCK);

		const mixed = this.mixed;

		mixed.fill(0);

		for (const input of this.inputs) {
			const signal = input.pull(frame);

			for (let index = 0; index < BLOCK; index += 1) {
				mixed[index] += signal[index];
			}
		}

		return mixed;
	}

	protected abstract process(frame: number): void;
}

abstract class ScheduledSourceNode extends AudioNode {
	protected startFrame = Number.POSITIVE_INFINITY;
	protected stopFrame = Number.POSITIVE_INFINITY;

	start(when = 0): void {
		this.startFrame = toFrame(when, this.context.sampleRate);
	}

	stop(when = 0): void {
		this.stopFrame = toFrame(when, this.context.sampleRate);
	}

	protected playing(frame: number): boolean {
		return frame >= this.startFrame && frame < this.stopFrame;
	}
}

export class GainNode extends AudioNode {
	readonly gain: AudioParam;

	constructor(context: OfflineAudioContext) {
		super(context);

		this.gain = new AudioParam(
			context,
			1,
			Number.NEGATIVE_INFINITY,
			Number.POSITIVE_INFINITY,
		);
	}

	protected process(frame: number): void {
		const input = this.mix(frame);
		const gain = this.gain.read(frame);
		const output = this.output;

		for (let index = 0; index < BLOCK; index += 1) {
			output[index] = input[index] * gain[index];
		}
	}
}

export class BiquadFilterNode extends AudioNode {
	type: BiquadFilterType = "lowpass";
	readonly frequency: AudioParam;
	readonly Q: AudioParam;
	private x1 = 0;
	private x2 = 0;
	private y1 = 0;
	private y2 = 0;
	private b0 = 1;
	private b1 = 0;
	private b2 = 0;
	private a1 = 0;
	private a2 = 0;
	private lastFrequency = Number.NaN;
	private lastQ = Number.NaN;
	private lastType: BiquadFilterType | null = null;

	constructor(context: OfflineAudioContext) {
		super(context);

		this.frequency = new AudioParam(context, 350, 0, context.sampleRate / 2);

		this.Q = new AudioParam(
			context,
			1,
			Number.NEGATIVE_INFINITY,
			Number.POSITIVE_INFINITY,
		);
	}

	protected process(frame: number): void {
		const input = this.mix(frame);
		const frequency = this.frequency.read(frame);
		const q = this.Q.read(frame);
		const output = this.output;

		for (let index = 0; index < BLOCK; index += 1) {
			if (
				frequency[index] !== this.lastFrequency ||
				q[index] !== this.lastQ ||
				this.type !== this.lastType
			) {
				this.updateCoefficients(frequency[index], q[index]);
			}

			const x = input[index];

			const y =
				this.b0 * x +
				this.b1 * this.x1 +
				this.b2 * this.x2 -
				this.a1 * this.y1 -
				this.a2 * this.y2;

			this.x2 = this.x1;
			this.x1 = x;
			this.y2 = this.y1;
			this.y1 = y;
			output[index] = y;
		}
	}

	private updateCoefficients(frequency: number, q: number): void {
		this.lastFrequency = frequency;
		this.lastQ = q;
		this.lastType = this.type;

		const cutoff = Math.min(
			1,
			Math.max(0, frequency / (this.context.sampleRate / 2)),
		);

		if (this.type === "bandpass") {
			this.setBandpass(cutoff, Math.max(0, q));
		} else {
			this.setPass(cutoff, q, this.type === "highpass");
		}
	}

	private setPass(cutoff: number, resonance: number, high: boolean): void {
		if (cutoff === 1) {
			this.setNormalized(high ? 0 : 1, 0, 0, 1, 0, 0);

			return;
		}

		if (cutoff <= 0) {
			this.setNormalized(high ? 1 : 0, 0, 0, 1, 0, 0);

			return;
		}

		const w0 = Math.PI * cutoff;
		const cos = Math.cos(w0);
		const alpha = 0.5 * Math.sin(w0) * 10 ** (-0.05 * resonance);
		const b1 = high ? -1 - cos : 1 - cos;
		const b0 = high ? -0.5 * b1 : 0.5 * b1;

		this.setNormalized(b0, b1, b0, 1 + alpha, -2 * cos, 1 - alpha);
	}

	private setBandpass(cutoff: number, q: number): void {
		if (cutoff <= 0 || cutoff >= 1) {
			this.setNormalized(0, 0, 0, 1, 0, 0);

			return;
		}

		if (q <= 0) {
			this.setNormalized(1, 0, 0, 1, 0, 0);

			return;
		}

		const w0 = Math.PI * cutoff;
		const alpha = Math.sin(w0) / (2 * q);

		this.setNormalized(
			alpha,
			0,
			-alpha,
			1 + alpha,
			-2 * Math.cos(w0),
			1 - alpha,
		);
	}

	private setNormalized(
		b0: number,
		b1: number,
		b2: number,
		a0: number,
		a1: number,
		a2: number,
	): void {
		this.b0 = b0 / a0;
		this.b1 = b1 / a0;
		this.b2 = b2 / a0;
		this.a1 = a1 / a0;
		this.a2 = a2 / a0;
	}
}

export class WaveShaperNode extends AudioNode {
	curve: Float32Array | null = null;

	protected process(frame: number): void {
		const input = this.mix(frame);
		const output = this.output;
		const curve = this.curve;

		if (!curve || curve.length === 0) {
			output.set(input);

			return;
		}

		const last = curve.length - 1;

		for (let index = 0; index < BLOCK; index += 1) {
			const position = (last / 2) * (input[index] + 1);

			if (position <= 0) {
				output[index] = curve[0];
			} else if (position >= last) {
				output[index] = curve[last];
			} else {
				const lower = Math.floor(position);
				const fraction = position - lower;

				output[index] =
					(1 - fraction) * curve[lower] + fraction * curve[lower + 1];
			}
		}
	}
}

export class OscillatorNode extends ScheduledSourceNode {
	type: OscillatorType = "sine";
	readonly frequency: AudioParam;
	readonly detune: AudioParam;
	private phase = 0;

	constructor(context: OfflineAudioContext) {
		super(context);

		const nyquist = context.sampleRate / 2;

		this.frequency = new AudioParam(context, 440, -nyquist, nyquist);

		this.detune = new AudioParam(
			context,
			0,
			Number.NEGATIVE_INFINITY,
			Number.POSITIVE_INFINITY,
		);
	}

	protected process(frame: number): void {
		const frequency = this.frequency.read(frame);
		const detune = this.detune.read(frame);
		const output = this.output;
		const rate = this.context.sampleRate;
		const nyquist = rate / 2;
		const bank = waveBank(this.type, rate);
		let lastHz = Number.NaN;
		let higher = bank.tables[0];
		let lower = bank.tables[0];
		let blend = 0;

		for (let index = 0; index < BLOCK; index += 1) {
			if (!this.playing(frame + index)) {
				output[index] = 0;
				continue;
			}

			const hz =
				detune[index] === 0
					? frequency[index]
					: Math.min(
							nyquist,
							Math.max(
								-nyquist,
								frequency[index] * 2 ** (detune[index] / 1200),
							),
						);

			if (hz !== lastHz) {
				lastHz = hz;

				const ratio = hz !== 0 ? Math.abs(hz) / bank.lowest : 0.5;

				const range = Math.min(
					bank.tables.length - 1,
					Math.max(0, 1 + Math.log2(ratio) * BANDS_PER_OCTAVE),
				);

				const first = Math.floor(range);
				const second = first < bank.tables.length - 1 ? first + 1 : first;

				higher = bank.tables[first];
				lower = bank.tables[second];
				blend = range - first;
			}

			const position = this.phase * WAVE_SIZE;
			const left = Math.floor(position) % WAVE_SIZE;
			const right = (left + 1) % WAVE_SIZE;
			const fraction = position - Math.floor(position);
			const high = higher[left] + (higher[right] - higher[left]) * fraction;
			const low = lower[left] + (lower[right] - lower[left]) * fraction;

			output[index] = high + (low - high) * blend;
			this.phase += hz / rate;
			this.phase -= Math.floor(this.phase);
		}
	}
}

export class AudioBufferSourceNode extends ScheduledSourceNode {
	buffer: AudioBuffer | null = null;

	protected process(frame: number): void {
		const output = this.output;
		const data = this.buffer?.getChannelData(0) ?? null;

		for (let index = 0; index < BLOCK; index += 1) {
			const position = frame + index - this.startFrame;

			output[index] =
				data && this.playing(frame + index) && position < data.length
					? data[position]
					: 0;
		}
	}
}

export class DelayNode extends AudioNode {
	readonly delayTime: AudioParam;
	private readonly ring: Float32Array;

	constructor(context: OfflineAudioContext, maxDelayTime: number) {
		super(context);

		this.delayTime = new AudioParam(context, 0, 0, maxDelayTime);

		this.ring = new Float32Array(
			Math.ceil(maxDelayTime * context.sampleRate) + BLOCK + 2,
		);
	}

	protected process(frame: number): void {
		const delays = this.delayTime.read(frame);
		const output = this.output;
		const ring = this.ring;

		for (let index = 0; index < BLOCK; index += 1) {
			const delay = delays[index] * this.context.sampleRate;

			if (delay < BLOCK) {
				throw new RangeError(
					"Délai plus court qu'un bloc de rendu : non géré hors ligne.",
				);
			}

			const position = frame + index - delay;
			const lower = Math.floor(position);
			const fraction = position - lower;
			const first = lower >= 0 ? ring[lower % ring.length] : 0;
			const second = lower + 1 >= 0 ? ring[(lower + 1) % ring.length] : 0;

			output[index] = first + (second - first) * fraction;
		}
	}

	commit(frame: number): void {
		const input = this.mix(frame);

		for (let index = 0; index < BLOCK; index += 1) {
			this.ring[(frame + index) % this.ring.length] = input[index];
		}
	}
}

class AudioDestinationNode extends AudioNode {
	protected process(frame: number): void {
		this.output.set(this.mix(frame));
	}
}

export class OfflineAudioContext {
	readonly destination: AudioNode;
	private readonly delays: DelayNode[] = [];

	constructor(
		numberOfChannels: number,
		readonly length: number,
		readonly sampleRate: number,
	) {
		if (numberOfChannels !== 1) {
			throw new RangeError("Le rendu hors ligne ne gère que le mono.");
		}

		this.destination = new AudioDestinationNode(this);
	}

	createBuffer(
		numberOfChannels: number,
		length: number,
		sampleRate: number,
	): AudioBuffer {
		if (numberOfChannels !== 1) {
			throw new RangeError("Le rendu hors ligne ne gère que le mono.");
		}

		return new AudioBuffer(length, sampleRate);
	}

	createBufferSource(): AudioBufferSourceNode {
		return new AudioBufferSourceNode(this);
	}

	createOscillator(): OscillatorNode {
		return new OscillatorNode(this);
	}

	createGain(): GainNode {
		return new GainNode(this);
	}

	createBiquadFilter(): BiquadFilterNode {
		return new BiquadFilterNode(this);
	}

	createWaveShaper(): WaveShaperNode {
		return new WaveShaperNode(this);
	}

	createDelay(maxDelayTime = 1): DelayNode {
		const delay = new DelayNode(this, maxDelayTime);

		this.delays.push(delay);

		return delay;
	}

	startRendering(): Promise<AudioBuffer> {
		const result = new AudioBuffer(this.length, this.sampleRate);
		const data = result.getChannelData(0);

		for (let frame = 0; frame < this.length; frame += BLOCK) {
			const block = this.destination.pull(frame);

			data.set(block.subarray(0, Math.min(BLOCK, this.length - frame)), frame);

			for (const delay of this.delays) {
				delay.commit(frame);
			}
		}

		return Promise.resolve(result);
	}
}

function toFrame(time: number, sampleRate: number): number {
	return Math.max(0, Math.ceil(time * sampleRate - 1e-6));
}

interface WaveBank {
	tables: Float32Array[];
	lowest: number;
}

const waveBanks = new Map<string, WaveBank>();
let sineTable: Float64Array | null = null;

function partial(type: OscillatorType, harmonic: number): number {
	const odd = harmonic % 2 === 1;

	switch (type) {
		case "sine":
			return harmonic === 1 ? 1 : 0;
		case "square":
			return odd ? 4 / (harmonic * Math.PI) : 0;
		case "sawtooth":
			return ((odd ? 1 : -1) * 2) / (harmonic * Math.PI);
		case "triangle":
			return odd
				? ((harmonic % 4 === 1 ? 1 : -1) * 8) /
						(harmonic * harmonic * Math.PI ** 2)
				: 0;
	}
}

function waveBank(type: OscillatorType, sampleRate: number): WaveBank {
	const key = `${type}:${sampleRate}`;
	const cached = waveBanks.get(key);

	if (cached) {
		return cached;
	}

	if (!sineTable) {
		sineTable = new Float64Array(WAVE_SIZE);

		for (let index = 0; index < WAVE_SIZE; index += 1) {
			sineTable[index] = Math.sin((2 * Math.PI * index) / WAVE_SIZE);
		}
	}

	const sine = sineTable;
	const half = WAVE_SIZE / 2;
	const ranges = Math.round(BANDS_PER_OCTAVE * Math.log2(WAVE_SIZE));
	const tables: Float32Array[] = [];
	let scale = 1;

	for (let range = 0; range < ranges; range += 1) {
		const partials = Math.floor(2 ** (-range / BANDS_PER_OCTAVE) * half);
		const table = new Float64Array(WAVE_SIZE);

		for (let harmonic = 1; harmonic < partials; harmonic += 1) {
			const amount = partial(type, harmonic);

			if (amount === 0) {
				continue;
			}

			let phase = 0;

			for (let index = 0; index < WAVE_SIZE; index += 1) {
				table[index] += amount * sine[phase];
				phase += harmonic;

				if (phase >= WAVE_SIZE) {
					phase -= WAVE_SIZE;
				}
			}
		}

		if (range === 0) {
			let peak = 0;

			for (const sample of table) {
				peak = Math.max(peak, Math.abs(sample));
			}

			scale = peak > 0 ? 1 / peak : 1;
		}

		tables.push(Float32Array.from(table, (sample) => sample * scale));
	}

	const bank = { tables, lowest: sampleRate / WAVE_SIZE };

	waveBanks.set(key, bank);

	return bank;
}
