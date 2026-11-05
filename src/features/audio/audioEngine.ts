import type { VolumeSettings } from "../../types/settings";

export type AudioBus = "ambience" | "music" | "effects" | "voice" | "ui";

export interface ReverbPreset {
	seconds: number;
	brightness: number;
	wet: number;
}

const REVERB_SENDS: Record<AudioBus, number> = {
	ambience: 0.55,
	music: 0.4,
	effects: 1,
	voice: 0.35,
	ui: 0,
};

interface ReverbSlot {
	convolver: ConvolverNode;
	wet: GainNode;
}

export interface ListenerPose {
	x: number;
	y: number;
	z: number;
	forwardX: number;
	forwardY: number;
	forwardZ: number;
}

class AudioEngine {
	private context: AudioContext | null = null;
	private master: GainNode | null = null;
	private readonly buses = new Map<AudioBus, GainNode>();
	private reverbSlots: ReverbSlot[] = [];
	private activeReverb = 0;
	private reverbKey = "";
	private readonly impulses = new Map<string, AudioBuffer>();
	private volumes: VolumeSettings = {
		master: 0.85,
		ambience: 0.7,
		music: 0.5,
		effects: 0.85,
		voice: 1,
	};

	get ctx(): AudioContext {
		return this.ensureContext();
	}

	private ensureContext(): AudioContext {
		if (!this.context) {
			this.context = new AudioContext({ latencyHint: "interactive" });
			this.master = this.context.createGain();
			const compressor = this.context.createDynamicsCompressor();
			compressor.threshold.value = -14;
			compressor.knee.value = 10;
			compressor.ratio.value = 6;
			compressor.attack.value = 0.004;
			compressor.release.value = 0.2;
			this.master.connect(compressor).connect(this.context.destination);
			const reverbInput = this.context.createGain();
			for (let index = 0; index < 2; index += 1) {
				const convolver = this.context.createConvolver();
				const wet = this.context.createGain();
				wet.gain.value = 0;
				reverbInput.connect(convolver).connect(wet).connect(this.master);
				this.reverbSlots.push({ convolver, wet });
			}
			for (const bus of [
				"ambience",
				"music",
				"effects",
				"voice",
				"ui",
			] as AudioBus[]) {
				const gain = this.context.createGain();
				gain.connect(this.master);
				if (REVERB_SENDS[bus] > 0) {
					const send = this.context.createGain();
					send.gain.value = REVERB_SENDS[bus];
					gain.connect(send).connect(reverbInput);
				}
				this.buses.set(bus, gain);
			}
			this.applyVolumes();
		}
		return this.context;
	}

	get ready(): boolean {
		return this.context !== null && this.context.state === "running";
	}

	async resume(): Promise<void> {
		const context = this.ctx;
		if (context.state !== "running") {
			try {
				await context.resume();
			} catch {
				return;
			}
		}
	}

	bus(name: AudioBus): GainNode {
		this.ensureContext();
		return this.buses.get(name) as GainNode;
	}

	setVolumes(volumes: VolumeSettings): void {
		this.volumes = volumes;
		this.applyVolumes();
	}

	private applyVolumes(): void {
		if (!this.context || !this.master) {
			return;
		}
		const now = this.context.currentTime;
		this.master.gain.setTargetAtTime(this.volumes.master, now, 0.05);
		this.buses
			.get("ambience")
			?.gain.setTargetAtTime(this.volumes.ambience, now, 0.05);
		this.buses
			.get("music")
			?.gain.setTargetAtTime(this.volumes.music, now, 0.05);
		this.buses
			.get("effects")
			?.gain.setTargetAtTime(this.volumes.effects, now, 0.05);
		this.buses
			.get("voice")
			?.gain.setTargetAtTime(this.volumes.voice, now, 0.05);
		this.buses
			.get("ui")
			?.gain.setTargetAtTime(
				Math.min(1, this.volumes.effects * 0.8),
				now,
				0.05,
			);
	}

