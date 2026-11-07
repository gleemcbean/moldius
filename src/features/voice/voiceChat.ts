import {
	VOICE_PROXIMITY_FULL_RANGE,
	VOICE_PROXIMITY_MAX_RANGE,
} from "@shared/config/index";
import type { IceServerConfig, VoiceSignal } from "@shared/protocol/lobby";
import { VOICE_RELAY_AFTER_MS } from "@shared/voiceRelay";
import { createStore } from "../../utils/store";
import { audioEngine, setPannerPosition } from "../audio/audioEngine";
import { getSocket } from "../network/socket";
import { createRadioFilter, type RadioFilter } from "./radioEffect";
import { VoiceRelayCapture, VoiceRelayPlayback } from "./voiceRelay";

export type VoiceMode = "lobby" | "game";

interface PeerLink {
	id: string;
	connection: RTCPeerConnection;
	polite: boolean;
	makingOffer: boolean;
	ignoreOffer: boolean;
	transceiver: RTCRtpTransceiver | null;
	element: HTMLAudioElement | null;
	stream: MediaStream | null;
	source: AudioNode | null;
	gain: GainNode;
	filter: BiquadFilterNode;
	panner: PannerNode;
	analyser: AnalyserNode;
	radio: RadioFilter;
	radioGain: GainNode;
	radioOn: boolean;
	samples: Float32Array<ArrayBuffer>;
	state: RTCPeerConnectionState;
	offerSentAt: number;
	queue: Promise<void>;
	pendingCandidates: RTCIceCandidateInit[];
	directStream: MediaStream | null;
	/** Depuis quand le lien direct n'est pas établi ; null s'il l'est. */
	downSince: number | null;
	relayed: boolean;
	relayPlayback: VoiceRelayPlayback | null;
	restartedAt: number;
}

interface PendingSignal {
	peerId: string;
	signal: VoiceSignal;
}

const OFFER_RETRY_MS = 2500;
const WATCHDOG_INTERVAL_MS = 1000;
const ICE_RESTART_INTERVAL_MS = 30_000;

export interface VoicePeerInfo {
	level: number;
	state: RTCPeerConnectionState;
	/** La voix passe par le serveur, faute de lien direct. */
	relayed: boolean;
}

export const voiceStore = createStore<{ peers: Record<string, VoicePeerInfo> }>(
	{ peers: {} },
);

class VoiceChat {
	private myId: string | null = null;
	private iceServers: RTCIceServer[] = [];
	private readonly peers = new Map<string, PeerLink>();
	private localTrack: MediaStreamTrack | null = null;
	private mode: VoiceMode = "lobby";
	private listening = false;
	private meterTimer: number | null = null;
	private watchdogTimer: number | null = null;
	private readonly pending: PendingSignal[] = [];
	private readonly relayCapture = new VoiceRelayCapture((data) =>
		this.sendRelay(data),
	);

	listen(): void {
		if (this.listening) {
			return;
		}
		this.listening = true;
		getSocket().on("voice:signal", ({ peerId, signal }) => {
			if (!this.myId) {
				this.pending.push({ peerId, signal });
				return;
			}
			this.handleSignal(peerId, signal);
		});
		getSocket().on("voice:relay", ({ peerId, data }) =>
			this.receiveRelay(peerId, data),
		);
	}

	start(myId: string, iceServers: IceServerConfig[]): void {
		this.myId = myId;
		this.iceServers = iceServers.map((server) => ({ ...server }));
		this.listen();
		if (this.meterTimer === null) {
			this.meterTimer = window.setInterval(() => this.publishLevels(), 100);
		}
		if (this.watchdogTimer === null) {
			this.watchdogTimer = window.setInterval(() => {
				this.retryStalledOffers();
				this.superviseLinks();
			}, WATCHDOG_INTERVAL_MS);
		}
		for (const { peerId, signal } of this.pending.splice(
			0,
			this.pending.length,
		)) {
			this.handleSignal(peerId, signal);
		}
	}

	setLocalTrack(track: MediaStreamTrack | null): void {
		this.localTrack = track;
		for (const link of this.peers.values()) {
			void link.transceiver?.sender.replaceTrack(track);
		}
		this.updateRelayCapture();
	}

