import { currentMessages } from "../../i18n";
import { createStore } from "../../utils/store";
import { audioEngine } from "../audio/audioEngine";

export type MicStatus =
	| "idle"
	| "requesting"
	| "ready"
	| "denied"
	| "no-device"
	| "lost"
	| "unsupported"
	| "silent"
	| "error";

export interface MicState {
	status: MicStatus;
	deviceLabel: string;
	deviceId: string | null;
	devices: { id: string; label: string }[];
	level: number;
	transmitting: boolean;
}

export const micStore = createStore<MicState>({
	status: "idle",
	deviceLabel: "",
	deviceId: null,
	devices: [],
	level: 0,
	transmitting: false,
});

const MIN_DB = -62;
const MAX_DB = -12;
const SILENCE_CHECK_MS = 6000;
const DISPLAY_DECAY = 0.8;

class MicManager {
	private stream: MediaStream | null = null;
	private outgoing: MediaStream | null = null;
	private holdUntil = 0;
	private analyser: AnalyserNode | null = null;
	private analysisContext: AudioContext | null = null;
	private displayLevel = 0;
	private source: MediaStreamAudioSourceNode | null = null;
	private samples: Float32Array<ArrayBuffer> | null = null;
	private meterTimer: number | null = null;
	private heardSignalAt = 0;
	private acquiredAt = 0;
	private gate = 0.06;
	private readonly trackListeners = new Set<
		(track: MediaStreamTrack | null) => void
	>();
	private watchingDevices = false;

	get track(): MediaStreamTrack | null {
		return this.stream?.getAudioTracks()[0] ?? null;
	}

	get outgoingStream(): MediaStream | null {
		return this.outgoing;
	}

	get inputStream(): MediaStream | null {
		return this.stream;
	}

	onTrackChange(
		listener: (track: MediaStreamTrack | null) => void,
	): () => void {
		this.trackListeners.add(listener);
		return () => this.trackListeners.delete(listener);
	}