	setReverb(preset: ReverbPreset): void {
		if (!this.context || this.reverbSlots.length === 0) {
			return;
		}
		const key = `${preset.seconds.toFixed(2)}:${preset.brightness}:${preset.wet}`;
		if (key === this.reverbKey) {
			return;
		}
		this.reverbKey = key;
		const impulseKey = `${preset.seconds.toFixed(2)}:${preset.brightness}`;
		let impulse = this.impulses.get(impulseKey);
		if (!impulse) {
			impulse = createImpulse(this.context, preset.seconds, preset.brightness);
			this.impulses.set(impulseKey, impulse);
		}
		const time = this.context.currentTime;
		const previous = this.reverbSlots[this.activeReverb];
		this.activeReverb = (this.activeReverb + 1) % this.reverbSlots.length;
		const next = this.reverbSlots[this.activeReverb];
		next.convolver.buffer = impulse;
		previous.wet.gain.setTargetAtTime(0, time, 0.35);
		next.wet.gain.setTargetAtTime(preset.wet, time, 0.35);
	}

	setListener(pose: ListenerPose): void {
		if (!this.context) {
			return;
		}
		const listener = this.context.listener;
		const time = this.context.currentTime;
		if (listener.positionX) {
			listener.positionX.setTargetAtTime(pose.x, time, 0.02);
			listener.positionY.setTargetAtTime(pose.y, time, 0.02);
			listener.positionZ.setTargetAtTime(pose.z, time, 0.02);
			listener.forwardX.setTargetAtTime(pose.forwardX, time, 0.02);
			listener.forwardY.setTargetAtTime(pose.forwardY, time, 0.02);
			listener.forwardZ.setTargetAtTime(pose.forwardZ, time, 0.02);
			listener.upX.value = 0;
			listener.upY.value = 1;
			listener.upZ.value = 0;
		} else {
			listener.setPosition(pose.x, pose.y, pose.z);
			listener.setOrientation(
				pose.forwardX,
				pose.forwardY,
				pose.forwardZ,
				0,
				1,
				0,
			);
		}
	}

	createPanner(refDistance = 1.2, maxDistance = 40, rolloff = 1.4): PannerNode {
		const panner = this.ctx.createPanner();
		panner.panningModel = "HRTF";
		panner.distanceModel = "inverse";
		panner.refDistance = refDistance;
		panner.maxDistance = maxDistance;
		panner.rolloffFactor = rolloff;
		return panner;
	}
}

export const audioEngine = new AudioEngine();

function createImpulse(
	context: BaseAudioContext,
	seconds: number,
	brightness: number,
): AudioBuffer {
	const length = Math.max(1, Math.floor(context.sampleRate * seconds));
	const buffer = context.createBuffer(2, length, context.sampleRate);
	const smoothing = Math.exp((-2 * Math.PI * brightness) / context.sampleRate);
	for (let channel = 0; channel < 2; channel += 1) {
		const data = buffer.getChannelData(channel);
		let low = 0;
		let seed = 0x9e3779b9 ^ (channel * 0x85ebca6b) ^ length;
		for (let index = 0; index < length; index += 1) {
			seed ^= seed << 13;
			seed ^= seed >>> 17;
			seed ^= seed << 5;
			const noise = ((seed >>> 0) / 4294967296) * 2 - 1;
			const t = index / context.sampleRate;
			const darken = smoothing * (1 - Math.exp(-t * 8));
			low = low * darken + noise * (1 - darken);
			const envelope = Math.exp((-6.9 * t) / seconds);
			const onset = Math.min(1, index / (context.sampleRate * 0.004));
			data[index] = low * envelope * onset;
		}
	}
	return buffer;
}

export function setPannerPosition(
	panner: PannerNode,
	x: number,
	y: number,
	z: number,
): void {
	if (panner.positionX) {
		const time = panner.context.currentTime;
		panner.positionX.setTargetAtTime(x, time, 0.03);
		panner.positionY.setTargetAtTime(y, time, 0.03);
		panner.positionZ.setTargetAtTime(z, time, 0.03);
	} else {
		panner.setPosition(x, y, z);
	}
}