	setMode(mode: VoiceMode): void {
		if (this.mode === mode) {
			return;
		}
		this.mode = mode;
		for (const link of this.peers.values()) {
			this.route(link);
		}
	}

	sync(peerIds: string[]): void {
		if (!this.myId) {
			return;
		}
		const wanted = new Set(peerIds.filter((id) => id !== this.myId));
		for (const id of [...this.peers.keys()]) {
			if (!wanted.has(id)) {
				this.close(id);
			}
		}
		for (const id of wanted) {
			if (!this.peers.has(id)) {
				this.createLink(id);
			}
		}
	}

	stopAll(): void {
		for (const id of [...this.peers.keys()]) {
			this.close(id);
		}
	}

	/** Le talkie double la voix sans la spatialiser : on l'entend d'où qu'on soit. */
	setRadio(peerId: string, on: boolean): void {
		const link = this.peers.get(peerId);
		if (!link || link.radioOn === on) {
			return;
		}
		link.radioOn = on;
		link.radioGain.gain.setTargetAtTime(
			on ? 1.2 : 0,
			audioEngine.ctx.currentTime,
			0.03,
		);
	}

	clearRadio(): void {
		for (const id of this.peers.keys()) {
			this.setRadio(id, false);
		}
	}

	updateSpatial(
		peerId: string,
		position: { x: number; y: number; z: number } | null,
		occlusion: number,
		distance: number,
	): void {
		const link = this.peers.get(peerId);
		if (!link) {
			return;
		}
		const context = audioEngine.ctx;
		if (!position) {
			link.gain.gain.setTargetAtTime(0, context.currentTime, 0.1);
			return;
		}
		setPannerPosition(link.panner, position.x, position.y, position.z);
		const silenced = distance > VOICE_PROXIMITY_MAX_RANGE;
		const wallFactor = 0.45 ** occlusion;
		link.gain.gain.setTargetAtTime(
			silenced ? 0 : wallFactor,
			context.currentTime,
			0.12,
		);
		link.filter.frequency.setTargetAtTime(
			occlusion > 0 ? 18000 * 0.16 ** Math.min(occlusion, 3) : 18000,
			context.currentTime,
			0.12,
		);
	}

	remoteStream(peerId: string): MediaStream | null {
		return this.peers.get(peerId)?.stream ?? null;
	}

	levelOf(peerId: string): number {
		return voiceStore.get().peers[peerId]?.level ?? 0;
	}

	private createLink(peerId: string): PeerLink {
		const context = audioEngine.ctx;
		const connection = new RTCPeerConnection({ iceServers: this.iceServers });
		const caller = (this.myId ?? "") < peerId;
		const transceiver = caller
			? connection.addTransceiver("audio", { direction: "sendrecv" })
			: null;
		const gain = context.createGain();
		const filter = context.createBiquadFilter();
		filter.type = "lowpass";
		filter.frequency.value = 18000;
		const panner = audioEngine.createPanner(
			VOICE_PROXIMITY_FULL_RANGE,
			VOICE_PROXIMITY_MAX_RANGE,
			1,
		);
		panner.distanceModel = "linear";
		const analyser = context.createAnalyser();
		analyser.fftSize = 512;
		const radio = createRadioFilter(context);
		const radioGain = context.createGain();
		radioGain.gain.value = 0;
		radio.output.connect(radioGain);
		radioGain.connect(audioEngine.bus("voice"));
		const link: PeerLink = {
			id: peerId,
			connection,
			polite: !caller,
			makingOffer: false,
			ignoreOffer: false,
			transceiver,
			element: null,
			stream: null,
			source: null,
			gain,
			filter,
			panner,
			analyser,
			radio,
			radioGain,
			radioOn: false,
			samples: new Float32Array(new ArrayBuffer(analyser.fftSize * 4)),
			state: "new",
			offerSentAt: 0,
			queue: Promise.resolve(),
			pendingCandidates: [],
			directStream: null,
			downSince: performance.now(),
			relayed: false,
			relayPlayback: null,
			restartedAt: 0,
		};
		filter.connect(gain);
		this.route(link);
		if (transceiver && this.localTrack) {
			void transceiver.sender.replaceTrack(this.localTrack);
		}
		connection.onnegotiationneeded = async () => {
			try {
				link.makingOffer = true;
				await connection.setLocalDescription();
				if (connection.localDescription) {
					link.offerSentAt = performance.now();
					this.send(peerId, {
						kind: "offer",
						sdp: connection.localDescription.sdp,
					});
				}
			} catch {
				return;
			} finally {
				link.makingOffer = false;
			}
		};
		connection.onicecandidate = ({ candidate }) => {
			if (candidate) {
				this.send(peerId, {
					kind: "candidate",
					candidate: candidate.candidate,
					sdpMid: candidate.sdpMid,
					sdpMLineIndex: candidate.sdpMLineIndex,
				});
			}
		};
		connection.ontrack = (event) => {
			link.directStream = event.streams[0] ?? new MediaStream([event.track]);
			if (!link.relayed) {
				this.attachRemote(link, link.directStream);
			}
		};
		connection.onconnectionstatechange = () => {
			link.state = connection.connectionState;
			this.superviseLink(link);
			this.updateRelayCapture();
		};
		this.peers.set(peerId, link);
		return link;
	}