	async acquire(deviceId: string | null): Promise<boolean> {
		if (!navigator.mediaDevices?.getUserMedia) {
			this.setStatus("unsupported");
			return false;
		}
		this.setStatus("requesting");
		this.watchDevices();
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					...(deviceId ? { deviceId: { exact: deviceId } } : {}),
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});
			this.release(false);
			this.stream = stream;
			const track = stream.getAudioTracks()[0];
			if (!track) {
				this.setStatus("no-device");
				return false;
			}
			this.outgoing = new MediaStream([track.clone()]);
			track.addEventListener("ended", () => this.handleLost());
			await audioEngine.resume();
			this.attachAnalyser(stream);
			this.acquiredAt = performance.now();
			this.heardSignalAt = 0;
			micStore.set({
				deviceLabel: track.label || currentMessages().game.mic.fallbackLabel,
				deviceId: track.getSettings().deviceId ?? deviceId,
			});
			this.setStatus("ready");
			this.applyGate();
			await this.refreshDevices();
			this.trackListeners.forEach(
				(listener) => void listener(this.outgoing?.getAudioTracks()[0] ?? null),
			);
			return true;
		} catch (error) {
			const name = error instanceof DOMException ? error.name : "";
			if (name === "NotAllowedError" || name === "SecurityError") {
				this.setStatus("denied");
			} else if (name === "NotFoundError" || name === "OverconstrainedError") {
				this.setStatus(deviceId ? "error" : "no-device");
				if (deviceId) {
					return this.acquire(null);
				}
			} else {
				this.setStatus("error");
			}
			return false;
		}
	}

	release(notify = true): void {
		this.stream?.getTracks().forEach((track) => void track.stop());
		this.outgoing?.getTracks().forEach((track) => void track.stop());
		this.stream = null;
		this.outgoing = null;
		this.source?.disconnect();
		this.source = null;
		this.analyser = null;
		void this.analysisContext?.close().catch(() => undefined);
		this.analysisContext = null;
		this.displayLevel = 0;
		if (this.meterTimer !== null) {
			window.clearInterval(this.meterTimer);
			this.meterTimer = null;
		}
		if (notify) {
			this.trackListeners.forEach((listener) => void listener(null));
			this.setStatus("idle");
		}
	}

	private createAnalysisContext(stream: MediaStream): AudioContext {
		const sampleRate = stream.getAudioTracks()[0]?.getSettings().sampleRate;
		try {
			return sampleRate ? new AudioContext({ sampleRate }) : new AudioContext();
		} catch {
			return new AudioContext();
		}
	}

	private attachAnalyser(stream: MediaStream): void {
		const context = this.createAnalysisContext(stream);
		this.analysisContext = context;
		this.resumeAnalysis();
		this.source = context.createMediaStreamSource(stream);
		this.analyser = context.createAnalyser();
		this.analyser.fftSize = 1024;
		this.samples = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
		const silent = context.createGain();
		silent.gain.value = 0;
		this.source
			.connect(this.analyser)
			.connect(silent)
			.connect(context.destination);
		if (this.meterTimer !== null) {
			window.clearInterval(this.meterTimer);
		}
		this.meterTimer = window.setInterval(() => this.publishLevel(), 66);
	}

	measure(): number {
		if (!this.analyser || !this.samples) {
			return 0;
		}
		this.analyser.getFloatTimeDomainData(this.samples);
		let sum = 0;
		for (const value of this.samples) {
			sum += value * value;
		}
		const rms = Math.sqrt(sum / this.samples.length);
		const db = 20 * Math.log10(Math.max(rms, 1e-7));
		return Math.min(1, Math.max(0, (db - MIN_DB) / (MAX_DB - MIN_DB)));
	}

	private resumeAnalysis(): void {
		const context = this.analysisContext;
		if (!context || context.state === "running") {
			return;
		}
		void context.resume().catch(() => undefined);
		const retry = () => {
			window.removeEventListener("pointerdown", retry);
			window.removeEventListener("keydown", retry);
			void this.analysisContext?.resume().catch(() => undefined);
		};
		window.addEventListener("pointerdown", retry);
		window.addEventListener("keydown", retry);
	}

	private publishLevel(): void {
		const level = this.measure();
		this.displayLevel = Math.max(level, this.displayLevel * DISPLAY_DECAY);
		if (level > 0.03) {
			this.heardSignalAt = performance.now();
		}
		const state = micStore.get();
		if (
			state.status === "ready" &&
			this.heardSignalAt === 0 &&
			performance.now() - this.acquiredAt > SILENCE_CHECK_MS
		) {
			this.setStatus("silent");
		} else if (state.status === "silent" && this.heardSignalAt > 0) {
			this.setStatus("ready");
		}
		this.applyGate(level);
		micStore.set({ level: this.displayLevel });
	}

	async recordClip(durationMs: number): Promise<Blob | null> {
		const stream = this.stream;
		if (!stream || typeof MediaRecorder === "undefined") {
			return null;
		}
		this.resumeAnalysis();
		const recorder = new MediaRecorder(stream);
		const chunks: Blob[] = [];
		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				chunks.push(event.data);
			}
		};
		const stopped = new Promise<void>((resolve) => {
			recorder.onstop = () => resolve();
		});
		recorder.start();
		await new Promise((resolve) => window.setTimeout(resolve, durationMs));
		recorder.stop();
		await stopped;
		return chunks.length > 0
			? new Blob(chunks, { type: recorder.mimeType })
			: null;
	}

	async playClip(clip: Blob, volume: number): Promise<void> {
		const url = URL.createObjectURL(clip);
		const audio = new Audio(url);
		audio.volume = Math.min(1, Math.max(0, volume));
		try {
			await audio.play();
			await new Promise<void>((resolve) => {
				audio.onended = () => resolve();
				audio.onerror = () => resolve();
			});
		} finally {
			URL.revokeObjectURL(url);
		}
	}

	setVoiceGate(gate: number): void {
		this.gate = gate;
		this.applyGate();
	}

	isTransmitting(): boolean {
		return micStore.get().transmitting;
	}

	voiceActive(): boolean {
		return performance.now() < this.holdUntil;
	}

	private applyGate(level = micStore.get().level): void {
		if (level >= this.gate) {
			this.holdUntil = performance.now() + 400;
		}
		const transmitting = this.voiceActive();
		if (micStore.get().transmitting !== transmitting) {
			micStore.set({ transmitting });
		}
	}

	private handleLost(): void {
		this.trackListeners.forEach((listener) => void listener(null));
		this.setStatus("lost");
	}

	private watchDevices(): void {
		if (this.watchingDevices || !navigator.mediaDevices) {
			return;
		}
		this.watchingDevices = true;
		navigator.mediaDevices.addEventListener("devicechange", () => {
			void this.refreshDevices().then(() => {
				const current = micStore.get();
				if (current.status === "lost" && current.devices.length > 0) {
					void this.acquire(null);
				}
			});
		});
	}

	async refreshDevices(): Promise<void> {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			const inputs = devices
				.filter((device) => device.kind === "audioinput")
				.map((device, index) => ({
					id: device.deviceId,
					label: device.label || currentMessages().game.mic.device(index + 1),
				}));
			micStore.set({ devices: inputs });
			if (inputs.length === 0 && micStore.get().status !== "denied") {
				this.setStatus("no-device");
			}
		} catch {
			return;
		}
	}

	private setStatus(status: MicStatus): void {
		micStore.set({ status });
	}
}

export const micManager = new MicManager();

export function micIsUsable(status: MicStatus): boolean {
	return status === "ready";
}