	private route(link: PeerLink): void {
		link.gain.disconnect();
		link.panner.disconnect();
		const bus = audioEngine.bus("voice");
		if (this.mode === "game") {
			link.gain.connect(link.panner).connect(bus);
		} else {
			link.gain.gain.setTargetAtTime(1, audioEngine.ctx.currentTime, 0.05);
			link.filter.frequency.value = 18000;
			link.gain.connect(bus);
		}
	}

	private attachRemote(link: PeerLink, stream: MediaStream): void {
		link.source?.disconnect();
		if (link.element) {
			link.element.srcObject = null;
		}
		const element = new Audio();
		element.muted = true;
		element.srcObject = stream;
		void element.play().catch(() => undefined);
		link.element = element;
		link.stream = stream;
		const context = audioEngine.ctx;
		link.source = context.createMediaStreamSource(stream);
		this.connectSource(link, link.source);
	}

	private attachRelay(link: PeerLink, playback: VoiceRelayPlayback): void {
		link.source?.disconnect();
		if (link.element) {
			link.element.srcObject = null;
			link.element = null;
		}
		link.stream = playback.stream;
		link.source = playback.bus;
		this.connectSource(link, playback.bus);
		playback.bus.connect(playback.output);
	}

	private connectSource(link: PeerLink, source: AudioNode): void {
		source.connect(link.filter);
		source.connect(link.analyser);
		source.connect(link.radio.input);
	}

	private handleSignal(peerId: string, signal: VoiceSignal): void {
		const link = this.peers.get(peerId) ?? this.createLink(peerId);
		link.queue = link.queue
			.then(() => this.processSignal(link, signal))
			.catch(() => undefined);
	}

	private async processSignal(
		link: PeerLink,
		signal: VoiceSignal,
	): Promise<void> {
		const connection = link.connection;
		if (connection.signalingState === "closed") {
			return;
		}
		if (signal.kind === "candidate") {
			const candidate: RTCIceCandidateInit = {
				candidate: signal.candidate,
				sdpMid: signal.sdpMid,
				sdpMLineIndex: signal.sdpMLineIndex,
			};
			if (!connection.remoteDescription) {
				link.pendingCandidates.push(candidate);
				return;
			}
			await connection.addIceCandidate(candidate).catch(() => undefined);
			return;
		}
		if (
			signal.kind === "answer" &&
			connection.signalingState !== "have-local-offer"
		) {
			return;
		}
		const collision =
			signal.kind === "offer" &&
			(link.makingOffer || connection.signalingState !== "stable");
		link.ignoreOffer = !link.polite && collision;
		if (link.ignoreOffer) {
			return;
		}
		await connection.setRemoteDescription({
			type: signal.kind,
			sdp: signal.sdp,
		});
		for (const candidate of link.pendingCandidates.splice(
			0,
			link.pendingCandidates.length,
		)) {
			await connection.addIceCandidate(candidate).catch(() => undefined);
		}
		if (signal.kind === "offer") {
			await this.adoptRemoteTransceiver(link);
			await connection.setLocalDescription();
			if (connection.localDescription) {
				this.send(link.id, {
					kind: "answer",
					sdp: connection.localDescription.sdp,
				});
			}
		}
	}

	private async adoptRemoteTransceiver(link: PeerLink): Promise<void> {
		if (link.transceiver) {
			return;
		}
		const created = link.connection
			.getTransceivers()
			.find((item) => item.receiver.track.kind === "audio");
		if (!created) {
			return;
		}
		created.direction = "sendrecv";
		link.transceiver = created;
		if (this.localTrack) {
			await created.sender.replaceTrack(this.localTrack);
		}
	}

	/** Le relais prend le relais d'un lien direct qui n'aboutit pas, sans cesser d'y revenir. */
	private superviseLink(link: PeerLink): void {
		const now = performance.now();
		const connection = link.connection;
		if (connection.connectionState === "connected") {
			link.downSince = null;
			if (link.relayed) {
				link.relayed = false;
				if (link.directStream) {
					this.attachRemote(link, link.directStream);
				}
			}
			return;
		}
		link.downSince ??= now;
		if (now - link.downSince >= VOICE_RELAY_AFTER_MS) {
			link.relayed = true;
		}
		if (
			connection.connectionState === "failed" &&
			now - link.restartedAt >= ICE_RESTART_INTERVAL_MS
		) {
			link.restartedAt = now;
			connection.restartIce();
		}
	}

	private superviseLinks(): void {
		for (const link of this.peers.values()) {
			this.superviseLink(link);
		}
		this.updateRelayCapture();
	}

	private updateRelayCapture(): void {
		if (
			this.localTrack &&
			[...this.peers.values()].some((link) => link.relayed)
		) {
			void this.relayCapture.start(this.localTrack);
		} else {
			this.relayCapture.stop();
		}
	}

	private sendRelay(data: ArrayBuffer): void {
		const peerIds = [...this.peers.values()]
			.filter((link) => link.relayed)
			.map((link) => link.id);
		if (peerIds.length > 0) {
			getSocket().volatile.emit("voice:relay", { peerIds, data });
		}
	}

	private receiveRelay(peerId: string, data: ArrayBuffer): void {
		const link = this.peers.get(peerId);
		if (!link || link.connection.connectionState === "connected") {
			return;
		}
		link.relayed = true;
		link.relayPlayback ??= new VoiceRelayPlayback();
		if (link.stream !== link.relayPlayback.stream) {
			this.attachRelay(link, link.relayPlayback);
		}
		link.relayPlayback.play(data);
		this.updateRelayCapture();
	}

	private retryStalledOffers(): void {
		const now = performance.now();
		for (const link of this.peers.values()) {
			const connection = link.connection;
			const description = connection.localDescription;
			if (
				connection.signalingState !== "have-local-offer" ||
				!description ||
				now - link.offerSentAt < OFFER_RETRY_MS
			) {
				continue;
			}
			link.offerSentAt = now;
			this.send(link.id, { kind: "offer", sdp: description.sdp });
		}
	}

	private send(peerId: string, signal: VoiceSignal): void {
		getSocket().emit("voice:signal", { peerId, signal });
	}

	private close(peerId: string): void {
		const link = this.peers.get(peerId);
		if (!link) {
			return;
		}
		link.connection.close();
		link.source?.disconnect();
		link.gain.disconnect();
		link.panner.disconnect();
		link.radio.dispose();
		link.radioGain.disconnect();
		link.relayPlayback?.dispose();
		if (link.element) {
			link.element.srcObject = null;
		}
		this.peers.delete(peerId);
		this.updateRelayCapture();
	}

	private publishLevels(): void {
		const peers: Record<string, VoicePeerInfo> = {};
		for (const link of this.peers.values()) {
			link.analyser.getFloatTimeDomainData(link.samples);
			let sum = 0;
			for (const value of link.samples) {
				sum += value * value;
			}
			const rms = Math.sqrt(sum / link.samples.length);
			const db = 20 * Math.log10(Math.max(rms, 1e-7));
			peers[link.id] = {
				level: Math.min(1, Math.max(0, (db + 58) / 46)),
				state: link.state,
				relayed: link.relayed,
			};
		}
		voiceStore.set({ peers });
	}
}

export const voiceChat = new VoiceChat();
